import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Tag', parts: ['string', 'body', 'hole', 'label'], tags: ['tag', 'price', 'sale', 'discount', 'label', 'deal', '태그', '가격', '할인', '세일', '라벨', '특가']};

export function Tag(props: ArtProps) {
  const a = art(props);
  const r = a.r;
  const body = `M 56 200 L 136 120 L ${352 - r} 120 Q 352 120 352 ${120 + r} L 352 ${280 - r} Q 352 280 ${352 - r} 280 L 136 280 Z`;
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.line} d="M 136 200 C 88 152 72 88 128 56" /></g>
      <g {...a.part(2)}><path {...a.fill(a.accent)} d={body} /></g>
      <g {...a.part(3)}><circle {...a.fill(a.paper)} cx={136} cy={200} r={20} /></g>
      <g {...a.part(4)}><path {...a.line} d="M 200 168 L 304 168 M 200 232 L 272 232" /></g>
    </svg>
  );
}
