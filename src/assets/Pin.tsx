import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Pin', parts: ['ground', 'pin', 'hole'], tags: ['pin', 'map', 'location', 'place', 'marker', 'address', 'gps', '핀', '지도', '위치', '장소', '주소', '마커']};

export function Pin(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><ellipse cx={200} cy={352} rx={88} ry={16} {...a.fill(a.soft)} /></g>
    <g {...a.part(2)}>
      <path d="M200 352 C168 312 80 240 80 160 A120 120 0 0 1 320 160 C320 240 232 312 200 352 Z" {...a.fill(a.accent)} />
      <path d="M120 128 A88 88 0 0 1 168 80" {...a.line} />
    </g>
    <g {...a.part(3)}><circle cx={200} cy={160} r={48} {...a.fill(a.paper)} /></g>
  </svg>;
}
