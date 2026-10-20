export function writeArtifacts(list: {filename: string; encoding: 'utf8' | 'base64'; content: string}[], outDir: string): Promise<string[]>;
