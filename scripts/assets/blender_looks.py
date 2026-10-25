"""Hero looks for 3d.json (`look`), built inside Blender's Python by blender_scene.py.

Each look is a shader graph written into a material's node tree, returning its output socket, so two looks can be mixed by
the scanline-to-glossy sweep (a horizontal wipe whose height is set per frame). Geometry looks add modifiers: `wireframe`
puts an emissive lattice on a remeshed copy of the subject, `toon` an inverted-hull outline. Everything is procedural with
fixed parameters (no random seeds), so the same shot gives the same picture.
"""
import bpy

INK = (0.012, 0.012, 0.016, 1.0)


def add(tree, kind, **inputs):
    created = tree.nodes.new(kind)
    for name, value in inputs.items():
        created.inputs[name].default_value = value
    return created


def link(tree, a, b):
    tree.links.new(a, b)


def mix_colour(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3)) + (1.0,)


def principled(tree, **inputs):
    return add(tree, 'ShaderNodeBsdfPrincipled', **inputs)


def emission(tree, colour, strength):
    return add(tree, 'ShaderNodeEmission', Color=colour, Strength=strength)


def add_shader(tree, a, b):
    node = tree.nodes.new('ShaderNodeAddShader')
    link(tree, a, node.inputs[0])
    link(tree, b, node.inputs[1])
    return node.outputs[0]


def mix_shader(tree, factor, a, b):
    """factor 0 shows a, 1 shows b; factor is a socket or a number."""
    node = tree.nodes.new('ShaderNodeMixShader')
    if isinstance(factor, (int, float)):
        node.inputs['Fac'].default_value = factor
    else:
        link(tree, factor, node.inputs['Fac'])
    link(tree, a, node.inputs[1])
    link(tree, b, node.inputs[2])
    return node.outputs[0]


def math(tree, operation, a, b=None):
    node = tree.nodes.new('ShaderNodeMath')
    node.operation = operation
    for slot, value in ((0, a), (1, b)):
        if value is None:
            continue
        if isinstance(value, (int, float)):
            node.inputs[slot].default_value = value
        else:
            link(tree, value, node.inputs[slot])
    return node.outputs[0]


def smoothstep(tree, value, low, high, invert=False):
    node = tree.nodes.new('ShaderNodeMapRange')
    node.interpolation_type = 'SMOOTHSTEP'
    node.inputs['From Min'].default_value, node.inputs['From Max'].default_value = low, high
    node.inputs['To Min'].default_value, node.inputs['To Max'].default_value = (1.0, 0.0) if invert else (0.0, 1.0)
    link(tree, value, node.inputs['Value'])
    return node.outputs['Result']


def driven(tree, context, key):
    """A per-frame number (`level` of the sweep, `scroll` of the scan lines) read from the scene's custom property
    `frameforge_<key>`, which blender_scene sets every frame. An attribute is a shader uniform: changing it does not
    recompile the material, as changing a Value node's default would (that cost seconds per frame)."""
    attribute = tree.nodes.new('ShaderNodeAttribute')
    attribute.attribute_type, attribute.attribute_name = 'VIEW_LAYER', f'frameforge_{key}'
    return attribute.outputs['Fac']


def object_z(tree):
    """World-space height: scan lines and the sweep level are in scene units, the same for every part of the subject."""
    position = tree.nodes.new('ShaderNodeNewGeometry')
    split = tree.nodes.new('ShaderNodeSeparateXYZ')
    link(tree, position.outputs['Position'], split.inputs['Vector'])
    return split.outputs['Z']


def facing(tree, blend=0.5):
    weight = add(tree, 'ShaderNodeLayerWeight', Blend=blend)
    return weight.outputs['Facing']


def dark_body(tree, colour):
    """The body behind scan lines or a wire lattice: near-black glass-smooth lacquer, so the form reads in reflections."""
    return principled(tree, **{'Base Color': mix_colour(INK, colour, 0.08), 'Roughness': 0.35, 'Specular IOR Level': 0.12,
                               'Coat Weight': 0.25, 'Coat Roughness': 0.2}).outputs[0]


def look_glossy(tree, c):
    return principled(tree, **{'Base Color': c['base'], 'Roughness': 0.4, 'Coat Weight': 1.0, 'Coat Roughness': 0.06,
                               'Specular IOR Level': 0.6}).outputs[0]


def look_glass(tree, c):
    # A clear coat doubles the edge reflections and a thin film adds a faint rainbow, standing in for the dispersion
    # EEVEE does not render; without them glass on a dark background reads as grey plastic.
    return principled(tree, **{'Base Color': mix_colour((1, 1, 1), c['base'], 0.3), 'Roughness': 0.0, 'IOR': c['ior'],
                               'Transmission Weight': 1.0, 'Coat Weight': 1.0, 'Coat Roughness': 0.0,
                               'Thin Film Thickness': 320.0, 'Thin Film IOR': 1.6}).outputs[0]


def look_chrome(tree, c):
    return principled(tree, **{'Base Color': mix_colour((0.92, 0.92, 0.94), c['base'], 0.15), 'Metallic': 1.0, 'Roughness': 0.05}).outputs[0]


def look_plush(tree, c):
    fuzz = add(tree, 'ShaderNodeTexNoise', Scale=900.0, Detail=2.0, Roughness=0.6)
    bump = add(tree, 'ShaderNodeBump', Strength=0.35, Distance=0.02)
    link(tree, fuzz.outputs['Fac'], bump.inputs['Height'])
    shader = principled(tree, **{'Base Color': c['base'], 'Roughness': 0.9, 'Sheen Weight': 1.0, 'Sheen Roughness': 0.3,
                                 'Sheen Tint': (1.0, 1.0, 1.0, 1.0), 'Subsurface Weight': 0.15, 'Subsurface Scale': 0.05})
    link(tree, bump.outputs['Normal'], shader.inputs['Normal'])
    return shader.outputs[0]


def look_toon(tree, c):
    """Cel shading: diffuse lighting quantised to three bands plus a hard highlight (EEVEE only: Shader to RGB)."""
    lit = tree.nodes.new('ShaderNodeShaderToRGB')
    link(tree, add(tree, 'ShaderNodeBsdfDiffuse', Color=(1, 1, 1, 1)).outputs[0], lit.inputs[0])
    bands = tree.nodes.new('ShaderNodeValToRGB')
    bands.color_ramp.interpolation = 'CONSTANT'
    stops = bands.color_ramp.elements
    stops[0].color = mix_colour(INK, c['base'], 0.55)
    stops[1].position, stops[1].color = 0.12, c['base']
    stops.new(0.55).color = mix_colour(c['base'], (1, 1, 1), 0.35)
    link(tree, lit.outputs['Color'], bands.inputs['Fac'])
    shine = tree.nodes.new('ShaderNodeShaderToRGB')
    link(tree, add(tree, 'ShaderNodeBsdfGlossy', Roughness=0.15).outputs[0], shine.inputs[0])
    spot = smoothstep(tree, shine.outputs['Color'], 0.55, 0.6)
    paint = tree.nodes.new('ShaderNodeMix')
    paint.data_type, paint.blend_type = 'RGBA', 'MIX'
    paint.inputs['B'].default_value = mix_colour(c['base'], (1, 1, 1), 0.8)
    link(tree, math(tree, 'MULTIPLY', spot, 0.85), paint.inputs['Factor'])
    link(tree, bands.outputs['Color'], paint.inputs['A'])
    body = emission(tree, (1, 1, 1, 1), 1.0)
    link(tree, paint.outputs['Result'], body.inputs['Color'])
    return body.outputs[0]


def look_scanline(tree, c, context):
    """Horizontal emissive slices in object space over a dark body, with a faint rim so the silhouette holds."""
    z = object_z(tree)
    phase = math(tree, 'ADD', math(tree, 'MULTIPLY', z, c['lines']), driven(tree, context, 'scroll'))
    centre = math(tree, 'ABSOLUTE', math(tree, 'SUBTRACT', math(tree, 'FRACT', phase), 0.5))
    line = smoothstep(tree, centre, 0.5 - c['width'], 0.5 - c['width'] * 0.35)
    glow = emission(tree, c['accent'], c['glow'])
    if context.get('engine') == 'eevee':
        # Lines brighten where the key light falls and dim on the shadow side, so the face reads through the slices.
        lit = tree.nodes.new('ShaderNodeShaderToRGB')
        link(tree, add(tree, 'ShaderNodeBsdfDiffuse', Color=(1, 1, 1, 1)).outputs[0], lit.inputs[0])
        grey = tree.nodes.new('ShaderNodeRGBToBW')
        link(tree, lit.outputs['Color'], grey.inputs[0])
        shade = math(tree, 'MINIMUM', math(tree, 'MULTIPLY', grey.outputs[0], 1.2), 1.0)
        link(tree, math(tree, 'MULTIPLY', math(tree, 'ADD', math(tree, 'POWER', shade, 2.0), 0.06), c['glow']), glow.inputs['Strength'])
    glow = glow.outputs[0]
    rim = emission(tree, c['accent'], 0.35 * c['glow']).outputs[0]
    body = mix_shader(tree, smoothstep(tree, facing(tree, 0.35), 0.6, 1.0), dark_body(tree, c['base']), rim)
    return mix_shader(tree, line, body, glow)


def look_wireframe(tree, c):
    """The body under the lattice (the lattice itself is a separate object, see wire_cage)."""
    return dark_body(tree, c['base'])


def look_holographic(tree, c):
    """Thin-film iridescence on a dark clear-coated body, plus a rainbow fresnel rim that shifts with height."""
    body = principled(tree, **{'Base Color': mix_colour(INK, c['base'], 0.3), 'Metallic': 0.6, 'Roughness': 0.12, 'Coat Weight': 1.0,
                               'Coat Roughness': 0.02, 'Thin Film Thickness': 520.0, 'Thin Film IOR': 1.45}).outputs[0]
    hue = math(tree, 'FRACT', math(tree, 'ADD', math(tree, 'MULTIPLY', facing(tree, 0.3), 0.9), math(tree, 'MULTIPLY', object_z(tree), 0.35)))
    rainbow = tree.nodes.new('ShaderNodeValToRGB')
    stops = rainbow.color_ramp.elements
    stops[0].color = (0.1, 0.9, 1.0, 1.0)
    stops[1].position, stops[1].color = 1.0, (0.1, 0.9, 1.0, 1.0)
    stops.new(0.33).color = (1.0, 0.15, 0.85, 1.0)
    stops.new(0.66).color = (1.0, 0.85, 0.15, 1.0)
    link(tree, hue, rainbow.inputs['Fac'])
    rim = tree.nodes.new('ShaderNodeEmission')
    link(tree, rainbow.outputs['Color'], rim.inputs['Color'])
    link(tree, math(tree, 'MULTIPLY', smoothstep(tree, facing(tree, 0.3), 0.35, 1.0), c['glow'] * 0.6), rim.inputs['Strength'])
    return add_shader(tree, body, rim.outputs[0])


def shader(tree, look, colours, context):
    if look == 'scanline':
        return look_scanline(tree, colours, context)
    return globals()[f'look_{look}'](tree, colours)


def body_material(name, look, colours, context, sweep=None):
    """A material showing `look`; with `sweep` {to, low, high} it shows `to` below a level that blender_scene moves per
    frame (a Value node registered in context) and `look` above, with a bright seam in the accent colour on the boundary."""
    material = bpy.data.materials.new(name)
    tree = material.node_tree
    tree.nodes.remove(tree.nodes['Principled BSDF'])
    out = tree.nodes['Material Output']
    first = shader(tree, look, colours, context)
    if sweep:
        z = object_z(tree)
        offset = math(tree, 'SUBTRACT', driven(tree, context, 'level'), z)  # > 0 below the level
        reveal = smoothstep(tree, offset, -0.004, 0.004)
        seam = math(tree, 'MULTIPLY', smoothstep(tree, math(tree, 'ABSOLUTE', offset), 0.0, 0.035, invert=True), colours['glow'] * 1.5)
        edge = tree.nodes.new('ShaderNodeEmission')
        edge.inputs['Color'].default_value = colours['accent']
        link(tree, seam, edge.inputs['Strength'])
        first = add_shader(tree, mix_shader(tree, reveal, first, shader(tree, sweep['to'], colours, context)), edge.outputs[0])
    link(tree, first, out.inputs['Surface'])
    looks = {look, sweep['to']} if sweep else {look}
    if looks & {'glass'}:
        material.use_raytrace_refraction = True
        material.surface_render_method = 'DITHERED'
    return material


def plain_material(name, **inputs):
    material = bpy.data.materials.new(name)
    bsdf = material.node_tree.nodes['Principled BSDF']
    for key, value in inputs.items():
        bsdf.inputs[key].default_value = value
    return material


def toon_outline(obj, colours, size):
    """Inverted hull: a solidified shell with flipped normals and back faces culled draws an ink line round the form."""
    material = bpy.data.materials.new('toon-outline')
    material.use_backface_culling = True
    tree = material.node_tree
    tree.nodes.remove(tree.nodes['Principled BSDF'])
    link(tree, emission(tree, mix_colour(INK, colours['base'], 0.15), 1.0).outputs[0], tree.nodes['Material Output'].inputs['Surface'])
    obj.data.materials.append(material)
    shell = obj.modifiers.new('outline', 'SOLIDIFY')
    shell.thickness, shell.offset, shell.use_flip_normals = 0.018 * size, 1.0, True
    shell.material_offset = len(obj.data.materials) - 1


def wire_cage(obj, colours, size, context, side=None):
    """An emissive lattice over the subject: a voxel-remeshed copy (even quads; dense organic meshes only) with a Wireframe
    modifier. Under a sweep it shows only on its `side` of the level ('above' when wireframe is the starting look)."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    cage = bpy.data.objects.new(f'{obj.name}-wire', mesh)
    bpy.context.scene.collection.objects.link(cage)
    cage.matrix_world = obj.matrix_world.copy()
    if len(mesh.polygons) > 4000:
        remesh = cage.modifiers.new('even', 'REMESH')
        remesh.mode, remesh.voxel_size = 'VOXEL', 0.045 * size
    wire = cage.modifiers.new('wire', 'WIREFRAME')
    wire.thickness, wire.use_even_offset, wire.offset = 0.006 * size, True, 1.0
    material = bpy.data.materials.new('wire')
    tree = material.node_tree
    tree.nodes.remove(tree.nodes['Principled BSDF'])
    glow = emission(tree, colours['accent'], colours['glow']).outputs[0]
    if side:
        below = smoothstep(tree, math(tree, 'SUBTRACT', driven(tree, context, 'level'), object_z(tree)), -0.004, 0.004)
        clear = add(tree, 'ShaderNodeBsdfTransparent').outputs[0]
        glow = mix_shader(tree, below, glow, clear) if side == 'above' else mix_shader(tree, below, clear, glow)
        material.surface_render_method = 'DITHERED'
    link(tree, glow, tree.nodes['Material Output'].inputs['Surface'])
    cage.data.materials.clear()
    cage.data.materials.append(material)
    return cage


def apply(objects, look, colours, size, sweep=None, context=None):
    """Gives every mesh its material by its `role` property (builtins set it; anything else is `body`): `body` the look
    and the sweep, `trim` polished gold, `eye` glossy black."""
    for obj in objects:
        role = obj.get('role', 'body')
        obj.data.materials.clear()
        if role == 'trim':
            obj.data.materials.append(plain_material('trim', **{'Base Color': colours['trim'], 'Metallic': 1.0, 'Roughness': 0.12}))
            continue
        if role == 'plinth':
            obj.data.materials.append(plain_material('plinth', **{'Base Color': mix_colour(INK, colours['base'], 0.06), 'Roughness': 0.2, 'Coat Weight': 1.0, 'Coat Roughness': 0.05}))
            continue
        if role == 'eye':
            obj.data.materials.append(plain_material('eye', **{'Base Color': INK, 'Roughness': 0.05, 'Coat Weight': 1.0}))
            continue
        obj.data.materials.append(body_material('body', look, colours, context, sweep))
        if 'toon' in (look, sweep and sweep['to']):
            toon_outline(obj, colours, size)
        if 'wireframe' in (look, sweep and sweep['to']):
            wire_cage(obj, colours, size, context, sweep and ('above' if look == 'wireframe' else 'below'))
