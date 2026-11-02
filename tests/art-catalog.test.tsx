import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';

test('asset catalogue runs through the installed TypeScript loader', () => {
  const result = spawnSync('python3', ['-c', 'import sys; sys.path.insert(0, "scripts/assets"); import art; catalog = art.kit_catalog(); assert art.kit_match({"name": "hero", "intent": "a steaming coffee mug"}, catalog) == "Cup"; print("catalogue ok")'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /catalogue ok/);
});
