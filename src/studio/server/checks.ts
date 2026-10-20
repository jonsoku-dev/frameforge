import {spawn} from 'node:child_process';
import {join} from 'node:path';

type Output = {code: number | null; stdout: string; stderr: string};
export type CheckResult = {name: 'flash' | 'frame' | 'loudness' | 'colorSpace'; pass: boolean; summary: string; metrics: Record<string, unknown>; raw: string};

/** Runs a program with an argument array and no shell (7.1). */
export function exec(command: string, args: string[], cwd: string, onLine?: (line: string) => void): Promise<Output> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {cwd, stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '';
    child.stdout.on('data', part => { stdout += part; });
    child.stderr.on('data', part => {
      stderr = (stderr + part).slice(-200000);
      if (onLine) for (const line of String(part).split('\n')) if (line.trim()) onLine(line.trim());
    });
    child.on('error', reject);
    child.on('close', code => resolveRun({code, stdout, stderr}));
  });
}

const json = (text: string): Record<string, unknown> => {
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; }
};
const ffmpeg = () => process.env.FFMPEG_PATH || 'ffmpeg';

/** The four post-render checks of spec 5.1, in order. Text clipping is already enforced by the render itself. */
export async function runChecks(root: string, mp4: string, fps: number, loudnessTarget: {I: number; TP: number}, onLine: (line: string) => void, onCheck: (result: CheckResult) => void): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const push = (result: CheckResult) => { results.push(result); onCheck(result); };

  const flash = await exec(process.execPath, [join(root, 'scripts/flash-check.mjs'), mp4, String(fps)], root, onLine);
  const f = json(flash.stdout);
  push({name: 'flash', pass: f.pass === true, summary: `최악 1초 ${String(f.worstSecondTransitions ?? '?')}회 / 허용 6`, metrics: {pass: f.pass === true, worstSecondStartFrame: f.worstSecondStartFrame, worstSecondTransitions: f.worstSecondTransitions}, raw: flash.stdout});

  const frame = await exec(process.execPath, [join(root, 'scripts/frame-check.mjs'), mp4, '--fps', String(fps), '--json'], root, onLine);
  const r = json(frame.stdout);
  const fails = Array.isArray(r.fails) ? r.fails as string[] : [];
  push({name: 'frame', pass: r.pass === true, summary: r.pass === true ? '빈 구간, 긴 정지 없음' : fails.join(' · ') || '검사 실패', metrics: {pass: r.pass === true, emptyRanges: r.emptyRanges ?? [], staticRuns: r.staticRuns ?? [], huddledShare: r.huddledShare, fails}, raw: frame.stdout});

  const loud = await exec(ffmpeg(), ['-hide_banner', '-nostats', '-i', mp4, '-af', 'ebur128=peak=true', '-f', 'null', '-'], root);
  const summary = loud.stderr.slice(loud.stderr.lastIndexOf('Summary:'));
  const pick = (pattern: RegExp) => { const match = pattern.exec(summary); return match ? Number(match[1]) : undefined; };
  const I = pick(/I:\s+(-?[\d.]+) LUFS/), TP = pick(/Peak:\s+(-?[\d.]+|-inf) dBFS/), LRA = pick(/LRA:\s+(-?[\d.]+) LU/);
  if (I !== undefined && Number.isFinite(I)) {
    const pass = Math.abs(I - loudnessTarget.I) <= 2 && (TP ?? -Infinity) <= loudnessTarget.TP;
    push({name: 'loudness', pass, summary: `${I.toFixed(1)} LKFS · TP ${TP?.toFixed(1) ?? '?'}${pass ? '' : `, 목표 ${loudnessTarget.I} ±2 밖`}`, metrics: {pass, I, TP, LRA, target: loudnessTarget}, raw: summary});
  }

  const probe = await exec(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_space', '-of', 'default=nw=1:nk=1', mp4], root);
  const value = probe.stdout.trim();
  push({name: 'colorSpace', pass: value === 'bt709', summary: value === 'bt709' ? 'bt709' : '색 태그 없음. 디코드하면 색이 어두워집니다', metrics: {pass: value === 'bt709', value}, raw: probe.stdout});
  return results;
}
