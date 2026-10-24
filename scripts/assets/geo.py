"""Fetch public-domain Natural Earth GeoJSON for a film's map blocks (<MapOutline>, <RouteMap>, <Markers>).

  npm run geo -- examples/samples/<slug>/geo.json [--force]
  python3 scripts/assets/geo.py --self-check

geo.json sits next to the film's audio.json:
  {"slug", "items": [{"name": "world", "source": "natural-earth", "layer": countries|land|coastline|lakes, "scale": "110m"|"50m",
                      "filter"?: {"iso_a3": ["KOR", "JPN"]}, "simplify"?: tolerance in degrees}]}
Files come from the Natural Earth vector repository (https://github.com/nvkelso/natural-earth-vector, geojson/ne_<scale>_<layer>.geojson).
Every feature keeps a short set of properties with lowercase keys (name, name_long, name_ko, iso_a3, adm0_a3, iso_a2, continent,
subregion, featurecla, scalerank) plus any key the filter names; `filter` keeps the features whose property (case-insensitive key)
is in the list; `simplify` runs Douglas-Peucker on every ring and line. Note Natural Earth leaves iso_a3 at "-99" for France,
Norway, Kosovo, Somaliland and N. Cyprus: adm0_a3 is always set, so filter on that when one of those matters.
The result is written to public/assets/generated/<slug>/geo/<name>.geojson and pinned in geo.lock.json next to geo.json
(url, sha256 of the download, licence "public domain, Natural Earth", feature count). An item whose lock entry matches and whose
file exists is not fetched again; --force refetches. Offline or an unknown layer: a clear error and exit 1."""
import hashlib, json, os, re, sys, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'assets', 'generated')
BASE = os.environ.get('NATURAL_EARTH_BASE', 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson')
LICENCE = 'public domain, Natural Earth'
LICENCE_URL = 'https://www.naturalearthdata.com/about/terms-of-use/'
LAYERS = {'countries': 'admin_0_countries', 'land': 'land', 'coastline': 'coastline', 'lakes': 'lakes'}
SCALES = ('110m', '50m')
KEEP = {'name', 'name_long', 'name_ko', 'iso_a3', 'adm0_a3', 'iso_a2', 'continent', 'subregion', 'featurecla', 'scalerank'}
TIMEOUT = 60
NAME = re.compile(r'[a-z0-9][a-z0-9-]*')


def fail(where, message):
    print(f'{where}: {message}', file=sys.stderr)
    sys.exit(1)


def url_for(item):
    return f"{BASE}/ne_{item.get('scale', '110m')}_{LAYERS[item['layer']]}.geojson"


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'frameforge-geo'})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def simplify(points, tolerance):
    """Douglas-Peucker on one ring or line; the end points always stay."""
    if tolerance <= 0 or len(points) < 3:
        return points
    (x0, y0), (x1, y1) = points[0], points[-1]
    dx, dy = x1 - x0, y1 - y0
    norm = (dx * dx + dy * dy) ** 0.5
    best, index = 0.0, 0
    for i in range(1, len(points) - 1):
        x, y = points[i]
        d = abs(dy * x - dx * y + x1 * y0 - y1 * x0) / norm if norm else ((x - x0) ** 2 + (y - y0) ** 2) ** 0.5
        if d > best:
            best, index = d, i
    if best <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def simplify_geometry(geometry, tolerance):
    """The geometry with every ring and line simplified; rings under four points and lines under two are dropped."""
    kind, coords = geometry['type'], geometry['coordinates']
    if kind == 'Polygon':
        rings = [r for r in (simplify(ring, tolerance) for ring in coords) if len(r) >= 4]
        return {'type': kind, 'coordinates': rings} if rings else None
    if kind == 'MultiPolygon':
        polys = [p['coordinates'] for p in (simplify_geometry({'type': 'Polygon', 'coordinates': poly}, tolerance) for poly in coords) if p]
        return {'type': kind, 'coordinates': polys} if polys else None
    if kind == 'LineString':
        line = simplify(coords, tolerance)
        return {'type': kind, 'coordinates': line} if len(line) >= 2 else None
    if kind == 'MultiLineString':
        lines = [l for l in (simplify(line, tolerance) for line in coords) if len(l) >= 2]
        return {'type': kind, 'coordinates': lines} if lines else None
    return geometry


def transform(collection, item):
    """Filtered, pruned and simplified features of one Natural Earth collection."""
    wanted = {k.lower(): set(map(str, v)) for k, v in (item.get('filter') or {}).items()}
    keep = KEEP | set(wanted)
    features = []
    for feature in collection['features']:
        props = {k.lower(): v for k, v in (feature.get('properties') or {}).items() if k.lower() in keep}
        if any(str(props.get(k)) not in values for k, values in wanted.items()):
            continue
        geometry = feature.get('geometry')
        if geometry and item.get('simplify'):
            geometry = simplify_geometry(geometry, float(item['simplify']))
        if geometry:
            features.append({'type': 'Feature', 'properties': props, 'geometry': geometry})
    return {'type': 'FeatureCollection', 'features': features}


def resolve(item, folder, prior, force):
    """Write one item under <folder>/geo/ and return its lock record."""
    url = url_for(item)
    spec = {'url': url, 'layer': item['layer'], 'scale': item.get('scale', '110m'), 'filter': item.get('filter'), 'simplify': item.get('simplify')}
    target = os.path.join(folder, 'geo', f"{item['name']}.geojson")
    if prior and not force and all(prior.get(k) == v for k, v in spec.items()) and os.path.isfile(target):
        return prior
    try:
        raw = fetch(url)
    except urllib.error.HTTPError as error:
        raise LookupError(f'{url}: HTTP {error.code}; Natural Earth offers {", ".join(SCALES)} for {", ".join(LAYERS)}')
    except (urllib.error.URLError, OSError, TimeoutError) as error:
        raise LookupError(f'cannot reach {url} ({getattr(error, "reason", error)}); the first fetch needs the network, afterwards geo.lock.json and the file keep it offline')
    try:
        collection = json.loads(raw)
    except ValueError as error:
        raise LookupError(f'{url}: not GeoJSON ({error})')
    if collection.get('type') != 'FeatureCollection':
        raise LookupError(f'{url}: not a FeatureCollection')
    result = transform(collection, item)
    if not result['features']:
        raise LookupError(f"{item['name']}: no feature matches filter {item.get('filter')} in {url}")
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target + '.part', 'w') as f:
        json.dump(result, f, separators=(',', ':'), ensure_ascii=False)
    os.replace(target + '.part', target)
    return {**spec, 'sha256': hashlib.sha256(raw).hexdigest(), 'licence': LICENCE, 'licence_url': LICENCE_URL, 'features': len(result['features']),
            'file': f"/assets/generated/{os.path.basename(folder)}/geo/{item['name']}.geojson"}


def validate(spec, path):
    need = lambda ok, message: ok or fail(path, message)
    need(isinstance(spec, dict) and NAME.fullmatch(str(spec.get('slug', ''))), 'slug must be lowercase letters, digits and dashes')
    need(isinstance(spec.get('items'), list) and spec['items'], 'items must be a non-empty list')
    for item in spec['items']:
        need(isinstance(item, dict) and NAME.fullmatch(str(item.get('name', ''))), f'item name must be lowercase letters, digits and dashes: {item}')
        need(item.get('source', 'natural-earth') == 'natural-earth', f"{item['name']}: source must be natural-earth")
        need(item.get('layer') in LAYERS, f"{item['name']}: layer must be one of {', '.join(LAYERS)}")
        need(item.get('scale', '110m') in SCALES, f"{item['name']}: scale must be 110m or 50m")
        need(item.get('filter') is None or (isinstance(item['filter'], dict) and all(isinstance(v, list) for v in item['filter'].values())), f"{item['name']}: filter must map a property to a list of values")
        need(item.get('simplify') is None or (isinstance(item['simplify'], (int, float)) and item['simplify'] >= 0), f"{item['name']}: simplify must be a tolerance in degrees")
    names = [item['name'] for item in spec['items']]
    need(len(names) == len(set(names)), 'item names must be unique')


def generate(path, force=False):
    try:
        spec = json.load(open(path))
    except ValueError as error:
        fail(path, f'not JSON: {error}')
    validate(spec, path)
    folder = os.path.join(OUT, spec['slug'])
    lock_path = os.path.join(os.path.dirname(os.path.abspath(path)), 'geo.lock.json')
    prior = json.load(open(lock_path)) if os.path.exists(lock_path) else {}
    lock = {}
    for item in spec['items']:
        try:
            lock[item['name']] = resolve(item, folder, prior.get(item['name']), force)
        except LookupError as error:
            fail(path, f"{item['name']}: {error}")
    with open(lock_path, 'w') as f:
        json.dump(lock, f, indent=1, ensure_ascii=False)
    print(json.dumps({'slug': spec['slug'], 'items': {name: r['file'] for name, r in lock.items()}, 'features': {name: r['features'] for name, r in lock.items()}}, ensure_ascii=False))


def self_check():
    import contextlib, http.server, io, tempfile, threading
    global BASE, OUT
    square = lambda x, y, s: [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]
    world = {'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'properties': {'NAME': 'Alpha', 'ISO_A3': 'AAA', 'ADM0_A3': 'AAA', 'POP_EST': 1, 'LABELRANK': 2}, 'geometry': {'type': 'Polygon', 'coordinates': [square(0, 0, 10)]}},
        {'type': 'Feature', 'properties': {'NAME': 'Beta', 'ISO_A3': 'BBB', 'ADM0_A3': 'BBB'}, 'geometry': {'type': 'MultiPolygon', 'coordinates': [[square(20, 0, 10)], [square(40, 0, 0.001)]]}},
        {'type': 'Feature', 'properties': {'NAME': 'Gamma', 'ISO_A3': '-99', 'ADM0_A3': 'GGG'}, 'geometry': {'type': 'Polygon', 'coordinates': [[[60, 0], [70, 0], [70, 10], [65, 10.001], [60, 10], [60, 0]]]}},
    ]}
    coast = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'featurecla': 'Coastline'}, 'geometry': {'type': 'LineString', 'coordinates': [[0, 0], [1, 0.0001], [2, 0]]}}]}
    hits = []
    class Mock(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            hits.append(self.path)
            body = {'/ne_110m_admin_0_countries.geojson': world, '/ne_50m_admin_0_countries.geojson': world, '/ne_110m_coastline.geojson': coast}.get(self.path)
            if body is None:
                self.send_response(404); self.end_headers(); return
            data = json.dumps(body).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(data)
        log_message = lambda *a: None
    server = http.server.HTTPServer(('127.0.0.1', 0), Mock)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    BASE = f'http://127.0.0.1:{server.server_port}'
    assert simplify([[0, 0], [1, 0.1], [2, 0]], 0.5) == [[0, 0], [2, 0]] and simplify([[0, 0], [1, 2], [2, 0]], 0.5) == [[0, 0], [1, 2], [2, 0]]
    assert simplify_geometry({'type': 'Polygon', 'coordinates': [square(0, 0, 0.001)]}, 0.01) is None, 'a ring that collapses is dropped'
    with tempfile.TemporaryDirectory() as folder:
        OUT = os.path.join(folder, 'generated')
        spec = os.path.join(folder, 'geo.json')
        items = [{'name': 'world', 'layer': 'countries'}, {'name': 'korea', 'layer': 'countries', 'scale': '50m', 'filter': {'iso_a3': ['BBB']}, 'simplify': 0.01},
                 {'name': 'gamma', 'layer': 'countries', 'filter': {'ADM0_A3': ['GGG']}, 'simplify': 0.01}, {'name': 'coast', 'layer': 'coastline', 'simplify': 0.01}]
        json.dump({'slug': 'fixture', 'items': items}, open(spec, 'w'))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            generate(spec)
        geo = os.path.join(OUT, 'fixture', 'geo')
        world_out = json.load(open(os.path.join(geo, 'world.geojson')))
        assert len(world_out['features']) == 3 and world_out['features'][0]['properties'] == {'name': 'Alpha', 'iso_a3': 'AAA', 'adm0_a3': 'AAA'}, world_out['features'][0]
        korea = json.load(open(os.path.join(geo, 'korea.geojson')))
        assert [f['properties']['iso_a3'] for f in korea['features']] == ['BBB'] and len(korea['features'][0]['geometry']['coordinates']) == 1, 'filter keeps BBB, simplify drops its speck'
        gamma = json.load(open(os.path.join(geo, 'gamma.geojson')))
        assert gamma['features'][0]['geometry']['coordinates'][0] == [[60, 0], [70, 0], [70, 10], [60, 10], [60, 0]], gamma
        assert json.load(open(os.path.join(geo, 'coast.geojson')))['features'][0]['geometry']['coordinates'] == [[0, 0], [2, 0]]
        lock = json.load(open(os.path.join(folder, 'geo.lock.json')))
        assert lock['world']['licence'] == LICENCE and lock['world']['features'] == 3 and lock['world']['url'].endswith('/ne_110m_admin_0_countries.geojson') and lock['korea']['url'].endswith('/ne_50m_admin_0_countries.geojson')
        assert lock['world']['sha256'] == hashlib.sha256(json.dumps(world).encode()).hexdigest() and lock['world']['file'] == '/assets/generated/fixture/geo/world.geojson'
        printed = json.loads(out.getvalue()); assert printed['features'] == {'world': 3, 'korea': 1, 'gamma': 1, 'coast': 1}, printed
        before = len(hits)
        with contextlib.redirect_stdout(io.StringIO()):
            generate(spec)
        assert len(hits) == before, 'a locked item with its file present must not touch the network'
        with contextlib.redirect_stdout(io.StringIO()):
            generate(spec, force=True)
        assert len(hits) == before + 4, 'force refetches'
        for items, expected in (([{'name': 'none', 'layer': 'countries', 'filter': {'iso_a3': ['ZZZ']}}], 'no feature matches'), ([{'name': 'lake', 'layer': 'lakes'}], 'HTTP 404'),
                                ([{'name': 'bad', 'layer': 'rivers'}], 'layer must be one of'), ([{'name': 'bad', 'layer': 'land', 'scale': '10m'}], 'scale must be 110m or 50m')):
            json.dump({'slug': 'fixture', 'items': items}, open(spec, 'w'))
            err = io.StringIO()
            try:
                with contextlib.redirect_stderr(err):
                    generate(spec)
                raise AssertionError(f'accepted {items}')
            except SystemExit as stop:
                assert stop.code == 1 and expected in err.getvalue(), (expected, err.getvalue())
        server.shutdown(); server.server_close()
        json.dump({'slug': 'fixture', 'items': [{'name': 'late', 'layer': 'land'}]}, open(spec, 'w'))
        err = io.StringIO()
        try:
            with contextlib.redirect_stderr(err):
                generate(spec)
            raise AssertionError('offline must fail')
        except SystemExit as stop:
            assert stop.code == 1 and 'late: cannot reach' in err.getvalue(), err.getvalue()
    print('geo self-check ok (filter, lowercase props, simplify, lock skip, force, no match, 404, bad layer, bad scale, offline)')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--self-check']:
        self_check()
    elif args and not args[0].startswith('--') and set(args[1:]) <= {'--force'}:
        generate(args[0], '--force' in args)
    else:
        fail('geo.py', 'usage: geo.py <geo.json> [--force] | --self-check')
