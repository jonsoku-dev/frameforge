import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, FrameProvider, useCurrentFrame, useVideoConfig} from '../core/index';

const MISSING = '<ThreeCanvas> needs the optional packages "three" and "@react-three/fiber": npm install three @react-three/fiber';
let fiber: Promise<any> | null = null;
/** Imports `@react-three/fiber` on first use; rejects with install instructions when it is not installed. */
export function loadThreeFiber(): Promise<any> {
  // @ts-ignore optional peer dependency, absent unless the project installs it
  fiber ??= import('@react-three/fiber').catch(() => { fiber = null; throw new Error(MISSING); });
  return fiber;
}

/** Props of react-three-fiber's `<Canvas>` (`camera`, `gl`, `orthographic`, ...) plus the composition-sized `width` and `height`. */
export type ThreeCanvasProps = {width: number; height: number; children?: React.ReactNode; style?: React.CSSProperties; [canvasProp: string]: unknown};

type Sync = {advanced: number | null; pending: number | null};
// Lives inside the fiber root: renders the scene synchronously once the new frame's children have committed.
function Advance({frame, useThree, sync}: {frame: number; useThree: (select: (state: any) => any) => any; sync: Sync}): null {
  const advance = useThree(state => state.advance);
  useLayoutEffect(() => {
    advance(performance.now());
    sync.advanced = frame;
    if (sync.pending !== null) { continueRender(sync.pending); sync.pending = null; }
  }, [frame, advance]);
  return null;
}

/**
 * react-three-fiber's `<Canvas>` driven by the composition frame: `frameloop="demand"`, one synchronous `advance()` per frame,
 * and rendering held until it has drawn. Use `useCurrentFrame()` inside instead of `useFrame`. Children see the frame and config
 * through a fresh FrameProvider, so a `<Sequence>` inside starts its own timeline at the canvas's current frame.
 */
export function ThreeCanvas({width, height, children, style, ...canvasProps}: ThreeCanvasProps): React.ReactElement | null {
  const frame = useCurrentFrame(), config = useVideoConfig();
  const [module, setModule] = useState<any>(null);
  const sync = useRef<Sync>({advanced: null, pending: null}).current;
  useEffect(() => { loadThreeFiber().then(setModule, cancelRender); }, []);
  useLayoutEffect(() => {
    if (sync.advanced === frame || sync.pending !== null) return;
    sync.pending = delayRender(`<ThreeCanvas> frame ${frame}`);
  }, [frame]);
  useEffect(() => () => { if (sync.pending !== null) continueRender(sync.pending); }, []);
  if (!module) return null;
  const {Canvas, useThree} = module;
  return <Canvas {...canvasProps} frameloop="demand" style={{width, height, ...style}}>
    <FrameProvider frame={frame} config={config}>{children}<Advance frame={frame} useThree={useThree} sync={sync} /></FrameProvider>
  </Canvas>;
}
