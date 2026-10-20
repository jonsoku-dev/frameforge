import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Heart', parts: ['heart', 'shine', 'sparkles'], tags: ['heart', 'love', 'like', 'favorite', 'care', 'health', '하트', '사랑', '좋아요', '찜', '관심', '건강']};

export function Heart(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><path d="M200 344 C136 296 56 240 56 160 C56 112 96 80 136 80 C168 80 192 96 200 128 C208 96 232 80 264 80 C304 80 344 112 344 160 C344 240 264 296 200 344 Z" {...a.fill(a.accent)} /></g>
    <g {...a.part(2)}><path d="M104 168 C104 144 112 128 136 128" {...a.line} /></g>
    <g {...a.part(3)}>
      <path d="M344 48 V96 M320 72 H368" {...a.line} />
      <path d="M48 288 V320 M32 304 H64" {...a.line} />
    </g>
  </svg>;
}
