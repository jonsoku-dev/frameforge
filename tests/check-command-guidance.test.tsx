import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ENGINE} from '../bin/frameforge.mjs';

const command = readFileSync(join(ENGINE, 'commands/check.md'), 'utf8');
test('check command loads the review skill before numeric diagnostics', () => {
  const skill = command.indexOf('`read_skill` with `name: "frameforge-check"`');
  const check = command.indexOf('MCP tool `check`');
  assert.ok(skill >= 0 && skill < check, 'review guidance must be unconditional, not only inside a FAIL branch');
});
test('all-PASS diagnostics cannot bypass creative review or user rejection', () => {
  assert.match(command, /even when every numeric row is PASS/);
  assert.match(command, /user.*rejection/i);
  assert.match(command, /playback.*listening/i);
  assert.match(command, /MET, UNMET or NOT VERIFIED/);
  assert.match(command, /permission to generate assets or render/i);
});
