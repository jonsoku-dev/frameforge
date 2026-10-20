import React from 'react';
import {getBoundingBox, resetPath, serializeInstructions, type Instruction} from './paths';
export type {Instruction} from './paths';
type ShapeInfo = {path: string; width: number; height: number; transformOrigin: string; instructions: Instruction[]};
type Pt = [number, number];
type Rounding = {edgeRoundness: number | null; cornerRadius: number; roundCornerStrategy: 'arc' | 'bezier'};
const assertSingleRounding = (edgeRoundness: number | null | undefined, cornerRadius: number) => {
  if (edgeRoundness != null && cornerRadius !== 0) throw new Error('"cornerRadius" and "edgeRoundness" cannot be specified at the same time.');
};
const dist = (a: Pt, b: Pt) => Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
// The point `r` before the end of the edge `start` to `end`; the arc strategy divides first, as the reference's rounding shows.
const beforeEnd = (start: Pt, end: Pt, r: number, arc = false): Pt => { const d = dist(start, end), f = arc ? (d - r) / d : 1 - r / d; return [start[0] + (end[0] - start[0]) * f, start[1] + (end[1] - start[1]) * f]; };
const unit = (from: Pt, to: Pt): Pt => { const d = dist(from, to); return [(to[0] - from[0]) / d, (to[1] - from[1]) / d]; };
// Vector from the point `r` before a corner to the point `r` after it.
const cornerDelta = (prev: Pt, corner: Pt, next: Pt, r: number): Pt => { const uin = unit(prev, corner), uout = unit(corner, next); return [r * uin[0] + r * uout[0], r * uin[1] + r * uout[1]]; };
// `points` ends with a copy of its first point. Corners are rounded by cutting `cornerRadius` off each adjacent edge,
// or edges are bent by `edgeRoundness`, which moves the curve from edge midpoint to edge midpoint through the corner.
function joinPoints(points: Pt[], {edgeRoundness, cornerRadius, roundCornerStrategy}: Rounding): Instruction[] {
  assertSingleRounding(edgeRoundness, cornerRadius);
  const next = (i: number) => points[i + 1] ?? points[1]!;
  if (edgeRoundness != null) {
    const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let start = mid(points[0]!, points[1]!);
    const out: Instruction[] = [{type: 'M', x: start[0], y: start[1]}];
    for (let i = 1; i < points.length; i++) {
      const corner = points[i]!, end = mid(corner, next(i));
      out.push({type: 'C', cp1x: start[0] + (corner[0] - start[0]) * edgeRoundness, cp1y: start[1] + (corner[1] - start[1]) * edgeRoundness, cp2x: end[0] + (corner[0] - end[0]) * edgeRoundness, cp2y: end[1] + (corner[1] - end[1]) * edgeRoundness, x: end[0], y: end[1]});
      start = end;
    }
    return out;
  }
  if (cornerRadius === 0) return points.map(([x, y], i) => (i === 0 ? {type: 'M', x, y} : {type: 'L', x, y}));
  const out: Instruction[] = [];
  for (let i = 1; i < points.length; i++) {
    const corner = points[i]!, prev = points[i - 1]!, nxt = next(i), before = beforeEnd(prev, corner, cornerRadius, roundCornerStrategy === 'arc');
    if (i === 1) out.push({type: 'M', x: before[0], y: before[1]});
    out.push({type: 'L', x: before[0], y: before[1]});
    if (roundCornerStrategy === 'bezier') {
      const fin = cornerRadius / dist(prev, corner), fout = cornerRadius / dist(corner, nxt);
      out.push({type: 'C', cp1x: corner[0], cp1y: corner[1], cp2x: corner[0], cp2y: corner[1], x: before[0] + (corner[0] - prev[0]) * fin + (nxt[0] - corner[0]) * fout, y: before[1] + (corner[1] - prev[1]) * fin + (nxt[1] - corner[1]) * fout});
    } else { const [dx, dy] = cornerDelta(prev, corner, nxt, cornerRadius); out.push({type: 'a', rx: cornerRadius, ry: cornerRadius, xAxisRotation: 0, largeArcFlag: false, sweepFlag: true, dx, dy}); }
  }
  return out;
}
const Z: Instruction = {type: 'Z'};
const info = (instructions: Instruction[], width: number, height: number, transformOrigin: string): ShapeInfo => ({path: serializeInstructions(instructions), width, height, transformOrigin, instructions});
// Shapes drawn around a center keep centered instructions but return a path moved to the origin, like the reference.
function centered(instructions: Instruction[], transformOrigin: string): ShapeInfo {
  const path = resetPath(serializeInstructions(instructions)), box = getBoundingBox(path);
  return {path, width: box.width, height: box.height, transformOrigin, instructions};
}

export type MakeRectOptions = {width: number; height: number; edgeRoundness?: number | null; cornerRadius?: number};
export function makeRect({width, height, edgeRoundness = null, cornerRadius = 0}: MakeRectOptions): ShapeInfo {
  const points: Pt[] = [[0, 0], [width, 0], [width, height], [0, height], [0, 0]];
  return info([...joinPoints(points, {edgeRoundness, cornerRadius, roundCornerStrategy: 'arc'}), Z], width, height, `${width / 2} ${height / 2}`);
}
export type MakeCircleProps = {radius: number};
export function makeCircle({radius}: MakeCircleProps): ShapeInfo {
  const arc = (dy: number): Instruction => ({type: 'a', rx: radius, ry: radius, xAxisRotation: 0, largeArcFlag: true, sweepFlag: true, dx: 0, dy});
  return info([{type: 'M', x: radius, y: 0}, arc(radius * 2), arc(-radius * 2), Z], radius * 2, radius * 2, `${radius} ${radius}`);
}
export type MakeEllipseOptions = {rx: number; ry: number};
export function makeEllipse({rx, ry}: MakeEllipseOptions): ShapeInfo {
  return info([{type: 'M', x: rx, y: 0}, {type: 'a', rx, ry, xAxisRotation: 0, largeArcFlag: true, sweepFlag: false, dx: 1, dy: 0}, Z], rx * 2, ry * 2, `${rx} ${ry}`);
}
export type MakePieProps = {radius: number; progress: number; closePath?: boolean; counterClockwise?: boolean; rotation?: number};
export function makePie({radius, progress, closePath = true, counterClockwise = false, rotation = 0}: MakePieProps): ShapeInfo {
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  const clamped = Math.min(1, Math.max(0, progress)), sign = counterClockwise ? -1 : 1;
  const at = (angle: number): Pt => [round(radius + radius * Math.sin(angle)), round(radius - radius * Math.cos(angle))];
  const arc = (p: Pt): Instruction => ({type: 'A', rx: radius, ry: radius, xAxisRotation: 0, largeArcFlag: false, sweepFlag: !counterClockwise, x: p[0], y: p[1]});
  const [sx, sy] = at(rotation), end = at(rotation + sign * clamped * Math.PI * 2);
  const instructions: Instruction[] = [{type: 'M', x: sx, y: sy}];
  if (clamped > 0.5) instructions.push(arc(at(rotation + sign * Math.PI)));
  instructions.push(arc(end));
  if (closePath && clamped > 0 && clamped < 1) instructions.push({type: 'L', x: radius, y: radius});
  if (closePath) instructions.push(Z);
  return info(instructions, radius * 2, radius * 2, `${radius} ${radius}`);
}
export type MakeHeartProps = {height: number; aspectRatio?: number; bottomRoundnessAdjustment?: number; depthAdjustment?: number};
// The heart is a 110x100 template; x values scale with the width, y values with the height.
export function makeHeart({height, aspectRatio = 1.1, bottomRoundnessAdjustment = 0, depthAdjustment = 0}: MakeHeartProps): ShapeInfo {
  const width = height * aspectRatio, cx = width / 2, w = (t: number) => cx + width * ((t - 55) / 110), h = (t: number) => height * (t / 100);
  const lobe = cx - (width * (23 / 110) + bottomRoundnessAdjustment * width), dip = height * 0.17 + height * depthAdjustment, quarter = width / 4, cheek = quarter - width * (14.5 / 110);
  const c = (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): Instruction => ({type: 'C', cp1x, cp1y, cp2x, cp2y, x, y});
  const instructions: Instruction[] = [{type: 'M', x: cx, y: height},
    c(lobe, h(69), 0, h(60), 0, h(25)), c(0, h(13), cheek, 0, quarter, 0), c(cx - cheek, 0, w(50), h(7), cx, dip),
    c(w(60), h(7), w(70), 0, width - quarter, 0), c(width - quarter + width * (14.5 / 110), 0, width, h(13), width, h(25)), c(width, h(60), width - lobe, h(69), cx, height), Z];
  return info(instructions, width, height, `${width / 2} ${height / 2}`);
}
export type MakePolygonProps = {points: number; radius: number; edgeRoundness?: number | null; cornerRadius?: number};
const ring = (count: number, cx: number, cy: number, radiusAt: (i: number) => number): Pt[] =>
  Array.from({length: count}, (_, i) => { const angle = i * (2 * Math.PI / count) - Math.PI / 2, r = radiusAt(i); return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]; });
export function makePolygon({points, radius, edgeRoundness = null, cornerRadius = 0}: MakePolygonProps): ShapeInfo {
  if (points < 3) throw new Error(`"points" should be minimum 3, got ${points}`);
  const vertices = ring(points, radius, radius, () => radius);
  return centered(joinPoints([...vertices, vertices[0]!], {edgeRoundness, cornerRadius, roundCornerStrategy: 'bezier'}), `${radius} ${radius}`);
}
export type MakeStarProps = {points: number; innerRadius: number; outerRadius: number; edgeRoundness?: number | null; cornerRadius?: number};
export function makeStar({points, innerRadius, outerRadius, edgeRoundness = null, cornerRadius = 0}: MakeStarProps): ShapeInfo {
  const vertices = ring(points * 2, outerRadius, outerRadius, i => (i % 2 === 0 ? outerRadius : innerRadius));
  return centered([...joinPoints([...vertices, vertices[0]!], {edgeRoundness, cornerRadius, roundCornerStrategy: 'bezier'}), Z], `${outerRadius} ${outerRadius}`);
}
type Direction = 'right' | 'left' | 'up' | 'down';
export type MakeTriangleProps = {length: number; direction: Direction; edgeRoundness?: number | null; cornerRadius?: number};
export function makeTriangle({length, direction, edgeRoundness = null, cornerRadius = 0}: MakeTriangleProps): ShapeInfo {
  const half = length / 2, h = Math.sqrt(length * length - half * half);
  const corners: Record<Direction, Pt[]> = {up: [[half, 0], [0, h], [length, h]], down: [[0, 0], [length, 0], [half, h]], right: [[0, 0], [0, length], [h, half]], left: [[h, 0], [h, length], [0, half]]};
  const points = corners[direction];
  if (!points) throw new Error(`Invalid triangle direction: ${String(direction)}`);
  const instructions = [...joinPoints([...points, points[0]!], {edgeRoundness, cornerRadius, roundCornerStrategy: 'bezier'}), Z];
  const [width, height] = direction === 'up' || direction === 'down' ? [length, h] : [h, length];
  const origin = `${(points[0]![0] + points[1]![0] + points[2]![0]) / 3} ${(points[0]![1] + points[1]![1] + points[2]![1]) / 3}`;
  return info(instructions, width, height, origin);
}
export type MakeSparkProps = {width: number; height: number; edgeRoundness?: number; cornerRadius?: number};
const KAPPA = (4 * (Math.sqrt(2) - 1)) / 3;
// Four concave quarter curves between the tips; a cornerRadius replaces each tip by a semicircular cap.
export function makeSpark({width, height, edgeRoundness = 1, cornerRadius = 0}: MakeSparkProps): ShapeInfo {
  const cx = width / 2, cy = height / 2, r = cornerRadius, cap = r * (4 / 3), pull = (d: number) => d * KAPPA * edgeRoundness;
  const c = (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): Instruction => ({type: 'C', cp1x, cp1y, cp2x, cp2y, x, y});
  // Quarter from a vertical tip point (tx, ty) to a horizontal tip point (hx, hy), or back; control points pull toward the center along each tip's axis.
  const quarter = (ax: number, ay: number, bx: number, by: number, verticalFirst: boolean) => (verticalFirst
    ? c(ax, ay + pull(by - ay), bx - pull(bx - ax), by, bx, by)
    : c(ax - pull(ax - bx), ay, bx, by - pull(by - ay), bx, by));
  const tr: Pt = [cx + r, r], rt: Pt = [width - r, cy - r], rb: Pt = [width - r, cy + r], br: Pt = [cx + r, height - r], bl: Pt = [cx - r, height - r], lb: Pt = [r, cy + r], lt: Pt = [r, cy - r], tl: Pt = [cx - r, r];
  const instructions: Instruction[] = [{type: 'M', x: tr[0], y: tr[1]}, quarter(tr[0], tr[1], rt[0], rt[1], true)];
  if (r !== 0) instructions.push(c(rt[0] + cap, rt[1], rb[0] + cap, rb[1], rb[0], rb[1]));
  instructions.push(quarter(rb[0], rb[1], br[0], br[1], false));
  if (r !== 0) instructions.push(c(br[0], br[1] + cap, bl[0], bl[1] + cap, bl[0], bl[1]));
  instructions.push(quarter(bl[0], bl[1], lb[0], lb[1], true));
  if (r !== 0) instructions.push(c(lb[0] - cap, lb[1], lt[0] - cap, lt[1], lt[0], lt[1]));
  instructions.push(quarter(lt[0], lt[1], tl[0], tl[1], false));
  if (r !== 0) instructions.push(c(tl[0], tl[1] - cap, tr[0], tr[1] - cap, tr[0], tr[1]));
  instructions.push(Z);
  return info(instructions, width, height, `${cx} ${cy}`);
}
export type MakeArrowProps = {length?: number; headWidth?: number; headLength?: number; shaftWidth?: number; direction?: Direction; cornerRadius?: number};
// Convex corners get a bezier round; the two reflex corners where head meets shaft stay sharp.
function roundConvex(points: Pt[], r: number): Instruction[] {
  const n = points.length, at = (i: number) => points[((i % n) + n) % n]!;
  const turn = (i: number) => { const a = at(i - 1), b = at(i), c = at(i + 1); return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); };
  const orientation = Math.sign(points.reduce((s, p, i) => s + p[0] * at(i + 1)[1] - at(i + 1)[0] * p[1], 0));
  const convex = (i: number) => Math.sign(turn(i)) === orientation;
  const out: Instruction[] = [];
  for (let i = 0; i <= n; i++) {
    const corner = at(i);
    if (!convex(i)) { out.push({type: 'L', x: corner[0], y: corner[1]}); continue; }
    const uin = unit(at(i - 1), corner), uout = unit(corner, at(i + 1)), before: Pt = [corner[0] - r * uin[0], corner[1] - r * uin[1]], after: Pt = [corner[0] + r * uout[0], corner[1] + r * uout[1]];
    if (i === 0) { out.push({type: 'M', x: after[0], y: after[1]}); continue; }
    out.push({type: 'L', x: before[0], y: before[1]}, {type: 'C', cp1x: corner[0], cp1y: corner[1], cp2x: corner[0], cp2y: corner[1], x: after[0], y: after[1]});
  }
  return out;
}
export function makeArrow({length = 300, headWidth = 185, headLength = 120, shaftWidth = 80, direction = 'right', cornerRadius = 0}: MakeArrowProps): ShapeInfo {
  if (headLength > length) throw new Error(`"headLength" must be less than or equal to "length", got headLength=${headLength} and length=${length}`);
  if (headWidth < shaftWidth) throw new Error(`"headWidth" must be greater than or equal to "shaftWidth", got headWidth=${headWidth} and shaftWidth=${shaftWidth}`);
  const s0 = (headWidth - shaftWidth) / 2, s1 = s0 + shaftWidth, neck = length - headLength, mid = headWidth / 2;
  const head = length - neck;
  const points: Record<Direction, Pt[]> = {
    right: [[0, s0], [neck, s0], [neck, 0], [length, mid], [neck, headWidth], [neck, s1], [0, s1]],
    left: [[length, s0], [head, s0], [head, 0], [0, mid], [head, headWidth], [head, s1], [length, s1]],
    up: [[s0, length], [s1, length], [s1, headLength], [headWidth, headLength], [mid, 0], [0, headLength], [s0, headLength]],
    down: [[s0, 0], [s1, 0], [s1, neck], [headWidth, neck], [mid, length], [0, neck], [s0, neck]],
  };
  const list = points[direction];
  if (!list) throw new Error(`Invalid arrow direction: ${String(direction)}`);
  const instructions = cornerRadius === 0 ? list.map(([x, y], i): Instruction => (i === 0 ? {type: 'M', x, y} : {type: 'L', x, y})) : roundConvex(list, cornerRadius);
  const [width, height] = direction === 'right' || direction === 'left' ? [length, headWidth] : [headWidth, length];
  return info([...instructions, Z], width, height, `${width / 2} ${height / 2}`);
}
export type MakeCalloutProps = {width?: number; height?: number; pointerLength?: number; pointerBaseWidth?: number; pointerPosition?: number; pointerDirection?: Direction; edgeRoundness?: number | null; cornerRadius?: number};
export function makeCallout({width = 500, height = 200, pointerLength = 40, pointerBaseWidth = 60, pointerPosition = 0.5, pointerDirection = 'down', edgeRoundness = null, cornerRadius = 0}: MakeCalloutProps): ShapeInfo {
  if (!(pointerPosition >= 0 && pointerPosition <= 1)) throw new Error(`"pointerPosition" must be a number between 0 and 1, got ${pointerPosition}`);
  assertSingleRounding(edgeRoundness, cornerRadius);
  const half = pointerBaseWidth / 2, px = pointerPosition * width, py = pointerPosition * height;
  const bx0 = Math.max(0, px - half), bx1 = Math.min(width, px + half), by0 = Math.max(0, py - half), by1 = Math.min(height, py + half);
  // Body corners can round; pointer points stay sharp.
  type Node = {p: Pt; corner: boolean};
  const body = (x: number, y: number): Node => ({p: [x, y], corner: true}), tip = (x: number, y: number): Node => ({p: [x, y], corner: false});
  const layouts: Record<Direction, {nodes: Node[]; size: Pt; origin: Pt}> = {
    down: {nodes: [body(0, 0), body(width, 0), body(width, height), tip(bx1, height), tip(px, height + pointerLength), tip(bx0, height), body(0, height)], size: [width, height + pointerLength], origin: [width / 2, height / 2]},
    up: {nodes: [body(0, pointerLength), tip(bx0, pointerLength), tip(px, 0), tip(bx1, pointerLength), body(width, pointerLength), body(width, height + pointerLength), body(0, height + pointerLength)], size: [width, height + pointerLength], origin: [width / 2, height / 2 + pointerLength]},
    left: {nodes: [body(pointerLength, 0), body(width + pointerLength, 0), body(width + pointerLength, height), body(pointerLength, height), tip(pointerLength, by1), tip(0, py), tip(pointerLength, by0)], size: [width + pointerLength, height], origin: [width / 2 + pointerLength, height / 2]},
    right: {nodes: [body(0, 0), body(width, 0), tip(width, by0), tip(width + pointerLength, py), tip(width, by1), body(width, height), body(0, height)], size: [width + pointerLength, height], origin: [width / 2, height / 2]},
  };
  const layout = layouts[pointerDirection];
  if (!layout) throw new Error(`Invalid pointer direction: ${String(pointerDirection)}`);
  const origin = `${layout.origin[0]} ${layout.origin[1]}`;
  // A pointer base point sitting on a body corner merges into it and keeps the corner sharp.
  const nodes: Node[] = [];
  for (const node of layout.nodes) {
    const last = nodes[nodes.length - 1];
    if (last && last.p[0] === node.p[0] && last.p[1] === node.p[1]) { last.corner = false; continue; }
    nodes.push({...node});
  }
  if (nodes.length > 1 && nodes[0]!.p[0] === nodes[nodes.length - 1]!.p[0] && nodes[0]!.p[1] === nodes[nodes.length - 1]!.p[1]) { nodes.pop(); nodes[0]!.corner = false; }
  const points = nodes.map(n => n.p);
  if (edgeRoundness != null || cornerRadius === 0) return info([...joinPoints([...points, points[0]!], {edgeRoundness, cornerRadius: 0, roundCornerStrategy: 'arc'}), Z], layout.size[0], layout.size[1], origin);
  const n = nodes.length, at = (i: number) => nodes[((i % n) + n) % n]!;
  const r = cornerRadius, out: Instruction[] = [];
  for (let i = 0; i <= n; i++) {
    const node = at(i), corner = node.p;
    if (i === n && !node.corner) break;
    if (!node.corner) { out.push({type: i === 0 ? 'M' : 'L', x: corner[0], y: corner[1]}); continue; }
    const uin = unit(at(i - 1).p, corner), uout = unit(corner, at(i + 1).p);
    if (i === 0) { out.push({type: 'M', x: corner[0] + r * uout[0], y: corner[1] + r * uout[1]}); continue; }
    out.push({type: 'L', x: corner[0] - r * uin[0], y: corner[1] - r * uin[1]}, {type: 'a', rx: r, ry: r, xAxisRotation: 0, largeArcFlag: false, sweepFlag: true, dx: r * uin[0] + r * uout[0], dy: r * uin[1] + r * uout[1]});
  }
  return info([...out, Z], layout.size[0], layout.size[1], origin);
}

// Components: an <svg> sized to the shape with one <path>; extra props go to the path, timeline and effects props are not honored.
type SvgProps = Omit<React.SVGProps<SVGPathElement>, 'width' | 'height' | 'd' | 'hidden' | 'name'>;
export type AllShapesProps = SvgProps & {
  readonly debug?: boolean; readonly pathStyle?: React.CSSProperties; readonly transformOrigin?: string;
  readonly from?: number; readonly durationInFrames?: number; readonly premountFor?: number; readonly postmountFor?: number; readonly styleWhilePremounted?: React.CSSProperties; readonly styleWhilePostmounted?: React.CSSProperties;
  readonly trimBefore?: number; readonly playbackRate?: number; readonly loop?: boolean; readonly freeze?: number | null; readonly hidden?: boolean; readonly name?: string; readonly showInTimeline?: boolean; readonly controls?: unknown;
  readonly effects?: unknown; readonly effectsOutputSize?: unknown; readonly pixelDensity?: number;
};
function RenderSvg({shape, debug, style, pathStyle, transformOrigin, from, durationInFrames, premountFor, postmountFor, styleWhilePremounted, styleWhilePostmounted, trimBefore, playbackRate, loop, freeze, hidden, name, showInTimeline, controls, effects, effectsOutputSize, pixelDensity, ...props}: AllShapesProps & {shape: ShapeInfo}) {
  const overlays: React.ReactNode[] = [];
  if (debug) {
    let x = 0, y = 0;
    shape.instructions.forEach((i, k) => {
      if (i.type === 'C') overlays.push(
        <path key={`a${k}`} d={`M ${x} ${y} ${i.cp1x} ${i.cp1y}`} strokeWidth={2} stroke="rgba(0, 0, 0, 0.4)" />, <path key={`b${k}`} d={`M ${i.x} ${i.y} ${i.cp2x} ${i.cp2y}`} strokeWidth={2} stroke="rgba(0, 0, 0, 0.4)" />,
        <circle key={`c${k}`} cx={i.cp1x} cy={i.cp1y} r={3} fill="white" strokeWidth={2} stroke="black" />, <circle key={`d${k}`} cx={i.cp2x} cy={i.cp2y} r={3} strokeWidth={2} fill="white" stroke="black" />);
      if (i.type === 'M' || i.type === 'L' || i.type === 'C' || i.type === 'A') { x = i.x; y = i.y; } else if (i.type === 'a') { x += i.dx; y += i.dy; }
    });
  }
  return (
    <svg width={shape.width} height={shape.height} viewBox={`0 0 ${shape.width} ${shape.height}`} xmlns="http://www.w3.org/2000/svg" style={{overflow: 'visible', ...style}}>
      <path {...({transformOrigin: transformOrigin ?? shape.transformOrigin} as Record<string, string>)} d={shape.path} style={{transformBox: 'fill-box', ...pathStyle}} {...props} />
      {overlays}
    </svg>
  );
}
export type RectProps = MakeRectOptions & AllShapesProps;
export const Rect: React.FC<RectProps> = ({width, height, edgeRoundness, cornerRadius, ...props}) => <RenderSvg shape={makeRect({width, height, edgeRoundness, cornerRadius})} {...props} />;
export type CircleProps = MakeCircleProps & AllShapesProps;
export const Circle: React.FC<CircleProps> = ({radius, ...props}) => <RenderSvg shape={makeCircle({radius})} {...props} />;
export type EllipseProps = MakeEllipseOptions & AllShapesProps;
export const Ellipse: React.FC<EllipseProps> = ({rx, ry, ...props}) => <RenderSvg shape={makeEllipse({rx, ry})} {...props} />;
export type PieProps = MakePieProps & AllShapesProps;
export const Pie: React.FC<PieProps> = ({radius, progress, closePath, counterClockwise, rotation, ...props}) => <RenderSvg shape={makePie({radius, progress, closePath, counterClockwise, rotation})} {...props} />;
export type HeartProps = MakeHeartProps & AllShapesProps;
export const Heart: React.FC<HeartProps> = ({height, aspectRatio, bottomRoundnessAdjustment, depthAdjustment, ...props}) => <RenderSvg shape={makeHeart({height, aspectRatio, bottomRoundnessAdjustment, depthAdjustment})} {...props} />;
export type PolygonProps = MakePolygonProps & Omit<AllShapesProps, 'points'>;
export const Polygon: React.FC<PolygonProps> = ({points, radius, edgeRoundness, cornerRadius, ...props}) => <RenderSvg shape={makePolygon({points, radius, edgeRoundness, cornerRadius})} {...props} />;
export type StarProps = MakeStarProps & Omit<AllShapesProps, 'points'>;
export const Star: React.FC<StarProps> = ({points, innerRadius, outerRadius, edgeRoundness, cornerRadius, ...props}) => <RenderSvg shape={makeStar({points, innerRadius, outerRadius, edgeRoundness, cornerRadius})} {...props} />;
export type TriangleProps = MakeTriangleProps & AllShapesProps;
export const Triangle: React.FC<TriangleProps> = ({length, direction, edgeRoundness, cornerRadius, ...props}) => <RenderSvg shape={makeTriangle({length, direction, edgeRoundness, cornerRadius})} {...props} />;
export type SparkProps = MakeSparkProps & AllShapesProps;
export const Spark: React.FC<SparkProps> = ({width, height, edgeRoundness, cornerRadius, ...props}) => <RenderSvg shape={makeSpark({width, height, edgeRoundness, cornerRadius})} {...props} />;
export type ArrowProps = MakeArrowProps & AllShapesProps;
export const Arrow: React.FC<ArrowProps> = ({length, headWidth, headLength, shaftWidth, direction, cornerRadius, ...props}) => <RenderSvg shape={makeArrow({length, headWidth, headLength, shaftWidth, direction, cornerRadius})} {...props} />;
export type CalloutProps = MakeCalloutProps & AllShapesProps;
export const Callout: React.FC<CalloutProps> = ({width, height, pointerLength, pointerBaseWidth, pointerPosition, pointerDirection, edgeRoundness, cornerRadius, ...props}) => <RenderSvg shape={makeCallout({width, height, pointerLength, pointerBaseWidth, pointerPosition, pointerDirection, edgeRoundness, cornerRadius})} {...props} />;
