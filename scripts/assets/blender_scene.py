"""Runs inside Blender's Python: builds one shot of a film's 3d.json and renders it as a PNG sequence.

Launched by scripts/assets/blender.py (never by hand):
  blender -b --factory-startup --python scripts/assets/blender_scene.py -- <3d.json> <shot name> <out dir> <from> <to> [render|inspect|review]
Builtin hero meshes come from blender_builtins.py, looks from blender_looks.py, the soft-box world, light rigs, ops, scatter,
keyed motion and the inspect/review reports from blender_studio.py (all bpy-only, imported on demand). The helpers above
`setup` (linear, ease, camera_pose, subject_pose, rotate, moving_bounds, project, frame_extent, fit_camera, light_ratio,
sweep_level, frame_range, merged) have no bpy dependency so blender.py --self-check can test them with the system python3.

Determinism (one Blender process per shot, factory startup):
  camera and subject keyed on every frame from camera_pose() and subject_pose() (linear between frames, so motion blur sees
  the real move), the sweep level, scan-line scroll and focus distance set per frame the same way; scatter placed by
  random.Random(seed); builtin meshes from fixed fields with no randomness; bloom is a compositor Glare node;
  EEVEE: taa_render_samples = samples, motion blur only when `motionBlur` is set, depth of field only when `dof` is set;
  Cycles: samples fixed, seed fixed, use_animated_seed off, adaptive sampling off, CPU device, denoising only with `denoise`;
  colour management: display sRGB, view transform from `view` (Standard by default, so hex colours come out as written),
  look None, exposure 0, gamma 1; PNG 8-bit, every use_stamp_* flag off (stamp metadata differed between identical renders).
"""
import json, math, os, sys

try:
    import bpy, mathutils
except ImportError:  # imported by blender.py --self-check under the system python
    bpy = mathutils = None

PRIMITIVES = ('cube', 'sphere', 'torus', 'monkey', 'cylinder')
BUILTINS = ('head', 'bottle', 'gem', 'knot', 'plush')  # built by blender_builtins.py
LOOKS = ('glossy', 'glass', 'chrome', 'plush', 'toon', 'scanline', 'wireframe', 'holographic')  # blender_looks.py
CAMERAS = ('turntable', 'orbit', 'dolly', 'static')
EASES = ('linear', 'inout', 'out')
RIGS = ('three-point', 'product', 'rim')  # blender_studio.py; key, fill and rim scaled by light_ratio
LIGHTS = ('studio', 'sunset', 'hdri') + RIGS
# `view` to Blender's view transform. Only standard keeps hex colours exact; agx and neutral roll highlights off softly.
VIEWS = {'standard': 'Standard', 'agx': 'AgX', 'neutral': 'Khronos PBR Neutral'}
OPS = ('bevel', 'subdivide', 'remesh', 'smooth', 'inflate', 'displace')  # subject.ops, applied in order to the body
SCATTER_SHAPES = ('sphere', 'cube', 'gem')
# key : fill : rim multipliers by what the subject is made of. Glass gets more fill and a softer rim: a strong rim
# washes a tint out of glass and liquid. Skin and clay keep a low fill so the form models.
RATIOS = {'organic': (1.0, 0.3, 0.6), 'hard': (1.0, 0.45, 0.9), 'metal': (0.7, 0.7, 1.0), 'glass': (0.5, 0.6, 0.45)}
FILL = 0.9  # share of the frame an auto-framed subject's widest projected side takes
# Where the review sheet looks from: (label, angle in degrees, elevation in degrees).
REVIEW_VIEWS = (('front', 0, 8), ('three-quarter', 40, 12), ('side', 90, 8), ('back', 180, 8), ('other side', -90, 8), ('above', 25, 55))
SCAN_FILE = os.path.join('frameforge-scans', 'models', 'head', 'head.gltf')  # under public/assets/generated/; scans/models.json
# Blender's own CC0 studio-light HDRIs (datafiles/studiolights/world); `light.hdri` may name one instead of a file.
BUNDLED_HDRIS = ('studio', 'city', 'courtyard', 'forest', 'interior', 'night', 'sunrise', 'sunset')
ENGINES = {'eevee': 'BLENDER_EEVEE', 'cycles': 'CYCLES'}


def set_render_engine(render, engine):
    """EEVEE's RNA identifier differs between supported Blender versions."""
    if engine == 'cycles':
        render.engine = 'CYCLES'
        return
    if engine != 'eevee':
        raise ValueError(f'Unknown render engine: {engine}')
    try:
        render.engine = 'BLENDER_EEVEE'
    except TypeError:
        # Blender 4.2–4.x uses NEXT; do not silently switch to another renderer.
        render.engine = 'BLENDER_EEVEE_NEXT'

# Shot defaults; blender.py validates the types, this file only fills gaps.
DEFAULTS = {'engine': 'eevee', 'samples': 32, 'transparent': False, 'background': '#F4F4F1', 'shadowCatcher': False,
            'look': None, 'sweep': None, 'bloom': None, 'dof': None, 'view': 'standard', 'motionBlur': None, 'scatter': None,
            'denoise': False,
            'camera': {'preset': 'turntable', 'radius': 6.0, 'height': 1.6, 'fov': 35.0, 'ease': 'linear', 'target': 0.0},
            'subject': {'kind': 'primitive', 'primitive': 'torus', 'builtin': 'head', 'detail': 256, 'scale': 1.0, 'rotation': [0, 0, 0],
                        'scan': True, 'ops': [], 'keys': [], 'liquid': None},
            'material': {'base': '#2F5BFF', 'metallic': 0.2, 'roughness': 0.35, 'emission': 0.0},
            'light': {'preset': 'studio', 'strength': 1.0}}
# Colours and numbers a look reads from `material`, filled in only when the shot has a look.
LOOK_DEFAULTS = {'accent': '#7FE8FF', 'trim': '#D8B26E', 'lines': 36.0, 'width': 0.16, 'glow': 5.0, 'ior': 1.45, 'scroll': 0.0,
                 'thickness': 0.035, 'density': 2.0, 'frost': 0.0, 'dispersion': 0.0}
BLOOM = 0.5  # glare strength when a look is set and `bloom` is not


def linear(hex_colour):
    """sRGB '#rrggbb' to the linear RGBA tuple Blender's colour sockets expect."""
    channels = [int(hex_colour[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels) + (1.0,)


def ease(t, kind):
    """linear, inout (smoothstep: starts and lands softly) or out (fast start, soft landing) on 0..1."""
    return t if kind == 'linear' else t * t * (3 - 2 * t) if kind == 'inout' else 1 - (1 - t) ** 3


def camera_pose(camera, index, frames):
    """Location (x, y, z) and Euler rotation (rx, ry, rz) of the camera at frame `index`, looking at (0, 0, `target`).
    Angle 0 is in front of the subject (-Y); angles run counter-clockwise seen from above. turntable: one full turn over
    `frames` (the last frame stops short of the first, so a looped sequence has no repeated frame); orbit: `from`..`to`
    degrees; dolly: radius `from`..`to` at angle 0; static: angle `from`. Any preset may also move `radius` to `radiusTo`
    (a push-in) and `height` to `heightTo` (a crane) over the shot; `ease` shapes every move except the turntable's turn."""
    preset, radius, height = camera['preset'], float(camera['radius']), float(camera['height'])
    # `from`/`to` are degrees for orbit and static, radii for dolly; a dolly without them stays at `radius`.
    start, end = (float(camera.get('from', radius)), float(camera.get('to', radius))) if preset == 'dolly' else (float(camera.get('from', 0.0)), float(camera.get('to', 360.0)))
    t = index / frames if preset == 'turntable' else (index / (frames - 1) if frames > 1 else 0.0)
    shaped = t if preset == 'turntable' else ease(t, camera.get('ease', 'linear'))
    angle = {'turntable': 2 * math.pi * t, 'orbit': math.radians(start + (end - start) * shaped), 'dolly': 0.0, 'static': math.radians(start)}[preset]
    move = ease(t, camera.get('ease', 'linear'))
    if preset == 'dolly':
        radius = start + (end - start) * shaped
    elif camera.get('radiusTo') is not None:
        radius += (float(camera['radiusTo']) - radius) * move
    if camera.get('heightTo') is not None:
        height += (float(camera['heightTo']) - height) * move
    pitch = math.atan2(height - float(camera.get('target', 0.0)), radius)
    return (radius * math.sin(angle), -radius * math.cos(angle), height), (math.pi / 2 - pitch, 0.0, angle)


def sweep_level(sweep, index, low, high):
    """Height of the look-to-look wipe at frame `index`: below `low` (nothing swept) until `from`, rising with an in-out
    ease to above `high` (all swept) at `until`. A pure function of the frame, like the camera."""
    span = max(int(sweep['until']) - int(sweep['from']), 1)
    t = min(max((index - int(sweep['from'])) / span, 0.0), 1.0)
    margin = 0.05 * (high - low)
    return low - margin + (high - low + 2 * margin) * ease(t, 'inout')


def frame_range(text, frames):
    """'a-b' (inclusive) or None to (first, last) inside 0..frames-1; raises ValueError when out of range."""
    first, last = (0, frames - 1) if not text else [int(part) for part in text.split('-', 1)] if '-' in text else (int(text), int(text))
    if not 0 <= first <= last < frames:
        raise ValueError(f'frames {text} must lie inside 0-{frames - 1}')
    return first, last


def subject_class(shot):
    """organic, hard, metal or glass: picks the light ratio when `light.ratio` is not given."""
    subject = shot['subject']
    if shot.get('look') == 'glass':
        return 'glass'
    if shot.get('look') in ('chrome', 'holographic'):
        return 'metal'
    if shot.get('look') == 'plush' or (subject['kind'] == 'builtin' and subject.get('builtin') in ('head', 'plush')):
        return 'organic'
    return 'hard'


def light_ratio(shot):
    return tuple(float(v) for v in shot['light'].get('ratio') or RATIOS[subject_class(shot)])


def subject_pose(subject, index):
    """(location, rotation in degrees, uniform scale) added on top of the subject's own `rotation` and `scale` at frame
    `index`. `subject.keys` is a list of {frame, location?, rotation?, scale?}; between two keys each field eases (`subject.ease`,
    default inout), before the first key and after the last it holds. A field a key leaves out is at rest (0, 0, 1)."""
    rest = {'location': [0.0, 0.0, 0.0], 'rotation': [0.0, 0.0, 0.0], 'scale': 1.0}
    keys = sorted(subject.get('keys') or [], key=lambda k: k['frame'])
    if not keys:
        return rest['location'], rest['rotation'], rest['scale']
    before = [k for k in keys if k['frame'] <= index]
    after = [k for k in keys if k['frame'] > index]
    a, b = (before[-1] if before else keys[0]), (after[0] if after else keys[-1])
    t = 0.0 if a is b or not before else ease((index - a['frame']) / (b['frame'] - a['frame']), subject.get('ease', 'inout'))
    lerp = lambda x, y: [float(p) + (float(q) - float(p)) * t for p, q in zip(x, y)] if isinstance(x, list) else float(x) + (float(y) - float(x)) * t
    return tuple(lerp(a.get(field, rest[field]), b.get(field, rest[field])) for field in ('location', 'rotation', 'scale'))


def rotate(point, degrees):
    """`point` turned by Euler XYZ angles in degrees (Blender's default order: X first, then Y, then Z)."""
    x, y, z = point
    for axis, angle in enumerate(math.radians(d) for d in degrees):
        c, s = math.cos(angle), math.sin(angle)
        if axis == 0:
            y, z = y * c - z * s, y * s + z * c
        elif axis == 1:
            x, z = x * c + z * s, -x * s + z * c
        else:
            x, y = x * c - y * s, x * s + y * c
    return x, y, z


def moving_bounds(shot, low, high, samples=17):
    """The box the subject's box sweeps through under `subject.keys` (the box itself without keys)."""
    subject, frames = shot['subject'], int(shot['frames'])
    if not subject.get('keys'):
        return list(low), list(high)
    corners = [(x, y, z) for x in (low[0], high[0]) for y in (low[1], high[1]) for z in (low[2], high[2])]
    points = []
    for index in sorted({round(i * (frames - 1) / (samples - 1)) for i in range(samples)}):
        location, rotation, scale = subject_pose(subject, index)
        points += [[c + o for c, o in zip(rotate([v * scale for v in corner], rotation), location)] for corner in corners]
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]


def look_at(location, target):
    """Right, up and forward unit vectors of a camera at `location` aimed at `target` with no roll."""
    unit = lambda v: [c / (math.sqrt(sum(x * x for x in v)) or 1.0) for c in v]
    forward = unit([t - l for t, l in zip(target, location)])
    right = unit([forward[1], -forward[0], 0.0]) if abs(forward[2]) < 0.9999 else [1.0, 0.0, 0.0]
    up = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]]
    return right, up, forward


def project(point, location, target, fov, aspect):
    """Where `point` lands in the frame: (x, y) with -1 and 1 at the edges (horizontal field of view `fov` in degrees,
    aspect width / height), or None when it is behind the camera."""
    right, up, forward = look_at(location, target)
    d = [p - l for p, l in zip(point, location)]
    depth = sum(a * b for a, b in zip(d, forward))
    if depth <= 1e-6:
        return None
    half = math.tan(math.radians(fov) / 2)
    return sum(a * b for a, b in zip(d, right)) / (depth * half), sum(a * b for a, b in zip(d, up)) / (depth * half / aspect)


def frame_extent(camera, corners, frames, aspect, samples=9):
    """The largest |x| or |y| any bounding-box corner reaches over `samples` frames of the move: above 1 the subject is
    cropped somewhere in the shot."""
    indices = sorted({round(i * (frames - 1) / max(samples - 1, 1)) for i in range(samples)})
    worst = 0.0
    for index in indices:
        location, _ = camera_pose(camera, index, frames)
        target = (0.0, 0.0, float(camera.get('target', 0.0)))
        for corner in corners:
            spot = project(corner, location, target, float(camera['fov']), aspect)
            worst = max(worst, 99.0 if spot is None else max(abs(spot[0]), abs(spot[1])))
    return worst


def fit_camera(camera, low, high, frames, aspect, fill=FILL):
    """The camera with `radius` (and, when `elevation` is set, `height`) solved so the subject's box fills `fill` of the
    frame at its widest moment, looking at the box's centre unless `target` is given. Bisection: extent falls as radius grows."""
    camera = dict(camera)
    camera.setdefault('target', (low[2] + high[2]) / 2)
    corners = [(x, y, z) for x in (low[0], high[0]) for y in (low[1], high[1]) for z in (low[2], high[2])]
    near, far = 0.05, 2000.0
    for _ in range(60):
        camera['radius'] = (near + far) / 2
        if camera.get('elevation') is not None:
            camera['height'] = camera['target'] + camera['radius'] * math.tan(math.radians(float(camera['elevation'])))
        near, far = (camera['radius'], far) if frame_extent(camera, corners, frames, aspect) > fill else (near, camera['radius'])
    return camera


def merged(shot):
    """The shot with DEFAULTS filled in one level deep."""
    out = {**DEFAULTS, **shot}
    for key in ('camera', 'subject', 'material', 'light'):
        out[key] = {**DEFAULTS[key], **(shot.get(key) or {})}
    raw_camera = shot.get('camera') or {}
    # A shot that leaves out the radius is framed from the subject's bounds (never cropped); dolly radii are explicit.
    out['camera']['fit'] = 'radius' not in raw_camera and out['camera']['preset'] != 'dolly'
    if out['camera']['fit'] and 'height' not in raw_camera:
        out['camera'].setdefault('elevation', 10.0)
    if out['subject']['kind'] == 'builtin' and not out['look']:
        out['look'] = 'glossy'  # builtins are hero subjects; they always wear a look
    if out['look']:
        out['material'] = {**out['material'], **LOOK_DEFAULTS, **(shot.get('material') or {})}
    elif 'material' not in shot and out['subject']['kind'] != 'primitive':
        out['material'] = None  # an imported model or a script keeps its own materials unless the shot names one
    if out['bloom'] is None:
        out['bloom'] = BLOOM if out['look'] else 0.0
    return out


def node(tree, kind, **inputs):
    created = tree.nodes.new(kind)
    for name, value in inputs.items():
        created.inputs[name].default_value = value
    return created


def make_material(spec):
    material = bpy.data.materials.new('frameforge')
    if hasattr(material, 'use_nodes'): material.use_nodes = True
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = linear(spec['base'])
    bsdf.inputs['Metallic'].default_value = float(spec['metallic'])
    bsdf.inputs['Roughness'].default_value = float(spec['roughness'])
    if float(spec.get('emission') or 0) > 0:
        bsdf.inputs['Emission Color'].default_value = linear(spec['base'])
        bsdf.inputs['Emission Strength'].default_value = float(spec['emission'])
    return material


def bounds(objects):
    """World-space (min, max) corners of the meshes' bounding boxes."""
    corners = [obj.matrix_world @ mathutils.Vector(corner) for obj in objects if obj.type == 'MESH' for corner in obj.bound_box]
    return [min(c[i] for c in corners) for i in range(3)], [max(c[i] for c in corners) for i in range(3)]


def scan_path(generated):
    return os.path.join(os.path.dirname(generated), SCAN_FILE)


def uses_scan(subject, generated):
    """The builtin head is the CC0 scanned bust when blender.py could fetch it, the sculpted head otherwise or with scan: false."""
    return subject['kind'] == 'builtin' and subject['builtin'] == 'head' and subject.get('scan', True) is not False and os.path.isfile(scan_path(generated))


def import_gltf(path, scale, rotation):
    """Imports a glTF, normalised so its largest side is 2 × scale and its box is centred on the origin, under one root."""
    bpy.ops.import_scene.gltf(filepath=path)
    objects = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
    root = bpy.data.objects.new('subject', None)
    bpy.context.scene.collection.objects.link(root)
    for obj in bpy.context.selected_objects:
        if obj.parent is None:
            obj.parent = root
    bpy.context.view_layer.update()
    low, high = bounds(objects)
    size = max(high[i] - low[i] for i in range(3)) or 1.0
    root.scale = (2 * scale / size,) * 3
    root.location = tuple(-(low[i] + high[i]) / 2 * 2 * scale / size for i in range(3))
    root.rotation_euler = [math.radians(float(d)) for d in rotation]
    return objects


def make_subject(shot, spec_dir, generated):
    """Adds the subject at the origin and returns its objects (meshes under one root)."""
    subject = shot['subject']
    scale = float(subject['scale'])
    if uses_scan(subject, generated):
        # The scanned bust is 2 units at scale 1 like a glTF; 1.2 makes it as tall as the sculpted head (2.4).
        objects = import_gltf(scan_path(generated), 1.2 * scale, subject['rotation'])
        for obj in objects:
            obj['role'] = 'body'
        return objects
    if subject['kind'] == 'builtin':
        import blender_builtins
        parts = blender_builtins.build(subject['builtin'], int(subject['detail']), subject)
        root = bpy.data.objects.new('subject', None)
        bpy.context.scene.collection.objects.link(root)
        for obj, role in parts:
            obj['role'] = role  # blender_looks.apply gives `body` the look, `trim` metal, `eye` gloss black
            obj.parent = root
        root.scale = (scale,) * 3
        root.rotation_euler = [math.radians(float(d)) for d in subject['rotation']]
        return [obj for obj, _ in parts]
    if subject['kind'] == 'script':
        import importlib.util
        path = os.path.join(spec_dir, subject['script'])
        module_spec = importlib.util.spec_from_file_location('frameforge_shot', path)
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        built = module.build(bpy.context.scene, shot)
        objects = [built] if built is not None and not isinstance(built, (list, tuple)) else list(built or [])
        return objects or [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if subject['kind'] == 'glb':
        objects = import_gltf(os.path.join(generated, subject['src']), scale, subject['rotation'])
        if shot.get('material') and not shot.get('look'):
            material = make_material(shot['material'])
            for obj in objects:
                obj.data.materials.clear()
                obj.data.materials.append(material)
        return objects
    kind = subject['primitive']
    if kind == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=2.0)
    elif kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=64, ring_count=32)
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.42, major_segments=96, minor_segments=48)
    elif kind == 'monkey':
        bpy.ops.mesh.primitive_monkey_add(size=2.0)
    else:
        bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=2.0, vertices=96)
    obj = bpy.context.active_object
    obj.scale = (scale,) * 3
    obj.rotation_euler = [math.radians(float(d)) for d in subject['rotation']]
    if kind == 'cylinder':
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))  # keeps the rim of the caps sharp
    elif kind != 'cube':
        bpy.ops.object.shade_smooth()
    if kind == 'monkey':
        obj.modifiers.new('smooth', 'SUBSURF').levels = obj.modifiers['smooth'].render_levels = 2
    obj.data.materials.append(make_material(shot['material']))
    return [obj]


def hdri_path(name, generated):
    """A bundled studio-light name (BUNDLED_HDRIS) or a path under public/assets/generated/<slug>/."""
    if name in BUNDLED_HDRIS:
        return os.path.join(bpy.utils.system_resource('DATAFILES'), 'studiolights', 'world', f'{name}.exr')
    return os.path.join(generated, name)


def make_post(scene, shot):
    """Bloom (the compositor's Glare node) when `bloom` > 0: only pixels brighter than white bleed, so a hex background
    stays exact. Transparent films keep their alpha; the halo outside the subject is lost there, so bloom suits opaque shots."""
    group = bpy.data.node_groups.new('frameforge-post', 'CompositorNodeTree')
    group.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    layers = group.nodes.new('CompositorNodeRLayers')
    glare = group.nodes.new('CompositorNodeGlare')
    glare.inputs['Type'].default_value = 'Bloom'
    glare.inputs['Quality'].default_value = 'High'
    glare.inputs['Threshold'].default_value = 1.0
    glare.inputs['Strength'].default_value = float(shot['bloom'])
    glare.inputs['Size'].default_value = 0.6
    output = group.nodes.new('NodeGroupOutput')
    group.links.new(layers.outputs['Image'], glare.inputs['Image'])
    group.links.new(glare.outputs['Image'], output.inputs['Image'])
    scene.compositing_node_group = group
    scene.render.use_compositing = True


def make_world(scene, shot, generated):
    """Camera rays see the background hex (or nothing when transparent); everything else is lit by the preset's environment."""
    world = bpy.data.worlds.new('frameforge')
    if hasattr(world, 'use_nodes'): world.use_nodes = True
    scene.world = world
    tree = world.node_tree
    output = tree.nodes['World Output']
    light = shot['light']
    strength = float(light['strength'])
    # A look needs something to reflect: without an HDRI of its own the shot is lit by Blender's bundled studio HDRI
    # (soft boxes on a dark room) on top of the preset's area lights; the camera still sees the background hex.
    # A look or a named rig gets the procedural soft-box studio (blender_studio.softbox_world) instead.
    source = light['hdri'] if light['preset'] == 'hdri' else 'softbox' if shot['look'] or light['preset'] in RIGS else None
    # Mirror-like looks show the room, so they get more of it; diffuse ones mostly need the lights, and the light-banded
    # looks (scan lines, toon) need contrast between the lit and the shadow side.
    room = {'chrome': 1.0, 'glass': 1.0, 'holographic': 0.6, 'scanline': 0.1, 'toon': 0.1, 'wireframe': 0.2}.get(shot['look'], 0.35)
    if source == 'softbox':
        import blender_studio
        lit = blender_studio.softbox_world(tree, strength * room, light)
    elif source:
        environment = tree.nodes.new('ShaderNodeTexEnvironment')
        environment.image = bpy.data.images.load(hdri_path(source, generated))
        if light.get('rotate'):
            mapping = node(tree, 'ShaderNodeMapping', Rotation=(0.0, 0.0, math.radians(float(light['rotate']))))
            tree.links.new(tree.nodes.new('ShaderNodeTexCoord').outputs['Generated'], mapping.inputs['Vector'])
            tree.links.new(mapping.outputs['Vector'], environment.inputs['Vector'])
        lit = node(tree, 'ShaderNodeBackground', Strength=strength)
        tree.links.new(environment.outputs['Color'], lit.inputs['Color'])
    else:
        colour = linear(shot['background']) if shot['background'] != 'transparent' else (0.5, 0.5, 0.5, 1.0)
        lit = node(tree, 'ShaderNodeBackground', Color=colour, Strength=(0.35 if light['preset'] == 'studio' else 0.6) * strength)
        if light.get('environment'):
            # A soft studio sky in one hex: full colour overhead fading to 15 % below the horizon, so metal reflects a floor and a ceiling.
            coords = tree.nodes.new('ShaderNodeTexCoord')
            split = tree.nodes.new('ShaderNodeSeparateXYZ')
            ramp = tree.nodes.new('ShaderNodeMapRange')
            ramp.inputs['From Min'].default_value, ramp.inputs['From Max'].default_value = -0.3, 0.8
            ramp.inputs['To Min'].default_value, ramp.inputs['To Max'].default_value = 0.15, 1.0
            tint = tree.nodes.new('ShaderNodeMix'); tint.data_type, tint.blend_type = 'RGBA', 'MULTIPLY'
            tint.inputs['Factor'].default_value = 1.0
            tint.inputs['A'].default_value = linear(light['environment'])
            tree.links.new(coords.outputs['Generated'], split.inputs['Vector'])
            tree.links.new(split.outputs['Z'], ramp.inputs['Value'])
            tree.links.new(ramp.outputs['Result'], tint.inputs['B'])
            tree.links.new(tint.outputs['Result'], lit.inputs['Color'])
    if shot['background'] == 'transparent':
        tree.links.new(lit.outputs[0], output.inputs['Surface'])
        return
    seen = node(tree, 'ShaderNodeBackground', Color=linear(shot['background']), Strength=1.0)
    mix = tree.nodes.new('ShaderNodeMixShader')
    path = tree.nodes.new('ShaderNodeLightPath')
    tree.links.new(path.outputs['Is Camera Ray'], mix.inputs['Fac'])
    tree.links.new(lit.outputs[0], mix.inputs[1])
    tree.links.new(seen.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], output.inputs['Surface'])


def add_light(scene, name, kind, location, energy, colour=(1.0, 1.0, 1.0), size=3.0, size_y=None):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = colour
    if kind == 'AREA':
        data.size = size
        if size_y:  # a strip: long side along the light's local Y, which the aim keeps pointing up
            data.shape, data.size_y = 'RECTANGLE', size_y
    if kind == 'SUN':
        data.angle = math.radians(3.0)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    aim = obj.constraints.new('TRACK_TO')
    aim.target, aim.track_axis, aim.up_axis = scene.objects['target'], 'TRACK_NEGATIVE_Z', 'UP_Y'
    return obj


def make_lights(scene, shot):
    light = shot['light']
    strength = float(light['strength'])
    target = bpy.data.objects.new('target', None)  # every light aims at the subject's centre
    scene.collection.objects.link(target)
    if light['preset'] in RIGS:
        import blender_studio
        blender_studio.rig(scene, light['preset'], light_ratio(shot), strength, add_light)
    elif light['preset'] == 'sunset':
        add_light(scene, 'sun', 'SUN', (-6, -4, 2.2), 4.0 * strength, colour=(1.0, 0.72, 0.5))
        add_light(scene, 'sky', 'AREA', (3, 2, 6), 150 * strength, colour=(0.75, 0.85, 1.0), size=8.0)
    elif light['preset'] == 'studio' and shot['look']:
        # Hero rig: one big soft key, two strip rims behind the subject for the bright edge that separates it from a dark
        # background, a dim top light; the bundled studio HDRI adds the reflections.
        add_light(scene, 'key', 'AREA', (-4.0, -4.5, 3.5), 170 * strength, size=4.0)
        add_light(scene, 'rim-left', 'AREA', (-4.0, 3.5, 2.0), 450 * strength, size=2.5)
        add_light(scene, 'rim-right', 'AREA', (4.2, 3.0, 1.2), 450 * strength, size=2.5)
        add_light(scene, 'top', 'AREA', (0.5, 0.5, 6.0), 120 * strength, size=3.0)
    elif light['preset'] == 'studio':
        add_light(scene, 'key', 'AREA', (-3.5, -4.5, 5.0), 900 * strength, size=3.0)
        add_light(scene, 'fill', 'AREA', (4.5, -3.0, 2.0), 250 * strength, size=5.0)
        add_light(scene, 'rim', 'AREA', (1.0, 5.0, 4.0), 500 * strength, size=2.0)


def make_shadow_catcher(scene, shot, objects):
    """A plane under the subject that shows only its shadow: Cycles' own shadow catcher; for EEVEE a blended material whose
    ink comes from the Ambient Occlusion node (a contact shadow independent of the lights, so the plane has no visible edge)."""
    low, _ = bounds(objects)
    bpy.ops.mesh.primitive_plane_add(size=40.0, location=(0, 0, low[2] - 0.01))
    plane = bpy.context.active_object
    if shot['engine'] == 'cycles':
        plane.is_shadow_catcher = True
        return
    material = bpy.data.materials.new('shadow-catcher')
    if hasattr(material, 'use_nodes'): material.use_nodes = True
    material.surface_render_method = 'BLENDED'
    tree = material.node_tree
    tree.nodes.remove(tree.nodes['Principled BSDF'])
    occlusion = tree.nodes.new('ShaderNodeAmbientOcclusion')
    occlusion.samples, occlusion.inputs['Distance'].default_value = 16, 2.2
    # fac = 1 - 0.8 * (1 - ao): open ground is transparent, ground under the subject carries up to 80 % ink.
    # A number in shadowCatcher (0..1) sets how much ink the ground under the subject carries; true keeps 0.8.
    dark = 0.8 if shot['shadowCatcher'] is True else float(shot['shadowCatcher'])
    opacity = tree.nodes.new('ShaderNodeMath'); opacity.operation = 'MULTIPLY_ADD'; opacity.inputs[1].default_value = dark; opacity.inputs[2].default_value = 1 - dark
    tree.links.new(occlusion.outputs['AO'], opacity.inputs[0])
    mix = tree.nodes.new('ShaderNodeMixShader')
    tree.links.new(opacity.outputs[0], mix.inputs['Fac'])
    tree.links.new(node(tree, 'ShaderNodeBsdfDiffuse', Color=(0, 0, 0, 1)).outputs[0], mix.inputs[1])
    tree.links.new(tree.nodes.new('ShaderNodeBsdfTransparent').outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], tree.nodes['Material Output'].inputs['Surface'])
    plane.data.materials.append(material)


def setup(spec_path, shot_name):
    """Builds the whole scene of one shot (subject, ops, look, scatter, framing, world, lights, keyed motion) and returns
    (scene, shot, camera, objects, context); context carries the sweep range, the bounds and what the subject turned out to be."""
    spec = json.load(open(spec_path))
    shot = merged(next(s for s in spec['shots'] if s['name'] == shot_name))
    spec_dir = os.path.dirname(os.path.abspath(spec_path))
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    generated = os.path.join(root, 'public', 'assets', 'generated', spec['slug'])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    render = scene.render
    set_render_engine(render, shot['engine'])
    render.resolution_x, render.resolution_y, render.resolution_percentage = int(shot['width']), int(shot['height']), 100
    render.fps, scene.frame_start, scene.frame_end = int(shot['fps']), 0, int(shot['frames']) - 1
    render.film_transparent = bool(shot['transparent']) or shot['background'] == 'transparent'
    render.image_settings.file_format, render.image_settings.color_depth, render.image_settings.compression = 'PNG', '8', 15
    render.image_settings.color_mode = 'RGBA' if render.film_transparent else 'RGB'
    render.use_motion_blur = bool(shot['motionBlur'])
    if shot['motionBlur']:
        render.motion_blur_shutter = float(shot['motionBlur'])
    for flag in [p.identifier for p in render.bl_rna.properties if p.identifier.startswith('use_stamp')]:
        setattr(render, flag, False)
    scene.display_settings.display_device = 'sRGB'
    scene.view_settings.view_transform, scene.view_settings.look = VIEWS[shot['view']], 'None'
    scene.view_settings.exposure, scene.view_settings.gamma = 0.0, 1.0
    samples = int(shot['samples'])
    if shot['engine'] == 'cycles':
        scene.cycles.samples, scene.cycles.seed, scene.cycles.device = samples, int(shot.get('seed', 0)), 'CPU'
        scene.cycles.use_animated_seed = scene.cycles.use_adaptive_sampling = False
        scene.cycles.use_denoising = bool(shot['denoise'])
        if shot['denoise']:  # OpenImageDenoise on the CPU
            scene.cycles.denoiser = 'OPENIMAGEDENOISE'
        scene.cycles.film_transparent_glass = False
        scene.cycles.max_bounces = scene.cycles.transmission_bounces = 16  # light through a bottle wall, the liquid and out again
    else:
        scene.eevee.taa_render_samples = samples
        scene.eevee.use_shadows = True
        looks = {shot['look'], (shot['sweep'] or {}).get('to')}
        # Screen-traced reflections and refraction for gloss, chrome and glass. Off when toon or scanline is in the shot:
        # with ray tracing on, EEVEE's Shader to RGB (their light-dependent bands) reads no light.
        if shot['look'] and not looks & {'toon', 'scanline'}:
            scene.eevee.use_raytracing = True
            scene.eevee.ray_tracing_options.resolution_scale = '1'
            scene.eevee.use_fast_gi = True
    camera = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.sensor_fit, camera.data.lens_unit = 'HORIZONTAL', 'FOV'
    camera.data.angle = math.radians(float(shot['camera']['fov']))  # horizontal field of view
    camera.data.clip_end = 1000.0
    context = {'engine': shot['engine'], 'source': 'scan' if uses_scan(shot['subject'], generated) else shot['subject']['kind']}
    objects = make_subject(shot, spec_dir, generated)
    bpy.context.view_layer.update()
    import blender_studio
    blender_studio.apply_ops(objects, shot['subject']['ops'])
    bpy.context.view_layer.update()
    low, high = bounds(objects) if objects else ([-1.0] * 3, [1.0] * 3)
    context['level'], context['bounds'] = (low[2], high[2]), (low, high)
    if shot['look'] and objects:
        import blender_looks
        colours = {key: linear(value) if isinstance(value, str) else float(value) for key, value in shot['material'].items()}
        liquid = shot['subject']['liquid']
        colours['liquid'] = linear(liquid.get('colour', '#E8A23A')) if liquid else None
        blender_looks.apply(objects, shot['look'], colours, max(high[i] - low[i] for i in range(3)), shot['sweep'], context)
    extra = blender_studio.scatter(scene, shot, objects, low, high) if shot['scatter'] and objects else []
    if shot['camera']['fit']:
        aspect = int(shot['width']) / int(shot['height'])
        moving = blender_studio.moving_bounds(shot, low, high)  # keys move the subject: frame the space it sweeps
        shot['camera'] = fit_camera(shot['camera'], *moving, int(shot['frames']), aspect, float(shot['camera'].get('fill', FILL)))
    make_world(scene, shot, generated)
    make_lights(scene, shot)
    scene.objects['target'].location = (0.0, 0.0, float(shot['camera']['target']))
    if shot['shadowCatcher'] and objects:
        make_shadow_catcher(scene, shot, objects)
    if float(shot['bloom']) > 0:
        make_post(scene, shot)
    if shot['dof']:
        camera.data.dof.use_dof, camera.data.dof.aperture_fstop = True, float(shot['dof'])
    blender_studio.key_motion(scene, shot, camera, objects + extra)
    return scene, shot, camera, objects + extra, context


def strip_text(path):
    """Drops a PNG's tEXt chunks: Cycles writes its render and sync times there, so identical pictures differed in bytes."""
    import struct
    data = open(path, 'rb').read()
    kept, at = [data[:8]], 8
    while at < len(data):
        length = struct.unpack('>I', data[at:at + 4])[0]
        chunk = data[at:at + 12 + length]
        if chunk[4:8] != b'tEXt':
            kept.append(chunk)
        at += 12 + length
    with open(path, 'wb') as f:
        f.write(b''.join(kept))


def render_frames(scene, shot, camera, context, out, first, last):
    os.makedirs(out, exist_ok=True)
    for index in range(first, last + 1):
        if shot['dof']:  # focus on the look-at point, wherever the camera has moved to
            location, _ = camera_pose(shot['camera'], index, int(shot['frames']))
            camera.data.dof.focus_distance = math.dist(location, (0.0, 0.0, float(shot['camera']['target'])))
        values = {'scroll': index * float(shot['material'].get('scroll', 0.0)) if shot['look'] else 0.0,
                  'level': sweep_level(shot['sweep'], index, *context['level']) if shot['sweep'] else 0.0}
        for key, value in values.items():  # read by the looks' attribute nodes (blender_looks.driven)
            scene[f'frameforge_{key}'] = value
        scene.frame_set(index)
        scene.render.filepath = os.path.join(out, f'{index:04d}.png')
        bpy.ops.render.render(write_still=True)
        strip_text(scene.render.filepath)


def build(spec_path, shot_name, out, first, last, mode='render'):
    scene, shot, camera, objects, context = setup(spec_path, shot_name)
    import blender_studio
    os.makedirs(out, exist_ok=True)
    if mode == 'inspect':
        with open(os.path.join(out, 'inspect.json'), 'w') as f:
            json.dump(blender_studio.inspect(scene, shot, objects, context), f, indent=1)
    elif mode == 'review':
        blender_studio.review(scene, shot, camera, context, out)
    else:
        render_frames(scene, shot, camera, context, out, first, last)
    print(f'frameforge-blender {mode} {shot_name} ({context["source"]}) into {out}')


if __name__ == '__main__' and bpy is not None:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # blender_builtins and blender_looks sit next to this file
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) not in (5, 6):
        print('usage: blender -b --factory-startup --python blender_scene.py -- <3d.json> <shot> <out dir> <from> <to> [render|inspect|review]', file=sys.stderr)
        sys.exit(2)
    build(args[0], args[1], args[2], int(args[3]), int(args[4]), *(args[5:] or ['render']))
