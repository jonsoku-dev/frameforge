import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {renderToStaticMarkup} from 'react-dom/server';
import {FrameProvider} from '../src/core/index';
import {CATALOG} from '../src/blocks/catalog';
import {MAP_BLOCKS, MapOutline, Markers, RouteMap, bounds, fitBounds, fitCenter, geoPath, greatCircle, project, toPixel, type FeatureCollection} from '../src/blocks/maps';

const world = JSON.parse(readFileSync(new URL('./fixtures/geo/world.geojson', import.meta.url), 'utf8')) as FeatureCollection;
const config = {id: 'Maps', width: 1920, height: 1080, fps: 30, durationInFrames: 600};
const palette = {ink: '#111111', paper: '#F4F4F1', accent: '#2F5BFF', soft: '#DDE4FF'};
const fonts = {display: 'serif', ui: 'sans-serif'};
const render = (frame: number, node: (frame: number) => React.ReactNode) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{node(frame)}</FrameProvider>);
const common = {at: 100, palette, fonts, size: 40, width: 1600, height: 800, data: world};
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not near ${b}`);

test('project: known coordinates in both projections', () => {
  assert.deepEqual(project([0, 0]), [0, 0]);
  assert.deepEqual(project([180, 90], 'equirectangular'), [180, -90]);
  near(project([0, 0], 'mercator')[1], 0);
  near(project([0, 85], 'mercator')[1], -179.4, 0.1);
  near(project([0, 89], 'mercator')[1], project([0, 85], 'mercator')[1], 1e-9);
  near(project([127, 37.5], 'mercator')[1], -40.505, 0.01);
});

test('bounds and fitBounds centre the fixture in the box with the pad', () => {
  assert.deepEqual(bounds(world), [[0, -20], [60, 10]]);
  const view = fitBounds(bounds(world), 1600, 800, 'equirectangular', 0.05);
  near(view.scale, (1600 * 0.9) / 60);
  assert.deepEqual(toPixel([30, -5], view), [800, 400]);
  assert.deepEqual(toPixel([0, 10], view).map(Math.round), [80, 40]);
  const centred = fitCenter([127, 36], 2, 1920, 1080);
  assert.deepEqual(toPixel([127, 36], centred), [960, 540]);
  near(toPixel([127 + 90, 36], centred)[0], 960 + 960);
});

test('geoPath: rings close, multipolygons and lines keep their subpaths, coordinates are 0.1 px', () => {
  const view = fitBounds(bounds(world), 1600, 800, 'equirectangular', 0);
  assert.equal(geoPath(world.features[0]!.geometry, view), 'M0 266.7L266.7 266.7L266.7 0L0 0L0 266.7Z');
  assert.equal((geoPath(world.features[1]!.geometry, view).match(/M/g) ?? []).length, 2);
  assert.equal((geoPath(world.features[1]!.geometry, view).match(/Z/g) ?? []).length, 2);
  assert.equal(geoPath(world.features[2]!.geometry, view), 'M0 800L1600 800');
  assert.equal(geoPath(null, view), '');
  assert.ok(geoPath({type: 'Polygon', coordinates: [[[179, 0], [-179, 0], [-179, 1], [179, 1], [179, 0]]]}, view).startsWith('M'), 'antimeridian jump starts a new subpath');
  assert.equal((geoPath({type: 'Polygon', coordinates: [[[179, 0], [-179, 0], [-179, 1], [179, 1], [179, 0]]]}, view).match(/M/g) ?? []).length, 3);
});

test('greatCircle keeps the end points and bends a long leg', () => {
  const arc = greatCircle([[0, 0], [90, 0]]);
  assert.deepEqual(arc[0], [0, 0]);
  assert.deepEqual(arc[arc.length - 1], [90, 0]);
  assert.ok(arc.length > 40, `${arc.length} points for 90°`);
  const north = greatCircle([[-60, 45], [60, 45]]);
  assert.ok(Math.max(...north.map(p => p[1])) > 60, 'the arc between two points at 45°N passes north of them');
  assert.deepEqual(greatCircle([[5, 5]]), [[5, 5]]);
});

const blocks: Record<string, (frame: number) => React.ReactNode> = {
  MapOutline: f => <MapOutline frame={f} {...common} highlight={['SQR']} />,
  RouteMap: f => <RouteMap frame={f} {...common} route={[[2, 2], [25, 5], [42, 2]]} stops={[{at: [2, 2], label: '시작'}, {at: [25, 5], label: '중간'}, {at: [42, 2], label: '끝'}]} />,
  Markers: f => <Markers frame={f} {...common} points={[{at: [5, 5], label: '하나', value: 120}, {at: [25, 5], label: '둘', value: 40}, {at: [42, 2], label: '셋'}]} unit="건" />,
};

test('every map block is hidden before at, draws mid-animation and settled, and is deterministic per frame', () => {
  for (const [name, node] of Object.entries(blocks)) {
    assert.equal(render(99, node), '', `${name} before at`);
    for (const frame of [100, 130, 400]) {
      const markup = render(frame, node);
      assert.ok(markup.length > 200, `${name} at ${frame} draws something`);
      assert.equal(markup, render(frame, node), `${name} at ${frame} is deterministic`);
    }
    assert.notEqual(render(110, node), render(400, node), `${name} animates`);
    assert.equal(render(400, node), render(500, node), `${name} settles`);
  }
});

test('map outline: outlines dash in, the highlighted feature fills accent only after the outline landed', () => {
  const early = render(102, blocks.MapOutline!);
  assert.ok(/stroke-dasharray="1"/.test(early) && !early.includes(`fill="${palette.accent}"`), 'dashing, no highlight yet');
  const late = render(400, blocks.MapOutline!);
  assert.ok(!late.includes('stroke-dasharray') && late.includes(`fill="${palette.accent}" fill-opacity="1"`), 'settled: no dash, highlight filled');
  assert.equal((late.match(/fill-opacity="1"/g) ?? []).length, 1, 'only SQR is highlighted');
});

test('route map: the dot travels from the first stop to the last and stops pop as it passes', () => {
  const dot = (markup: string) => { const m = /<circle cx="([\d.]+)" cy="([\d.]+)" r="22"/.exec(markup); return m ? [Number(m[1]), Number(m[2])] : null; };
  const view = fitBounds(bounds(world), 1600, 800);
  const [x0] = toPixel([2, 2], view), [x1] = toPixel([42, 2], view);
  assert.equal(dot(render(120, blocks.RouteMap!)), null, 'no dot before the lead');
  near(dot(render(400, blocks.RouteMap!))![0], x1, 0.5);
  const first = dot(render(121, blocks.RouteMap!))![0], mid = dot(render(128, blocks.RouteMap!))![0];
  assert.ok(x0 < first && first < mid && mid < x1 - 50, `dot moves right: ${x0} < ${first} < ${mid} < ${x1}`);
  const plates = (markup: string) => [...markup.matchAll(/opacity:([\d.]+);transform:translateY\([^)]*\)">(\S+?)</g)].map(m => [m[2], Number(m[1])] as const);
  const half = Object.fromEntries(plates(render(165, blocks.RouteMap!)));
  assert.ok(half['시작']! > 0.9 && half['끝']! === 0, `start popped ${half['시작']}, end waiting ${half['끝']}`);
  assert.ok(plates(render(400, blocks.RouteMap!)).every(([, o]) => o === 1), 'all stops shown when settled');
});

test('markers: pops stagger, bubble area follows value, the plate prints the value with its unit', () => {
  const radii = (markup: string) => [...markup.matchAll(/fill-opacity="0.35"/g)].length;
  assert.equal(radii(render(400, blocks.Markers!)), 2, 'two valued points get a bubble');
  const settled = render(400, blocks.Markers!);
  assert.ok(settled.includes('>120건<') && settled.includes('>40건<'), settled.slice(0, 200));
  const bubble = [...settled.matchAll(/r="([\d.]+)" fill="#2F5BFF" fill-opacity="0.35"/g)].map(m => Number(m[1]));
  assert.ok(bubble[0]! > bubble[1]!, `bigger value, bigger bubble: ${bubble}`);
  const mid = render(125, blocks.Markers!);
  const plates = [...mid.matchAll(/opacity:([\d.]+);transform/g)].map(m => Number(m[1]));
  assert.ok(plates[0]! > plates[1]! && plates[1]! >= plates[2]!, `stagger ${plates}`);
});

test('a block without src or data throws a readable error', () => {
  assert.throws(() => render(100, f => <MapOutline frame={f} at={100} palette={palette} fonts={fonts} />), /MapOutline: pass src/);
});

test('catalogue: map ids are unique, in CATALOG and every id has a component export', () => {
  const ids = MAP_BLOCKS.map(e => e.id);
  assert.deepEqual(ids, ['map-outline', 'route-map', 'markers']);
  assert.equal(new Set(CATALOG.map(e => e.id)).size, CATALOG.length, 'catalogue ids unique');
  for (const id of ids) assert.ok(CATALOG.some(e => e.id === id && e.family === 'map'));
});

test('geo.py self-check passes', () => {
  const result = spawnSync('python3', ['scripts/assets/geo.py', '--self-check'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /geo self-check ok/);
});
