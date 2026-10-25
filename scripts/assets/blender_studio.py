"""Studio parts for 3d.json, built inside Blender's Python by blender_scene.py: the procedural soft-box world, the light rigs
(three-point, product, rim), subject ops, scatter, keyed motion, and the --inspect and --review reports.

Everything here is a function of the shot (scatter uses random.Random(seed)), so the same shot gives the same scene.
"""
import json, math, os, random

import bpy, bmesh

from blender_scene import (FILL, REVIEW_VIEWS, camera_pose, fit_camera, frame_extent, light_ratio, moving_bounds, subject_class,
                           subject_pose)

# Soft boxes of the procedural studio: (azimuth, elevation, half width, half height, radiance). Azimuth 0 is in front of the
# subject (-Y), as for the camera; half sizes are tangents of the box's angular half size. A big key front-left, a top box,
# two tall strips behind (the bright edges on glass and gloss), a dim fill on the right, and a wide low glow straight
# behind: glass refracts it, so a bottle on a dark background reads as a clear window instead of a black lump.
SOFTBOXES = ((-45, 30, 0.5, 0.36, 6.0), (0, 82, 0.7, 0.7, 1.6), (-125, 8, 0.07, 0.95, 9.0), (128, 4, 0.07, 0.95, 9.0),
             (75, 14, 0.45, 0.35, 1.6), (180, 4, 1.1, 0.5, 0.5))


def _node(tree, kind, **inputs):
    made = tree.nodes.new(kind)
    for name, value in inputs.items():
        made.inputs[name].default_value = value
    return made


def _math(tree, operation, a, b=None):
    made = tree.nodes.new('ShaderNodeMath')
    made.operation = operation
    for slot, value in ((0, a), (1, b)):
        if value is None:
            continue
        if isinstance(value, (int, float)):
            made.inputs[slot].default_value = value
        else:
            tree.links.new(value, made.inputs[slot])
    return made.outputs[0]


def _dot(tree, vector, constant):
    made = tree.nodes.new('ShaderNodeVectorMath')
    made.operation = 'DOT_PRODUCT'
    tree.links.new(vector, made.inputs[0])
    made.inputs[1].default_value = constant
    return made.outputs['Value']


def _falloff(tree, value, edge):
    """1 inside |value| < 0.8 edge, easing to 0 at edge."""
    made = tree.nodes.new('ShaderNodeMapRange')
    made.interpolation_type = 'SMOOTHSTEP'
    made.inputs['From Min'].default_value, made.inputs['From Max'].default_value = 0.8 * edge, edge
    made.inputs['To Min'].default_value, made.inputs['To Max'].default_value = 1.0, 0.0
    tree.links.new(_math(tree, 'ABSOLUTE', value), made.inputs['Value'])
    return made.outputs['Result']


def direction(azimuth, elevation):
    a, e = math.radians(azimuth), math.radians(elevation)
    return (math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))


def softbox_world(tree, strength, light):
    """A dark studio room lit by SOFTBOXES, as a world Background shader: reflections and refraction see bright soft
    rectangles instead of a black void. `light.rotate` turns the room, `light.environment` (#rrggbb) tints it."""
    from blender_scene import linear
    coords = tree.nodes.new('ShaderNodeTexCoord')
    vector = coords.outputs['Generated']
    if light.get('rotate'):
        mapping = _node(tree, 'ShaderNodeMapping', Rotation=(0.0, 0.0, math.radians(float(light['rotate']))))
        tree.links.new(vector, mapping.inputs['Vector'])
        vector = mapping.outputs['Vector']
    unit = tree.nodes.new('ShaderNodeVectorMath')
    unit.operation = 'NORMALIZE'
    tree.links.new(vector, unit.inputs[0])
    d = unit.outputs['Vector']
    floor = tree.nodes.new('ShaderNodeMapRange')  # 0.8 % below the horizon rising to 3 % overhead
    floor.inputs['From Min'].default_value, floor.inputs['From Max'].default_value = -0.4, 0.5
    floor.inputs['To Min'].default_value, floor.inputs['To Max'].default_value = 0.008, 0.03
    tree.links.new(_dot(tree, d, (0.0, 0.0, 1.0)), floor.inputs['Value'])
    total = floor.outputs['Result']
    for azimuth, elevation, half_w, half_h, radiance in SOFTBOXES:
        c = direction(azimuth, elevation)
        right = (math.cos(math.radians(azimuth)), math.sin(math.radians(azimuth)), 0.0)
        up = (c[1] * right[2] - c[2] * right[1], c[2] * right[0] - c[0] * right[2], c[0] * right[1] - c[1] * right[0])
        depth = _dot(tree, d, c)
        a = _math(tree, 'DIVIDE', _dot(tree, d, right), depth)  # gnomonic: a rectangle on the plane touching the sphere at c
        b = _math(tree, 'DIVIDE', _dot(tree, d, up), depth)
        mask = _math(tree, 'MULTIPLY', _math(tree, 'MULTIPLY', _falloff(tree, a, half_w), _falloff(tree, b, half_h)), _math(tree, 'GREATER_THAN', depth, 0.0))
        total = _math(tree, 'ADD', total, _math(tree, 'MULTIPLY', mask, radiance))
    background = _node(tree, 'ShaderNodeBackground', Strength=strength)
    if light.get('environment'):
        tint = tree.nodes.new('ShaderNodeMix')
        tint.data_type, tint.blend_type = 'RGBA', 'MULTIPLY'
        tint.inputs['Factor'].default_value = 1.0
        tint.inputs['B'].default_value = linear(light['environment'])
        tree.links.new(total, tint.inputs['A'])
        tree.links.new(tint.outputs['Result'], background.inputs['Color'])
    else:
        tree.links.new(total, background.inputs['Color'])
    return background


def rig(scene, preset, ratio, strength, add_light):
    """three-point: soft key front-left, broad fill right, rim behind. product: a top box, two tall strips behind the sides
    (the edge lines glass and gloss need), a low front fill. rim: two strong strips behind, a weak key, almost no fill.
    Energies are scaled by `ratio` (key, fill, rim: light_ratio) and `strength`."""
    key, fill, rim = (r * strength for r in ratio)
    if preset == 'three-point':
        add_light(scene, 'key', 'AREA', (-4.0, -4.5, 4.0), 450 * key, size=3.0)
        add_light(scene, 'fill', 'AREA', (4.8, -3.2, 1.4), 700 * fill, size=5.0)
        add_light(scene, 'rim', 'AREA', (1.8, 5.0, 3.6), 900 * rim, size=2.0)
    elif preset == 'product':
        add_light(scene, 'top', 'AREA', (0.0, -0.8, 6.5), 650 * key, size=5.0)
        add_light(scene, 'strip-left', 'AREA', (-4.2, 1.2, 0.6), 650 * rim, size=0.7, size_y=5.0)
        add_light(scene, 'strip-right', 'AREA', (4.2, 1.2, 0.6), 650 * rim, size=0.7, size_y=5.0)
        add_light(scene, 'front', 'AREA', (0.0, -6.0, 0.4), 300 * fill, size=6.0)
    else:
        add_light(scene, 'key', 'AREA', (-3.5, -4.5, 3.0), 250 * key, size=3.0)
        add_light(scene, 'fill', 'AREA', (4.5, -4.0, 0.5), 150 * fill, size=4.0)
        add_light(scene, 'rim-left', 'AREA', (-3.8, 3.8, 2.2), 1300 * rim, size=1.2, size_y=4.0)
        add_light(scene, 'rim-right', 'AREA', (3.8, 3.6, 1.4), 1300 * rim, size=1.2, size_y=4.0)


def _bake(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    obj.modifiers.clear()
    obj.data = mesh


def apply_ops(objects, ops):
    """subject.ops on every body mesh, in order, then baked once. Sizes are in scene units, whatever the mesh's own scale.
    bevel {width, segments}, subdivide {levels}, remesh {voxel}, smooth {factor, iterations}, inflate {amount} (along the
    normals), displace {strength, scale} (cloud noise along the normals; subdivide or remesh first so there is geometry)."""
    if not ops:
        return
    for obj in objects:
        if obj.type != 'MESH' or obj.get('role', 'body') != 'body':
            continue
        unit = max(obj.matrix_world.to_scale()) or 1.0  # world units to the mesh's own
        for at, op in enumerate(ops):
            kind = op['op']
            if kind == 'bevel':
                mod = obj.modifiers.new(f'{at}-bevel', 'BEVEL')
                mod.width, mod.segments, mod.limit_method = float(op.get('width', 0.02)) / unit, int(op.get('segments', 3)), 'ANGLE'
            elif kind == 'subdivide':
                mod = obj.modifiers.new(f'{at}-subdivide', 'SUBSURF')
                mod.levels = mod.render_levels = int(op.get('levels', 1))
            elif kind == 'remesh':
                mod = obj.modifiers.new(f'{at}-remesh', 'REMESH')
                mod.mode, mod.voxel_size, mod.adaptivity = 'VOXEL', float(op.get('voxel', 0.015)) / unit, 0.0
            elif kind == 'smooth':
                mod = obj.modifiers.new(f'{at}-smooth', 'SMOOTH')
                mod.factor, mod.iterations = float(op.get('factor', 0.5)), int(op.get('iterations', 8))
            elif kind == 'inflate':
                mod = obj.modifiers.new(f'{at}-inflate', 'DISPLACE')
                mod.mid_level, mod.strength = 0.0, float(op.get('amount', 0.01)) / unit
            elif kind == 'displace':
                texture = bpy.data.textures.new(f'{obj.name}-noise-{at}', 'CLOUDS')
                texture.noise_scale, texture.noise_depth = float(op.get('scale', 0.25)) / unit, 2
                mod = obj.modifiers.new(f'{at}-displace', 'DISPLACE')
                mod.texture, mod.texture_coords, mod.mid_level, mod.strength = texture, 'LOCAL', 0.5, float(op.get('strength', 0.02)) / unit
        _bake(obj)
        obj.data.shade_smooth()


def _shape_mesh(shape):
    bm = bmesh.new()
    if shape == 'cube':
        bmesh.ops.create_cube(bm, size=1.4)
        bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=0.12, segments=3, affect='EDGES')
    elif shape == 'gem':
        points = [(math.cos(2 * math.pi * i / 8), math.sin(2 * math.pi * i / 8), 0.25) for i in range(8)] + [(0, 0, 0.55), (0, 0, -1.0)]
        bmesh.ops.convex_hull(bm, input=[bm.verts.new(p) for p in points])
    else:
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
    mesh = bpy.data.meshes.new(f'scatter-{shape}')
    bm.to_mesh(mesh)
    bm.free()
    if shape == 'sphere':
        mesh.shade_smooth()
    return mesh


def scatter(scene, shot, objects, low, high):
    """`scatter` {count, shape: sphere|cube|gem, size: [min, max], radius: [inner, outer] from the subject's centre, flatten
    (0..1 squashes the shell towards a ring), seed, spin (degrees per frame about the vertical), material: trim|body}: linked
    copies of one mesh (instances share it) placed by random.Random(seed) under a holder the camera keys can spin."""
    spec = shot['scatter']
    rng = random.Random(int(spec.get('seed', 1)))
    mesh = _shape_mesh(spec.get('shape', 'sphere'))
    if spec.get('material', 'trim') == 'body' and objects and objects[0].data.materials:
        mesh.materials.append(objects[0].data.materials[0])
    else:
        import blender_looks
        from blender_scene import linear
        trim = linear((shot['material'] or {}).get('trim', '#D8B26E'))
        mesh.materials.append(blender_looks.plain_material('scatter', **{'Base Color': trim, 'Metallic': 1.0, 'Roughness': 0.15}))
    holder = bpy.data.objects.new('scatter', None)
    scene.collection.objects.link(holder)
    holder.location = tuple((low[i] + high[i]) / 2 for i in range(3))
    holder['scatter'] = True
    inner, outer = (float(v) for v in spec.get('radius', [1.6, 2.6]))
    small, large = (float(v) for v in spec.get('size', [0.03, 0.08]))
    flatten = float(spec.get('flatten', 0.0))
    made = []
    for i in range(int(spec.get('count', 24))):
        v = [rng.gauss(0, 1) for _ in range(3)]
        length = math.sqrt(sum(c * c for c in v)) or 1.0
        r = inner + (outer - inner) * rng.random()
        obj = bpy.data.objects.new(f'scatter-{i}', mesh)
        scene.collection.objects.link(obj)
        obj.location = (v[0] / length * r, v[1] / length * r, v[2] / length * r * (1 - flatten))
        obj.rotation_euler = tuple(rng.uniform(0, 2 * math.pi) for _ in range(3))
        obj.scale = (small + (large - small) * rng.random(),) * 3
        obj.parent = holder
        obj['role'], obj['scatter'] = 'scatter', True
        made.append(obj)
    return made


def key_motion(scene, shot, camera, objects):
    """Keys the camera (camera_pose), the subject (subject_pose on a pivot over the subject's roots) and the scatter spin on
    every frame of the shot, linear in between: frame_set poses the scene and motion blur sees the real movement."""
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    frames = int(shot['frames'])
    subject = shot['subject']
    pivot = None
    if subject.get('keys'):
        pivot = bpy.data.objects.new('pivot', None)
        scene.collection.objects.link(pivot)
        roots = set()
        for obj in objects:
            if obj.get('scatter'):
                continue
            while obj.parent is not None:
                obj = obj.parent
            roots.add(obj)
        for obj in roots:
            obj.parent = pivot
    holder = scene.objects.get('scatter')
    spin = float((shot['scatter'] or {}).get('spin', 0.0))
    for index in range(frames):
        camera.location, camera.rotation_euler = camera_pose(shot['camera'], index, frames)
        camera.keyframe_insert('location', frame=index)
        camera.keyframe_insert('rotation_euler', frame=index)
        if pivot is not None:
            location, rotation, scale = subject_pose(subject, index)
            pivot.location, pivot.rotation_euler, pivot.scale = location, [math.radians(d) for d in rotation], (scale,) * 3
            for path in ('location', 'rotation_euler', 'scale'):
                pivot.keyframe_insert(path, frame=index)
        if holder is not None and spin:
            holder.rotation_euler = (0.0, 0.0, math.radians(spin * index))
            holder.keyframe_insert('rotation_euler', frame=index)


def _has_normal_map(obj):
    return any(node.type == 'NORMAL_MAP' for slot in obj.material_slots if slot.material and slot.material.node_tree
               for node in slot.material.node_tree.nodes)


def inspect(scene, shot, objects, context):
    """The numbers to read before the pictures: what is in the scene, its size, the lights, and whether the move keeps
    the subject inside the frame (frame_extent over 17 frames of the move; above 1 a corner leaves the frame)."""
    low, high = context['bounds']
    aspect = int(shot['width']) / int(shot['height'])
    sweep_low, sweep_high = moving_bounds(shot, low, high)
    corners = [(x, y, z) for x in (sweep_low[0], sweep_high[0]) for y in (sweep_low[1], sweep_high[1]) for z in (sweep_low[2], sweep_high[2])]
    extent = frame_extent(shot['camera'], corners, int(shot['frames']), aspect, samples=17)
    meshes = [obj for obj in objects if obj.type == 'MESH']
    report = {
        'shot': shot['name'], 'engine': shot['engine'], 'view': shot['view'], 'look': shot['look'], 'source': context['source'],
        'class': subject_class(shot), 'ratio': list(light_ratio(shot)),
        'bounds': {'min': [round(v, 3) for v in low], 'max': [round(v, 3) for v in high], 'size': [round(high[i] - low[i], 3) for i in range(3)]},
        'objects': [{'name': obj.name, 'role': obj.get('role', 'body'), 'faces': len(obj.data.polygons),
                     'materials': [slot.material.name for slot in obj.material_slots if slot.material], 'normalMap': _has_normal_map(obj)}
                    for obj in meshes if not obj.get('scatter')],
        'scatter': sum(1 for obj in meshes if obj.get('scatter')),
        'lights': [{'name': obj.name, 'type': obj.data.type, 'energy': round(obj.data.energy, 1), 'at': [round(v, 2) for v in obj.location]}
                   for obj in scene.objects if obj.type == 'LIGHT'],
        'world': 'softbox' if any(n.type == 'MAP_RANGE' for n in scene.world.node_tree.nodes) else 'hdri' if any(n.type == 'TEX_ENVIRONMENT' for n in scene.world.node_tree.nodes) else 'flat',
        'camera': {k: (round(v, 3) if isinstance(v, float) else v) for k, v in shot['camera'].items()},
        'framing': {'extent': round(extent, 3), 'cropped': extent > 0.98, 'small': extent < 0.45},
    }
    warnings = []
    if extent > 0.98:
        warnings.append('the subject leaves the frame during the move: leave camera.radius out to auto-frame, or raise it')
    elif extent < 0.45:
        warnings.append('the subject fills less than half the frame: lower camera.radius or camera.fov, or leave radius out')
    if shot['subject'].get('liquid') and shot['engine'] == 'eevee':
        warnings.append('EEVEE refracts one layer, so liquid behind a glass wall reads weakly: render a filled bottle with cycles')
    if shot['view'] != 'standard' and shot['background'] != 'transparent':
        warnings.append(f"view {shot['view']} shifts the background away from {shot['background']}: use standard when the hex must match")
    if sum(r['faces'] for r in report['objects']) > 3_000_000:
        warnings.append('more than 3 M faces: lower subject.detail or drop a subdivide op')
    report['warnings'] = warnings
    return report


def review(scene, shot, camera, context, out):
    """REVIEW_VIEWS from a static camera framed per view, one PNG each (review-0.png ...), at a third of the shot's width
    (at least 480 px); blender.py tiles them into review.png. The camera's keys are dropped so frame 0 poses the rest."""
    low, high = context['bounds']
    aspect = int(shot['width']) / int(shot['height'])
    camera.animation_data_clear()
    scene.render.resolution_x = max(480, int(shot['width']) // 3)
    scene.render.resolution_y = round(scene.render.resolution_x / aspect)
    scene.frame_set(0)
    for at, (label, angle, elevation) in enumerate(REVIEW_VIEWS):
        view = fit_camera({'preset': 'static', 'from': angle, 'elevation': elevation, 'fov': shot['camera']['fov']}, low, high, 1, aspect, FILL)
        camera.location, camera.rotation_euler = camera_pose(view, 0, 1)
        scene.objects['target'].location = (0.0, 0.0, view['target'])
        if shot['dof']:
            camera.data.dof.focus_distance = math.dist(camera.location, (0.0, 0.0, view['target']))
        scene.render.filepath = os.path.join(out, f'review-{at}.png')
        bpy.ops.render.render(write_still=True)
    with open(os.path.join(out, 'review.json'), 'w') as f:
        json.dump([label for label, _, _ in REVIEW_VIEWS], f)
