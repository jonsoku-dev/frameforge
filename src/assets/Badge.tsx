import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Badge', parts: ['ribbons', 'medal', 'check'], tags: ['badge', 'verified', 'award', 'certified', 'quality', 'achievement', '배지', '뱃지', '인증', '수상', '품질', '업적']};

export function Badge(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}>
      <path d="M144 232 L104 360 L152 336 L176 376 L208 272 Z" {...a.fill(a.soft)} />
      <path d="M256 232 L296 360 L248 336 L224 376 L192 272 Z" {...a.fill(a.soft)} />
    </g>
    <g {...a.part(2)}>
      <circle cx={200} cy={168} r={128} {...a.fill(a.accent)} />
      <circle cx={200} cy={168} r={80} {...a.fill(a.paper)} />
    </g>
    <g {...a.part(3)}><path d="M160 168 L192 200 L248 136" {...a.line} /></g>
  </svg>;
}
