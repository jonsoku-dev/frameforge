import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, mkdtempSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ENGINE} from '../bin/frameforge.mjs';

test('skill:uninstall removes only frameforge-* links into this checkout, and --dry-run removes nothing', () => {
  const home = mkdtempSync(join(tmpdir(), 'ff-uninstall-'));
  const skills = join(home, '.claude/skills');
  mkdirSync(skills, {recursive: true});
  const elsewhere = mkdtempSync(join(tmpdir(), 'ff-elsewhere-'));
  symlinkSync(join(ENGINE, 'skills/frameforge-create'), join(skills, 'frameforge-create'), 'dir');
  symlinkSync(elsewhere, join(skills, 'frameforge-other'), 'dir');
  mkdirSync(join(skills, 'frameforge-mine'));
  symlinkSync(join(ENGINE, 'skills/frameforge-render'), join(skills, 'unrelated'), 'dir');
  const run = (...args: string[]) => spawnSync(process.execPath, [join(ENGINE, 'scripts/skill-uninstall.mjs'), ...args], {env: {...process.env, HOME: home}, encoding: 'utf8'});

  const dry = run('--dry-run');
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /would remove .*frameforge-create/);
  assert.ok(lstatSync(join(skills, 'frameforge-create')).isSymbolicLink(), 'dry run keeps the link');

  const real = run();
  assert.equal(real.status, 0, real.stderr);
  assert.equal(lstatSync(join(skills, 'frameforge-create'), {throwIfNoEntry: false}), undefined, 'link into the checkout is gone');
  assert.ok(existsSync(join(ENGINE, 'skills/frameforge-create/SKILL.md')), 'the skill itself is untouched');
  assert.ok(lstatSync(join(skills, 'frameforge-other')).isSymbolicLink(), 'link elsewhere is kept');
  assert.ok(lstatSync(join(skills, 'frameforge-mine')).isDirectory(), 'real folder is kept');
  assert.ok(lstatSync(join(skills, 'unrelated')).isSymbolicLink(), 'other names are kept');
  assert.match(real.stdout, /skip .*\.codex\/skills/);
});
