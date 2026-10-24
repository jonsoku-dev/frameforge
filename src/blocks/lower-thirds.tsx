import type {CSSProperties} from 'react';
import {MotionProbe} from 'frameforge';
import {blockMask, blockPhase, type BlockProps} from './text';
import type {BlockEntry} from './types';

export type LowerThirdVariant = 'clean-bar' | 'bold-block' | 'kicker-name' | 'soft-pill' | 'mask-reveal' | 'side-rule';

/** Name and role in the lower corner of the safe area. `size` is the name's font size (role is 0.7×, so pass ≥ 5 % of the short side).
 * Every variant enters from its side (mask, bar or block first, then the text) and the exit runs the same path backwards. */
export function LowerThird({variant = 'clean-bar', name, role, side = 'left', enter = 16, exit = 12, ...props}: BlockProps & {variant?: LowerThirdVariant; name: string; role: string; side?: 'left' | 'right'; enter?: number; exit?: number}) {
  const {frame, at, size, palette, fonts, x, y, id = `lower-third-${at}`} = props;
  const dir = side === 'left' ? 1 : -1;
  const {p: shape, hidden} = blockPhase(props, enter, exit);
  const {p: first} = blockPhase({...props, at: at + 4}, enter, exit);
  const {p: second} = blockPhase({...props, at: at + 9}, enter, exit);
  const place: CSSProperties = {position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: side === 'left' ? 'flex-start' : 'flex-end', visibility: hidden ? 'hidden' : 'visible',
    ...(x === undefined ? {[side]: '5%'} : {left: x}), ...(y === undefined ? {bottom: '8%'} : {top: y})};
  const nameStyle: CSSProperties = {fontFamily: fonts.display, fontSize: size, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'nowrap', color: palette.ink};
  const roleStyle: CSSProperties = {fontFamily: fonts.ui, fontSize: size * 0.7, fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap', color: palette.ink};
  const origin = side === 'left' ? 'left' : 'right';
  // The mask's em heights come from its own font size, so the text style sits on the mask as well as the glyph span.
  const risen = (t: number, text: string, style: CSSProperties) => <span style={{...style, ...blockMask}}><span style={{display: 'inline-block', transform: `translateY(${(1 - t) * 120}%)`, visibility: t <= 0 ? 'hidden' : 'visible'}}>{text}</span></span>;
  // Slides settle inward toward the side (never past the safe-area edge), so an entering label is still inside the 5 % margin.
  const slid = (t: number, text: string, style: CSSProperties) => <span style={{...style, display: 'inline-block', opacity: t, transform: `translateX(${(1 - t) * dir * size * 0.5}px)`}}>{text}</span>;
  const masked = (t: number, text: string, style: CSSProperties) => <span style={{...style, display: 'inline-block', padding: '0.15em 0.1em', margin: '-0.15em -0.1em', clipPath: side === 'left' ? `inset(0 ${(1 - t) * 100}% 0 0)` : `inset(0 0 0 ${(1 - t) * 100}%)`}}>{text}</span>;
  const body = {
    'clean-bar': <div style={{display: 'flex', flexDirection: side === 'left' ? 'row' : 'row-reverse', alignItems: 'stretch', gap: size * 0.4}}>
      <div style={{width: size * 0.14, background: palette.accent, transform: `scaleY(${shape})`, transformOrigin: 'bottom'}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.22, alignItems: side === 'left' ? 'flex-start' : 'flex-end'}}>{risen(first, name, nameStyle)}{risen(second, role, roleStyle)}</div>
    </div>,
    'bold-block': <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.12, alignItems: side === 'left' ? 'flex-start' : 'flex-end'}}>
      <div style={{padding: `${size * 0.3}px ${size * 0.5}px`, background: palette.ink, transform: `scaleX(${shape})`, transformOrigin: origin}}>{risen(first, name, {...nameStyle, color: palette.paper})}</div>
      <div style={{padding: `${size * 0.18}px ${size * 0.5}px`, background: palette.accent, transform: `scaleX(${second})`, transformOrigin: origin}}><span style={{...roleStyle, color: palette.paper}}>{role}</span></div>
    </div>,
    'kicker-name': <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.22, alignItems: side === 'left' ? 'flex-start' : 'flex-end'}}>
      <span style={{background: palette.accent, padding: `${size * 0.12}px ${size * 0.35}px`, borderRadius: size * 0.1, display: 'inline-block', opacity: shape, transform: `translateX(${(1 - shape) * dir * size * 0.5}px)`}}><span style={{...roleStyle, color: palette.paper}}>{role}</span></span>
      {risen(first, name, nameStyle)}
    </div>,
    'soft-pill': <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.2, alignItems: side === 'left' ? 'flex-start' : 'flex-end'}}>
      <div style={{padding: `${size * 0.3}px ${size * 0.6}px`, background: palette.soft, borderRadius: 999, transform: `scaleX(${shape})`, transformOrigin: origin}}><span style={{...nameStyle, display: 'inline-block', opacity: first}}>{name}</span></div>
      <div style={{paddingInline: size * 0.6}}>{slid(second, role, roleStyle)}</div>
    </div>,
    'mask-reveal': <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.2, alignItems: side === 'left' ? 'flex-start' : 'flex-end'}}>
      {masked(first, name, nameStyle)}
      <div style={{height: size * 0.08, width: size * 3, background: palette.accent, transform: `scaleX(${shape})`, transformOrigin: origin}} />
      {masked(second, role, roleStyle)}
    </div>,
    'side-rule': <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.22, alignItems: side === 'left' ? 'flex-start' : 'flex-end'}}>
      <div style={{height: size * 0.1, width: size * 5, background: palette.accent, transform: `scaleX(${shape})`, transformOrigin: origin}} />
      {risen(first, name, nameStyle)}
      {slid(second, role, roleStyle)}
    </div>,
  }[variant];
  return <div style={place}>
    <MotionProbe id={id} value={(1 - shape) * dir * size * 2} family="card" axis="x" />
    {body}
  </div>;
}

export const LOWER_THIRD_BLOCKS: BlockEntry[] = [
  {id: 'lower-third', title: 'Lower third', family: 'lower-third', props: ['variant=clean-bar|bold-block|kicker-name|soft-pill|mask-reveal|side-rule', 'name', 'role', 'side=left|right', 'enter=16', 'exit=12'], when: 'Who is speaking or what is shown, in the lower corner over a running scene; pick the variant that matches the film\'s shapes.'},
];
