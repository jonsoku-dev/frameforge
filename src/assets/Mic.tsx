import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Mic', parts: ['yoke', 'capsule', 'grille', 'stand'], tags: ['mic', 'microphone', 'podcast', 'voice', 'record', 'speak', '마이크', '팟캐스트', '목소리', '녹음', '발표', '라디오']};

export function Mic(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.line} d="M 112 176 L 112 200 A 88 88 0 0 0 288 200 L 288 176" /></g>
      <g {...a.part(2)}><rect {...a.fill(a.accent)} x={152} y={48} width={96} height={192} rx={48} /></g>
      <g {...a.part(3)}><path {...a.line} d="M 176 112 L 224 112 M 176 144 L 224 144 M 176 176 L 224 176" /></g>
      <g {...a.part(4)}>
        <path {...a.line} d="M 200 288 L 200 336" />
        <rect {...a.fill(a.soft)} x={128} y={336} width={144} height={24} rx={a.r} />
      </g>
    </svg>
  );
}
