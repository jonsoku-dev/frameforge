import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Door', parts: ['floor', 'door', 'panels', 'knob'], tags: ['door', 'entrance', 'exit', 'enter', 'home', 'open', 'start', '문', '출입문', '입구', '출구', '집', '시작']};

export function Door(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><path d="M56 352 H344" {...a.line} /></g>
    <g {...a.part(2)}><rect x={112} y={48} width={176} height={304} rx={a.r} {...a.fill(a.accent)} /></g>
    <g {...a.part(3)}>
      <rect x={144} y={80} width={112} height={96} rx={a.r} {...a.fill(a.soft)} />
      <rect x={144} y={256} width={112} height={64} rx={a.r} {...a.fill(a.soft)} />
    </g>
    <g {...a.part(4)}><circle cx={248} cy={216} r={12} {...a.fill(a.paper)} /></g>
  </svg>;
}
