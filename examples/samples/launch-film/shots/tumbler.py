"""The 늘온 tumbler: a lathed body with a rounded foot and shoulder in an ember powder coat, a stone steel band, an ink lid
with a domed top, a steel sip button and a carry loop, an ink silicone foot ring and a printed NEULON wordmark.

Runs inside Blender through `subject: {"kind": "script", "script": "shots/tumbler.py"}`. `subject.section: true` removes the
front-right quarter to show the double wall, the vacuum gap and the coffee. Every colour is a palette hex from 3d.json.
"""
import math
import bmesh
import bpy

INK, PAPER, ACCENT, SOFT = '#17161A', '#F1EBE0', '#D94F2B', '#D8CFC1'
STEPS = 160


def linear(hex_colour):
    channels = [int(hex_colour[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels) + (1.0,)


def material(name, base, roughness, metallic=0.0, peel=0.0, specular=0.5):
    """Principled material; `peel` adds the fine orange-peel bump of a powder coat."""
    mat = bpy.data.materials.new(name)
    tree = mat.node_tree
    bsdf = tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = linear(base)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Specular IOR Level'].default_value = specular
    if peel > 0:
        noise = tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value, noise.inputs['Detail'].default_value = 140.0, 2.0
        bump = tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value, bump.inputs['Distance'].default_value = peel, 0.01
        tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def lathe(name, profile, mat, closed_axis=True, bevel=0.018):
    """Spins an (r, z) profile around Z. Points on the axis close the surface; a bevel modifier rounds every profile corner."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0.0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.radians(360), steps=STEPS, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new('round', 'BEVEL')
        mod.width, mod.segments, mod.limit_method, mod.angle_limit = bevel, 5, 'ANGLE', math.radians(28)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.shade_smooth()
    mod = obj.modifiers.new('normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    return obj


def apply_all(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def wordmark(body, paper):
    """NEULON in Blender's built-in sans, wrapped onto the body's front by a shrinkwrap so it follows the taper."""
    curve = bpy.data.curves.new('wordmark', 'FONT')
    curve.body, curve.size, curve.space_character, curve.align_x, curve.align_y = 'NEULON', 0.25, 1.2, 'CENTER', 'CENTER'
    text = bpy.data.objects.new('wordmark', curve)
    bpy.context.scene.collection.objects.link(text)
    text.rotation_euler = (math.radians(90), math.radians(-90), 0)  # reads bottom to top up the front of the body
    text.location = (0, -0.7, -0.14)
    bpy.context.view_layer.objects.active = text
    text.select_set(True)
    bpy.ops.object.convert(target='MESH')
    text = bpy.context.active_object
    text.select_set(False)
    wrap = text.modifiers.new('wrap', 'SHRINKWRAP')
    wrap.target, wrap.wrap_method, wrap.offset = body, 'NEAREST_SURFACEPOINT', 0.012
    text.data.materials.append(paper)
    return text


def loop(ink):
    """The carry loop: a slim torus standing across the lid; its lower half sinks into the solid lid, so the mesh stays closed."""
    bpy.ops.mesh.primitive_torus_add(major_radius=0.23, minor_radius=0.05, major_segments=96, minor_segments=24, location=(0, 0, 1.45), rotation=(math.radians(90), 0, 0))
    obj = bpy.context.active_object
    obj.scale = (1.0, 1.25, 1.0)  # local y is world z: a taller arch
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(ink)
    return obj


def strip(scene, name, location, energy, size, length):
    """A tall softbox aimed at the tumbler: the long specular streak a satin powder coat shows in a product shot."""
    data = bpy.data.lights.new(name, 'AREA')
    data.shape, data.size, data.size_y, data.energy = 'RECTANGLE', size, length, energy
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    aim = bpy.data.objects.new(name + '-aim', None)
    scene.collection.objects.link(aim)
    track = light.constraints.new('TRACK_TO')
    track.target, track.track_axis, track.up_axis = aim, 'TRACK_NEGATIVE_Z', 'UP_Y'
    return light


def button(steel):
    """The sip button: a rounded steel pill set into the lid's front edge."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.4, 1.475))
    obj = bpy.context.active_object
    obj.scale = (0.26, 0.11, 0.05)
    bpy.ops.object.transform_apply(scale=True)
    mod = obj.modifiers.new('round', 'BEVEL')
    mod.width, mod.segments = 0.045, 6
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(steel)
    return obj


def build(scene, shot):
    section = bool(shot['subject'].get('section'))
    ember = material('powder', ACCENT, 0.36, peel=0.06)
    ink = material('lid', INK, 0.5, specular=0.1)
    rubber = material('silicone', INK, 0.85)
    steel = material('steel', SOFT, 0.24, metallic=1.0)
    paper = material('print', PAPER, 0.6)
    coffee = material('coffee', INK, 0.4, specular=0.3)
    cut = material('cut', PAPER, 0.7)
    stone = material('vacuum', SOFT, 0.8, specular=0.1)

    wall = 0.028 if section else 0.0
    outer = [(0.0, -1.29), (0.53, -1.29), (0.565, -1.22), (0.6, 0.6), (0.614, 0.9), (0.596, 0.975), (0.586, 0.99)]
    if section:
        outer += [(0.586 - wall, 0.99), (0.614 - wall, 0.9), (0.6 - wall, 0.6), (0.565 - wall, -1.22), (0.0, -1.22)]  # the outer shell, open at the neck
    body = lathe('body', outer, ember, bevel=0.008 if section else 0.018)
    foot = lathe('foot', [(0.0, -1.42), (0.53, -1.42), (0.556, -1.38), (0.556, -1.3), (0.54, -1.285), (0.0, -1.285)], rubber, bevel=0.022)
    band = lathe('band', [(0.47, 0.985), (0.592, 0.985), (0.592, 1.17), (0.47, 1.17), (0.47, 0.985)] if section else [(0.0, 0.985), (0.592, 0.985), (0.592, 1.17), (0.0, 1.17)], steel, bevel=0.008)
    lid = None if section else lathe('lid', [(0.0, 1.17), (0.606, 1.17), (0.606, 1.4), (0.58, 1.45), (0.3, 1.465), (0.0, 1.47)], ink, bevel=0.03)
    # The section leaves the lid off: the cut reads as the two walls and the coffee, not as a notched cap.
    parts = [body, foot, band] + ([] if section else [lid, loop(ink), button(steel), wordmark(body, paper)])
    if section:
        # The inner steel wall with the coffee in it; the gap between the two walls is the vacuum.
        inner = lathe('inner', [(0.0, -1.14), (0.44, -1.14), (0.468, -1.08), (0.49, 0.985), (0.47, 0.985), (0.448, -1.08), (0.42, -1.115), (0.0, -1.115)], steel, bevel=0.0)
        drink = lathe('coffee', [(0.0, -1.11), (0.445, -1.11), (0.466, 0.62), (0.0, 0.62)], coffee, bevel=0.0)
        parts += [inner, drink]
        # Faces of the vacuum gap (the shell's inside, the inner wall's outside) turn stone, so the void reads as a band of its own.
        for obj, outward in ((body, False), (inner, True)):
            obj.data.materials.append(stone)
            for poly in obj.data.polygons:
                radial = poly.normal.x * poly.center.x + poly.normal.y * poly.center.y
                if abs(poly.normal.z) < 0.5 and (radial > 0) == outward:
                    poly.material_index = len(obj.data.materials) - 1
        for obj in parts:
            apply_all(obj)
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.8, -0.8, 0.0))
        cutter = bpy.context.active_object
        cutter.scale = (1.6, 1.6, 4.0)
        cutter.data.materials.append(cut)
        cutter.hide_render = True
        for obj in parts:
            mod = obj.modifiers.new('cut', 'BOOLEAN')
            mod.operation, mod.solver, mod.object, mod.material_mode = 'DIFFERENCE', 'EXACT', cutter, 'INDEX'
            apply_all(obj)
            soften = obj.modifiers.new('soften', 'BEVEL')
            soften.width, soften.segments, soften.limit_method, soften.angle_limit = 0.006, 3, 'ANGLE', math.radians(60)
        bpy.data.objects.remove(cutter)
    # Two hard rims from behind separate the silhouette from any background.
    strip(scene, 'rim-left', (-2.6, 3.9, 2.2), 900.0, 0.22, 4.0)
    strip(scene, 'rim-right', (2.8, 3.6, 1.8), 900.0, 0.22, 4.0)
    root = bpy.data.objects.new('tumbler', None)
    scene.collection.objects.link(root)
    for obj in parts:
        obj.parent = root
    root.rotation_euler = [math.radians(float(d)) for d in shot['subject'].get('rotation', [0, 0, 0])]
    bpy.context.view_layer.update()
    return parts
