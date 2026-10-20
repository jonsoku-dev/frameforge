import {AbsoluteFill, interpolate, random, useCurrentFrame} from 'frameforge';

// Math.random() and Date.now() in a comment are not code.
export function Scene() {
  const frame = useCurrentFrame();
  const label = 'see https://example.com // not a comment';
  return <AbsoluteFill style={{opacity: interpolate(frame, [0, 30], [0, 1]), transition: 'none', left: random('x') * 10}}>{label}</AbsoluteFill>;
}
