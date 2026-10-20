import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Book', parts: ['cover', 'pages', 'lines', 'ribbon'], tags: ['book', 'read', 'study', 'learn', 'education', 'story', '책', '독서', '공부', '학습', '교육', '이야기']};

export function Book(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.accent)} d="M 32 112 L 32 320 Q 120 304 200 336 Q 280 304 368 320 L 368 112 Z" /></g>
      <g {...a.part(2)}>
        <path {...a.fill(a.paper)} d="M 200 128 Q 136 80 56 96 L 56 296 Q 136 280 200 320 Z" />
        <path {...a.fill(a.paper)} d="M 200 128 Q 264 80 344 96 L 344 296 Q 264 280 200 320 Z" />
      </g>
      <g {...a.part(3)}>
        <path {...a.line} d="M 88 152 Q 128 144 168 160 M 88 200 Q 128 192 168 208 M 88 248 Q 128 240 168 256" />
        <path {...a.line} d="M 232 160 Q 272 144 312 152 M 232 208 Q 272 192 312 200" />
      </g>
      <g {...a.part(4)}><path {...a.fill(a.soft)} d="M 280 96 L 280 360 L 296 344 L 312 360 L 312 96 Z" /></g>
    </svg>
  );
}
