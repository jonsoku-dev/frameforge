// Removes the links skill-install.mjs made: frameforge-* entries in each agent skill folder that are symlinks into this checkout.
// Real folders and links pointing elsewhere are kept. --dry-run only prints what it would remove.
import {existsSync, lstatSync, readdirSync, readlinkSync, realpathSync, unlinkSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, resolve, sep} from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const roots = [repo, realpathSync(repo)];
const dryRun = process.argv.includes('--dry-run');
const inside = path => roots.some(root => path.startsWith(root + sep));

for (const root of ['.claude', '.codex', '.cursor', '.grok'].map(name => join(homedir(), name, 'skills'))) {
  if (!existsSync(root)) { console.log(`skip ${root} (no such folder)`); continue; }
  for (const name of readdirSync(root).filter(name => name.startsWith('frameforge-'))) {
    const link = join(root, name);
    if (!lstatSync(link).isSymbolicLink()) { console.log(`keep ${link} (not a symlink)`); continue; }
    const target = resolve(root, readlinkSync(link));
    // a broken link has no realpath, so fall back to the recorded target
    const real = existsSync(target) ? realpathSync(target) : target;
    if (!inside(target) && !inside(real)) { console.log(`keep ${link} (points to ${target})`); continue; }
    if (!dryRun) unlinkSync(link);
    console.log(`${dryRun ? 'would remove' : 'removed'} ${link}`);
  }
}
