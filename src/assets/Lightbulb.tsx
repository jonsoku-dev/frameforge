import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Lightbulb', parts: ['glass', 'filament', 'base', 'glow'], tags: ['lightbulb', 'idea', 'insight', 'tip', 'creative', 'bulb', '전구', '아이디어', '영감', '팁', '창의', '발상']};

export function Lightbulb(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.soft)} d="M 152 264 C 152 224 104 208 104 152 A 96 96 0 0 1 296 152 C 296 208 248 224 248 264 Z" /></g>
      <g {...a.part(2)}><path {...a.line} d="M 176 256 L 176 192 Q 200 160 224 192 L 224 256" /></g>
      <g {...a.part(3)}>
        <rect {...a.fill(a.accent)} x={152} y={256} width={96} height={64} rx={a.r} />
        <path {...a.line} d="M 152 288 L 248 288" />
        <path {...a.fill(a.paper)} d="M 176 320 L 184 344 L 216 344 L 224 320 Z" />
      </g>
      <g {...a.part(4)}><path {...a.line} d="M 200 16 L 200 32 M 48 64 L 64 80 M 352 64 L 336 80" /></g>
    </svg>
  );
}
