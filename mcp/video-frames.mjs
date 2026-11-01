import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

/** Inspect only explicitly selected frames of a saved project MP4. */
export async function inspectVideoFrames(projectRoot, video, frames, maxDimension, signal) {
  if (!Array.isArray(frames) || !frames.length || frames.length > 8 || frames.some(frame => !Number.isSafeInteger(frame) || frame < 0 || frame > 1_000_000)) throw new Error('frames must contain 1–8 integers from 0 to 1000000.');
  if (!Number.isInteger(maxDimension) || maxDimension < 64 || maxDimension > 1280) throw new Error('max_dimension must be an integer from 64 to 1280.');
  if (process.platform === 'win32') throw new Error('Saved-video frame inspection requires POSIX openat and /dev/fd support.');
  const script = fileURLToPath(new URL('./video-frames.py', import.meta.url));
  const scratch = await mkdtemp(join(tmpdir(), 'frameforge-video-frames-'));
  try { return await new Promise((resolvePromise, reject) => {
    if (signal?.aborted) return reject(new Error('Video inspection cancelled.'));
    const child = spawn('python3', [script, projectRoot, video, JSON.stringify(frames), String(maxDimension), scratch], {stdio: ['ignore', 'pipe', 'pipe'], detached: true});
    let stdout = '', stderr = '', stopped = '';
    const stop = reason => {
      if (stopped) return;
      stopped = reason;
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    };
    const timer = setTimeout(() => stop('timed out'), 120_000);
    const onAbort = () => stop('cancelled');
    signal?.addEventListener('abort', onAbort, {once: true});
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 20 * 1024 * 1024) stop('output limit exceeded'); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
    child.once('error', error => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (stopped || code !== 0) return reject(new Error(`Video inspection ${stopped || 'failed'}: ${stderr.trim()}`));
      try {
        const report = JSON.parse(stdout);
        resolvePromise({source: report.source, images: report.images.map(image => ({...image, data: Buffer.from(image.data, 'base64')}))});
      } catch { reject(new Error('Invalid video inspection result.')); }
    });
  }); } finally { await rm(scratch, {recursive: true, force: true}); }
}
