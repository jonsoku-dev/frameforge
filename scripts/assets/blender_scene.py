"""Runs inside Blender's Python: builds one shot of a film's 3d.json and renders it as a PNG sequence.

Launched by scripts/assets/blender.py (never by hand):
  blender -b --factory-startup --python scripts/assets/blender_scene.py -- <3d.json> <shot name> <out dir> <from> <to>
The helpers above `build` (linear, camera_pose, frame_range) have no bpy dependency so blender.py --self-check can test them
with the system python3.

Determinism (one Blender process per shot, factory startup, nothing animated by keyframes):
  camera posed per frame by camera_pose(), a pure function of the frame index;
  EEVEE: taa_render_samples = samples, no motion blur, no depth of field;
  Cycles: samples fixed, seed fixed, use_animated_seed off, adaptive sampling off, denoising off, CPU device;
  colour management: display sRGB, view transform Standard, look None, exposure 0, gamma 1, so hex colours come out as written;
  PNG 8-bit, every use_stamp_* flag off (the stamp metadata was the only byte that differed between identical renders).
"""
import json, math, os, sys

try:
    import bpy, mathutils
except ImportError:  # imported by blender.py --self-check under the system python
    bpy = mathutils = None

PRIMITIVES = ('cube', 'sphere', 'torus', 'monkey', 'cylinder')
CAMERAS = ('turntable', 'orbit', 'dolly', 'static')
LIGHTS = ('studio', 'sunset', 'hdri')
ENGINES = {'eevee': 'BLENDER_EEVEE', 'cycles': 'CYCLES'}
# Shot defaults; blender.py validates the types, this file only fills gaps.
DEFAULTS = {'engine': 'eevee', 'samples': 32, 'transparent': False, 'background': '#F4F4F1', 'shadowCatcher': False,
            'camera': {'preset': 'turntable', 'radius': 6.0, 'height': 1.6, 'fov': 35.0},
            'subject': {'kind': 'primitive', 'primitive': 'torus', 'scale': 1.0, 'rotation': [0, 0, 0]},
            'material': {'base': '#2F5BFF', 'metallic': 0.2, 'roughness': 0.35, 'emission': 0.0},
            'light': {'preset': 'studio', 'strength': 1.0}}


def linear(hex_colour):
    """sRGB '#rrggbb' to the linear RGBA tuple Blender's colour sockets expect."""
    channels = [int(hex_colour[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels) + (1.0,)


def camera_pose(camera, index, frames):
    """Location (x, y, z) and Euler rotation (rx, ry, rz) of the camera at frame `index`, looking at the origin.
    Angle 0 is in front of the subject (-Y); angles run counter-clockwise seen from above. turntable: one full turn over
    `frames` (the last frame stops short of the first, so a looped sequence has no repeated frame); orbit: `from`..`to`
    degrees; dolly: radius `from`..`to` at angle 0; static: angle `from`."""
    preset, radius, height = camera['preset'], float(camera['radius']), float(camera['height'])
    # `from`/`to` are degrees for orbit and static, radii for dolly; a dolly without them stays at `radius`.
    start, end = (float(camera.get('from', radius)), float(camera.get('to', radius))) if preset == 'dolly' else (float(camera.get('from', 0.0)), float(camera.get('to', 360.0)))
    t = index / frames if preset == 'turntable' else (index / (frames - 1) if frames > 1 else 0.0)
    angle = {'turntable': 2 * math.pi * t, 'orbit': math.radians(start + (end - start) * t), 'dolly': 0.0, 'static': math.radians(start)}[preset]
    if preset == 'dolly':
        radius = start + (end - start) * t
    pitch = math.atan2(height, radius)
    return (radius * math.sin(angle), -radius * math.cos(angle), height), (math.pi / 2 - pitch, 0.0, angle)


def frame_range(text, frames):
    """'a-b' (inclusive) or None to (first, last) inside 0..frames-1; raises ValueError when out of range."""
    first, last = (0, frames - 1) if not text else [int(part) for part in text.split('-', 1)] if '-' in text else (int(text), int(text))
    if not 0 <= first <= last < frames:
        raise ValueError(f'frames {text} must lie inside 0-{frames - 1}')
    return first, last


def merged(shot):
    """The shot with DEFAULTS filled in one level deep."""
    out = {**DEFAULTS, **shot}
    for key in ('camera', 'subject', 'material', 'light'):
        out[key] = {**DEFAULTS[key], **(shot.get(key) or {})}
    if 'material' not in shot and out['subject']['kind'] != 'primitive':
        out['material'] = None  # an imported model or a script keeps its own materials unless the shot names one
    return out


def node(tree, kind, **inputs):
    created = tree.nodes.new(kind)
    for name, value in inputs.items():
        created.inputs[name].default_value = value
    return created


def make_material(spec):
    material = bpy.data.materials.new('frameforge')
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


def make_subject(shot, spec_dir, generated):
    """Adds the subject at the origin and returns its objects (meshes under one root)."""
    subject = shot['subject']
    scale = float(subject['scale'])
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
        bpy.ops.import_scene.gltf(filepath=os.path.join(generated, subject['src']))
        objects = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
        root = bpy.data.objects.new('subject', None)
        bpy.context.scene.collection.objects.link(root)
        for obj in objects:
            if obj.parent is None:
                obj.parent = root
        bpy.context.view_layer.update()
        low, high = bounds(objects)
        # Normalise the model so its largest side is 2 units (a primitive's size) and it sits centred at the origin.
        size = max(high[i] - low[i] for i in range(3)) or 1.0
        root.scale = (2 * scale / size,) * 3
        root.location = tuple(-(low[i] + high[i]) / 2 * 2 * scale / size for i in range(3))
        root.rotation_euler = [math.radians(float(d)) for d in subject['rotation']]
        if shot.get('material'):
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


def make_world(scene, shot, generated):
    """Camera rays see the background hex (or nothing when transparent); everything else is lit by the preset's environment."""
    world = bpy.data.worlds.new('frameforge')
    scene.world = world
    tree = world.node_tree
    output = tree.nodes['World Output']
    light = shot['light']
    strength = float(light['strength'])
    if light['preset'] == 'hdri':
        environment = tree.nodes.new('ShaderNodeTexEnvironment')
        environment.image = bpy.data.images.load(os.path.join(generated, light['hdri']))
        lit = node(tree, 'ShaderNodeBackground', Strength=strength)
        tree.links.new(environment.outputs['Color'], lit.inputs['Color'])
    else:
        colour = linear(shot['background']) if shot['background'] != 'transparent' else (0.5, 0.5, 0.5, 1.0)
        lit = node(tree, 'ShaderNodeBackground', Color=colour, Strength=(0.35 if light['preset'] == 'studio' else 0.6) * strength)
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


def add_light(scene, name, kind, location, energy, colour=(1.0, 1.0, 1.0), size=3.0):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = colour
    if kind == 'AREA':
        data.size = size
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
    if light['preset'] == 'sunset':
        add_light(scene, 'sun', 'SUN', (-6, -4, 2.2), 4.0 * strength, colour=(1.0, 0.72, 0.5))
        add_light(scene, 'sky', 'AREA', (3, 2, 6), 150 * strength, colour=(0.75, 0.85, 1.0), size=8.0)
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
    material.surface_render_method = 'BLENDED'
    tree = material.node_tree
    tree.nodes.remove(tree.nodes['Principled BSDF'])
    occlusion = tree.nodes.new('ShaderNodeAmbientOcclusion')
    occlusion.samples, occlusion.inputs['Distance'].default_value = 16, 1.6
    # fac = 1 - 0.55 * (1 - ao): open ground is transparent, ground under the subject carries up to 55 % ink.
    opacity = tree.nodes.new('ShaderNodeMath'); opacity.operation = 'MULTIPLY_ADD'; opacity.inputs[1].default_value = 0.55; opacity.inputs[2].default_value = 0.45
    tree.links.new(occlusion.outputs['AO'], opacity.inputs[0])
    mix = tree.nodes.new('ShaderNodeMixShader')
    tree.links.new(opacity.outputs[0], mix.inputs['Fac'])
    tree.links.new(node(tree, 'ShaderNodeBsdfDiffuse', Color=(0, 0, 0, 1)).outputs[0], mix.inputs[1])
    tree.links.new(tree.nodes.new('ShaderNodeBsdfTransparent').outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], tree.nodes['Material Output'].inputs['Surface'])
    plane.data.materials.append(material)


def build(spec_path, shot_name, out, first, last):
    spec = json.load(open(spec_path))
    shot = merged(next(s for s in spec['shots'] if s['name'] == shot_name))
    spec_dir = os.path.dirname(os.path.abspath(spec_path))
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    generated = os.path.join(root, 'public', 'assets', 'generated', spec['slug'])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    render = scene.render
    render.engine = ENGINES[shot['engine']]
    render.resolution_x, render.resolution_y, render.resolution_percentage = int(shot['width']), int(shot['height']), 100
    render.fps, scene.frame_start, scene.frame_end = int(shot['fps']), 0, int(shot['frames']) - 1
    render.film_transparent = bool(shot['transparent']) or shot['background'] == 'transparent'
    render.image_settings.file_format, render.image_settings.color_depth, render.image_settings.compression = 'PNG', '8', 15
    render.image_settings.color_mode = 'RGBA' if render.film_transparent else 'RGB'
    render.use_motion_blur = False
    for flag in [p.identifier for p in render.bl_rna.properties if p.identifier.startswith('use_stamp')]:
        setattr(render, flag, False)
    scene.display_settings.display_device = 'sRGB'
    scene.view_settings.view_transform, scene.view_settings.look = 'Standard', 'None'
    scene.view_settings.exposure, scene.view_settings.gamma = 0.0, 1.0
    samples = int(shot['samples'])
    if shot['engine'] == 'cycles':
        scene.cycles.samples, scene.cycles.seed, scene.cycles.device = samples, int(shot.get('seed', 0)), 'CPU'
        scene.cycles.use_animated_seed = scene.cycles.use_adaptive_sampling = scene.cycles.use_denoising = False
        scene.cycles.film_transparent_glass = False
    else:
        scene.eevee.taa_render_samples = samples
        scene.eevee.use_shadows = True
    camera = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.sensor_fit, camera.data.lens_unit = 'HORIZONTAL', 'FOV'
    camera.data.angle = math.radians(float(shot['camera']['fov']))  # horizontal field of view
    camera.data.clip_end = 1000.0
    objects = make_subject(shot, spec_dir, generated)
    bpy.context.view_layer.update()
    make_world(scene, shot, generated)
    make_lights(scene, shot)
    if shot['shadowCatcher'] and objects:
        make_shadow_catcher(scene, shot, objects)
    os.makedirs(out, exist_ok=True)
    for index in range(first, last + 1):
        camera.location, camera.rotation_euler = camera_pose(shot['camera'], index, int(shot['frames']))
        scene.frame_set(index)
        render.filepath = os.path.join(out, f'{index:04d}.png')
        bpy.ops.render.render(write_still=True)
    print(f'frameforge-blender rendered {last - first + 1} frames of {shot_name} into {out}')


if __name__ == '__main__' and bpy is not None:
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 5:
        print('usage: blender -b --factory-startup --python blender_scene.py -- <3d.json> <shot> <out dir> <from> <to>', file=sys.stderr)
        sys.exit(2)
    build(args[0], args[1], args[2], int(args[3]), int(args[4]))
