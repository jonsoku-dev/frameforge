import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Envelope', parts: ['body', 'flap', 'seal'], tags: ['envelope', 'mail', 'email', 'letter', 'message', 'invite', 'newsletter', '봉투', '메일', '이메일', '편지', '초대장', '뉴스레터']};

export function Envelope(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}>
      <rect x={40} y={88} width={320} height={224} rx={a.r} {...a.fill(a.soft)} />
      <path d="M56 296 L160 200 M344 296 L240 200" {...a.line} />
    </g>
    <g {...a.part(2)}><path d="M48 96 L200 216 L352 96" {...a.fill(a.accent)} /></g>
    <g {...a.part(3)}><circle cx={200} cy={216} r={24} {...a.fill(a.paper)} /></g>
  </svg>;
}
