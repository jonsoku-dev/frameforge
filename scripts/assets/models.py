"""Fetch CC0 3D models, HDRIs and textures from Poly Haven for a film's Blender shots or <Model> scenes.

  npm run models -- examples/samples/<slug>/models.json [--force]
  python3 scripts/assets/models.py --self-check

models.json sits next to the film's audio.json:
  {"slug", "items": [{"name", "kind": model|hdri|texture, "query": "ceramic vase", "id"?: exact Poly Haven id, "resolution"?: "1k"}]}
The catalogue (https://api.polyhaven.com/assets?t=models|hdris|textures) has no search, so the pick is made here: the exact
`id` when given, else the first asset (ids sorted) whose id holds every query word, then whose name or tags do, then any word.
Files come from https://api.polyhaven.com/files/<id> at `resolution` (default 1k):
  model    <out>/models/<name>/<name>.gltf plus its .bin and textures/ as the manifest lists them (no .glb is offered)
  hdri     <out>/models/<name>.hdr
  texture  <out>/models/<name>.jpg (the diffuse map)
where <out> is public/assets/generated/<slug>/. Every download is checked against the API's md5. The pick is pinned in
models.lock.json next to models.json (id, kind, resolution, files with url and md5, license, authors); an item whose lock
entry matches and whose files exist is not fetched again, --force refetches. Poly Haven is CC0 so CREDITS.md stays absent;
it is written only if a licence other than CC0 ever appears in the lock. Offline or no match: a clear error and exit 1."""
import hashlib, json, os, re, sys, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'assets', 'generated')
API = os.environ.get('POLYHAVEN_API', 'https://api.polyhaven.com')
LICENSE = 'CC0'
LICENSE_URL = 'https://polyhaven.com/license'
KINDS = {'model': 'models', 'hdri': 'hdris', 'texture': 'textures'}
TIMEOUT = 30
NAME = re.compile(r'[a-z0-9][a-z0-9-]*')


def fail(where, message):
    print(f'{where}: {message}', file=sys.stderr)
    sys.exit(1)


def get_json(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'frameforge-models'})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.load(response)


def download(url, path, md5):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    request = urllib.request.Request(url, headers={'User-Agent': 'frameforge-models'})
    digest = hashlib.md5()
    with urllib.request.urlopen(request, timeout=TIMEOUT * 4) as response, open(path + '.part', 'wb') as f:
        while chunk := response.read(1 << 16):
            f.write(chunk)
            digest.update(chunk)
    if md5 and digest.hexdigest() != md5:
        os.remove(path + '.part')
        raise ValueError(f'{url}: md5 {digest.hexdigest()} does not match the manifest {md5}')
    os.replace(path + '.part', path)


def pick(catalog, item):
    """The asset id for `item`, or None. Ids are tried in sorted order so the same query always lands on the same asset."""
    if item.get('id'):
        return item['id'] if item['id'] in catalog else None
    words = [w for w in re.split(r'[^a-z0-9]+', str(item.get('query', '')).lower()) if w]
    if not words:
        return None
    text = lambda aid: ' '.join([aid, catalog[aid].get('name', '')] + list(catalog[aid].get('tags', []))).lower()
    for match in (lambda aid: all(w in aid.lower() for w in words), lambda aid: all(w in text(aid) for w in words), lambda aid: any(w in text(aid) for w in words)):
        found = next((aid for aid in sorted(catalog) if match(aid)), None)
        if found:
            return found
    return None


def plan(kind, name, files, resolution):
    """[(relative path under models/, url, md5)] for one asset at `resolution`."""
    try:
        if kind == 'model':
            entry = files['gltf'][resolution]['gltf']
            return [(f'{name}/{name}.gltf', entry['url'], entry.get('md5'))] + [(f'{name}/{rel}', inc['url'], inc.get('md5')) for rel, inc in sorted(entry.get('include', {}).items())]
        if kind == 'hdri':
            entry = files['hdri'][resolution]['hdr']
            return [(f'{name}.hdr', entry['url'], entry.get('md5'))]
        entry = files['Diffuse'][resolution]['jpg']
        return [(f'{name}.jpg', entry['url'], entry.get('md5'))]
    except KeyError as missing:
        raise ValueError(f'no {kind} file at {resolution} (missing {missing}); resolutions offered: {", ".join(sorted(next((v for k, v in files.items() if isinstance(v, dict)), {})))}')


def resolve(item, folder, prior, catalogs, force):
    """Download one item into <folder>/models/ and return its lock record."""
    kind, name = item.get('kind', 'model'), item['name']
    resolution = item.get('resolution', '1k')
    same = prior and prior.get('kind') == kind and prior.get('resolution') == resolution and (prior.get('id') == item.get('id') if item.get('id') else prior.get('query') == item.get('query'))
    if same and not force and all(os.path.isfile(os.path.join(folder, 'models', f['path'])) for f in prior['files']):
        return prior
    if kind not in catalogs:
        catalogs[kind] = get_json(f'{API}/assets?t={KINDS[kind]}')
    asset_id = pick(catalogs[kind], item)
    if asset_id is None:
        raise LookupError(f"{name}: no Poly Haven {kind} matches {item.get('id') or item.get('query')!r}")
    files = plan(kind, name, get_json(f'{API}/files/{asset_id}'), resolution)
    for rel, url, md5 in files:
        download(url, os.path.join(folder, 'models', rel), md5)
    info = catalogs[kind][asset_id]
    return {'id': asset_id, 'kind': kind, 'query': item.get('query'), 'resolution': resolution, 'title': info.get('name'),
            'authors': sorted(info.get('authors', {})), 'license': LICENSE, 'license_url': LICENSE_URL, 'page': f'https://polyhaven.com/a/{asset_id}',
            'file': f"/assets/generated/{os.path.basename(folder)}/models/{files[0][0]}", 'files': [{'path': rel, 'url': url, 'md5': md5} for rel, url, md5 in files]}


def write_credits(folder, lock):
    """Poly Haven is CC0, so this normally removes CREDITS.md; any other licence in the lock must be credited."""
    lines = [f"- `{r['file']}`: {r.get('title')} by {', '.join(r.get('authors') or [])} ({r.get('license')}, {r.get('page')})" for r in lock.values() if r.get('license') != LICENSE]
    path = os.path.join(folder, 'CREDITS.md')
    if lines:
        with open(path, 'w') as f:
            f.write('# Model credits\n\nCredit these wherever the video is published.\n\n' + '\n'.join(lines) + '\n')
    elif os.path.exists(path):
        os.remove(path)


def validate(spec, path):
    need = lambda ok, message: ok or fail(path, message)
    need(isinstance(spec, dict) and NAME.fullmatch(str(spec.get('slug', ''))), 'slug must be lowercase letters, digits and dashes')
    need(isinstance(spec.get('items'), list) and spec['items'], 'items must be a non-empty list')
    for item in spec['items']:
        need(isinstance(item, dict) and NAME.fullmatch(str(item.get('name', ''))), f'item name must be lowercase letters, digits and dashes: {item}')
        need(item.get('kind', 'model') in KINDS, f"{item['name']}: kind must be model, hdri or texture")
        need(isinstance(item.get('query') or item.get('id'), str), f"{item['name']}: needs a query or an id")
        need(re.fullmatch(r'[1248]k|16k', str(item.get('resolution', '1k'))), f"{item['name']}: resolution must be 1k, 2k, 4k, 8k or 16k")
    names = [item['name'] for item in spec['items']]
    need(len(names) == len(set(names)), 'item names must be unique')


def generate(path, force=False):
    try:
        spec = json.load(open(path))
    except ValueError as error:
        fail(path, f'not JSON: {error}')
    validate(spec, path)
    folder = os.path.join(OUT, spec['slug'])
    lock_path = os.path.join(os.path.dirname(os.path.abspath(path)), 'models.lock.json')
    prior = json.load(open(lock_path)) if os.path.exists(lock_path) else {}
    lock, catalogs = {}, {}
    for item in spec['items']:
        try:
            lock[item['name']] = resolve(item, folder, prior.get(item['name']), catalogs, force)
        except (urllib.error.URLError, OSError, ValueError, LookupError) as error:
            fail(path, f"{item['name']}: {error}" if not isinstance(error, LookupError) else str(error))
    with open(lock_path, 'w') as f:
        json.dump(lock, f, indent=1, ensure_ascii=False)
    write_credits(folder, lock)
    print(json.dumps({'slug': spec['slug'], 'items': {name: r['file'] for name, r in lock.items()}, 'ids': {name: r['id'] for name, r in lock.items()}}, ensure_ascii=False))


def self_check():
    import http.server, tempfile, threading
    global API, OUT
    blob = {'vase.gltf': b'{"asset":{"version":"2.0"}}', 'vase.bin': b'\x00' * 64, 'textures/vase_diff_1k.jpg': b'\xff\xd8jpeg', 'sky_1k.hdr': b'#?RADIANCE\n'}
    md5 = lambda key: hashlib.md5(blob[key]).hexdigest()
    hits = []
    class Mock(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            hits.append(self.path)
            url = urllib.parse.urlparse(self.path)
            if url.path == '/assets':
                kind = urllib.parse.parse_qs(url.query)['t'][0]
                body = {'models': {'ceramic_vase_01': {'name': 'Ceramic Vase 01', 'tags': ['pot', 'clean'], 'authors': {'Someone': 'All'}},
                                   'brass_vase_02': {'name': 'Brass Vase 02', 'tags': ['metal'], 'authors': {'A': 'All', 'B': 'Textures'}}},
                        'hdris': {'studio_small_09': {'name': 'Studio Small 09', 'tags': ['studio', 'indoor'], 'authors': {'Light Person': 'All'}}}}[kind]
            elif url.path == '/files/ceramic_vase_01':
                body = {'gltf': {'1k': {'gltf': {'url': f'{base}/dl/vase.gltf', 'md5': md5('vase.gltf'), 'include': {
                    'ceramic_vase_01.bin': {'url': f'{base}/dl/vase.bin', 'md5': md5('vase.bin')},
                    'textures/ceramic_vase_01_diff_1k.jpg': {'url': f'{base}/dl/textures/vase_diff_1k.jpg', 'md5': md5('textures/vase_diff_1k.jpg')}}}}}}
            elif url.path == '/files/brass_vase_02':
                body = {'gltf': {'2k': {'gltf': {'url': f'{base}/dl/vase.gltf', 'md5': 'not-the-real-md5'}}}}
            elif url.path == '/files/studio_small_09':
                body = {'hdri': {'1k': {'hdr': {'url': f'{base}/dl/sky_1k.hdr', 'md5': md5('sky_1k.hdr')}}}}
            elif url.path.startswith('/dl/'):
                data = blob[url.path[4:]]
                self.send_response(200); self.send_header('Content-Type', 'application/octet-stream'); self.end_headers(); self.wfile.write(data); return
            else:
                self.send_response(404); self.end_headers(); return
            data = json.dumps(body).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(data)
        log_message = lambda *a: None
    server = http.server.HTTPServer(('127.0.0.1', 0), Mock)
    base = f'http://127.0.0.1:{server.server_port}'
    threading.Thread(target=server.serve_forever, daemon=True).start()
    catalog = {'ceramic_vase_01': {'name': 'Ceramic Vase 01', 'tags': ['pot', 'clean']}, 'brass_vase_02': {'name': 'Brass Vase 02', 'tags': ['metal']}}
    assert pick(catalog, {'query': 'ceramic vase'}) == 'ceramic_vase_01' and pick(catalog, {'query': 'metal'}) == 'brass_vase_02'
    assert pick(catalog, {'query': 'vase'}) == 'brass_vase_02' and pick(catalog, {'query': 'zebra'}) is None and pick(catalog, {'id': 'nope'}) is None
    API = base
    with tempfile.TemporaryDirectory() as folder:
        OUT = os.path.join(folder, 'generated')
        spec = os.path.join(folder, 'models.json')
        json.dump({'slug': 'fixture', 'items': [{'name': 'vase', 'query': 'ceramic vase'}, {'name': 'sky', 'kind': 'hdri', 'id': 'studio_small_09'}]}, open(spec, 'w'))
        import io, contextlib
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            generate(spec)
        lock = json.load(open(os.path.join(folder, 'models.lock.json')))
        assert lock['vase']['id'] == 'ceramic_vase_01' and lock['vase']['license'] == 'CC0' and lock['vase']['authors'] == ['Someone'], lock['vase']
        assert lock['vase']['file'] == '/assets/generated/fixture/models/vase/vase.gltf' and lock['sky']['file'] == '/assets/generated/fixture/models/sky.hdr'
        models = os.path.join(OUT, 'fixture', 'models')
        assert open(os.path.join(models, 'vase', 'vase.gltf'), 'rb').read() == blob['vase.gltf']
        assert open(os.path.join(models, 'vase', 'ceramic_vase_01.bin'), 'rb').read() == blob['vase.bin']
        assert os.path.isfile(os.path.join(models, 'vase', 'textures', 'ceramic_vase_01_diff_1k.jpg')) and os.path.isfile(os.path.join(models, 'sky.hdr'))
        assert not os.path.exists(os.path.join(OUT, 'fixture', 'CREDITS.md'))
        printed = json.loads(out.getvalue()); assert printed['ids'] == {'vase': 'ceramic_vase_01', 'sky': 'studio_small_09'}, printed
        before = len(hits)
        with contextlib.redirect_stdout(io.StringIO()):
            generate(spec)
        assert len(hits) == before, 'a locked item with its files present must not touch the network'
        write_credits(os.path.join(OUT, 'fixture'), {'x': {**lock['vase'], 'license': 'CC BY 4.0'}})
        assert 'Ceramic Vase 01 by Someone (CC BY 4.0' in open(os.path.join(OUT, 'fixture', 'CREDITS.md')).read()
        for items, expected in (([{'name': 'bad', 'query': 'zebra'}], 'no Poly Haven model matches'), ([{'name': 'brass', 'query': 'metal', 'resolution': '2k'}], 'md5'),
                                ([{'name': 'brass', 'query': 'metal', 'resolution': '4k'}], 'resolutions offered: 2k')):
            json.dump({'slug': 'fixture', 'items': items}, open(spec, 'w'))
            err = io.StringIO()
            try:
                with contextlib.redirect_stderr(err):
                    generate(spec)
                raise AssertionError(f'accepted {items}')
            except SystemExit as stop:
                assert stop.code == 1 and expected in err.getvalue(), (expected, err.getvalue())
        server.shutdown(); server.server_close()
        json.dump({'slug': 'fixture', 'items': [{'name': 'late', 'query': 'metal'}]}, open(spec, 'w'))
        err = io.StringIO()
        try:
            with contextlib.redirect_stderr(err):
                generate(spec)
            raise AssertionError('offline must fail')
        except SystemExit as stop:
            assert stop.code == 1 and 'late:' in err.getvalue(), err.getvalue()
    print('models self-check ok (pick order, glTF with includes, hdri, md5, lock skip, credits, no match, bad resolution, offline)')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--self-check']:
        self_check()
    elif args and not args[0].startswith('--') and set(args[1:]) <= {'--force'}:
        generate(args[0], '--force' in args)
    else:
        fail('models.py', 'usage: models.py <models.json> [--force] | --self-check')
