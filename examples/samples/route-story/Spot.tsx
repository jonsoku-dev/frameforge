import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, getLength, getPointAtLength, getTangentAtLength, googleFont, interpolate, interpolateColors, spring, useCurrentFrame} from 'frameforge';
import {Door, PIN_TIP, Pin, RADIUS, STROKE, Scooter} from './assets';

const display = googleFont('Jua', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#1C1917';
const paper = '#FFFBEB';
const accent = '#EA580C';
const soft = '#FED7AA';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const travelEase = Easing.bezier(0.45, 0, 0.55, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
const ROUTE = 'M240 860 C 760 860 1160 180 1660 300';
const ROADS = ['M80 560 C 480 520 560 900 960 860', 'M960 860 C 1200 820 1300 980 1880 900'];
const ROUTE_LENGTH = getLength(ROUTE);
const TRAVEL = [96, 420] as const;
// Label offsets keep each pill clear of its pin, the scooter and the road at the moment it lands.
const STOPS = [{t: 0, land: 86, label: '가게', dx: -72, dy: -290}, {t: 0.5, land: 258, label: '허브', dx: 90, dy: -150}, {t: 1, land: 416, label: '집', dx: -200, dy: -150}];
const PIN = 200;
const SCOOTER = 240;
const DOOR = [440, 480] as const;

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

function along(t: number): {x: number; y: number} {
  return getPointAtLength(ROUTE, ROUTE_LENGTH * t) ?? {x: 0, y: 0};
}

function Glyphs({text, frame, from, size, color = ink}: {text: string; frame: number; from: number; size: number; color?: string}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, lineHeight: 1}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, from + index * 2, 12);
      // Jua ink sits above the 1em line box; the mask grows upward without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.4em', paddingTop: '0.3em', marginTop: '-0.3em', paddingInline: '0.12em', marginInline: '-0.12em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Order({frame}: {frame: number}) {
  const p = pop(frame, 12, 16, true);
  return <AbsoluteFill style={{background: soft}}>
    <div style={{position: 'absolute', left: 120, top: 260}}>
      <Glyphs text="주문이" frame={frame} from={4} size={150} />
      <Glyphs text="들어왔어요" frame={frame} from={10} size={150} />
    </div>
    <div style={{position: 'absolute', left: 1000, top: 150, width: 820, height: 780, transform: `translateY(${(1 - p) * 500}px)`, visibility: p === 0 ? 'hidden' : 'visible'}}>
      <div style={{position: 'absolute', left: 24, top: 24, width: 820, height: 780, background: ink, borderRadius: RADIUS}} />
      <div style={{position: 'absolute', inset: 0, background: paper, borderRadius: RADIUS, padding: 64, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: ui, fontWeight: 500, color: ink}}>
        <div style={{fontSize: 44}}>주문 #A-0427 · 예시</div>
        <div style={{fontSize: 46}}>픽업 · 나루 베이커리 (가상)</div>
        <div style={{fontSize: 46}}>도착 · 집 앞 (예시 주소)</div>
        <div>
          <div style={{fontFamily: display, fontSize: 200, lineHeight: 1, color: accent}}>14:20</div>
          <div style={{fontSize: 40, marginTop: 16}}>도착 예정 · 샘플 데이터</div>
          <div style={{marginTop: 28, height: STROKE, borderRadius: RADIUS, background: soft, overflow: 'hidden'}}>
            <div style={{height: '100%', width: `${span(frame, 30, 50) * 100}%`, background: accent}} />
          </div>
        </div>
      </div>
    </div>
  </AbsoluteFill>;
}

function Map({frame}: {frame: number}) {
  const wipe = interpolate(frame, [70, 92], [0, 2400], {...clamp, easing: ease});
  const draw = span(frame, 70, 40);
  const travel = interpolate(frame, [...TRAVEL], [0, 1], {...clamp, easing: travelEase});
  const head = along(travel);
  const dir = getTangentAtLength(ROUTE, ROUTE_LENGTH * travel) ?? {x: 1, y: 0};
  const angle = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
  const scooter = pop(frame, 80, 14);
  return <AbsoluteFill style={{background: paper, clipPath: `circle(${wipe}px at 1420px 540px)`}}>
    <MotionProbe id="scooter-x" value={head.x} family="card" axis="x" />
    <div style={{position: 'absolute', left: 120, top: 110}}><Glyphs text="주문 한 건의 길" frame={frame} from={92} size={120} /></div>
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
      {[ROUTE, ...ROADS].map(d => <path key={d} d={d} pathLength={1} fill="none" stroke={soft} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - draw} />)}
      <path d={ROUTE} pathLength={1} fill="none" stroke={interpolateColors(travel, [0, 1], [soft, accent])} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - travel} />
      {STOPS.map(stop => {
        const q = along(stop.t);
        const s = pop(frame, stop.land, 14);
        return <g key={stop.label}>
          <MotionProbe id={`stop-${stop.label}`} value={s} family="shape" axis="scale" />
          <g transform={`translate(${q.x} ${q.y}) scale(${s}) translate(${-PIN_TIP.x * PIN / 400} ${-PIN_TIP.y * PIN / 400})`}><Pin size={PIN} /></g>
        </g>;
      })}
      <g transform={`translate(${head.x} ${head.y}) rotate(${angle}) scale(${scooter}) translate(${-SCOOTER / 2} ${-SCOOTER / 2})`}><Scooter size={SCOOTER} /></g>
    </svg>
    {STOPS.map(stop => {
      const q = along(stop.t);
      return <div key={stop.label} style={{position: 'absolute', left: q.x + stop.dx, top: q.y + stop.dy, opacity: span(frame, stop.land + 6, 10), background: ink, color: paper, fontFamily: ui, fontWeight: 500, fontSize: 46, padding: '8px 26px', borderRadius: RADIUS}}>{stop.label}</div>;
    })}
  </AbsoluteFill>;
}

function Arrival({frame}: {frame: number}) {
  const r = interpolate(frame, [412, 440], [0, 2600], {...clamp, easing: ease});
  const open = interpolate(frame, [...DOOR], [0, 1], {...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1)});
  return <AbsoluteFill style={{background: accent, clipPath: `circle(${r}px at 1660px 300px)`}}>
    <MotionProbe id="door" value={open} family="wipe" axis="progress" />
    {/* 750 px puts the door frame (viewBox 64..336 by 8..392) on the old 500 by 720 box at 1030, 180. */}
    <Door size={750} open={open} style={{position: 'absolute', left: 910, top: 165}} />
    <div style={{position: 'absolute', left: 120, top: 360}}><Glyphs text="도착" frame={frame} from={466} size={260} color={paper} /></div>
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const w = span(frame, 528, 12);
  return <>
    <AbsoluteFill style={{background: ink, clipPath: `inset(0 ${(1 - w) * 100}% 0 0)`}} />
    <AbsoluteFill style={{...center, flexDirection: 'column', gap: 48}}>
      <div style={{fontFamily: display, fontSize: 320, lineHeight: 1, color: paper, opacity: w}}>나루배송</div>
      <div style={{width: 720, height: STROKE, background: accent, transform: `scaleX(${w})`}} />
      <div style={{fontFamily: ui, fontWeight: 500, fontSize: 56, color: soft, opacity: w}}>주문부터 문 앞까지 · 가상 브랜드</div>
    </AbsoluteFill>
  </>;
}

export function RouteStory() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Audio src="/audio/generated/route-story/music.wav" volume={0.9} />
    {/* No hand-placed effects: the engine derives them from the motion probes; quiet = the music hits at 2.5 s and 15 s. */}
    <MotionSound src="/audio/generated/route-story/whoosh.wav" role="move" families={['card']} quiet={[75, 450]} />
    <MotionSound src="/audio/generated/route-story/pop.wav" role="land" families={['shape']} quiet={[75, 450]} />
    <MotionSound src="/audio/generated/route-story/ding.wav" role="appear" families={['wipe']} quiet={[75, 450]} />
    {frame < 100 ? <Order frame={frame} /> : null}
    {frame >= 70 && frame < 540 ? <Map frame={frame} /> : null}
    {frame >= 412 && frame < 540 ? <Arrival frame={frame} /> : null}
    {frame >= 528 ? <Name frame={frame} /> : null}
  </AbsoluteFill>;
}
