import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Laptop', parts: ['lid', 'screen', 'deck'], tags: ['laptop', 'computer', 'notebook', 'work', 'office', 'remote', '노트북', '랩톱', '컴퓨터', '업무', '재택']};

export function Laptop(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><rect x={80} y={80} width={240} height={184} rx={a.r} {...a.fill(a.accent)} /></g>
    <g {...a.part(2)}>
      <rect x={104} y={104} width={192} height={136} rx={a.r} {...a.fill(a.paper)} />
      <path d="M136 208 L176 168 L208 192 L264 136" {...a.line} />
    </g>
    <g {...a.part(3)}>
      <path d="M48 264 H352 V288 Q352 320 320 320 H80 Q48 320 48 288 Z" {...a.fill(a.soft)} />
      <path d="M168 264 V272 Q168 288 184 288 H216 Q232 288 232 272 V264" {...a.line} />
    </g>
  </svg>;
}
