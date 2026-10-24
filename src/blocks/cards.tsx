import type {ComponentType, CSSProperties, ReactNode} from 'react';
import {MotionProbe} from 'frameforge';
import type {ArtProps} from '@/assets';
import {blockPhase, blockPlace, blockRise, blockSettle, Counter, GlyphRise, type BlockProps} from './text';
import type {BlockEntry} from './types';

/** A big Counter over a label on a paper card with the template's ink offset block; the 예시 tag sits beside the label so the number never
 * meets the card edge. The card springs up from below and drops back out. */
export function StatCard({value, label, unit = '', prefix = '', decimals = 0, example = true, width, height, ...props}: BlockProps & {value: number; label: string; unit?: string; prefix?: string; decimals?: number; example?: boolean; width?: number; height?: number}) {
  const {frame, at, size, palette, fonts, fps = 30, id = `stat-${at}`} = props;
  const w = width ?? size * 10, h = height ?? size * 5.2, offset = size * 0.4;
  const {leave, hidden} = blockPhase(props, 1, 14);
  const lift = (1 - blockSettle(frame, at, 20, fps, true) + leave) * h * 3;
  return <div style={blockPlace(props, hidden)}>
    <MotionProbe id={id} value={lift} family="card" axis="y" />
    <div style={{position: 'relative', width: w, height: h, transform: `translateY(${lift}px)`}}>
      <div style={{position: 'absolute', left: offset, top: offset, width: w, height: h, background: palette.ink}} />
      <div style={{position: 'absolute', inset: 0, background: palette.paper}}>
        <Counter {...props} id={`${id}-count`} at={at + 8} x={size * 0.6} y={size * 0.55} size={size * 2.4} to={value} unit={unit} prefix={prefix} decimals={decimals} count={36} />
        <div style={{position: 'absolute', left: size * 0.6, bottom: size * 0.55, display: 'flex', alignItems: 'center', gap: size * 0.4, fontFamily: fonts.ui, fontSize: size, fontWeight: 500, color: palette.ink, whiteSpace: 'nowrap', opacity: blockRise(frame, at + 16, 10)}}>
          {label}{example ? <span style={{fontSize: size * 0.7, padding: '0.1em 0.5em', border: `${Math.max(2, size * 0.03)}px solid currentColor`, borderRadius: 999}}>예시</span> : null}
        </div>
      </div>
    </div>
  </div>;
}

/** An OS-neutral toast: a drawn kit icon in a soft slot, title, body and time (0.8×). Slides in from the top or the right, holds, slides back out. */
export function NotificationCard({icon: Icon, title, body, time, from = 'top', width, ...props}: BlockProps & {icon: ComponentType<ArtProps>; title: string; body: string; time: string; from?: 'top' | 'right'; width?: number}) {
  const {frame, at, size, palette, fonts, fps = 30, x, y, id = `toast-${at}`} = props;
  const w = width ?? size * 11, pad = size * 0.5;
  const {leave, hidden} = blockPhase(props, 1, 12);
  const spring = blockSettle(frame, at, 18, fps, true);
  const d = 1 - spring + leave;
  const place: CSSProperties = {position: 'absolute', display: 'flex', visibility: hidden ? 'hidden' : 'visible',
    ...(x === undefined ? (from === 'top' ? {left: 0, right: 0, justifyContent: 'center'} : {right: '5%'}) : {left: x}), ...(y === undefined ? {top: '8%'} : {top: y})};
  return <div style={place}>
    <MotionProbe id={id} value={d * size * 4} family="card" axis={from === 'top' ? 'y' : 'x'} />
    <div style={{display: 'flex', alignItems: 'center', gap: pad, width: w, padding: pad, boxSizing: 'border-box', background: palette.paper, border: `${Math.max(2, size * 0.04)}px solid ${palette.ink}`, borderRadius: size * 0.5, color: palette.ink, transform: from === 'top' ? `translateY(${-d * size * 5}px)` : `translateX(${d * w * 1.3}px)`}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: size * 1.8, height: size * 1.8, borderRadius: size * 0.4, background: palette.soft, flex: 'none'}}>
        <Icon size={size * 1.3} ink={palette.ink} accent={palette.accent} soft={palette.paper} paper={palette.paper} draw={blockRise(frame, at + 6, 14)} />
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.18, flex: 1, minWidth: 0}}>
        <div style={{fontFamily: fonts.display, fontSize: size, fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap'}}>{title}</div>
        <div style={{fontFamily: fonts.ui, fontSize: size * 0.8, fontWeight: 500, lineHeight: 1.25, whiteSpace: 'nowrap'}}>{body}</div>
      </div>
      <div style={{fontFamily: fonts.ui, fontSize: size * 0.8, fontWeight: 500, alignSelf: 'flex-start', whiteSpace: 'nowrap'}}>{time}</div>
    </div>
  </div>;
}

export type Message = {side: 'left' | 'right'; name: string; text: string};

/** Chat bubbles arriving `step` frames apart; before every reply a three-dot typing bubble runs for `typing` frames. Avatars are circles with the first glyph of the name. */
export function MessageThread({messages, step = 24, typing = 10, width, ...props}: BlockProps & {messages: Message[]; step?: number; typing?: number; width?: number}) {
  const {frame, at, size, palette, fonts, fps = 30, id = `thread-${at}`} = props;
  const {leave, hidden} = blockPhase(props, 1, 12);
  const pops = messages.map((_, i) => blockSettle(frame, at + i * step, 14, fps));
  // Left avatars are paper discs with an ink outline so they read on ink and paper fields alike; right avatars are accent.
  const avatar = (m: Message) => <div style={{width: size * 1.3, height: size * 1.3, borderRadius: '50%', flex: 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.side === 'left' ? palette.paper : palette.accent, border: m.side === 'left' ? `${Math.max(2, size * 0.05)}px solid ${palette.ink}` : 'none'}}><span style={{color: m.side === 'left' ? palette.ink : palette.paper, fontFamily: fonts.ui, fontSize: size * 0.8, fontWeight: 500}}>{Array.from(m.name)[0]}</span></div>;
  const bubble = (m: Message, inner: CSSProperties, children: ReactNode) => <div style={{padding: `${size * 0.45}px ${size * 0.8}px`, borderRadius: size * 0.9, background: m.side === 'left' ? palette.soft : palette.accent, color: m.side === 'left' ? palette.ink : palette.paper, fontFamily: fonts.ui, fontSize: size, fontWeight: 500, lineHeight: 1.3, maxWidth: '80%', wordBreak: 'keep-all', transformOrigin: m.side === 'left' ? 'bottom left' : 'bottom right', ...inner}}>{children}</div>;
  return <div style={blockPlace(props, hidden)}>
    <MotionProbe id={id} value={pops.reduce((sum, pop) => sum + pop, 0)} family="card" axis="scale" />
    <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.45, width: width ?? size * 12, opacity: 1 - leave, transform: `translateY(${leave * size}px)`}}>
      {messages.map((m, i) => {
        const start = at + i * step;
        const dots = i > 0 && frame >= start - typing && frame < start;
        if (frame < start - typing) return null;
        const pop = pops[i]!;
        return <div key={i} style={{display: 'flex', alignItems: 'flex-end', gap: size * 0.4, flexDirection: m.side === 'left' ? 'row' : 'row-reverse'}}>
          {avatar(m)}
          {dots ? bubble(m, {display: 'flex', gap: size * 0.22, transform: `scale(${blockSettle(frame, start - typing, 8, fps, true)})`}, [0, 1, 2].map(k =>
            <span key={k} style={{display: 'inline-block', width: size * 0.32, height: size * 0.32, borderRadius: '50%', background: 'currentColor', opacity: 0.5 + 0.5 * Math.sin((frame - start) * 0.9 - k * 1.1) ** 2, transform: `translateY(${Math.sin((frame - start) * 0.9 - k * 1.1) * size * 0.1}px)`}} />))
            : bubble(m, {transform: `scale(${pop})`, opacity: Math.min(1, pop * 2)}, <span>{m.text}</span>)}
        </div>;
      })}
    </div>
  </div>;
}

/** A strip of items separated by drawn dots scrolling `speed` px per frame; every item sits in a `cell` px slot so the loop wraps by modulo with no measurement. */
export function Ticker({items, speed = 4, cell, height, ...props}: BlockProps & {items: string[]; speed?: number; cell?: number; height?: number}) {
  const {frame, at, size, palette, fonts, x, y, id = `ticker-${at}`} = props;
  const slot = cell ?? size * 9, h = height ?? size * 2.2, period = slot * items.length;
  const {p, hidden} = blockPhase(props, 12, 10);
  const copies = Math.ceil(2200 / period) + 1;
  const shift = (Math.max(0, frame - at) * speed) % period;
  return <div data-clip="allow" style={{position: 'absolute', left: x ?? 0, right: x === undefined ? 0 : undefined, ...(y === undefined ? {bottom: '8%'} : {top: y}), height: h, overflow: 'hidden', background: palette.ink, transform: `scaleY(${p})`, transformOrigin: 'bottom', visibility: hidden ? 'hidden' : 'visible'}}>
    <MotionProbe id={id} value={p} family="card" axis="progress" />
    <div style={{position: 'absolute', left: 0, top: 0, height: h, display: 'flex', transform: `translateX(${-shift}px)`}}>
      {Array.from({length: copies * items.length}, (_, i) => <div key={i} style={{position: 'relative', width: slot, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: palette.paper, fontFamily: fonts.ui, fontSize: size, fontWeight: 500, whiteSpace: 'nowrap'}}>
        {items[i % items.length]}
        <span style={{position: 'absolute', right: -size * 0.16, top: '50%', width: size * 0.32, height: size * 0.32, marginTop: -size * 0.16, borderRadius: '50%', background: palette.accent}} />
      </div>)}
    </div>
  </div>;
}

/** Items rise in `stagger` frames apart; after each one a check path draws into its box with pathLength. */
export function Checklist({items, stagger = 14, draw = 12, ...props}: BlockProps & {items: string[]; stagger?: number; draw?: number}) {
  const {frame, at, size, palette, fonts, id = `check-${at}`} = props;
  const {leave, hidden} = blockPhase(props, 1, 12);
  const checks = items.map((_, i) => blockRise(frame, at + i * stagger + 6, draw));
  const box = size * 1.3;
  return <div style={blockPlace(props, hidden)}>
    <MotionProbe id={id} value={checks.reduce((sum, d) => sum + d, 0) / items.length} family="card" axis="progress" />
    <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.55, opacity: 1 - leave, transform: `translateY(${leave * size}px)`}}>
      {items.map((item, i) => {
        const rise = blockRise(frame, at + i * stagger, 10);
        return <div key={i} style={{display: 'flex', alignItems: 'center', gap: size * 0.5, opacity: rise, transform: `translateY(${(1 - rise) * size * 0.4}px)`}}>
          <svg width={box} height={box} viewBox="0 0 100 100" style={{flex: 'none'}}>
            <rect x={8} y={8} width={84} height={84} rx={18} fill={checks[i]! >= 1 ? palette.accent : 'none'} stroke={palette.ink} strokeWidth={8} />
            <path d="M28 52 L45 68 L74 36" fill="none" stroke={checks[i]! >= 1 ? palette.paper : palette.accent} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - checks[i]!} />
          </svg>
          <span style={{fontFamily: fonts.ui, fontSize: size, fontWeight: 500, color: palette.ink, whiteSpace: 'nowrap'}}>{item}</span>
        </div>;
      })}
    </div>
  </div>;
}

/** Brand name rises glyph by glyph, an accent underline grows, the tagline fades in, then everything holds still. `size` is the brand font size (tagline 0.4×). */
export function LogoOutro({brand, tagline, color, ...props}: BlockProps & {brand: string; tagline: string; color?: string}) {
  const {frame, at, size, palette, fonts, align = 'center', id = `logo-${at}`} = props;
  const {leave, hidden} = blockPhase(props, 1, 12);
  const rule = blockRise(frame, at + 14, 16) * (1 - leave);
  const tag = blockRise(frame, at + 28, 12) * (1 - leave);
  return <div style={blockPlace(props, hidden)}>
    <div style={{display: 'flex', flexDirection: 'column', alignItems: {left: 'flex-start', center: 'center', right: 'flex-end'}[align], gap: size * 0.3, opacity: 1 - leave}}>
      <div style={{position: 'relative', height: size * 1.15, display: 'flex', justifyContent: 'center'}}>
        <GlyphRise {...props} id={id} x={0} y={0} text={brand} color={color} />
        <span style={{visibility: 'hidden', fontFamily: fonts.display, fontSize: size, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', whiteSpace: 'nowrap'}}>{brand}</span>
      </div>
      <div style={{width: size * 4, height: size * 0.12, background: palette.accent, transform: `scaleX(${rule})`, transformOrigin: align === 'left' ? 'left' : align === 'right' ? 'right' : 'center'}} />
      <div style={{fontFamily: fonts.ui, fontSize: size * 0.4, fontWeight: 500, color: color ?? palette.ink, opacity: tag, whiteSpace: 'nowrap'}}>{tagline}</div>
    </div>
  </div>;
}

export const CARD_BLOCKS: BlockEntry[] = [
  {id: 'stat-card', title: 'Stat card', family: 'card', props: ['value', 'label', 'unit', 'prefix', 'decimals=0', 'example=true (tag beside the label)', 'width=size*10', 'height=size*5.2'], when: 'One number that matters, counted up on a card that springs in; two side by side for a comparison.'},
  {id: 'notification-card', title: 'Notification card', family: 'card', props: ['icon (kit component from @/assets)', 'title', 'body', 'time', 'from=top|right', 'width'], when: 'A product moment shown as a toast: an alert, a saved record, a message received.'},
  {id: 'message-thread', title: 'Message thread', family: 'card', props: ['messages[{side,name,text}]', 'step=24', 'typing=10', 'width'], when: 'A short conversation: two or three bubbles with a typing beat before each reply.'},
  {id: 'ticker', title: 'Ticker', family: 'card', props: ['items[]', 'speed=4', 'cell=size*9', 'height=size*2.2'], when: 'A strip of many short items (cities, features, prices) scrolling without end.'},
  {id: 'checklist', title: 'Checklist', family: 'card', props: ['items[]', 'stagger=14', 'draw=12'], when: 'Three to five steps or promises ticked off one after another.'},
  {id: 'logo-outro', title: 'Logo outro', family: 'card', props: ['brand', 'tagline', 'color'], when: 'The last scene: brand name, accent rule, tagline, then the still hold.'},
];
