import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'PlayButton', parts: ['player', 'play', 'progress'], tags: ['play', 'play button', 'video', 'player', 'watch', 'stream', 'youtube', '재생', '재생버튼', '영상', '동영상', '플레이어', '시청']};

export function PlayButton(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><rect x={40} y={72} width={320} height={224} rx={a.r} {...a.fill(a.accent)} /></g>
    <g {...a.part(2)}><path d="M168 136 L256 184 L168 232 Z" {...a.fill(a.paper)} /></g>
    <g {...a.part(3)}>
      <path d="M72 344 H328" {...a.line} stroke={a.soft} />
      <path d="M72 344 H168" {...a.line} />
      <circle cx={168} cy={344} r={16} {...a.fill(a.paper)} />
    </g>
  </svg>;
}
