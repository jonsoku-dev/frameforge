import React, {createElement, useEffect, useMemo, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from '../core/index';

const MISSING = '<Model> needs the optional package "three": npm install three @react-three/fiber';
type Triple = [number, number, number];
// react-three-fiber's intrinsic tags (<group>, <primitive>, lights) without importing its JSX types, which are optional here.
const three = (type: string, props: Record<string, unknown>, ...children: React.ReactNode[]) => createElement(type, props, ...children);

const models = new Map<string, Promise<any>>();
/** Loads a glTF once per `src` with three's GLTFLoader (`.gltf` with sidecar files or `.glb`); rejects with install instructions when three is absent. */
export function loadModel(src: string): Promise<any> {
  let promise = models.get(src);
  if (!promise) {
    // @ts-ignore optional peer dependency, absent unless the project installs it
    promise = import('three/examples/jsm/loaders/GLTFLoader.js').catch(() => { throw new Error(MISSING); }).then(({GLTFLoader}) => new GLTFLoader().loadAsync(src));
    promise.catch(() => models.delete(src));
    models.set(src, promise);
  }
  return promise;
}

export type ModelProps = {
  /** A glTF under public/, e.g. `/assets/generated/<slug>/models/vase/vase.gltf` (what `npm run models` writes). */
  src: string;
  scale?: number | Triple;
  position?: Triple;
  /** Euler angles in radians. */
  rotation?: Triple;
};

/** A glTF model inside <ThreeCanvas>: holds the frame with delayRender until the file has loaded, then mounts a clone of its scene. */
export function Model({src, scale = 1, position = [0, 0, 0], rotation = [0, 0, 0]}: ModelProps): React.ReactElement | null {
  const [gltf, setGltf] = useState<any>(null);
  const handle = useRef<number | null>(null);
  useEffect(() => {
    const id = delayRender(`<Model> ${src}`);
    handle.current = id;
    let live = true;
    loadModel(src).then(result => { if (live) setGltf(result); }, error => {
      continueRender(id); handle.current = null;
      if (live) cancelRender(error instanceof Error ? error : new Error(String(error)));
    });
    return () => { live = false; continueRender(id); };
  }, [src]);
  // Release only after the commit that mounts the model, so the capture never sees the canvas without it.
  useEffect(() => { if (gltf && handle.current !== null) { continueRender(handle.current); handle.current = null; } });
  // The cached scene can have one parent only; every <Model> mounts its own clone (geometry and materials are shared).
  const object = useMemo(() => gltf ? gltf.scene.clone(true) : null, [gltf]);
  if (!object) return null;
  return three('primitive', {object, scale, position, rotation});
}

/** Turns its children about the vertical axis at `speed` turns per second, driven by the composition frame. */
export function Turntable({speed = 0.25, phase = 0, children}: {speed?: number; phase?: number; children?: React.ReactNode}): React.ReactElement {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return three('group', {rotation: [0, phase + frame / fps * speed * Math.PI * 2, 0]}, children);
}

/** Key, fill and rim lights at fixed positions plus a little ambient; `intensity` scales all four. */
export function StudioLights({intensity = 1, color = '#ffffff'}: {intensity?: number; color?: string}): React.ReactElement {
  return <>
    {three('ambientLight', {intensity: 0.35 * intensity, color})}
    {three('directionalLight', {position: [-3.5, 4.5, 5], intensity: 2.6 * intensity, color})}
    {three('directionalLight', {position: [4.5, 2, 3], intensity: 0.8 * intensity, color})}
    {three('directionalLight', {position: [1, 4, -5], intensity: 1.6 * intensity, color})}
  </>;
}
