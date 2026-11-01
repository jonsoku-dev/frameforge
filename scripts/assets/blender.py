"""Render the shots of a film's 3d.json with headless Blender into PNG sequences that <ImageSequence> plays.

  npm run blender -- examples/samples/<slug>/3d.json [--shot hero] [--frames 0-9] [--force]
  npm run blender -- examples/samples/<slug>/3d.json --inspect [--shot hero]   numbers: objects, bounds, lights, framing, warnings
  npm run blender -- examples/samples/<slug>/3d.json --review [--shot hero]    the numbers plus <shot>/review.png, six angles
  python3 scripts/assets/blender.py --self-check

3d.json sits next to the film's audio.json:
  {"slug", "shots": [{"name", "frames", "fps", "width", "height", "seed", "engine": eevee|cycles, "samples", "transparent",
    "camera": {"preset": turntable|orbit|dolly|static, "radius", "height", "fov", "from", "to", "ease": linear|inout|out,
               "radiusTo", "heightTo", "target"},
    "subject": {"kind": builtin|primitive|glb|script, "builtin": head|bottle|gem|knot|plush, "detail", "primitive": cube|sphere|
                torus|monkey|cylinder, "src", "script", "scale", "rotation"},
    "look": glossy|glass|chrome|plush|toon|scanline|wireframe|holographic, "sweep": {"to": <look>, "from", "until"}, "bloom", "dof",
    "material": {"base", "metallic", "roughness", "emission", "accent", "trim", "lines", "width", "glow", "ior", "scroll",
                 "absorption", "density", "frost"},
    "light": {"preset": studio|sunset|hdri|three-point|product|rim, "hdri": <path or bundled name>, "rotate", "strength", "ratio", "environment"},
    "view": standard|agx|neutral, "motionBlur": <shutter in frames>, "denoise", "scatter": {...},
    "background": "#rrggbb"|"transparent", "shadowCatcher"}]}
subject also takes "scan" (false: the sculpted head instead of the CC0 scan), "ops", "keys", "ease", "liquid"; camera "fill".
A camera without "radius" is framed from the subject's bounds. Field reference: docs/reference/three-d.md.
`subject.src` and `light.hdri` are paths under public/assets/generated/<slug>/ (what models.py writes); `subject.script` is a
path next to 3d.json whose `build(scene, shot)` adds the subject and returns its object(s).
Output: public/assets/generated/<slug>/3d/<shot>/0000.png ... plus manifest.json {frames, fps, width, height, specHash,
blender, seconds, generation}. A shot whose manifest carries the same specHash and whose PNGs all exist is skipped;
--force renders again. specHash covers the shot, the script/model/HDRI file bytes, the blender_*.py builders and GENERATION.
Blender: BLENDER_PATH, `blender` on PATH, or the usual macOS/Linux install paths. The scene itself is built by
blender_scene.py, which lists the determinism settings."""
import glob, hashlib, json, os, re, shutil, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blender_scene as scene  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'assets', 'generated')
GENERATION = '3d-3'  # bump to re-render every shot
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
        need(kind in ('primitive', 'builtin', 'glb', 'script'), f'{where}: subject.kind must be primitive, builtin, glb or script')
        need(kind != 'primitive' or subject.get('primitive', 'torus') in scene.PRIMITIVES, f"{where}: subject.primitive must be one of {', '.join(scene.PRIMITIVES)}")
        need(kind != 'builtin' or subject.get('builtin', 'head') in scene.BUILTINS, f"{where}: subject.builtin must be one of {', '.join(scene.BUILTINS)}")
        need(isinstance(subject.get('detail', 256), int) and 64 <= subject.get('detail', 256) <= 512, f'{where}: subject.detail must be an integer 64-512')
        look, sweep = shot.get('look'), shot.get('sweep')
        need(look is None or look in scene.LOOKS, f"{where}: look must be one of {', '.join(scene.LOOKS)}")
        need(sweep is None or (look and isinstance(sweep, dict) and sweep.get('to') in scene.LOOKS and all(isinstance(sweep.get(k), int) for k in ('from', 'until'))
                               and 0 <= sweep['from'] < sweep['until'] < shot.get('frames', 0)),
             f'{where}: sweep needs a look and is {{"to": <look>, "from": <frame>, "until": <later frame inside the shot>}}')
        need('toon' not in (look, sweep and sweep.get('to')) or shot.get('engine', 'eevee') == 'eevee', f'{where}: the toon look is EEVEE only')
        need(camera.get('ease', 'linear') in scene.EASES, f"{where}: camera.ease must be one of {', '.join(scene.EASES)}")
        for key in ('bloom', 'dof'):
            need(shot.get(key) is None or (isinstance(shot[key], (int, float)) and shot[key] >= 0), f'{where}: {key} must be a number >= 0')
        for key in ('accent', 'trim'):
            need(HEX.fullmatch(str(material.get(key, '#000000'))), f'{where}: material.{key} must be #rrggbb')
        need(kind != 'glb' or isinstance(subject.get('src'), str), f'{where}: subject.src is the model path under public/assets/generated/{spec["slug"]}/')
        need(kind != 'script' or isinstance(subject.get('script'), str), f'{where}: subject.script is a .py path next to 3d.json')
        need(light.get('preset', 'studio') in scene.LIGHTS, f"{where}: light.preset must be one of {', '.join(scene.LIGHTS)}")
        need(light.get('ratio') is None or (isinstance(light['ratio'], list) and len(light['ratio']) == 3 and all(isinstance(v, (int, float)) and v >= 0 for v in light['ratio'])),
             f'{where}: light.ratio is [key, fill, rim], three numbers >= 0')
        need(shot.get('view', 'standard') in scene.VIEWS, f"{where}: view must be one of {', '.join(scene.VIEWS)}")
        need(shot.get('motionBlur') is None or (isinstance(shot['motionBlur'], (int, float)) and 0 < shot['motionBlur'] <= 2), f'{where}: motionBlur is the shutter in frames, above 0 and at most 2')
        need(camera.get('fill') is None or (isinstance(camera['fill'], (int, float)) and 0.1 <= camera['fill'] <= 1), f'{where}: camera.fill must be 0.1-1')
        need(all(isinstance(m.get(k, 0), (int, float)) for m in [material] for k in ('ior', 'density', 'frost', 'thickness')), f'{where}: material ior, density, frost and thickness are numbers')
        need(material.get('absorption') is None or HEX.fullmatch(str(material['absorption'])), f'{where}: material.absorption must be #rrggbb')
        ops = subject.get('ops', [])
        need(isinstance(ops, list) and all(isinstance(op, dict) and op.get('op') in scene.OPS and all(isinstance(v, (int, float)) for k, v in op.items() if k != 'op') for op in ops),
             f"{where}: subject.ops is a list of {{\"op\": {' | '.join(scene.OPS)}, <number fields>}}")
        keys = subject.get('keys', [])
        need(isinstance(keys, list) and all(isinstance(k, dict) and isinstance(k.get('frame'), int) and 0 <= k['frame'] < shot.get('frames', 0) for k in keys)
             and len({k['frame'] for k in keys}) == len(keys), f'{where}: subject.keys are {{"frame": <distinct frame inside the shot>, "location"?, "rotation"?, "scale"?}}')
        need(subject.get('ease', 'inout') in scene.EASES, f"{where}: subject.ease must be one of {', '.join(scene.EASES)}")
        liquid = subject.get('liquid')
        need(liquid is None or (isinstance(liquid, dict) and kind == 'builtin' and subject.get('builtin') == 'bottle' and HEX.fullmatch(str(liquid.get('colour', '#E8A23A')))
                                and isinstance(liquid.get('fill', 0.6), (int, float))), f'{where}: subject.liquid is for the builtin bottle: {{"fill": 0..1, "colour": "#rrggbb"}}')
        scatter = shot.get('scatter')
        need(scatter is None or (isinstance(scatter, dict) and scatter.get('shape', 'sphere') in scene.SCATTER_SHAPES and isinstance(scatter.get('count', 24), int)
                                 and 0 < scatter.get('count', 24) <= 2000 and scatter.get('material', 'trim') in ('trim', 'body')),
             f"{where}: scatter is {{count 1-2000, shape: {' | '.join(scene.SCATTER_SHAPES)}, size, radius, seed, spin, flatten, material: trim | body}}")
        need(light.get('preset') != 'hdri' or isinstance(light.get('hdri'), str), f'{where}: light.hdri is the .hdr path under public/assets/generated/{spec["slug"]}/')
        need(HEX.fullmatch(str(material.get('base', '#2F5BFF'))), f'{where}: material.base must be #rrggbb')
    names = [shot['name'] for shot in spec['shots']]
    need(len(names) == len(set(names)), 'shot names must be unique')


SCANS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scans', 'models.json')


def wants_scan(shot):
    subject = shot.get('subject') or {}
    return subject.get('kind') == 'builtin' and subject.get('builtin', 'head') == 'head' and subject.get('scan', True) is not False


def fetch_scan():
    """Fetches the CC0 scanned bust once (scans/models.json, pinned by scans/models.lock.json) into the shared
    public/assets/generated/frameforge-scans/; offline it says so and the sculpted head renders instead."""
    if os.path.isfile(os.path.join(OUT, scene.SCAN_FILE)):
        return True
    import contextlib, io, models
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()) as err:
            models.generate(SCANS)
    except SystemExit:
        print(f'scanned head unavailable ({err.getvalue().strip()}); rendering the sculpted head', file=sys.stderr)
    return os.path.isfile(os.path.join(OUT, scene.SCAN_FILE))


def shot_files(spec, shot, spec_dir):
    """Files outside 3d.json that change the picture: the subject script, the model, the scanned head, the HDRI."""
    generated = os.path.join(OUT, spec['slug'])
    subject, light = shot.get('subject') or {}, shot.get('light') or {}
    paths = [os.path.join(spec_dir, subject['script'])] if subject.get('script') else []
    scan = os.path.dirname(os.path.join(OUT, scene.SCAN_FILE))
    if wants_scan(shot) and os.path.isdir(scan):
        paths += sorted(os.path.join(folder, name) for folder, _, names in os.walk(scan) for name in names)
    paths += [os.path.join(generated, subject['src'])] if subject.get('src') else []
    paths += [os.path.join(generated, light['hdri'])] if light.get('hdri') and light['hdri'] not in scene.BUNDLED_HDRIS else []
    return paths


def spec_hash(shot, files):
    digest = hashlib.sha256((json.dumps(shot, sort_keys=True) + GENERATION).encode())
    # The scene builders are part of the picture too: editing a builtin mesh or a look re-renders without a GENERATION bump.
    here = os.path.dirname(os.path.abspath(__file__))
    for path in [os.path.join(here, f'blender_{part}.py') for part in ('scene', 'builtins', 'looks', 'studio')] + list(files):
        with open(path, 'rb') as f:
            digest.update(f.read())
    return digest.hexdigest()[:16]


def run_blender(blender, spec_path, shot, out, first, last, mode='render'):
    run = subprocess.run([blender, '-b', '--factory-startup', '--python-exit-code', '1', '--python', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blender_scene.py'),
                         '--', os.path.abspath(spec_path), shot['name'], out, str(first), str(last), mode], capture_output=True, text=True)
    if run.returncode != 0:
        tail = '\n'.join((run.stdout + '\n' + run.stderr).strip().splitlines()[-25:])
        fail(spec_path, f"shot {shot['name']}: Blender failed (exit {run.returncode})\n{tail}")
    return run


def tile(parts, columns, path):
    """Tiles same-sized PNGs into one sheet, `columns` wide, with ffmpeg's xstack."""
    ffmpeg = os.environ.get('FFMPEG_PATH') or shutil.which('ffmpeg') or fail('blender.py', 'ffmpeg not found: install it or set FFMPEG_PATH')
    layout = '|'.join(f"{'+'.join(['w0'] * (i % columns)) or '0'}_{'+'.join(['h0'] * (i // columns)) or '0'}" for i in range(len(parts)))
    inputs = [arg for part in parts for arg in ('-i', part)]
    run = subprocess.run([ffmpeg, '-y', '-loglevel', 'error', *inputs, '-filter_complex', f'xstack=inputs={len(parts)}:layout={layout}', path], capture_output=True, text=True)
    if run.returncode != 0:
        fail('blender.py', f'ffmpeg could not tile the review sheet: {run.stderr.strip()}')


def report_shot(spec, shot, spec_path, blender, mode):
    """--inspect writes and prints <shot>/inspect.json; --review also renders REVIEW_VIEWS and tiles them into review.png."""
    if blender is None:
        fail(spec_path, 'Blender not found: install Blender 4.2+ or set BLENDER_PATH to its executable')
    if wants_scan(shot):
        fetch_scan()
    out = os.path.join(OUT, spec['slug'], '3d', shot['name'])
    os.makedirs(out, exist_ok=True)
    run_blender(blender, spec_path, shot, out, 0, 0, 'inspect')
    report = json.load(open(os.path.join(out, 'inspect.json')))
    if mode == 'review':
        run_blender(blender, spec_path, shot, out, 0, 0, 'review')
        parts = [os.path.join(out, f'review-{i}.png') for i in range(len(scene.REVIEW_VIEWS))]
        tile(parts, 3, os.path.join(out, 'review.png'))
        for part in parts:
            os.remove(part)
        report['review'] = {'sheet': os.path.relpath(os.path.join(out, 'review.png'), ROOT), 'views': [label for label, _, _ in scene.REVIEW_VIEWS], 'columns': 3}
    return report


def render_shot(spec, shot, spec_path, frames, force, blender):
    spec_dir = os.path.dirname(os.path.abspath(spec_path))
    out = os.path.join(OUT, spec['slug'], '3d', shot['name'])
    scanned = wants_scan(shot) and (os.path.isfile(os.path.join(OUT, scene.SCAN_FILE)) or (blender is not None and fetch_scan()))
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
    run = run_blender(blender, spec_path, shot, out, first, last)
    if not all(os.path.isfile(p) for p in wanted):
        fail(spec_path, f"shot {shot['name']}: Blender wrote no frames\n{(run.stdout + chr(10) + run.stderr)[-2000:]}")
    version = next((line.split()[1] for line in run.stdout.splitlines() if line.startswith('Blender ')), 'unknown')
    manifest = {'frames': shot['frames'], 'fps': shot['fps'], 'width': shot['width'], 'height': shot['height'], 'specHash': key,
                'blender': version, 'seconds': round(time.time() - began, 1), 'generation': GENERATION,
                'subject': 'scan' if scanned else (shot.get('subject') or {}).get('kind', 'primitive')}
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=1)
    return {**manifest, 'rendered': [first, last]}


def generate(path, only=None, frames=None, force=False, mode='render'):
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
    if mode != 'render':
        print(json.dumps({'slug': spec['slug'], 'shots': {shot['name']: report_shot(spec, shot, path, blender, mode) for shot in shots}}, indent=1))
        return
    results = {shot['name']: render_shot(spec, shot, path, frames, force, blender) for shot in shots}
    print(json.dumps({'slug': spec['slug'], 'shots': {name: {k: r[k] for k in r if k in ('frames', 'fps', 'width', 'height', 'specHash', 'blender', 'seconds', 'skipped', 'rendered', 'subject')}
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
    assert close(scene.camera_pose({**cam, 'preset': 'dolly'}, 9, 10)[0], (0, -4, 3)), 'a dolly without from/to stays at radius'
    assert scene.ease(0.5, 'inout') == 0.5 and scene.ease(0.25, 'inout') < 0.25 and scene.ease(0.25, 'out') > 0.25 and scene.ease(1, 'out') == 1
    location, _ = scene.camera_pose({**cam, 'preset': 'static', 'radiusTo': 2.0, 'heightTo': 1.0}, 9, 10)  # push-in and crane
    assert close(location, (0, -2, 1)), location
    location, _ = scene.camera_pose({**cam, 'preset': 'orbit', 'from': 0, 'to': 90, 'ease': 'inout', 'radiusTo': 2.0}, 2, 5)  # halfway
    assert close(location, (3 * scene.math.sin(scene.math.pi / 4), -3 * scene.math.cos(scene.math.pi / 4), 3)), location
    _, rotation = scene.camera_pose({**cam, 'preset': 'static', 'target': 3.0}, 0, 10)
    assert close(rotation, (scene.math.pi / 2, 0, 0)), 'a camera level with its target looks straight ahead'
    sweep = {'from': 10, 'until': 20}
    assert scene.sweep_level(sweep, 0, -1, 1) < -1 < 1 < scene.sweep_level(sweep, 30, -1, 1) and abs(scene.sweep_level(sweep, 15, -1, 1)) < 1e-9
    assert scene.frame_range(None, 10) == (0, 9) and scene.frame_range('2-5', 10) == (2, 5) and scene.frame_range('7', 10) == (7, 7)
    for bad in ('5-2', '0-10', '-1-3'):
        try:
            scene.frame_range(bad, 10)
            raise AssertionError(bad)
        except ValueError:
            pass
    merged = scene.merged({'name': 'x', 'camera': {'radius': 9}})
    assert merged['camera']['radius'] == 9 and merged['camera']['preset'] == 'turntable' and merged['material']['base'] == '#2F5BFF'
    assert scene.merged({'name': 'x', 'subject': {'kind': 'glb', 'src': 'm.gltf'}})['material'] is None, 'a model keeps its own materials'
    hero = scene.merged({'name': 'x', 'subject': {'kind': 'builtin', 'builtin': 'head'}, 'material': {'accent': '#FF0000'}})
    assert hero['look'] == 'glossy' and hero['material']['accent'] == '#FF0000' and hero['material']['lines'] == 36.0 and hero['bloom'] == scene.BLOOM
    assert scene.merged({'name': 'x'})['bloom'] == 0.0, 'a shot without a look gets no compositor'
    assert scene.merged({'name': 'x', 'subject': {'kind': 'glb', 'src': 'm.gltf'}, 'material': {'base': '#000000'}})['material']['roughness'] == 0.35
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
                         ({'slug': 'ok', 'shots': [{**shot, 'background': 'paper'}]}, 'background'),
                         ({'slug': 'ok', 'shots': [{**shot, 'subject': {'kind': 'builtin', 'builtin': 'robot'}}]}, 'subject.builtin'),
                         ({'slug': 'ok', 'shots': [{**shot, 'look': 'matte'}]}, 'look must be'),
                         ({'slug': 'ok', 'shots': [{**shot, 'look': 'scanline', 'sweep': {'to': 'glossy', 'from': 0, 'until': 5}}]}, 'sweep'),
                         ({'slug': 'ok', 'shots': [{**shot, 'sweep': {'to': 'glossy', 'from': 0, 'until': 1}}]}, 'sweep'),
                         ({'slug': 'ok', 'shots': [{**shot, 'engine': 'cycles', 'look': 'toon'}]}, 'EEVEE only'),
                         ({'slug': 'ok', 'shots': [{**shot, 'camera': {'ease': 'bounce'}}]}, 'camera.ease'),
                         ({'slug': 'ok', 'shots': [{**shot, 'bloom': -1}]}, 'bloom')):
        import contextlib, io
        try:
            with contextlib.redirect_stderr(io.StringIO()) as err:
                validate(bad, 'fixture')
            raise AssertionError(f'accepted {bad}')
        except SystemExit:
            assert message in err.getvalue(), (message, err.getvalue())
    validate({'slug': 'ok', 'shots': [{**shot, 'subject': {'kind': 'builtin', 'builtin': 'gem'}, 'look': 'scanline', 'sweep': {'to': 'glossy', 'from': 0, 'until': 1}}]}, 'fixture')
    # Studio additions: view names, light ratios by subject, keyed subject pose, projection and auto-framing.
    assert scene.VIEWS['neutral'] == 'Khronos PBR Neutral' and scene.merged({'name': 'x'})['view'] == 'standard'
    assert scene.light_ratio(scene.merged({'name': 'x', 'look': 'glass'})) == scene.RATIOS['glass']
    assert scene.light_ratio(scene.merged({'name': 'x', 'subject': {'kind': 'builtin', 'builtin': 'head'}})) == scene.RATIOS['organic']
    assert scene.light_ratio(scene.merged({'name': 'x', 'light': {'ratio': [1, 0, 2]}})) == (1.0, 0.0, 2.0)
    keyed = {'keys': [{'frame': 10, 'rotation': [0, 0, 90], 'scale': 2}, {'frame': 20, 'rotation': [0, 0, 180]}], 'ease': 'linear'}
    assert scene.subject_pose({}, 5) == ([0.0, 0.0, 0.0], [0.0, 0.0, 0.0], 1.0)
    assert scene.subject_pose(keyed, 0)[1] == [0, 0, 90] and scene.subject_pose(keyed, 15)[1] == [0, 0, 135.0] and scene.subject_pose(keyed, 15)[2] == 1.5
    assert scene.subject_pose(keyed, 30)[1] == [0, 0, 180] and scene.subject_pose(keyed, 30)[2] == 1.0, 'after the last key it holds'
    assert close(scene.rotate((1, 0, 0), (0, 0, 90)), (0, 1, 0)) and close(scene.rotate((0, 1, 0), (90, 0, 0)), (0, 0, 1))
    swept = scene.moving_bounds({'frames': 21, 'subject': {'keys': [{'frame': 0}, {'frame': 20, 'location': [3, 0, 0]}]}}, [-1, -1, -1], [1, 1, 1])
    assert close(swept[0], (-1, -1, -1)) and close(swept[1], (4, 1, 1)), swept
    assert close(scene.project((0, 0, 0), (0, -5, 0), (0, 0, 0), 90, 16 / 9), (0, 0)) and scene.project((0, -9, 0), (0, -5, 0), (0, 0, 0), 90, 1) is None
    assert close(scene.project((5, 0, 0), (0, -5, 0), (0, 0, 0), 90, 1), (1, 0)), 'a point at 45 degrees lands on the edge of a 90-degree frame'
    fitted = scene.fit_camera({**scene.DEFAULTS['camera'], 'preset': 'static', 'elevation': 10.0}, [-1, -1, -1], [1, 1, 1], 1, 16 / 9, 0.8)
    corners = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    assert abs(scene.frame_extent(fitted, corners, 1, 16 / 9) - 0.8) < 1e-3 and fitted['target'] == 0
    assert abs(fitted['height'] - fitted['radius'] * scene.math.tan(scene.math.radians(10))) < 1e-9
    assert scene.merged({'name': 'x', 'camera': {'preset': 'orbit'}})['camera']['fit'] and not scene.merged({'name': 'x', 'camera': {'radius': 5}})['camera']['fit']
    assert not scene.merged({'name': 'x', 'camera': {'preset': 'dolly'}})['camera']['fit'], 'dolly radii are explicit'
    assert wants_scan({'subject': {'kind': 'builtin'}}) and not wants_scan({'subject': {'kind': 'builtin', 'builtin': 'head', 'scan': False}})
    for bad, message in (({**shot, 'view': 'filmic'}, 'view must be'), ({**shot, 'light': {'ratio': [1, 2]}}, 'light.ratio'),
                         ({**shot, 'subject': {'ops': [{'op': 'melt'}]}}, 'subject.ops'), ({**shot, 'subject': {'keys': [{'frame': 9}]}}, 'subject.keys'),
                         ({**shot, 'subject': {'kind': 'builtin', 'builtin': 'gem', 'liquid': {}}}, 'subject.liquid'),
                         ({**shot, 'scatter': {'shape': 'star'}}, 'scatter is'), ({**shot, 'motionBlur': 5}, 'motionBlur')):
        try:
            with contextlib.redirect_stderr(io.StringIO()) as err:
                validate({'slug': 'ok', 'shots': [bad]}, 'fixture')
            raise AssertionError(f'accepted {bad}')
        except SystemExit:
            assert message in err.getvalue(), (message, err.getvalue())
    validate({'slug': 'ok', 'shots': [{**shot, 'view': 'agx', 'motionBlur': 0.5, 'light': {'preset': 'product', 'ratio': [1, 0.5, 0.4]},
                                       'subject': {'kind': 'builtin', 'builtin': 'bottle', 'liquid': {'fill': 0.5}, 'ops': [{'op': 'bevel', 'width': 0.01}],
                                                   'keys': [{'frame': 0}, {'frame': 1, 'rotation': [0, 0, 30]}]},
                                       'scatter': {'count': 10, 'shape': 'gem'}, 'look': 'glass', 'material': {'absorption': '#88CCAA'}}]}, 'fixture')
    print('blender self-check ok (linear colour, camera presets, push-in, crane, easing, sweep level, defaults, spec hash, validation, views, light ratios, subject keys, projection, auto-framing)')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--self-check']:
        self_check()
    elif args and not args[0].startswith('--'):
        options = {'--shot': None, '--frames': None}
        force = '--force' in args
        mode = 'review' if '--review' in args else 'inspect' if '--inspect' in args else 'render'
        rest = [a for a in args[1:] if a not in ('--force', '--inspect', '--review')]
        for flag in options:
            if flag in rest:
                at = rest.index(flag)
                options[flag] = rest[at + 1] if at + 1 < len(rest) else fail('blender.py', f'{flag} needs a value')
                del rest[at:at + 2]
        if rest:
            fail('blender.py', f'unknown arguments: {" ".join(rest)}')
        generate(args[0], options['--shot'], options['--frames'], force, mode)
    else:
        fail('blender.py', 'usage: blender.py <3d.json> [--shot name] [--frames a-b] [--force] [--inspect | --review] | --self-check')
