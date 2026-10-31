import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
// @ts-expect-error the renderer is plain ESM without types
import {renderMedia} from '../scripts/render.mjs';

const engine = resolve(import.meta.dirname, '..');

test('renderMedia validates requested idempotency frames before opening a browser', async () => {
  const base = {serveUrl: 'http://127.0.0.1:1', composition: 'Stable', outputLocation: 'unused.mp4'};
  await assert.rejects(renderMedia({...base, idempotentFrames: [0]}), /requires checkIdempotent/);
  for (const idempotentFrames of [[], [-1], [1.5], [NaN], ['30']]) {
    await assert.rejects(renderMedia({...base, checkIdempotent: true, idempotentFrames}), /idempotentFrames/);
  }
});

test('render checks the requested idempotency frames and reports the exact coverage', {timeout: 240000}, () => {
  const project = mkdtempSync(join(tmpdir(), 'frameforge-idempotent-'));
  const port = String(20000 + process.pid % 20000);
  const entry = join(project, 'entry.tsx');
  mkdirSync(join(project, 'public'));
  writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine, films: 'films'}));
  symlinkSync(join(engine, 'node_modules'), join(project, 'node_modules'), 'dir');
  // Frame 11 carries deliberately unsafe state, while the other frames are
  // stable. A first/middle/last-only check of this 60-frame film misses it.
  writeFileSync(entry, `
import {Composition, registerRoot, useCurrentFrame} from 'frameforge';
let visits = 0;
function Stable() { const frame = useCurrentFrame(); return <div style={{width:128,height:128,background:'white',color:'black',fontSize:60}}>{frame}</div>; }
function Unstable() { const frame = useCurrentFrame(); if (frame === 11) visits++; return <div style={{width:128,height:128,background:'white',color:'black',fontSize:60}}>{frame === 11 ? visits : frame}</div>; }
registerRoot(() => <><Composition id="Stable" component={Stable} durationInFrames={60} fps={30} width={128} height={128}/><Composition id="Unstable" component={Unstable} durationInFrames={60} fps={30} width={128} height={128}/></>);
`);
  let outputNumber = 0;
  const run = (composition: string, ...options: string[]) => spawnSync(process.execPath, [
    join(engine, 'scripts/render.mjs'), entry, composition, join(project, `out-${outputNumber++}.mp4`),
    '--muted', ...options,
  ], {cwd: engine, env: {...process.env, FRAMEFORGE_PROJECT: project, FRAMEFORGE_PORT: port}, encoding: 'utf8', timeout: 90000});
  const result = (stdout: string) => {
    const start = stdout.lastIndexOf('\n{\n');
    assert.notEqual(start, -1, `missing render result: ${stdout}`);
    return JSON.parse(stdout.slice(start));
  };
  try {
    const baseline = run('Unstable', '--check-idempotent');
    assert.equal(baseline.status, 0, baseline.stderr);
    assert.equal(result(baseline.stdout).idempotent, true);
    assert.deepEqual(result(baseline.stdout).idempotentFrames, [0, 30, 59]);

    // The extra sample is not first, middle, or last: checking only three
    // chosen positions would incorrectly accept this film.
    const changed = run('Unstable', '--check-idempotent', '--idempotent-frames', '0,11,30,59');
    assert.notEqual(changed.status, 0, changed.stdout);
    assert.match(changed.stderr, /frame_not_idempotent: frame 11/);

    const stable = run('Stable', '--check-idempotent', '--idempotent-frames', '30,11,0,11,59');
    assert.equal(stable.status, 0, stable.stderr);
    assert.equal(result(stable.stdout).idempotent, true);
    assert.deepEqual(result(stable.stdout).idempotentFrames, [30, 11, 0, 59]);

    const missingCheck = run('Stable', '--idempotent-frames', '0,11');
    assert.notEqual(missingCheck.status, 0, missingCheck.stdout);
    assert.match(missingCheck.stderr, /--check-idempotent/);
    const outsideRange = run('Stable', '--frame-range', '5-15', '--check-idempotent', '--idempotent-frames', '0,11');
    assert.notEqual(outsideRange.status, 0, outsideRange.stdout);
    assert.match(outsideRange.stderr, /idempotent.frames|idempotentFrames/i);
    for (const value of ['', '0,,11', '1.5', '-1', '60', 'x']) {
      const invalid = run('Stable', '--check-idempotent', '--idempotent-frames', value);
      assert.notEqual(invalid.status, 0, `accepted invalid sample ${JSON.stringify(value)}: ${invalid.stdout}`);
      assert.match(invalid.stderr, /idempotent.frames|idempotentFrames/i);
    }
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
});
