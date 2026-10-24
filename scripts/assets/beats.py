"""Detect the beat grid of a music file with numpy only: STFT spectral flux, adaptive peak picking, an autocorrelation tempo
estimate between 60 and 200 bpm, and the offset of the first beat. ffmpeg decodes the file (any format) to mono 22050 Hz.

  python3 scripts/assets/beats.py <audio file> [--out beats.json]      writes {"bpm", "offsetMs", "beats": [ms...], "onsets": [ms...]}
  python3 scripts/assets/beats.py --self-check                           synthesised click tracks must come back within 1 bpm and 25 ms

A Spot reads the result with loadBeats(json, fps) from 'frameforge'.
"""
import json, os, subprocess, sys
import numpy as np

SR = 22050
WINDOW, HOP = 1024, 256
RATE = SR / HOP  # onset-envelope frames per second
FFMPEG = os.environ.get('FFMPEG_PATH', 'ffmpeg')
BPM_RANGE = (60, 200)


def decode(path):
    """Mono float samples at SR via ffmpeg."""
    result = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True)
    if result.returncode != 0:
        raise SystemExit(f'beats.py: ffmpeg could not decode {path}: {result.stderr.decode(errors="replace").strip().splitlines()[-1:]}')
    return np.frombuffer(result.stdout, dtype=np.float32).astype(np.float64)


def onset_envelope(samples):
    """Half-wave rectified log-spectral flux per hop, smoothed over three frames."""
    if len(samples) < WINDOW:
        samples = np.pad(samples, (0, WINDOW - len(samples)))
    frames = np.lib.stride_tricks.sliding_window_view(samples, WINDOW)[::HOP]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(WINDOW), axis=1))
    log_spectrum = np.log1p(1000 * spectrum)
    flux = np.maximum(np.diff(log_spectrum, axis=0), 0).sum(axis=1)
    flux = np.concatenate([[0.0], flux])
    return np.convolve(flux, np.ones(3) / 3, mode='same')


def pick_onsets(envelope):
    """Indices of local maxima that rise above the local mean by a fraction of the local spread, at least 50 ms apart."""
    half = int(RATE * 0.5)
    padded = np.pad(envelope, half, mode='edge')
    windows = np.lib.stride_tricks.sliding_window_view(padded, 2 * half + 1)
    threshold = windows.mean(axis=1) + 0.5 * windows.std(axis=1) + 1e-9
    gap = max(1, int(RATE * 0.05))
    peaks = []
    for i in range(1, len(envelope) - 1):
        if envelope[i] >= threshold[i] and envelope[i] >= envelope[i - 1] and envelope[i] > envelope[i + 1]:
            if peaks and i - peaks[-1] < gap:
                if envelope[i] > envelope[peaks[-1]]:
                    peaks[-1] = i
            else:
                peaks.append(i)
    return np.array(peaks, dtype=int)


def estimate_tempo(envelope):
    """Period in envelope frames from the autocorrelation peak in the bpm range, weighted gently toward 120 bpm, refined by a parabola."""
    centred = envelope - envelope.mean()
    if not centred.any():
        return RATE * 60 / 120
    spectrum = np.fft.rfft(centred, 2 * len(centred))
    autocorr = np.fft.irfft(spectrum * np.conj(spectrum))[:len(centred)]
    autocorr /= autocorr[0] + 1e-12
    low, high = int(RATE * 60 / BPM_RANGE[1]), int(np.ceil(RATE * 60 / BPM_RANGE[0]))
    lags = np.arange(low, min(high, len(autocorr) - 2) + 1)
    bpm = RATE * 60 / lags
    weight = np.exp(-0.5 * (np.log2(bpm / 120) / 1.0) ** 2)
    score = autocorr[lags] * weight
    # A lag whose half also scores well is the slower octave of a faster pulse; prefer the faster one when its evidence is close.
    best = lags[int(np.argmax(score))]
    half = best // 2
    if half >= low and autocorr[half] >= 0.8 * autocorr[best]:
        best = half
    y0, y1, y2 = autocorr[best - 1], autocorr[best], autocorr[best + 1]
    shift = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) if (y0 - 2 * y1 + y2) != 0 else 0.0
    return best + float(np.clip(shift, -0.5, 0.5))


def beat_phase(envelope, period):
    """The phase in [0, period) whose comb of beats collects the most onset energy."""
    phases = np.arange(0, period, 0.25)
    positions = np.arange(len(envelope))
    best, best_score = 0.0, -1.0
    for phase in phases:
        distance = np.abs(((positions - phase + period / 2) % period) - period / 2)
        score = (envelope * np.exp(-0.5 * (distance / (period * 0.05)) ** 2)).sum()
        if score > best_score:
            best, best_score = float(phase), float(score)
    return best


def detect(samples):
    envelope = onset_envelope(samples)
    period = estimate_tempo(envelope)
    phase = beat_phase(envelope, period)
    onsets = pick_onsets(envelope)
    duration = len(envelope)
    beats = []
    k = 0
    while phase + k * period < duration:
        at = phase + k * period
        # A beat snaps to a detected onset within an eighth of a beat, so a live performance keeps its own timing.
        near = onsets[np.abs(onsets - at) <= period / 8] if len(onsets) else onsets
        beats.append(float(near[np.argmin(np.abs(near - at))]) if len(near) else at)
        k += 1
    # An envelope frame is timed at the centre of its analysis window.
    to_ms = lambda frames: [round((float(f) * HOP + WINDOW / 2) / SR * 1000, 1) for f in frames]
    return {'bpm': round(RATE * 60 / period, 2), 'offsetMs': to_ms([phase])[0], 'beats': to_ms(beats), 'onsets': to_ms(onsets)}


def click_track(bpm, offset_s, seconds, accent_every=4, seed=1):
    """A synthesised click track: a decaying 1 kHz click on each beat (brighter on the bar), over faint noise."""
    rng = np.random.default_rng(seed)
    out = rng.normal(0, 0.002, int(seconds * SR))
    t = np.arange(int(0.05 * SR)) / SR
    k = 0
    while offset_s + k * 60 / bpm < seconds - 0.06:
        start = int((offset_s + k * 60 / bpm) * SR)
        freq = 2000 if k % accent_every == 0 else 1000
        out[start:start + len(t)] += np.sin(2 * np.pi * freq * t) * np.exp(-t * 80) * 0.8
        k += 1
    return out


def self_check():
    for bpm, offset in ((120, 0.25), (93, 0.4), (150, 0.1)):
        result = detect(click_track(bpm, offset, 12))
        assert abs(result['bpm'] - bpm) <= 1, (bpm, result['bpm'])
        assert abs(result['offsetMs'] - offset * 1000) <= 25, (offset, result['offsetMs'])
        expected = [(offset + k * 60 / bpm) * 1000 for k in range(len(result['beats']))]
        assert all(abs(a - b) <= 30 for a, b in zip(result['beats'], expected)), result['beats'][:4]
        assert len(result['onsets']) >= len(result['beats']) * 0.9, (len(result['onsets']), len(result['beats']))
    print('beats self-check ok (120/93/150 bpm click tracks: bpm within 1, offset within 25 ms, beats within 30 ms)')


if __name__ == '__main__':  # self-check: python3 scripts/assets/beats.py --self-check
    args = sys.argv[1:]
    if args == ['--self-check']:
        self_check()
    elif args and not args[0].startswith('--'):
        result = detect(decode(args[0]))
        out = args[args.index('--out') + 1] if '--out' in args and args.index('--out') + 1 < len(args) else None
        text = json.dumps(result)
        if out:
            with open(out, 'w') as handle:
                handle.write(text + '\n')
            print(f'{out}: {result["bpm"]} bpm, first beat {result["offsetMs"]} ms, {len(result["beats"])} beats')
        else:
            print(text)
    else:
        print('usage: beats.py <audio file> [--out beats.json] | --self-check', file=sys.stderr)
        sys.exit(1)
