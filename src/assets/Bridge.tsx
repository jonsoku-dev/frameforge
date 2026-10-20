import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Bridge', parts: ['towers', 'deck', 'cables', 'water'], tags: ['bridge', 'connect', 'link', 'city', 'travel', 'river', '다리', '교량', '연결', '도시', '여행', '강']};

export function Bridge(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}>
        <rect {...a.fill(a.soft)} x={112} y={88} width={32} height={224} rx={a.r} />
        <rect {...a.fill(a.soft)} x={256} y={88} width={32} height={224} rx={a.r} />
      </g>
      <g {...a.part(2)}><rect {...a.fill(a.accent)} x={32} y={232} width={336} height={40} rx={a.r} /></g>
      <g {...a.part(3)}>
        <path {...a.line} d="M 32 216 Q 96 192 128 104 Q 200 248 272 104 Q 304 192 368 216" />
        <path {...a.line} d="M 168 160 L 168 232 M 200 176 L 200 232 M 232 160 L 232 232" />
      </g>
      <g {...a.part(4)}><path {...a.line} d="M 40 336 Q 80 312 120 336 T 200 336 T 280 336 T 360 336" /></g>
    </svg>
  );
}
