import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Leaf', parts: ['blade', 'veins', 'stem'], tags: ['leaf', 'plant', 'nature', 'eco', 'green', 'spring', '잎', '나뭇잎', '식물', '자연', '친환경', '봄']};

export function Leaf(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.accent)} d="M 96 304 C 96 160 192 72 328 72 C 328 216 240 304 96 304 Z" /></g>
      <g {...a.part(2)}>
        <path {...a.line} d="M 96 304 L 256 144" />
        <path {...a.line} d="M 168 232 L 240 240" />
        <path {...a.line} d="M 208 192 L 200 128" />
      </g>
      <g {...a.part(3)}><path {...a.line} d="M 96 304 C 80 336 56 344 40 328" /></g>
    </svg>
  );
}
