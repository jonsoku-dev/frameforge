import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Bag', parts: ['handle', 'body', 'rivets'], tags: ['bag', 'shopping', 'shop', 'buy', 'store', 'commerce', '가방', '쇼핑', '쇼핑백', '구매', '상점', '커머스']};

export function Bag(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.line} d="M 152 152 L 152 112 Q 152 64 200 64 Q 248 64 248 112 L 248 152" /></g>
      <g {...a.part(2)}>
        <rect {...a.fill(a.accent)} x={80} y={136} width={240} height={224} rx={a.r} />
        <rect {...a.fill(a.soft)} x={80} y={136} width={240} height={56} rx={a.r} />
      </g>
      <g {...a.part(3)}>
        <circle {...a.fill(a.paper)} cx={152} cy={160} r={8} />
        <circle {...a.fill(a.paper)} cx={248} cy={160} r={8} />
      </g>
    </svg>
  );
}
