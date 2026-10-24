import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {FrameProvider} from '../src/core/index';
import * as charts from '../src/blocks/charts';
import * as code from '../src/blocks/code';
import * as diagrams from '../src/blocks/diagrams';
import {BarChart, BarChartRace, CHART_BLOCKS, Donut, Heatmap, LineChart, Sparkline} from '../src/blocks/charts';
import {CODE_BLOCKS, CodeBlock, tokenize} from '../src/blocks/code';
import {Compare, DIAGRAM_BLOCKS, Flowchart, ProcessSteps, Timeline} from '../src/blocks/diagrams';

const config = {id: 'Blocks', width: 1920, height: 1080, fps: 30, durationInFrames: 900};
const palette = {ink: '#111111', paper: '#F4F4F1', accent: '#2F5BFF', soft: '#DDE4FF'};
const fonts = {display: 'serif', ui: 'sans-serif'};
const render = (frame: number, node: (frame: number) => React.ReactNode) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{node(frame)}</FrameProvider>);
const common = {at: 100, palette, fonts, size: 40, width: 1200, height: 600};
const bars = [{label: '1월', value: 20}, {label: '2월', value: 50}, {label: '3월', value: 80}];
const blocks: Record<string, (frame: number) => React.ReactNode> = {
  BarChart: f => <BarChart frame={f} {...common} data={bars} target={60} unit="만" />,
  LineChart: f => <LineChart frame={f} {...common} data={bars} />,
  BarChartRace: f => <BarChartRace frame={f} {...common} duration={90} snapshots={[{label: 'a', values: {x: 3, y: 2, z: 1}}, {label: 'b', values: {x: 1, y: 2, z: 3}}]} />,
  Donut: f => <Donut frame={f} {...common} value={72} label="달성" />,
  Heatmap: f => <Heatmap frame={f} {...common} rows={[[1, 2], [3, 4]]} rowLabels={['월', '화']} colLabels={['오전', '오후']} order="seeded" />,
  Sparkline: f => <Sparkline frame={f} {...common} data={[1, 3, 2, 5]} />,
  CodeBlock: f => <CodeBlock frame={f} {...common} code={'const a = 1;\nlet b = "x";'} lang="ts" mode="typing" />,
  Flowchart: f => <Flowchart frame={f} {...common} nodes={[{id: 'a', label: '입력'}, {id: 'b', label: '분류', shape: 'pill'}, {id: 'c', label: '알림'}]} />,
  ProcessSteps: f => <ProcessSteps frame={f} {...common} steps={['연결', '분류', '확인']} />,
  Timeline: f => <Timeline frame={f} {...common} items={[{date: '1월', label: '시작'}, {date: '3월', label: '출시'}, {date: '6월', label: '확장'}]} />,
  Compare: f => <Compare frame={f} {...common} columns={['기본', '프로']} rows={[{label: '알림', a: true, b: true}, {label: '예산', a: false, b: true}]} />,
};

test('every block is hidden before at, renders mid-animation and is deterministic per frame', () => {
  for (const [name, node] of Object.entries(blocks)) {
    assert.equal(render(99, node), '', `${name} before at`);
    for (const frame of [100, 120, 400]) {
      const markup = render(frame, node);
      assert.ok(markup.length > 100, `${name} at ${frame} draws something`);
      assert.equal(markup, render(frame, node), `${name} at ${frame} is deterministic`);
    }
    assert.notEqual(render(105, node), render(400, node), `${name} animates`);
  }
});

test('bar chart: heights proportional to the data when settled, counters show the final numbers', () => {
  const markup = render(400, f => <BarChart frame={f} {...common} data={bars} radius={0} />);
  const heights = [...markup.matchAll(/<rect [^>]*height="([\d.]+)"/g)].map(m => Number(m[1]));
  assert.equal(heights.length, 3);
  assert.ok(Math.abs(heights[1]! / heights[0]! - 2.5) < 1e-6 && Math.abs(heights[2]! / heights[0]! - 4) < 1e-6, `heights ${heights}`);
  for (const v of ['20', '50', '80']) assert.ok(markup.includes(`>${v}<`), `counter ${v}`);
  const early = render(104, f => <BarChart frame={f} {...common} data={bars} radius={0} />);
  const first = [...early.matchAll(/<rect [^>]*height="([\d.]+)"/g)].map(m => Number(m[1]));
  assert.ok(first[0]! > 0 && first[2]! < heights[2]!, 'bars grow over time');
});

test('bar chart race: rows follow the last snapshot once settled', () => {
  const markup = render(400, blocks.BarChartRace!);
  const rows = [...markup.matchAll(/data-row="(\w+)"[^>]*top:([\d.]+)px/g)].map(m => [m[1], Number(m[2])] as const).sort((p, q) => p[1] - q[1]).map(r => r[0]);
  assert.deepEqual(rows, ['z', 'y', 'x']);
  const start = [...render(100, blocks.BarChartRace!).matchAll(/data-row="(\w+)"[^>]*top:([\d.]+)px/g)].map(m => [m[1], Number(m[2])] as const).sort((p, q) => p[1] - q[1]).map(r => r[0]);
  assert.deepEqual(start, ['x', 'y', 'z']);
  const barH = (markup: string, name: string) => Number(new RegExp(`data-row="${name}".*?height:([\\d.]+)px;width:`).exec(markup)![1]);
  const frames = Array.from({length: 89}, (_, i) => render(101 + i, blocks.BarChartRace!));
  assert.ok(Math.min(...frames.map(m => barH(m, 'x'))) < barH(frames[0]!, 'y') * 0.5, 'a bar moving down thins while it crosses another');
  assert.ok(frames.every(m => barH(m, 'z') === barH(m, 'y')), 'the rising bar keeps its height');
});

test('donut and line chart counters land on the data', () => {
  assert.ok(render(400, blocks.Donut!).includes('>72%<'));
  assert.ok(render(400, blocks.LineChart!).includes('>80<'));
});

test('tokeniser: one sample per language', () => {
  const kinds = (src: string, lang: Parameters<typeof tokenize>[1]) => tokenize(src, lang).map(t => `${t.kind}:${t.text}`);
  assert.deepEqual(kinds('const n = 42; // hi', 'ts'), ['keyword:const', 'space: ', 'ident:n', 'space: ', 'punct:=', 'space: ', 'number:42', 'punct:;', 'space: ', 'comment:// hi']);
  assert.deepEqual(kinds('def f(): return "s"', 'python').filter(t => !t.startsWith('space')), ['keyword:def', 'ident:f', 'punct:(', 'punct:)', 'punct::', 'keyword:return', 'string:"s"']);
  assert.deepEqual(kinds('{"a": true}', 'json'), ['punct:{', 'string:"a"', 'punct::', 'space: ', 'keyword:true', 'punct:}']);
  assert.deepEqual(kinds('echo $HOME # c', 'bash').filter(t => !t.startsWith('space')), ['keyword:echo', 'ident:$HOME', 'comment:# c']);
  assert.deepEqual(kinds('if x', 'plain'), ['ident:if', 'space: ', 'ident:x']);
  assert.deepEqual(kinds('`a ${b}`', 'js')[0], 'string:`a ${b}`');
});

test('code block modes: typing reveals characters, highlight dims the others, diff and scroll render', () => {
  const src = 'a\nb\nc\nd';
  const typing = (f: number) => render(f, fr => <CodeBlock frame={fr} {...common} code={src} lang="plain" mode="typing" charsPerFrame={1} />);
  assert.ok(typing(101).includes('>a<') && !typing(101).includes('>c<'), 'first characters only');
  assert.ok(typing(400).includes('>d<'), 'all characters when settled');
  const highlight = render(400, f => <CodeBlock frame={f} {...common} code={src} lang="plain" mode="highlight" highlight={[2, 3]} />);
  assert.ok((highlight.match(/opacity:0\.3/g) ?? []).length >= 2, 'two lines dimmed');
  assert.ok(render(400, f => <CodeBlock frame={f} {...common} code={'+a\n-b\n c'} lang="plain" mode="diff" />).includes('>+<'));
  const scroll = render(400, f => <CodeBlock frame={f} {...common} code={src} lang="plain" mode="scroll" scrollTo={3} lines={2} />);
  assert.ok(scroll.includes('data-clip="allow"'), 'the scroll window marks its intended overflow');
});

test('catalogue ids are unique and every entry names an exported block', () => {
  const entries = [...CHART_BLOCKS, ...CODE_BLOCKS, ...DIAGRAM_BLOCKS];
  assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
  const exported: Record<string, unknown> = {...charts, ...code, ...diagrams};
  for (const e of entries) {
    const name = e.id.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());
    assert.equal(typeof exported[name], 'function', `${e.id} -> ${name}`);
    assert.ok(e.props.includes('frame') && e.props.includes('at') && e.props.includes('palette'), `${e.id} lists the contract props`);
  }
  for (const name of Object.keys(blocks)) assert.ok(entries.some(e => e.id.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase()) === name), `${name} catalogued`);
});
