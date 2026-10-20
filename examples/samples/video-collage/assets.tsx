import type {CSSProperties} from 'react';

// This film's subjects are footage and the badge GIF (the AnimatedImage under test), so its one drawn asset is the plate behind clip A.
/** One stroke width for the film, in viewBox units (the plate is fill only; kept so later drawn assets share it). */
export const STROKE = 12;
/** One corner radius for the film, in viewBox units. */
export const RADIUS = 16;
const accent = '#22C55E';

export type AssetProps = {draw?: number; size: number; color?: string; style?: CSSProperties};

/** A hand-cut card the clip sits on: four slightly bowed edges. `size` is its width; it keeps the clip's 1440×680 aspect. */
export function Plate({draw = 1, size, color = accent, style}: AssetProps) {
  return <svg width={size} height={size * 680 / 1440} viewBox="0 0 1440 680" style={style}>
    <path d="M18 24Q720 8 1424 20Q1436 340 1420 662Q720 674 22 660Q6 340 18 24Z" fill={color} fillOpacity={draw} />
  </svg>;
}

export const ASSETS = {Plate};
