import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Star', parts: ['star', 'shine', 'sparkles'], tags: ['star', 'rating', 'review', 'favorite', 'best', 'highlight', '별', '별점', '평점', '리뷰', '즐겨찾기', '최고']};

export function Star(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><path d="M200 48 L240 152 L352 160 L264 232 L296 344 L200 280 L104 344 L136 232 L48 160 L160 152 Z" {...a.fill(a.accent)} /></g>
    <g {...a.part(2)}><path d="M200 104 L184 144" {...a.line} /></g>
    <g {...a.part(3)}>
      <path d="M336 280 V328 M312 304 H360" {...a.line} />
      <path d="M64 56 V88 M48 72 H80" {...a.line} />
    </g>
  </svg>;
}
