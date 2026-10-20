import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'LineChart', parts: ['frame', 'area', 'line'], tags: ['line chart', 'chart', 'graph', 'trend', 'analytics', 'data', 'stock', '선그래프', '꺾은선', '차트', '그래프', '추세', '분석', '데이터', '주가']};

export function LineChart(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}>
      <rect x={40} y={64} width={320} height={272} rx={a.r} {...a.fill(a.paper)} />
      <path d="M80 144 H320 M80 216 H320" {...a.line} stroke={a.soft} />
    </g>
    <g {...a.part(2)}><path d="M80 272 L152 200 L216 240 L304 128 V296 H80 Z" {...a.fill(a.soft)} stroke="none" /></g>
    <g {...a.part(3)}>
      <path d="M80 272 L152 200 L216 240 L304 128" {...a.line} />
      <circle cx={304} cy={128} r={20} {...a.fill(a.accent)} />
    </g>
  </svg>;
}
