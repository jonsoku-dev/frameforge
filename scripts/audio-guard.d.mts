export function externalProject(engine: string): boolean;
export function rejectSharedAudio(engine: string, file: string): void;
export function projectPublicMedia(engine: string, src: string): string | null;
export function viteFsPath(path: string): string;
export const PROJECT_MEDIA_TYPES: Readonly<Record<string, string>>;
