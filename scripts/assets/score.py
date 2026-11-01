"""Generate one composition's music and SFX from its audio spec. numpy + ffmpeg only, deterministic.

Usage: python3 scripts/assets/score.py [--force] [spec.json ...] | --self-check
Without spec paths it reads every examples/**/audio.json.
Writes public/audio/generated/<slug>/music.wav and <sfx name>.wav. Format and policy: docs/audio-score.md.
"""
import glob, hashlib, json, os, re, subprocess, sys, tempfile, time, wave, zlib
import numpy as np
from audio_guard import require_local_output
import sfx as sfx_sources

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'audio', 'generated')
FFMPEG = os.environ.get('FFMPEG_PATH') or os.environ.get('FFMPEG', 'ffmpeg')
NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
rng = np.random.default_rng(0)  # reseeded per file so no output depends on generation order
GENERATION = 'v5'  # part of the output digest; raising it regenerates every composition.


def ts(dur):
    return np.arange(int(round(dur * SR))) / SR


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# ---------------------------------------------------------------- filters and effects

def lp(x, fc):
    # One-pole low-pass applied in the frequency domain; padding keeps the decay tail from wrapping.
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    n = x.shape[-1] + SR
    w = 2 * np.pi * np.fft.rfftfreq(n)
    return np.fft.irfft(np.fft.rfft(x, n) * a / (1 - (1 - a) * np.exp(-1j * w)), n)[..., :x.shape[-1]]


def hp(x, fc):
    return x - lp(x, fc)


def svf(x, fc, q=0.707, mode='lp'):
    """Topology-preserving state-variable filter (two-pole, resonant); fc may change per sample."""
    fc = np.clip(np.broadcast_to(fc, x.shape), 20, 0.45 * SR)
    g = np.tan(np.pi * fc / SR)
    k = 1 / q
    a1 = 1 / (1 + g * (g + k))
    a2, a3 = g * a1, g * g * a1
    low, band = [0.0] * len(x), [0.0] * len(x)
    s1 = s2 = 0.0
    for i, (v0, b1, b2, b3) in enumerate(zip(x.tolist(), a1.tolist(), a2.tolist(), a3.tolist())):
        v3 = v0 - s2
        v1 = b1 * s1 + b2 * v3
        v2 = s2 + b2 * s1 + b3 * v3
        s1, s2 = 2 * v1 - s1, 2 * v2 - s2
        band[i], low[i] = v1, v2
    if mode == 'lp':
        return np.array(low)
    if mode == 'bp':
        return np.array(band)
    return x - k * np.array(band) - np.array(low)


def comb(x, d, g):
    # y[n] = x[n] + g y[n-d], one block of d samples at a time (every source block is already final).
    y = x.copy()
    for s in range(d, len(y), d):
        e = min(s + d, len(y))
        y[s:e] += g * y[s - d:e - d]
    return y


def allpass(x, d, g):
    v = -g * x
    v[d:] += x[:-d]
    return comb(v, d, g)


def reverb(x, rt60, predelay):
    """Schroeder: four parallel combs into two series allpasses; the right channel uses slightly longer delays."""
    x = np.concatenate([np.zeros(int(predelay * SR)), hp(lp(x, 6500), 250)])[:len(x)]
    out = []
    for spread in (0, 23):
        y = sum(comb(x, d, 10 ** (-3 * d / (rt60 * SR))) for d in (1687 + spread, 1601 + spread, 1867 + spread, 1951 + spread)) / 4
        for d in (241 + spread, 601 + spread):
            y = allpass(y, d, 0.5)
        out.append(y)
    return np.stack(out)


def ping_pong(x, delay, fb=0.45, taps=6):
    d = int(round(delay * SR))
    out = np.zeros((2, len(x)))
    x = hp(lp(x, 4500), 300)
    for k in range(1, taps + 1):
        if k * d < len(x):
            out[(k + 1) % 2, k * d:] += fb ** (k - 1) * x[:-k * d]
    return out


def chorus(x, rate=0.3, depth=0.0025, base=0.011):
    n = np.arange(len(x))
    return np.stack([0.55 * x + 0.75 * np.interp(n - (base + depth * np.sin(2 * np.pi * r * n / SR + ph)) * SR, n, x, left=0)
                     for r, ph in ((rate, 0), (rate * 1.31, np.pi / 2))])


def follower(x, attack, release, blk=48):
    """Peak envelope at block rate (1 ms), attack/release smoothed; returns one value per block."""
    pk = np.abs(x[:len(x) // blk * blk]).reshape(-1, blk).max(axis=1)
    ca, cr = np.exp(-blk / (attack * SR)), np.exp(-blk / (release * SR))
    env, e = [0.0] * len(pk), 0.0
    for i, p in enumerate(pk.tolist()):
        e = p + (e - p) * (ca if p > e else cr)
        env[i] = e
    return np.array(env)


def per_sample(blocks, n, blk=48):
    return np.interp(np.arange(n), np.arange(len(blocks)) * blk + blk / 2, blocks)


def compress(x, thr_rel=-5.0, ratio=2.2, knee=6.0, attack=0.015, release=0.16, blk=48):
    """Bus compressor: RMS detector per 1 ms block, soft knee, attack/release on the gain."""
    nb = x.shape[1] // blk
    lvl = 10 * np.log10(np.mean(x[:, :nb * blk].reshape(2, nb, blk) ** 2, axis=(0, 2)) + 1e-12)
    thr = np.percentile(lvl[lvl > lvl.max() - 40], 90) + thr_rel
    over = lvl - thr
    gr = np.where(over < -knee / 2, 0, np.where(over > knee / 2, (1 / ratio - 1) * over, (1 / ratio - 1) * (over + knee / 2) ** 2 / (2 * knee)))
    ca, cr = np.exp(-blk / (attack * SR)), np.exp(-blk / (release * SR))
    out, g = [0.0] * nb, 0.0
    for i, target in enumerate(gr.tolist()):
        g = target + (g - target) * (ca if target < g else cr)
        out[i] = g
    return x * 10 ** (per_sample(np.array(out), x.shape[1], blk) / 20)


def limit(x, ceiling, release=0.06, blk=32):
    """Lookahead-free peak limiter. Gain is held flat per block and never above the block's required gain."""
    nb = -(-x.shape[1] // blk)
    pk = np.abs(np.pad(x, ((0, 0), (0, nb * blk - x.shape[1])))).reshape(2, nb, blk).max(axis=(0, 2))
    req = np.minimum(1, ceiling / np.maximum(pk, 1e-12))
    r = np.exp(-blk / (release * SR))
    gain, g = [0.0] * nb, 1.0
    for i, q in enumerate(req.tolist()):
        g = min(q, 1 - (1 - g) * r)
        gain[i] = g
    return x * np.repeat(gain, blk)[:x.shape[1]]


def tilt(x, low_db, high_db):
    # Gentle shelves from one-pole splits: below ~200 Hz and above ~4 kHz.
    return x + (10 ** (low_db / 20) - 1) * lp(x, 200) + (10 ** (high_db / 20) - 1) * hp(x, 4000)


def widen(x, width):
    mid, side = (x[0] + x[1]) / 2, (x[0] - x[1]) / 2
    side = hp(side, 180) * width  # the low end stays mono
    return np.stack([mid + side, mid - side])


# ---------------------------------------------------------------- oscillators and envelopes

def phase(f, n, p0=0.0):
    return (p0 + np.cumsum(np.broadcast_to(f, (n,)) / SR)) % 1.0


def blep(p, dt):
    y = np.zeros_like(p)
    a, b = p < dt, p > 1 - dt
    t = p[a] / dt[a]
    y[a] = 2 * t - t * t - 1
    t = (p[b] - 1) / dt[b]
    y[b] = t * t + 2 * t + 1
    return y


def saw(f, n, p0=0.0):
    p, dt = phase(f, n, p0), np.broadcast_to(np.asarray(f, float) / SR, (n,))
    return 2 * p - 1 - blep(p, dt)


def pulse(f, n, pw=0.5, p0=0.0):
    p, dt = phase(f, n, p0), np.broadcast_to(np.asarray(f, float) / SR, (n,))
    q = (p + pw) % 1.0
    return 0.5 * ((2 * p - 1 - blep(p, dt)) - (2 * q - 1 - blep(q, dt)))


def osc(kind, f, n, p0=0.0):
    t = np.arange(n) / SR
    if kind == 'saw':
        return saw(f, n, p0)
    if kind == 'square':
        return pulse(f, n, 0.5, p0)
    if kind == 'pwm':
        return pulse(f, n, 0.5 + 0.38 * np.sin(2 * np.pi * 0.7 * t + 2 * np.pi * p0), p0)
    if kind == 'pulse':
        return pulse(f, n, 0.25, p0)
    p = phase(f, n, p0)
    return 1 - 4 * np.abs(p - 0.5) if kind == 'tri' else np.sin(2 * np.pi * p)


def adsr(n, a, d, s, r):
    hold = n / SR
    return np.interp(np.arange(n + int(r * SR)) / SR, [0, a, a + d, max(hold, a + d), hold + r], [0, 1, s, s, 0])


# ---------------------------------------------------------------- instruments (vel 0..1 scales amplitude)

def subtractive(kind, midis, dur, vel, env, cut, q=0.8, fenv=0.0, fdecay=0.12, detune=0.0):
    """Oscillators (two detuned per note when detune > 0) through an ADSR and one resonant SVF."""
    e = adsr(int(dur * SR), *env)
    n = len(e)
    x = sum(osc(kind, hz(m) * (1 + d), n, rng.random()) for m in midis for d in ((-detune, detune) if detune else (0,)))
    x = x / (len(midis) * (2 if detune else 1))
    if cut is not None:
        t = np.arange(n) / SR
        # A note that starts near the end rings past the automation curve; it holds the curve's last value.
        cut = np.pad(cut[:n], (0, max(0, n - len(cut))), mode='edge') if np.ndim(cut) else cut
        x = svf(x, cut * 2 ** (fenv * np.exp(-t / fdecay)), q)
    return x * e * vel


DETUNE = np.array([-1, -0.62, -0.3, 0, 0.3, 0.62, 1])


def supersaw(midis, dur, vel, cut, cents=22, env=(0.005, 0.15, 0.6, 0.18)):
    """Seven detuned saws per note (JP-8000-style uneven spread), the unison voices panned across the stereo field."""
    e = adsr(int(dur * SR), *env)
    n, out = len(e), np.zeros((2, len(e)))
    for off in DETUNE:
        pan, amp = off * 0.8, 1.0 if off == 0 else 0.7
        x = sum(saw(hz(m) * 2 ** (off * cents / 1200), n, rng.random()) for m in midis) * amp
        out += np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)])
    return hp(lp(out, cut), 160) * e * vel / (len(midis) * len(DETUNE) ** 0.5)


def fm(midi, dur, vel, ratio=1.0, index=2.0, idecay=0.3, decay=0.8, release=0.08):
    """Two-operator FM: one sine modulator with a decaying index into a sine carrier."""
    t = ts(dur + release)
    f = hz(midi)
    x = np.sin(2 * np.pi * f * t + index * np.exp(-t / idecay) * np.sin(2 * np.pi * f * ratio * t))
    env = np.minimum(1, t / 0.003) * np.exp(-t / decay) * np.clip((dur + release - t) / release, 0, 1)
    return x * env * vel


def ks(midi, dur, vel, bright=3500, decay=0.996):
    """Karplus-Strong string: a filtered noise burst recirculating through a fractional delay of one period."""
    # shortcut: the two-tap average adds half a sample, so the period rounds to it (<= 5 cents off above C4); add a
    # fractional allpass if arps move above C6.
    d = max(2, int(round(SR / hz(midi) - 0.5)))
    n = int((dur + 0.05) * SR)
    y = np.zeros(n + d + 1)
    y[d + 1:d + 1 + d] = lp(rng.uniform(-1, 1, d), bright)
    for s in range(d + 1, len(y), d):
        e = min(s + d, len(y))
        y[s:e] += decay * 0.5 * (y[s - d:e - d] + y[s - d - 1:e - d - 1])
    y = y[d + 1:]
    return y * np.clip((dur + 0.05 - np.arange(n) / SR) / 0.05, 0, 1) * vel / (np.abs(y).max() + 1e-9)


def kick(kit):
    long = kit == 'cinematic'
    t = ts(1.0 if long else 0.5)
    if kit == 'chip':
        f = 55 + 160 * np.exp(-t / 0.02)
        return np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.6 * np.exp(-t / 0.08)
    click = hp(rng.uniform(-1, 1, len(t)), 2500) * np.exp(-t / 0.0012) * 0.5
    body = np.sin(2 * np.pi * np.cumsum(48 + 120 * np.exp(-t / (0.045 if long else 0.03))) / SR) * np.exp(-t / (0.4 if long else 0.2))
    sub = np.sin(2 * np.pi * 47 * t) * np.minimum(1, t / 0.008) * np.exp(-t / (0.5 if long else 0.18)) * 0.35
    return click + body + sub


def snare(kit):
    t = ts(0.4)
    if kit == 'chip':
        return np.repeat(rng.uniform(-1, 1, len(t) // 6 + 1), 6)[:len(t)] * np.exp(-t / 0.06) * 0.8
    decay = 0.2 if kit == 'cinematic' else 0.11
    body = svf(rng.uniform(-1, 1, len(t)), 3200, 0.6, 'bp') * 1.6 * np.exp(-t / decay)
    tone = (np.sin(2 * np.pi * 180 * t) + 0.4 * np.sin(2 * np.pi * 330 * t)) * np.exp(-t / 0.05)
    return body + 0.7 * tone


def hat(kit, open_):
    t = ts(0.6 if open_ else 0.12)
    if kit == 'chip':
        return hp(np.repeat(rng.uniform(-1, 1, len(t) // 2 + 1), 2)[:len(t)], 6000) * np.exp(-t / (0.12 if open_ else 0.02))
    x = svf(rng.uniform(-1, 1, len(t)), 9000 if kit != 'lofi' else 6500, 1.1, 'bp') + 0.4 * hp(rng.uniform(-1, 1, len(t)), 11000)
    return x * np.exp(-t / (0.22 if open_ else 0.03))


def tom(f):
    t = ts(0.45)
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t / 0.03))) / SR) * np.exp(-t / 0.18) + 0.15 * lp(rng.uniform(-1, 1, len(t)), 3000) * np.exp(-t / 0.02)


def crash():
    t = ts(1.6)
    x = np.stack([hp(rng.uniform(-1, 1, len(t)), 5000), hp(rng.uniform(-1, 1, len(t)), 5000)])
    return x * np.exp(-t / 0.45) * np.minimum(1, t / 0.002)


def sub_drop():
    t = ts(0.9)
    return np.sin(2 * np.pi * np.cumsum(32 + 55 * np.exp(-t / 0.18)) / SR) * np.exp(-t / 0.35) * np.minimum(1, t / 0.004)


def transient():
    """The attack every hit carries on top of its kick: a 3 ms broadband crack and a 40 ms low thump, so the cut reads as a hit."""
    t = ts(0.12)
    crack = hp(rng.uniform(-1, 1, len(t)), 1800) * np.exp(-t / 0.003)
    thump = np.sin(2 * np.pi * np.cumsum(70 + 180 * np.exp(-t / 0.01)) / SR) * np.exp(-t / 0.04)
    return 0.9 * crack + thump


def riser(dur, tone=0.4, lo=400, hi=9000):
    t = ts(dur)
    u = t / dur
    sweep = svf(rng.uniform(-1, 1, len(t)), lo * (hi / lo) ** u, 2.0, 'bp')
    pitch = lp(saw(180 * 8 ** u, len(t)), 3000)
    x = ((1 - tone) * sweep / (np.abs(sweep).max() + 1e-9) + tone * pitch) * u ** 2
    return x * np.clip((dur - t) / 0.02, 0, 1)


def tail(x, ms=10):
    k = int(ms * SR / 1000)
    x[..., -k:] *= np.linspace(1, 0, k)
    return x


# ---------------------------------------------------------------- SFX presets: f(variant 1..3, length seconds)

def sfx_whoosh(v, length):
    lo, hi = ((150, 2500), (300, 6000), (800, 12000))[v - 1]
    t = ts(length)
    u = t / length
    x = svf(rng.uniform(-1, 1, len(t)), lo * (hi / lo) ** np.sin(np.pi * np.minimum(1, u * 1.15) / 2) ** 2, 1.4, 'bp')
    x = (lp(x, 3000) if v == 1 else hp(x, 1500) if v == 3 else x) * np.sin(np.pi * u) ** 2 * (0.6 + 0.4 * u)
    pan = -0.7 + 1.4 * u
    return tail(np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)]))


def sfx_impact(v, length):
    t = ts(length)
    hit = np.minimum(1, t / 0.001)
    if v == 1:  # sub: deep sweep and a soft low thump
        x = np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-t / 0.12)) / SR) * np.exp(-t / (length / 3))
        x += 0.5 * lp(rng.uniform(-1, 1, len(t)), 180) * np.exp(-t / 0.06)
    elif v == 2:  # metallic: inharmonic partials over a short thump
        f = rng.uniform(380, 520)
        x = sum(a * np.sin(2 * np.pi * f * r * t + rng.random() * 6.28) * np.exp(-t / d) for r, a, d in ((1, 1, 0.5), (2.76, 0.6, 0.3), (5.4, 0.4, 0.15), (8.93, 0.25, 0.08)))
        x = 0.5 * x + np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.12) + 0.4 * hp(rng.uniform(-1, 1, len(t)), 3000) * np.exp(-t / 0.03)
    else:  # paper: crackly band-limited noise slap
        grains = (rng.random(len(t)) < 0.02) * rng.uniform(-1, 1, len(t))
        x = svf(grains + 0.3 * rng.uniform(-1, 1, len(t)), 2500, 0.9, 'bp') * np.exp(-t / 0.07) + 0.3 * np.sin(2 * np.pi * 140 * t) * np.exp(-t / 0.03)
    return tail(x * hit, 20)


def sfx_riser(v, length):
    return tail(riser(length, (0.4, 0.0, 0.7)[v - 1], (400, 250, 600)[v - 1], (9000, 7000, 12000)[v - 1]))


def sfx_click(v, length):
    t = ts(length)
    return np.sin(2 * np.pi * (2200, 3000, 1600)[v - 1] * t) * np.exp(-t / 0.004) + 0.3 * hp(rng.uniform(-1, 1, len(t)), 4000) * np.exp(-t / 0.002)


def sfx_pop(v, length):
    t = ts(length)
    lo = (300, 450, 220)[v - 1] * rng.uniform(0.95, 1.05)
    return np.sin(2 * np.pi * np.cumsum(lo + 2.3 * lo * (1 - np.exp(-t / 0.02))) / SR) * np.exp(-t / 0.04) * np.minimum(1, t / 0.0015)


def sfx_ding(v, length):
    f, ratio = ((1320, 3.5), (1760, 2.0), (1047, 1.41))[v - 1]
    x = fm(69 + 12 * np.log2(f / 440), length - 0.05, 1.0, ratio, 3.0, 0.15, length / 3, 0.05)
    return x + 0.3 * fm(69 + 12 * np.log2(2 * f / 440), length - 0.05, 1.0, ratio, 1.0, 0.1, length / 6, 0.05)


def sfx_tick(v, length):
    t = ts(length)
    return hp(rng.uniform(-1, 1, len(t)), (3000, 5000, 8000)[v - 1]) * np.exp(-t / 0.006)


CHORDS = ([0, 4, 7, 12], [0, 5, 7, 12], [0, 3, 7, 10])


def sfx_swell(v, length):
    t = ts(length)
    chord = [57 + n for n in CHORDS[v - 1]]
    pad = subtractive('saw', chord, length, 1.0, (0.01, 0.1, 1.0, 0.0), 300 * 20 ** (t / length), 1.2, detune=0.006)[:len(t)]
    air = svf(rng.uniform(-1, 1, len(t)), 500 * 16 ** (t / length), 0.8)
    return tail((pad + 0.4 * air) * (t / length) ** 2)


def sfx_stinger(v, length):
    chord = [55 + n for n in CHORDS[v - 1]]
    stab = supersaw(chord + [chord[0] - 12], min(0.35, length / 3), 1.0, 5000, env=(0.003, 0.25, 0.4, length / 2))
    out = np.zeros((2, int(length * SR)))
    for sig, gain in ((stab, 1.2), (kick('synth'), 0.6), (crash() * 0.25, 1.0)):
        sig = sig if sig.ndim == 2 else np.stack([sig, sig])
        m = min(out.shape[1], sig.shape[1])
        out[:, :m] += sig[:, :m] * gain
    return tail(out, 30)


def sfx_shimmer(v, length):
    t = ts(length)
    u = t / length
    path = (u, 1 - u, np.sin(np.pi * u))[v - 1]
    shared = rng.uniform(-1, 1, len(t))
    x = np.stack([svf(0.75 * shared + 0.45 * rng.uniform(-1, 1, len(t)), 4000 * 3.5 ** path, 5.0, 'bp') for _ in (0, 1)])
    return tail(x * np.sin(np.pi * u) ** 1.5)


# name: (function, default length in seconds)
SFX = {'click': (sfx_click, 0.2), 'pop': (sfx_pop, 0.25), 'whoosh': (sfx_whoosh, 0.6), 'impact': (sfx_impact, 0.9),
       'riser': (sfx_riser, 2.0), 'ding': (sfx_ding, 0.8), 'tick': (sfx_tick, 0.05), 'swell': (sfx_swell, 1.0),
       'stinger': (sfx_stinger, 1.2), 'shimmer': (sfx_shimmer, 1.5)}


# ---------------------------------------------------------------- harmony, moods, section roles

# Chords as semitones above the tonic, one per bar. The last entry of each mode list group borrows from a parallel mode.
PROGRESSIONS = {
    'major': [[[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]],          # 0 I V vi IV
              [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]],          # 1 I IV vi V
              [[9, 12, 16], [5, 9, 12], [0, 4, 7], [7, 11, 14]],          # 2 vi IV I V
              [[0, 4, 7], [10, 14, 17], [5, 9, 12], [0, 4, 7]],           # 3 I bVII IV I (mixolydian borrow)
              [[0, 4, 7], [9, 12, 16], [5, 9, 12], [5, 8, 12]],           # 4 I vi IV iv (minor borrow)
              [[0, 4, 7, 11], [9, 12, 16, 19], [2, 5, 9, 12], [7, 11, 14, 17]],  # 5 Imaj7 vi7 ii7 V7
              [[0, 4, 7], [8, 12, 15], [10, 14, 17], [0, 4, 7]]],         # 6 I bVI bVII I (aeolian borrow)
    'minor': [[[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],           # 0 i VI III VII
              [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-2, 2, 5]],           # 1 i VII VI VII
              [[0, 3, 7], [5, 8, 12], [-4, 0, 3], [-5, -1, 2]],          # 2 i iv VI V (harmonic V borrow)
              [[0, 3, 7], [5, 9, 12], [0, 3, 7], [-2, 2, 5]],            # 3 i IV i VII (dorian IV borrow)
              [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 8], [3, 7, 10, 14]],  # 4 i7 iv7 VII7 IIImaj7
              [[0, 3, 7], [-4, 0, 3], [1, 5, 8], [-5, -1, 2]]],          # 5 i VI bII V (neapolitan borrow)
}

# Drum, bass and stab rows are one bar of 16ths. Drums: X accent, x normal, g ghost, o open hat (closed outside drops).
# Bass: x root, o octave, 5 fifth. Arp rate is in 16ths. swing is MPC-style percent (50 straight, 66 triplet).
# cut/q: subtractive filter base and resonance; lfo: (period in bars, depth in octaves).
# rev/dly: send scale; size: reverb RT60; dly_beats: ping-pong time; sc: sidechain depth; tilt: (low dB, high dB).
MOODS = {
    'upbeat':    dict(bpm=(100, 140), progs={'major': (0, 1, 4), 'minor': (0, 1, 2)}, pad='saw', bass='saw', bass_pat='x.o.x.o.x.o.x.ox',
                      arp='pluck', arp_rate=2, arp_order='updown', lead='supersaw', lead_pat='x..x..x...x..x..', lead_len=2, kit='synth',
                      kick='X...x...X...x...', snare='....X..g....X.g.', hat='x.x.x.x.x.x.x.xo', swing=52, cut=2600, q=1.2, lfo=(4, 0.5),
                      rev=0.6, size=1.3, pre=0.02, dly=0.5, dly_beats=0.75, width=1.3, tilt=(-1.0, 1.5), sc=0.5),
    'calm':      dict(bpm=(60, 100), progs={'major': (1, 2, 6), 'minor': (0, 3)}, pad='saw', bass='sine', bass_pat='x.......x.......',
                      arp='pluck', arp_rate=4, arp_order='up', lead='fm', lead_pat='x.......x.....x.', lead_len=6, lead_e=0.6, kit='synth',
                      kick='x.......x.......', snare='........x......g', hat='x.g.x.g.x.g.x.g.', swing=54, cut=1500, q=0.9, lfo=(8, 0.3), gains={'bass': 0.6},
                      rev=1.0, size=2.2, pre=0.03, dly=0.6, dly_beats=0.75, width=1.35, tilt=(0.0, -1.0), sc=0.15),
    'dramatic':  dict(bpm=(70, 130), progs={'major': (0, 4, 6), 'minor': (0, 2, 5)}, pad='saw', bass='saw', bass_pat='x.......x.....x.',
                      arp='pulse', arp_rate=2, arp_order='up', lead='supersaw', lead_pat='x.......x.......', lead_len=8, kit='cinematic',
                      kick='X.........x.....', snare='........X.......', hat='x...x...x...x..g', swing=50, cut=1800, q=1.5, lfo=(8, 0.6),
                      rev=1.2, size=2.8, pre=0.03, dly=0.3, dly_beats=0.75, width=1.3, tilt=(1.0, 0.0), sc=0.2),
    'minimal':   dict(bpm=(90, 130), progs={'major': (0, 1, 3), 'minor': (0, 1, 3)}, pad=None, bass='sine', bass_pat='x.....x.....x...',
                      arp='pluck', arp_rate=2, arp_order='random', lead=None, kit='synth',
                      kick='x.......x.......', snare='....g.......x...', hat='..x...x...x...x.', swing=50, cut=2000, q=0.8, lfo=(4, 0.3), gains={'bass': 0.5, 'arp': 1.5},
                      rev=0.8, size=1.6, pre=0.02, dly=1.0, dly_beats=0.75, width=1.2, tilt=(0.0, 0.5), sc=0.0),
    'tech':      dict(bpm=(110, 140), progs={'major': (0, 2, 3), 'minor': (0, 2, 3)}, pad='pwm', bass='square', bass_pat='x.xox.xox.xox.xo',
                      arp='pulse', arp_rate=1, arp_order='up', lead='supersaw', lead_pat='x.....x.....x...', lead_len=2, kit='synth',
                      kick='X...x...X...x...', snare='....X.......X..g', hat='xxgxxxgxxxgxxxgo', swing=50, cut=2000, q=2.5, lfo=(2, 1.0),
                      rev=0.45, size=1.2, pre=0.01, dly=0.8, dly_beats=0.75, width=1.25, tilt=(-1.0, 1.0), sc=0.45),
    'warm':      dict(bpm=(70, 110), progs={'major': (1, 5, 4), 'minor': (0, 4, 3)}, pad='tri', bass='tri', bass_pat='x.......x...5...',
                      arp='pluck', arp_rate=2, arp_order='updown', lead='fm', lead_pat='..x...x...x...x.', lead_len=3, lead_e=0.5, kit='lofi',
                      kick='x.......x.x.....', snare='........X......g', hat='x.x.x.x.x.x.x.x.', swing=56, cut=1200, q=0.8, lfo=(8, 0.3),
                      rev=0.8, size=1.8, pre=0.02, dly=0.4, dly_beats=0.75, width=1.15, tilt=(1.0, -2.0), sc=0.15),
    'corporate': dict(bpm=(95, 125), progs={'major': (0, 1, 4), 'minor': (0, 1, 3)}, pad='saw', bass='saw', bass_pat='x.x.x.x.x.x.x.x.',
                      arp='pluck', arp_rate=2, arp_order='updown', lead='fm', lead_pat='x..x..x.x..x..x.', lead_len=2, lead_e=0.55, kit='synth',
                      kick='X...x...X...x...', snare='....X.......X..g', hat='x.x.x.x.x.x.x.xo', swing=50, cut=3000, q=0.9, lfo=(4, 0.3),
                      rev=0.7, size=1.5, pre=0.02, dly=0.4, dly_beats=0.75, width=1.2, tilt=(0.0, 2.0), sc=0.3),
    'lofi':      dict(bpm=(70, 95), progs={'major': (5, 4), 'minor': (4, 3)}, pad='saw', bass='sine', bass_pat='x......x..x.....',
                      arp=None, lead='fm', lead_pat='x.....x...x.....', lead_len=5, lead_e=0.25, kit='lofi', drum_lp=4500,
                      kick='x.......x.x.....', snare='....X..g....X..g', hat='x.x.x.x.x.x.x.x.', swing=60, cut=900, q=0.9, lfo=(8, 0.4), gains={'bass': 0.55, 'lead': 1.4},
                      rev=0.7, size=1.4, pre=0.02, dly=0.4, dly_beats=0.75, width=1.1, tilt=(0.5, -2.5), sc=0.2),
    'house':     dict(bpm=(118, 128), progs={'major': (5, 0, 6), 'minor': (4, 0, 3)}, pad='saw', bass='saw', bass_pat='..x...x...x...xo',
                      arp='pluck', arp_rate=2, arp_order='random', lead='supersaw', lead_pat='..x...x...x...x.', lead_len=2, kit='synth',
                      kick='X...X...X...X...', snare='....X.......X...', hat='g.o.g.o.g.o.g.og', swing=52, cut=1800, q=1.8, lfo=(4, 1.0),
                      rev=0.6, size=1.4, pre=0.02, dly=0.5, dly_beats=0.75, width=1.3, tilt=(0.0, 1.0), sc=0.7),
    'hiphop':    dict(bpm=(80, 100), progs={'major': (5, 1, 4), 'minor': (4, 0, 5)}, pad='saw', bass='808', bass_pat='x......x..x.....',
                      arp='fm', arp_rate=4, arp_order='random', lead=None, kit='synth',
                      kick='X.....x...x.....', snare='....X..g.g..X...', hat='xgxgxgxgxgxgxgxg', swing=58, cut=1200, q=0.9, lfo=(8, 0.3), gains={'bass': 0.6},
                      rev=0.4, size=1.2, pre=0.02, dly=0.5, dly_beats=0.75, width=1.2, tilt=(1.0, 0.0), sc=0.25),
    'cinematic': dict(bpm=(60, 110), progs={'major': (6, 4, 0), 'minor': (5, 2, 0)}, pad='saw', bass='saw', bass_pat='x...............',
                      arp='pulse', arp_rate=2, arp_order='up', lead='supersaw', lead_pat='x.......x.......', lead_len=8, kit='cinematic',
                      kick='X.......x.x.....', snare='........X.......', hat='........g.......', swing=50, cut=1600, q=1.3, lfo=(8, 0.6),
                      rev=1.4, size=3.5, pre=0.04, dly=0.2, dly_beats=0.75, width=1.35, tilt=(2.0, 0.0), sc=0.1),
    'ambient':   dict(bpm=(60, 90), progs={'major': (1, 6), 'minor': (0, 3)}, pad='saw', pad_env=(1.2, 0.5, 0.9, 1.5), bass='sine', bass_pat='x...............',
                      arp='fm', arp_rate=4, arp_order='random', lead=None, kit='synth',
                      kick='x...............', snare='................', hat='....g.......g...', swing=50, cut=1300, q=1.0, lfo=(8, 0.8),
                      rev=1.0, size=4.5, pre=0.05, dly=0.6, dly_beats=1.5, width=1.2, tilt=(0.0, 1.0), sc=0.0),
    'chiptune':  dict(bpm=(120, 170), progs={'major': (0, 6, 3), 'minor': (0, 2, 5)}, pad=None, bass='pulse', bass_pat='xoxoxoxoxoxoxoxo',
                      arp='pulse', arp_rate=1, arp_order='up', lead='pulse', lead_pat='x.x...x.x...x...', lead_len=2, kit='chip',
                      kick='X...x...X...x...', snare='....X.......X...', hat='x.x.x.x.x.x.x.x.', swing=50, cut=None, q=0.7, lfo=(4, 0.0),
                      rev=0.25, size=0.8, pre=0.0, dly=0.6, dly_beats=0.5, width=1.15, tilt=(0.0, 0.0), sc=0.2),
}

# What each section role plays. kick/snare/hats/ghost: minimum energy (None = out). arp_full: energy where the arp runs at the
# mood rate (None = half rate). pad: pad gain. sc: share of the mood's sidechain depth.
ROLES = {
    'intro': dict(kick=0.45, snare=None, hats=0.2, ghost=None, bass='hold', arp_full=None, pad=1.5, sc=0.4, open=False),
    'verse': dict(kick=0.3, snare=0.4, hats=0.0, ghost=0.55, bass='pattern', arp_full=0.6, pad=1.0, sc=0.5, open=False),
    'build': dict(kick=0.3, snare=0.4, hats=0.0, ghost=0.5, bass='pattern', arp_full=0.0, pad=1.0, sc=0.6, open=False),
    'drop':  dict(kick=0.0, snare=0.0, hats=0.0, ghost=0.0, bass='pattern', arp_full=0.0, pad=0.9, sc=1.0, open=True),
    'break': dict(kick=None, snare=None, hats=None, ghost=None, bass='hold', arp_full=None, pad=1.5, sc=0.0, open=False),
    'outro': dict(kick=0.35, snare=0.5, hats=0.15, ghost=None, bass='hold', arp_full=None, pad=1.5, sc=0.3, open=False),
}
VEL = {'X': 1.0, 'x': 0.8, 'o': 0.8, 'g': 0.32, '5': 0.8}


def section_roles(secs):
    out = []
    for i, s in enumerate(secs):
        e, prev, nxt = s['energy'], secs[i - 1]['energy'] if i else None, secs[i + 1]['energy'] if i + 1 < len(secs) else None
        out.append(s.get('role') or ('outro' if nxt is None and i else 'intro' if i == 0 and e < 0.4 else 'drop' if e >= 0.75
                                     else 'break' if prev is not None and prev >= 0.75 and e <= prev - 0.15
                                     else 'build' if nxt is not None and nxt > e + 0.1 else 'verse'))
    return out


HIT_STYLES = ('slam', 'lift', 'soft')


def hit_plan(spec):
    """The spec's hits as sorted dicts {at, weight 0..1, style}. A bare number gets a derived weight: 0.4, plus 0.9 x the
    energy rise across the hit (one beat either side), plus 0.15 when it ends a build, scaled down when the previous
    hit is under four bars away (never under 0.4). An object's own weight and style win."""
    secs, beat = spec['sections'], 60 / spec['bpm']
    roles = section_roles(secs)
    energy_at = lambda t: next(s['energy'] for s in secs if t < s['to'] or s is secs[-1])
    out = []
    for raw in sorted(spec.get('hits', []), key=lambda h: h['at'] if isinstance(h, dict) else h):
        h = dict(raw) if isinstance(raw, dict) else {'at': raw}
        t = h['at']
        k = next(i for i, s in enumerate(secs) if t - 1e-3 < s['to'] or s is secs[-1])
        w = 0.4 + 0.9 * max(0, energy_at(t + beat) - energy_at(t - beat)) + (0.15 if roles[k] == 'build' and abs(secs[k]['to'] - t) < beat else 0)
        if out:  # dense hits are lighter, but never under 0.4: a reel that cuts on every bar still needs every cut to land
            w = max(min(w, 0.4), w * (0.5 + 0.5 * min(1, (t - out[-1]['at']) / (16 * beat))))
        out.append({'at': t, 'weight': round(float(h.get('weight', min(1, w))), 3), 'style': h.get('style', 'slam')})
    return out


# Mix bus gains and (reverb, delay) sends before the mood's send scale.
BUSES = {'kick': (0.6, 0.02, 0), 'sub': (0.6, 0, 0), 'snare': (0.42, 0.25, 0), 'hats': (0.45, 0.08, 0.15), 'perc': (0.4, 0.3, 0),
         'bass': (0.4, 0, 0), 'pad': (0.3, 0.45, 0.1), 'arp': (0.4, 0.3, 0.6), 'lead': (0.4, 0.25, 0.3), 'fx': (0.32, 0.6, 0),
         'hit': (0.6, 0.15, 0)}  # the hits' own kick, sub, crash and transient: not ducked, not compressed
ACCENT_DB = 1.5  # a hit's loudest 20 ms beats every 20 ms of the second before it (riser and roll included) by this much in the final mix
TRANSIENT_DB = 4.0  # and every 20 ms of the 200 ms just before it by this much: the cut is heard as a hit
HIT_DUCK = (0.09, 0.3)  # the bed dips over the 90 ms before a hit and comes back over the 300 ms after it
LEVEL_DB = 4  # level span between energy 0 and energy 1 sections


def breakpoints(secs, hits, beat, bar):
    """Two times per section between which its automation values hold. Transitions ramp over a bar (less when either
    neighbour is shorter than two bars) ending at the boundary, except a falling boundary that carries a hit: there the
    old level holds through the hit and falls over the ramp after it."""
    xs, start = [], 0.0
    for i, s in enumerate(secs):
        falling_hit = i + 1 < len(secs) and secs[i + 1]['energy'] < s['energy'] and any(abs(h - s['to']) < beat / 4 for h in hits)
        ramp = min(bar, (s['to'] - s['from']) / 2, (secs[i + 1]['to'] - secs[i + 1]['from']) / 2) if i + 1 < len(secs) else 0
        end = s['to'] if i + 1 == len(secs) else s['to'] + 0.2 if falling_hit else s['to'] - ramp
        xs += [start, max(start, end)]
        start = max(start, end, s['to'] + ramp if falling_hit else s['to'])
    return xs


class Mix:
    def __init__(self, n):
        self.n = n
        self.bus = {k: np.zeros((2, n)) for k in BUSES}

    def add(self, bus, sig, at, gain, pan=0.0):
        i = int(round(at * SR))
        if sig.ndim == 1:
            sig = np.stack([sig * np.cos((pan + 1) * np.pi / 4), sig * np.sin((pan + 1) * np.pi / 4)])
        sig, i = sig[:, max(0, -i):], max(0, i)  # a roll or riser before an early hit starts mid-sound at 0
        m = min(sig.shape[1], self.n - i)
        if m > 0:
            self.bus[bus][:, i:i + m] += sig[:, :m] * gain


def score(spec):
    dur, beat = spec['durationSeconds'], 60 / spec['bpm']
    step, bar, m = beat / 4, beat * 4, MOODS[spec['mood']]
    root, mode = spec['key'].split()
    base = 48 + NOTES.index(root)  # tonic in the C3..B3 octave
    secs, plan = spec['sections'], spec['hits']
    hits = [x['at'] for x in plan]
    roles = section_roles(secs)
    n = int(round(dur * SR))
    prog = PROGRESSIONS[mode][m['progs'][mode][rng.integers(len(m['progs'][mode]))]]
    kit = m['kit']
    pools = {'kick': [kick(kit) for _ in range(3)], 'snare': [snare(kit) for _ in range(5)],
             'hat': [hat(kit, False) for _ in range(6)], 'open': [hat(kit, True) for _ in range(3)], 'crash': [crash() for _ in range(2)]}
    toms = [tom(f) for f in (196, 147, 110, 82)]
    hit_kick = kick('cinematic' if kit == 'cinematic' else 'synth')  # the layered kick, even under the chip kit
    pick = lambda name: pools[name][rng.integers(len(pools[name]))]

    def idx(at):
        return next(i for i, s in enumerate(secs) if at < s['to'] or s is secs[-1])

    # Bar lines are placed so that hits (weighed double) and section edges fall as near a bar line as possible; the
    # arrangement (which layers play) then changes only on those bar lines, while hits stay exactly where the spec puts
    # them. Automation (energy, filter, level) still follows the spec's own times. The grid starts a bar before 0 so the
    # first partial bar is filled.
    marks = [(h, 2.0) for h in hits] + [(s['from'], 1.0) for s in secs[1:]]
    dist = lambda t, ph: abs(((t - ph + bar / 2) % bar) - bar / 2)
    phase = min(sorted({round(t % bar, 6) for t, _ in marks} | {0.0}), key=lambda ph: sum(w * dist(t, ph) for t, w in marks)) - bar
    snapped = [-1e9] + [phase + round((s['from'] - phase) / bar) * bar for s in secs[1:]]
    steps = int(np.ceil((dur - phase) / step))

    def aidx(at):  # the section whose arrangement plays at `at`; a section shorter than half a bar can lose its turn
        return max(k for k, b in enumerate(snapped) if at >= b - 1e-6)

    def chord(at):  # one chord per bar; after the last hit it rests on the tonic
        return [base + x for x in (prog[0] if hits and at >= hits[-1] else prog[int((at - phase) // bar + 1e-9) % 4])]

    # Automation: energy crossfades over the bar before each boundary; build sections open the filter as they progress.
    t_all = np.arange(n + 3 * SR) / SR
    xs = breakpoints(secs, hits, beat, bar)
    e_curve = np.interp(t_all, xs, [s['energy'] for s in secs for _ in (0, 1)])
    opening = sum(np.clip((t_all - s['from']) / (s['to'] - s['from']), 0, 1) * ((t_all >= s['from']) & (t_all < s['to']))
                  for s, r in zip(secs, roles) if r == 'build')
    lfo = m['lfo'][1] * np.sin(2 * np.pi * t_all / (m['lfo'][0] * bar))
    cut = None if m['cut'] is None else m['cut'] * 2 ** (2.5 * (e_curve - 1) + 1.5 * opening + lfo)
    cut_at = lambda at, scale=1.0: None if cut is None else cut[max(0, int(at * SR)):] * scale

    hum = lambda at: at + rng.uniform(-0.004, 0.004)
    vel = lambda v: v * rng.uniform(0.88, 1.12)
    swing = (m['swing'] / 100 - 0.5) * 2 * step
    grid = lambda i: phase + i * step + (swing if i % 2 else 0)
    mutes = [(x['at'] - beat / 2, x['at']) for x in plan if x['style'] == 'slam' and x['weight'] > 0.6]  # only a heavy slam mutes the drums
    quiet = lambda at: any(a - 1e-6 <= at <= b + 1e-6 for a, b in mutes)
    # A fill leads only into a rise of 0.2 or more that is two bars clear of any hit or earlier fill, never into the
    # last section: a fill at every edge is what makes a short piece sound stitched together.
    bounds = []
    for k in range(1, len(secs) - 1):
        b = snapped[k]
        if secs[k]['energy'] - secs[k - 1]['energy'] >= 0.2 and not any(abs(b - h) < 2 * bar for h in hits) and not (bounds and b - bounds[-1] < 2 * bar):
            bounds.append(b)
    in_fill = lambda at: any(b - beat - 1e-6 <= at < b - 1e-6 for b in bounds)
    mix = Mix(n)

    # Drums on the 16th grid.
    for i in range(steps):
        at = phase + i * step
        k, pos = aidx(at), i % 16
        e, role = secs[k]['energy'], ROLES[roles[k]]
        if quiet(at):
            continue
        on = lambda th: th is not None and e >= th
        ch = m['kick'][pos]
        if ch != '.' and on(role['kick']):
            mix.add('kick', pick('kick'), hum(grid(i)), vel(VEL[ch]) * (0.6 + 0.4 * e))
        if in_fill(at):
            continue
        ch = m['snare'][pos]
        if ch != '.' and on(role['snare']) and (ch != 'g' or on(role['ghost'])):
            mix.add('snare', pick('snare'), hum(grid(i)), vel(VEL[ch]) * (0.6 + 0.4 * e), -0.08)
        ch = m['hat'][pos]
        dense = 3 if e >= 0.5 else 2 if e >= 0.3 else 1
        if ch != '.' and on(role['hats']) and (dense == 3 or (pos % 2 == 0 if dense == 2 else pos % 4 == 2)) and (ch != 'g' or on(role['ghost'])):
            is_open = ch == 'o' and role['open']
            mix.add('hats', pick('open' if is_open else 'hat'), hum(grid(i)), vel(VEL[ch]) * (0.55 + 0.45 * e), 0.45 if pos % 2 else -0.25)

    # Build sections: a snare roll whose density rises (quarters, eighths, sixteenths) over the last two bars.
    for k, (s, r) in enumerate(zip(secs, roles)):
        if r != 'build' or k + 1 == len(secs):
            continue
        close = snapped[k + 1]
        start, end = max(s['from'], close - 2 * bar), close - beat
        at = start
        while at < end - 1e-6:
            p = (at - start) / max(end - start, 1e-6)
            if not quiet(at):
                mix.add('snare', pick('snare'), hum(at), vel(0.25 + 0.45 * p) * (0.6 + 0.4 * s['energy']), 0.05)
            at += beat / (1, 2, 4)[min(2, int(3 * p))]

    # A one-beat fill into every section boundary that has no hit (hits bring their own roll).
    for b in bounds:
        e = max(0.4, secs[idx(b - 1e-3)]['energy'])
        shape = rng.integers(3)
        for j in range(4):
            at = b - beat + j * step
            if shape == 0:
                mix.add('snare', pick('snare'), hum(at), vel(0.45 + 0.15 * j) * e, -0.08)
            elif shape == 1:
                mix.add('perc', toms[j], hum(at), vel(0.8) * e, (0.4, 0.15, -0.15, -0.4)[j])
            else:
                mix.add(*(('snare', pick('snare')) if j < 2 else ('perc', toms[j])), hum(at), vel((0.7, 0.35, 0.8, 0.9)[j]) * e, -0.1 * j)

    # Bass on the 16th grid: patterned in verse/build/drop, one held root per bar otherwise.
    pat = m['bass_pat']
    onsets = [p for p, c in enumerate(pat) if c != '.']
    for i in range(steps):
        at = phase + i * step
        k, pos = aidx(at), i % 16
        e, role = secs[k]['energy'], ROLES[roles[k]]
        root_note = 36 + (chord(at)[0] - 36) % 12
        if role['bass'] == 'hold' or e < 0.4:
            if pos != 0 or e < 0.2:
                continue
            note, length, v = root_note, bar * 0.95, 0.75
        else:
            c = pat[pos]
            if c == '.' or (e < 0.5 and pos % 4):
                continue
            nxt = next((p for p in onsets if p > pos), 16 + onsets[0])
            note, length, v = root_note + {'x': 0, 'o': 12, '5': 7}[c], min(nxt - pos, 8) * step * 0.85, VEL.get(c, 0.8)
        if m['bass'] in ('sine', '808'):
            env = adsr(int(length * SR), 0.004, 0.2, 0.8, 0.06)
            t = np.arange(len(env)) / SR
            f = hz(note) * (1 + (0.5 if m['bass'] == '808' else 0.15) * np.exp(-t / 0.03))
            sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * env
            sig = np.tanh(1.8 * sig) / np.tanh(1.8)  # a little harmonic edge so small speakers hear the line
        else:
            sig = subtractive(m['bass'], [note], length, 1.0, (0.004, 0.15, 0.7, 0.05), cut_at(at, 0.6), m['q'], 2.0, 0.07)
        mix.add('bass', sig, hum(grid(i)) if role['bass'] != 'hold' else at, vel(v))

    # Pad: one chord per bar. Arp and stabs on their own grids.
    for b in range(int(np.ceil((dur - phase) / bar))):
        at = phase + b * bar
        if m['pad']:
            sig = subtractive(m['pad'], chord(at), bar, 1.0, m.get('pad_env', (0.35, 0.5, 0.85, 0.6)), cut_at(at), 0.9, detune=0.006)
            mix.add('pad', sig, at, vel(1.0))
    if m['arp']:
        rate = m['arp_rate']
        for i in range(steps):
            at = phase + i * step
            k = aidx(at)
            e, role = secs[k]['energy'], ROLES[roles[k]]
            full = role['arp_full'] is not None and e >= role['arp_full']
            every = rate if full else rate * 2
            if e < 0.12 or i % every:
                continue
            tones = [x + 12 for x in chord(at)]
            seq = tones + [x + 12 for x in tones] if every <= 2 else tones
            order = m['arp_order']
            j = i // every
            note = (seq[j % len(seq)] if order == 'up' else (seq + seq[-2:0:-1])[j % (2 * len(seq) - 2)] if order == 'updown'
                    else seq[rng.integers(len(seq))])
            length = every * step * 0.9
            if m['arp'] == 'pluck':
                sig = ks(note, max(length, 0.35), 1.0, 2500 + 4000 * e)
            elif m['arp'] == 'fm':
                sig = fm(note + 12, max(length, 0.6), 1.0, 3.5, 2.5, 0.08, 0.5)
            else:
                sig = subtractive(m['arp'], [note], length, 1.0, (0.002, 0.08, 0.4, 0.04), cut_at(at, 1.5), m['q'], 1.5, 0.05)
            mix.add('arp', sig, hum(grid(i)), vel(0.6 + 0.4 * e), 0.6 if j % 2 else -0.6)
    if m['lead']:
        for i in range(steps):
            at = phase + i * step
            k, pos = aidx(at), i % 16
            e = secs[k]['energy']
            if m['lead_pat'][pos] == '.' or not (roles[k] == 'drop' or e >= m.get('lead_e', 0.75)) or quiet(at):
                continue
            notes, length = [x + 12 for x in chord(at)], m['lead_len'] * step
            if m['lead'] == 'supersaw':
                sig = supersaw(notes, length, 1.0, 2500 + 3500 * e, env=(0.005 if length < beat else 0.25, 0.2, 0.7, 0.2))
            elif m['lead'] == 'fm':
                sig = sum(fm(x, length, 1.0, 1.0, 1.8, 0.25, 0.9) for x in notes) / len(notes)
            else:
                sig = subtractive('pulse', [notes[-1]], length, 1.0, (0.002, 0.1, 0.6, 0.05), None)
            mix.add('lead', sig, hum(grid(i)), vel(0.7 + 0.3 * e), 0.1)

    # Hits, every element scaled by the hit's weight w (all of it at 1). slam: riser (w >= 0.35), snare roll (w >= 0.4),
    # kick, sub drop (w > 0.5), crash. lift: riser, open hats, a reversed-cymbal swell and a lighter kick, no sub. soft: one accent kick
    # and a short reverb swell. Nothing is humanized.
    def swell(seconds, gain, h):
        x = pools['crash'][1][:, ::-1][:, -int(seconds * SR):]  # a crash played backwards peaks at its end
        mix.add('fx', x, h - x.shape[1] / SR, gain)

    for x in plan:
        h, w, style = x['at'], x['weight'], x['style']
        k = idx(h - 1e-3)
        length = (min(secs[k]['to'] - secs[k]['from'], 2 * bar) if roles[k] == 'build' else 2 * beat) * (0.4 + 0.6 * w)
        if style != 'soft' and w >= 0.35:
            mix.add('fx', riser(length), h - length, 0.45 * (0.3 + 0.7 * w))
        if style == 'slam':
            rolls = 2 + round(6 * (w - 0.4) / 0.6)
            for j in range(rolls if w >= 0.4 else 0):
                mix.add('snare', pick('snare'), h - beat + beat * (1 - (1 - j / rolls) ** 1.5), (0.2 + 0.5 * j / rolls) * (0.5 + 0.5 * w), -0.1)
            mix.add('hit', hit_kick, h, 1.6 * (0.5 + 0.5 * w))
            if w > 0.5:
                mix.add('hit', sub_drop(), h, 1.3 * w)
            mix.add('hit', pools['crash'][0], h, 0.9 * (0.25 + 0.75 * w))
        elif style == 'lift':
            for j in range(5):
                mix.add('hats', pick('open'), h - beat + j * beat / 4, (0.25 + 0.35 * w) * (1 if j < 4 else 1.4), 0.4)
            swell(min(1.2, 2 * beat), 0.7 * (0.3 + 0.7 * w), h)
            mix.add('hit', hit_kick, h, 1.6 * (0.5 + 0.5 * w))  # the downbeat still needs an accent to be a local peak
        else:
            mix.add('hit', pick('kick'), h, 1.2 * (0.5 + 0.5 * w))
            swell(0.5, 0.45 * (0.3 + 0.7 * w), h)
        mix.add('hit', transient(), h, 1.2 * (0.6 + 0.4 * w))
    for k, (s, r) in enumerate(zip(secs, roles)):  # builds that do not end on a hit still rise into the next section
        if r == 'build' and not any(abs(s['to'] - h) < beat for h in hits) and k + 1 < len(secs):
            length = min(s['to'] - s['from'], bar)
            mix.add('fx', riser(length), snapped[k + 1] - length, 0.35)

    curve = lambda values: np.interp(t_all[:n], xs, [v for v in values for _ in (0, 1)])
    role_curve = lambda key: curve([ROLES[r][key] for r in roles])
    # The tonal buses dip up to 6 dB (6 x weight) over the beat before a slam so it lands as the loudest moment around it.
    dip = np.ones(n)
    for x in plan:
        if x['style'] == 'slam':
            a, b = int(max(0, x['at'] - beat) * SR), int(x['at'] * SR)
            dip[a:b] = np.minimum(dip[a:b], np.linspace(1, 10 ** (-6 * x['weight'] / 20), b - a))
    # Every hit, whatever its style, ducks the bed (every bus but the hit layers) 6 to 10 dB around itself, so the hit stands out of the track.
    bed = np.ones(n)
    for x in plan:
        h = int(x['at'] * SR)
        a, b = max(0, h - int(HIT_DUCK[0] * SR)), min(n, h + int(HIT_DUCK[1] * SR))
        floor = 10 ** (-(6 + 4 * x['weight']) / 20)
        shape = np.interp(np.arange(a, b), [a, h, b], [1, floor, 1])
        bed[a:b] = np.minimum(bed[a:b], shape)
    return master(mix, m, curve, role_curve('pad'), role_curve('sc'), dip, bed, dur, secs, beat, plan)


HIT_RING = 0.35  # seconds a hit sounds at full level before the closing fade may begin


def fade_start(secs, dur, plan):
    """Where the closing fade begins: the last section or the last 2 s, but never before the last hit has rung for
    HIT_RING s, so a hit on the final lockup lands at full level (the fade then shortens, keeping at least 0.6 s)."""
    start = min(secs[-1]['from'], dur - 2)
    last = max((x['at'] for x in plan if x['at'] < dur), default=None)
    return start if last is None or last + HIT_RING <= start else min(last + HIT_RING, dur - 0.6)


def master(mix, m, curve, pad_gain, sc_role, dip, bed, dur, secs, beat, plan=()):
    n = mix.n
    b = mix.bus
    if m.get('drum_lp'):
        for k in ('snare', 'hats', 'perc'):
            b[k] = lp(b[k], m['drum_lp'])
    for k in ('pad', 'arp', 'lead', 'hats', 'fx'):
        b[k] = hp(hp(b[k], 150), 150)
    b['snare'] = hp(b['snare'], 110)
    b['pad'] = chorus(b['pad'].sum(axis=0)) * pad_gain
    # Sidechain: an envelope follower on the kick bus ducks the tonal buses; depth depends on the section role.
    env = follower((b['kick'] + b['hit']).sum(axis=0), 0.002, 0.14)
    duck = 1 - m['sc'] * sc_role * np.clip(per_sample(env, n) / (np.percentile(env, 99.5) + 1e-9), 0, 1)
    for k in ('bass', 'pad', 'arp', 'lead'):
        b[k] = b[k] * duck * dip
    b['hats'] = b['hats'] * dip
    dry, hits = np.zeros((2, n)), np.zeros((2, n))
    rev_in, dly_in = np.zeros(n), np.zeros(n)
    for k, (gain, rs, ds) in BUSES.items():
        x = b[k] * gain * m.get('gains', {}).get(k, 1.0)
        if k == 'hit':
            hits += x
        else:
            dry += x * bed
        rev_in += x.sum(axis=0) * rs * m['rev']
        dly_in += x.sum(axis=0) * ds * m['dly']
    wet = (reverb(rev_in, m['size'], m['pre']) + ping_pong(dly_in, m['dly_beats'] * beat)) * bed
    # The hit layers join after the bus compressor, so it cannot pull them back to the level of the track.
    bed_x, hit_x = widen(compress(tilt(dry + wet, *m['tilt'])), m['width']), widen(tilt(hits, *m['tilt']), m['width'])
    x = bed_x + hit_x
    # Section ride: each section lands LEVEL_DB * (1 - energy) under full energy, measured after the limiter, whatever
    # its arrangement. Iterated because part of a section (the boundary crossfade, a held hit) follows its neighbour's
    # gain and the limiter is nonlinear.
    target = np.array([-LEVEL_DB * (1 - s['energy']) for s in secs])
    ride = np.zeros(len(secs))
    for _ in range(16):
        pre = x * 10 ** (curve(ride) / 20)
        loud = np.percentile([np.sqrt(np.mean(pre[:, i:i + SR // 20] ** 2)) for i in range(0, n - SR // 20, SR // 20)], 95)
        # The bed is limited HIT_HEADROOM_DB under the final ceiling, so a hit's peak clears every bed peak around it (a single
        # limiter flattens both to the same ceiling and the hit measures 0 dB over its surroundings).
        g = 10 ** (curve(ride) / 20)
        ceiling = loud * 10 ** (CREST_DB / 20)
        out = limit(limit(bed_x * g, ceiling) + hit_x * g, ceiling * 10 ** (HIT_HEADROOM_DB / 20))
        got = np.array([rms_db(out[:, int(s['from'] * SR):int(s['to'] * SR)]) for s in secs])
        err = target - (got - got.max())
        if np.abs(err - err.max()).max() < 0.05:
            break
        ride = ride + 1.5 * err  # over-relaxed: a section often controls only part of its own level
        ride = np.clip(ride - ride.max(), -30, 0)  # a near-silent section must not ask for +200 dB
    t = np.arange(n) / SR
    fade_from = fade_start(secs, dur, plan)
    fade = np.where(t < fade_from, 1.0, np.clip((dur - t) / (dur - fade_from), 0, 1) ** 3)
    return pre * fade, out * fade


CREST_DB = 9.5  # bed limiter ceiling above the loud-section RMS
HIT_HEADROOM_DB = 4.0  # the hit layers may peak this far above the bed ceiling


# ---------------------------------------------------------------- output

def write(path, stereo, peak_db):
    x = stereo * (10 ** (peak_db / 20) / np.abs(stereo).max())
    with wave.open(path, 'wb') as f:
        f.setnchannels(2), f.setsampwidth(2), f.setframerate(SR)
        f.writeframes(np.round(x.T * 32767).astype('<i2').tobytes())


def loudnorm(path, I, TP, lra=7, extra='', out=None):
    cmd = [FFMPEG, '-hide_banner', '-nostats', '-i', path, '-af', f'loudnorm=I={I}:TP={TP}:LRA={lra}{extra}:print_format=json']
    cmd += ['-ar', str(SR), '-c:a', 'pcm_s16le', '-fflags', '+bitexact', '-map_metadata', '-1', '-y', out] if out else ['-f', 'null', '-']
    log = subprocess.run(cmd, capture_output=True, text=True, check=True).stderr
    return json.loads(re.findall(r'\{[^{}]*\}', log)[-1])


def normalize(raw, out, I, TP):
    m = loudnorm(raw, I, TP)
    # loudnorm turns into a compressor when the source LRA exceeds the target, which would flatten the scored
    # dynamics; raising the LRA target to the measured value keeps the second pass a single linear gain.
    extra = ':measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:measured_thresh={input_thresh}' \
            ':offset={target_offset}:linear=true'.format(**m)
    return loudnorm(raw, I, TP, min(50, max(7, float(m['input_lra']))), extra, out)['normalization_type'] == 'linear'


def exact_length(path, frames):
    # loudnorm resamples internally; pin the sample count so music.wav is exactly durationSeconds long.
    with wave.open(path, 'rb') as f:
        pcm = np.frombuffer(f.readframes(f.getnframes()), '<i2').reshape(-1, 2)
    pcm = np.concatenate([pcm[:frames], np.zeros((max(0, frames - len(pcm)), 2), '<i2')])
    with wave.open(path, 'wb') as f:
        f.setnchannels(2), f.setsampwidth(2), f.setframerate(SR)
        f.writeframes(pcm.tobytes())


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def accents(final, plan, before_s=1.0):
    """Per hit: dB by which its loudest 20 ms window (from 10 ms before to 100 ms after) beats the loudest 20 ms of the window
    before it: from `before_s` before the hit to 100 ms before it (1.0: the 0.9 s before), or, for a window under 0.3 s, the
    whole window up to 20 ms before the hit (0.2: the 200 ms before, the transient check)."""
    w = SR // 50
    level = lambda i: rms_db(final[:, i:i + w])
    out = []
    for x in plan:
        h = int(x['at'] * SR)
        stop = h - (w if before_s < 0.3 else SR // 10)
        before = [level(i) for i in range(max(0, h - int(before_s * SR)), stop, w // 4)]
        out.append(max(level(i) for i in range(max(0, h - w // 2), h + SR // 10, w // 4)) - max(before) if before else float('inf'))
    return out


def check(pre, final, spec):
    peak = np.abs(pre).max(axis=0)
    for x in spec['hits']:  # before the limiter, a slam of weight 0.5+ peaks within 150 ms and beats the rest of its second
        h, strong = x['at'], x['style'] == 'slam' and x['weight'] >= 0.5
        reach = (0.5, 0.5) if strong else (0.04, 0.04)  # a lighter hit only has to beat the 40 ms either side of its peak window
        lo, a, b, hi = (int(np.clip(t, 0, spec['durationSeconds']) * SR) for t in (h - 0.02 - reach[0] if not strong else h - 0.5, h - 0.02, h + 0.15, h + 0.15 + reach[1] if not strong else h + 0.5))
        rest = max(peak[lo:a].max(initial=0), peak[b:hi].max(initial=0))
        assert peak[a:b].max() > rest, f"hit {h}: something else around it is louder"
    for x, accent in zip(spec['hits'], accents(final, spec['hits'])):
        assert accent >= ACCENT_DB, f"hit {x['at']}: only {accent:.1f} dB over the second before it, under {ACCENT_DB} dB"
    for x, accent in zip(spec['hits'], accents(final, spec['hits'], 0.2)):
        assert accent >= TRANSIENT_DB, f"hit {x['at']}: only {accent:.1f} dB over the 200 ms before it, under {TRANSIENT_DB} dB"
    win = max(rms_db(final[:, i:i + SR]) for i in range(0, final.shape[1] - SR, SR // 10))
    # The closing stretch sits 20 dB under the loudest second: the last second, or the last quarter second when a hit on the
    # final lockup shortened the fade.
    tail_s = 1.0 if fade_start(spec['sections'], spec['durationSeconds'], spec['hits']) <= spec['durationSeconds'] - 2 else 0.25
    assert win - rms_db(final[:, -int(SR * tail_s):]) >= 20, f'last {tail_s:g} s must sit 20 dB under the loudest second'


# ---------------------------------------------------------------- spec and CLI

def fail(path, msg):
    raise SystemExit(f'{path}: {msg}')


def validate(s, path):
    def need(ok, msg):
        if not ok:
            fail(path, msg)
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
    need(isinstance(s, dict) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', str(s.get('slug', ''))), 'slug must be lowercase letters, digits and hyphens')
    name = os.path.basename(path)
    expected = os.path.basename(os.path.dirname(os.path.abspath(path))) if name == 'audio.json' else name.removesuffix('.audio.json')
    need(s['slug'] == expected, f'slug must be {expected!r} to match the spec location')
    dur, bpm = s.get('durationSeconds'), s.get('bpm')
    need(num(dur) and 2 <= dur <= 600, 'durationSeconds must be 2..600')
    need(num(bpm) and 60 <= bpm <= 180, 'bpm must be 60..180')
    key = re.fullmatch(r'([A-G]#?) (major|minor)', str(s.get('key')))
    need(key and key[1] in NOTES, 'key must be "<root> major|minor" with root in ' + ' '.join(NOTES))
    need(s.get('mood') in MOODS, 'mood must be one of ' + ', '.join(MOODS))
    secs = s.get('sections')
    need(isinstance(secs, list) and secs and all(isinstance(x, dict) and num(x.get('from')) and num(x.get('to')) and num(x.get('energy')) for x in secs), 'sections need from, to, energy')
    need(secs[0]['from'] == 0 and abs(secs[-1]['to'] - dur) < 1e-6, 'sections must cover 0..durationSeconds')
    need(all(a['to'] == b['from'] for a, b in zip(secs, secs[1:])), 'sections must be contiguous')
    need(all(x['to'] - x['from'] >= 60 / bpm and 0 <= x['energy'] <= 1 for x in secs), 'each section must last a beat or more with energy 0..1')
    need(all(x.get('role', 'verse') in ROLES for x in secs), 'section role must be one of ' + ', '.join(ROLES))
    hit_ok = lambda h: num(h) and 0 < h < dur or isinstance(h, dict) and set(h) <= {'at', 'weight', 'style'} and num(h.get('at')) and 0 < h['at'] < dur \
        and (h.get('weight') is None or num(h['weight']) and 0 <= h['weight'] <= 1) and h.get('style', 'slam') in HIT_STYLES
    need(isinstance(s.get('hits', []), list) and all(hit_ok(h) for h in s.get('hits', [])),
         'hits must be seconds inside the duration or {"at": s, "weight": 0..1, "style": ' + '|'.join(HIT_STYLES) + '}')
    sfx = s.get('sfx', [])
    need(isinstance(sfx, list) and all(isinstance(x, dict) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', str(x.get('name', ''))) and (x.get('preset') in SFX or isinstance(x.get('intent'), str) and x['intent'].strip()) for x in sfx),
         'sfx entries need a name and an intent sentence or a preset from ' + ', '.join(SFX))
    need(all(x.get('preset') is None or x['preset'] in SFX for x in sfx), 'sfx preset must be one of ' + ', '.join(SFX))
    need(all(x.get('source', 'auto') in ('auto', 'library', 'synth') for x in sfx), 'sfx source must be auto, library or synth')
    need(all(x.get('variant', 1) in (1, 2, 3) and num(x.get('length', 1)) and 0.05 <= x.get('length', 1) <= 10 for x in sfx), 'sfx variant must be 1..3 and length 0.05..10 seconds')
    names = [x['name'] for x in sfx]
    need(len(set(names)) == len(names) and 'music' not in names, 'sfx names must be unique and not "music"')
    need(isinstance(s.get('seed'), int), 'seed must be an integer')
    ld = s.get('loudness', {})
    need(isinstance(ld, dict) and num(ld.get('I')) and num(ld.get('TP')) and -70 <= ld['I'] <= -5 and -9 <= ld['TP'] <= 0, 'loudness needs I (-70..-5) and TP (-9..0)')
    s['hits'], _ = hit_plan(s), s.setdefault('sfx', [])
    lo, hi = MOODS[s['mood']]['bpm']
    if not lo <= bpm <= hi:
        print(f'{path}: warning: {bpm} bpm is outside the usual {lo}..{hi} for {s["mood"]}', file=sys.stderr)


def generate(path, force):
    global rng
    require_local_output(ROOT, path)
    began = time.time()
    with open(path, 'rb') as f:
        raw = f.read()
    try:
        spec = json.loads(raw)
    except ValueError as error:
        fail(path, f'not JSON: {error}')
    validate(spec, path)
    digest = hashlib.sha256(raw + GENERATION.encode()).hexdigest()  # bump GENERATION to invalidate every old output
    folder = os.path.join(OUT, spec['slug'])
    files = ['music.wav'] + [x['name'] + '.wav' for x in spec['sfx']]
    sidecar = os.path.join(folder, '.spec.sha256')
    if not force and all(os.path.exists(os.path.join(folder, f)) for f in files) and os.path.exists(sidecar) and open(sidecar).read().strip() == digest:
        print(json.dumps({'slug': spec['slug'], 'files': files, 'skipped': True}))
        return
    os.makedirs(folder, exist_ok=True)
    if os.path.exists(sidecar):
        os.remove(sidecar)  # a run that dies below leaves no sidecar, so the next run regenerates
    I, TP = spec['loudness']['I'], spec['loudness']['TP']
    music = os.path.join(folder, 'music.wav')
    with tempfile.TemporaryDirectory(dir=folder, prefix='.tmp-') as tmp:
        rng = np.random.default_rng(spec['seed'])
        pre, mix = score(spec)
        check(pre, mix, spec)
        src, out = os.path.join(tmp, 'raw.wav'), os.path.join(tmp, 'music.wav')
        for limit_x in (None, 5, 3, 2):
            # A tanh soft limit at <limit_x> x RMS gives loudnorm the true-peak headroom linear mode needs.
            write(src, mix if limit_x is None else np.tanh(mix / (limit_x * np.sqrt(np.mean(mix ** 2)))), -6)
            if normalize(src, out, I, TP):
                break
        else:
            fail(path, 'loudnorm could not stay linear even after soft limiting')
        exact_length(out, mix.shape[1])
        os.replace(out, music)  # rename into place so a server never reads a half-written file
        manifest_path = os.path.join(folder, 'sfx.json')
        manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
        for x in spec['sfx']:
            def synth(preset, variant, length):
                global rng
                rng = np.random.default_rng([spec['seed'], zlib.crc32(x['name'].encode()), variant, int(round(length * 1000))])
                return SFX[preset][0](variant, length)
            manifest[x['name']] = sfx_sources.resolve(spec, x, folder, tmp, synth, GENERATION, manifest)
        manifest = {k: v for k, v in manifest.items() if k in {x['name'] for x in spec['sfx']}}
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=1, ensure_ascii=False)
        sfx_sources.write_credits(folder, manifest)
    m = loudnorm(music, I, TP)
    with open(sidecar, 'w') as f:
        f.write(digest + '\n')
    print(json.dumps({'slug': spec['slug'], 'files': files, 'I': float(m['input_i']), 'LRA': float(m['input_lra']),
                      'TP': float(m['input_tp']), 'limited': limit_x, 'hits': spec['hits'], 'seconds': round(time.time() - began, 2)}))


def self_check():
    """Scores three specs in memory (no files): 90 bpm at 18.666 s and 18.667 s, where the last bar starts 0.4 ms before the end and its
    pad rings 3.3 s past it, with light slams whose accent the duck and transient must carry; and a 120 bpm reel with a bare hit on
    every bar, whose hits must stay heavy enough and peak over the bed (a single limiter used to flatten them to 0 dB); and a 144 bpm
    piece whose last hit lands on the final lockup 1.67 s before the end, inside the old closing fade."""
    global rng
    reel = {'slug': 'self-check', 'durationSeconds': 15, 'bpm': 120, 'key': 'A minor', 'mood': 'tech', 'seed': 3, 'loudness': {'I': -16, 'TP': -1},
            'sections': [{'from': 0, 'to': 2, 'energy': 0.7}, {'from': 2, 'to': 12, 'energy': 0.9}, {'from': 12, 'to': 15, 'energy': 0.3}],
            'hits': [2, 4, 6, 8, 10, 12]}
    specs = [{'slug': 'self-check', 'durationSeconds': dur, 'bpm': 90, 'key': 'A minor', 'mood': 'dramatic', 'seed': 7, 'loudness': {'I': -24, 'TP': -2},
              'sections': [{'from': 0, 'to': 2.667, 'energy': 0.3}, {'from': 2.667, 'to': 13.333, 'energy': 0.85}, {'from': 13.333, 'to': 17.333, 'energy': 0.5}, {'from': 17.333, 'to': dur, 'energy': 0.1}],
              'hits': [2.667, {'at': 8.0, 'style': 'lift'}, {'at': 10.667, 'weight': 0.3}, {'at': 13.333, 'style': 'soft'}]} for dur in (18.666, 18.667)] + [reel]
    # A name that lands on the final lockup, inside the last 2 s: the closing fade used to swallow this hit.
    lockup = {'slug': 'self-check', 'durationSeconds': 15, 'bpm': 144, 'key': 'F# minor', 'mood': 'tech', 'seed': 5, 'loudness': {'I': -16, 'TP': -1},
              'sections': [{'from': 0, 'to': 1.667, 'energy': 0.6}, {'from': 1.667, 'to': 11.667, 'energy': 0.9}, {'from': 11.667, 'to': 15, 'energy': 0.6}],
              'hits': [1.667, 6.667, 11.667, 13.333]}
    specs.append(lockup)
    for spec in specs:
        dur = spec['durationSeconds']
        validate(spec, 'self-check.audio.json')
        rng = np.random.default_rng(spec['seed'])
        pre, mix = score(spec)
        assert mix.shape[1] == int(round(dur * SR)), f'{dur} s: {mix.shape[1]} samples'
        check(pre, mix, spec)
        if spec is lockup:
            assert fade_start(spec['sections'], dur, spec['hits']) > 13.333, 'the closing fade must wait for the lockup hit'
        if spec is reel:
            assert min(x['weight'] for x in spec['hits']) >= 0.4, f"dense hits fell under weight 0.4: {[x['weight'] for x in spec['hits']]}"
            peak = lambda a, b: np.abs(mix[:, max(0, int(a * SR)):int(b * SR)]).max(initial=1e-9)
            over = [20 * np.log10(peak(x['at'] - 0.02, x['at'] + 0.15) / peak(x['at'] - 0.5, x['at'] - 0.02)) for x in spec['hits']]
            assert min(over) >= 2, f'reel hits peak only {min(over):.1f} dB over the half second before them'
            print(f'{dur} s at 120 bpm, a hit every bar: peak over the 0.5 s before ' + ', '.join(f'{a:.1f}' for a in over) + ' dB')
        print(f'{dur} s at {spec["bpm"]} bpm: hits accent ' + ', '.join(f'{a:.1f}' for a in accents(mix, spec['hits'])) + ' dB, transient over 200 ms '
              + ', '.join(f'{a:.1f}' for a in accents(mix, spec['hits'], 0.2)) + ' dB')
    print('score self-check ok')


def main(argv):
    if '--self-check' in argv:
        return self_check()
    force = '--force' in argv
    paths = [a for a in argv if a != '--force'] or sorted(
        glob.glob(os.path.join(ROOT, 'examples', '**', 'audio.json'), recursive=True))
    if not paths:
        fail('score.py', 'no audio specs found')
    for path in paths:
        generate(path, force)


if __name__ == '__main__':
    main(sys.argv[1:])
