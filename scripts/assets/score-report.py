"""Measure a generated music.wav and print one JSON object. numpy + ffmpeg only.

Usage: python3 scripts/assets/score-report.py <music.wav> [--spec <audio.json>]
With --spec it adds per-section RMS and stereo correlation, whether section RMS ranks follow section energies, and per-hit
pre-gap, peak and tonal dip.
"""
import json, os, re, subprocess, sys, wave
import numpy as np

FFMPEG = os.environ.get('FFMPEG_PATH') or os.environ.get('FFMPEG', 'ffmpeg')
BANDS = ((0, 120, '<120'), (120, 2000, '120-2k'), (2000, 8000, '2k-8k'), (8000, None, '>8k'))


def db(x):
    return round(float(20 * np.log10(x + 1e-12)), 2)


def rms(x):
    return float(np.sqrt(np.mean(x ** 2)))


def corr(x):
    l, r = x - x.mean(axis=1, keepdims=True)
    den = np.sqrt(np.sum(l * l) * np.sum(r * r))
    return round(float(np.sum(l * r) / den), 3) if den > 0 else 1.0


def read(path):
    with wave.open(path, 'rb') as f:
        ch, sr = f.getnchannels(), f.getframerate()
        assert f.getsampwidth() == 2, 'expects 16-bit PCM'
        x = np.frombuffer(f.readframes(f.getnframes()), '<i2').reshape(-1, ch).T / 32768.0
    return (x if ch == 2 else np.vstack([x, x])), sr


def loudness(path):
    log = subprocess.run([FFMPEG, '-hide_banner', '-nostats', '-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
                         capture_output=True, text=True, check=True).stderr
    m = json.loads(re.findall(r'\{[^{}]*\}', log)[-1])
    return float(m['input_i']), float(m['input_lra']), float(m['input_tp'])


def balance(x, sr):
    p = np.abs(np.fft.rfft(x, axis=1)) ** 2
    p = p.sum(axis=0)
    f = np.fft.rfftfreq(x.shape[1], 1 / sr)
    total = p[1:].sum()
    return {name: round(float(p[(f >= lo) & (f < (hi or sr))][1 if lo == 0 else 0:].sum() / total), 3) for lo, hi, name in BANDS}


def continuity(x, sr, hits=(), beat=0.5, tail=2.0):
    """Level steps between neighbouring quarter-second windows, ignoring the beat after each declared hit and the end
    fade. A seamless piece has few steps over 5 dB; a collage has one at every section edge."""
    hop = sr // 4
    mono = x.mean(axis=0)
    levels = [db(rms(mono[i:i + hop])) for i in range(0, len(mono) - hop, hop)]
    steps = []
    for i in range(1, len(levels)):
        at = i * hop / sr
        if at > len(mono) / sr - tail or any(h - 0.05 <= at <= h + beat for h in hits):
            continue
        d = levels[i] - levels[i - 1]
        if abs(d) > 5:
            steps.append({'at': round(at, 2), 'db': round(d, 1)})
    return {'steps_over_5db': len(steps), 'steps': steps}


def arrangement(x, sr, beat=0.5, hits=(), tail=2.0):
    """Rhythmic activity per beat (summed positive spectral flux above 1 kHz, where drums and plucks live) and the
    beats where it changes by more than 2x against the previous beat. Layers that enter or leave on bar lines produce
    few such jumps; patterns swapped mid-bar and fills at every edge produce one per edge. Hit beats are skipped."""
    mono = x.mean(axis=0)
    win, hop = 1024, 256
    f = np.fft.rfftfreq(win, 1 / sr)
    hi = f >= 1000
    prev, flux = None, []
    for i in range(0, len(mono) - win, hop):
        spec = np.abs(np.fft.rfft(mono[i:i + win] * np.hanning(win)))[hi]
        flux.append(0.0 if prev is None else float(np.maximum(spec - prev, 0).sum()))
        prev = spec
    flux = np.array(flux)
    per_beat = max(1, int(round(beat * sr / hop)))
    activity = [float(flux[i:i + per_beat].sum()) for i in range(0, len(flux) - per_beat, per_beat)]
    floor = max(np.percentile(activity, 90) * 0.02, 1e-9)  # beats quieter than 2 % of a loud beat count as silence
    out = []
    for i in range(1, len(activity)):
        at = i * beat
        if at > len(mono) / sr - tail or any(h - beat <= at <= h + beat for h in hits):
            continue
        ratio = (activity[i] + floor) / (activity[i - 1] + floor)
        if ratio > 2 or ratio < 0.5:
            out.append({'at': round(at, 2), 'ratio': round(ratio, 2)})
    return {'jumps_over_2x': len(out), 'jumps': out}


def hit_numbers(x, sr, hits, beat):
    """Per declared hit, measured on the final file:
    pre_gap_ms: time from the last drum onset to the hit. An onset is a spectral-flux peak above 1 kHz that is 3x its
      recent median and 10 % of the piece's loud flux, so a quiet snare roll can go unseen and a riser does not count.
    peak_db: sample peak from 20 ms before the hit to 150 ms after. over_rest_db: that peak minus the peak elsewhere in
      the half second either side.
    dip_db: 120 Hz-2 kHz level over the beat before the hit minus the same beat one bar earlier (a rising or falling
      section in between moves it too)."""
    mono = x.mean(axis=0)
    win, hop = 1024, 256
    hi = np.fft.rfftfreq(win, 1 / sr) >= 1000
    spec = [np.abs(np.fft.rfft(mono[i:i + win] * np.hanning(win)))[hi] for i in range(0, len(mono) - win, hop)]
    flux = np.array([0.0] + [float(np.maximum(b - a, 0).sum()) for a, b in zip(spec, spec[1:])])
    loud = np.percentile(flux, 99)
    med = np.array([np.median(flux[max(0, i - 12):i]) if i else 0.0 for i in range(len(flux))])
    peaks = [i for i in np.flatnonzero((flux > 3 * med + 0.02 * loud) & (flux > 0.1 * loud)) if flux[i] >= flux[max(0, i - 3):i + 4].max()]
    onsets = np.array([(i * hop + win / 2) / sr for i in peaks])
    f = np.fft.rfftfreq(len(mono), 1 / sr)
    mid = np.fft.irfft(np.fft.rfft(mono) * ((f >= 120) & (f < 2000)), len(mono))
    seg = lambda sig, a, b: sig[..., max(0, int(a * sr)):max(1, int(b * sr))]
    peak = lambda a, b: np.abs(seg(x, a, b)).max(initial=0)
    out = []
    for h in hits:
        before = onsets[onsets < h - 0.02]
        rest = max(peak(h - 0.5, h - 0.02), peak(h + 0.15, h + 0.5))
        out.append({'at': h, 'pre_gap_ms': round(1000 * (h - before[-1])) if len(before) else None,
                    'peak_db': db(peak(h - 0.02, h + 0.15)), 'over_rest_db': round(db(peak(h - 0.02, h + 0.15)) - db(rest), 2),
                    'dip_db': round(db(rms(seg(mid, h - beat, h - 0.05))) - db(rms(seg(mid, h - 5 * beat, h - 4 * beat))), 2)})
    return out


def report(path, spec_path=None):
    x, sr = read(path)
    I, lra, tp = loudness(path)
    per_sec = [db(rms(x[:, i:i + sr])) for i in range(0, x.shape[1] - sr // 2, sr)]
    loudest = int(np.argmax(per_sec))
    out = {'file': path, 'seconds': round(x.shape[1] / sr, 3), 'I': I, 'LRA': lra, 'TP': tp,
           'peak_dbfs': db(np.abs(x).max()), 'crest_db': round(db(np.abs(x).max()) - db(rms(x)), 2),
           'balance': balance(x, sr), 'correlation': corr(x), 'loudest_second': {'at': loudest, 'rms_db': per_sec[loudest]},
           'rms_per_second': per_sec, 'continuity': continuity(x, sr)}
    if spec_path:
        with open(spec_path) as f:
            spec = json.load(f)
        secs = spec['sections']
        rows = []
        for s in secs:
            seg = x[:, int(s['from'] * sr):int(s['to'] * sr)]
            rows.append({'label': s.get('label', ''), 'from': s['from'], 'to': s['to'], 'energy': s['energy'],
                         'rms_db': db(rms(seg)), 'correlation': corr(seg)})
        out['sections'] = rows
        hits = [h['at'] if isinstance(h, dict) else h for h in spec['hits']]
        out['continuity'] = continuity(x, sr, hits, 60 / spec['bpm'])
        out['arrangement'] = arrangement(x, sr, 60 / spec['bpm'], hits)
        out['hits'] = hit_numbers(x, sr, hits, 60 / spec['bpm'])
        out['rms_follows_energy'] = all(a['rms_db'] < b['rms_db'] for a in rows for b in rows if a['energy'] < b['energy'])
    return out


if __name__ == '__main__':
    args = sys.argv[1:]
    spec = args[args.index('--spec') + 1] if '--spec' in args else None
    files = [a for i, a in enumerate(args) if a != '--spec' and (i == 0 or args[i - 1] != '--spec')]
    if len(files) != 1:
        raise SystemExit(__doc__)
    print(json.dumps(report(files[0], spec)))
