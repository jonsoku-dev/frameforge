import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Static determinism lint over an entry's own import graph. Only relative imports are followed: `frameforge`, `@/` and packages
// are the engine and libraries, whose timers (delayRender timeouts, the studio clock) are not composition code.
// shortcut: whole files are scanned, not only component bodies; a module-level Date.now() differs per Chrome in a parallel render anyway.
const project = fileURLToPath(new URL('../', import.meta.url));
const SOURCE = ['.tsx', '.ts', '.jsx', '.js', '.mjs'];
const CSS_TIME = /(?:\b(?:transition|animation)(?:[A-Z]\w*|-[a-z-]+)?\s*:(?!\s*['"`]?none\b)|@keyframes\b)/;
const CODE_RULES = [
  {pattern: /\bMath\.random\s*\(/, code: 'unseeded_random', severity: 'error', message: 'Math.random() returns a different value on every render and in every Chrome.', fixHint: "Use random('a-stable-seed') from frameforge; the same seed gives the same value on every render."},
  {pattern: /\bDate\.now\s*\(/, code: 'wall_clock', severity: 'error', message: 'Date.now() reads the wall clock, so the frame depends on when it was rendered.', fixHint: 'Derive time from useCurrentFrame() / fps.'},
  {pattern: /\bnew\s+Date\s*\(\s*\)/, code: 'wall_clock', severity: 'error', message: 'new Date() reads the wall clock, so the frame depends on when it was rendered.', fixHint: "Use a fixed date such as new Date('2026-01-01T00:00:00Z'), or pass the date as an input prop."},
  {pattern: /\bperformance\.now\s*\(/, code: 'wall_clock', severity: 'error', message: 'performance.now() reads the wall clock, so the frame depends on render speed.', fixHint: 'Derive time from useCurrentFrame() / fps.'},
  {pattern: /\brequestAnimationFrame\s*\(/, code: 'wall_clock', severity: 'error', message: 'requestAnimationFrame animates on the browser clock; the renderer captures frames out of real time.', fixHint: 'Compute the value for the current frame with interpolate() or spring() from useCurrentFrame().'},
  {pattern: /\bsetInterval\s*\(/, code: 'wall_clock', severity: 'error', message: 'setInterval advances on the wall clock, not the frame.', fixHint: 'Compute the value for the current frame from useCurrentFrame().'},
  {pattern: /\bsetTimeout\s*\(/, code: 'wall_clock', severity: 'warning', message: 'setTimeout runs on the wall clock; anything it changes on screen differs between renders.', fixHint: 'Use it only around delayRender/continueRender for loading; animate from useCurrentFrame().'},
  {pattern: CSS_TIME, code: 'css_time_animation', severity: 'error', message: 'CSS transitions and animations run on the browser clock, so captured frames flicker or freeze.', fixHint: 'Drive the property from useCurrentFrame() with interpolate() or spring() and remove the transition/animation.'},
];

/** Replaces comments with spaces (newlines kept) so rules never match commented-out code; strings stay, CSS-in-JS lives there.
 * shortcut: regex literals and JSX text apostrophes are read as quotes; a ' or " quote ends at the line break, so a misread costs one line. Use a real tokenizer if that bites. */
export function stripComments(text) {
  let out = '', quote = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (quote) { out += char; if (char === '\\') out += text[++i] ?? ''; else if (char === quote || (char === '\n' && quote !== '`')) quote = null; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; out += char; continue; }
    if (char === '/' && next === '/') { while (i < text.length && text[i] !== '\n') { out += ' '; i++; } out += text[i] ?? ''; continue; }
    if (char === '/' && next === '*') { const end = text.indexOf('*/', i + 2); const stop = end < 0 ? text.length : end + 2; out += text.slice(i, stop).replace(/[^\n]/g, ' '); i = stop - 1; continue; }
    out += char;
  }
  return out;
}

function resolveImport(from, specifier) {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [base, ...SOURCE.map(ext => base + ext), ...SOURCE.map(ext => resolve(base, 'index' + ext))]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** States set inside useEffect/useLayoutEffect bodies that never hold the render (no delayRender/continueRender in the body). */
function effectFindings(code, file) {
  const setters = [...code.matchAll(/\[\s*\w+\s*,\s*(set\w+)\s*\]\s*=\s*(?:React\.)?useState\b/g)].map(match => match[1]);
  if (!setters.length) return [];
  const findings = [];
  for (const match of code.matchAll(/\buse(?:Layout)?Effect\s*\(/g)) {
    let depth = 0, end = match.index + match[0].length - 1;
    for (; end < code.length; end++) { if (code[end] === '(') depth++; else if (code[end] === ')' && --depth === 0) break; }
    const body = code.slice(match.index, end);
    const setter = setters.find(name => new RegExp(`\\b${name}\\s*\\(`).test(body));
    if (!setter || /\b(?:delayRender|continueRender|cancelRender|useDelayRender)\b|\.continue\s*\(/.test(body)) continue;
    findings.push({code: 'effect_driven_state', severity: 'warning', file, line: code.slice(0, match.index).split('\n').length, message: `${setter}() runs in an effect, after the frame is drawn, so the captured frame may show the previous state.`, fixHint: 'Compute the value during render from useCurrentFrame(); if it must load, hold the frame with delayRender() and call continueRender() after setting state.'});
  }
  return findings;
}

/** Scans `entry` and every file it reaches through relative imports. */
export function lintEntry(entry) {
  const findings = [], seen = new Set(), queue = [resolve(entry)];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const name = relative(project, file);
    const text = readFileSync(file, 'utf8');
    const css = extname(file) === '.css';
    const code = css ? text.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' ')) : stripComments(text);
    for (const [index, line] of code.split('\n').entries()) {
      for (const rule of css ? CODE_RULES.filter(rule => rule.code === 'css_time_animation') : CODE_RULES) {
        if (rule.pattern.test(line)) findings.push({code: rule.code, severity: rule.severity, file: name, line: index + 1, message: rule.message, fixHint: rule.fixHint});
      }
    }
    if (css) continue;
    findings.push(...effectFindings(code, name));
    for (const [, specifier] of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)) {
      if (!specifier.startsWith('.')) continue;
      const target = resolveImport(file, specifier);
      if (target && !target.includes('/node_modules/')) queue.push(target);
    }
  }
  return {entry: relative(project, resolve(entry)), files: [...seen].map(file => relative(project, file)), findings};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entry = process.argv[2];
  if (!entry || !existsSync(entry)) { console.error('usage: npm run lint:video -- <entry.tsx>'); process.exit(2); }
  const report = lintEntry(entry);
  console.log(JSON.stringify(report, null, 1));
  if (report.findings.some(finding => finding.severity === 'error')) process.exitCode = 1;
}
