import assert from 'node:assert/strict';
import test from 'node:test';
import type {ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as kit from '@/assets';
import {CATALOG} from '@/assets/catalog';
import type {ArtProps} from '@/assets/system';

const components = kit as unknown as Record<string, ComponentType<ArtProps>>;
const palette = {ink: '#000001', accent: '#000002', soft: '#000003', paper: '#000004'};
const render = (name: string, props: Partial<ArtProps> = {}) => {
  const Art = components[name];
  assert.ok(Art, `${name} is exported from @/assets`);
  return renderToStaticMarkup(<Art size={400} {...palette} {...props} />);
};

test('every catalogued asset exposes a meta with parts and Korean and English tags', () => {
  assert.ok(CATALOG.length >= 22);
  for (const meta of CATALOG) {
    assert.ok(meta.parts.length > 0, meta.name);
    assert.ok(meta.tags.some(tag => /[가-힣]/.test(tag)) && meta.tags.some(tag => /[a-z]/.test(tag)), `${meta.name} tags`);
  }
});

test('every asset draws 4-9 shapes on the 400 viewBox, one group per assembly part', () => {
  for (const {name, parts} of CATALOG) {
    const markup = render(name);
    assert.match(markup, /viewBox="0 0 400 400"/, name);
    const shapes = markup.match(/<(path|rect|circle|ellipse|line|polyline|polygon)\b/g)?.length ?? 0;
    assert.ok(shapes >= 4 && shapes <= 9, `${name} has ${shapes} shapes`);
    assert.equal(markup.match(/<g\b/g)?.length, parts.length, `${name} groups`);
  }
});

test('every asset paints only with the palette props', () => {
  const allowed = new Set([...Object.values(palette), 'none']);
  for (const {name} of CATALOG) {
    for (const [, value] of render(name).matchAll(/\b(?:fill|stroke)="([^"]*)"/g)) assert.ok(allowed.has(value!), `${name} paints ${value}`);
  }
});

test('parts reveals groups in order and draw dashes the strokes in', () => {
  const half = render('Cup', {parts: 2});
  assert.deepEqual([...half.matchAll(/<g[^>]*opacity="([^"]*)"/g)].map(match => match[1]), ['1', '1', '0', '0']);
  assert.match(render('Cup', {draw: 0.25}), /stroke-dashoffset="0.75"/);
  assert.doesNotMatch(render('Cup'), /stroke-dasharray/);
});

test('every asset shares one line weight', () => {
  for (const {name} of CATALOG) {
    const widths = new Set([...render(name, {stroke: 20}).matchAll(/stroke-width="([^"]*)"/g)].map(match => match[1]));
    assert.deepEqual([...widths], ['20'], `${name} line weight`);
  }
});

test('Bottle turns about its box centre and bottleNeck follows its lip, so a Stream leaves the neck at any tilt', () => {
  const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) < 1e-9);
  assert.ok(close(kit.bottleNeck({size: 400}), [200, 40]));
  assert.ok(close(kit.bottleNeck({size: 200, tilt: 90, x: 10, y: 20}), [10 + 180, 20 + 100]), 'on its side the lip points right');
  assert.match(render('Bottle', {tilt: 115} as Partial<ArtProps>), /transform="rotate\(115 200 200\)"/);
  assert.doesNotMatch(render('Bottle'), /rotate\(/);
  assert.match(render('Bottle', {label: 'GIN'} as Partial<ArtProps>), />GIN<\/text>/);
});

test('Glass fills to its level, floats its ice on the surface and draws no liquid when empty', () => {
  const liquidTop = (fill: number) => Number(/<g data-part="2"[^>]*><path d="M[\d.]+ ([\d.]+)/.exec(render('Glass', {fill} as Partial<ArtProps>))![1]);
  assert.ok(liquidTop(0.8) < liquidTop(0.3), 'a higher level sits higher');
  assert.equal(liquidTop(1), kit.glassLevel(1));
  const cubes = (props: object) => render('Glass', props as Partial<ArtProps>).match(/<rect/g)?.length ?? 0;
  assert.equal(cubes({ice: 3}), 3); assert.equal(cubes({ice: 0}), 0); assert.equal(cubes({fill: 0, ice: 3}), 0, 'no ice in an empty glass');
  assert.match(render('Glass', {liquid: '#000003'} as Partial<ArtProps>), /<g data-part="2"[^>]*><path[^>]*fill="#000003"/);
});
