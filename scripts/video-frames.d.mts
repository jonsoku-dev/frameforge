export function videoFrameTime(frame: number, fps: number): number;
export function extractVideoFrames(options: {file: string; fps: number; frames: number[]; outDir: string}): Promise<void>;
export function remoteCachePath(root: string, url: string): string;
export function downloadRemote(root: string, url: string): Promise<string>;
export function atempoChain(rate: number): string;
