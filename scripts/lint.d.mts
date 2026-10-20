export interface LintFinding {code: 'wall_clock' | 'unseeded_random' | 'css_time_animation' | 'effect_driven_state'; severity: 'error' | 'warning'; file: string; line: number; message: string; fixHint: string}
export function stripComments(text: string): string;
export function lintEntry(entry: string): {entry: string; files: string[]; findings: LintFinding[]};
