import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Cloud', parts: ['back', 'front', 'wind'], tags: ['cloud', 'cloudy', 'weather', 'sky', 'storage', '구름', '흐림', '날씨', '하늘', '클라우드']};

export function Cloud(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.soft)} d="M 216 136 A 64 64 0 0 1 336 120 A 48 48 0 0 1 344 216 L 296 216 Z" /></g>
      <g {...a.part(2)}>
        <path {...a.fill(a.paper)} d="M 112 296 A 56 56 0 0 1 112 184 A 80 80 0 0 1 256 160 A 64 64 0 0 1 328 232 A 32 32 0 0 1 296 296 Z" />
        <path {...a.line} d="M 144 240 A 40 40 0 0 1 184 200" />
      </g>
      <g {...a.part(3)}><path {...a.line} d="M 88 352 L 200 352 M 248 352 L 296 352" /></g>
    </svg>
  );
}
