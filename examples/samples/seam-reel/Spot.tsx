import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, Seam, googleFont, interpolate, nudge, useCurrentFrame, waterfallCut, waterfallEntry, type SeamSide} from 'frameforge';
import {Bag, BarChart, Book, Coin, CoinStack, Tag, Ticket, Wave} from '@/assets';

// Six scenes, five seams, one current (leftward). The doctrine: skills/frameforge-best-practices/references/seams.md.
const W = 1920;
const H = 1080;
const SIZES = {headline: 110, name: 220, label: 44, icon: 120, hero: 540, marginX: 96, marginY: 54};
const display = googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#14213D';
const paper = '#F3EFE6';
const accent = '#E07A2F';
const soft = '#BFD7EA';
const kit = {ink, accent, soft, paper};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
// Cut frames; every seam is 24 frames centred on its cut (12 out, 12 in). The still runs from 840.
const AT = {hook: 0, cards: 90, detail: 240, sort: 390, bigger: 540, name: 690};
const SEAM = 24;
const HITS = [AT.cards, AT.detail, AT.sort, AT.bigger, AT.name];

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)});
}

/** A headline line arriving from below; later and heavier lines travel slower. */
function Line({frame, at, index, text, size = SIZES.headline, color = ink, weight = 1}: {frame: number; at: number; index: number; text: string; size?: number; color?: string; weight?: number}) {
  const w = waterfallEntry({frame, at, index, weight});
  return <div style={{fontFamily: display, fontWeight: 900, fontSize: size, lineHeight: 1.15, letterSpacing: '-0.03em', color, whiteSpace: 'nowrap', transform: w.transform, opacity: w.opacity}}>
    <MotionProbe id={`line-${at}-${index}`} value={w.y} family="text" axis="y" />
    {text}
  </div>;
}

function Label({children, color = ink, size = SIZES.label}: {children: ReactNode; color?: string; size?: number}) {
  return <div style={{fontFamily: ui, fontWeight: 500, fontSize: size, color, whiteSpace: 'nowrap'}}>{children}</div>;
}

function Pill({children}: {children: ReactNode}) {
  return <div style={{alignSelf: 'flex-start', padding: '6px 22px', borderRadius: 999, background: accent, color: ink, fontFamily: ui, fontWeight: 500, fontSize: SIZES.label}}>{children}</div>;
}

const frag = (s: SeamSide): CSSProperties => ({transform: s.transform, opacity: s.opacity, filter: s.filter});
/** A displaced wrapper may carry text past the safe area; at rest the audit applies. */
const clip = (s: SeamSide) => s.value ? {'data-clip': 'allow'} : {};

function Hook({frame}: {frame: number}) {
  const draw = span(frame, 0, 50);
  return <AbsoluteFill style={{background: ink}}>
    <MotionProbe id="wave-draw" value={draw} family="shape" axis="progress" />
    <Wave size={760} {...kit} ink={paper} draw={draw} style={{position: 'absolute', right: 100, top: 40}} />
    <div style={{position: 'absolute', left: SIZES.marginX, top: 300, display: 'flex', flexDirection: 'column', gap: 16}}>
      <Line frame={frame} at={16} index={0} text="돈의 흐름," color={paper} size={150} />
      <Line frame={frame} at={16} index={1} text="보이나요?" color={paper} size={150} weight={1.5} />
    </div>
  </AbsoluteFill>;
}

const CARDS = [[Bag, '쇼핑', '612,000원'], [Ticket, '여가', '248,000원'], [Coin, '식비', '1,284,000원'], [CoinStack, '합계', '2,144,000원']] as const;
const HERO = 2;
const CARD = {w: 560, h: 560, gap: 40, pad: 48, top: 300};
/** Where the 식비 card's icon sits, so the carrier coin lands exactly on it. */
const COIN_LAND = {x: SIZES.marginX + HERO * (CARD.w + CARD.gap) + CARD.pad, y: CARD.top + CARD.pad};

function Cards({frame}: {frame: number}) {
  const at = AT.cards;
  // The row slides left to centre the 식비 card before the zoom dives into it; the fourth card fills the right.
  const shift = nudge({frame, at: at + 90, duration: 30, from: 0, to: W / 2 - (COIN_LAND.x - CARD.pad + CARD.w / 2)});
  return <AbsoluteFill style={{background: paper}}>
    <div style={{position: 'absolute', left: SIZES.marginX, top: SIZES.marginY + 40}}><Line frame={frame} at={at} index={0} text="한눈에 보는 이번 달" /></div>
    {/* The row scrolls past the left margin on purpose while it re-centres; at rest the safe-area audit applies. */}
    <div {...(shift ? {'data-clip': 'allow'} : {})} style={{position: 'absolute', left: SIZES.marginX, top: CARD.top, display: 'flex', gap: CARD.gap, transform: `translateX(${shift}px)`}}>
      <MotionProbe id="cards-nudge" value={shift} family="card" axis="x" />
      {CARDS.map(([Icon, title, amount], i) => {
        const w = waterfallEntry({frame, at: at + 2, index: i, weight: 1 + i * 0.4});
        const last = i === HERO;
        // The fourth card starts past the right edge on purpose: the sliver is what the nudge answers.
        return <div key={title} {...(i === CARDS.length - 1 ? {'data-clip': 'allow'} : {})} style={{width: CARD.w, height: CARD.h, borderRadius: 28, background: last ? ink : soft, padding: CARD.pad, display: 'flex', flexDirection: 'column', gap: 24, transform: w.transform, opacity: w.opacity}}>
          <MotionProbe id={`card-${i}`} value={w.y} family="card" axis="y" />
          {/* The 식비 icon is the carrier coin itself: it shows the frame the ride ends. */}
          <div style={{height: SIZES.icon, opacity: last && frame < 130 ? 0 : 1}}><Icon size={SIZES.icon} {...kit} ink={last ? paper : ink} /></div>
          <Label color={last ? paper : ink} size={52}>{title}</Label>
          <div style={{fontFamily: display, fontWeight: 900, fontSize: 72, letterSpacing: '-0.03em', color: last ? paper : ink}}>{amount}</div>
          <Pill>예시</Pill>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}

/** Rides the current across the first seam: from beside the wave to the 식비 card's icon slot. */
function Carrier({frame}: {frame: number}) {
  if (frame < 50 || frame >= 130) return null;
  const x = interpolate(frame, [60, 130], [1600, COIN_LAND.x], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const y = interpolate(frame, [60, 130], [790, COIN_LAND.y], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const size = interpolate(frame, [60, 130], [220, SIZES.icon], {...clamp, easing: Easing.inOut(Easing.cubic)});
  return <div style={{position: 'absolute', left: x, top: y, opacity: span(frame, 50, 8)}}>
    <MotionProbe id="coin" value={x} family="shape" axis="x" />
    <Coin size={size} {...kit} ink={frame < AT.cards ? paper : ink} />
  </div>;
}

const WATERFALL = {at: AT.sort - SEAM / 2 - 3, duration: SEAM + 6, words: 4, stagger: 2};
const words = (frame: number) => waterfallCut({frame, ...WATERFALL});

function Words({frame, side, list, color = ink}: {frame: number; side: 'exit' | 'entry'; list: string[]; color?: string}) {
  return <div style={{display: 'flex', gap: 28}}>
    {list.map((word, i) => {
      const s = words(frame)[i]![side];
      return <div key={word} {...clip(s)} style={{fontFamily: display, fontWeight: 900, fontSize: SIZES.headline, lineHeight: 1.15, letterSpacing: '-0.03em', color, whiteSpace: 'nowrap', ...frag(s)}}>
        <MotionProbe id={`word-${side}-${i}`} value={s.value} family="camera" axis="x" />
        {word}
      </div>;
    })}
  </div>;
}

function Detail({frame}: {frame: number}) {
  const at = AT.detail;
  const parts = frame < at + 4 ? 1 : frame < at + 14 ? 2 : 3;
  const rise = waterfallEntry({frame, at, index: 0, weight: 1.5});
  // The number counts up to its value over two seconds, then holds: the only motion of the scene's second half.
  const count = Math.round(interpolate(frame, [at, at + 60], [0, 1284000], {...clamp, easing: Easing.out(Easing.cubic)}) / 1000) * 1000;
  const tail = words(frame)[WATERFALL.words - 1]!.exit;
  return <AbsoluteFill style={{background: paper}}>
    <div style={{position: 'absolute', left: SIZES.marginX, top: SIZES.marginY + 40}}><Words frame={frame} side="exit" list={['이번', '달', '식비,', '얼마였죠?']} /></div>
    <div {...clip(tail)} style={{position: 'absolute', left: SIZES.marginX, top: 420, ...frag(tail)}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 28, transform: rise.transform, opacity: rise.opacity}}>
        <MotionProbe id="amount" value={rise.y} family="text" axis="y" />
        <div style={{fontFamily: display, fontWeight: 900, fontSize: 200, lineHeight: 1, letterSpacing: '-0.04em', color: ink, fontVariantNumeric: 'tabular-nums'}}>
          <MotionProbe id="count" value={count / 1284000} family="text" axis="progress" />
          {count.toString().replace(/\B(?=(\d{3})+$)/g, ',')}원
        </div>
        <Pill>예시 · 지난달보다 12% 적게</Pill>
      </div>
    </div>
    <div style={{position: 'absolute', right: 140, top: 300, ...frag(tail)}}>
      <MotionProbe id="chart-parts" value={parts / 3} family="shape" axis="progress" />
      <BarChart size={520} {...kit} parts={parts} />
    </div>
  </AbsoluteFill>;
}

const TAGS = ['식비 · 42건', '교통 · 18건', '구독 · 6건'];

function Sort({frame}: {frame: number}) {
  const at = AT.sort;
  const head = words(frame)[0]!.entry;
  const draw = span(frame, at + 2, 40);
  return <AbsoluteFill style={{background: paper}}>
    <div style={{position: 'absolute', left: SIZES.marginX, top: SIZES.marginY + 40}}><Words frame={frame} side="entry" list={['카드', '내역은', '자동으로', '분류돼요']} /></div>
    <div {...clip(head)} style={{position: 'absolute', left: SIZES.marginX, top: 320, width: 880, height: 600, borderRadius: 28, background: soft, padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', ...frag(head)}}>
      {TAGS.map((tag, i) => {
        const w = waterfallEntry({frame, at: at + 4, index: i, weight: 1 + i * 0.3});
        return <div key={tag} style={{display: 'flex', alignItems: 'center', gap: 32, transform: w.transform, opacity: w.opacity}}>
          <MotionProbe id={`tag-${i}`} value={w.y} family="card" axis="y" />
          <Tag size={SIZES.icon} {...kit} />
          <Label size={64}>{tag}</Label>
        </div>;
      })}
    </div>
    <div style={{position: 'absolute', right: 160, top: 320, ...frag(head)}}>
      <MotionProbe id="book-draw" value={draw} family="shape" axis="progress" />
      <Book size={600} {...kit} draw={draw} />
    </div>
  </AbsoluteFill>;
}

function Bigger({frame}: {frame: number}) {
  const at = AT.bigger;
  const draw = span(frame, at, 56);
  const detail = waterfallEntry({frame, at: at + 90, index: 0, weight: 2});
  // Lines land by 575, the wave by 596, the detail line by 650: the stillness before the name is the only pause in the film.
  return <AbsoluteFill style={{background: accent}}>
    <MotionProbe id="wave-big" value={draw} family="shape" axis="progress" />
    <Wave size={760} {...kit} ink={ink} soft={accent} paper={accent} draw={draw} style={{position: 'absolute', left: 120, top: (H - 760) / 2}} />
    <div style={{position: 'absolute', left: 980, top: 340, display: 'flex', flexDirection: 'column', gap: 16}}>
      <Line frame={frame} at={at + 2} index={0} text="모든 계좌를" color={ink} size={140} />
      <Line frame={frame} at={at + 2} index={1} text="한 물길로" color={ink} size={140} weight={1.5} />
      {/* Lands at about 650 (start 630, 20 frames): the pause before the name runs from there to the rack focus at 678. */}
      <div style={{marginTop: 24, transform: detail.transform, opacity: detail.opacity}}>
        <MotionProbe id="bigger-detail" value={detail.y} family="text" axis="y" />
        <Label color={ink} size={56}>계좌 12개 · 카드 4개 · 예시</Label>
      </div>
    </div>
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const at = AT.name;
  const bar = span(frame, at + 30, 20);
  const tag = waterfallEntry({frame, at: at + 52, index: 0, weight: 1.5});
  return <AbsoluteFill style={{background: ink, ...center, flexDirection: 'column', gap: 40}}>
    <Line frame={frame} at={at + 2} index={0} text="물길" color={paper} size={SIZES.name} weight={2} />
    <div style={{width: 520, height: 20, background: accent, transform: `scaleX(${bar})`}}>
      <MotionProbe id="name-bar" value={bar} family="wipe" axis="progress" />
    </div>
    <div style={{transform: tag.transform, opacity: tag.opacity}}>
      <MotionProbe id="tagline" value={tag.y} family="text" axis="y" />
      <Label color={paper} size={52}>가계부가 아니라, 물길입니다 · 가상 브랜드</Label>
    </div>
  </AbsoluteFill>;
}

export function SeamReel() {
  const frame = useCurrentFrame();
  // Seams nest: each one shows its `from` until its cut, then its `to`, which is the next seam. The waterfall at 390 is
  // built word by word inside Detail/Sort, so that cut is a plain swap of the inverseZoom seam's `from`.
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/seam-reel/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/seam-reel/whoosh.wav" role="move" families={['camera', 'card', 'shape']} quiet={HITS} />
    <MotionSound src="/audio/generated/seam-reel/thud.wav" role="land" families={['card', 'shape']} quiet={HITS} />
    <Seam at={AT.cards - SEAM / 2} duration={SEAM} id="s1" fromBackground={ink} toBackground={paper} from={<Hook frame={frame} />} to={
      <Seam at={AT.detail - SEAM / 2} duration={SEAM} technique="zoomThrough" id="s2" fromBackground={paper} toBackground={paper} from={<Cards frame={frame} />} to={
        <Seam at={AT.bigger - SEAM / 2} duration={SEAM} technique="inverseZoom" id="s4" fromBackground={paper} toBackground={accent} from={frame < AT.sort ? <Detail frame={frame} /> : <Sort frame={frame} />} to={
          <Seam at={AT.name - SEAM / 2} duration={SEAM} technique="rackFocus" id="s5" fromBackground={accent} toBackground={ink} from={<Bigger frame={frame} />} to={<Name frame={frame} />} />
        } />
      } />
    } />
    <Carrier frame={frame} />
  </AbsoluteFill>;
}
