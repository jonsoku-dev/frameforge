import assert from 'node:assert/strict';
import test from 'node:test';
import {drawInSvg, recolorSvg} from '../src/core/art';
import {lottieFrame} from '../src/packages/lottie';

test('drawInSvg dashes only stroked shapes and recolorSvg maps data-role colours', () => {
  const svg = '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="#000"/><rect width="4" height="4" fill="#fff" stroke="none"/></svg>';
  const drawn = drawInSvg(svg, 0.25);
  assert.match(drawn, /<path[^>]*pathLength="1" stroke-dasharray="1" stroke-dashoffset="0\.7500"/);
  assert.doesNotMatch(drawn, /<rect[^>]*pathLength/);
  const coloured = recolorSvg('<svg data-palette-ink="#111111" data-palette-accent="#ff0000"><path d="M0 0" stroke="#111111"/><path fill="#ff0000"/></svg>', {ink: '#0F172A', accent: '#2563EB'});
  assert.match(coloured, /stroke="#0F172A"/);
  assert.match(coloured, /fill="#2563EB"/);
});

test('lottieFrame maps composition frames onto the file timeline, looping or holding', () => {
  assert.equal(lottieFrame(0, 30, 60, 120, true), 0);
  assert.equal(lottieFrame(30, 30, 60, 120, true), 60);
  assert.equal(lottieFrame(90, 30, 60, 120, true), 60);
  assert.equal(lottieFrame(90, 30, 60, 120, false), 119);
  assert.equal(lottieFrame(10, 30, 30, 100, true, 2), 20);
});
