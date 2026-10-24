import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Easing, MotionProbe, continueRender, delayRender, interpolate, spring} from 'frameforge';
import type {BlockEntry} from './types';

// Map blocks draw GeoJSON (public/assets/generated/<slug>/geo/<name>.geojson from `npm run geo`) as one <svg> of paths in one
// stroke; the svg clips its own paths, and labels are HTML siblings of it in an unclipped box, so the text-clip guard never sees a clipping ancestor. Projection and path math are
// pure functions below so tests cover them without a browser; every motion is a function of `frame`.
type Palette = {ink: string; paper: string; accent: string; soft: string};
type Fonts = {display: string; ui: string};
type Block = {frame: number; at: number; out?: number; duration?: number; fps?: number; palette: Palette; fonts: Fonts; size?: number; stroke?: number; radius?: number; x?: number; y?: number; width?: number; height?: number; id?: string};
export type LonLat = [number, number];
export type Geometry = {type: 'Polygon'; coordinates: LonLat[][]} | {type: 'MultiPolygon'; coordinates: LonLat[][][]} | {type: 'LineString'; coordinates: LonLat[]} | {type: 'MultiLineString'; coordinates: LonLat[][]};
export type Feature = {type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry | null};
export type FeatureCollection = {type: 'FeatureCollection'; features: Feature[]};
export type Projection = 'equirectangular' | 'mercator';
/** `'bounds'` fits the data into the box; `{center, zoom}` puts `center` mid-box at `zoom` (1 = the whole world's 360° fills the box width). */
export type Fit = 'bounds' | {center: LonLat; zoom: number};
/** Pixel = tx + scale × projected degree; produced by `fitBounds` or `fitCenter`. */
export type View = {projection: Projection; scale: number; tx: number; ty: number};
type MapBase = {src?: string; data?: FeatureCollection; projection?: Projection; fit?: Fit; highlight?: string[]; highlightKey?: string};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const span = (frame: number, from: number, dur: number) => interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
const pop = (frame: number, at: number, dur: number, fps: number) => spring({frame, fps, delay: at, durationInFrames: dur, config: {overshootClamping: true}});
// Outlines are thin (size × 0.12, 4.6 px at 38) so a whole continent stays legible; the route line is three outlines wide.
const dims = (b: Block) => { const size = b.size ?? 38; return {size, stroke: b.stroke ?? size * 0.12, radius: b.radius ?? size * 0.4, W: b.width ?? size * 40, H: b.height ?? size * 22}; };
const DEG = 180 / Math.PI;

/** Degrees in a flat plane: x = longitude, y grows downward. Mercator clamps latitude to ±85° so the poles stay finite. */
export function project([lon, lat]: LonLat, projection: Projection = 'equirectangular'): [number, number] {
  if (projection === 'equirectangular') return [lon, 0 - lat];
  const phi = Math.max(-85, Math.min(85, lat)) / DEG;
  return [lon, 0 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) * DEG];
}

/** [[minLon, minLat], [maxLon, maxLat]] over every coordinate. */
export function bounds(data: FeatureCollection): [LonLat, LonLat] {
  const box: [LonLat, LonLat] = [[Infinity, Infinity], [-Infinity, -Infinity]];
  for (const feature of data.features) for (const line of lines(feature.geometry)) for (const [lon, lat] of line) {
    box[0] = [Math.min(box[0][0], lon), Math.min(box[0][1], lat)];
    box[1] = [Math.max(box[1][0], lon), Math.max(box[1][1], lat)];
  }
  return box;
}

/** A view that fits the box into W × H with `pad` (fraction of the box) around it, centred. */
export function fitBounds([lo, hi]: [LonLat, LonLat], W: number, H: number, projection: Projection = 'equirectangular', pad = 0.04): View {
  const corners = [project(lo, projection), project(hi, projection), project([lo[0], hi[1]], projection), project([hi[0], lo[1]], projection)];
  const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const scale = Math.min((W * (1 - 2 * pad)) / (x1 - x0 || 1), (H * (1 - 2 * pad)) / (y1 - y0 || 1));
  return {projection, scale, tx: W / 2 - scale * (x0 + x1) / 2, ty: H / 2 - scale * (y0 + y1) / 2};
}

/** A view with `center` in the middle of W × H; zoom 1 fits 360° of longitude in W. */
export function fitCenter(center: LonLat, zoom: number, W: number, H: number, projection: Projection = 'equirectangular'): View {
  const scale = (zoom * W) / 360, [cx, cy] = project(center, projection);
  return {projection, scale, tx: W / 2 - scale * cx, ty: H / 2 - scale * cy};
}

export const toPixel = (p: LonLat, view: View): [number, number] => { const [x, y] = project(p, view.projection); return [view.tx + view.scale * x, view.ty + view.scale * y]; };

function lines(geometry: Geometry | null): LonLat[][] {
  if (!geometry) return [];
  switch (geometry.type) {
    case 'Polygon': return geometry.coordinates;
    case 'MultiPolygon': return geometry.coordinates.flat();
    case 'LineString': return [geometry.coordinates];
    case 'MultiLineString': return geometry.coordinates;
  }
}

/** SVG path data for a geometry in `view`, coordinates rounded to 0.1 px; polygon rings close with Z.
 * shortcut: a ring that jumps more than 180° of longitude (Fiji at 110m) starts a new subpath instead of a line across the world; a true antimeridian cut would split the polygon. */
export function geoPath(geometry: Geometry | null, view: View): string {
  if (!geometry) return '';
  const closed = geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
  const px = (p: LonLat) => toPixel(p, view).map(v => Math.round(v * 10) / 10).join(' ');
  return lines(geometry).map(line => line.map((p, i) => `${i === 0 || Math.abs(p[0] - line[i - 1]![0]) > 180 ? 'M' : 'L'}${px(p)}`).join('') + (closed ? 'Z' : '')).join('');
}

/** Points along the great circle between consecutive route points, every ~2° of arc, so a long leg bends like a flight path. */
export function greatCircle(route: LonLat[]): LonLat[] {
  const out: LonLat[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    const [lon1, lat1] = route[i]!.map(v => v / DEG) as [number, number], [lon2, lat2] = route[i + 1]!.map(v => v / DEG) as [number, number];
    const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2));
    const n = Math.max(1, Math.ceil(d * DEG / 2));
    for (let k = 0; k < n; k++) {
      const f = k / n, a = d ? Math.sin((1 - f) * d) / Math.sin(d) : 1 - f, b = d ? Math.sin(f * d) / Math.sin(d) : f;
      const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2), y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2), z = a * Math.sin(lat1) + b * Math.sin(lat2);
      out.push([Math.atan2(y, x) * DEG, Math.atan2(z, Math.sqrt(x * x + y * y)) * DEG]);
    }
  }
  if (route.length) out.push(route[route.length - 1]!);
  return out;
}

/** Point at fraction `t` of a pixel polyline's length, and the fraction at which each vertex sits. */
function alongPolyline(points: [number, number][]) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]));
  const total = cum[cum.length - 1] || 1;
  const at = (t: number): [number, number] => {
    const d = Math.max(0, Math.min(1, t)) * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i]! < d) i++;
    const f = (d - cum[i - 1]!) / (cum[i]! - cum[i - 1]! || 1), p = points[i - 1]!, q = points[i] ?? p;
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  };
  return {at, fraction: (index: number) => cum[Math.min(index, cum.length - 1)]! / total};
}

const cache = new Map<string, Promise<FeatureCollection>>();
/** The GeoJSON for a block: `data` as given, else `src` fetched once per path with the frame held; a missing file throws a readable composition error. */
function useGeo(src: string | undefined, data: FeatureCollection | undefined, who: string): FeatureCollection | null {
  const [state, setState] = useState<{src: string; data?: FeatureCollection; error?: string} | null>(null);
  const handle = useRef<number | null>(null);
  const loading = !data && src !== undefined && state?.src !== src;
  if (loading && handle.current === null) handle.current = delayRender(`${who} ${src}`);
  useEffect(() => {
    if (data || src === undefined) return;
    let alive = true;
    (cache.get(src) ?? cache.set(src, fetch(src).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<FeatureCollection>; })).get(src)!)
      .then(loaded => { if (alive) setState({src, data: loaded}); }, error => { if (alive) setState({src, error: String(error)}); });
    return () => { alive = false; };
  }, [src, data]);
  useEffect(() => { if (!loading && handle.current !== null) { continueRender(handle.current); handle.current = null; } }, [loading]);
  if (data) return data;
  if (src === undefined) throw new Error(`${who}: pass src (a GeoJSON path under public/) or data`);
  if (state?.src === src && state.error) throw new Error(`${who} ${src}: ${state.error}; run npm run geo -- examples/samples/<slug>/geo.json first`);
  return state?.src === src ? state.data! : null;
}

const viewFor = (fit: Fit, data: FeatureCollection, W: number, H: number, projection: Projection) => fit === 'bounds' ? fitBounds(bounds(data), W, H, projection) : fitCenter(fit.center, fit.zoom, W, H, projection);

function Box({b, children}: {b: Block; children: ReactNode}) {
  const {W, H} = dims(b);
  if (b.frame < b.at || (b.out !== undefined && b.frame >= b.out)) return null;
  return <div style={{position: 'absolute', left: b.x ?? 0, top: b.y ?? 0, width: W, height: H, opacity: b.out === undefined ? 1 : 1 - span(b.frame, b.out - 8, 8)}}>{children}</div>;
}

/** Land in `soft`, outlines drawn by pathLength to `draw`; highlighted features fill in `accent` to `fill`. */
function Land({data, view, b, draw, fill}: {data: FeatureCollection; view: View; b: Block & MapBase; draw: number; fill: number}) {
  const {stroke, W, H} = dims(b), key = b.highlightKey ?? 'iso_a3', lit = new Set(b.highlight ?? []);
  const dash = draw >= 1 ? {} : {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw};
  return <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
    {data.features.map((feature, i) => {
      const d = geoPath(feature.geometry, view), on = lit.has(String(feature.properties[key]));
      return <g key={i}>
        <path d={d} fill={b.palette.soft} fillOpacity={0.3 * draw} stroke="none" />
        {on && fill > 0 ? <path d={d} fill={b.palette.accent} fillOpacity={fill} stroke="none" /> : null}
        <path d={d} fill="none" stroke={on && fill > 0 ? b.palette.accent : b.palette.soft} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" {...dash} />
      </g>;
    })}
  </svg>;
}

const plate = (b: Block, extra: object = {}) => ({position: 'absolute' as const, padding: `${dims(b).size * 0.3}px ${dims(b).size * 0.6}px`, borderRadius: dims(b).radius, background: b.palette.ink, color: b.palette.paper, fontFamily: b.fonts.ui, fontSize: dims(b).size, lineHeight: 1, whiteSpace: 'nowrap' as const, ...extra});

export type MapOutlineProps = Block & MapBase & {draw?: number};
/** Outlines trace in by path length over `duration × 0.7` while land fills in `soft`; `highlight` features fill in `accent` once the outlines landed. `draw` overrides the progress. */
export function MapOutline(b: MapOutlineProps) {
  const data = useGeo(b.src, b.data, 'MapOutline');
  const {W, H} = dims(b), duration = b.duration ?? 60;
  if (!data) return null;
  const draw = b.draw ?? span(b.frame, b.at, duration * 0.7), fill = b.draw === undefined ? span(b.frame, b.at + duration * 0.6, duration * 0.4) : b.draw;
  return <Box b={b}>
    <MotionProbe id={b.id ?? `map-outline-${b.at}`} value={draw} family="shape" axis="progress" />
    <Land data={data} view={viewFor(b.fit ?? 'bounds', data, W, H, b.projection ?? 'equirectangular')} b={b} draw={draw} fill={fill} />
  </Box>;
}

export type RouteMapProps = Block & MapBase & {route: LonLat[]; stops?: {at: LonLat; label: string}[]; lead?: number};
/** The base map draws in over `lead` frames (default 20), then a dot travels the great-circle route over `duration` (default 90) with the line drawing behind it; each stop pops with its label plate as the dot passes. */
export function RouteMap(b: RouteMapProps) {
  const data = useGeo(b.src, b.data, 'RouteMap');
  const {size, stroke, W, H} = dims(b), duration = b.duration ?? 90, lead = b.lead ?? 20, fps = b.fps ?? 30, {ink, paper, accent} = b.palette;
  if (!data) return null;
  const view = viewFor(b.fit ?? 'bounds', data, W, H, b.projection ?? 'equirectangular');
  const points = greatCircle(b.route).map(p => toPixel(p, view));
  const line = alongPolyline(points), t = span(b.frame, b.at + lead, duration), head = line.at(t);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const nearest = (p: LonLat) => { const [x, y] = toPixel(p, view); let best = 0; points.forEach((q, i) => { if (Math.hypot(q[0] - x, q[1] - y) < Math.hypot(points[best]![0] - x, points[best]![1] - y)) best = i; }); return line.fraction(best); };
  const stops = (b.stops ?? []).map(stop => ({...stop, px: toPixel(stop.at, view), p: pop(b.frame, b.at + lead + nearest(stop.at) * duration, 14, fps)}));
  return <Box b={b}>
    <MotionProbe id={b.id ?? `route-map-${b.at}`} value={head[0] * (t > 0 ? 1 : 0)} family="shape" axis="x" />
    <Land data={data} view={view} b={b} draw={span(b.frame, b.at, lead)} fill={span(b.frame, b.at, lead)} />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      {t > 0 ? <path d={d} fill="none" stroke={accent} strokeWidth={stroke * 3} strokeLinecap="round" strokeLinejoin="round" {...(t < 1 ? {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - t} : {})} /> : null}
      {stops.map(stop => <circle key={stop.label} cx={stop.px[0]} cy={stop.px[1]} r={size * 0.45 * stop.p} fill={paper} stroke={ink} strokeWidth={stroke * 2} />)}
      {t > 0 ? <circle cx={head[0]} cy={head[1]} r={size * 0.55} fill={accent} stroke={paper} strokeWidth={stroke * 2} /> : null}
    </svg>
    {stops.map(stop => <div key={stop.label} style={plate(b, {left: stop.px[0] + size * 0.9, top: stop.px[1] - size * 0.8, opacity: stop.p, transform: `translateY(${(1 - stop.p) * size * 0.5}px)`})}>{stop.label}</div>)}
  </Box>;
}

export type MarkersProps = Block & MapBase & {points: {at: LonLat; label: string; value?: number}[]; unit?: string; lead?: number};
/** Pins pop on the map with an 8-frame stagger after the base drew in (`lead`, default 20); a point with `value` grows an accent bubble whose area follows the value and prints it in the plate. */
export function Markers(b: MarkersProps) {
  const data = useGeo(b.src, b.data, 'Markers');
  const {size, stroke, W, H} = dims(b), lead = b.lead ?? 20, fps = b.fps ?? 30, unit = b.unit ?? '', {ink, paper, accent} = b.palette;
  if (!data) return null;
  const view = viewFor(b.fit ?? 'bounds', data, W, H, b.projection ?? 'equirectangular');
  const max = Math.max(1, ...b.points.map(p => p.value ?? 0));
  const marks = b.points.map((point, i) => ({...point, px: toPixel(point.at, view), p: pop(b.frame, b.at + lead + i * 8, 16, fps), r: point.value === undefined ? size * 0.45 : size * 0.6 + size * 1.6 * Math.sqrt(point.value / max)}));
  return <Box b={b}>
    <MotionProbe id={b.id ?? `markers-${b.at}`} value={marks[0]?.p ?? 0} family="card" axis="scale" />
    <Land data={data} view={view} b={b} draw={span(b.frame, b.at, lead)} fill={span(b.frame, b.at, lead)} />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      {marks.map(m => <g key={m.label}>
        {m.value !== undefined ? <circle cx={m.px[0]} cy={m.px[1]} r={m.r * m.p} fill={accent} fillOpacity={0.35} /> : null}
        <circle cx={m.px[0]} cy={m.px[1]} r={size * 0.45 * m.p} fill={accent} stroke={paper} strokeWidth={stroke * 2} />
      </g>)}
    </svg>
    {marks.map(m => <div key={m.label} style={plate(b, {left: m.px[0] + m.r * m.p + size * 0.5, top: m.px[1] - size * 0.8, opacity: m.p, transform: `translateY(${(1 - m.p) * size * 0.5}px)`, color: paper, background: ink})}>
      {m.label}{m.value !== undefined ? <span style={{fontFamily: b.fonts.display, fontVariantNumeric: 'tabular-nums', marginLeft: size * 0.4}}>{Math.round(m.value * m.p).toLocaleString('en-US')}{unit}</span> : null}
    </div>)}
  </Box>;
}

const base = ['frame', 'at', 'out', 'duration', 'fps', 'palette', 'fonts', 'size', 'stroke', 'radius', 'x', 'y', 'width', 'height', 'id', 'src', 'data', 'projection', 'fit', 'highlight', 'highlightKey'];
export const MAP_BLOCKS: BlockEntry[] = [
  {id: 'map-outline', when: 'Place a story on the world or a region: outlines draw in, a few countries light up.', title: 'Map outline', family: 'map', props: [...base, 'draw'], sample: 'map-story'},
  {id: 'route-map', when: 'A journey between places: a dot travels the great-circle route and stops pop as it passes.', title: 'Route map', family: 'map', props: [...base, 'route', 'stops', 'lead'], sample: 'map-story'},
  {id: 'markers', when: 'Several places with a value each: pins pop with a stagger and bubbles size by value.', title: 'Markers', family: 'map', props: [...base, 'points', 'unit', 'lead'], sample: 'map-story'},
];
