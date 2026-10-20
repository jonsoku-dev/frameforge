import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Cup', parts: ['saucer', 'body', 'handle', 'steam'], tags: ['cup', 'coffee', 'tea', 'cafe', 'drink', 'break', '컵', '커피', '차', '카페', '음료', '휴식']};

export function Cup(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><rect x={56} y={320} width={288} height={32} rx={a.r} {...a.fill(a.soft)} /></g>
    <g {...a.part(2)}>
      <path d="M88 176 H296 L280 288 Q272 320 240 320 H144 Q112 320 104 288 Z" {...a.fill(a.accent)} />
      <path d="M96 216 H288" {...a.line} />
    </g>
    <g {...a.part(3)}><path d="M292 200 H312 Q344 200 344 232 Q344 272 304 272 H284" {...a.line} /></g>
    <g {...a.part(4)}>
      <path d="M160 136 C136 112 184 96 160 56" {...a.line} />
      <path d="M224 136 C200 112 248 96 224 56" {...a.line} />
    </g>
  </svg>;
}
