"""Resolve the illustrations of a film's assets.json into sanitized SVG files: handed over by the host agent, drawn by an image
command, fetched from a CC0 library, or mapped to the motif kit.

assets.json sits next to the film's audio.json:
  {"slug", "palette": {"ink", "accent", "soft", "paper"},
   "assets": [{"name", "intent", "source"?: auto|host|image-command|library|kit, "recolor"?: true, "file"?: "path"}]}
Providers, in order (an entry's `source` pins one; `auto` tries them in this order):
  host           a file the host agent (Claude, Codex, Cursor, Grok Build...) made with its own image tool and placed at
                 public/assets/generated/<slug>/<name>.svg|.png|.webp, or named in the entry's `file`. SVG is sanitized
                 (its original bytes are kept under <slug>/.host/ first, so the host's file is never lost); PNG/WebP is
                 taken as a raster asset as is (width and height recorded, no recolor). Hand-over: place the file, run `npm run art`.
  image-command  FRAMEFORGE_IMAGE_COMMAND, a shell template with {prompt} and optional {out}; the first PNG is {out} or the
                 first entry of `paths` in the JSON it prints. vtracer traces it to SVG (flat preset); without vtracer the PNG stays raster.
  library        Openverse images (https://api.openverse.org/v1/images/, no key), CC0 SVG only, Wikimedia Commons preferred
  kit            a component of src/assets (`import {Cup} from '@/assets'`); no file is written
Every SVG is sanitized (no script, foreignObject, foreign namespaces, event attributes, external references) and given a
viewBox; `recolor` maps its colours onto the palette. Output: public/assets/generated/<slug>/<name>.svg (or .png) plus
assets.json (the manifest that pins each choice by hash) and CREDITS.md when a pick needs attribution. A provider that fails
falls through to the next and the manifest says why.
"""
import colorsys, hashlib, json, os, re, shlex, shutil, subprocess, sys, tempfile, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'assets', 'generated')
OPENVERSE_URL = os.environ.get('OPENVERSE_URL', 'https://api.openverse.org/v1/images/')
GENERATION = 'art-1'  # bump to invalidate every resolved asset
TIMEOUT = 20
FFMPEG = os.environ.get('FFMPEG_PATH', 'ffmpeg')
FFPROBE = os.environ.get('FFPROBE_PATH', 'ffprobe')
HOST_TYPES = ('.svg', '.png', '.webp')
VTRACER = '0.6.15'
IMAGE_PROMPT = 'flat vector illustration, single object, centered, plain white background, no text, thick uniform outlines, limited palette'
MAX_SVG_BYTES = 3_000_000
SOURCES = ('auto', 'host', 'image-command', 'library', 'kit')
SLOTS = ('ink', 'accent', 'soft', 'paper')
# Same thresholds as paletteSlot in src/core/art.tsx.
PAPER_L, ACCENT_S, ACCENT_L, INK_L = 0.92, 0.35, (0.15, 0.85), 0.4
SVG_NS, XLINK_NS = 'http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink'
XML_NS = 'http://www.w3.org/XML/1998/namespace'
ET.register_namespace('', SVG_NS)
ET.register_namespace('xlink', XLINK_NS)
COLOR = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|\b(?:black|white)\b')
PAINT = re.compile(r'((?:fill|stroke|stop-color)\s*(?:=\s*["\']|:\s*))(' + COLOR.pattern + ')', re.I)
clean = lambda s: re.sub(r'[\x00-\x1f`\[\]<>\\]+', ' ', str(s or '')).strip()[:300]


def fail(where, message):
    print(f'{where}: {message}', file=sys.stderr)
    sys.exit(1)


def sanitize(text):
    """Untrusted SVG text to a safe standalone SVG with a viewBox. Raises ValueError when it is not an SVG."""
    if len(text) > MAX_SVG_BYTES:
        raise ValueError('svg too large')
    if '<!ENTITY' in text:
        raise ValueError('svg declares entities')
    text = re.sub(r'<!DOCTYPE[^>]*>', '', text)
    root = ET.fromstring(text)
    if root.tag != f'{{{SVG_NS}}}svg':
        raise ValueError(f'root is {root.tag}, not svg')
    def keep(element):
        tag = element.tag if isinstance(element.tag, str) else ''
        if not tag.startswith(f'{{{SVG_NS}}}') or tag.split('}')[1] in ('script', 'foreignObject', 'metadata'):
            return False
        if tag.endswith('}style') and re.search(r'url\(\s*["\']?(?!#)', element.text or ''):
            return False
        return True
    for parent in list(root.iter()):
        for child in list(parent):
            if not keep(child):
                parent.remove(child)
        for name, value in list(parent.attrib.items()):
            namespace = name[1:].split('}')[0] if name.startswith('{') else ''
            local = name.split('}')[-1]
            external_ref = local == 'href' and not value.startswith('#')
            if namespace not in ('', XLINK_NS, XML_NS) or local.lower().startswith('on') or external_ref or re.search(r'url\(\s*["\']?(?!#)', value):
                del parent.attrib[name]
    if 'viewBox' not in root.attrib:
        size = [float(m.group()) for m in (re.match(r'[\d.]+', root.get(k, '')) for k in ('width', 'height')) if m]
        if len(size) != 2 or min(size) <= 0:
            raise ValueError('svg has neither a viewBox nor a width and height')
        root.set('viewBox', f'0 0 {size[0]:g} {size[1]:g}')
    return ET.tostring(root, encoding='unicode')


def rgb_of(color):
    color = color.strip().lower()
    if color in ('black', 'white'):
        return (0, 0, 0) if color == 'black' else (255, 255, 255)
    if color.startswith('rgb'):
        return tuple(int(n) for n in re.findall(r'\d+', color)[:3])
    h = color[1:]
    h = ''.join(c * 2 for c in h) if len(h) == 3 else h
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def palette_slot(color):
    """Which palette colour a file colour becomes: near-white → paper, saturated → accent, dark → ink, the rest → soft."""
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb_of(color)))
    if l >= PAPER_L:
        return 'paper'
    if s >= ACCENT_S and ACCENT_L[0] < l < ACCENT_L[1]:
        return 'accent'
    return 'ink' if l < INK_L else 'soft'


def recolor(svg, palette):
    """Replace every fill, stroke and stop-color (attribute or style declaration) with its palette slot's colour, and
    record the palette on the root element (`data-palette-ink` ...) so `<Art>` can swap the four colours again at play time."""
    out = PAINT.sub(lambda m: m.group(1) + palette[palette_slot(m.group(2))], svg)
    marks = ''.join(f' data-palette-{k}="{palette[k]}"' for k in ('ink', 'accent', 'soft', 'paper') if k in palette)
    return re.sub(r'<svg\b', '<svg' + marks, out, count=1)


def queries(intent):
    """Search terms from specific to generic: the whole intent, its first three words, then its longest word."""
    words = re.findall(r'[A-Za-z]+', intent)
    out = [intent.strip(), ' '.join(words[:3]), max(words, key=len) if words else '']
    return [q for i, q in enumerate(out) if q and q not in out[:i]]


def fetch(url, data=None, headers=None, timeout=TIMEOUT):
    request = urllib.request.Request(url, data=data, headers={'User-Agent': 'frameforge-art/1', **(headers or {})})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read(MAX_SVG_BYTES + 1)
    if len(body) > MAX_SVG_BYTES:
        raise ValueError(f'response larger than {MAX_SVG_BYTES} bytes')
    return body


def openverse(query):
    """Ranked CC0 SVG results for `query`, Wikimedia Commons first. Raises urllib errors when the service is unavailable."""
    params = urllib.parse.urlencode({'q': query, 'license': 'cc0', 'extension': 'svg', 'page_size': '20'})
    results = json.loads(fetch(f'{OPENVERSE_URL}?{params}', headers={'Accept': 'application/json'})).get('results', [])
    ok = [r for r in results if r.get('license') == 'cc0' and str(r.get('url', '')).startswith('https://')]
    return sorted(ok, key=lambda r: (r.get('source') != 'wikimedia', ok.index(r)))


def library(intent):
    """The first CC0 SVG that downloads and sanitizes, as (svg text, source record), or None."""
    for query in queries(intent):
        for r in openverse(query)[:5]:
            try:
                svg = sanitize(fetch(r['url'], timeout=60).decode('utf-8'))
            except (ValueError, ET.ParseError, UnicodeDecodeError, urllib.error.URLError) as error:
                print(f'[art] skipped {r["url"]}: {error}', file=sys.stderr)
                continue
            return svg, {'id': r.get('id'), 'url': r['url'], 'title': clean(r.get('title')), 'creator': clean(r.get('creator')),
                         'license': r['license'], 'license_url': clean(r.get('license_url')), 'landing': clean(r.get('foreign_landing_url')),
                         'attribution': clean(r.get('attribution')), 'provider': r.get('source'), 'query': query}
    return None


def kit_catalog():
    """{component name: search words} from src/assets/catalog.ts. Needs the engine's npm install, like render and the studio."""
    script = 'import {CATALOG} from "./src/assets/catalog.ts"; console.log(JSON.stringify(CATALOG.map(c => [c.name, (c.tags || []).join(" ")])))'
    result = subprocess.run(['npx', 'tsx', '-e', script], cwd=ROOT, capture_output=True, text=True)
    try:
        return {name: tags for name, tags in json.loads(result.stdout.strip().splitlines()[-1])}
    except (ValueError, IndexError):
        fail('art.py', f'could not read src/assets/catalog.ts (run npm install in the engine): {result.stderr.strip()[-200:]}')


def kit_match(entry, catalog):
    """The kit component whose name or tags share the most words with the entry's intent and name, or None."""
    words = set(re.findall(r'[a-z]+', f"{entry.get('intent', '')} {entry['name']}".lower()))
    def score(item):
        name, tags = item
        return len(words & set(re.findall(r'[a-z]+', f'{re.sub(r"(?<!^)(?=[A-Z])", " ", name)} {tags}'.lower())))
    best = max(catalog.items(), key=score, default=None)
    return best[0] if best and score(best) else None


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


def raster_size(path):
    probe = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path], capture_output=True, text=True)
    width, height = (int(n) for n in probe.stdout.strip().split(',')[:2])
    return width, height


def host_file(entry, folder, prior):
    """The file a host agent handed over for this entry, or None: the entry's `file`, else <name>.svg|png|webp in the output
    folder that this resolver did not write (its hash differs from the manifest's record of our own output)."""
    if entry.get('file'):
        path = entry['file'] if os.path.isabs(entry['file']) else os.path.join(ROOT, entry['file'])
        if not os.path.isfile(path) or os.path.splitext(path)[1].lower() not in HOST_TYPES:
            raise ValueError(f"{entry['name']}: file {entry['file']} is missing or not one of {', '.join(HOST_TYPES)}")
        return path
    for ext in HOST_TYPES:
        path = os.path.join(folder, entry['name'] + ext)
        if not os.path.isfile(path):
            continue
        recorded = bool(prior) and (prior.get('file') or '').endswith('/' + entry['name'] + ext) and prior.get('sha256') == sha(path)
        if recorded and prior.get('provider') != 'host':
            continue  # our own earlier output
        # A host SVG already conditioned in place: its original was preserved under .host/.
        return os.path.join(folder, '.host', entry['name'] + ext) if recorded and ext == '.svg' else path
    return None


def redact(command):
    for name, value in os.environ.items():
        if re.search(r'KEY|TOKEN|SECRET|PASSWORD', name) and len(value) >= 8:
            command = command.replace(value, '<redacted>')
    return re.sub(r'((?:key|token|secret|password)\S*?[=: ]+)[^\s"\']+', r'\1<redacted>', command, flags=re.I)


def image_command(intent, tmp):
    """Run FRAMEFORGE_IMAGE_COMMAND for one PNG and return (png path, source record). Raises RuntimeError when it yields no file."""
    template = os.environ['FRAMEFORGE_IMAGE_COMMAND']
    prompt = re.sub(r'[^\w\s,.-]', ' ', f'{intent}, {IMAGE_PROMPT}')  # the template quotes {prompt}; keep shell metacharacters out of it
    out = os.path.join(tmp, 'image.png')
    result = subprocess.run(template.replace('{prompt}', prompt).replace('{out}', shlex.quote(out)), shell=True, capture_output=True, text=True, timeout=900)
    if result.returncode != 0:
        raise RuntimeError(f'exit {result.returncode}: {(result.stderr or result.stdout).strip()[-200:]}')
    path = out if '{out}' in template else None
    if path is None:
        for line in reversed(result.stdout.strip().splitlines()):
            try:
                path = (json.loads(line).get('paths') or [None])[0]
                break
            except (ValueError, AttributeError):
                continue
        else:
            try:
                path = (json.loads(result.stdout).get('paths') or [None])[0]
            except (ValueError, AttributeError):
                pass
    if not path or not os.path.isfile(path):
        raise RuntimeError(f'no image file: {path or result.stdout.strip()[-200:]}')
    return path, {'command': redact(template), 'prompt': prompt, 'raster_sha256': sha(path)}


def vectorize(png):
    """SVG text traced from `png` with a flat preset, or None when vtracer is unavailable or fails.
    vtracer 0.6.15 on Python 3.14 segfaults on keyword arguments, so it runs positionally in a child process."""
    code = ('import sys, vtracer; vtracer.convert_image_to_svg_py(sys.argv[1], sys.argv[2], "color", "stacked", "spline", '
            '8, 6, 32, 60, 4.0, 10, 45, 3)')
    out = png + '.svg'
    for attempt in range(2):
        result = subprocess.run([sys.executable, '-c', code, png, out], capture_output=True, text=True)
        if result.returncode == 0 and os.path.isfile(out):
            return open(out).read()
        if attempt == 0 and 'No module named' in result.stderr:
            subprocess.run([sys.executable, '-m', 'pip', 'install', '--user', '-q', f'vtracer=={VTRACER}'], capture_output=True)
        else:
            break
    return None


def resolve(entry, palette, folder, manifest, catalog):
    """Write <folder>/<name>.svg (or .png for a raster) for one entry, or pick a kit component, and return its manifest record."""
    name, intent, source = entry['name'], entry.get('intent') or entry['name'], entry.get('source', 'auto')
    key = hashlib.sha256((json.dumps(entry, sort_keys=True) + json.dumps(palette, sort_keys=True) + GENERATION).encode()).hexdigest()[:16]
    prior = manifest.get(name)
    host = host_file(entry, folder, prior) if source in ('auto', 'host') else None
    if host is None and prior and prior.get('hash') == key and prior.get('provider') != 'host':
        mine = os.path.join(folder, os.path.basename(prior.get('file') or ''))
        if prior.get('provider') == 'kit' or (os.path.isfile(mine) and sha(mine) == prior.get('sha256')):
            return prior
    if host and prior and prior.get('provider') == 'host' and prior.get('hash') == key and prior['source'].get('sha256') == sha(host):
        return prior
    record = {'hash': key, 'intent': intent, 'provider': None, 'fallback': None}
    note = lambda message: record.update(fallback='; '.join(filter(None, [record['fallback'], message])))
    picked = None  # (svg text or None, raster path or None, source record, provider)
    if host:
        if host.endswith('.svg'):
            original = host
            if os.path.dirname(host) == folder:  # conditioning rewrites <name>.svg in place, so keep the host's bytes first
                original = os.path.join(folder, '.host', name + '.svg')
                os.makedirs(os.path.dirname(original), exist_ok=True)
                shutil.copyfile(host, original)
            picked = (sanitize(open(original).read()), None, {'path': os.path.relpath(original, ROOT), 'sha256': sha(original)}, 'host')
        else:
            picked = (None, host, {'path': os.path.relpath(host, ROOT), 'sha256': sha(host)}, 'host')
    with tempfile.TemporaryDirectory() as tmp:
        if picked is None and source in ('auto', 'image-command') and os.environ.get('FRAMEFORGE_IMAGE_COMMAND'):
            try:
                png, src = image_command(intent, tmp)
                svg = vectorize(png)
                if svg is None:
                    note('image-command: vtracer unavailable, kept the PNG as a raster')
                    kept = os.path.join(tmp, 'kept.png')
                    shutil.copyfile(png, kept)
                    png = kept
                picked = (sanitize(svg) if svg else None, None if svg else png, dict(src, vectorized=bool(svg)), 'image-command')
            except (RuntimeError, ValueError, ET.ParseError, OSError, subprocess.TimeoutExpired) as error:
                note(f'image-command failed: {error}')
        elif source == 'image-command':
            note('image-command: FRAMEFORGE_IMAGE_COMMAND is not set')
        if picked is None and source in ('auto', 'library'):
            try:
                found = library(intent)
                picked = (found[0], None, found[1], 'library') if found else None
                if not found:
                    note('library: no CC0 SVG matched')
            except (urllib.error.URLError, ValueError, OSError) as error:
                note(f'library unavailable: {error}')
        if picked and picked[1] and picked[3] != 'host':  # move the raster out of tmp before it is deleted
            final = os.path.join(folder, name + '.png')
            os.makedirs(folder, exist_ok=True)
            shutil.copyfile(picked[1], final + '.tmp')
            os.replace(final + '.tmp', final)
            picked = (None, final, *picked[2:])
    target = None if picked is None else picked[1] or os.path.join(folder, name + '.svg')
    stale = prior and prior.get('provider') not in (None, 'host', 'kit') and os.path.join(folder, os.path.basename(prior.get('file') or ''))
    if stale and stale != target and os.path.isfile(stale) and sha(stale) == prior.get('sha256'):
        os.remove(stale)  # our own earlier output that this pick no longer uses
    if picked is None:
        component = kit_match(entry, catalog)
        record.update(provider='kit', component=component,
                      use=f"import {{{component}}} from '@/assets'" if component else 'no kit component matched; draw it or pick another intent')
        return record
    svg, raster, src, provider = picked
    if svg is not None:
        if entry.get('recolor', True):
            svg = recolor(svg, palette)
        final = os.path.join(folder, name + '.svg')
        os.makedirs(folder, exist_ok=True)
        with open(final + '.tmp', 'w') as f:
            f.write(svg)
        os.replace(final + '.tmp', final)  # rename into place so the dev server never serves half a file
        record.update(file=f'/assets/generated/{os.path.basename(folder)}/{name}.svg', sha256=sha(final))
    else:
        width, height = raster_size(raster)
        public = os.path.join(ROOT, 'public')
        inside = os.path.realpath(raster).startswith(os.path.realpath(public) + os.sep)
        url = f'/assets/generated/{os.path.basename(folder)}/{os.path.basename(raster)}' if os.path.dirname(raster) == folder else '/' + os.path.relpath(raster, public).replace(os.sep, '/') if inside else None
        record.update(file=url, raster=True, width=width, height=height, sha256=sha(raster))
        if url is None:
            note('raster lies outside public/; copy it under public/ to show it')
    record.update(provider=provider, source=src)
    return record


def write_credits(folder, manifest):
    """CC0 art needs no credit; anything else must be credited wherever the video is published."""
    lines = [f"- `{name}.svg`: {r['source'].get('attribution') or r['source'].get('title')} ({r['source'].get('landing')})"
             for name, r in sorted(manifest.items()) if r.get('provider') == 'library' and r['source'].get('license') != 'cc0']
    path = os.path.join(folder, 'CREDITS.md')
    if lines:
        with open(path, 'w') as f:
            f.write('# Illustration credits\n\nCredit these wherever the video is published.\n\n' + '\n'.join(lines) + '\n')
    elif os.path.exists(path):
        os.remove(path)


def validate(spec, path):
    need = lambda ok, message: ok or fail(path, message)
    need(isinstance(spec, dict) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', str(spec.get('slug', ''))), 'slug must be lowercase letters, digits and dashes')
    palette = spec.get('palette')
    need(isinstance(palette, dict) and all(re.fullmatch(r'#[0-9a-fA-F]{6}', str(palette.get(k, ''))) for k in SLOTS), 'palette needs ink, accent, soft and paper as #rrggbb')
    need(isinstance(spec.get('assets'), list) and spec['assets'], 'assets must be a non-empty list')
    for a in spec['assets']:
        need(isinstance(a, dict) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', str(a.get('name', ''))), f'asset name must be lowercase letters, digits and dashes: {a}')
        need(isinstance(a.get('file', ''), str), f"{a['name']}: file must be a path")
        need(a.get('source', 'auto') in SOURCES, f"{a['name']}: source must be one of {', '.join(SOURCES)}")
    names = [a['name'] for a in spec['assets']]
    need(len(names) == len(set(names)), 'asset names must be unique')


def generate(path):
    try:
        spec = json.load(open(path))
    except ValueError as error:
        fail(path, f'not JSON: {error}')
    validate(spec, path)
    folder = os.path.join(OUT, spec['slug'])
    os.makedirs(folder, exist_ok=True)
    manifest_path = os.path.join(folder, 'assets.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    catalog = None
    out = {}
    for entry in spec['assets']:
        catalog = catalog or kit_catalog()
        out[entry['name']] = resolve(entry, spec['palette'], folder, manifest, catalog)
    with open(manifest_path, 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    write_credits(folder, out)
    print(json.dumps({'slug': spec['slug'], 'assets': {name: r.get('component') or r.get('file') for name, r in out.items()},
                      'providers': {name: r['provider'] for name, r in out.items()}}, ensure_ascii=False))


def self_check():
    import http.server, threading
    dirty = ('<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'
             '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="120px" height="80">'
             '<script>alert(1)</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject><metadata>m</metadata>'
             '<style>.a{fill:url(https://evil.example/x.svg#g)}</style><style>.b{stroke:#000}</style>'
             '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>'
             '<image xlink:href="https://evil.example/p.png" width="1" height="1"/><use xlink:href="#g"/>'
             '<path d="M0 0L10 10" onclick="alert(1)" inkscape:label="l" fill="url(#g)" stroke="#E63946" style="fill:#222;stroke-width:2"/>'
             '<rect width="5" height="5" fill="#ccc" filter="url(http://evil.example/f)"/></svg>')
    clean_svg = sanitize(dirty)
    for banned in ('script', 'foreignObject', 'metadata', 'evil.example', 'onclick', 'inkscape', 'alert'):
        assert banned not in clean_svg, (banned, clean_svg)
    assert 'viewBox="0 0 120 80"' in clean_svg and 'xlink:href="#g"' in clean_svg and 'fill="url(#g)"' in clean_svg and '.b{stroke:#000}' in clean_svg, clean_svg
    for bad in ('<svg xmlns="http://www.w3.org/2000/svg"/>', '<html/>', '<!DOCTYPE x [<!ENTITY a "aa">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'):
        try:
            sanitize(bad)
            raise AssertionError(f'accepted {bad}')
        except (ValueError, ET.ParseError):
            pass
    palette = {'ink': '#101820', 'accent': '#ff5a36', 'soft': '#a7c4bc', 'paper': '#fbf7f0'}
    assert [palette_slot(c) for c in ('#ffffff', '#E63946', '#222', '#888888', 'rgb(40, 120, 220)', 'black', '#f0d0d0')] == ['paper', 'accent', 'ink', 'soft', 'accent', 'ink', 'soft']
    recolored = recolor(clean_svg, palette)
    assert 'stroke="#ff5a36"' in recolored and 'fill:#101820' in recolored and 'stop-color="#fbf7f0"' in recolored and 'fill="#a7c4bc"' in recolored, recolored
    assert queries('a steaming coffee cup on a saucer') == ['a steaming coffee cup on a saucer', 'a steaming coffee', 'steaming']
    kit = kit_catalog()
    assert kit_match({'name': 'hero', 'intent': 'a steaming coffee mug'}, kit) == 'Cup' and kit_match({'name': 'x', 'intent': 'zebra'}, kit) is None
    assert kit_match({'name': 'savings', 'intent': 'stack of coins'}, kit) == 'CoinStack'

    class Mock(http.server.BaseHTTPRequestHandler):
        def reply(self, body, kind):
            self.send_response(200); self.send_header('Content-Type', kind); self.end_headers(); self.wfile.write(body.encode())
        def do_GET(self):
            if self.path.startswith('/files/'):
                return self.reply(dirty, 'image/svg+xml')
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            assert query['license'] == ['cc0'] and query['extension'] == ['svg'], query
            hits = [{'id': 'f', 'url': 'https://other.example/a.svg', 'license': 'cc0', 'source': 'flickr'},
                    {'id': 'w', 'url': 'https://wiki.example/lib.svg', 'license': 'cc0', 'source': 'wikimedia', 'title': 'Mug', 'creator': 'Someone',
                     'foreign_landing_url': 'https://commons.wikimedia.org/w/index.php?curid=1'}] if query['q'] == ['mug'] else []
            self.reply(json.dumps({'results': hits}), 'application/json')
        log_message = lambda *a: None
    server = http.server.HTTPServer(('127.0.0.1', 0), Mock)
    base = f'http://127.0.0.1:{server.server_port}'
    threading.Thread(target=server.serve_forever, daemon=True).start()
    global OPENVERSE_URL
    OPENVERSE_URL = f'{base}/v1/images/'
    real_fetch = globals()['fetch']
    # The library only accepts https results; route the fake https hosts to the http mock.
    globals()['fetch'] = lambda url, *a, **k: real_fetch(re.sub(r'^https://(other|wiki)\.example', base + '/files', url), *a, **k)
    with tempfile.TemporaryDirectory() as folder:
        record = resolve({'name': 'cup', 'intent': 'mug'}, palette, folder, {}, kit)
        assert record['provider'] == 'library' and record['source']['id'] == 'w', record
        written = open(os.path.join(folder, 'cup.svg')).read()
        assert 'script' not in written and 'stroke="#ff5a36"' in written and 'viewBox' in written, written
        assert resolve({'name': 'cup', 'intent': 'mug'}, palette, folder, {'cup': record}, kit) is record, 'unchanged entry reuses its pin'
        record = resolve({'name': 'mug', 'intent': 'mug', 'recolor': False}, palette, folder, {}, kit)
        assert record['provider'] == 'library' and record['source']['id'] == 'w' and record['source']['provider'] == 'wikimedia', record
        assert '#E63946' in open(os.path.join(folder, 'mug.svg')).read(), 'recolor: false keeps the file colours'
        record = resolve({'name': 'zz', 'intent': 'a quiet bell rings', 'source': 'library'}, palette, folder, {}, kit)
        assert record['provider'] == 'kit' and record['component'] == 'Bell' and record['fallback'] == 'library: no CC0 SVG matched', record
        server.shutdown(); server.server_close()
        OPENVERSE_URL = base + '/v1/images/'  # closed now: offline
        record = resolve({'name': 'off', 'intent': 'phone screen'}, palette, folder, {}, kit)
        assert record['provider'] == 'kit' and record['component'] == 'Phone' and record['fallback'].startswith('library unavailable'), record
        write_credits(folder, {'a': {'provider': 'library', 'source': {'license': 'by', 'attribution': 'A by B', 'landing': 'L'}}, 'b': {'provider': 'library', 'source': {'license': 'cc0'}}})
        credits = open(os.path.join(folder, 'CREDITS.md')).read()
        assert 'a.svg' in credits and 'b.svg' not in credits, credits
        # host: an SVG the host agent dropped in place is conditioned, its original kept; a PNG stays raster; never overwritten
        host_svg = os.path.join(folder, 'drop.svg')
        open(host_svg, 'w').write(dirty)
        record = resolve({'name': 'drop', 'intent': 'coffee cup'}, palette, folder, {}, kit)
        assert record['provider'] == 'host' and record['source']['path'].endswith('.host/drop.svg') and open(os.path.join(folder, '.host', 'drop.svg')).read() == dirty, record
        assert 'script' not in open(host_svg).read() and resolve({'name': 'drop', 'intent': 'coffee cup'}, palette, folder, {'drop': record}, kit) is record, 'conditioned host svg is reused'
        png = os.path.join(folder, 'photo.png')
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x48', '-frames:v', '1', png], check=True)
        before = sha(png)
        record = resolve({'name': 'photo', 'intent': 'x'}, palette, folder, {}, kit)
        assert record['provider'] == 'host' and record['raster'] and (record['width'], record['height']) == (64, 48) and sha(png) == before, record
        record = resolve({'name': 'given', 'intent': 'x', 'file': host_svg}, palette, folder, {}, kit)
        assert record['provider'] == 'host' and os.path.exists(os.path.join(folder, 'given.svg')), record
        # image-command: {out} template, JSON `paths` output, a failing command falling through, vtracer missing
        os.environ['FRAMEFORGE_IMAGE_COMMAND'] = f'{FFMPEG} -v error -y -f lavfi -i "color=c=red:s=64x64,drawbox=x=16:y=16:w=32:h=32:color=white:t=fill" -frames:v 1 {{out}} # api_key=sk-secret-123 {{prompt}}'
        record = resolve({'name': 'drawn', 'intent': 'a red tile'}, palette, folder, {}, kit)
        assert record['provider'] == 'image-command' and record['source']['vectorized'] and record['file'].endswith('drawn.svg'), record
        assert 'sk-secret' not in record['source']['command'] and 'flat vector illustration' in record['source']['prompt'], record
        assert '<path' in open(os.path.join(folder, 'drawn.svg')).read()
        side = os.path.join(folder, 'side.png')
        os.environ['FRAMEFORGE_IMAGE_COMMAND'] = f'{FFMPEG} -v error -y -f lavfi -i color=c=blue:s=32x32 -frames:v 1 {side} && echo \'{{"paths": ["{side}"]}}\' # "{{prompt}}"'
        real_vectorize = globals()['vectorize']
        globals()['vectorize'] = lambda png: None
        record = resolve({'name': 'drawn', 'intent': 'a blue tile'}, palette, folder, {'drawn': record}, kit)
        globals()['vectorize'] = real_vectorize
        assert record['provider'] == 'image-command' and record['raster'] and record['file'].endswith('drawn.png') and 'vtracer unavailable' in record['fallback'], record
        assert not os.path.exists(os.path.join(folder, 'drawn.svg')), 'the earlier svg output of this entry is removed'
        os.environ['FRAMEFORGE_IMAGE_COMMAND'] = 'exit 3'
        record = resolve({'name': 'down', 'intent': 'phone'}, palette, folder, {}, kit)
        assert record['provider'] == 'kit' and record['fallback'].startswith('image-command failed: exit 3'), record
        del os.environ['FRAMEFORGE_IMAGE_COMMAND']
    print('art self-check ok (host svg/png/file, image-command {out}/paths/fail/no-vtracer, sanitizer, palette slots, recolor, kit match, mock Openverse, offline fallback, credits)')


if __name__ == '__main__':  # self-check: python3 scripts/assets/art.py --self-check
    args = sys.argv[1:]
    if args == ['--self-check']:
        self_check()
    elif not args:
        fail('art.py', 'usage: art.py <assets.json> [...] | --self-check')
    else:
        for path in args:
            generate(path)
