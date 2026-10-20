import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Wave', parts: ['crest', 'swell', 'curl', 'foam'], tags: ['wave', 'sea', 'ocean', 'beach', 'surf', 'water', '파도', '바다', '해변', '서핑', '물']};

export function Wave(props: ArtProps) {
  const a = art(props);
  return (
    <svg {...a.svg}>
      <g {...a.part(1)}><path {...a.fill(a.accent)} d="M 32 344 C 48 224 136 96 248 88 C 328 80 376 136 368 192 C 360 232 320 248 296 224 C 280 264 296 312 344 344 Z" /></g>
      <g {...a.part(2)}><path {...a.fill(a.soft)} d="M 32 344 L 32 312 Q 112 272 200 312 T 368 312 L 368 344 Z" /></g>
      <g {...a.part(3)}><path {...a.line} d="M 224 176 C 216 128 296 120 312 160 C 320 184 296 200 280 184" /></g>
      <g {...a.part(4)}>
        <circle {...a.fill(a.paper)} cx={344} cy={264} r={8} />
        <circle {...a.fill(a.paper)} cx={368} cy={240} r={8} />
      </g>
    </svg>
  );
}
