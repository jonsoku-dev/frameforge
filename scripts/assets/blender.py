"""Render the shots of a film's 3d.json with headless Blender into PNG sequences that <ImageSequence> plays.

  npm run blender -- examples/samples/<slug>/3d.json [--shot hero] [--frames 0-9] [--force]
  python3 scripts/assets/blender.py --self-check

3d.json sits next to the film's audio.json:
  {"slug", "shots": [{"name", "frames", "fps", "width", "height", "seed", "engine": eevee|cycles, "samples", "transparent",
    "camera": {"preset": turntable|orbit|dolly|static, "radius", "height", "fov", "from", "to"},
    "subject": {"kind": primitive|glb|script, "primitive": cube|sphere|torus|monkey|cylinder, "src", "script", "scale", "rotation"},
    "material": {"base", "metallic", "roughness", "emission"}, "light": {"preset": studio|sunset|hdri, "hdri", "strength"},
    "background": "#rrggbb"|"transparent", "shadowCatcher"}]}
`subject.src` and `light.hdri` are paths under public/assets/generated/<slug>/ (what models.py writes); `subject.script` is a
path next to 3d.json whose `build(scene, shot)` adds the subject and returns its object(s).
Output: public/assets/generated/<slug>/3d/<shot>/0000.png ... plus manifest.json {frames, fps, width, height, specHash,
blender, seconds, generation}. A shot whose manifest carries the same specHash and whose PNGs all exist is skipped;
--force renders again. specHash covers the shot, the script/model/HDRI file bytes and GENERATION.
Blender: BLENDER_PATH, `blender` on PATH, or the usual macOS/Linux install paths. The scene itself is built by
blender_scene.py, which lists the determinism settings."""
import glob, hashlib, json, os, re, shutil, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blender_scene as scene  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'assets', 'generated')
GENERATION = '3d-1'  # bump to re-render every shot
CANDIDATES = ('/opt/homebrew/bin/blender', '/Applications/Blender.app/Contents/MacOS/Blender', '/usr/bin/blender', '/snap/bin/blender')
HEX = re.compile(r'#[0-9a-fA-F]{6}')
NAME = re.compile(r'[a-z0-9][a-z0-9-]*')


def fail(where, message):
    print(f'{where}: {message}', file=sys.stderr)
    sys.exit(1)


def find_blender():
    return os.environ.get('BLENDER_PATH') or shutil.which('blender') or next((p for p in CANDIDATES if os.path.isfile(p)), None)


def validate(spec, path):
    need = lambda ok, message: ok or fail(path, message)
    need(isinstance(spec, dict) and NAME.fullmatch(str(spec.get('slug', ''))), 'slug must be lowercase letters, digits and dashes')
    need(isinstance(spec.get('shots'), list) and spec['shots'], 'shots must be a non-empty list')
    for shot in spec['shots']:
        need(isinstance(shot, dict) and NAME.fullmatch(str(shot.get('name', ''))), f'shot name must be lowercase letters, digits and dashes: {shot}')
        where = f"shot {shot['name']}"
        for key in ('frames', 'fps', 'width', 'height'):
            need(isinstance(shot.get(key), int) and shot[key] > 0, f'{where}: {key} must be a positive integer')
        need(shot.get('engine', 'eevee') in scene.ENGINES, f'{where}: engine must be eevee or cycles')
        need(shot.get('background', '#F4F4F1') == 'transparent' or HEX.fullmatch(str(shot.get('background', '#F4F4F1'))), f'{where}: background must be #rrggbb or transparent')
        camera, subject, light, material = (shot.get(k) or {} for k in ('camera', 'subject', 'light', 'material'))
        need(camera.get('preset', 'turntable') in scene.CAMERAS, f"{where}: camera.preset must be one of {', '.join(scene.CAMERAS)}")
        kind = subject.get('kind', 'primitive')
        need(kind in ('primitive', 'glb', 'script'), f'{where}: subject.kind must be primitive, glb or script')
        need(kind != 'primitive' or subject.get('primitive', 'torus') in scene.PRIMITIVES, f"{where}: subject.primitive must be one of {', '.join(scene.PRIMITIVES)}")
        need(kind != 'glb' or isinstance(subject.get('src'), str), f'{where}: subject.src is the model path under public/assets/generated/{spec["slug"]}/')
        need(kind != 'script' or isinstance(subject.get('script'), str), f'{where}: subject.script is a .py path next to 3d.json')
        need(light.get('preset', 'studio') in scene.LIGHTS, f"{where}: light.preset must be one of {', '.join(scene.LIGHTS)}")
        need(light.get('preset') != 'hdri' or isinstance(light.get('hdri'), str), f'{where}: light.hdri is the .hdr path under public/assets/generated/{spec["slug"]}/')
        need(HEX.fullmatch(str(material.get('base', '#2F5BFF'))), f'{where}: material.base must be #rrggbb')
    names = [shot['name'] for shot in spec['shots']]
    need(len(names) == len(set(names)), 'shot names must be unique')


def shot_files(spec, shot, spec_dir):
    """Files outside 3d.json that change the picture: the subject script, the model, the HDRI."""
    generated = os.path.join(OUT, spec['slug'])
    subject, light = shot.get('subject') or {}, shot.get('light') or {}
    paths = [os.path.join(spec_dir, subject['script'])] if subject.get('script') else []
    paths += [os.path.join(generated, subject['src'])] if subject.get('src') else []
    paths += [os.path.join(generated, light['hdri'])] if light.get('hdri') else []
    return paths


def spec_hash(shot, files):
    digest = hashlib.sha256((json.dumps(shot, sort_keys=True) + GENERATION).encode())
    for path in files:
        with open(path, 'rb') as f:
            digest.update(f.read())
    return digest.hexdigest()[:16]


def render_shot(spec, shot, spec_path, frames, force, blender):
    spec_dir = os.path.dirname(os.path.abspath(spec_path))
    out = os.path.join(OUT, spec['slug'], '3d', shot['name'])
    files = shot_files(spec, shot, spec_dir)
    for path in files:
        if not os.path.isfile(path):
            fail(spec_path, f"shot {shot['name']}: missing {os.path.relpath(path, ROOT)} (run npm run models for models and HDRIs)")
    key = spec_hash(shot, files)
    first, last = scene.frame_range(frames, shot['frames'])
    manifest_path = os.path.join(out, 'manifest.json')
    prior = json.load(open(manifest_path)) if os.path.isfile(manifest_path) else {}
    wanted = [os.path.join(out, f'{i:04d}.png') for i in range(first, last + 1)]
    if not force and prior.get('specHash') == key and all(os.path.isfile(p) for p in wanted):
        return {**prior, 'skipped': True}
    if blender is None:
        fail(spec_path, 'Blender not found: install Blender 4.2+ or set BLENDER_PATH to its executable')
    if prior.get('specHash') != key:
        for stale in glob.glob(os.path.join(out, '[0-9][0-9][0-9][0-9].png')):
            os.remove(stale)
    os.makedirs(out, exist_ok=True)
    began = time.time()
    run = subprocess.run([blender, '-b', '--factory-startup', '--python', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blender_scene.py'),
                         '--', os.path.abspath(spec_path), shot['name'], out, str(first), str(last)], capture_output=True, text=True)
    if run.returncode != 0 or not all(os.path.isfile(p) for p in wanted):
        tail = '\n'.join((run.stdout + '\n' + run.stderr).strip().splitlines()[-25:])
        fail(spec_path, f"shot {shot['name']}: Blender failed (exit {run.returncode})\n{tail}")
    version = next((line.split()[1] for line in run.stdout.splitlines() if line.startswith('Blender ')), 'unknown')
    manifest = {'frames': shot['frames'], 'fps': shot['fps'], 'width': shot['width'], 'height': shot['height'], 'specHash': key,
                'blender': version, 'seconds': round(time.time() - began, 1), 'generation': GENERATION}
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=1)
    return {**manifest, 'rendered': [first, last]}


def generate(path, only=None, frames=None, force=False):
    try:
        spec = json.load(open(path))
    except ValueError as error:
        fail(path, f'not JSON: {error}')
    validate(spec, path)
    shots = [s for s in spec['shots'] if only is None or s['name'] == only]
    if not shots:
        fail(path, f'no shot named {only}')
    try:
        for shot in shots:
            scene.frame_range(frames, shot['frames'])
    except ValueError as error:
        fail(path, str(error))
    blender = find_blender()
    results = {shot['name']: render_shot(spec, shot, path, frames, force, blender) for shot in shots}
    print(json.dumps({'slug': spec['slug'], 'shots': {name: {k: r[k] for k in r if k in ('frames', 'fps', 'width', 'height', 'specHash', 'blender', 'seconds', 'skipped', 'rendered')}
                                                        for name, r in results.items()}}))


def self_check():
    """Pure checks without Blender: colour conversion, camera geometry, frame ranges, validation and hashing."""
    import tempfile
    close = lambda a, b: all(abs(x - y) < 1e-6 for x, y in zip(a, b))
    assert scene.linear('#FFFFFF') == (1.0, 1.0, 1.0, 1.0) and scene.linear('#000000') == (0.0, 0.0, 0.0, 1.0)
    assert abs(scene.linear('#808080')[0] - 0.215861) < 1e-5
    cam = {**scene.DEFAULTS['camera'], 'radius': 4.0, 'height': 3.0}
    location, rotation = scene.camera_pose({**cam, 'preset': 'static'}, 0, 10)
    assert close(location, (0, -4, 3)) and close(rotation, (scene.math.pi / 2 - scene.math.atan2(3, 4), 0, 0)), (location, rotation)
    location, _ = scene.camera_pose(cam, 25, 100)  # a quarter turn of the turntable
    assert close(location, (4, 0, 3)), location
    assert not close(scene.camera_pose(cam, 99, 100)[0], scene.camera_pose(cam, 0, 100)[0]), 'turntable must not repeat frame 0 at the end'
    location, _ = scene.camera_pose({**cam, 'preset': 'orbit', 'from': 0, 'to': 180}, 9, 10)
    assert close(location, (0, 4, 3)), location
    location, _ = scene.camera_pose({**cam, 'preset': 'dolly', 'from': 8, 'to': 2}, 9, 10)
    assert close(location, (0, -2, 3)), location
    assert scene.frame_range(None, 10) == (0, 9) and scene.frame_range('2-5', 10) == (2, 5) and scene.frame_range('7', 10) == (7, 7)
    for bad in ('5-2', '0-10', '-1-3'):
        try:
            scene.frame_range(bad, 10)
            raise AssertionError(bad)
        except ValueError:
            pass
    merged = scene.merged({'name': 'x', 'camera': {'radius': 9}})
    assert merged['camera']['radius'] == 9 and merged['camera']['preset'] == 'turntable' and merged['material']['base'] == '#2F5BFF'
    shot = {'name': 'hero', 'frames': 2, 'fps': 30, 'width': 64, 'height': 36}
    with tempfile.TemporaryDirectory() as folder:
        script = os.path.join(folder, 'shot.py')
        open(script, 'w').write('def build(scene, shot): return None\n')
        before = spec_hash(shot, [script])
        assert before == spec_hash(dict(shot), [script]) and len(before) == 16
        open(script, 'a').write('# changed\n')
        assert spec_hash(shot, [script]) != before, 'the script bytes must be part of the hash'
        assert spec_hash({**shot, 'samples': 64}, []) != spec_hash(shot, [])
    good = {'slug': 'fixture', 'shots': [shot]}
    validate(good, 'fixture')
    for bad, message in (({'slug': 'Bad'}, 'slug'), ({'slug': 'ok', 'shots': []}, 'shots'), ({'slug': 'ok', 'shots': [{**shot, 'frames': 0}]}, 'frames'),
                         ({'slug': 'ok', 'shots': [{**shot, 'engine': 'octane'}]}, 'engine'), ({'slug': 'ok', 'shots': [{**shot, 'camera': {'preset': 'crane'}}]}, 'camera.preset'),
                         ({'slug': 'ok', 'shots': [{**shot, 'subject': {'kind': 'glb'}}]}, 'subject.src'), ({'slug': 'ok', 'shots': [shot, shot]}, 'unique'),
                         ({'slug': 'ok', 'shots': [{**shot, 'background': 'paper'}]}, 'background')):
        import contextlib, io
        try:
            with contextlib.redirect_stderr(io.StringIO()) as err:
                validate(bad, 'fixture')
            raise AssertionError(f'accepted {bad}')
        except SystemExit:
            assert message in err.getvalue(), (message, err.getvalue())
    print('blender self-check ok (linear colour, camera presets, frame ranges, defaults, spec hash, validation)')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--self-check']:
        self_check()
    elif args and not args[0].startswith('--'):
        options = {'--shot': None, '--frames': None}
        force = '--force' in args
        rest = [a for a in args[1:] if a != '--force']
        for flag in options:
            if flag in rest:
                at = rest.index(flag)
                options[flag] = rest[at + 1] if at + 1 < len(rest) else fail('blender.py', f'{flag} needs a value')
                del rest[at:at + 2]
        if rest:
            fail('blender.py', f'unknown arguments: {" ".join(rest)}')
        generate(args[0], options['--shot'], options['--frames'], force)
    else:
        fail('blender.py', 'usage: blender.py <3d.json> [--shot name] [--frames a-b] [--force] | --self-check')
