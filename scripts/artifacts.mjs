import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve, sep} from 'node:path';

/**
 * Writes the `<Artifact>` entries one frame emitted ({filename, encoding: 'utf8' | 'base64', content}) under `outDir`.
 * Files are never overwritten, so a filename emitted on two frames (or left from an earlier render) fails the render.
 */
export async function writeArtifacts(list, outDir) {
  const root = resolve(outDir);
  const written = [];
  for (const {filename, encoding, content} of list) {
    const file = resolve(root, filename);
    if (typeof filename !== 'string' || !file.startsWith(root + sep)) throw new Error(`Artifact filename must stay inside the output folder: ${filename}`);
    if (encoding !== 'utf8' && encoding !== 'base64') throw new Error(`Artifact ${filename} has unknown encoding ${encoding}`);
    await mkdir(dirname(file), {recursive: true});
    await writeFile(file, Buffer.from(content, encoding), {flag: 'wx'}).catch(error => {
      throw error.code === 'EEXIST' ? new Error(`Artifact ${filename} already exists in ${root}; each artifact filename must be unique per render`) : error;
    });
    written.push(file);
  }
  return written;
}
