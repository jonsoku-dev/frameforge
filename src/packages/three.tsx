import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, FrameProvider, useCurrentFrame, useVideoConfig} from '../core/index';

const MISSING = '<ThreeCanvas> needs the optional packages "three" and "@react-three/fiber": npm install three @react-three/fiber';
let fiber: Promise<any> | null = null, fiberModule: any = null;
/** Imports `@react-three/fiber` on first use; rejects with install instructions when it is not installed. */
export function loadThreeFiber(): Promise<any> {
  // @ts-ignore optional peer dependency, absent unless the project installs it
  fiber ??= import('@react-three/fiber').then(module => (fiberModule = module), () => { fiber = null; throw new Error(MISSING); });
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

let passes: Promise<any[]> | null = null;
const loadPasses = () => passes ??= Promise.all([
  // @ts-ignore optional peer dependency
  import('three'), import('three/examples/jsm/postprocessing/EffectComposer.js'), import('three/examples/jsm/postprocessing/RenderPass.js'),
  // @ts-ignore optional peer dependency
  import('three/examples/jsm/postprocessing/UnrealBloomPass.js'), import('three/examples/jsm/postprocessing/OutputPass.js'),
]);

export type BloomProps = {/** Glow strength. */ strength?: number; /** Spread, 0..1. */ radius?: number; /** Luminance above which a pixel glows, 0..1. */ threshold?: number};

/** Bloom for a `<ThreeCanvas>` scene: put it inside the canvas. The scene then renders through three's own EffectComposer
 * (render, UnrealBloom, output) on every frame's advance; the props may change per frame. GPU-only, no clock, so a frame is a pure
 * function of the scene. */
export function Bloom({strength = 1, radius = 0.4, threshold = 0.85}: BloomProps): null {
  const {useThree, useFrame} = fiberModule;
  const gl = useThree((state: any) => state.gl), scene = useThree((state: any) => state.scene), camera = useThree((state: any) => state.camera);
  const size = useThree((state: any) => state.size), advance = useThree((state: any) => state.advance);
  const made = useRef<{composer: any; bloom: any} | null>(null);
  const [ready, setReady] = useState(false);
  const hold = useRef<number | null>(null);
  if (!ready && hold.current === null) hold.current = delayRender('<Bloom> passes');
  useEffect(() => {
    let live = true;
    loadPasses().then(([THREE, {EffectComposer}, {RenderPass}, {UnrealBloomPass}, {OutputPass}]) => {
      if (!live) return;
      const composer = new EffectComposer(gl);
      composer.setPixelRatio(gl.getPixelRatio()); composer.setSize(size.width, size.height);
      const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), strength, radius, threshold);
      composer.addPass(new RenderPass(scene, camera)); composer.addPass(bloom); composer.addPass(new OutputPass());
      made.current = {composer, bloom};
      setReady(true);
    }, cancelRender);
    return () => { live = false; made.current?.composer.dispose(); made.current = null; };
  }, [gl, scene, camera, size.width, size.height]);
  // Priority 1 takes over rendering from the default render.
  useFrame(() => {
    if (!made.current) return;
    Object.assign(made.current.bloom, {strength, radius, threshold});
    made.current.composer.render();
  }, 1);
  // The frame drawn before the passes loaded had no bloom: draw it again, then let the capture go.
  useLayoutEffect(() => {
    if (!ready || hold.current === null) return;
    advance(performance.now());
    continueRender(hold.current); hold.current = null;
  }, [ready]);
  useEffect(() => () => { if (hold.current !== null) continueRender(hold.current); }, []);
  return null;
}
