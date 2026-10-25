#!/usr/bin/env node
// Packs mcpb/ (manifest + a small entry that points at a local engine checkout) into dist/frameforge.mcpb.
import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'dist/frameforge.mcpb');
mkdirSync(join(root, 'dist'), {recursive: true});
rmSync(out, {force: true});
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const args of [['validate', join(root, 'mcpb/manifest.json')], ['pack', join(root, 'mcpb'), out]]) {
  const run = spawnSync(npx, ['-y', '@anthropic-ai/mcpb@2.1.2', ...args], {cwd: root, stdio: 'inherit'});
  if (run.status !== 0) process.exit(run.status ?? 1);
}
console.log(out);
