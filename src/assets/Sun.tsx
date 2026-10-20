import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Sun', parts: ['disc', 'rays', 'shine'], tags: ['sun', 'sunny', 'weather', 'summer', 'morning', 'day', '해', '태양', '맑음', '날씨', '여름', '아침']};

export function Sun(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><circle {...a.fill(a.accent)} cx={200} cy={200} r={88} /></g>
      <g {...a.part(2)}>
        <path {...a.line} d="M 200 72 L 200 32 M 200 328 L 200 368 M 72 200 L 32 200 M 328 200 L 368 200" />
        <path {...a.line} d="M 288 288 L 312 312 M 112 288 L 88 312 M 112 112 L 88 88 M 288 112 L 312 88" />
      </g>
      <g {...a.part(3)}><path {...a.line} d="M 144 208 A 56 56 0 0 1 192 152" /></g>
    </svg>
  );
}
