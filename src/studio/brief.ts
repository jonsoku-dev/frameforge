export type SceneBand = {from: number; to: number; name: string; detail: string; row: 0 | 1};

const cells = (line: string): string[] => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());

/** First markdown table whose first header cell is "프레임" or "Frames" (5.5). Overlapping rows go to a second row. */
export function sceneBands(brief: string | null): SceneBand[] {
  if (!brief) return [];
  const lines = brief.split('\n');
  const start = lines.findIndex(line => line.trim().startsWith('|') && /^(프레임|Frames)$/i.test(cells(line)[0] ?? ''));
  if (start < 0) return [];
  const bands: SceneBand[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith('|')) break;
    const [range = '', name = '', ...rest] = cells(line);
    const match = /^(\d+)\s*[–—-]\s*(\d+)/.exec(range);
    if (!match) continue;
    const from = Number(match[1]), to = Number(match[2]);
    const overlaps = bands.some(band => band.row === 0 && band.from < to && from < band.to);
    bands.push({from, to, name: name.length > 24 ? `${name.slice(0, 24)}…` : name, detail: [name, ...rest].filter(Boolean).join(' · '), row: overlaps ? 1 : 0});
  }
  return bands;
}

/** Check frames from "## 검사 프레임" / "## Check frames" (first non-empty line) or a "Check frames…:" line (4.6). */
export function checkFrames(brief: string | null, duration: number): number[] {
  let line: string | undefined;
  if (brief) {
    const lines = brief.split('\n');
    const heading = lines.findIndex(item => /^##\s*(검사 프레임|Check frames)\s*$/i.test(item.trim()));
    if (heading >= 0) line = lines.slice(heading + 1).find(item => item.trim());
    else line = lines.find(item => /^Check frames[^:]*:/i.test(item.trim()))?.replace(/^[^:]*:/, '');
  }
  // Prose after the list ("258–322는 …", "키프레임 열여섯 장") starts after the first ". ".
  const list = line?.split(/\.\s/)[0] ?? '';
  const frames = (list.match(/\d+/g) ?? []).map(Number).filter(frame => frame < duration);
  return frames.length ? normalizeFrames(frames) : Array.from({length: 12}, (_, index) => Math.round(index * (duration - 1) / 11));
}

export const normalizeFrames = (frames: number[]): number[] => [...new Set(frames)].sort((a, b) => a - b).slice(0, 40);
