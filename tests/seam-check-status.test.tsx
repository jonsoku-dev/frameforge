import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {runChecks} from '../bin/frameforge.mjs';

const engine = resolve(import.meta.dirname, '..');
type Motion = {fps: number; from: number; to: number; samples: Array<{family: string; [key: string]: unknown}>};
const fixture = (name: string): Motion => JSON.parse(readFileSync(join(engine, 'tests/fixtures/seams', `${name}.motion.json`), 'utf8'));

test('seam evidence is preserved in the real check command and its status', {timeout: 60000}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameforge-seam-status-'));
  const video = join(dir, 'video.mp4');
  const sidecar = `${video}.motion.json`;
  const prompt = join(dir, 'prompt.md');
  const cli = (...args: string[]) => spawnSync(process.execPath, [join(engine, 'bin/frameforge.mjs'), 'check', video, '--prompt', prompt, ...args], {cwd: engine, encoding: 'utf8'});
  const set = (motion: unknown, cuts: string) => {
    writeFileSync(sidecar, typeof motion === 'string' ? motion : JSON.stringify(motion));
    writeFileSync(prompt, cuts);
  };
  const seam = () => runChecks(video, {prompt}).find(row => row.check === 'seam-check')!;
  try {
    // A moving, nonflashing video keeps unrelated frame and flash checks passing.
    const encoded = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30', '-t', '2', '-pix_fmt', 'yuv420p', '-y', video], {encoding: 'utf8'});
    assert.equal(encoded.status, 0, encoded.stderr);
    const clean = fixture('clean');
    const noSamples = {...clean, samples: []};

    set(clean, 'Cuts: 30\n');
    assert.equal(seam().status, 'PASS', 'measured, matching camera vectors pass');
    const passCli = cli('--json');
    assert.equal(passCli.status, 0, passCli.stderr);
    assert.equal(JSON.parse(passCli.stdout).find((r: {check: string}) => r.check === 'seam-check').status, 'PASS');

    set(noSamples, 'Cuts: 30\n');
    const noData = seam();
    assert.equal(noData.status, 'WARN');
    assert.match(noData.detail, /seam_no_motion_data/);
    const warnCli = cli('--json');
    assert.equal(warnCli.status, 0, warnCli.stderr);
    assert.equal(JSON.parse(warnCli.stdout).find((r: {check: string}) => r.check === 'seam-check').status, 'WARN');
    const table = cli();
    assert.equal(table.status, 0, table.stderr);
    assert.match(table.stdout, /seam-check\s+WARN\s+.*seam_no_motion_data/);

    set({...clean, samples: clean.samples.map(sample => ({...sample, family: 'card'}))}, 'Cuts: 30\n');
    const noCamera = seam();
    assert.equal(noCamera.status, 'WARN');
    assert.match(noCamera.detail, /seam_unmeasured/);

    set(noSamples, 'Cuts: none\n');
    assert.equal(seam().status, 'SKIP', 'explicit no cuts is intentional, not a measured pass');
    set(noSamples, '# No declared cuts or detectable boundaries\n');
    assert.equal(seam().status, 'WARN', 'no evidence of a boundary is not a pass');

    set(clean, 'Cuts: 5,55\n');
    assert.equal(seam().status, 'SKIP', 'both cut windows extend outside the render');
    set(clean, 'Cuts: 30,55\n');
    assert.equal(seam().status, 'WARN', 'a measured seam does not hide another skipped seam');

    set(fixture('mirrored'), 'Cuts: 30\n');
    assert.equal(seam().status, 'FAIL');
    const failure = cli('--json');
    assert.equal(failure.status, 1, failure.stderr);
    assert.equal(JSON.parse(failure.stdout).find((r: {check: string}) => r.check === 'seam-check').status, 'FAIL');

    set('{invalid JSON', 'Cuts: 30\n');
    assert.equal(seam().status, 'FAIL', 'an unreadable sidecar is an error, not a warning or skip');
    assert.equal(cli('--json').status, 1);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
