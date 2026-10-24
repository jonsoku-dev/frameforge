// The one drawn asset: a pointer arrow, drawn in screen space so it keeps its size while the camera zooms.
export function Cursor({size, ink, paper, press}: {size: number; ink: string; paper: string; press: number}) {
  return <svg width={size} height={size} viewBox="0 0 400 400" style={{transform: `scale(${1 - 0.16 * press})`, transformOrigin: '20% 12%'}}>
    <path d="M80 48 L80 318 L148 256 L196 360 L246 338 L198 236 L290 236 Z" fill={ink} stroke={paper} strokeWidth={22} strokeLinejoin="round" />
  </svg>;
}
