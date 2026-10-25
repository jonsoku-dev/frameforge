import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

// A 1 s, 30 fps clip alternating two grey levels every 3 frames: five opposing pairs if every change counted.
const flicker = (dir: string, a: number, b: number) => {
  const out = join(dir, `flicker-${a}-${b}.mp4`);
  const hex = (v: number) => v.toString(16).padStart(2, '0').repeat(3);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x${hex(a)}:s=160x90:r=30:d=1`, '-f', 'lavfi', '-i', `color=c=0x${hex(b)}:s=160x90:r=30:d=1`,
    '-filter_complex', '[0][1]blend=all_expr=if(mod(floor(N/3)\\,2)\\,B\\,A),format=yuv420p', '-c:v', 'libx264', '-qp', '0', out]);
  return out;
};
const flashes = (file: string) => JSON.parse(spawnSync('node', ['scripts/flash-check.mjs', file], {encoding: 'utf8'}).stdout).worstSecondFlashes as number;

test('flash-check counts relative luminance, not raw grey codes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flash-'));
  try {
    assert.equal(flashes(flicker(dir, 20, 60)), 0, 'a dark-range flicker is under 0.1 relative luminance');
    assert.ok(flashes(flicker(dir, 0, 255)) > 3, 'a black/white flicker fails');
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
