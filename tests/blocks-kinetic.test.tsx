import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {FrameProvider} from '../src/core/index';
import * as kinetic from '../src/blocks/kinetic';
import {CATALOG} from '../src/blocks/catalog';

const config = {id: 'Kinetic', width: 1920, height: 1080, fps: 30, durationInFrames: 300};
const palette = {ink: '#16141c', paper: '#f4efe4', accent: '#e2553a', soft: '#3045e8'};
const fonts = {display: 'sans-serif', ui: 'sans-serif'};
const render = (frame: number, node: React.ReactNode) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{node}</FrameProvider>);

const BLOCKS: [string, (f: number) => React.ReactElement][] = [
  ['WordBeat', f => <kinetic.WordBeat frame={f} at={0} palette={palette} fonts={fonts} size={300} words={['STACK', 'SHIFT', 'SHIP']} punctuation="." />],
  ['Thread', f => <kinetic.Thread frame={f} at={0} palette={palette} fonts={fonts} points={[[300, 480], [1000, 470], [1400, 330], [1700, 850]]} loops={[1]} words={[{text: 'I think', x: 300, y: 300, size: 140}]} />],
  ['TextField', f => <kinetic.TextField frame={f} at={0} palette={palette} beat={10} />],
  ['WhipPan', f => <kinetic.WhipPan frame={f} at={10} from={<i>out</i>} to={<b>in</b>} />],
  ['BauhausMosaic', f => <kinetic.BauhausMosaic frame={f} at={0} palette={palette} />],
  ['Toggle', f => <kinetic.Toggle frame={f} at={0} on={20} palette={palette} size={190} />],
];

for (const [name, block] of BLOCKS) test(`${name}: same frame, same markup; it moves between frames`, () => {
  assert.equal(render(14, block(14)), render(14, block(14)));
  assert.notEqual(render(14, block(14)), render(24, block(24)), 'frame 14 and 24 differ');
});

test('WordBeat: one word and one flat field per beat, the text colour reads on the field, punctuation only on the last word', () => {
  const at = (f: number) => render(f, BLOCKS[0]![1](f));
  assert.match(at(3), />STACK</); assert.match(at(18), />SHIFT</); assert.match(at(33), /SHIP<span[^>]*>\.<\/span>/);
  assert.doesNotMatch(at(18), /STACK/);
  assert.equal(kinetic.readableOn('#d6f23a', [palette.ink, palette.paper]), palette.ink);
  assert.equal(kinetic.readableOn('#16141c', [palette.ink, palette.paper]), palette.paper);
});

test('Thread: the polyline curls a full loop at the loop index and ends on the last point', () => {
  const pts = kinetic.threadPoints([[0, 0], [100, 0], [200, 0]], [1], 20, 4);
  assert.deepEqual(pts.at(-1), [200, 0]);
  assert.ok(Math.min(...pts.map(p => p[1])) <= -39, 'the loop rises 2 x curl above the line (y up is negative)');
  assert.ok(pts.some((p, i) => i > 0 && p[0] < pts[i - 1]![0]), 'the loop goes backwards for a while');
});

test('TextField: the dense rows are images, not DOM text, inside an aria-hidden allow-small layer; children sit on top', () => {
  const markup = render(5, <kinetic.TextField frame={5} at={0} palette={palette}><span>hero</span></kinetic.TextField>);
  assert.match(markup, /aria-hidden="true" data-size="allow" data-clip="allow"/);
  assert.match(markup, /data:image\/svg\+xml/);
  assert.equal(markup.replace(/<[^>]*>/g, ''), 'hero', 'the only DOM text is the hero');
});

test('WhipPan: only `from` before, both sides with a one-axis blur at the middle frame, only `to` after', () => {
  const at = (f: number) => render(f, BLOCKS[3]![1](f));
  assert.match(at(10), /<i>out<\/i>/); assert.doesNotMatch(at(10), /<b>in<\/b>/);
  const mid = at(14);
  assert.match(mid, /<i>out<\/i>/); assert.match(mid, /<b>in<\/b>/);
  assert.match(mid, /stdDeviation="[\d.]+ 0"/); assert.match(mid, /filter:url\(#whip-10-blur\)/);
  const blur = Number(/stdDeviation="([\d.]+) 0"/.exec(mid)![1]);
  assert.ok(blur > 5 && blur <= 1920 * 0.04, `blur ${blur} is a smear, capped so the frame never goes to a full blur`);
  assert.match(at(18), /<b>in<\/b>/); assert.doesNotMatch(at(18), /<i>out<\/i>/); assert.match(at(18), /filter:none/);
});

test('BauhausMosaic: the grid fills the frame and a beat wave turns some cells but not all at once', () => {
  const cells = (f: number) => [...render(f, BLOCKS[4]![1](f)).matchAll(/<g transform="translate\([\d.]+ [\d.]+\)">.*?<\/g><\/g>/g)].map(m => m[0]);
  const a = cells(16), b = cells(30);
  assert.equal(a.length, 16 * 9);
  const changed = a.filter((c, i) => c !== b[i]).length;
  assert.ok(changed > 10 && changed < a.length, `${changed} cells changed`);
});

test('Toggle: the knob springs from left to right after `on` and the accent fill grows with it', () => {
  const left = (f: number) => Number(/left:([\d.]+)px;top:[\d.]+px;width:[\d.]+px;height:[\d.]+px;border-radius/.exec(render(f, BLOCKS[5]![1](f)))![1]);
  assert.ok(left(19) < 20 && left(60) > 200, `${left(19)} → ${left(60)}`);
});

test('catalogue: every kinetic entry is in CATALOG with a component export', () => {
  const names: Record<string, string> = {'word-beat': 'WordBeat', thread: 'Thread', 'text-field': 'TextField', 'whip-pan': 'WhipPan', 'bauhaus-mosaic': 'BauhausMosaic', toggle: 'Toggle'};
  for (const entry of kinetic.KINETIC_BLOCKS) {
    assert.ok(CATALOG.includes(entry));
    assert.equal(typeof (kinetic as Record<string, unknown>)[names[entry.id]!], 'function', entry.id);
  }
  assert.equal(kinetic.KINETIC_BLOCKS.length, 6);
});
