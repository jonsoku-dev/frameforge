import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Bell', parts: ['bell', 'clapper', 'ring'], tags: ['bell', 'notification', 'alert', 'reminder', 'ring', 'alarm', '종', '벨', '알림', '알람', '리마인더', '공지']};

export function Bell(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}>
      <circle cx={200} cy={72} r={16} {...a.fill(a.soft)} />
      <path d="M112 272 V184 A88 88 0 0 1 288 184 V272 L320 304 H80 Z" {...a.fill(a.accent)} />
      <path d="M112 248 H288" {...a.line} />
    </g>
    <g {...a.part(2)}><circle cx={200} cy={336} r={24} {...a.fill(a.soft)} /></g>
    <g {...a.part(3)}><path d="M56 144 Q32 192 56 240 M344 144 Q368 192 344 240" {...a.line} /></g>
  </svg>;
}
