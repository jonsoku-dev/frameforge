import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'BarChart', parts: ['axes', 'bars', 'trend'], tags: ['bar chart', 'chart', 'graph', 'stats', 'growth', 'report', 'sales', '막대그래프', '차트', '그래프', '통계', '성장', '보고서', '매출']};

export function BarChart(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><path d="M56 56 V344 H352" {...a.line} /></g>
    <g {...a.part(2)}>
      <rect x={96} y={248} width={56} height={96} rx={a.r} {...a.fill(a.soft)} />
      <rect x={184} y={192} width={56} height={152} rx={a.r} {...a.fill(a.soft)} />
      <rect x={272} y={128} width={56} height={216} rx={a.r} {...a.fill(a.accent)} />
    </g>
    <g {...a.part(3)}><path d="M104 184 L184 128 L224 152 L304 72 M264 72 H304 V112" {...a.line} /></g>
  </svg>;
}
