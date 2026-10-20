import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Camera', parts: ['top', 'body', 'lens', 'flash'], tags: ['camera', 'photo', 'picture', 'snapshot', 'record', 'vlog', '카메라', '사진', '촬영', '스냅', '기록', '브이로그']};

export function Camera(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}>
        <path {...a.fill(a.soft)} d="M 136 136 L 160 88 L 240 88 L 264 136 Z" />
        <rect {...a.fill(a.paper)} x={280} y={104} width={48} height={32} rx={a.r} />
      </g>
      <g {...a.part(2)}><rect {...a.fill(a.accent)} x={40} y={128} width={320} height={216} rx={a.r} /></g>
      <g {...a.part(3)}>
        <circle {...a.fill(a.soft)} cx={200} cy={240} r={80} />
        <circle {...a.fill(a.paper)} cx={200} cy={240} r={40} />
        <path {...a.line} d="M 176 240 A 24 24 0 0 1 200 216" />
      </g>
      <g {...a.part(4)}><rect {...a.fill(a.paper)} x={72} y={160} width={48} height={24} rx={a.r} /></g>
    </svg>
  );
}
