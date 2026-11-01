"""Speak a film's narration lines and measure them, so scene timing can follow the voice.

Usage: python3 scripts/assets/voice.py [--force] examples/samples/<slug>/narration.json | --self-check
Reads the spec, resolves one provider for the run, speaks each line once (hash cache), trims silence, measures with
ffprobe, concatenates with the gaps into public/audio/generated/<slug>/voice.wav (48 kHz stereo, -16 LUFS) and writes
examples/samples/<slug>/narration.timing.json, the small file the Spot imports. Format and policy: docs/reference/voice.md.

Providers, in `auto` order (a spec's voice.provider pins one):
  kokoro      the kokoro_onnx package (pip install kokoro-onnx) with model files; English and Japanese only
  say         macOS speech (Yuna for ko, Kyoko for ja, Samantha for en); absent on Linux
  silent      silence as long as the text would take to read; lines are marked estimated
"""
import hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, wave
import numpy as np
import score, sfx
from audio_guard import require_local_output

ROOT, SR, OUT = score.ROOT, score.SR, score.OUT
FFPROBE = os.environ.get('FFPROBE_PATH') or os.environ.get('FFPROBE', 'ffprobe')
GENERATION = 'v1'  # part of every line hash; raising it regenerates every voice
TRIM_DB, PAD_S = -45, 0.06
PEAK_DB, TARGET_I, TARGET_TP = -3, -16, -3
LANGUAGES = ('ko', 'en', 'ja')
PROVIDERS = ('auto', 'kokoro', 'say', 'silent')
SAY_VOICES = {'ko': 'Yuna', 'ja': 'Kyoko', 'en': 'Samantha'}
KOKORO = {'en': ('en-us', 'af_sarah'), 'ja': ('ja', 'jf_alpha')}
KOKORO_MODEL = os.environ.get('KOKORO_MODEL', os.path.expanduser('~/.cache/frameforge/kokoro/kokoro-v1.0.onnx'))
KOKORO_VOICES = os.environ.get('KOKORO_VOICES', os.path.expanduser('~/.cache/frameforge/kokoro/voices-v1.0.bin'))
SYLLABLE = re.compile('[가-힣]')  # the same class narration-check.mjs counts
KANA_KANJI = re.compile('[぀-ヿ一-鿿]')


def fail(msg):
    print(f'voice.py: {msg}', file=sys.stderr)
    sys.exit(1)


def estimate_ms(text, language):
    """Reading time of silent lines: Korean 5 syllables/s, English 2.5 words/s, Japanese 6 characters/s; at least 300 ms."""
    units = {'ko': lambda: len(SYLLABLE.findall(text)) / 5, 'en': lambda: len(text.split()) / 2.5, 'ja': lambda: len(KANA_KANJI.findall(text)) / 6}[language]()
    return max(300, int(round(units * 1000)))


def validate(spec, path):
    need = lambda ok, msg: ok or fail(f'{path}: {msg}')
    folder = os.path.basename(os.path.dirname(os.path.abspath(path)))
    need(spec.get('slug') == folder, f"slug must equal the folder name '{folder}'")
    need(spec.get('language') in LANGUAGES, f'language must be one of {", ".join(LANGUAGES)}')
    voice = spec.get('voice', {})
    need(isinstance(voice, dict) and voice.get('provider', 'auto') in PROVIDERS, f'voice.provider must be one of {", ".join(PROVIDERS)}')
    need(voice.get('name') is None or isinstance(voice['name'], str), 'voice.name must be a string')
    need(spec.get('rate') is None or (isinstance(spec['rate'], (int, float)) and 0.5 <= spec['rate'] <= 2), 'rate is a speed multiplier between 0.5 and 2')
    for key in ('gapMs', 'leadMs'):
        need(isinstance(spec.get(key, 0), int) and spec.get(key, 0) >= 0, f'{key} must be a nonnegative integer')
    lines = spec.get('lines')
    need(isinstance(lines, list) and lines, 'lines must be a nonempty list')
    seen = set()
    for i, line in enumerate(lines):
        need(isinstance(line, dict) and re.fullmatch(r'[a-z][a-z0-9-]*', str(line.get('id', ''))), f'lines[{i}].id must be a lowercase slug')
        need(line['id'] not in seen, f"lines[{i}].id '{line['id']}' repeats")
        seen.add(line['id'])
        need(isinstance(line.get('text'), str) and line['text'].strip(), f'lines[{i}].text must be nonempty')
        need(isinstance(line.get('pauseMs', 0), int) and line.get('pauseMs', 0) >= 0, f'lines[{i}].pauseMs must be a nonnegative integer')
        need(all(isinstance(w, str) and w in line['text'] for w in line.get('emphasis', [])), f'lines[{i}].emphasis words must appear in the text')
        embed = line.get('embed')
        need(embed is None or (isinstance(embed, str) and ' ' not in embed and embed in line['text']), f'lines[{i}].embed must be one word from the text')


def availability(language):
    """Why each provider can or cannot run here. A missing reason means it can."""
    out = {'say': None if shutil.which('say') else 'say is macOS only', 'silent': None}
    try:
        import kokoro_onnx  # noqa: F401
        if language not in KOKORO:
            out['kokoro'] = f'kokoro speaks en and ja, not {language}'
        elif not (os.path.exists(KOKORO_MODEL) and os.path.exists(KOKORO_VOICES)):
            out['kokoro'] = f'download kokoro-v1.0.onnx and voices-v1.0.bin from the kokoro-onnx releases to {os.path.dirname(KOKORO_MODEL)} (or set KOKORO_MODEL and KOKORO_VOICES)'
        else:
            out['kokoro'] = None
    except ImportError:
        out['kokoro'] = 'pip install kokoro-onnx (then download its model files)'
    return out


def pick(spec):
    """The provider and voice name for this run plus the reasons the earlier tiers were skipped."""
    wanted = spec.get('voice', {}).get('provider', 'auto')
    reasons = availability(spec['language'])
    order = ['kokoro', 'say', 'silent'] if wanted == 'auto' else [wanted]
    provider = next((p for p in order if reasons[p] is None), None)
    if provider is None:
        fail(f"voice.provider '{wanted}' cannot run here: {reasons[wanted]}")
    name = spec.get('voice', {}).get('name')
    default = {'kokoro': KOKORO.get(spec['language'], ('', ''))[1], 'say': SAY_VOICES[spec['language']], 'silent': 'silent'}[provider]
    return provider, name or default, {p: reasons[p] for p in order[:order.index(provider)]}


def speak(provider, voice, language, rate, text, tmp):
    """One line as float stereo at 48 kHz, before trimming."""
    raw = os.path.join(tmp, 'line.raw')
    if provider == 'silent':
        return np.zeros((2, estimate_ms(text, language) * SR // 1000))
    if provider == 'say':
        subprocess.run(['say', '-v', voice, '-o', raw + '.wav', '--data-format=LEF32@48000', *(['-r', str(round(180 * rate))] if rate else []), text], check=True)
        return sfx.decode(raw + '.wav')
    from kokoro_onnx import Kokoro
    samples, sr = Kokoro(KOKORO_MODEL, KOKORO_VOICES).create(text, voice=voice, speed=rate or 1.0, lang=KOKORO[language][0])
    with wave.open(raw + '.wav', 'wb') as f:
        f.setnchannels(1), f.setsampwidth(2), f.setframerate(sr)
        f.writeframes(np.round(np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes())
    return sfx.decode(raw + '.wav')


def trim(x):
    """Cut leading and trailing silence below TRIM_DB, keeping PAD_S on each side."""
    above = np.flatnonzero(np.abs(x).max(axis=0) > 10 ** (TRIM_DB / 20))
    if not len(above):
        raise ValueError('the provider returned silence')
    pad = int(PAD_S * SR)
    return x[:, max(0, above[0] - pad):above[-1] + 1 + pad]


def write_wav(path, x):
    with wave.open(path, 'wb') as f:
        f.setnchannels(2), f.setsampwidth(2), f.setframerate(SR)
        f.writeframes(np.round(np.clip(x, -1, 1).T * 32767).astype('<i2').tobytes())


def probe_ms(path):
    out = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout
    return int(round(float(out) * 1000))


def line_hash(provider, voice, language, rate, text):
    return hashlib.sha256(json.dumps([provider, voice, language, rate, text, GENERATION]).encode()).hexdigest()[:16]


def generate(path, force, out_root=OUT):
    require_local_output(ROOT, path, os.path.realpath(out_root) == os.path.realpath(OUT))
    began = time.time()
    with open(path, 'rb') as f:
        try:
            spec = json.loads(f.read())
        except ValueError as error:
            fail(f'{path}: not JSON: {error}')
    validate(spec, path)
    provider, voice, skipped = pick(spec)
    language, rate = spec['language'], spec.get('rate')
    folder = os.path.join(out_root, spec['slug'], 'voice')
    os.makedirs(folder, exist_ok=True)
    pieces, lines, cached = [], [], 0
    cursor = spec.get('leadMs', 0)
    with tempfile.TemporaryDirectory(dir=folder, prefix='.tmp-') as tmp:
        for line in spec['lines']:
            key = line_hash(provider, voice, language, rate, line['text'])
            cache = os.path.join(folder, key + '.wav')
            if force or not os.path.exists(cache):
                try:
                    x = speak(provider, voice, language, rate, line['text'], tmp)
                except (subprocess.CalledProcessError, OSError, ValueError) as error:
                    fail(f"{path}: line '{line['id']}' failed on {provider}: {error}")
                if provider != 'silent':
                    try:
                        x = trim(x)
                    except ValueError as error:
                        fail(f"{path}: line '{line['id']}' on {provider}: {error}")
                    x = x * (10 ** (PEAK_DB / 20) / np.abs(x).max())
                write_wav(os.path.join(tmp, key), x)
                os.replace(os.path.join(tmp, key), cache)
            else:
                cached += 1
            ms = probe_ms(cache)
            x = sfx.decode(cache)
            pieces.append(np.zeros((2, max(0, cursor * SR // 1000 - sum(p.shape[1] for p in pieces)))))  # silence up to this line's start
            pieces.append(x)
            record = {'id': line['id'], 'text': line['text'], 'startMs': cursor, 'endMs': cursor + ms, 'estimated': provider == 'silent'}
            record.update({k: line[k] for k in ('emphasis', 'embed') if k in line})
            lines.append(record)
            cursor += ms + line.get('pauseMs', spec.get('gapMs', 400))
        total_ms = lines[-1]['endMs']
        mix = np.concatenate(pieces, axis=1)[:, :total_ms * SR // 1000]
        mix = np.pad(mix, ((0, 0), (0, total_ms * SR // 1000 - mix.shape[1])))
        final = os.path.join(out_root, spec['slug'], 'voice.wav')
        src, out = os.path.join(tmp, 'raw.wav'), os.path.join(tmp, 'voice.wav')
        loudness = {}
        if np.abs(mix).max() > 0:
            write_wav(src, mix * (10 ** (PEAK_DB / 20) / np.abs(mix).max()))
            linear = score.normalize(src, out, TARGET_I, TARGET_TP)
            score.exact_length(out, mix.shape[1])
            m = score.loudnorm(out, TARGET_I, TARGET_TP)
            loudness = {'I': float(m['input_i']), 'TP': float(m['input_tp']), 'linear': linear}
        else:
            write_wav(out, mix)
        os.replace(out, final)
    timing = {'slug': spec['slug'], 'provider': provider, 'voice': voice, 'totalMs': total_ms, 'lines': lines}
    with open(os.path.join(os.path.dirname(os.path.abspath(path)), 'narration.timing.json'), 'w') as f:
        json.dump(timing, f, indent=2, ensure_ascii=False)
        f.write('\n')
    with open(os.path.join(folder, 'manifest.json'), 'w') as f:
        json.dump({'provider': provider, 'voice': voice, 'skipped': skipped, 'loudness': loudness, 'lines': {l['id']: l['endMs'] - l['startMs'] for l in lines}}, f, indent=1, ensure_ascii=False)
    for name in os.listdir(folder):  # drop cache entries no line uses any more
        if name.endswith('.wav') and name[:-4] not in {line_hash(provider, voice, language, rate, l['text']) for l in spec['lines']}:
            os.remove(os.path.join(folder, name))
    print(json.dumps({'slug': spec['slug'], 'provider': provider, 'voice': voice, 'skipped': skipped, 'totalMs': total_ms, 'lines': len(lines), 'cached': cached, **loudness, 'seconds': round(time.time() - began, 2)}, ensure_ascii=False))
    return timing


def self_check():
    assert estimate_ms('안녕하세요 반갑습니다', 'ko') == 2000 and estimate_ms('one two three four five', 'en') == 2000 and estimate_ms('これは例です', 'ja') == 1000
    assert estimate_ms('!', 'ko') == 300
    assert line_hash('say', 'Yuna', 'ko', None, 'a') != line_hash('say', 'Yuna', 'ko', None, 'b')
    tone = np.sin(2 * np.pi * 440 * np.arange(SR) / SR) * 0.5
    x = trim(np.concatenate([np.zeros((2, SR // 2)), np.stack([tone, tone]), np.zeros((2, SR // 4))], axis=1))
    assert abs(x.shape[1] - (SR + 2 * int(PAD_S * SR))) <= 2, x.shape
    with tempfile.TemporaryDirectory() as root:
        folder = os.path.join(root, 'films', 'check')
        os.makedirs(folder)
        spec = {'slug': 'check', 'language': 'ko', 'voice': {'provider': 'silent'}, 'leadMs': 500, 'gapMs': 300,
                'lines': [{'id': 'a', 'text': '안녕하세요 반갑습니다', 'emphasis': ['반갑습니다'], 'embed': '반갑습니다'}, {'id': 'b', 'text': '둘째 줄입니다', 'pauseMs': 900}, {'id': 'c', 'text': '셋째 줄'}]}
        path = os.path.join(folder, 'narration.json')
        json.dump(spec, open(path, 'w'), ensure_ascii=False)
        out = os.path.join(root, 'generated')
        t = generate(path, False, out)
        a, b, c = t['lines']
        assert a['startMs'] == 500 and a['endMs'] == 2500 and a['estimated'] and a['embed'] == '반갑습니다', a
        assert b['startMs'] == a['endMs'] + 300 and c['startMs'] == b['endMs'] + 900 and t['totalMs'] == c['endMs'], t
        with wave.open(os.path.join(out, 'check', 'voice.wav')) as w:
            assert w.getnchannels() == 2 and w.getframerate() == SR and w.getnframes() == t['totalMs'] * SR // 1000, w.getnframes()
        assert probe_ms(os.path.join(out, 'check', 'voice.wav')) == t['totalMs']
        assert json.load(open(os.path.join(folder, 'narration.timing.json'))) == t
        again = json.loads(subprocess.run([sys.executable, os.path.abspath(__file__), path, '--out', out], capture_output=True, text=True, check=True).stdout)
        assert again['cached'] == 3 and again['totalMs'] == t['totalMs'], again
        assert json.loads(subprocess.run([sys.executable, os.path.abspath(__file__), '--force', path, '--out', out], capture_output=True, text=True, check=True).stdout)['cached'] == 0
        bad = subprocess.run([sys.executable, os.path.abspath(__file__), os.path.join(root, 'missing.json')], capture_output=True, text=True)
        assert bad.returncode == 1 and 'voice.py:' in bad.stderr
    print('voice self-check ok (estimates, hash, trim, silent provider timings, voice.wav length, cache hits, --force, bad path)')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--self-check']:
        self_check()
        sys.exit(0)
    out_root = OUT
    if '--out' in args:  # self-check only: keep generated files out of public/
        i = args.index('--out')
        out_root = args[i + 1]
        del args[i:i + 2]
    force = '--force' in args
    paths = [a for a in args if a != '--force']
    if len(paths) != 1 or not os.path.exists(paths[0]):
        fail('usage: voice.py [--force] examples/samples/<slug>/narration.json | --self-check')
    generate(paths[0], force, out_root)
