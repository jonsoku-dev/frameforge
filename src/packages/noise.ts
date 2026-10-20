import {random} from '../core/math';
// Simplex noise after Gustavson, "Simplex noise demystified" (2005), with a per-seed permutation table.
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3, G3 = 1 / 6;
const F4 = (Math.sqrt(5) - 1) / 4, G4 = (5 - Math.sqrt(5)) / 20;
const grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
const grad4: number[][] = [];
for (const z of [0, 1, 2, 3]) for (const a of [1, -1]) for (const b of [1, -1]) for (const c of [1, -1]) {
  const v = [a, b, c]; v.splice(z, 0, 0); grad4.push(v);
}
// Int32 floor: coordinates outside ±2^31 wrap and come out 0, as the reference does.
const floor = (v: number) => Math.floor(v) | 0;
const tables = [new Map<string | number, Uint8Array>(), new Map<string | number, Uint8Array>()];
// 2D shuffles with random(seed), 3D and 4D with random(random(seed)); the value is constant across shuffle steps.
const permutation = (seed: string | number, rehash: 0 | 1): Uint8Array => {
  let p = tables[rehash].get(seed);
  if (p) return p;
  const r = rehash ? random(random(seed)) : random(seed);
  p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 0; i < 255; i++) { const j = i + ~~(r * (256 - i)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 256; i < 512; i++) p[i] = p[i - 256];
  tables[rehash].set(seed, p);
  return p;
};
const corner = (t: number, g: number[], d: number[]): number => {
  if (t < 0) return 0;
  let dot = 0;
  for (let k = 0; k < d.length; k++) dot += g[k] * d[k];
  return t * t * t * t * dot;
};
export const noise2D = (seed: string | number, x: number, y: number): number => {
  const p = permutation(seed, 0);
  const s = (x + y) * F2, i = floor(x + s), j = floor(y + s), t = (i + j) * G2;
  const x0 = x - (i - t), y0 = y - (j - t);
  const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  // Unlike 3D and 4D, a NaN falloff counts as outside here, so NaN input yields 0 rather than NaN.
  const c = (dx: number, dy: number, a: number, b: number) => { const t = 0.5 - dx * dx - dy * dy; return t >= 0 ? corner(t, grad3[p[ii + a + p[jj + b]] % 12], [dx, dy]) : 0; };
  return 70 * (c(x0, y0, 0, 0) + c(x1, y1, i1, j1) + c(x2, y2, 1, 1));
};
// Shared by 3D and 4D: sort the offsets to pick the simplex, then sum the corner contributions.
const simplex = (p: Uint8Array, v: number[], F: number, G: number, grads: number[][], radius: number, scale: number): number => {
  const n = v.length, s = v.reduce((a, b) => a + b, 0) * F;
  const cell = v.map(c => floor(c + s));
  const t = cell.reduce((a, b) => a + b, 0) * G;
  const d0 = v.map((c, k) => c - (cell[k] - t));
  // Equal offsets rank the earlier axis higher in 3D and the later axis higher in 4D, as the reference does.
  const rank = d0.map((a, k) => d0.reduce((r, b, m) => r + (m !== k && (a > b || (a === b && (n === 4 ? k > m : k < m))) ? 1 : 0), 0));
  const wrapped = cell.map(c => c & 255);
  let sum = 0;
  for (let c = 0; c <= n; c++) {
    const off = rank.map(r => (r >= n - c ? 1 : 0));
    const d = d0.map((a, k) => a - off[k] + c * G);
    let h = 0;
    for (let k = n - 1; k >= 0; k--) h = p[wrapped[k] + off[k] + h];
    sum += corner(radius - d.reduce((a, b) => a + b * b, 0), grads[h % grads.length], d);
  }
  return scale * sum;
};
export const noise3D = (seed: string | number, x: number, y: number, z: number): number =>
  simplex(permutation(seed, 1), [x, y, z], F3, G3, grad3, 0.6, 32);
export const noise4D = (seed: string | number, x: number, y: number, z: number, w: number): number =>
  simplex(permutation(seed, 1), [x, y, z, w], F4, G4, grad4, 0.6, 27);
