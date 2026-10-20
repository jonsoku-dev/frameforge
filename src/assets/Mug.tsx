import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Mug', parts: ['body', 'handle', 'teabag'], tags: ['mug', 'tea', 'teabag', 'morning', 'drink', 'home', '머그', '머그컵', '차', '티백', '아침', '음료']};

export function Mug(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}>
      <rect x={72} y={112} width={224} height={240} rx={a.r} {...a.fill(a.accent)} />
      <path d="M72 296 H296" {...a.line} />
    </g>
    <g {...a.part(2)}><path d="M296 160 H312 Q352 160 352 200 V232 Q352 272 312 272 H296" {...a.line} /></g>
    <g {...a.part(3)}>
      <path d="M224 112 Q224 72 192 56 M224 112 V184" {...a.line} />
      <rect x={200} y={184} width={48} height={56} rx={a.r} {...a.fill(a.paper)} />
      <path d="M216 208 H232" {...a.line} />
    </g>
  </svg>;
}
