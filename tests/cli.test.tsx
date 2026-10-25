import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {addFilm, ENGINE, filmId, findProject, parseArgs, renameTemplate} from '../bin/frameforge.mjs';

test('findProject walks up to frameforge.json and reads its films folder', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ff-cli-')));
  writeFileSync(join(root, 'frameforge.json'), JSON.stringify({engine: ENGINE, films: 'videos'}));
  mkdirSync(join(root, 'videos/a/b'), {recursive: true});
  assert.deepEqual(findProject(join(root, 'videos/a/b')), {root, films: join(root, 'videos')});
  assert.equal(findProject(ENGINE), null, 'the engine checkout has no frameforge.json, so commands use examples/samples');
});

test('filmId turns a slug into a composition id that starts with a letter', () => {
  assert.equal(filmId('demo-spot'), 'DemoSpot');
  assert.equal(filmId('intro'), 'Intro');
  assert.equal(filmId('3d-reel'), 'Film3dReel');
});

test('renameTemplate applies every rename the template brief lists to the shipped template', () => {
  const dir = join(ENGINE, 'examples/samples/_template');
  const spot = renameTemplate(readFileSync(join(dir, 'Spot.tsx'), 'utf8'), 'demo-spot', 'DemoSpot');
  assert.ok(spot.includes('export function DemoSpot()') && !spot.includes('TemplateSpot'));
  assert.ok(spot.includes('/audio/generated/demo-spot/music.wav') && !spot.includes('/audio/generated/template/'));
  const entry = renameTemplate(readFileSync(join(dir, 'entry.tsx'), 'utf8'), 'demo-spot', 'DemoSpot');
  assert.ok(entry.includes('id="DemoSpot" component={DemoSpot}'));
  assert.equal(JSON.parse(renameTemplate(readFileSync(join(dir, 'template.audio.json'), 'utf8'), 'demo-spot', 'DemoSpot')).slug, 'demo-spot');
  assert.match(renameTemplate(readFileSync(join(dir, 'prompt.md'), 'utf8'), 'demo-spot', 'DemoSpot'), /^# demo-spot$/m);
  assert.match(renameTemplate(readFileSync(join(dir, 'brief.md'), 'utf8'), 'demo-spot', 'DemoSpot'), /^# demo-spot$/m);
});

test('addFilm adds one import and one Composition line and keeps existing films', () => {
  const index = "import {Composition, registerRoot} from 'frameforge';\n\nregisterRoot(() => <>\n</>);\n";
  const tag = '<Composition id="DemoSpot" component={DemoSpot} durationInFrames={600} fps={30} width={1920} height={1080} />';
  const once = addFilm(index, 'demo-spot', 'DemoSpot', `registerRoot(() => ${tag});`);
  const twice = addFilm(once, 'second', 'Second', 'registerRoot(() => <Composition id="Second" component={Second} durationInFrames={90} fps={30} width={1080} height={1080} />);');
  assert.equal(twice, `import {Composition, registerRoot} from 'frameforge';\nimport {DemoSpot} from './demo-spot/Spot';\nimport {Second} from './second/Spot';\n\nregisterRoot(() => <>\n  ${tag}\n  <Composition id="Second" component={Second} durationInFrames={90} fps={30} width={1080} height={1080} />\n</>);\n`);
  assert.throws(() => addFilm('registerRoot(() => <A />);', 'x', 'X', `registerRoot(() => ${tag});`), /must end with/);
});

test('parseArgs keeps positionals up to the first flag and passes flags on verbatim', () => {
  assert.deepEqual(parseArgs(['render', 'demo-spot', 'DemoSpot', 'out.mp4', '--frame-range', '0-59', '--pipe']), {command: 'render', positional: ['demo-spot', 'DemoSpot', 'out.mp4'], flags: ['--frame-range', '0-59', '--pipe']});
  assert.deepEqual(parseArgs(['studio', '--port', '4330']), {command: 'studio', positional: [], flags: ['--port', '4330']});
  assert.deepEqual(parseArgs([]), {command: 'help', positional: [], flags: []});
});
