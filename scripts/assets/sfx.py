"""Resolve one sound effect of an audio spec into <name>.wav: fetched from a CC0 library, or synthesized.

Providers, in order (an entry's `source` pins one; `auto` tries them in this order):
  library   Openverse audio search (https://api.openverse.org/v1/audio/, no key, anonymous limits 20/min 200/day),
            CC0 only unless FRAMEFORGE_SFX_LICENSES=cc0,by; results are Freesound hq mp3 previews (128 kbps ceiling)
  synth     the procedural presets in score.py
Every source goes through the same conditioning: decode to 48 kHz stereo, trim to the onset so the transient lands on
the frame, cap the length, tail fade, high-pass, one peak level. The choice is pinned in <folder>/sfx.json so a later
run reuses the file without the network; a network failure falls back to synth and says so in the manifest.
"""
import hashlib, json, os, re, subprocess, urllib.error, urllib.parse, urllib.request
import numpy as np

OPENVERSE_URL = os.environ.get('OPENVERSE_URL', 'https://api.openverse.org/v1/audio/')
LICENSES = set(os.environ.get('FRAMEFORGE_SFX_LICENSES', 'cc0').split(','))
PLAYABLE = {'mp3', 'wav', 'ogg', 'flac'}
MAX_LIBRARY_MS, IDEAL_MS = 15000, 2500
TIMEOUT = 20
ONSET_DB, PRE_ROLL_S, TAIL_S, HP_HZ, PEAK_DB = -40, 0.003, 0.01, 70, -18
KEYWORDS = [('whoosh', ('whoosh', 'swoosh', 'swish', 'swipe', 'wipe', 'slide', '휙', '쓱')), ('impact', ('impact', 'boom', 'hit', 'slam', 'thud', 'punch', '쿵', '충돌')),
            ('click', ('click', 'tap', 'button', 'switch', '클릭', '딸깍')), ('ding', ('ding', 'bell', 'chime', 'notification', '종', '띵')),
            ('riser', ('riser', 'rise', 'build', '상승')), ('tick', ('tick', 'count', '틱')), ('swell', ('swell', 'open', 'reveal', '열')),
            ('stinger', ('stinger', 'logo', 'sting')), ('shimmer', ('shimmer', 'sparkle', 'glitter', '반짝')), ('pop', ('pop', 'bubble', 'land', 'spring', '팝', '톡'))]


def preset_for(entry):
    """The synth preset an entry falls back to: its own `preset`, else the first keyword of its intent, else pop."""
    if entry.get('preset'):
        return entry['preset']
    intent = (entry.get('intent') or entry['name']).lower()
    tokens = set(re.findall(r'[a-z]+', intent))  # whole words: "landing" must not match "ding"
    hit = lambda w: w in tokens if w.isascii() else w in intent
    return next((preset for preset, words in KEYWORDS if any(hit(w) for w in words)), 'pop')


def entry_hash(entry, generation):
    return hashlib.sha256((json.dumps(entry, sort_keys=True) + generation + ','.join(sorted(LICENSES))).encode()).hexdigest()[:16]


def decode(path):
    """Any audio file to float32 stereo at 48 kHz."""
    import score
    raw = subprocess.run([score.FFMPEG, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(score.SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).T.astype(np.float64)


def condition(x, length_cap):
    """Trim to the onset, cap the length, fade the tail, high-pass, and report the trim in ms."""
    import score
    peak = np.abs(x).max()
    if peak <= 0:
        raise ValueError('silent file')
    above = np.flatnonzero(np.abs(x).max(axis=0) > peak * 10 ** (ONSET_DB / 20))
    start = max(0, int(above[0]) - int(PRE_ROLL_S * score.SR))
    x = x[:, start:start + int(length_cap * score.SR)]
    x = score.hp(x, HP_HZ)
    k = min(x.shape[1] // 4, int(TAIL_S * score.SR))
    if k > 1:
        x[:, -k:] *= np.linspace(1, 0, k)
    return x, round(start / score.SR * 1000, 1)


def queries(entry):
    """Search terms from specific to generic: the whole intent, its first three words, then the preset keyword. A long
    sentence returns nothing on Openverse; a single word returns hundreds."""
    intent = (entry.get('intent') or '').strip()
    words = re.findall(r'[A-Za-z가-힣]+', intent)
    out = [intent, ' '.join(words[:3]), preset_for(entry)]
    return [q for i, q in enumerate(out) if q and q not in out[:i]]


def openverse(intent):
    """Best licensed result for `intent`, or None. Raises urllib errors when the service is unavailable."""
    query = urllib.parse.urlencode({'q': intent, 'license': ','.join(sorted(LICENSES)), 'page_size': '20'})
    request = urllib.request.Request(f'{OPENVERSE_URL}?{query}', headers={'Accept': 'application/json', 'User-Agent': 'frameforge-sfx/1'})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        results = json.load(response).get('results', [])
    best = None
    for position, r in enumerate(results):
        ok = r.get('license') in LICENSES and r.get('filetype') in PLAYABLE and str(r.get('url', '')).startswith('https://') and 0 < (r.get('duration') or 0) <= MAX_LIBRARY_MS
        if not ok:
            continue
        score_ = position + max(0, r['duration'] - IDEAL_MS) / 1000 + (2 if r['license'] == 'by' else 0)
        if best is None or score_ < best[0]:
            best = (score_, r)
    if best is None:
        return None
    r = best[1]
    one = lambda s: re.sub(r'[\x00-\x1f`\[\]<>\\]+', ' ', str(s or '')).strip()[:300]
    return {'id': r.get('id'), 'url': r['url'], 'title': one(r.get('title')), 'creator': one(r.get('creator')), 'license': r['license'],
            'license_url': one(r.get('license_url')), 'landing': one(r.get('foreign_landing_url')), 'attribution': one(r.get('attribution')),
            'duration_ms': r['duration'], 'filetype': r['filetype']}


def download(url, path):
    request = urllib.request.Request(url, headers={'User-Agent': 'frameforge-sfx/1'})
    with urllib.request.urlopen(request, timeout=TIMEOUT * 3) as response, open(path, 'wb') as f:
        f.write(response.read())


def resolve(spec, entry, folder, tmp, synth, generation, manifest):
    """Write <folder>/<name>.wav for one entry and return its manifest record. `synth(preset, variant, length)` renders the fallback."""
    import score
    name, intent = entry['name'], entry.get('intent')
    source = entry.get('source', 'auto')
    key = entry_hash(entry, generation)
    prior = manifest.get(name)
    final = os.path.join(folder, name + '.wav')
    if prior and prior.get('hash') == key and os.path.exists(final):
        return prior
    length = entry.get('length') or (score.SFX[preset_for(entry)][1] if not intent else 3.0)
    record = {'hash': key, 'intent': intent, 'provider': None, 'fallback': None}
    raw = os.path.join(tmp, name + '.src')
    x = None
    if intent and source in ('auto', 'library'):
        try:
            pick = next((p for p in map(openverse, queries(entry)) if p), None)
            if pick:
                download(pick['url'], raw)
                x = decode(raw)
                record.update(provider='library', source=pick)
            else:
                record['fallback'] = 'library: no licensed match'
        except (urllib.error.URLError, subprocess.CalledProcessError, OSError, ValueError) as error:
            record['fallback'] = f'library unavailable: {error}'
    if x is None:
        preset = preset_for(entry)
        x = synth(preset, entry.get('variant', 1), entry.get('length') or score.SFX[preset][1])
        x = x if x.ndim == 2 else np.stack([x, x])
        record.update(provider='synth', preset=preset)
    x, trimmed = condition(x, length if intent else (entry.get('length') or score.SFX[preset_for(entry)][1]))
    record.update(onset_trim_ms=trimmed, seconds=round(x.shape[1] / score.SR, 3))
    dst = os.path.join(tmp, name + '.wav')
    score.write(dst, x, PEAK_DB)
    os.replace(dst, final)
    return record


def write_credits(folder, manifest):
    """CC BY sounds must be credited wherever the video is published; CC0 and synth need nothing."""
    lines = [f"- `{name}.wav`: {r['source'].get('attribution') or r['source'].get('title')} ({r['source'].get('landing')})"
             for name, r in sorted(manifest.items()) if r.get('provider') == 'library' and r['source'].get('license') == 'by']
    path = os.path.join(folder, 'CREDITS.md')
    if lines:
        with open(path, 'w') as f:
            f.write('# Sound effect credits\n\nThese sounds are CC BY: credit them wherever the video is published.\n\n' + '\n'.join(lines) + '\n')
    elif os.path.exists(path):
        os.remove(path)


if __name__ == '__main__':  # self-check: python3 scripts/assets/sfx.py
    import score
    assert preset_for({'name': 'x', 'intent': 'soft airy whoosh passing'}) == 'whoosh'
    assert preset_for({'name': 'x', 'intent': 'a warm bell chime'}) == 'ding'
    assert preset_for({'name': 'x', 'intent': 'nothing known'}) == 'pop'
    assert preset_for({'name': 'x', 'intent': 'whoosh', 'preset': 'click'}) == 'click'
    assert queries({'name': 'x', 'intent': 'soft bubble pop, a card landing'}) == ['soft bubble pop, a card landing', 'soft bubble pop', 'pop']
    assert queries({'name': 'x', 'preset': 'ding'}) == ['ding']
    silence, tone = np.zeros((2, score.SR // 2)), np.sin(2 * np.pi * 440 * np.arange(score.SR) / score.SR) * 0.5
    x, trimmed = condition(np.concatenate([silence, np.stack([tone, tone])], axis=1), 0.3)
    assert abs(trimmed - (500 - PRE_ROLL_S * 1000)) < 1 and x.shape[1] == int(0.3 * score.SR) and abs(x[0, -1]) < 1e-6, (trimmed, x.shape)
    import socket, tempfile, wave as _wave
    with socket.socket() as closed:  # a port nobody listens on: the library is unavailable, so the entry falls back to synth
        closed.bind(('127.0.0.1', 0))
        OPENVERSE_URL = f'http://127.0.0.1:{closed.getsockname()[1]}/v1/audio/'
    with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as tmp:
        tone = lambda preset, variant, length: np.sin(2 * np.pi * 440 * np.arange(int(length * score.SR)) / score.SR) * 0.5
        record = resolve({'seed': 1}, {'name': 'tap', 'intent': 'a short glass tap', 'length': 0.6}, folder, tmp, tone, 'v2', {})
        assert record['provider'] == 'synth' and record['preset'] == 'click' and record['fallback'].startswith('library unavailable'), record
        with _wave.open(os.path.join(folder, 'tap.wav')) as w:
            assert w.getnchannels() == 2 and w.getframerate() == 48000 and abs(w.getnframes() / 48000 - 0.6) < 0.01, w.getnframes()
    print('sfx self-check ok (synth rules, conditioning, offline library fallback to synth)')
