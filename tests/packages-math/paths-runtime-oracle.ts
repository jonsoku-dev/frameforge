import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';

export type PathOracleCase = {name: string; op: string; args: unknown[]; reference: unknown};
export type PathOracleRuntime = {node: string; v8: string; platform: string; arch: string; mathFingerprint: string};
type Supplement = {historicalFixtureSha256: string; runtime: PathOracleRuntime; cases: Array<PathOracleCase & {historicalReference: unknown}>};
export const pathOracleSupplement = JSON.parse(readFileSync(new URL('../../compatibility/paths-runtime-linux-x64-node24.22.1.json', import.meta.url), 'utf8')) as Supplement;

// Test-environment fingerprint only: no Frameforge outputs participate in selection.
// Probe the semicircle sample grid and the two observed sine-callback differences.
export function pathMathFingerprint(): string {
  const values = [Math.sin(53.125 / 4), Math.sin(72.65625 / 4), Math.cos(Math.PI / 4), Math.sin(Math.PI / 4), Math.acos(-1), Math.acos(0)];
  for (let i = 0; i <= 300; i++) {
    const t = i * (1 / 300);
    for (const start of [0, Math.PI]) {
      const angle = start + Math.PI * t;
      values.push(Math.sin(angle), Math.cos(angle));
    }
  }
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
export function currentPathOracleRuntime(): PathOracleRuntime {
  return {node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch, mathFingerprint: pathMathFingerprint()};
}
export function pathOracleReference(c: PathOracleCase, runtime: PathOracleRuntime): unknown {
  if (!isDeepStrictEqual(runtime, pathOracleSupplement.runtime)) return c.reference;
  const observed = pathOracleSupplement.cases.find(s => s.name === c.name && s.op === c.op && isDeepStrictEqual(s.args, c.args) && isDeepStrictEqual(s.historicalReference, c.reference));
  return observed ? observed.reference : c.reference;
}
