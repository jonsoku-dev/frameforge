import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, getInputProps, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const grotesk = googleFont('Space Grotesk', {weights: [700], fallback: 'sans-serif'});
const inter = googleFont('Inter', {weights: [500], fallback: 'sans-serif'});
const ink = '#0B1220';
const paper = '#F6F7FB';
const muted = '#C7CBD6';
export const variables = [
  {key: 'headline1', type: 'string', label: '헤드라인 1행', default: 'Too many', group: '문구', preview: 40, maxLength: 16},
  {key: 'headline2', type: 'string', label: '헤드라인 2행', default: 'tasks.', group: '문구', preview: 40, maxLength: 16},
  {key: 'accent', type: 'color', label: '강조색', default: '#FF5A36', group: '색', preview: 668},
  {key: 'pinShift', type: 'number', label: '핀 낙하 이동', default: 0, min: -12, max: 12, step: 1, unit: 'frames', group: '타이밍', preview: 138},
  {key: 'musicVolume', type: 'audioVolume', label: '음악 음량', default: 0.9, group: '소리'},
] as const;
type Vars = {headline1: string; headline2: string; accent: string; pinShift: number; musicVolume: number};

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

/** Camera push and return around one beat: scale rises to 1 + amount at the midpoint and comes back. */
function push(frame: number, at: number, dur: number, amount: number): number {
  const t = interpolate(frame, [at, at + dur], [0, 1], clamp);
  return 1 + amount * Math.sin(t * Math.PI);
}

type Rect = {x: number; y: number; w: number; h: number};
const lerp = (t: number, a: number, b: number) => a + (b - a) * t;
const mix = (t: number, a: Rect, b: Rect): Rect => ({x: lerp(t, a.x, b.x), y: lerp(t, a.y, b.y), w: lerp(t, a.w, b.w), h: lerp(t, a.h, b.h)});
const box = (r: Rect): CSSProperties => ({position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h});

// Each card is born from an object in the one before: bar -> board, board chip -> focus card, focus ring -> review card.
const BAR: Rect = {x: 460, y: 400, w: 1000, h: 150};
const CARD_L: Rect = {x: 96, y: 150, w: 1040, h: 780};
const CARD_R: Rect = {x: 784, y: 150, w: 1040, h: 780};
const CHIP: Rect = {x: CARD_L.x + 40 + 330, y: CARD_L.y + 96 + 100, w: 300, h: 96};
const PIN = {x: CARD_R.x + 520, y: CARD_R.y + 260};
const RING: Rect = {x: PIN.x - 136, y: PIN.y - 136, w: 272, h: 272};
const CHECK = {x: CARD_L.x + 56 + 22, y: CARD_L.y + 170 + 3 * 110 + 22};
const NAME_PIN = {x: 535, y: 500};

const tasks = ['Reply to the design review', 'Fix onboarding copy', 'Plan sprint goals', 'Update the roadmap', 'Book user interviews', 'Clean up the backlog', 'Write release notes', 'Prep the all-hands', 'Review pull requests', 'Ship the launch page', 'Draft the hiring brief', 'Sync with finance', 'Rename the API fields', 'Archive old projects'];
const PINNED = 9;
// Eight rows land inside the first 1.5 s so the hook reads at once; the rest fill in before the pin drop at 126.
const arrive = tasks.map((_, i) => i < 8 ? 6 + i * 5 : 50 + (i - 8) * 12);
const ROW_H = 96;
const VISIBLE = 9;

function Glyphs({text, frame, at, size, color, stagger = 3, family = grotesk, weight = 700}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number; family?: string; weight?: number}) {
  return <span style={{display: 'flex', color, fontFamily: family, fontSize: size, fontWeight: weight, lineHeight: 1, letterSpacing: family === grotesk ? '-0.03em' : 0}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.25em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Row({r, label, fill, dot}: {r: Rect; label: string; fill: string; dot?: CSSProperties}) {
  return <div style={{...box(r), background: fill, borderRadius: r.h * 0.22, display: 'flex', alignItems: 'center', gap: r.h * 0.3, paddingLeft: r.h * 0.35, boxSizing: 'border-box', fontFamily: inter, fontWeight: 500, fontSize: Math.max(34, r.h * 0.36), color: ink, whiteSpace: 'nowrap'}}>
    <div style={{width: r.h * 0.34, height: r.h * 0.34, flex: 'none', borderRadius: '50%', boxSizing: 'border-box', border: `${Math.max(2, r.h * 0.04)}px solid ${ink}`, ...dot}} />
    {label}
  </div>;
}

function Stack({frame, v}: {frame: number; v: Vars}) {
  const count = arrive.reduce((sum, at) => sum + span(frame, at - 6, 6), 0);
  const slot = (i: number) => i - Math.max(0, count - VISIBLE);
  const rowAt = (i: number): Rect => ({x: 1000, y: 110 + Math.min(Math.max(slot(i), 0), VISIBLE - 1) * ROW_H, w: 824, h: ROW_H * 0.8});
  // Rows past the top leave by transform, so their resting box stays inside the frame for the text guard.
  const lift = (i: number) => Math.min(0, slot(i)) * 400;
  const away = (i: number) => span(frame, 150 + i, 22) * -2100;
  const drop = pop(frame, 126 + v.pinShift, 12, true);
  const pinned = mix(span(frame, 158, 26), rowAt(PINNED), BAR);
  const wipe = pop(frame, 240, 22, true) * 1150;
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 96, top: 300, transform: `translateX(${away(0)}px)`}}>
      <Glyphs text={v.headline1} frame={frame} at={6} size={150} color={ink} />
      <Glyphs text={v.headline2} frame={frame} at={14} size={150} color={ink} />
      <div style={{height: 40}} />
      <Glyphs text="All due today. All at once." frame={frame} at={60} size={40} color={ink} stagger={0} family={inter} weight={500} />
    </div>
    {tasks.map((label, i) => i === PINNED || frame < arrive[i] ? null : <div key={label} style={{position: 'absolute', inset: 0, transform: `translate(${(1 - pop(frame, arrive[i], 12, true)) * 1000 + away(i + 1)}px, ${lift(i)}px)`}}>
      <Row r={rowAt(i)} label={label} fill={muted} />
    </div>)}
    <div style={{position: 'absolute', left: 0, right: 0, top: 600, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text="Pin one." frame={frame} at={170} size={130} color={ink} />
    </div>
    <AbsoluteFill style={{background: ink, clipPath: `circle(${wipe}px at ${BAR.x + BAR.w / 2}px ${BAR.y + BAR.h / 2}px)`}} />
    {frame < 248 && frame >= arrive[PINNED] ? <div style={{position: 'absolute', inset: 0, transform: `translateX(${(1 - pop(frame, arrive[PINNED], 12, true)) * 1000}px)`}}>
      <Row r={pinned} label={tasks[PINNED]} fill={frame >= 138 + v.pinShift ? v.accent : muted} dot={frame >= 126 + v.pinShift ? {background: ink, transform: `translateY(${(1 - drop) * -900}px)`} : undefined} />
    </div> : null}
  </AbsoluteFill>;
}

function Label({frame, at, lines, sub, x}: {frame: number; at: number; lines: string[]; sub: string; x: number}) {
  return <div style={{position: 'absolute', left: x, top: 300}}>
    {lines.map((line, i) => <Glyphs key={line} text={line} frame={frame} at={at + i * 6} size={140} color={paper} />)}
    <div style={{height: 36}} />
    <Glyphs text={sub} frame={frame} at={at + 14} size={42} color={muted} stagger={0} family={inter} weight={500} />
  </div>;
}

function Board({frame, v}: {frame: number; v: Vars}) {
  const grow = span(frame, 248, 20);
  const r = mix(grow, BAR, CARD_L);
  const head = lerp(grow, BAR.h, 96);
  return <AbsoluteFill>
    <Label frame={frame} at={278} lines={['Board']} sub="Every task, one glance." x={1220} />
    <div style={{...box(r), background: paper, borderRadius: 24, overflow: 'hidden', transform: `translateX(${span(frame, 392, 18) * -1400}px)`}}>
      <div style={{height: head, background: v.accent, display: 'flex', alignItems: 'center', paddingLeft: 48, fontFamily: inter, fontWeight: 500, fontSize: lerp(grow, 54, 34), color: ink, whiteSpace: 'nowrap'}}>{tasks[PINNED]}</div>
      {[4, 2, 4].map((chips, lane) => <div key={lane} style={{position: 'absolute', left: 40 + lane * 330, top: 96 + 48}}>
        <div style={{width: 180, height: 16, borderRadius: 8, background: muted, transform: `scaleX(${span(frame, 264 + lane * 4, 12)})`, transformOrigin: 'left'}} />
        {Array.from({length: chips}, (_, c) => {
          const key = lane === 1 && c === 0;
          return <div key={c} style={{position: 'absolute', left: 0, top: 52 + c * 116, width: CHIP.w, height: CHIP.h, borderRadius: 16, background: key ? v.accent : muted, display: 'flex', alignItems: 'center', gap: 20, paddingLeft: 28, boxSizing: 'border-box', transform: `scale(${pop(frame, 268 + lane * 5 + c * 4, 14)})`}}>
            <div style={{width: 24, height: 24, borderRadius: '50%', background: ink}} />
            <div style={{width: 120 + ((lane + c) % 3) * 30, height: 12, borderRadius: 6, background: ink}} />
          </div>;
        })}
      </div>)}
    </div>
  </AbsoluteFill>;
}

function Focus({frame, v}: {frame: number; v: Vars}) {
  const grow = span(frame, 388, 20);
  const r = mix(grow, CHIP, CARD_R);
  const ring = 2 * Math.PI * 130;
  return <AbsoluteFill>
    <Label frame={frame} at={408} lines={['Focus', 'pin']} sub="One task stays on top." x={96} />
    <div style={{...box(r), background: v.accent, borderRadius: lerp(grow, 16, 24), overflow: 'hidden', transform: `translateX(${span(frame, 534, 18) * 1300}px) scale(${push(frame, 408, 48, 0.06)})`, transformOrigin: '520px 260px'}}>
      <div style={{position: 'absolute', left: 520 - 90, top: 260 - 90, width: 180, height: 180, borderRadius: '50%', background: ink, transform: `scale(${pop(frame, 398, 16)})`}} />
      <svg width={272} height={272} style={{position: 'absolute', left: 520 - 136, top: 260 - 136, transform: 'rotate(-90deg)'}}>
        <circle cx={136} cy={136} r={130} fill="none" stroke={paper} strokeWidth={12} strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={(1 - span(frame, 410, 90)) * ring} />
      </svg>
      <div style={{position: 'absolute', left: 220, top: 480, width: 600, height: 36, borderRadius: 18, background: ink, transform: `scaleX(${span(frame, 402, 16)})`, transformOrigin: 'left'}} />
      {[460, 380].map((w, i) => <div key={w} style={{position: 'absolute', left: 220, top: 560 + i * 44, width: w, height: 14, borderRadius: 7, background: paper, transform: `scaleX(${span(frame, 410 + i * 4, 16)})`, transformOrigin: 'left'}} />)}
    </div>
  </AbsoluteFill>;
}

function Review({frame, v}: {frame: number; v: Vars}) {
  const grow = span(frame, 524, 20);
  const r = mix(grow, RING, CARD_L);
  return <AbsoluteFill>
    <Label frame={frame} at={560} lines={['Daily', 'review']} sub="Close the day clean." x={1220} />
    <div style={{...box(r), background: paper, borderRadius: lerp(grow, 136, 24), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 56, top: 64, width: 220, height: 20, borderRadius: 10, background: ink, transform: `scaleX(${span(frame, 540, 14)})`, transformOrigin: 'left'}} />
      {Array.from({length: 5}, (_, i) => {
        const check = i < 4 ? pop(frame, 564 + i * 12, 10) : 0;
        return <div key={i} style={{position: 'absolute', left: 56, top: 170 + i * 110, display: 'flex', alignItems: 'center', gap: 32, transform: `translateY(${(1 - pop(frame, 540 + i * 3, 14, true)) * 60}px)`, opacity: frame >= 540 + i * 3 ? 1 : 0}}>
          <div style={{width: 44, height: 44, borderRadius: '50%', border: `4px solid ${ink}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{width: 24, height: 24, borderRadius: '50%', background: v.accent, transform: `scale(${check})`}} />
          </div>
          <div style={{position: 'relative', width: 560 - (i % 2) * 120, height: 18, borderRadius: 9, background: muted}}>
            <div style={{position: 'absolute', left: -12, right: -12, top: 6, height: 6, background: ink, transform: `scaleX(${i < 4 ? span(frame, 568 + i * 12, 10) : 0})`, transformOrigin: 'left'}} />
          </div>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}

function Vow({frame, v}: {frame: number; v: Vars}) {
  const shrink = span(frame, 806, 24);
  const radius = lerp(shrink, pop(frame, 660, 24, true) * 1900, 44);
  const fall = span(frame, 790, 14) * 130;
  return <AbsoluteFill style={{background: v.accent, clipPath: `circle(${radius}px at ${lerp(shrink, CHECK.x, NAME_PIN.x)}px ${lerp(shrink, CHECK.y, NAME_PIN.y)}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
    {['Finish what', 'matters.'].map((line, i) => <div key={line} style={{overflow: 'hidden', paddingTop: 24, marginTop: -24, paddingInline: 16}}>
      <div style={{transform: `translateY(${fall}%)`}}><Glyphs text={line} frame={frame} at={662 + i * 5} size={160} color={ink} /></div>
    </div>)}
    <div style={{width: 600, height: 16, marginTop: 36, background: ink, transform: `scaleX(${span(frame, 706, 16) - span(frame, 792, 12)})`}} />
  </AbsoluteFill>;
}

function Name({frame, v}: {frame: number; v: Vars}) {
  return <AbsoluteFill style={{background: paper}}>
    <div style={{position: 'absolute', left: NAME_PIN.x - 44, top: NAME_PIN.y - 44, width: 88, height: 88, borderRadius: '50%', background: v.accent}} />
    <div style={{position: 'absolute', left: NAME_PIN.x + 80, top: NAME_PIN.y - 118}}>
      <Glyphs text="Solotack" frame={frame} at={822} size={200} color={ink} stagger={1} />
      <div style={{height: 40}} />
      <Glyphs text="One task. Pinned." frame={frame} at={828} size={56} color={ink} stagger={0} family={inter} weight={500} />
    </div>
  </AbsoluteFill>;
}

export function Spot(props: Partial<Vars>) {
  const frame = useCurrentFrame();
  // Studio preview passes overrides as props; renders also set them as input props.
  const v = {...Object.fromEntries(variables.map(x => [x.key, x.default])), ...getInputProps(), ...props} as Vars;
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/saas-launch/music.wav" volume={v.musicVolume} />
    <Sequence from={150} durationInFrames={30} layout="none"><Audio src="/audio/generated/saas-launch/whoosh.wav" volume={0.8} /></Sequence>
    {[266, 404, 542].map(at => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src="/audio/generated/saas-launch/click.wav" volume={0.8} /></Sequence>)}
    <AbsoluteFill>
      {frame < 270 ? <Stack frame={frame} v={v} /> : null}
      {frame >= 248 && frame < 412 ? <Board frame={frame} v={v} /> : null}
      {frame >= 388 && frame < 556 ? <Focus frame={frame} v={v} /> : null}
      {frame >= 524 && frame < 690 ? <Review frame={frame} v={v} /> : null}
      {frame >= 806 ? <Name frame={frame} v={v} /> : null}
      {frame >= 660 && frame < 830 ? <Vow frame={frame} v={v} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
