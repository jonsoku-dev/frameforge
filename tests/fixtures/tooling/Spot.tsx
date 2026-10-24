import {AbsoluteFill, interpolate, useCurrentFrame} from 'frameforge';

/** A root with no opaque background (alpha renders), plus one deliberate fault per audit code: a label hugging the edge, a tiny label,
 * grey-on-grey text and two overlapping words. */
export function Translucent() {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 59], [120, 400]);
  const font = {fontFamily: 'sans-serif', fontWeight: 700, color: '#0F172A'} as const;
  return <AbsoluteFill style={{fontFamily: 'sans-serif'}}>
    <div style={{position: 'absolute', left: x, top: 100, width: 160, height: 160, borderRadius: 80, background: '#F59E0B', opacity: 0.5}} />
    <div style={{...font, position: 'absolute', left: 40, top: 40, fontSize: 40}}>반투명 레이어</div>
    <div style={{...font, position: 'absolute', left: 2, top: 300, fontSize: 24}}>가장자리</div>
    <div style={{...font, position: 'absolute', left: 300, top: 320, fontSize: 10}}>예시 데이터</div>
    <div style={{position: 'absolute', left: 420, top: 40, padding: 8, background: '#999999'}}><span style={{...font, color: '#888888', fontSize: 24}}>흐린 글자</span></div>
    <div style={{...font, position: 'absolute', left: 420, top: 200, fontSize: 32}}>겹침</div>
    <div style={{...font, position: 'absolute', left: 428, top: 204, fontSize: 32}}>겹침 둘</div>
  </AbsoluteFill>;
}
