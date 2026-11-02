import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {arch, cpus, platform, release} from 'node:os';
import {join} from 'node:path';

/** Test-only diagnostics: never create artifacts for a matching render. */
export function preserveRendererMismatchEvidence(pairs: {filename: string; before: Buffer; after: Buffer}[], evidenceRoot: string, context: () => Record<string, unknown> = () => ({})): void {
  const mismatchedNames = pairs.filter(({before, after}) => !after.equals(before)).map(({filename}) => filename);
  if (mismatchedNames.length === 0) return;
  try {
    mkdirSync(evidenceRoot, {recursive: true});
    const directory = mkdtempSync(join(evidenceRoot, `renderer-test-evidence-${Date.now()}-${process.pid}-`));
    const digest = (buffer: Buffer) => ({bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex')});
    const comparisons = pairs.map(({filename, before, after}, index) => {
      const beforeFile = `${index}-before.png`, afterFile = `${index}-after.png`;
      writeFileSync(join(directory, beforeFile), before);
      writeFileSync(join(directory, afterFile), after);
      return {filename, before: {...digest(before), file: beforeFile}, after: {...digest(after), file: afterFile}};
    });
    writeFileSync(join(directory, 'metadata.json'), JSON.stringify({
      mismatchedNames,
      capturedAt: new Date().toISOString(),
      comparisons,
      runtime: {node: process.version, versions: process.versions, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, cpuCount: cpus().length},
      context: context(),
    }, null, 2) + '\n');
    console.error(`Renderer test failure evidence: ${directory}`);
  } catch (captureError) {
    // The caller's original strict assertion must still run if diagnostic I/O fails.
    console.error('Unable to preserve renderer test failure evidence:', captureError);
  }
}
