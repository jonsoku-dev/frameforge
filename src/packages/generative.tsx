import React, {forwardRef, useImperativeHandle, useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from '../core/index';
import {paintCanvas, validateCanvasSize, type EffectsProp, type ImageFit} from '../core/effects';
import {positive, random} from '../core/math';
import {noise2D, noise3D} from './noise';

/* Generative backgrounds. Every system is a pure function of (seed, params, t): the geometry is computed from scratch
 * for the frame, never accumulated, so the same frame and seed give the same pixels in any order of rendering. */

export type Palette = {ink: string; paper: string; accent: string; soft: string};
/** One parameter in the shape the studio's tune tab reads, so a Spot can spread a system's schema into `variables`. */
export type ParamSchema = {key: string; label: string; type: 'number'; default: number; min: number; max: number; step: number; group?: string};
export type Params = Record<string, number>;
export type PaintArgs<P extends Params> = P & {
  /** Seconds since the film started. */ t: number; frame: number; fps: number; seed: string | number; width: number; height: number; palette: Palette;
  /** Where the unit square lands (see `fit`); painters map (u, v) to `box.x + u * box.width`, `box.y + v * box.height`. */ box: {x: number; y: number; width: number; height: number};
  /** The longer side of `box`; radii and stroke widths scale with it. */ unit: number;
};
export type GenerativeSystem<P extends Params = Params, G = unknown> = {
  id: string; title: string; schema: readonly ParamSchema[];
  /** Canvas-free shapes in unit coordinates for (seed, params, t). */ geometry: (seed: string | number, params: P, t: number) => G;
  paint: (context: CanvasRenderingContext2D, args: PaintArgs<P>, geometry: G) => void;
};

const num = (key: string, label: string, def: number, min: number, max: number, step: number): ParamSchema => ({key, label, type: 'number', default: def, min, max, step});
/** Fills missing params with the schema defaults and clamps each into its range. */
export function clampParams<P extends Params>(system: GenerativeSystem<P, unknown>, params: Partial<P> = {}): P {
  const out: Params = {};
  for (const entry of system.schema) {
    const raw = params[entry.key];
    out[entry.key] = Math.min(entry.max, Math.max(entry.min, typeof raw === 'number' && Number.isFinite(raw) ? raw : entry.default));
  }
  return out as P;
}
const TAU = Math.PI * 2;
const seeded = (seed: string | number, key: string) => random(`${seed}:${key}`);
const colours = (palette: Palette): string[] => [palette.accent, palette.soft, palette.paper];
const hex = (color: string) => color.startsWith('#') && (color.length === 7 || color.length === 4) ? color : null;
/** Appends an alpha to a `#rgb`/`#rrggbb` colour; other colours are returned as they are (the painter then uses globalAlpha). */
function withAlpha(color: string, alpha: number): string {
  const h = hex(color);
  if (!h) return color;
  const full = h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
  return `${full}${Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0')}`;
}
type Point = {x: number; y: number};
type Box = PaintArgs<Params>['box'];
const point = (args: {box: Box}, u: number, v: number): Point => ({x: args.box.x + u * args.box.width, y: args.box.y + v * args.box.height});
function polyline(context: CanvasRenderingContext2D, args: {box: Box}, line: readonly number[]): void {
  context.beginPath();
  for (let i = 0; i + 1 < line.length; i += 2) { const p = point(args, line[i]!, line[i + 1]!); if (i === 0) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y); }
  context.stroke();
}

/* ---------- flowField ---------- */
export type FlowFieldParams = {lines: number; steps: number; stepLength: number; scale: number; grow: number; strokeWidth: number};
const flowCache = new Map<string, number[][]>();
/** Full streamlines of a seeded flow field, memoised per (seed, params); each is a flat [x0, y0, x1, y1, ...] list in unit coordinates. */
export function flowFieldFullLines(seed: string | number, params: FlowFieldParams): number[][] {
  const key = `${seed}|${params.lines}|${params.steps}|${params.stepLength}|${params.scale}`;
  const cached = flowCache.get(key);
  if (cached) return cached;
  const lines = Array.from({length: Math.round(params.lines)}, (_, i) => {
    let x = seeded(seed, `fx${i}`), y = seeded(seed, `fy${i}`);
    const line = [x, y];
    for (let s = 0; s < params.steps; s++) {
      const angle = noise2D(seed, x * params.scale, y * params.scale) * TAU;
      x += Math.cos(angle) * params.stepLength; y += Math.sin(angle) * params.stepLength;
      if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) break;
      line.push(x, y);
    }
    return line;
  });
  flowCache.set(key, lines);
  return lines;
}
/** The visible prefix of every streamline at time `t`: lines grow to full length over `grow` seconds, each with a seeded head start. */
export function flowFieldLines(seed: string | number, params: FlowFieldParams, t: number): number[][] {
  return flowFieldFullLines(seed, params).map((line, i) => {
    const share = Math.min(1, Math.max(0, (t / params.grow) * (0.6 + 0.8 * seeded(seed, `fg${i}`))));
    const points = Math.max(1, Math.round(share * (line.length / 2)));
    return line.slice(0, points * 2);
  });
}
export const flowField: GenerativeSystem<FlowFieldParams, number[][]> = {
  id: 'flowField', title: 'Flow field',
  schema: [num('lines', '선 수', 90, 10, 600, 10), num('steps', '선 길이(단계)', 220, 10, 600, 10), num('stepLength', '단계 길이', 0.004, 0.001, 0.03, 0.001), num('scale', '노이즈 배율', 1.6, 0.5, 8, 0.1), num('grow', '다 자라는 시간(초)', 4, 0.5, 20, 0.5), num('strokeWidth', '선 굵기(단위 비율)', 0.0025, 0.0005, 0.01, 0.0005)],
  geometry: flowFieldLines,
  paint: (context, args, lines) => {
    context.lineCap = 'round'; context.lineJoin = 'round'; context.lineWidth = args.strokeWidth * args.unit;
    const tones = colours(args.palette);
    lines.forEach((line, i) => { if (line.length < 4) return; context.strokeStyle = tones[i % tones.length]!; polyline(context, args, line); });
  },
};

/* ---------- particles ---------- */
export type ParticleParams = {count: number; size: number; orbit: number; speed: number; pulse: number};
export type Disc = {x: number; y: number; r: number; alpha: number};
/** Closed-form orbits: each disc circles a seeded centre with its own radius, phase and pulse. */
export function particleDiscs(seed: string | number, params: ParticleParams, t: number): Disc[] {
  return Array.from({length: Math.round(params.count)}, (_, i) => {
    const phase = seeded(seed, `pp${i}`) * TAU, rate = params.speed * (0.5 + seeded(seed, `pr${i}`)), orbit = params.orbit * (0.3 + 0.7 * seeded(seed, `po${i}`));
    const pulse = 0.5 + 0.5 * Math.sin(t * params.pulse * TAU * (0.5 + seeded(seed, `pq${i}`)) + phase);
    return {x: seeded(seed, `px${i}`) + Math.cos(t * rate + phase) * orbit, y: seeded(seed, `py${i}`) + Math.sin(t * rate + phase) * orbit, r: params.size * (0.6 + 0.4 * pulse), alpha: 0.35 + 0.65 * pulse};
  });
}
export const particles: GenerativeSystem<ParticleParams, Disc[]> = {
  id: 'particles', title: 'Particles',
  schema: [num('count', '개수', 24, 1, 200, 1), num('size', '반지름(단위 비율)', 0.045, 0.01, 0.3, 0.005), num('orbit', '궤도 반지름', 0.12, 0, 0.5, 0.01), num('speed', '속도(rad/s)', 0.6, 0, 4, 0.05), num('pulse', '맥동(Hz)', 0.4, 0, 3, 0.05)],
  geometry: particleDiscs,
  paint: (context, args, discs) => {
    const tones = colours(args.palette);
    discs.forEach((disc, i) => {
      const p = point(args, disc.x, disc.y);
      context.globalAlpha = disc.alpha; context.fillStyle = tones[i % tones.length]!;
      context.beginPath(); context.arc(p.x, p.y, disc.r * args.unit, 0, TAU); context.fill();
    });
    context.globalAlpha = 1;
  },
};

/* ---------- starfield ---------- */
export type StarfieldParams = {layers: number; density: number; speed: number; size: number; twinkle: number};
/** Parallax layers drifting left; each layer wraps, so the field is periodic and closed-form in t. */
export function starfieldDiscs(seed: string | number, params: StarfieldParams, t: number): Disc[] {
  const stars: Disc[] = [];
  for (let layer = 0; layer < Math.round(params.layers); layer++) {
    const depth = (layer + 1) / Math.round(params.layers);
    for (let i = 0; i < Math.round(params.density); i++) {
      const x = (seeded(seed, `sx${layer}-${i}`) + t * params.speed * depth) % 1;
      const twinkle = 0.5 + 0.5 * noise3D(seed, i * 0.37, layer * 1.7, t * params.twinkle);
      stars.push({x, y: seeded(seed, `sy${layer}-${i}`), r: params.size * (0.4 + 0.6 * depth) * (0.7 + 0.3 * twinkle), alpha: 0.3 + 0.7 * twinkle * depth});
    }
  }
  return stars;
}
export const starfield: GenerativeSystem<StarfieldParams, Disc[]> = {
  id: 'starfield', title: 'Starfield',
  schema: [num('layers', '층 수', 3, 1, 6, 1), num('density', '층당 별 수', 60, 5, 400, 5), num('speed', '흐름 속도', 0.03, 0, 0.5, 0.005), num('size', '반지름(단위 비율)', 0.006, 0.001, 0.05, 0.001), num('twinkle', '반짝임 속도', 0.8, 0, 4, 0.1)],
  geometry: starfieldDiscs,
  paint: (context, args, stars) => {
    context.fillStyle = args.palette.paper;
    for (const star of stars) { const p = point(args, star.x, star.y); context.globalAlpha = star.alpha; context.beginPath(); context.arc(p.x, p.y, star.r * args.unit, 0, TAU); context.fill(); }
    context.globalAlpha = 1;
  },
};

/* ---------- meshGradient ---------- */
export type MeshGradientParams = {blobs: number; radius: number; drift: number; speed: number};
export type Blob = {x: number; y: number; r: number; tone: number};
/** 3 to 5 radial blobs drifting on seeded ellipses; `tone` indexes accent, soft, paper. */
export function meshGradientBlobs(seed: string | number, params: MeshGradientParams, t: number): Blob[] {
  return Array.from({length: Math.round(params.blobs)}, (_, i) => {
    const phase = seeded(seed, `mp${i}`) * TAU, rate = params.speed * TAU * (0.4 + 0.6 * seeded(seed, `mr${i}`));
    return {x: 0.15 + 0.7 * seeded(seed, `mx${i}`) + Math.sin(t * rate + phase) * params.drift, y: 0.15 + 0.7 * seeded(seed, `my${i}`) + Math.cos(t * rate * 0.8 + phase) * params.drift, r: params.radius * (0.7 + 0.6 * seeded(seed, `ms${i}`)), tone: i % 3};
  });
}
export const meshGradient: GenerativeSystem<MeshGradientParams, Blob[]> = {
  id: 'meshGradient', title: 'Mesh gradient',
  schema: [num('blobs', '덩어리 수', 4, 3, 5, 1), num('radius', '반지름(단위 비율)', 0.55, 0.2, 1.2, 0.05), num('drift', '흔들림 폭', 0.12, 0, 0.4, 0.01), num('speed', '속도(Hz)', 0.05, 0, 0.5, 0.005)],
  geometry: meshGradientBlobs,
  paint: (context, args, blobs) => {
    context.fillStyle = args.palette.ink; context.fillRect(0, 0, args.width, args.height);
    const tones = colours(args.palette);
    for (const blob of blobs) {
      const p = point(args, blob.x, blob.y), r = blob.r * args.unit;
      const gradient = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      gradient.addColorStop(0, withAlpha(tones[blob.tone]!, 0.9)); gradient.addColorStop(0.5, withAlpha(tones[blob.tone]!, 0.35)); gradient.addColorStop(1, withAlpha(tones[blob.tone]!, 0));
      context.fillStyle = gradient; context.fillRect(0, 0, args.width, args.height);
    }
  },
};

/* ---------- halftone ---------- */
export type HalftoneParams = {cell: number; scale: number; speed: number; maxRadius: number};
export type Dot = {x: number; y: number; r: number};
/** A dot grid whose radii follow 3D noise over (x, y, t). */
export function halftoneDots(seed: string | number, params: HalftoneParams, t: number): Dot[] {
  const dots: Dot[] = [], n = Math.round(1 / params.cell);
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const x = (gx + 0.5) * params.cell, y = (gy + 0.5) * params.cell;
    const v = 0.5 + 0.5 * noise3D(seed, x * params.scale, y * params.scale, t * params.speed);
    dots.push({x, y, r: params.cell * params.maxRadius * v});
  }
  return dots;
}
export const halftone: GenerativeSystem<HalftoneParams, Dot[]> = {
  id: 'halftone', title: 'Halftone',
  schema: [num('cell', '격자 간격(단위 비율)', 0.04, 0.01, 0.2, 0.005), num('scale', '노이즈 배율', 2.5, 0.2, 10, 0.1), num('speed', '속도', 0.25, 0, 3, 0.05), num('maxRadius', '최대 반지름(격자 비율)', 0.5, 0.05, 0.7, 0.05)],
  geometry: halftoneDots,
  paint: (context, args, dots) => {
    context.fillStyle = args.palette.accent;
    for (const dot of dots) { const p = point(args, dot.x, dot.y); context.beginPath(); context.arc(p.x, p.y, dot.r * args.unit, 0, TAU); context.fill(); }
  },
};

/* ---------- ripples ---------- */
export type RippleParams = {sources: number; rings: number; spacing: number; speed: number; strokeWidth: number};
export type Ring = {x: number; y: number; r: number; alpha: number};
/** Concentric rings from seeded origins; the whole set expands with t and fades towards the outer radius. */
export function rippleRings(seed: string | number, params: RippleParams, t: number): Ring[] {
  const rings: Ring[] = [], span = params.rings * params.spacing;
  for (let s = 0; s < Math.round(params.sources); s++) {
    const x = 0.1 + 0.8 * seeded(seed, `rx${s}`), y = 0.1 + 0.8 * seeded(seed, `ry${s}`), offset = seeded(seed, `ro${s}`) * params.spacing;
    for (let k = 0; k < Math.round(params.rings); k++) {
      const r = ((t * params.speed + offset + k * params.spacing) % span + span) % span;
      rings.push({x, y, r, alpha: 1 - r / span});
    }
  }
  return rings;
}
export const ripples: GenerativeSystem<RippleParams, Ring[]> = {
  id: 'ripples', title: 'Ripples',
  schema: [num('sources', '파원 수', 3, 1, 8, 1), num('rings', '고리 수', 8, 1, 24, 1), num('spacing', '고리 간격(단위 비율)', 0.06, 0.01, 0.3, 0.005), num('speed', '속도', 0.08, 0, 1, 0.005), num('strokeWidth', '선 굵기(단위 비율)', 0.003, 0.0005, 0.02, 0.0005)],
  geometry: rippleRings,
  paint: (context, args, rings) => {
    context.strokeStyle = args.palette.soft; context.lineWidth = args.strokeWidth * args.unit;
    for (const ring of rings) { if (ring.r <= 0) continue; const p = point(args, ring.x, ring.y); context.globalAlpha = ring.alpha; context.beginPath(); context.arc(p.x, p.y, ring.r * args.unit, 0, TAU); context.stroke(); }
    context.globalAlpha = 1;
  },
};

/* ---------- voronoi ---------- */
export type VoronoiParams = {cells: number; drift: number; speed: number; resolution: number};
export type Site = {x: number; y: number; tone: number};
/** Seeded sites drifting slowly on small ellipses. */
export function voronoiSites(seed: string | number, params: VoronoiParams, t: number): Site[] {
  return Array.from({length: Math.round(params.cells)}, (_, i) => {
    const phase = seeded(seed, `vp${i}`) * TAU;
    return {x: seeded(seed, `vx${i}`) + Math.sin(t * params.speed * TAU + phase) * params.drift, y: seeded(seed, `vy${i}`) + Math.cos(t * params.speed * TAU * 0.7 + phase) * params.drift, tone: Math.floor(seeded(seed, `vt${i}`) * 3)};
  });
}
export const voronoi: GenerativeSystem<VoronoiParams, Site[]> = {
  id: 'voronoi', title: 'Voronoi',
  schema: [num('cells', '셀 수', 18, 2, 80, 1), num('drift', '흔들림 폭', 0.04, 0, 0.2, 0.005), num('speed', '속도(Hz)', 0.05, 0, 0.5, 0.005), num('resolution', '계산 해상도(비율)', 0.2, 0.05, 1, 0.05)],
  geometry: voronoiSites,
  paint: (context, args, sites) => {
    // Nearest-site search per pixel at reduced resolution, then one upscale; the cost is O(pixels x sites) at `resolution`.
    const w = Math.max(2, Math.round(args.width * args.resolution)), h = Math.max(2, Math.round(args.height * args.resolution));
    const small = document.createElement('canvas'); small.width = w; small.height = h;
    const sctx = small.getContext('2d')!;
    const image = sctx.createImageData(w, h), tones = colours(args.palette).map(tone => { const full = withAlpha(tone, 1); return [parseInt(full.slice(1, 3), 16), parseInt(full.slice(3, 5), 16), parseInt(full.slice(5, 7), 16)]; });
    const px = sites.map(site => point(args, site.x, site.y));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = (x + 0.5) / args.resolution, cy = (y + 0.5) / args.resolution;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < px.length; i++) { const dx = px[i]!.x - cx, dy = px[i]!.y - cy, d = dx * dx + dy * dy; if (d < bestD) { bestD = d; best = i; } }
      const tone = tones[sites[best]!.tone]!, o = (y * w + x) * 4;
      image.data[o] = tone[0]!; image.data[o + 1] = tone[1]!; image.data[o + 2] = tone[2]!; image.data[o + 3] = 255;
    }
    sctx.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = true;
    context.drawImage(small, 0, 0, args.width, args.height);
  },
};

/* ---------- noiseLines ---------- */
export type NoiseLineParams = {lines: number; amplitude: number; scale: number; speed: number; radial: number; strokeWidth: number};
/** Horizontal (radial = 0) or radial (radial = 1) lines displaced by 3D noise over t; flat [x, y, ...] lists. */
export function noiseLinePaths(seed: string | number, params: NoiseLineParams, t: number): number[][] {
  const count = Math.round(params.lines), samples = 64;
  return Array.from({length: count}, (_, i) => {
    const line: number[] = [];
    for (let s = 0; s <= samples; s++) {
      const u = s / samples;
      const n = noise3D(seed, u * params.scale, i * 0.31, t * params.speed) * params.amplitude;
      if (params.radial >= 0.5) {
        const angle = (i / count) * TAU, r = u * 0.75 + n;
        line.push(0.5 + Math.cos(angle) * r, 0.5 + Math.sin(angle) * r);
      } else line.push(u, (i + 0.5) / count + n);
    }
    return line;
  });
}
export const noiseLines: GenerativeSystem<NoiseLineParams, number[][]> = {
  id: 'noiseLines', title: 'Noise lines',
  schema: [num('lines', '선 수', 28, 2, 200, 1), num('amplitude', '변위 폭(단위 비율)', 0.05, 0, 0.3, 0.005), num('scale', '노이즈 배율', 1.8, 0.1, 8, 0.1), num('speed', '속도', 0.2, 0, 3, 0.05), num('radial', '방사형(0 가로, 1 방사)', 0, 0, 1, 1), num('strokeWidth', '선 굵기(단위 비율)', 0.002, 0.0005, 0.02, 0.0005)],
  geometry: noiseLinePaths,
  paint: (context, args, lines) => {
    context.strokeStyle = args.palette.soft; context.lineWidth = args.strokeWidth * args.unit; context.lineCap = 'round'; context.lineJoin = 'round';
    for (const line of lines) polyline(context, args, line);
  },
};

/* ---------- aurora ---------- */
export type AuroraParams = {bands: number; amplitude: number; scale: number; speed: number; height: number};
export type Band = {base: number; height: number; edge: number[]; tone: number};
/** Layered bands: each upper edge is a sine plus 3D noise over t; `edge` holds the y of the upper edge per x sample. */
export function auroraBands(seed: string | number, params: AuroraParams, t: number): Band[] {
  const samples = 48, count = Math.round(params.bands);
  return Array.from({length: count}, (_, i) => {
    const phase = seeded(seed, `ap${i}`) * TAU, base = 0.38 + 0.42 * (i + 0.5) / count;
    const edge = Array.from({length: samples + 1}, (_, s) => {
      const u = s / samples;
      return base - params.height + params.amplitude * (Math.sin(u * TAU * params.scale + t * params.speed * TAU + phase) + noise3D(seed, u * params.scale * 1.7, i * 0.5, t * params.speed * 0.6));
    });
    // Accent and soft only: the paper tone reads as a gray stripe over ink.
    return {base, height: params.height, edge, tone: i % 2};
  });
}
export const aurora: GenerativeSystem<AuroraParams, Band[]> = {
  id: 'aurora', title: 'Aurora',
  schema: [num('bands', '띠 수', 4, 1, 8, 1), num('amplitude', '물결 폭(단위 비율)', 0.08, 0, 0.3, 0.005), num('scale', '물결 수', 1.2, 0.2, 5, 0.1), num('speed', '속도(Hz)', 0.06, 0, 0.5, 0.005), num('height', '띠 높이(단위 비율)', 0.2, 0.05, 0.6, 0.01)],
  geometry: auroraBands,
  paint: (context, args, bands) => {
    context.fillStyle = args.palette.ink; context.fillRect(0, 0, args.width, args.height);
    const tones = colours(args.palette);
    for (const band of bands) {
      const top = point(args, 0, band.base - band.height).y, bottom = point(args, 0, band.base).y;
      const gradient = context.createLinearGradient(0, top, 0, bottom);
      // Opaque at the upper edge so the band reads as the palette colour, then straight to transparent over the ink.
      gradient.addColorStop(0, withAlpha(tones[band.tone]!, 1)); gradient.addColorStop(0.35, withAlpha(tones[band.tone]!, 0.85)); gradient.addColorStop(1, withAlpha(tones[band.tone]!, 0));
      context.fillStyle = gradient;
      context.beginPath();
      band.edge.forEach((y, s) => { const p = point(args, s / (band.edge.length - 1), y); if (s === 0) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y); });
      for (let s = band.edge.length - 1; s >= 0; s--) { const p = point(args, s / (band.edge.length - 1), band.edge[s]! + band.height); context.lineTo(p.x, p.y); }
      context.closePath(); context.fill();
    }
  },
};

/** Every system by id; the studio reads `schema` to build tune controls. */
export const GENERATIVE_SYSTEMS: readonly GenerativeSystem<any, any>[] = [flowField, particles, starfield, meshGradient, halftone, ripples, voronoi, noiseLines, aurora];
export function getGenerativeSystem(id: string): GenerativeSystem<any, any> {
  const system = GENERATIVE_SYSTEMS.find(item => item.id === id);
  if (!system) throw new Error(`Unknown generative system "${id}"; known: ${GENERATIVE_SYSTEMS.map(item => item.id).join(', ')}`);
  return system;
}
/** Where the unit square lands in a width x height canvas: `cover` a centred square of the longer side, `contain` of the shorter, `fill` the whole rectangle. */
export function fitBox(fit: ImageFit, width: number, height: number): {x: number; y: number; width: number; height: number} {
  if (fit === 'fill') return {x: 0, y: 0, width, height};
  const side = (fit === 'cover' ? Math.max : Math.min)(width, height);
  return {x: (width - side) / 2, y: (height - side) / 2, width: side, height: side};
}
/** Paints one frame of `system` into a 2D context; pure in (seed, params, t). Exported so painters can be driven outside React. */
export function paintGenerative(context: CanvasRenderingContext2D, system: GenerativeSystem<any, any>, {seed, params, t, frame, fps, width, height, palette, fit = 'cover'}: {seed: string | number; params?: Params; t: number; frame: number; fps: number; width: number; height: number; palette: Palette; fit?: ImageFit}): void {
  const full = clampParams(system, params), box = fitBox(fit, width, height);
  system.paint(context, {...full, t, frame, fps, seed, width, height, palette, box, unit: Math.max(box.width, box.height)}, system.geometry(seed, full, t));
}

export type GenerativeProps = {
  system: string | GenerativeSystem<any, any>; seed: string | number; width: number; height: number; palette: Palette; params?: Params;
  /** How the unit square maps to the canvas; default `cover`. */ fit?: ImageFit; effects?: EffectsProp; pixelDensity?: number; style?: React.CSSProperties; className?: string;
};
/** A canvas painted by a generative system for the current frame, then passed through `effects`; same frame and seed, same pixels. */
export const Generative = forwardRef<HTMLCanvasElement, GenerativeProps>(function Generative({system, seed, width, height, palette, params, fit = 'cover', effects, pixelDensity = 1, style, className}, ref) {
  validateCanvasSize(width, height, 'Generative'); positive(pixelDensity, 'Generative pixelDensity');
  const resolved = typeof system === 'string' ? getGenerativeSystem(system) : system;
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => canvas.current!, []);
  useLayoutEffect(() => {
    paintCanvas(canvas.current!, {width, height, density: pixelDensity, effects}, context => paintGenerative(context, resolved, {seed, params, t: frame / fps, frame, fps, width, height, palette, fit}));
  });
  return <canvas ref={canvas} width={Math.round(width * pixelDensity)} height={Math.round(height * pixelDensity)} className={className} style={{width, height, ...style}} />;
});
