// Symlinks every skills/frameforge-* folder into each agent skill folder that exists on this machine.
import {existsSync, lstatSync, rmSync, symlinkSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
const skills = join(import.meta.dirname, '..', 'skills');
import {readdirSync} from 'node:fs';
for (const root of ['.claude', '.codex', '.cursor', '.grok'].map(name => join(homedir(), name, 'skills'))) {
  if (!existsSync(root)) { console.log(`skip ${root} (no such folder)`); continue; }
  for (const name of readdirSync(skills).filter(name => name.startsWith('frameforge'))) {
    const target = join(root, name);
    if (existsSync(target) || lstatSync(target, {throwIfNoEntry: false})) rmSync(target, {recursive: true, force: true});
    symlinkSync(join(skills, name), target, 'dir');
    console.log(`linked ${target}`);
  }
}
