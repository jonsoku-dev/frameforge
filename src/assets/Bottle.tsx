import {art, VIEW, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Bottle', parts: ['body', 'label', 'neck', 'shine'], tags: ['bottle', 'pour', 'gin', 'wine', 'syrup', 'cocktail', 'bar', 'recipe', 'ingredient', '병', '술병', '붓기', '칵테일', '레시피', '재료']};

export type BottleProps = ArtProps & {
  /** Words on the label panel (keep it to one short word). */ label?: string;
  /** Degrees clockwise around the box centre; 90 lies the bottle on its side with the neck to the right, ~115 pours. */ tilt?: number;
};

const LIP: [number, number] = [200, 40];
/** Where the pour leaves the bottle: the centre of its lip in px of the bottle's parent, for a bottle of `size` placed at (x, y) and
 * turned `tilt` degrees. Pass it as `<Stream from>`, so the stream leaves the bottle's own neck in every frame of the tilt. */
export function bottleNeck({size, tilt = 0, x = 0, y = 0}: {size: number; tilt?: number; x?: number; y?: number}): [number, number] {
  const a = tilt * Math.PI / 180, k = size / VIEW, dx = LIP[0] - VIEW / 2, dy = LIP[1] - VIEW / 2;
  return [x + (VIEW / 2 + dx * Math.cos(a) - dy * Math.sin(a)) * k, y + (VIEW / 2 + dx * Math.sin(a) + dy * Math.cos(a)) * k];
}

/** A labelled bottle with round shoulders, a ringed lip, a side shade and a highlight; `tilt` turns it about the box centre so it can pour. */
export function Bottle({label, tilt = 0, ...props}: BottleProps) {
  const a = art(props);
  const turn = (index: number) => ({...a.part(index), transform: tilt ? `rotate(${tilt} 200 200)` : undefined});
  const fade = Math.min(1, Math.max(0, props.draw ?? 1));
  return <svg {...a.svg} style={{overflow: 'visible', ...props.style}}>
    <g {...turn(1)}>
      <path d="M176 112 V136 Q136 160 136 208 V328 Q136 352 160 352 H240 Q264 352 264 328 V208 Q264 160 224 136 V112 Z" {...a.fill(a.accent)} />
      <path d="M232 168 Q248 184 248 216 V320 Q248 336 232 336 Z" fill={a.ink} fillOpacity={0.18 * fade} />
    </g>
    <g {...turn(2)}>
      <rect x={152} y={224} width={96} height={88} rx={a.r} {...a.fill(a.paper)} />
      <path d="M168 296 H232" {...a.line} />
      {label ? <text x={200} y={270} textAnchor="middle" fontSize={Math.min(36, 120 / Math.max(1, label.length) * 1.4)} fontWeight={800} fontFamily="inherit" fill={a.ink} fillOpacity={fade}>{label}</text> : null}
    </g>
    <g {...turn(3)}>
      <path d="M180 112 V56 H220 V112" {...a.fill(a.accent)} />
      <rect x={172} y={36} width={56} height={24} rx={a.r} {...a.fill(a.soft)} />
    </g>
    <g {...turn(4)}><path d="M156 216 V312" {...a.line} stroke={a.paper} /></g>
  </svg>;
}
