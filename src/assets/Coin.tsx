import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Coin', parts: ['edge', 'face', 'emblem'], tags: ['coin', 'money', 'cash', 'point', 'reward', 'price', 'pay', '동전', '코인', '돈', '현금', '포인트', '리워드', '가격']};

export function Coin(props: ArtProps) {
  const a = art(props);
  return <svg {...a.svg}>
    <g {...a.part(1)}><circle cx={216} cy={216} r={144} {...a.fill(a.soft)} /></g>
    <g {...a.part(2)}>
      <circle cx={192} cy={192} r={144} {...a.fill(a.accent)} />
      <circle cx={192} cy={192} r={96} {...a.line} />
    </g>
    <g {...a.part(3)}>
      <path d="M192 136 L232 192 L192 248 L152 192 Z" {...a.fill(a.paper)} />
      <path d="M96 128 A112 112 0 0 1 136 88" {...a.line} />
    </g>
  </svg>;
}
