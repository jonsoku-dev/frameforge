import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Gift', parts: ['box', 'lid', 'bow'], tags: ['gift', 'present', 'reward', 'birthday', 'bonus', 'event', '선물', '선물상자', '보상', '생일', '혜택', '이벤트']};

export function Gift(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}>
        <rect {...a.fill(a.accent)} x={80} y={184} width={240} height={168} rx={a.r} />
        <rect {...a.fill(a.soft)} x={176} y={184} width={48} height={168} rx={a.r} />
      </g>
      <g {...a.part(2)}>
        <rect {...a.fill(a.accent)} x={56} y={136} width={288} height={56} rx={a.r} />
        <rect {...a.fill(a.soft)} x={176} y={136} width={48} height={56} rx={a.r} />
      </g>
      <g {...a.part(3)}><path {...a.fill(a.soft)} d="M 200 136 C 152 56 96 112 200 136 C 304 112 248 56 200 136 Z" /></g>
    </svg>
  );
}
