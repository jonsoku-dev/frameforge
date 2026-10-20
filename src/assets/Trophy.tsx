import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Trophy', parts: ['base', 'cup', 'star'], tags: ['trophy', 'winner', 'champion', 'prize', 'award', 'victory', 'first place', '트로피', '우승', '챔피언', '상', '수상', '1등', '승리']};

export function Trophy(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}>
      <rect x={112} y={312} width={176} height={48} rx={a.r} {...a.fill(a.soft)} />
      <path d="M200 256 V312" {...a.line} />
    </g>
    <g {...a.part(2)}>
      <path d="M128 96 H96 Q64 96 64 128 Q64 184 136 200 M272 96 H304 Q336 96 336 128 Q336 184 264 200" {...a.line} />
      <path d="M120 56 H280 V160 Q280 248 200 248 Q120 248 120 160 Z" {...a.fill(a.accent)} />
    </g>
    <g {...a.part(3)}><path d="M200 104 L216 136 L248 136 L224 160 L232 192 L200 176 L168 192 L176 160 L152 136 L184 136 Z" {...a.fill(a.paper)} /></g>
  </svg>;
}
