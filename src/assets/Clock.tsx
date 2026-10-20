import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Clock', parts: ['bells', 'face', 'hands'], tags: ['clock', 'alarm', 'time', 'deadline', 'schedule', 'morning', 'wake', '시계', '알람', '시간', '마감', '일정', '기상']};

export function Clock(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}>
      <path d="M72 136 A72 72 0 0 1 160 56 Z M328 136 A72 72 0 0 0 240 56 Z" {...a.fill(a.accent)} />
      <path d="M120 320 L88 360 M280 320 L312 360" {...a.line} />
    </g>
    <g {...a.part(2)}>
      <circle cx={200} cy={216} r={136} {...a.fill(a.paper)} />
      <path d="M200 104 V120 M312 216 H296 M200 328 V312 M88 216 H104" {...a.line} />
    </g>
    <g {...a.part(3)}>
      <path d="M200 216 V136 M200 216 L256 248" {...a.line} />
      <circle cx={200} cy={216} r={16} {...a.fill(a.accent)} />
    </g>
  </svg>;
}
