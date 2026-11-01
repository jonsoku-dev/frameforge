import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

test('Blender engine selection supports both EEVEE identifiers and preserves Cycles', () => {
  const run = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, 'scripts/assets')
from blender_scene import set_render_engine
class Render:
    def __init__(self, allowed): self.allowed = allowed; self.value = None
    @property
    def engine(self): return self.value
    @engine.setter
    def engine(self, value):
        if value not in self.allowed: raise TypeError('unsupported engine: ' + value)
        self.value = value
for expected in ['BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT']:
    r = Render({expected}); set_render_engine(r, 'eevee'); assert r.engine == expected
r = Render({'CYCLES'}); set_render_engine(r, 'cycles'); assert r.engine == 'CYCLES'
try: set_render_engine(Render(set()), 'eevee')
except TypeError: pass
else: raise AssertionError('unsupported EEVEE must fail')
`], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
});

test('Blender subprocess makes Python failures nonzero and preserves stderr', () => {
  const run = spawnSync('python3', ['-c', `
import sys, io, contextlib
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, 'scripts/assets')
import blender
with patch.object(blender.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stdout='', stderr='fixture Python exception')) as mocked:
    error = io.StringIO()
    with contextlib.redirect_stderr(error):
        try: blender.run_blender('blender', 'fixture.json', {'name':'hero'}, '/tmp/test', 0, 0)
        except SystemExit as e: assert e.code == 1
        else: raise AssertionError('must fail')
    args = mocked.call_args.args[0]
    assert args.index('--python-exit-code') < args.index('--python')
    assert args[args.index('--python-exit-code') + 1] == '1'
    assert 'fixture Python exception' in error.getvalue()
`], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
});

test('OpenVDB loading accepts both package names without hiding broken dependencies', () => {
  const run = spawnSync('python3', ['-c', `
import sys, types
from unittest.mock import patch
sys.path.insert(0, 'scripts/assets')
sys.modules['bpy'] = types.ModuleType('bpy')
sys.modules['bmesh'] = types.ModuleType('bmesh')
import blender_builtins as b
binding = object()
with patch.object(b, 'import_module', return_value=binding) as load:
    assert b.load_openvdb() is binding
    load.assert_called_once_with('openvdb')
missing = ModuleNotFoundError("No module named 'openvdb'", name='openvdb')
with patch.object(b, 'import_module', side_effect=[missing, binding]) as load:
    assert b.load_openvdb() is binding
    assert [c.args[0] for c in load.call_args_list] == ['openvdb', 'pyopenvdb']
for problem in [ModuleNotFoundError('missing dependency', name='numpy'), ImportError('ABI mismatch')]:
    with patch.object(b, 'import_module', side_effect=problem) as load:
        try: b.load_openvdb()
        except ImportError as e: assert e is problem
        else: raise AssertionError('broken imports must fail')
        assert load.call_count == 1
last = ModuleNotFoundError("No module named 'pyopenvdb'", name='pyopenvdb')
with patch.object(b, 'import_module', side_effect=[missing, last]):
    try: b.load_openvdb()
    except ModuleNotFoundError as e: assert e is last
    else: raise AssertionError('missing bindings must fail')
`], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
});
