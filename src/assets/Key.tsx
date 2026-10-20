import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Key', parts: ['shaft', 'bit', 'bow'], tags: ['key', 'access', 'unlock', 'login', 'home', 'password', '열쇠', '키', '접근', '잠금해제', '로그인', '집']};

export function Key(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><rect {...a.fill(a.soft)} x={160} y={184} width={200} height={32} rx={a.r} /></g>
      <g {...a.part(2)}><path {...a.fill(a.accent)} d="M 272 216 L 272 264 L 296 264 L 296 240 L 320 240 L 320 272 L 344 272 L 344 216" /></g>
      <g {...a.part(3)}>
        <circle {...a.fill(a.accent)} cx={112} cy={200} r={72} />
        <circle {...a.fill(a.paper)} cx={96} cy={200} r={24} />
        <path {...a.line} d="M 200 176 L 200 224" />
      </g>
    </svg>
  );
}
