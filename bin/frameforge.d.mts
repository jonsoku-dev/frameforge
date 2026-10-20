export const ENGINE: string;
export function findProject(start: string): {root: string; films: string} | null;
export function filmId(slug: string): string;
export function renameTemplate(text: string, slug: string, id: string): string;
export function addFilm(index: string, slug: string, id: string, entry: string): string;
export function parseArgs(argv: string[]): {command: string; positional: string[]; flags: string[]};
export function main(argv: string[]): number;
