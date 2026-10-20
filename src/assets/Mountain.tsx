import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Mountain', parts: ['back peak', 'front peak', 'snow', 'sun', 'ground'], tags: ['mountain', 'hike', 'outdoor', 'goal', 'peak', 'adventure', '산', '등산', '아웃도어', '목표', '정상', '모험']};

export function Mountain(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.soft)} d="M 192 328 L 280 160 L 368 328 Z" /></g>
      <g {...a.part(2)}><path {...a.fill(a.accent)} d="M 32 328 L 160 96 L 288 328 Z" /></g>
      <g {...a.part(3)}><path {...a.fill(a.paper)} d="M 112 184 L 160 96 L 208 184 L 184 168 L 160 192 L 136 168 Z" /></g>
      <g {...a.part(4)}><circle {...a.fill(a.paper)} cx={312} cy={88} r={32} /></g>
      <g {...a.part(5)}><path {...a.line} d="M 16 328 L 384 328" /></g>
    </svg>
  );
}
