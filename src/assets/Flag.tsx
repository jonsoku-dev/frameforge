import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Flag', parts: ['pole', 'cloth', 'emblem'], tags: ['flag', 'goal', 'milestone', 'finish', 'country', 'start', '깃발', '목표', '마일스톤', '도착', '국가', '시작']};

export function Flag(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}>
        <rect {...a.fill(a.soft)} x={64} y={344} width={80} height={24} rx={a.r} />
        <path {...a.line} d="M 104 344 L 104 72" />
        <circle {...a.fill(a.paper)} cx={104} cy={56} r={16} />
      </g>
      <g {...a.part(2)}><path {...a.fill(a.accent)} d="M 104 88 Q 168 56 232 88 T 360 88 L 360 232 Q 296 264 232 232 Q 168 200 104 232 Z" /></g>
      <g {...a.part(3)}><circle {...a.fill(a.paper)} cx={232} cy={160} r={32} /></g>
    </svg>
  );
}
