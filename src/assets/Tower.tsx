import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Tower', parts: ['frame', 'arch', 'decks', 'spire'], tags: ['tower', 'landmark', 'travel', 'city', 'trip', 'paris', '탑', '타워', '랜드마크', '여행', '도시', '관광']};

export function Tower(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.accent)} d="M 96 360 Q 176 272 184 112 L 216 112 Q 224 272 304 360 Z" /></g>
      <g {...a.part(2)}><path {...a.fill(a.paper)} d="M 144 360 Q 200 256 256 360 Z" /></g>
      <g {...a.part(3)}>
        <rect {...a.fill(a.soft)} x={128} y={232} width={144} height={32} rx={a.r} />
        <rect {...a.fill(a.soft)} x={160} y={152} width={80} height={24} rx={a.r} />
      </g>
      <g {...a.part(4)}><path {...a.line} d="M 200 112 L 200 40" /></g>
    </svg>
  );
}
