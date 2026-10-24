import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {GlyphRise, LogoOutro, MapOutline, Markers, RouteMap, type FeatureCollection, type Fit, type LonLat} from '@/blocks';
import {Scooter} from '@/assets';

// 바람배송: a fictional same-day delivery brand. Every number on screen is 예시 data; the maps are Natural Earth (public domain) from geo.json.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: Math.ceil(S * 0.11), label: Math.ceil(S * 0.044), marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const palette = {ink: '#14213D', paper: '#F7F3EA', accent: '#FF7A2F', soft: '#8FB3E0'};
const fonts = {display, ui};
// The map scenes sit on the ink field, so the map blocks and headlines take the swapped palette (paper plates, ink text).
const night = {...palette, ink: palette.paper, paper: palette.ink};
const {ink, paper, accent} = palette;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
// Absolute scene starts on 2 s bar lines (120 BPM); the last 60 frames hold the name card still.
const AT = {hook: 0, zoom: 120, landed: 225, route: 240, markers: 360, name: 480, end: 600};
const WORLD = 'world', KOREA = 'korea';
const geo = (name: string) => `/assets/generated/map-story/geo/${name}.geojson`;
const none: FeatureCollection = {type: 'FeatureCollection', features: []};
const SEOUL: LonLat = [126.98, 37.57], BUSAN: LonLat = [129.08, 35.18], JEJU: LonLat = [126.53, 33.5], DAEJEON: LonLat = [127.38, 36.35];

const span = (frame: number, from: number, dur: number) => interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// One camera for the whole film: the world drifts, then a log-scale zoom flies to Korea, then a slow drift keeps the map alive.
// Korea lands a little below the middle so the top band stays free for the headline over the sea and the pins.
const FROM = {center: [12, 14] as LonLat, zoom: 1}, TO = {center: [127.6, 36.4] as LonLat, zoom: 18};
function camera(frame: number): {fit: Fit; progress: number} {
  const t = interpolate(frame, [AT.zoom, AT.landed], [0, 1], clamp), e = inOut(t);
  const drift = interpolate(frame, [AT.landed, AT.name], [0, 1], clamp);
  const start = lerp(FROM.zoom, 1.06, interpolate(frame, [0, AT.zoom], [0, 1], clamp));
  // The centre leads the zoom so Korea is mid-frame before the zoom gets deep; otherwise the target swings off screen.
  const c = Easing.bezier(0.3, 0, 0.1, 1)(t);
  const zoom = Math.exp(lerp(Math.log(start), Math.log(TO.zoom), e)) * (1 + 0.08 * drift);
  return {fit: {center: [lerp(FROM.center[0], TO.center[0], c), lerp(FROM.center[1], TO.center[1], c)], zoom}, progress: e};
}

function Name({frame}: {frame: number}) {
  const wipe = span(frame, AT.name, 14);
  const hero = spring({frame, fps: 30, delay: AT.name + 8, durationInFrames: 22, config: {overshootClamping: false}});
  return <AbsoluteFill style={{background: paper, clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)`}}>
    <MotionProbe id="name-wipe" value={wipe} family="wipe" axis="progress" />
    <MotionProbe id="scooter" value={hero} family="shape" axis="scale" />
    <div style={{position: 'absolute', left: 150, top: 270, width: 540, height: 540, transform: `scale(${hero})`, visibility: hero > 0 ? 'visible' : 'hidden'}}>
      <Scooter size={540} ink={ink} accent={accent} soft={palette.soft} paper={paper} draw={span(frame, AT.name + 8, 24)} />
    </div>
    <LogoOutro frame={frame} at={AT.name + 12} palette={palette} fonts={fonts} size={180} x={780} y={350} align="left" brand="바람배송" tagline="가상 브랜드 · 예시 데이터" />
  </AbsoluteFill>;
}

export function MapStory() {
  const frame = useCurrentFrame();
  const {fit, progress} = camera(frame);
  const map = {frame, palette: night, fonts, projection: 'mercator' as const, fit, width: W, height: H, x: 0, y: 0};
  const head = (at: number, out: number, text: string, y = SIZES.marginY + 20) =>
    <GlyphRise frame={frame} at={at} out={out} palette={night} fonts={fonts} size={SIZES.headline} x={SIZES.marginX + 24} y={y} text={text} />;
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/map-story/music.wav" volume={0.9} />
    {/* Effects come from the motion probes; quiet frames are the music hits (Korea lit at 210, the dot reaching Jeju at 345, the name at 495). */}
    <MotionSound src="/audio/generated/map-story/whoosh.wav" role="move" families={['wipe']} quiet={[210, 345, 495]} />
    <MotionSound src="/audio/generated/map-story/tick.wav" role="land" families={['card', 'shape']} quiet={[210, 345, 495]} />
    <MotionProbe id="map-zoom" value={progress} family="wipe" axis="progress" />
    {frame < AT.name + 14 ? <>
      <MapOutline {...map} at={-2} duration={80} src={geo(WORLD)} stroke={2.5} />
      {/* Same 50m geometry as the world layer, so the outline retraces in accent; it gives way at the route so the accent line and pins read over Korea. */}
      <MapOutline {...map} at={186} out={AT.route + 24} duration={40} src={geo(KOREA)} highlight={['KOR']} stroke={4} />
      <RouteMap {...map} data={none} at={AT.route} out={AT.markers + 4} lead={10} duration={95} size={SIZES.label} route={[SEOUL, BUSAN, JEJU]}
        stops={[{at: SEOUL, label: '서울 · 09:00'}, {at: BUSAN, label: '부산 · 13:00'}, {at: JEJU, label: '제주 · 18:00'}]} />
      <Markers {...map} data={none} at={AT.markers} lead={6} size={SIZES.label} unit="건"
        points={[{at: SEOUL, label: '서울', value: 1240}, {at: DAEJEON, label: '대전', value: 540}, {at: BUSAN, label: '부산', value: 860}, {at: JEJU, label: '제주', value: 310}]} />
      {head(-8, AT.zoom + 6, '하루 만에, 섬까지')}
      {/* Each headline has dropped out (out + 2 × (glyphs - 1) + 12) before the next one rises in the same place. */}
      {head(AT.landed - 20, AT.route - 12, '전국 어디든')}
      {head(AT.route + 10, AT.markers - 12, '서울에서 제주까지')}
      {head(AT.markers + 16, AT.name + 14, '오늘의 배송 · 예시')}
    </> : null}
    {frame >= AT.name ? <Name frame={frame} /> : null}
  </AbsoluteFill>;
}
