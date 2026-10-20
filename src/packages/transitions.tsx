import React, {Children, createContext, Fragment, isValidElement, useContext} from 'react';
import {AbsoluteFill, interpolate, measureSpring, Sequence, spring, useCurrentFrame, useVideoConfig, type EasingFunction, type SequenceProps} from '../core/index';
import {integer, positive} from '../core/math';

export type TransitionTiming = {
  getDurationInFrames: (options: {fps: number}) => number;
  getProgress: (options: {frame: number; fps: number}) => number;
};
export type PresentationDirection = 'entering' | 'exiting';
export type DrawFunction = (prevImage: OffscreenCanvas | null, nextImage: OffscreenCanvas | null, progress: number) => void;
export type TransitionPresentationComponentProps<P extends Record<string, unknown>> = {
  presentationProgress: number;
  children: React.ReactNode;
  presentationDirection: PresentationDirection;
  passedProps: P;
  presentationDurationInFrames: number;
  /** Canvas presentations are not implemented; these are no-ops so custom components can call them. */
  onElementImage: (elementImage: OffscreenCanvas, draw: DrawFunction) => void;
  onUnmount: () => void;
  bothEnteringAndExiting: boolean;
};
export type TransitionPresentation<P extends Record<string, unknown>> = {
  component: React.ComponentType<TransitionPresentationComponentProps<P>> | ((props: TransitionPresentationComponentProps<P>) => React.ReactNode);
  props: P;
};

export const linearTiming = ({durationInFrames, easing}: {durationInFrames: number; easing?: EasingFunction}): TransitionTiming => ({
  getDurationInFrames: () => durationInFrames,
  getProgress: ({frame}) => interpolate(frame, [0, durationInFrames], [0, 1], {easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
});
export type SpringTimingOptions = {
  config?: {mass?: number; damping?: number; stiffness?: number; overshootClamping?: boolean};
  durationInFrames?: number; durationRestThreshold?: number; reverse?: boolean;
};
export const springTiming = ({config = {}, durationInFrames, durationRestThreshold, reverse = false}: SpringTimingOptions = {}): TransitionTiming => ({
  getDurationInFrames: ({fps}) => durationInFrames ?? measureSpring({fps, config, threshold: durationRestThreshold}),
  // A reversed timing still runs 0 to 1; it follows the mirrored spring curve.
  getProgress: ({frame, fps}) => {
    const value = spring({frame, fps, config, durationInFrames, durationRestThreshold, reverse});
    return reverse ? 1 - value : value;
  },
});

export type TransitionState = {entering: number; exiting: number; isInTransitionSeries: boolean};
const ProgressContext = createContext<TransitionState>({entering: 1, exiting: 0, isInTransitionSeries: false});
/** Progress of the transitions wrapping the calling scene; outside a running transition it is entering 1, exiting 0. */
export const useTransitionProgress = (): TransitionState => useContext(ProgressContext);

type SeriesSequenceProps = Omit<SequenceProps, 'from' | 'durationInFrames'> & {durationInFrames: number; offset?: number};
type TransitionProps = {timing: TransitionTiming; presentation?: TransitionPresentation<any>};
type OverlayProps = {durationInFrames: number; offset?: number; children?: React.ReactNode};
function SeriesSequence(_props: SeriesSequenceProps): never { throw new Error('TransitionSeries.Sequence must be a direct child of TransitionSeries'); }
function Transition(_props: TransitionProps): never { throw new Error('TransitionSeries.Transition must be a direct child of TransitionSeries'); }
function Overlay(_props: OverlayProps): never { throw new Error('TransitionSeries.Overlay must be a direct child of TransitionSeries'); }

type Edge = {timing: TransitionTiming; presentation: TransitionPresentation<any>; duration: number};
type Scene = {from: number; props: SeriesSequenceProps; enter: Edge | null; exit: Edge | null};
// Parent-timeline frames a scene occupies; a faster scene ends sooner.
const span = (props: SeriesSequenceProps) => props.durationInFrames / (props.playbackRate ?? 1);
const flatten = (children: React.ReactNode): React.ReactNode[] => Children.toArray(children).flatMap(child => isValidElement<{children?: React.ReactNode}>(child) && child.type === Fragment ? flatten(child.props.children) : [child]);

/** Lays scenes on the timeline: a transition pulls the next scene back by its duration, so both play during it. */
function layout(children: React.ReactNode, fps: number): {scenes: Scene[]; overlays: {from: number; props: OverlayProps}[]} {
  const scenes: Scene[] = [], overlays: {from: number; props: OverlayProps}[] = [];
  let cursor = 0, pending: Edge | null = null, pendingOverlay: OverlayProps | null = null, previous: 'seq' | 'tr' | 'overlay' | null = null;
  flatten(children).forEach((child, index) => {
    const kind = !isValidElement(child) ? null : child.type === SeriesSequence ? 'seq' : child.type === Transition ? 'tr' : child.type === Overlay ? 'overlay' : null;
    if (!kind) throw new Error('TransitionSeries only accepts TransitionSeries.Sequence, TransitionSeries.Transition and TransitionSeries.Overlay children');
    if (kind !== 'seq' && previous !== null && previous !== 'seq') throw new Error(`TransitionSeries child ${index} must not directly follow another transition or overlay`);
    previous = kind;
    if (kind === 'tr') {
      const {timing, presentation = slide()} = (child as React.ReactElement<TransitionProps>).props;
      const duration = timing.getDurationInFrames({fps});
      const before = scenes.at(-1);
      if (before && before.props.durationInFrames < duration) throw new Error(`TransitionSeries transition ${index} lasts ${duration} frames, longer than the ${before.props.durationInFrames}-frame scene before it`);
      pending = {timing, presentation, duration};
      if (before) before.exit = pending;
      return;
    }
    if (kind === 'overlay') {
      const props = (child as React.ReactElement<OverlayProps>).props;
      integer(props.durationInFrames, 'TransitionSeries.Overlay durationInFrames'); positive(props.durationInFrames, 'TransitionSeries.Overlay durationInFrames');
      integer(props.offset ?? 0, 'TransitionSeries.Overlay offset');
      const from = cursor - Math.floor(props.durationInFrames / 2) + (props.offset ?? 0);
      const before = scenes.at(-1);
      if (from < (before?.from ?? 0)) throw new Error(`TransitionSeries.Overlay ${index} starts at frame ${from}, before the scene it follows`);
      overlays.push({from, props});
      pendingOverlay = props;
      return;
    }
    const props = (child as React.ReactElement<SeriesSequenceProps>).props;
    integer(props.offset ?? 0, 'TransitionSeries.Sequence offset');
    const enter: Edge | null = pending;
    if (enter && enter.duration > props.durationInFrames) throw new Error(`TransitionSeries transition before scene ${index} lasts ${enter.duration} frames, longer than that ${props.durationInFrames}-frame scene`);
    // A leading transition only animates the first scene in; with no scene before it there is nothing to overlap.
    const from = cursor - (scenes.length ? enter?.duration ?? 0 : 0) + (props.offset ?? 0);
    if (pendingOverlay) {
      const overlay = overlays.at(-1)!;
      if (overlay.from + overlay.props.durationInFrames > from + props.durationInFrames) throw new Error(`TransitionSeries.Overlay before scene ${index} ends after that scene`);
    }
    scenes.push({from, props, enter, exit: null});
    cursor = from + span(props);
    pending = null; pendingOverlay = null;
  });
  return {scenes, overlays};
}

const noop = () => {};
function present(edge: Edge, direction: PresentationDirection, progress: number, both: boolean, children: React.ReactNode): React.ReactElement {
  const Component = edge.presentation.component as React.ComponentType<TransitionPresentationComponentProps<Record<string, unknown>>>;
  return <Component presentationProgress={progress} presentationDirection={direction} passedProps={edge.presentation.props} presentationDurationInFrames={edge.duration} onElementImage={noop} onUnmount={noop} bothEnteringAndExiting={both}>{children}</Component>;
}

function SeriesBody({children}: {children?: React.ReactNode}): React.ReactElement {
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  const {scenes, overlays} = layout(children, fps);
  return <>
    {scenes.map(({from, props: {offset: _offset, children: content, ...props}, enter, exit}, index) => {
      const local = frame - from, length = span(props), visible = local >= 0 && local < length;
      const entering = visible && enter && local < enter.duration ? enter.timing.getProgress({frame: local, fps}) : null;
      const exitStart = length - (exit?.duration ?? 0);
      const exiting = visible && exit && local >= exitStart ? exit.timing.getProgress({frame: local - exitStart, fps}) : null;
      let body = content;
      if (entering !== null || exiting !== null) {
        body = <ProgressContext.Provider value={{entering: entering ?? 1, exiting: exiting ?? 0, isInTransitionSeries: true}}>{body}</ProgressContext.Provider>;
        if (entering !== null) body = present(enter!, 'entering', entering, exiting !== null, body);
        if (exiting !== null) body = present(exit!, 'exiting', exiting, entering !== null, body);
      }
      return <Sequence key={index} {...props} from={from}>{body}</Sequence>;
    })}
    {overlays.map(({from, props}, index) => <Sequence key={`overlay-${index}`} from={from} durationInFrames={props.durationInFrames}>{props.children}</Sequence>)}
    {overlays.length > 0 && <div style={{display: 'contents'}} />}
  </>;
}
function TransitionSeriesRoot({children, ...props}: SequenceProps): React.ReactElement {
  return <Sequence {...props}><SeriesBody>{children}</SeriesBody></Sequence>;
}
/** Like `Series`, plus `Transition` (both scenes overlap, shortening the total by its duration) and `Overlay` (on top of the cut, no timing change) between scenes. */
export const TransitionSeries = Object.assign(TransitionSeriesRoot, {Sequence: SeriesSequence, Transition, Overlay});

type Side<S> = {enter?: S; exit?: S};
const pick = <S,>(direction: PresentationDirection, {enter, exit}: Side<S>): S | undefined => direction === 'entering' ? enter : exit;
const percent = (points: number[][]) => `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;

export type FadeProps = {enterStyle?: React.CSSProperties; exitStyle?: React.CSSProperties; shouldFadeOutExitingScene?: boolean};
function Fade({children, presentationDirection, presentationProgress: p, passedProps: {enterStyle, exitStyle, shouldFadeOutExitingScene = false}}: TransitionPresentationComponentProps<FadeProps>) {
  const opacity = presentationDirection === 'entering' ? p : shouldFadeOutExitingScene ? 1 - p : 1;
  return <AbsoluteFill style={{opacity, ...pick(presentationDirection, {enter: enterStyle, exit: exitStyle})}}>{children}</AbsoluteFill>;
}
export const fade = (props: FadeProps = {}): TransitionPresentation<FadeProps> => ({component: Fade, props});

export type SlideDirection = 'from-left' | 'from-top' | 'from-right' | 'from-bottom';
export type SlideProps = {direction?: SlideDirection; enterStyle?: React.CSSProperties; exitStyle?: React.CSSProperties};
const SLIDE: Record<SlideDirection, ['X' | 'Y', 1 | -1]> = {'from-left': ['X', 1], 'from-top': ['Y', 1], 'from-right': ['X', -1], 'from-bottom': ['Y', -1]};
function Slide({children, presentationDirection, presentationProgress: p, passedProps: {direction = 'from-left', enterStyle, exitStyle}}: TransitionPresentationComponentProps<SlideProps>) {
  const [axis, sign] = SLIDE[direction];
  // Observed: the trailing scene overlaps by 0.01% (none at exactly 1), so no hairline gap opens between the two.
  const seam = p === 1 ? 0 : 0.01;
  const shift = presentationDirection === 'entering' ? sign * 100 * (p - 1) + (sign < 0 ? seam : 0) : sign * 100 * p - (sign > 0 ? seam : 0);
  return <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', transform: `translate${axis}(${shift}%)`, ...pick(presentationDirection, {enter: enterStyle, exit: exitStyle})}}>{children}</AbsoluteFill>;
}
export const slide = (props: SlideProps = {}): TransitionPresentation<SlideProps> => ({component: Slide, props});

type LayeredStyles = {outerEnterStyle?: React.CSSProperties; outerExitStyle?: React.CSSProperties; innerEnterStyle?: React.CSSProperties; innerExitStyle?: React.CSSProperties};
function Layers({direction, styles, outer, inner, children}: {direction: PresentationDirection; styles: LayeredStyles; outer?: React.CSSProperties; inner?: React.CSSProperties; children: React.ReactNode}) {
  return <AbsoluteFill style={{...outer, ...pick(direction, {enter: styles.outerEnterStyle, exit: styles.outerExitStyle})}}>
    <AbsoluteFill style={{...inner, ...pick(direction, {enter: styles.innerEnterStyle, exit: styles.innerExitStyle})}}>{children}</AbsoluteFill>
  </AbsoluteFill>;
}

export type WipeDirection = 'from-left' | 'from-top-left' | 'from-top' | 'from-top-right' | 'from-right' | 'from-bottom-right' | 'from-bottom' | 'from-bottom-left';
export type WipeProps = LayeredStyles & {direction?: WipeDirection};
// Clip polygons in percent for q = 100 * progress: [exiting scene, entering scene].
const WIPE: Record<WipeDirection, (q: number) => [number[][], number[][]]> = {
  'from-left': q => [[[100, 100], [q, 100], [q, 0], [100, 0]], [[0, 0], [q, 0], [q, 100], [0, 100]]],
  'from-top-left': q => [[[100, 100], [2 * q - 100, 100], [100, 2 * q - 100]], [[0, 0], [2 * q, 0], [0, 2 * q]]],
  'from-top': q => [[[100, 100], [0, 100], [0, q], [100, q]], [[0, 0], [100, 0], [100, q], [0, q]]],
  'from-top-right': q => [[[0, 100], [200 - 2 * q, 100], [0, 2 * q - 100]], [[100, 0], [100 - 2 * q, 0], [100, 2 * q]]],
  'from-right': q => [[[0, 0], [100 - q, 0], [100 - q, 100], [0, 100]], [[100, 0], [100, 100], [100 - q, 100], [100 - q, 0]]],
  'from-bottom-right': q => [[[0, 0], [200 - 2 * q, 0], [0, 200 - 2 * q]], [[100, 100], [100 - 2 * q, 100], [100, 100 - 2 * q]]],
  'from-bottom': q => [[[100, 0], [0, 0], [0, 100 - q], [100, 100 - q]], [[0, 100], [100, 100], [100, 100 - q], [0, 100 - q]]],
  'from-bottom-left': q => [[[100, 0], [2 * q - 100, 0], [100, 200 - 2 * q]], [[0, 100], [0, 100 - 2 * q], [2 * q, 100]]],
};
function Wipe({children, presentationDirection, presentationProgress: p, passedProps}: TransitionPresentationComponentProps<WipeProps>) {
  const [exit, enter] = WIPE[passedProps.direction ?? 'from-left'](100 * p);
  return <Layers direction={presentationDirection} styles={passedProps} inner={{justifyContent: 'center', alignItems: 'center', clipPath: percent(presentationDirection === 'entering' ? enter : exit)}}>{children}</Layers>;
}
export const wipe = (props: WipeProps = {}): TransitionPresentation<WipeProps> => ({component: Wipe, props});

export type FlipDirection = 'from-left' | 'from-right' | 'from-top' | 'from-bottom';
export type FlipProps = LayeredStyles & {direction?: FlipDirection; perspective?: number};
const FLIP: Record<FlipDirection, ['X' | 'Y', 1 | -1]> = {'from-left': ['Y', 1], 'from-right': ['Y', -1], 'from-top': ['X', -1], 'from-bottom': ['X', 1]};
function Flip({children, presentationDirection, presentationProgress: p, passedProps}: TransitionPresentationComponentProps<FlipProps>) {
  const [axis, sign] = FLIP[passedProps.direction ?? 'from-left'];
  const degrees = sign * 180 * (presentationDirection === 'entering' ? p - 1 : p);
  return <Layers direction={presentationDirection} styles={passedProps} outer={{perspective: passedProps.perspective ?? 1000, transformStyle: 'preserve-3d'}}
    inner={{transform: `rotate${axis}(${degrees}deg)`, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden'}}>{children}</Layers>;
}
export const flip = (props: FlipProps = {}): TransitionPresentation<FlipProps> => ({component: Flip, props});

export type ClockWipeProps = LayeredStyles & {width: number; height: number};
// shortcut: arc end points are rounded to 5 decimals in pie-local space, as the reference output shows (4.0.537); drop the rounding if it changes
const round5 = (value: number) => Math.round(value * 1e5) / 1e5;
/** A clockwise pie from 12 o'clock covering `progress` of a circle that encloses the frame; progress is clamped to [0, 1]. */
function clockPath(width: number, height: number, progress: number): string {
  const r = Math.sqrt(width ** 2 + height ** 2) / 2, dx = width / 2 - r, dy = height / 2 - r;
  const at = (turn: number) => `${round5(r + r * Math.sin(turn * 2 * Math.PI)) + dx} ${round5(r - r * Math.cos(turn * 2 * Math.PI)) + dy}`;
  const p = Math.min(1, Math.max(0, progress)), arc = `A ${r} ${r} 0 0 1`;
  const half = p > 0.5 ? ` ${arc} ${at(0.5)}` : '';
  const close = p === 0 || p === 1 ? '' : ` L ${r + dx} ${r + dy}`;
  return `M ${at(0)}${half} ${arc} ${at(p)}${close} Z`;
}
function ClockWipe({children, presentationDirection, presentationProgress, passedProps}: TransitionPresentationComponentProps<ClockWipeProps>) {
  const clip = presentationDirection === 'entering' ? {clipPath: `path("${clockPath(passedProps.width, passedProps.height, presentationProgress)}")`} : undefined;
  return <Layers direction={presentationDirection} styles={passedProps} inner={clip}>{children}</Layers>;
}
export const clockWipe = (props: ClockWipeProps): TransitionPresentation<ClockWipeProps> => ({component: ClockWipe, props});

export type IrisProps = LayeredStyles & {width: number; height: number};
function Iris({children, presentationDirection, presentationProgress, passedProps: {width, height, ...styles}}: TransitionPresentationComponentProps<IrisProps>) {
  const radius = Math.sqrt(width ** 2 + height ** 2) / 2 * presentationProgress;
  const path = `M ${width / 2} ${height / 2 - radius} a ${radius} ${radius} 0 1 1 0 ${2 * radius} a ${radius} ${radius} 0 1 1 0 ${-2 * radius} Z`;
  return <Layers direction={presentationDirection} styles={styles} inner={presentationDirection === 'entering' ? {clipPath: `path("${path}")`} : undefined}>{children}</Layers>;
}
export const iris = (props: IrisProps): TransitionPresentation<IrisProps> => ({component: Iris, props});

export type NoneProps = {enterStyle?: React.CSSProperties; exitStyle?: React.CSSProperties};
function None({children, presentationDirection, passedProps}: TransitionPresentationComponentProps<NoneProps>) {
  return <AbsoluteFill style={pick(presentationDirection, {enter: passedProps.enterStyle, exit: passedProps.exitStyle})}>{children}</AbsoluteFill>;
}
export const none = (props: NoneProps = {}): TransitionPresentation<NoneProps> => ({component: None, props});
