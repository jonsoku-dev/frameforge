import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Headphones', parts: ['band', 'cushions', 'cups'], tags: ['headphones', 'music', 'listen', 'audio', 'podcast', 'sound', '헤드폰', '음악', '듣기', '오디오', '팟캐스트', '소리']};

export function Headphones(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.line} d="M 88 248 L 88 200 A 112 112 0 0 1 312 200 L 312 248" /></g>
      <g {...a.part(2)}>
        <rect {...a.fill(a.soft)} x={104} y={240} width={40} height={104} rx={a.r} />
        <rect {...a.fill(a.soft)} x={256} y={240} width={40} height={104} rx={a.r} />
      </g>
      <g {...a.part(3)}>
        <rect {...a.fill(a.accent)} x={48} y={224} width={72} height={136} rx={a.r} />
        <rect {...a.fill(a.accent)} x={280} y={224} width={72} height={136} rx={a.r} />
      </g>
    </svg>
  );
}
