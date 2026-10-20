import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig} from '../core/index';

export type TrailProps = {readonly children: React.ReactNode; readonly layers: number; readonly lagInFrames: number; readonly trailOpacity: number};
export type CameraMotionBlurProps = {readonly children: React.ReactNode; readonly shutterAngle?: number; readonly samples?: number};
/** @deprecated Use `Trail`; `blurOpacity` is the old name of `trailOpacity`. */
export type MotionBlurProps = Omit<TrailProps, 'trailOpacity'> & {readonly blurOpacity: number};

function check(value: unknown, name: string, wholeNonNegative: boolean): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`"${name}" must be a number, but got ${JSON.stringify(value)}`);
  if (!wholeNonNegative) return;
  if (!Number.isInteger(value)) throw new Error(`"${name}" must be an integer, but got ${JSON.stringify(value)}`);
  if (value < 0) throw new Error(`"${name}" must be non-negative, but got ${JSON.stringify(value)}`);
}
// Each layer sees a fixed frame, clamped to the current timeline.
function Layer({frame, style, children}: {frame: number; style: React.CSSProperties; children: React.ReactNode}) {
  const last = useVideoConfig().durationInFrames - 1;
  return <AbsoluteFill style={style}><Sequence layout="none" freeze={Math.max(0, Math.min(last, frame))}>{children}</Sequence></AbsoluteFill>;
}

/** Renders `layers` earlier copies of `children` under the live one, each `lagInFrames` further back and more transparent. */
export const Trail: React.FC<TrailProps> = ({children, layers, lagInFrames, trailOpacity}) => {
  check(layers, 'layers', true); check(trailOpacity, 'trailOpacity', false); check(lagInFrames, 'lagInFrames', false);
  const frame = useCurrentFrame();
  return <AbsoluteFill>
    {Array.from({length: layers}, (_, i) => <Layer key={i} frame={frame - lagInFrames * (layers - i)} style={{opacity: interpolate(layers - i, [0, layers], [trailOpacity, 0])}}>{children}</Layer>)}
    {children}
  </AbsoluteFill>;
};

/** Averages `samples` copies of `children` spread over the shutter interval that ends one frame after the current one. */
export const CameraMotionBlur: React.FC<CameraMotionBlurProps> = ({children, shutterAngle = 180, samples = 10}) => {
  check(samples, 'samples', true); check(shutterAngle, 'shutterAngle', false);
  if (shutterAngle < 0 || shutterAngle > 360) throw new Error(`"shutterAngle" must be between 0 and 360, but got ${JSON.stringify(shutterAngle)}`);
  const frame = useCurrentFrame(), shutter = shutterAngle / 360;
  // Observed: early frames use fewer samples, about one per shutter length elapsed since frame 0.
  const count = Math.max(1, Math.min(samples, Math.round(frame / shutter)));
  if (Number.isNaN(count)) throw new RangeError('Invalid array length');
  return <AbsoluteFill style={{isolation: 'isolate'}}>
    {Array.from({length: count}, (_, i) => <Layer key={i} frame={frame - shutter * ((i + 1) / count) + 1} style={{mixBlendMode: 'plus-lighter', filter: `opacity(${1 / count})`}}>{children}</Layer>)}
  </AbsoluteFill>;
};

/** @deprecated Use `Trail`. */
export const MotionBlur: React.FC<MotionBlurProps> = ({blurOpacity, ...props}) => <Trail {...props} trailOpacity={blurOpacity} />;
