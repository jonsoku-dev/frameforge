import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {clippedTextMessage} from '../src/studio/textGuard';
import {renderToStaticMarkup} from 'react-dom/server';
import {FrameProvider} from '../src/core/index';
import {Bell} from '@/assets';
import * as text from '../src/blocks/text';
import * as lower from '../src/blocks/lower-thirds';
import * as cards from '../src/blocks/cards';
import * as charts from '../src/blocks/charts';

const config = {id: 'Blocks', width: 1920, height: 1080, fps: 30, durationInFrames: 300};
const base: Omit<text.BlockProps, 'frame'> = {at: 30, out: 120, fps: 30, size: 54, palette: {ink: '#111', paper: '#eee', accent: '#f50', soft: '#fdc'}, fonts: {display: 'sans-serif', ui: 'sans-serif'}};
const render = (frame: number, node: React.ReactNode) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{node}</FrameProvider>);
const rootHas = (markup: string, visibility: string) => new RegExp(`^<div[^>]*visibility:${visibility}`).test(markup);

// Every block at frame f; `still` marks blocks that keep moving while shown (the ticker scrolls, the typing dots bob).
type Build = (frame: number, props?: typeof base) => React.ReactElement;
const BLOCKS: [string, Build, {still?: boolean}][] = [
  ['GlyphRise', (f, b = base) => <text.GlyphRise {...b} frame={f} text="온결 하루" />, {}],
  ['WordCascade', (f, b = base) => <text.WordCascade {...b} frame={f} lines={['가볍게 시작', '단단하게 잇다']} />, {}],
  ['ZoomSwap', (f, b = base) => <text.ZoomSwap {...b} frame={f} words={['출근길', '점심']} />, {}],
  ['Typewriter', (f, b = base) => <text.Typewriter {...b} frame={f} text="오늘의 할 일 셋" />, {}],
  ['HighlightSweep', (f, b = base) => <text.HighlightSweep {...b} frame={f} before="작은 기록이 " word="큰 흐름" after="이 됩니다" />, {}],
  ['Counter', (f, b = base) => <text.Counter {...b} frame={f} to={1284} unit="일" example />, {}],
  ...(['clean-bar', 'bold-block', 'kicker-name', 'soft-pill', 'mask-reveal', 'side-rule'] as const).map((variant): [string, Build, {still?: boolean}] =>
    [`LowerThird ${variant}`, (f, b = base) => <lower.LowerThird {...b} frame={f} variant={variant} name="김온결" role="제품 디자이너" side={variant === 'soft-pill' ? 'right' : 'left'} />, {}]),
  ['StatCard', (f, b = base) => <cards.StatCard {...b} frame={f} value={92} unit="%" label="이어진 날 · 예시" />, {}],
  ['NotificationCard', (f, b = base) => <cards.NotificationCard {...b} frame={f} icon={Bell} title="온결" body="오늘의 기록이 저장됐어요" time="지금" />, {}],
  ['MessageThread', (f, b = base) => <cards.MessageThread {...b} frame={f} step={12} typing={6} messages={[{side: 'left', name: '온결', text: '오늘도 이었어요'}, {side: 'right', name: '나', text: '좋아요'}]} />, {}],
  ['Ticker', (f, b = base) => <cards.Ticker {...b} frame={f} items={['서울', '부산', '대전']} />, {still: true}],
  ['Checklist', (f, b = base) => <cards.Checklist {...b} frame={f} items={['기록', '연결', '확인']} />, {}],
  ['LogoOutro', (f, b = base) => <cards.LogoOutro {...b} frame={f} brand="온결" tagline="하루를 잇다" />, {}],
];

for (const [name, block, {still}] of BLOCKS) {
  test(`${name}: hidden before at, deterministic, moving, settled, hidden after exit`, () => {
    assert.ok(rootHas(render(29, block(29)), 'hidden'), 'hidden before at');
    assert.equal(render(45, block(45)), render(45, block(45)), 'same frame twice gives the same markup');
    assert.notEqual(render(45, block(45)), render(31, block(31)), 'mid-animation differs from the first frame');
    const settled = render(100, block(100));
    assert.ok(rootHas(settled, 'visible'), 'visible once settled');
    if (!still) assert.equal(settled, render(101, block(101)), 'nothing moves once settled');
    assert.ok(rootHas(render(200, block(200)), 'hidden'), 'hidden after the exit');
    const held = {...base, out: undefined};
    assert.ok(rootHas(render(500, block(500, held)), 'visible'), 'without out the block holds forever');
    if (!still) assert.equal(render(500, block(500, held)), render(501, block(501, held)), 'the hold is still');
  });
}

test('ZoomSwap mounts one word at a time and swaps at peak blur', () => {
  const words = ['첫째', '둘째'];
  const at = (f: number) => render(f, <text.ZoomSwap {...base} frame={f} words={words} hold={20} swap={10} />);
  for (const f of [40, 54, 56, 70]) {
    const shown = words.filter(word => at(f).includes(word));
    assert.equal(shown.length, 1, `frame ${f} shows exactly one word`);
  }
  assert.ok(at(54).includes('첫째') && at(56).includes('둘째'), 'the swap happens at the middle of the swap window');
});

test('Counter rounds once and groups thousands; Typewriter types whole words by default, one character per step with by="glyph"', () => {
  assert.equal(text.formatNumber(1234567.891, 1), '1,234,567.9');
  assert.equal(text.formatNumber(999.5, 0), '1,000');
  const typed = (f: number, by?: 'word' | 'glyph') => render(f, <text.Typewriter {...base} frame={f} text="saved every day" speed={3} by={by} />);
  // The overlay span holds the typed slice; the ghost span before it holds the whole text for layout.
  const slice = (markup: string) => /top:0">([^<]*)<span/.exec(markup)![1];
  assert.equal(slice(typed(30)), 'saved ', 'the first word at `at`');
  assert.equal(slice(typed(33)), 'saved every ', 'one more word every three frames');
  for (let f = 30; f < 120; f++) assert.ok(['saved ', 'saved every ', 'saved every day'].includes(slice(typed(f))), `frame ${f} shows whole words only`);
  assert.equal(slice(typed(30, 'glyph')), 's');
  assert.equal(slice(typed(36, 'glyph')), 'sav');
});

test('GlyphRise moves each word as one unit by default, so a word never shows letters at different heights', () => {
  const lifts = (f: number, by?: 'word' | 'glyph') => [...render(f, <text.GlyphRise {...base} frame={f} text="ab cd" by={by} />).matchAll(/translateY\(([-\d.e]+)%\)/g)].map(m => Number(m[1]));
  for (let f = 30; f < 45; f++) {
    const [a, b, , c, d] = lifts(f);
    assert.ok(a === b && c === d, `frame ${f}: glyphs of one word share their lift (${lifts(f).join(', ')})`);
  }
  const [a, b] = lifts(33, 'glyph');
  assert.notEqual(a, b, 'by="glyph" staggers single glyphs');
  assert.ok(lifts(39).every(v => v === 0), 'the default settles within rise 8 + stagger 1');
});

test('word masks keep descenders and side hooks: the clip edge sits 0.4em below the line box, 0.3em beside it, and a hidden word waits past it', () => {
  const markup = render(34, <text.GlyphRise {...base} frame={34} text="jumpy gig" />);
  const mask = /<span style="display:inline-block;overflow:hidden;height:([\d.]+)em;padding-top:([\d.]+)em;margin-top:-[\d.]+em;margin-bottom:-([\d.]+)em;padding-inline:([\d.]+)em;margin-inline:-([\d.]+)em/.exec(markup);
  assert.ok(mask, 'every glyph sits in the shared mask');
  const [height, top, bottom, side, sideBack] = mask.slice(1).map(Number);
  // Under border-box the clip edge is height − top below the line top; content-box puts it lower still.
  assert.ok(height! - top! >= 1 + 0.4, `clip edge ${height! - top!}em leaves 0.4em under the 1em line box for a serif j`);
  assert.ok(side! >= 0.3 && side === sideBack, `the mask reaches ${side}em beside the advance for a j hook, and the negative margin gives it back`);
  assert.ok(Math.abs(height! - top! - bottom! - 1.05) < 1e-9, 'the negative margins keep the layout height of the old mask');
  const waiting = Number(/translateY\(([-\d.e]+)%\)/.exec(render(30, <text.GlyphRise {...base} frame={30} text="jumpy gig" />))![1]);
  assert.ok(waiting / 100 >= height!, `a word waiting at ${waiting}% sits wholly below the clip edge, so nothing peeks in before the rise`);
});

test('LogoOutro centres the brand on the rule and tagline: the spacer is the brand row itself, centred by default', () => {
  const markup = render(100, <cards.LogoOutro {...base} frame={100} out={undefined} brand="AVA Tova" tagline="calm water" />);
  assert.ok(/^<div style="position:absolute;display:flex;visibility:visible;left:0;right:0;padding-inline:5%;justify-content:center/.test(markup), 'centred in the safe area without align');
  const glyphSpans = (part: string) => [...part.matchAll(/<span style="(display:inline-block;overflow:hidden[^"]*)">/g)].map(m => m[1]);
  const [row, spacer] = markup.split('visibility:hidden');
  assert.deepEqual(glyphSpans(spacer!), glyphSpans(row!), 'the spacer repeats the per-glyph masks, so a kerned text run cannot make it narrower than the brand');
  assert.equal(glyphSpans(row!).length, Array.from('AVA Tova').length);
});

test('sample-data tags speak the film language: copy script, lang, or the given text', () => {
  const tagOf = (node: React.ReactNode) => /border-radius:999px[^>]*>([^<]+)</.exec(render(100, node))?.[1];
  const held = {...base, out: undefined};
  assert.equal(tagOf(<cards.StatCard {...held} frame={100} value={92} unit="%" label="returning riders" />), 'Sample');
  assert.equal(tagOf(<cards.StatCard {...held} frame={100} value={92} unit="%" label="다시 돌아온 비율" />), '예시');
  assert.equal(tagOf(<cards.StatCard {...held} frame={100} value={92} unit="%" label="riders" lang="ja" />), 'サンプル');
  assert.equal(tagOf(<text.Counter {...held} frame={100} to={12} unit="km" example="Sample data" />), 'Sample data');
  assert.equal(tagOf(<cards.StatCard {...held} frame={100} value={92} label="riders" example={false} />), undefined);
  const chart = render(100, <charts.BarChart frame={100} at={30} palette={base.palette} fonts={base.fonts} data={[{label: 'Mon', value: 3}, {label: 'Tue', value: 5}]} />);
  assert.ok(chart.includes('>Sample</div>') && !chart.includes('예시'), 'an English chart gets an English tag');
});

test('HighlightSweep: the word is ink while the bar sweeps and paper on accent once it is full', () => {
  const sweep = (f: number) => render(f, <text.HighlightSweep {...base} frame={f} before="a " word="b" after=" c" delay={0} sweep={10} />);
  assert.ok(sweep(35).includes('color:#111">b<'), 'ink mid-sweep');
  assert.ok(sweep(60).includes('background:#f50"><span') && sweep(60).includes('color:#eee">b<'), 'paper on the accent wrapper when full');
});

test('catalogue ids are unique and name every exported block', () => {
  const entries = [...text.TEXT_BLOCKS, ...lower.LOWER_THIRD_BLOCKS, ...cards.CARD_BLOCKS];
  const ids = entries.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  const components = [text, lower, cards].flatMap(module => Object.entries(module).filter(([name, value]) => typeof value === 'function' && /^[A-Z]/.test(name)).map(([name]) => name));
  for (const name of components) assert.ok(ids.includes(name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()), `${name} is in the catalogue`);
  assert.ok(components.length >= 13, `expected at least 13 blocks, found ${components.length}`);
  for (const entry of entries) assert.ok(entry.when && entry.props.length, `${entry.id} carries props and when-to-use`);
});

test('a clipped-text failure names the block whose mask clips it and says what to change', () => {
  const inBlock = clippedTextMessage([{text: 'j', side: 'left', px: 8, block: 'GlyphRise'}]);
  assert.match(inBlock, /^Clipped text: "j" left 8px in <GlyphRise>\. Fix: .*widen blockMask/);
  assert.match(clippedTextMessage([{text: 'jam', side: 'bottom', px: 3, block: null}]), /^Clipped text: "jam" bottom 3px\. Fix: grow the clipping box/);
  assert.match(render(34, <text.GlyphRise {...base} frame={34} text="jam" />), /^<div data-block="GlyphRise"/);
});
