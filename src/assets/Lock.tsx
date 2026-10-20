import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Lock', parts: ['shackle', 'body', 'keyhole'], tags: ['lock', 'secure', 'security', 'privacy', 'safe', 'password', '자물쇠', '잠금', '보안', '개인정보', '안전', '비밀번호']};

export function Lock(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.line} d="M 128 192 L 128 136 A 72 72 0 0 1 272 136 L 272 192" /></g>
      <g {...a.part(2)}>
        <rect {...a.fill(a.accent)} x={80} y={184} width={240} height={176} rx={a.r} />
        <path {...a.line} d="M 120 224 L 120 320" />
      </g>
      <g {...a.part(3)}>
        <circle {...a.fill(a.paper)} cx={200} cy={256} r={24} />
        <path {...a.line} d="M 200 280 L 200 312" />
      </g>
    </svg>
  );
}
