import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Scooter', parts: ['wheels', 'body', 'steering', 'basket'], tags: ['scooter', 'delivery', 'ride', 'motorbike', 'transport', 'commute', '스쿠터', '배달', '오토바이', '이동', '출퇴근', '교통']};

export function Scooter(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}>
        <circle {...a.fill(a.paper)} cx={104} cy={304} r={40} />
        <circle {...a.fill(a.paper)} cx={304} cy={304} r={40} />
      </g>
      <g {...a.part(2)}>
        <path {...a.fill(a.accent)} d="M 56 272 L 56 224 Q 56 200 80 200 L 152 200 Q 176 200 184 224 L 192 248 L 288 248 L 296 272 Z" />
        <rect {...a.fill(a.soft)} x={72} y={160} width={96} height={40} rx={a.r} />
      </g>
      <g {...a.part(3)}><path {...a.line} d="M 304 304 L 264 104 M 232 104 L 296 104" /></g>
      <g {...a.part(4)}>
        <rect {...a.fill(a.soft)} x={288} y={136} width={80} height={72} rx={a.r} />
        <path {...a.line} d="M 288 168 L 368 168 M 328 136 L 328 208" />
      </g>
    </svg>
  );
}
