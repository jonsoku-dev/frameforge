import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Window', parts: ['frame', 'bar', 'content'], tags: ['window', 'browser', 'web', 'website', 'app', 'page', 'screen', '창', '윈도우', '브라우저', '웹', '웹사이트', '페이지']};

export function Window(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><rect x={40} y={64} width={320} height={272} rx={a.r} {...a.fill(a.paper)} /></g>
    <g {...a.part(2)}>
      <path d="M40 128 H360" {...a.line} />
      <circle cx={80} cy={96} r={8} {...a.fill(a.accent)} />
      <circle cx={120} cy={96} r={8} {...a.fill(a.soft)} />
      <circle cx={160} cy={96} r={8} {...a.fill(a.soft)} />
    </g>
    <g {...a.part(3)}>
      <rect x={80} y={168} width={112} height={128} rx={a.r} {...a.fill(a.accent)} />
      <path d="M232 184 H320 M232 216 H296 M232 248 H320 M232 280 H280" {...a.line} />
    </g>
  </svg>;
}
