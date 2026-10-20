import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {Easing} from '../../src/core/math';
import * as utils from '../../src/packages/animation-utils';

type Case = {fn: keyof typeof utils; args: unknown[]; value?: unknown; error?: string};
const oracle = JSON.parse(readFileSync(new URL('../../compatibility/animation-utils.json', import.meta.url), 'utf8')) as {cases: Case[]};
const special: Record<string, unknown> = {undefined, NaN, Infinity, '-Infinity': -Infinity};
const decode = (v: unknown) => v !== null && typeof v === 'object' && '$' in v ? special[(v as {$: string}).$] : v;
const easing = (name: unknown) => Easing[name as 'quad'];
const live = (c: Case) => {
  const args = c.args.map(decode);
  const options = args[3] as {easing?: string | string[]} | undefined;
  if (c.fn === 'interpolateStyles' && options?.easing !== undefined) args[3] = {...options, easing: Array.isArray(options.easing) ? options.easing.map(easing) : easing(options.easing)};
  return args;
};

test('animation-utils oracle: every recorded value and error matches exactly', () => {
  assert.ok(oracle.cases.length > 5000);
  for (const c of oracle.cases) {
    const run = () => (utils[c.fn] as (...args: unknown[]) => unknown)(...live(c));
    const name = `${c.fn}(${JSON.stringify(c.args)})`;
    if (c.error !== undefined) assert.throws(run, (e: Error) => e.message === c.error, name);
    else assert.deepEqual(run(), c.value, name);
  }
});

test('skew follows the documented (number, unit, number, unit) form', () => {
  assert.equal(utils.skew(10, 'deg', 20, 'rad'), 'skew(10deg, 20rad)');
  assert.throws(() => utils.skew(NaN, 'deg', 20, 'deg'), /finite/);
});

test('unit strings must be a number followed directly by a unit', () => {
  assert.equal(utils.translateZ('5Q'), 'translateZ(5Q)');
  for (const junk of ['5apx', ' 5px', '.px', '5pxpx']) assert.throws(() => utils.translateX(junk as '5px'), /is not a valid transform/);
});
