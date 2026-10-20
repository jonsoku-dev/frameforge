import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Phone', parts: ['body', 'screen', 'content'], tags: ['phone', 'smartphone', 'mobile', 'app', 'device', '폰', '휴대폰', '스마트폰', '모바일', '앱']};

export function Phone(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><rect x={112} y={32} width={176} height={336} rx={a.r} {...a.fill(a.accent)} /></g>
    <g {...a.part(2)}>
      <rect x={136} y={80} width={128} height={256} rx={a.r} {...a.fill(a.paper)} />
      <path d="M184 56 H216" {...a.line} />
    </g>
    <g {...a.part(3)}>
      <rect x={160} y={112} width={80} height={72} rx={a.r} {...a.fill(a.soft)} />
      <path d="M160 224 H240 M160 256 H216 M160 288 H232" {...a.line} />
    </g>
  </svg>;
}
