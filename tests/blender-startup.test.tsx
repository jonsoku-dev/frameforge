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

test('Blender compositor supports legacy, transitional and modern API shapes', () => {
  const run = spawnSync('python3', ['-c', `
import sys
from types import SimpleNamespace as NS
sys.path.insert(0, 'scripts/assets')
import blender_scene as s
class Socket:
    def __init__(self): self.default_value = None
class Node:
    def __init__(self, kind, sockets, enums):
        self.kind = kind
        names = {'CompositorNodeRLayers': ['Image', 'Alpha'], 'CompositorNodeGlare': ['Image'],
                 'CompositorNodeMixRGB': [0, 1, 2], 'CompositorNodeSetAlpha': ['Image', 'Alpha'],
                 'NodeGroupOutput': ['Image'], 'CompositorNodeComposite': ['Image']}[kind]
        self.inputs = {n: Socket() for n in names}
        if kind == 'CompositorNodeGlare':
            if sockets: self.inputs.update({n: Socket() for n in ['Threshold', 'Strength', 'Size']})
            if enums: self.inputs.update({n: Socket() for n in ['Type', 'Quality']})
        self.outputs = {n: Socket() for n in ['Image', 'Alpha']}
class Nodes(list):
    def new(self, kind):
        if grouped: assert scene.compositing_node_group is tree, 'attach group before render layers'
        node = Node(kind, sockets, enums); self.append(node); return node
class Links(list):
    def new(self, a, b): self.append((a, b))
for grouped, sockets, enums in [(False, False, False), (False, True, False), (True, True, True)]:
    tree = NS(nodes=Nodes(), links=Links(), interface=NS(new_socket=lambda *a, **k: None))
    scene = NS(node_tree=tree, render=NS(use_compositing=False))
    if grouped: scene.compositing_node_group = None
    s.bpy = NS(data=NS(node_groups=NS(new=lambda *a: tree)))
    s.make_post(scene, {'bloom': 2})
    layers, glare = tree.nodes[:2]
    assert scene.render.use_compositing
    assert (layers.outputs['Image'], glare.inputs['Image']) in tree.links
    if enums:
        assert glare.inputs['Type'].default_value == 'Bloom'
        assert glare.inputs['Quality'].default_value == 'High'
    else: assert glare.glare_type == 'BLOOM' and glare.quality == 'HIGH'
    if sockets:
        assert [glare.inputs[n].default_value for n in ['Threshold', 'Strength', 'Size']] == [1.0, 2.0, 0.6]
        assert len(tree.nodes) == 3
        image = glare.outputs['Image']
    else:
        assert (glare.threshold, glare.size, glare.mix) == (1.0, 8, 1.0)
        scale, add, alpha = tree.nodes[2:5]
        assert scale.blend_type == 'MULTIPLY' and scale.inputs[2].default_value == (2, 2, 2, 1)
        assert add.blend_type == 'ADD' and not add.use_clamp and not scale.use_clamp
        assert scale.inputs[0].default_value == add.inputs[0].default_value == 1
        assert (glare.outputs['Image'], scale.inputs[1]) in tree.links
        assert (layers.outputs['Image'], add.inputs[1]) in tree.links
        assert (scale.outputs['Image'], add.inputs[2]) in tree.links
        assert (add.outputs['Image'], alpha.inputs['Image']) in tree.links
        assert (layers.outputs['Alpha'], alpha.inputs['Alpha']) in tree.links
        assert alpha.mode == 'REPLACE_ALPHA'
        image = alpha.outputs['Image']
    output = tree.nodes[-1]
    assert output.kind == ('NodeGroupOutput' if grouped else 'CompositorNodeComposite')
    assert (image, output.inputs['Image']) in tree.links
`], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
});

test('Blender renders offline bloom with zero identity and additive unclamped strength', {timeout: 120_000}, t => {
  const run = spawnSync(process.env.BLENDER_PATH || 'blender', [
    '-b', '--factory-startup', '--python-exit-code', '1',
    '--python', 'tests/fixtures/three-d/compositor-compat.py',
  ], {encoding: 'utf8', timeout: 110_000, maxBuffer: 4 * 1024 * 1024});
  if (run.error && (run.error as NodeJS.ErrnoException).code === 'ENOENT') return t.skip('Blender is not installed');
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.match(run.stdout, /compositor compatibility render ok/);
});
