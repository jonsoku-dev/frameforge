import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Calendar', parts: ['page', 'header', 'days'], tags: ['calendar', 'date', 'day', 'schedule', 'event', 'plan', 'deadline', '달력', '캘린더', '날짜', '일정', '이벤트', '계획']};

export function Calendar(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><rect x={56} y={80} width={288} height={280} rx={a.r} {...a.fill(a.paper)} /></g>
    <g {...a.part(2)}>
      <path d={`M56 ${80 + a.r} Q56 80 ${56 + a.r} 80 H${344 - a.r} Q344 80 344 ${80 + a.r} V152 H56 Z`} {...a.fill(a.accent)} />
      <path d="M136 48 V112 M264 48 V112" {...a.line} />
    </g>
    <g {...a.part(3)}>
      <circle cx={248} cy={264} r={28} {...a.fill(a.soft)} />
      <path d="M104 200 h0 M152 200 h0 M200 200 h0 M248 200 h0 M296 200 h0 M104 264 h0 M152 264 h0 M200 264 h0 M296 264 h0 M104 320 h0 M152 320 h0 M200 320 h0" {...a.line} />
    </g>
  </svg>;
}
