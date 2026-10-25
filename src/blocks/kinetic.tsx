import React from 'react';
import {Easing, MotionProbe, interpolate, random, spring, useVideoConfig} from 'frameforge';
import {blockMask, blockPlace, blockRise, MASK_DROP, type BlockFonts, type BlockPalette} from './text';
import type {BlockEntry} from './types';

/* Kinetic type: blocks where the motion acts out the words (a beat per word, a thread that thinks, a field of text being read, a whip
 * between colour fields, a mosaic that flips on the beat, a switch that turns on). Each is a pure function of `frame`; seeded parts
 * use `random(seed)`. The full-frame ones (WordBeat, TextField, WhipPan, BauhausMosaic) fill their parent, so put them in an AbsoluteFill. */

type Kinetic = {frame: number; at: number; fps?: number; palette: BlockPalette; id?: string};
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const fill: React.CSSProperties = {position: 'absolute', inset: 0, overflow: 'hidden'};

/** Relative luminance of a #rgb/#rrggbb colour (0 black .. 1 white). */
export function luminance(hex: string): number {
  const h = hex.replace('#', ''), full = h.length === 3 ? [...h].map(d => d + d).join('') : h;
  const [r, g, b] = [0, 2, 4].map(i => { const c = parseInt(full.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
/** Of `choices`, the colour that reads best on `field`. */
export const readableOn = (field: string, choices: string[]) => choices.reduce((best, c) => contrast(c, field) > contrast(best, field) ? c : best);

/* ---------------- WordBeat ---------------- */

/** One word per beat. On every beat the whole frame cuts to the next flat colour field and the next word punches in (whole word, scale
 * 1.35 → 1 on a spring, then a slow push so no frame is still); the text colour is whichever palette colour reads best on the field.
 * `punctuation` lands on the last word in a contrasting accent. */
export function WordBeat({frame, at, fps = 30, palette, fonts, size, words, beat = 15, fields, punctuation = '', weight = 900, id = `wordbeat-${at}`}: Kinetic & {fonts: BlockFonts; size: number; words: string[]; beat?: number; fields?: string[]; punctuation?: string; weight?: number}) {
  const colours = fields ?? [palette.accent, palette.ink, palette.soft, palette.paper];
  const k = Math.min(words.length - 1, Math.max(0, Math.floor((frame - at) / beat)));
  const local = frame - at - k * beat, field = colours[k % colours.length]!;
  const ink = readableOn(field, [palette.ink, palette.paper, palette.accent, palette.soft]);
  const punch = 1 + 0.35 * (1 - spring({frame: local, fps, durationInFrames: Math.min(beat, 10), config: {damping: 14, stiffness: 220}}));
  const push = 1 + 0.06 * Math.min(1, local / (beat * 3));
  const last = k === words.length - 1, mark = readableOn(field, [palette.accent, palette.soft, ink].filter(c => c !== field));
  return <div data-block="WordBeat" style={{...fill, background: `radial-gradient(120% 120% at 50% 45%, ${field} 55%, color-mix(in srgb, ${field} 82%, #000) 100%)`, visibility: frame < at ? 'hidden' : 'visible'}}>
    <MotionProbe id={id} value={punch} family="text" axis="scale" />
    <div style={{...fill, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <span style={{display: 'inline-block', color: ink, fontFamily: fonts.display, fontSize: size, fontWeight: weight, lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'nowrap', transform: `scale(${punch * push}) translateY(${(punch - 1) * 0.12}em)`}}>
        {words[k]}{last && punctuation ? <span style={{color: mark}}>{punctuation}</span> : null}
      </span>
    </div>
  </div>;
}

/* ---------------- Thread ---------------- */

type Pt = [number, number];
/** A dense polyline through `points` (Catmull-Rom), with a full loop-de-loop of radius `curl` at each index in `loops`. */
export function threadPoints(points: Pt[], loops: number[] = [], curl = 40, steps = 24): Pt[] {
  const out: Pt[] = [];
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(d => 0.5 * (2 * p1[d]! + (-p0[d]! + p2[d]!) * t + (2 * p0[d]! - 5 * p1[d]! + 4 * p2[d]! - p3[d]!) * t2 + (-p0[d]! + 3 * p1[d]! - 3 * p2[d]! + p3[d]!) * t3)) as Pt);
    }
    if (loops.includes(i + 1) && i + 2 < points.length) {
      // The loop is a circle tangent to the path at the point: forward, up, back over the top, down and on.
      const p = at(i + 1), q = at(i + 2), len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, tx = (q[0] - p[0]) / len, ty = (q[1] - p[1]) / len;
      const nx = ty, ny = -tx;
      for (let s = 0; s < 48; s++) { const u = (s / 48) * Math.PI * 2; out.push([p[0] + curl * (Math.sin(u) * tx + (1 - Math.cos(u)) * nx), p[1] + curl * (Math.sin(u) * ty + (1 - Math.cos(u)) * ny)]); }
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** A line that draws itself under and through the words over `draw` frames, a glowing dot on its head, curling into a loop at each
 * index in `loops`. Each word rises (whole, from its mask) when the head reaches it, or at its own `at`. Once drawn, a glint keeps
 * running along the line and the head dot breathes. Coordinates are px in the composition. */
export function Thread({frame, at, palette, fonts, points, loops = [], curl = 42, draw = 45, words = [], stroke = 6, color, id = `thread-${at}`}: Kinetic & {fonts: BlockFonts; points: Pt[]; loops?: number[]; curl?: number; draw?: number; words?: {text: string; x: number; y: number; size: number; weight?: number; at?: number; color?: string}[]; stroke?: number; color?: string}) {
  const {width, height} = useVideoConfig();
  const line = threadPoints(points, loops, curl);
  const lengths = [0];
  for (let i = 1; i < line.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1]));
  const total = lengths[lengths.length - 1]!;
  const p = blockRise(frame, at, draw, Easing.inOut(Easing.cubic)), drawn = p * total;
  let j = 0;
  while (j < lengths.length - 1 && lengths[j + 1]! < drawn) j++;
  const f = lengths[j + 1]! > lengths[j]! ? (drawn - lengths[j]!) / (lengths[j + 1]! - lengths[j]!) : 0;
  const head: Pt = j < line.length - 1 ? [line[j]![0] + (line[j + 1]![0] - line[j]![0]) * f, line[j]![1] + (line[j + 1]![1] - line[j]![1]) * f] : line[line.length - 1]!;
  const d = 'M ' + line.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
  const ink = color ?? palette.accent, glint = (frame - at - draw) / 50;
  // The frame the head passes nearest the word's lower left corner (words without their own `at`).
  const reach = (w: {x: number; y: number; size: number}) => { let best = 0; line.forEach((q, i) => { if (Math.hypot(q[0] - w.x, q[1] - w.y - w.size) < Math.hypot(line[best]![0] - w.x, line[best]![1] - w.y - w.size)) best = i; }); return at + draw * lengths[best]! / total; };
  return <div data-block="Thread" style={{...fill, visibility: frame < at ? 'hidden' : 'visible'}}>
    <MotionProbe id={id} value={p} family="shape" axis="progress" />
    {words.map((w, i) => {
      const lift = blockRise(frame, w.at ?? reach(w) - 4, 8);
      return <div key={i} style={{position: 'absolute', left: w.x, top: w.y, color: w.color ?? palette.paper, fontFamily: fonts.display, fontSize: w.size, fontWeight: w.weight ?? 800, lineHeight: 1, whiteSpace: 'nowrap'}}>
        <span style={blockMask}><span style={{display: 'inline-block', transform: `translateY(${(1 - lift) * MASK_DROP}%)`, visibility: lift <= 0 ? 'hidden' : 'visible'}}>{w.text}</span></span>
      </div>;
    })}
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <path d={d} fill="none" stroke={ink} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${total} ${total}`} strokeDashoffset={total - drawn} />
      {p >= 1 ? <path d={d} fill="none" stroke={palette.paper} strokeOpacity={0.85} strokeWidth={stroke * 0.6} strokeLinecap="round" strokeDasharray={`${total * 0.06} ${total}`} strokeDashoffset={-((glint % 1.4) - 0.2) * total} /> : null}
      <circle cx={line[0]![0]} cy={line[0]![1]} r={stroke * 1.3} fill={ink} />
      <circle cx={head[0]} cy={head[1]} r={stroke * (2.4 + (p >= 1 ? 0.5 * Math.sin((frame - at) / 6) : 0))} fill={ink} opacity={0.25} />
      <circle cx={head[0]} cy={head[1]} r={stroke * 1.4} fill={palette.paper} stroke={ink} strokeWidth={stroke * 0.7} />
    </svg>
  </div>;
}

/* ---------------- TextField ---------------- */

const CORPUS = ['Step one: read the question.', 'measure twice, cut once', 'const words = page.split(" ");', 'Dear reader, thank you for the letter.', 'p < 0.05, n = 1,024', 'Fold the flour in slowly.', 'SELECT idea FROM everything WHERE useful;', 'Every page, every line, every word.', 'Q3 revenue grew 12% quarter over quarter', 'Once upon a time, by the sea,', 'for (const line of book) read(line);', 'Hope is the thing with feathers'];
const escapeXml = (s: string) => s.replace(/[<>&'"]/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'}[c]!));

/** A field of dense small text, row after row scrolling at seeded speeds and directions, behind whatever `children` holds (the hero line).
 * The rows are drawn as SVG images, not DOM text: they are texture to look at, not copy to read, so the layout audit does not count
 * them. `corpus` is the text to repeat; write it in the film's language. `highlight` lights one row in the accent every `beat` frames. */
export function TextField({frame, at, palette, rows = 24, corpus = CORPUS, font = 'ui-monospace, Menlo, monospace', speed = 1, background, color, seed = 'field', beat = 0, children}: Kinetic & {rows?: number; corpus?: string[]; font?: string; speed?: number; background?: string; color?: string; seed?: string; beat?: number; children?: React.ReactNode}) {
  const {width, height} = useVideoConfig();
  const rowH = height / rows, fontSize = rowH * 0.62, ink = color ?? palette.ink, bg = background ?? palette.accent;
  const lit = beat > 0 ? Math.floor(random(`${seed}-lit-${Math.floor((frame - at) / beat)}`) * rows) : -1;
  return <div data-block="TextField" style={{...fill, background: bg, visibility: frame < at ? 'hidden' : 'visible'}}>
    <div aria-hidden data-size="allow" data-clip="allow" style={fill}>
      {Array.from({length: rows}, (_, r) => {
        const pick = (k: number) => corpus[Math.floor(random(`${seed}-${r}-${k}`) * corpus.length)]!;
        const line = Array.from({length: 14}, (_, k) => pick(k)).join('  ·  ');
        const tileW = Math.ceil(line.length * fontSize * 0.6);
        const dir = random(`${seed}-dir-${r}`) < 0.5 ? -1 : 1, v = (0.6 + 1.8 * random(`${seed}-v-${r}`)) * speed;
        const x = ((((frame - at) * v * dir) % tileW) + tileW) % tileW - tileW;
        const tone = r === lit ? palette.paper : ink, opacity = r === lit ? 1 : 0.38 + 0.4 * random(`${seed}-o-${r}`);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="${Math.ceil(rowH)}"><text x="0" y="${(rowH * 0.72).toFixed(1)}" font-family="${escapeXml(font)}" font-size="${fontSize.toFixed(1)}" fill="${tone}">${escapeXml(line)}</text></svg>`;
        return <div key={r} style={{position: 'absolute', left: 0, top: r * rowH, width: width + tileW * 2, height: Math.ceil(rowH), opacity, transform: `translateX(${x}px)`, backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, backgroundRepeat: 'repeat-x', backgroundSize: `${tileW}px ${Math.ceil(rowH)}px`}} />;
      })}
    </div>
    {children}
  </div>;
}

/* ---------------- WhipPan ---------------- */

/** A whip pan from `from` to `to`: both move together along `direction` with a quintic in-out, and while they move an SVG Gaussian blur
 * along that axis only (its deviation follows the speed) smears them, as a camera whip does. At the middle frame the frame is half
 * outgoing, half incoming, so no frame is a single flat colour or a full blur. */
export function WhipPan({frame, at, dur = 8, direction = 'left', smear = 0.2, from, to, id = `whip-${at}`}: Omit<Kinetic, 'palette'> & {dur?: number; direction?: 'left' | 'right' | 'up' | 'down'; smear?: number; from: React.ReactNode; to: React.ReactNode}) {
  const {width, height} = useVideoConfig(), ease = Easing.inOut(Easing.poly(5));
  const u = (f: number) => interpolate(f, [at, at + dur], [0, 1], {...CLAMP, easing: ease});
  const [ax, sign] = {left: ['X', -1], right: ['X', 1], up: ['Y', -1], down: ['Y', 1]}[direction] as ['X' | 'Y', number];
  const t = u(frame), span = ax === 'X' ? width : height;
  // Blur deviation: `smear` of the distance moved in one frame, capped at 4 % of the frame so the boundary and the type stay visible.
  const sd = Math.min(span * 0.04, (u(frame + 0.5) - u(frame - 0.5)) * span * smear), filterId = `${id}-blur`;
  const blur = sd > 0.5 ? `url(#${filterId})` : 'none';
  return <div data-block="WhipPan" style={{...fill}}>
    <MotionProbe id={id} value={t * span * sign} family="camera" axis={ax === 'X' ? 'x' : 'y'} />
    <svg width={0} height={0} style={{position: 'absolute'}}><filter id={filterId} x="0" y="0" width="100%" height="100%"><feGaussianBlur edgeMode="duplicate" stdDeviation={ax === 'X' ? `${sd.toFixed(2)} 0` : `0 ${sd.toFixed(2)}`} /></filter></svg>
    <div style={{...fill, filter: blur}}>
      {t < 1 ? <div data-clip="allow" style={{...fill, transform: `translate${ax}(${sign * t * 100}%)`}}>{from}</div> : null}
      {t > 0 ? <div data-clip="allow" style={{...fill, transform: `translate${ax}(${sign * (t - 1) * 100}%)`}}>{to}</div> : null}
    </div>
  </div>;
}

/* ---------------- BauhausMosaic ---------------- */

type TileState = {bg: string; fg: string; shape: number; turn: number};
const SHAPES = 6;  // quarter circle, circle, ring, triangle, half circle, dot
function tile(seed: string, cell: number, k: number, colours: string[]): TileState {
  const r = (n: string) => random(`${seed}-${cell}-${k}-${n}`);
  const bg = colours[Math.floor(r('bg') * colours.length)]!;
  const rest = colours.filter(c => c !== bg);
  return {bg, fg: rest[Math.floor(r('fg') * rest.length)]!, shape: Math.floor(r('shape') * SHAPES), turn: Math.floor(r('turn') * 4)};
}
function Shape({s, n}: {s: TileState; n: number}) {
  const h = n / 2;
  switch (s.shape) {
    case 0: return <path d={`M 0 0 L ${n} 0 A ${n} ${n} 0 0 1 0 ${n} Z`} fill={s.fg} />;
    case 1: return <circle cx={h} cy={h} r={n * 0.42} fill={s.fg} />;
    case 2: return <circle cx={h} cy={h} r={n * 0.3} fill="none" stroke={s.fg} strokeWidth={n * 0.16} />;
    case 3: return <path d={`M 0 0 L ${n} 0 L 0 ${n} Z`} fill={s.fg} />;
    case 4: return <path d={`M 0 ${h} A ${h} ${h} 0 0 1 ${n} ${h} Z`} fill={s.fg} />;
    default: return <><rect x={n * 0.12} y={n * 0.12} width={n * 0.76} height={n * 0.76} fill={s.fg} /><circle cx={h} cy={h} r={n * 0.16} fill={s.bg} /></>;
  }
}

/** A frame-filling seeded grid of Bauhaus tiles (quarter circles, circles, rings, triangles, half circles, dots) in `colours`. On every
 * `beat` a wave runs out from a seeded origin; each cell it reaches flips over (a card turn on its vertical axis) to its next seeded tile.
 * `cols` sets the cell size; rows fill the height. */
export function BauhausMosaic({frame, at, palette, colours, cols = 16, beat = 15, wave = 1.2, flip = 6, seed = 'mosaic', id = `mosaic-${at}`}: Kinetic & {colours?: string[]; cols?: number; beat?: number; wave?: number; flip?: number; seed?: string}) {
  const {width, height} = useVideoConfig();
  const list = colours ?? [palette.accent, palette.ink, palette.paper, palette.soft];
  const n = width / cols, rows = Math.ceil(height / n);
  const t = frame - at;
  const origin = (k: number): Pt => [random(`${seed}-ox-${k}`) * cols, random(`${seed}-oy-${k}`) * rows];
  const cells: React.ReactNode[] = [];
  let turning = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const c = y * cols + x;
    // The wave of beat k reaches the cell `dist * wave` frames after the beat; the cell shows the tile of the last wave that reached it.
    let k = Math.floor(t / beat), since = 0;
    for (; k >= 0; k--) { const [ox, oy] = origin(k); since = t - k * beat - Math.hypot(x - ox, y - oy) * wave; if (since >= 0) break; }
    const now = tile(seed, c, k, list), before = tile(seed, c, k - 1, list);
    const q = k >= 0 ? Math.min(1, since / flip) : 1;
    if (q < 1) turning++;
    // The tile colour switches at the half turn; the shape flips on its vertical axis or pops (seeded per cell), so no gap opens.
    const s = q < 0.5 ? before : now, k2 = Math.abs(Math.cos(Math.PI * q)), pop = random(`${seed}-pop-${c}`) < 0.4;
    cells.push(<g key={c} transform={`translate(${x * n} ${y * n})`}>
      <rect width={n + 0.5} height={n + 0.5} fill={s.bg} />
      <g transform={`translate(${n / 2} ${n / 2}) scale(${Math.max(0.02, k2)} ${pop ? Math.max(0.02, k2) : 1}) rotate(${s.turn * 90}) translate(${-n / 2} ${-n / 2})`}><Shape s={s} n={n} /></g>
    </g>);
  }
  return <div data-block="BauhausMosaic" style={{...fill, background: palette.ink, visibility: frame < at ? 'hidden' : 'visible'}}>
    <MotionProbe id={id} value={turning / (rows * cols)} family="shape" axis="progress" />
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', inset: 0}}>{cells}</svg>
  </div>;
}

/* ---------------- Toggle ---------------- */

/** A glossy switch that flips on at `on`: the knob travels on a spring with a squash at full speed, the accent fills the track behind it,
 * the track has an inner shadow and a top highlight, the knob a soft drop shadow, and once on a glow breathes around it. `size` is the
 * track height in px. */
export function Toggle({frame, at, on, fps = 30, palette, size, x, y, align = 'center', offColour, id = `toggle-${at}`}: Kinetic & {on: number; size: number; x?: number; y?: number; align?: 'left' | 'center' | 'right'; offColour?: string}) {
  const w = size * 2.1, pad = size * 0.09, knob = size - pad * 2, travel = w - knob - pad * 2;
  const enter = blockRise(frame, at, 10);
  const s = spring({frame, fps, delay: on, durationInFrames: 18, config: {damping: 13, stiffness: 180}});
  const speed = Math.abs(s - spring({frame: frame - 1, fps, delay: on, durationInFrames: 18, config: {damping: 13, stiffness: 180}}));
  const squash = 1 + Math.min(0.18, speed * 1.4);
  const glow = s > 0.9 ? 0.55 + 0.25 * Math.sin((frame - on) / 7) : s * 0.5;
  const off = offColour ?? `color-mix(in srgb, ${palette.ink} 70%, ${palette.paper})`;
  return <div data-block="Toggle" style={blockPlace({x, y, align}, frame < at)}>
    <MotionProbe id={id} value={s * travel} family="shape" axis="x" />
    <div style={{position: 'relative', width: w, height: size, borderRadius: size, background: off, transform: `scale(${0.6 + 0.4 * enter})`, opacity: enter,
      boxShadow: `inset 0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.45), inset 0 0 0 ${Math.max(1, size * 0.012)}px rgba(255,255,255,0.18), 0 ${size * 0.05}px ${size * 0.1}px rgba(0,0,0,0.18), 0 0 ${size * 0.6 * glow}px color-mix(in srgb, ${palette.accent} ${Math.round(glow * 80)}%, transparent)`, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: pad * 2 + knob + s * travel, borderRadius: size, background: `linear-gradient(180deg, color-mix(in srgb, ${palette.accent} 80%, #fff), ${palette.accent} 55%, color-mix(in srgb, ${palette.accent} 80%, #000))`, opacity: Math.min(1, s * 1.4)}} />
      <div style={{position: 'absolute', left: size * 0.18, right: size * 0.18, top: size * 0.05, height: size * 0.32, borderRadius: size, background: 'linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0))'}} />
      <div style={{position: 'absolute', left: pad + s * travel, top: pad, width: knob, height: knob, borderRadius: knob, transformOrigin: 'center', transform: `scaleX(${squash}) scaleY(${1 / Math.sqrt(squash)})`,
        background: `radial-gradient(circle at 35% 30%, #ffffff, ${palette.paper} 45%, color-mix(in srgb, ${palette.paper} 75%, #000) 100%)`, boxShadow: `0 ${size * 0.06}px ${size * 0.14}px rgba(0,0,0,0.4), inset 0 -${size * 0.03}px ${size * 0.06}px rgba(0,0,0,0.18)`}} />
    </div>
  </div>;
}

export const KINETIC_BLOCKS: BlockEntry[] = [
  {id: 'word-beat', title: 'Word beat', family: 'kinetic', props: ['words[]', 'size', 'beat=15', 'fields[]', 'punctuation', 'weight=900'], when: 'A sentence spoken one word per beat ("STACK / SHIFT / SHIP."): each beat cuts the whole frame to the next flat colour field and punches the word in.'},
  {id: 'thread', title: 'Thread', family: 'kinetic', props: ['points[[x,y]]', 'loops[]', 'curl=42', 'draw=45', 'words[{text,x,y,size,at?}]', 'stroke=6', 'color'], when: 'Thinking, connecting, following through: a line draws under and through the words, curls into loops, and each word rises as the head reaches it.'},
  {id: 'text-field', title: 'Text field', family: 'kinetic', props: ['rows=24', 'corpus[]', 'font', 'speed=1', 'background', 'color', 'seed', 'beat=0', 'children'], when: 'Reading, knowledge, volume: dense small text scrolls row by row behind a hero line passed as children.'},
  {id: 'whip-pan', title: 'Whip pan', family: 'kinetic', props: ['from', 'to', 'dur=8', "direction='left'|'right'|'up'|'down'", 'smear=0.2'], when: 'A cut between two colour fields or scenes as a fast camera whip with directional motion blur, never a flat or fully blurred frame.'},
  {id: 'bauhaus-mosaic', title: 'Bauhaus mosaic', family: 'kinetic', props: ['colours[]', 'cols=16', 'beat=15', 'wave=1.2', 'flip=6', 'seed'], when: 'A geometric, design-led beat: a frame-filling grid of Bauhaus tiles that flips in waves on every beat.'},
  {id: 'toggle', title: 'Toggle', family: 'kinetic', props: ['on', 'size', 'x', 'y', "align='center'", 'offColour'], when: 'Switching something on, as a premium object: a glossy switch whose knob springs across while the accent fills the track.'},
];
