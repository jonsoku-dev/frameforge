import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Rocket', parts: ['flame', 'fins', 'body', 'window'], tags: ['rocket', 'launch', 'startup', 'growth', 'space', 'boost', '로켓', '출시', '런칭', '스타트업', '성장', '우주']};

export function Rocket(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.soft)} d="M 168 288 Q 168 344 200 376 Q 232 344 232 288 Z" /></g>
      <g {...a.part(2)}>
        <path {...a.fill(a.accent)} d="M 152 216 L 96 288 L 96 320 L 152 296 Z" />
        <path {...a.fill(a.accent)} d="M 248 216 L 304 288 L 304 320 L 248 296 Z" />
      </g>
      <g {...a.part(3)}>
        <path {...a.fill(a.paper)} d="M 152 304 L 152 160 C 152 112 176 72 200 40 C 224 72 248 112 248 160 L 248 304 Z" />
        <path {...a.fill(a.accent)} d="M 160 120 C 168 96 184 64 200 40 C 216 64 232 96 240 120 Z" />
      </g>
      <g {...a.part(4)}><circle {...a.fill(a.soft)} cx={200} cy={192} r={32} /></g>
    </svg>
  );
}
