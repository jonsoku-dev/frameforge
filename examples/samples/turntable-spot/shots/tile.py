"""A stack of three rounded stoneware tiles for the dolly shot: bevelled slabs, each turned a little, with a low procedural
grain in the glaze so the surface reads as the camera comes close.

Runs inside Blender through `subject: {"kind": "script", "script": "shots/tile.py"}`; `build(scene, shot)` returns the tiles.
"""
import math
import bpy

SIZE, THICK, GAP = 2.6, 0.34, 0.03


def linear(hex_colour):
    channels = [int(hex_colour[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels) + (1.0,)


def stoneware(base, roughness):
    """Matte glaze with a fine noise bump (strength 0.12) that catches the key light without changing the colour."""
    material = bpy.data.materials.new('stoneware')
    tree = material.node_tree
    bsdf = tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = linear(base)
    bsdf.inputs['Roughness'].default_value = roughness
    noise = tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value, noise.inputs['Detail'].default_value, noise.inputs['Roughness'].default_value = 18.0, 4.0, 0.6
    bump = tree.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value, bump.inputs['Distance'].default_value = 0.12, 0.05
    tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return material


def build(scene, shot):
    material = shot['material'] or {'base': '#1F1B18', 'roughness': 0.4}
    glaze = stoneware(material['base'], float(material.get('roughness', 0.4)))
    tiles = []
    for index, turn in enumerate((-9, 4, -2)):
        z = -(3 * THICK + 2 * GAP) / 2 + THICK / 2 + index * (THICK + GAP)  # the stack is centred on the origin the camera looks at
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, z), rotation=(0, 0, math.radians(turn)))
        tile = bpy.context.active_object
        tile.scale = (SIZE, SIZE, THICK)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)  # an even bevel needs unit scale
        bevel = tile.modifiers.new('round', 'BEVEL')
        bevel.width, bevel.segments = 0.09, 10
        smooth = tile.modifiers.new('smooth', 'SUBSURF')
        smooth.levels = smooth.render_levels = 1
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
        tile.data.materials.append(glaze)
        tiles.append(tile)
    return tiles
