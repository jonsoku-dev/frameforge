import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'SpeechBubble', parts: ['bubble', 'dots'], tags: ['speech bubble', 'chat', 'message', 'comment', 'talk', 'reply', 'typing', '말풍선', '채팅', '메시지', '댓글', '대화', '답장']};

export function SpeechBubble(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><path d="M88 64 H312 Q344 64 344 96 V232 Q344 264 312 264 H184 L112 328 V264 H88 Q56 264 56 232 V96 Q56 64 88 64 Z" {...a.fill(a.accent)} /></g>
    <g {...a.part(2)}>
      <circle cx={136} cy={164} r={20} {...a.fill(a.paper)} />
      <circle cx={200} cy={164} r={20} {...a.fill(a.paper)} />
      <circle cx={264} cy={164} r={20} {...a.fill(a.soft)} />
    </g>
  </svg>;
}
