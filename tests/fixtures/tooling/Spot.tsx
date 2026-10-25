import {AbsoluteFill, interpolate, useCurrentFrame} from 'frameforge';

/** A root with no opaque background (alpha renders), plus one deliberate fault per audit code: a label hugging the edge, a tiny label,
 * grey-on-grey text and two overlapping words. Two cards stacked in 3D, the rear one's word wholly behind the front card, are not an overlap. */
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
    <div style={{position: 'absolute', left: 330, top: 240, width: 100, height: 70, perspective: 300, perspectiveOrigin: '0 0'}}>
      <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d'}}>
        {[[-60, '뒤 카드'], [0, '앞 카드']].map(([z, word]) => <div key={word} style={{position: 'absolute', inset: 0, padding: 6, background: '#FFFFFF', transform: `translateZ(${z}px)`}}><span style={{...font, fontSize: 20}}>{word}</span></div>)}
      </div>
    </div>
    <div style={{...font, position: 'absolute', right: 6, top: 4, fontSize: 14}}>{`TC 00:${String(frame).padStart(2, '0')}`}</div>
    <div data-hud="allow" data-clip="allow" data-size="allow" style={{...font, position: 'absolute', left: 6, bottom: 4, fontSize: 14}}>REC</div>
    <div data-subject="잘린 잔" style={{position: 'absolute', left: 520, top: 280, width: 100, height: 120, background: '#2F5BFF'}} />
    <div data-subject="병" style={{position: 'absolute', left: 60, top: 30, width: 120, height: 80, background: '#0F172A'}} />
    <div data-subject="라벨 붙은 병" style={{position: 'absolute', left: 200, top: 180, width: 120, height: 80, background: '#FFFFFF'}}><span style={{...font, fontSize: 24}}>2 oz</span></div>
  </AbsoluteFill>;
}
