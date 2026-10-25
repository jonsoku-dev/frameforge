import React from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {FrameProvider, RegistryContext, getRegisteredRoot, resolveCompositionMetadata, setInputProps, whenGoogleFontsSettled, whenRenderReady, getFrameforgeEnvironment, type CompositionDefinition, type ResolvedComposition} from '../core/index';
import {clippedTextMessage, findClippedText} from './textGuard';

export type Props = Record<string, unknown>;
export type Info = {id: string; width: number; height: number; fps: number; durationInFrames: number};

export const target = document.getElementById('root')!;
export const root = createRoot(target);
export const renderMode = getFrameforgeEnvironment().isRendering;
export const definitions = new Map<string, ResolvedComposition>();
export let activeInput: Props = {};
let discoveryController = new AbortController();

export async function discover(input: Props): Promise<Info[]> {
  discoveryController.abort();
  const controller = new AbortController();
  discoveryController = controller;
  const next = new Map<string, CompositionDefinition>();
  const register = (definition: CompositionDefinition) => {
    if (next.has(definition.id)) throw new Error(`Duplicate composition id: ${definition.id}`);
    for (const key of ['width', 'height', 'fps', 'durationInFrames'] as const) if (!Number.isFinite(definition[key]) || definition[key] <= 0) throw new Error(`Invalid ${key} in ${definition.id}`);
    if (![definition.width, definition.height, definition.durationInFrames].every(Number.isInteger)) throw new Error('Dimensions and duration must be integers.');
    next.set(definition.id, definition);
  };
  const Registered = getRegisteredRoot();
  if (!Registered) throw new Error('No root registered. Call registerRoot(Root) in your entry file.');
  setInputProps(input);
  try {
    renderToStaticMarkup(<RegistryContext.Provider value={register}><Registered /></RegistryContext.Provider>);
    if (!next.size) throw new Error('No compositions found in registered root.');
    const resolved: ResolvedComposition[] = [];
    for (const definition of next.values()) resolved.push(await resolveCompositionMetadata({definition, input, abortSignal: controller.signal, isRendering: renderMode}));
    if (discoveryController !== controller) throw new DOMException('calculateMetadata superseded', 'AbortError');
    definitions.clear();
    for (const item of resolved) definitions.set(item.id, item);
    activeInput = {...input};
    return [...definitions.values()].map(info);
  } catch (error) {
    if (discoveryController !== controller) throw new DOMException('calculateMetadata superseded', 'AbortError');
    setInputProps(activeInput);
    throw error;
  }
}

export const info = (composition: ResolvedComposition): Info => ({id: composition.id, width: composition.width, height: composition.height, fps: composition.fps, durationInFrames: composition.durationInFrames});

export class Boundary extends React.Component<{children: React.ReactNode; resetKey: string; fallback?: (error: string) => React.ReactNode}, {error: string | null; resetKey: string}> {
  state = {error: null as string | null, resetKey: this.props.resetKey};
  static getDerivedStateFromProps(props: {resetKey: string}, state: {resetKey: string}) {
    return props.resetKey !== state.resetKey ? {error: null, resetKey: props.resetKey} : null;
  }
  static getDerivedStateFromError(error: Error) {
    window.__FRAMEFORGE_ERROR__ = error.message;
    return {error: error.message};
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="error" role="alert" data-frame-error>{this.props.fallback ? this.props.fallback(this.state.error) : this.state.error}</div>;
  }
}

export function Scene({composition, frame}: {composition: ResolvedComposition; frame: number}) {
  return <FrameProvider frame={frame} config={composition}><composition.component {...composition.props} /></FrameProvider>;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out loading frame assets.')), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

export async function settle() {
  await withTimeout(whenGoogleFontsSettled(), 30000);
  await withTimeout(whenRenderReady(), 30000);
  await withTimeout(Promise.all([...document.images].map(async img => {
    if (!img.complete) await new Promise<void>((resolve, reject) => {
      img.addEventListener('load', () => resolve(), {once: true});
      img.addEventListener('error', () => reject(new Error(`Image failed: ${img.currentSrc}`)), {once: true});
    });
    if (!img.naturalWidth) throw new Error(`Image failed: ${img.currentSrc}`);
    await img.decode();
  })), 30000);
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  // A component error comes first: its fallback text may itself sit in a clipping box.
  const displayedError = document.querySelector('[data-frame-error]');
  if (displayedError) throw new Error(displayedError.textContent || 'Frame rendering failed.');
  if (window.__FRAMEFORGE_ERROR__) throw new Error(window.__FRAMEFORGE_ERROR__);
  const clipped = findClippedText(target);
  if (clipped.length) throw new Error(clippedTextMessage(clipped));
}
