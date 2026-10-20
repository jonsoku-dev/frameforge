import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Moon', parts: ['crescent', 'craters', 'stars'], tags: ['moon', 'night', 'sleep', 'dark', 'evening', '달', '밤', '수면', '다크모드', '저녁']};

export function Moon(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.accent)} d="M 216 64 A 136 136 0 1 0 344 248 A 112 112 0 0 1 216 64 Z" /></g>
      <g {...a.part(2)}>
        <circle {...a.fill(a.soft)} cx={128} cy={224} r={24} />
        <circle {...a.fill(a.soft)} cx={200} cy={296} r={16} />
      </g>
      <g {...a.part(3)}>
        <path {...a.line} d="M 320 72 L 320 120 M 296 96 L 344 96" />
        <path {...a.line} d="M 360 160 L 360 176 M 352 168 L 368 168" />
      </g>
    </svg>
  );
}
