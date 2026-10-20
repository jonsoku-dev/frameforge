import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Ticket', parts: ['body', 'panel', 'perforation', 'stub'], tags: ['ticket', 'event', 'concert', 'movie', 'pass', 'admission', '티켓', '입장권', '공연', '영화', '이벤트', '예매']};

export function Ticket(props: ArtProps) {
  const a = art(props);
  const r = a.r;
  const body = `M ${48 + r} 112 L 240 112 A 24 24 0 0 0 288 112 L ${352 - r} 112 Q 352 112 352 ${112 + r} L 352 ${288 - r} Q 352 288 ${352 - r} 288 L 288 288 A 24 24 0 0 0 240 288 L ${48 + r} 288 Q 48 288 48 ${288 - r} L 48 ${112 + r} Q 48 112 ${48 + r} 112 Z`;
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.accent)} d={body} /></g>
      <g {...a.part(2)}>
        <rect {...a.fill(a.soft)} x={80} y={144} width={136} height={112} rx={a.r} />
        <path {...a.line} d="M 112 184 L 184 184 M 112 216 L 160 216" />
      </g>
      <g {...a.part(3)}><path {...a.line} d="M 264 160 L 264 168 M 264 196 L 264 204 M 264 232 L 264 240" /></g>
      <g {...a.part(4)}><circle {...a.fill(a.paper)} cx={312} cy={200} r={16} /></g>
    </svg>
  );
}
