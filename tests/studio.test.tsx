import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {checkFrames, sceneBands} from '../src/studio/brief';
// @ts-expect-error the renderer is plain ESM without types
import {sfxFault} from '../scripts/render.mjs';
import {playbackBlocker} from '../src/studio/state';
import {applicableOverrides, describeChanges, minimalOverrides, openRequests, parseProcess, parseVariables, resolutions, versions} from '../src/studio/model';

const brief = (slug: string) => readFileSync(slug === 'youtube-intro' ? 'tests/fixtures/brief-youtube-intro.md' : `examples/samples/${slug}/prompt.md`, 'utf8');

test('scene bands read en dash and hyphen ranges and stack overlaps on a second row', () => {
  const saas = sceneBands(brief('saas-launch'));
  assert.deepEqual(saas.slice(0, 2).map(band => [band.from, band.to, band.row]), [[0, 150, 0], [126, 150, 1]]);
  assert.deepEqual(sceneBands(brief('youtube-intro'))[0]!.from, 0);
  assert.equal(sceneBands(brief('youtube-intro'))[0]!.to, 75);
  assert.deepEqual(sceneBands('no table here'), []);
});

test('check frames come from the heading, the inline line, or twelve even splits', () => {
  assert.equal(checkFrames(brief('saas-launch'), 900).length, 16);
  assert.deepEqual(checkFrames(brief('youtube-intro'), 900), [40, 110, 200, 270, 340, 400, 480, 560, 640, 760, 880]);
  assert.deepEqual(checkFrames(brief('podcast-promo'), 450).at(-1), 449);
  assert.ok(!checkFrames(brief('podcast-promo'), 450).includes(258), 'prose after the list is ignored');
  assert.deepEqual(checkFrames('# x', 12), Array.from({length: 12}, (_, index) => index));
});

test('versions count author and fix runs; a later fix resolves requests and findings', () => {
  const log = parseProcess({brief: 'prompt.md', runs: [
    {id: 'r01', at: '', actor: 'a', kind: 'author', summary: 's', artifacts: []},
    {id: 'r02', at: '', actor: 'b', kind: 'review', summary: 's', artifacts: [], findings: [{id: 'r02-1', from: 0, text: 't'}]},
    {id: 'r03', at: '', actor: 'human', kind: 'request', summary: 's', frame: 3, prompt: {text: 't'}, artifacts: []},
    {id: 'r04', at: '', actor: 'a', kind: 'fix', summary: 's', resolves: ['r02-1'], artifacts: []},
  ]})!;
  assert.deepEqual(versions(log.runs), [1, 1, 1, 2]);
  assert.equal(resolutions(log.runs).get('r02-1'), 2);
  assert.deepEqual(openRequests(log.runs).map(run => run.id), ['r03']);
});

test('overrides keep only declared, well-typed, non-default values', () => {
  const variables = parseVariables([
    {key: 'accent', type: 'color', label: '강조색', default: '#FF5A36'},
    {key: 'shift', type: 'number', label: '이동', default: 0, min: -6, max: 6, step: 1, unit: 'frames'},
  ]);
  assert.deepEqual(applicableOverrides(variables, {accent: '#F0532F', shift: 'a', old: 1}), {values: {accent: '#F0532F'}, ignored: ['shift', 'old']});
  assert.deepEqual(minimalOverrides(variables, {accent: '#FF5A36', shift: -2}), {shift: -2});
  assert.deepEqual(describeChanges(variables, {}, {accent: '#F0532F'}), ['강조색 #FF5A36 → #F0532F']);
});

test('sfxFault flags stacked or dense sound effects and passes spaced ones', () => {
  assert.equal(sfxFault([30, 120, 300, 480], 30), null);
  assert.match(sfxFault([30, 40], 30) ?? '', /0\.33 s apart at 1\.00 s/);
  assert.match(sfxFault([30, 30], 30) ?? '', /0\.00 s apart/);
  assert.match(sfxFault([30, 60, 90, 120], 30) ?? '', /Four sound effects within 4 s from 1\.00 s/);
  assert.equal(sfxFault([], 30), null);
});

test('playback stays blocked until every delayPlayback handle is released, and a second unblock is ignored', () => {
  let open = 0;
  const {delayPlayback} = playbackBlocker(delta => { open += delta; });
  const first = delayPlayback(), second = delayPlayback();
  assert.equal(open, 2);
  first.unblock(); first.unblock();
  assert.equal(open, 1);
  second.unblock();
  assert.equal(open, 0);
});
