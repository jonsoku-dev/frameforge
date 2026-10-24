"""A subject script for the fixture: `build(scene, shot)` adds the subject and returns it."""
import bpy


def build(scene, shot):
    bpy.ops.mesh.primitive_cone_add(radius1=1.0, depth=2.0, vertices=32)
    cone = bpy.context.active_object
    cone.data.materials.append(bpy.data.materials.new('cone'))
    return cone
