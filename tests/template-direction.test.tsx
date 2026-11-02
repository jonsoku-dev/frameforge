import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ENGINE, renameTemplate} from '../bin/frameforge.mjs';

test('new film plan preserves creative choices and autonomous authorized work', () => {
  const plan = renameTemplate(readFileSync(join(ENGINE, 'examples/samples/_template/prompt.md'), 'utf8'), 'game-event', 'GameEvent');
  for (const obsolete of ['Google Fonts only', 'four colours', 'never fully still', 'get it confirmed', 'frame-check must PASS', 'Always: slide-like holds']) {
    assert.ok(!plan.includes(obsolete), `new projects must not inherit obsolete restriction: ${obsolete}`);
  }
  assert.match(plan, /licensed local fonts/);
  assert.match(plan, /representative shot/);
  assert.match(plan, /intentional reading holds/);
  assert.match(plan, /user acceptance/);
  const brief = readFileSync(join(ENGINE, 'examples/samples/_template/brief.md'), 'utf8');
  assert.ok(!brief.includes('four colours'));
});

test('starter comments do not override current motion direction', () => {
  const source = readFileSync(join(ENGINE, 'examples/samples/_template/Spot.tsx'), 'utf8');
  assert.ok(!source.includes('four colours at most'));
  assert.ok(!source.includes('never a system font'));
  assert.match(source, /placeholder/);
});
