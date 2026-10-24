"""The hero mug for the turntable shot: an open cylinder with a wall (solidify), a rounded rim and foot (bevel), an ink glaze
inside and a cut torus handle whose ends sink into the wall.

Runs inside Blender through `subject: {"kind": "script", "script": "shots/mug.py"}`; `build(scene, shot)` returns the mug's parts
so blender_scene.py can place the contact shadow under them. The body is 2 units tall and stands on z = -1 like a primitive.
"""
import math
import bmesh
import bpy


def linear(hex_colour):
    channels = [int(hex_colour[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels) + (1.0,)


def glaze(name, base, roughness):
    material = bpy.data.materials.new(name)
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = linear(base)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0.0
    return material


def build(scene, shot):
    material = shot['material'] or {'base': '#C8553D', 'roughness': 0.5}
    outer = glaze('glaze', material['base'], float(material.get('roughness', 0.5)))
    inner = glaze('interior', '#1F1B18', 0.7)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=2.0, vertices=128)
    body = bpy.context.active_object
    mesh = bmesh.new()
    mesh.from_mesh(body.data)
    bmesh.ops.delete(mesh, geom=[f for f in mesh.faces if f.normal.z > 0.9], context='FACES_ONLY')  # open the top
    mesh.to_mesh(body.data)
    mesh.free()
    body.data.materials.append(outer)
    body.data.materials.append(inner)
    wall = body.modifiers.new('wall', 'SOLIDIFY')
    wall.thickness, wall.offset, wall.use_even_offset, wall.material_offset = 0.09, -1.0, True, 1  # the inner shell takes the ink
    rim = body.modifiers.new('rim', 'BEVEL')
    rim.width, rim.segments, rim.limit_method, rim.angle_limit = 0.04, 6, 'ANGLE', math.radians(40)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    # A thin lip just inside the rim, so the opening has a second edge that catches the key light.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.905, minor_radius=0.03, major_segments=128, minor_segments=16, location=(0, 0, 0.955))
    lip = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    lip.data.materials.append(outer)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.1, major_segments=96, minor_segments=32, location=(1.3, 0, 0.05), rotation=(math.radians(90), 0, 0))
    handle = bpy.context.active_object
    mesh = bmesh.new()
    mesh.from_mesh(handle.data)
    for vert in mesh.verts:
        vert.co.y *= 1.2  # local y is world z after the 90 degree turn: a taller D, not a ring
    # Cut the part that would reach into the cavity; the open ends stay hidden inside the wall.
    bmesh.ops.delete(mesh, geom=[v for v in mesh.verts if v.co.x < 0.95 - 1.3], context='VERTS')
    mesh.to_mesh(handle.data)
    mesh.free()
    bpy.ops.object.shade_smooth()
    handle.data.materials.append(outer)
    lip.parent = handle.parent = body  # the body is at the origin, so the children keep their places
    body.rotation_euler = [math.radians(float(d)) for d in shot['subject'].get('rotation', [0, 0, 0])]
    return [body, lip, handle]
