import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Card', parts: ['card', 'chip', 'number', 'brand'], tags: ['card', 'credit card', 'payment', 'pay', 'bank', 'checkout', '카드', '신용카드', '결제', '은행', '체크카드']};

export function Card(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><rect x={40} y={96} width={320} height={208} rx={a.r} {...a.fill(a.accent)} /></g>
    <g {...a.part(2)}>
      <rect x={80} y={136} width={64} height={48} rx={a.r} {...a.fill(a.soft)} />
      <path d="M80 160 H144 M112 136 V160" {...a.line} />
    </g>
    <g {...a.part(3)}><path d="M80 232 H112 M144 232 H176 M208 232 H240 M80 264 H144" {...a.line} /></g>
    <g {...a.part(4)}>
      <circle cx={288} cy={256} r={24} {...a.fill(a.soft)} />
      <circle cx={320} cy={256} r={24} {...a.fill(a.paper)} />
    </g>
  </svg>;
}
