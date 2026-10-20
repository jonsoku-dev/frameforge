import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'CoinStack', parts: ['bottom', 'middle', 'top', 'coin'], tags: ['coins', 'coin stack', 'savings', 'money', 'budget', 'revenue', 'growth', '동전', '동전탑', '저축', '돈', '예산', '수익', '매출']};

export function CoinStack(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><rect x={48} y={304} width={208} height={48} rx={24} {...a.fill(a.accent)} /></g>
    <g {...a.part(2)}><rect x={72} y={256} width={208} height={48} rx={24} {...a.fill(a.soft)} /></g>
    <g {...a.part(3)}>
      <rect x={56} y={208} width={208} height={48} rx={24} {...a.fill(a.accent)} />
      <rect x={80} y={160} width={208} height={48} rx={24} {...a.fill(a.soft)} />
    </g>
    <g {...a.part(4)}>
      <circle cx={304} cy={280} r={72} {...a.fill(a.accent)} />
      <circle cx={304} cy={280} r={40} {...a.fill(a.paper)} />
    </g>
  </svg>;
}
