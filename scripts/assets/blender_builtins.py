"""Builtin hero meshes for 3d.json (`subject.kind: "builtin"`), built inside Blender's Python by blender_scene.py.

Organic subjects (head, plush) are signed distance fields sampled on a voxel grid with numpy, written as an OpenVDB density grid
and meshed by Blender's Volume to Mesh, then relaxed and subdivided: smooth blends between masses, like clay, not primitives
glued together. Hard-surface subjects (bottle, gem, knot) are lathed, hulled or swept. Every builder is a pure function of its
arguments (no randomness), so the same shot gives the same mesh. Each returns [(object, role)] where role is `body` (gets the
shot's look), `trim` (polished metal: a bottle cap), `eye` (glossy black: plush eyes) or `plinth` (dark stone: the bust's stand).
"""
import math, os, tempfile
from importlib import import_module

import bpy, bmesh
import numpy as np



# --- signed distance helpers (numpy, p is an (..., 3) array) ---------------------------------------------------------------

def ellipsoid(p, centre, radii):
    q = (p - np.asarray(centre)) / np.asarray(radii)
    k0 = np.linalg.norm(q, axis=-1)
    k1 = np.linalg.norm(q / np.asarray(radii), axis=-1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def capsule(p, a, b, ra, rb):
    """A cone-capsule from a (radius ra) to b (radius rb), approximated by a lerped radius along the segment."""
    a, b = np.asarray(a), np.asarray(b)
    pa, ba = p - a, b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0.0, 1.0)
    return np.linalg.norm(pa - h[..., None] * ba, axis=-1) - (ra + (rb - ra) * h)


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def mirror_x(p):
    return np.stack([np.abs(p[..., 0]), p[..., 1], p[..., 2]], axis=-1)


# --- fields ------------------------------------------------------------------------------------------------------------------
# Axes: x to the subject's left (viewer's right), -y towards the camera at angle 0, z up. The head follows classical
# proportions: chin at z -1, crown at +1, eyes on the middle line, nose base halfway down to the chin, mouth a third below.

def half_space(p, axis, level, keep_above):
    return (level - p[..., axis]) if keep_above else (p[..., axis] - level)


def head_field(p):
    m = mirror_x(p)
    d = ellipsoid(p, (0, 0.06, 0.3), (0.72, 0.84, 0.75))                       # cranium
    d = smin(d, ellipsoid(m, (0.5, -0.06, -0.12), (0.22, 0.42, 0.36)), 0.25)    # temples and sides of the face
    d = smin(d, ellipsoid(p, (0, -0.42, 0.3), (0.6, 0.45, 0.42)), 0.2)          # forehead
    d = smin(d, ellipsoid(p, (0, -0.45, -0.05), (0.48, 0.4, 0.38)), 0.28)       # mid face, under the eyes
    d = smin(d, ellipsoid(p, (0, -0.4, -0.4), (0.5, 0.46, 0.46)), 0.25)         # upper jaw and cheeks
    d = smin(d, ellipsoid(m, (0.38, -0.18, -0.48), (0.18, 0.36, 0.3)), 0.25)     # cheeks over the jaw muscle
    d = smin(d, ellipsoid(p, (0, -0.6, -0.62), (0.3, 0.3, 0.24)), 0.15)         # muzzle
    d = smin(d, capsule(m, (0.52, 0.06, -0.4), (0.15, -0.6, -0.88), 0.12, 0.13), 0.18)  # jaw line
    d = smin(d, ellipsoid(p, (0, -0.66, -0.9), (0.22, 0.16, 0.14)), 0.12)       # chin
    d = smin(d, ellipsoid(m, (0.43, -0.5, -0.08), (0.2, 0.2, 0.13)), 0.2)       # cheekbones
    d = smin(d, ellipsoid(m, (0.27, -0.77, 0.2), (0.26, 0.12, 0.1)), 0.16)      # brows
    d = smax(d, -ellipsoid(m, (0.27, -0.93, 0.0), (0.2, 0.21, 0.13)), 0.12)     # eye sockets
    d = smin(d, ellipsoid(m, (0.27, -0.62, 0.0), (0.15, 0.15, 0.15)), 0.015)    # eyeballs
    lid = ellipsoid(m, (0.27, -0.62, 0.005), (0.178, 0.178, 0.178))
    d = smin(d, smax(lid, half_space(p, 2, 0.06 - 0.25 * (m[..., 0] - 0.27) ** 2, True), 0.01), 0.02)   # upper lids
    d = smin(d, smax(lid, half_space(p, 2, -0.085 + 0.4 * (m[..., 0] - 0.27) ** 2, False), 0.01), 0.02) # lower lids
    d = smax(d, -ellipsoid(m, (0.27, -0.775, -0.005), (0.05, 0.03, 0.05)), 0.02)  # carved irises, as in marble
    d = smin(d, capsule(p, (0, -0.86, 0.06), (0, -1.04, -0.4), 0.05, 0.075), 0.07)  # nose bridge
    d = smin(d, ellipsoid(p, (0, -1.03, -0.42), (0.085, 0.08, 0.075)), 0.04)    # nose tip
    d = smin(d, ellipsoid(m, (0.095, -0.93, -0.46), (0.07, 0.07, 0.055)), 0.04) # nostril wings
    d = smin(d, ellipsoid(m, (0.25, -0.74, -0.4), (0.15, 0.1, 0.15)), 0.1)    # cheek pads (the fold to the mouth)
    d = smin(d, ellipsoid(p, (0, -0.875, -0.55), (0.1, 0.07, 0.065)), 0.06)    # under the nose, down to the lip
    d = smin(d, ellipsoid(m, (0.07, -0.865, -0.615), (0.13, 0.06, 0.048)), 0.05) # upper lip, two halves of the bow
    d = smin(d, ellipsoid(p, (0, -0.885, -0.63), (0.05, 0.05, 0.04)), 0.03)       # upper lip tubercle
    d = smin(d, ellipsoid(p, (0, -0.86, -0.72), (0.16, 0.075, 0.058)), 0.045)   # lower lip
    d = smax(d, -ellipsoid(p, (0, -0.97, -0.668), (0.2, 0.11, 0.016)), 0.015)   # mouth line
    d = smax(d, -ellipsoid(p, (0, -0.92, -0.8), (0.13, 0.06, 0.025)), 0.03)     # groove under the lip
    ear = ellipsoid(m, (0.72, 0.14, -0.1), (0.07, 0.17, 0.27))
    ear = smax(ear, -ellipsoid(m, (0.78, 0.12, -0.12), (0.045, 0.11, 0.17)), 0.025)
    d = smin(d, ear, 0.05)                                                        # ears
    # Short classical curls grown out of the skin, not a cap laid on it: over the cranium the surface swells by up to
    # 0.08 plus tufts of comma-shaped locks, and the swelling fades to nothing across the hairline (high on the brow, a
    # widow's dip in the middle, low at the nape), so there is no rim anywhere.
    y, z = p[..., 1], p[..., 2]
    angle = np.arctan2(p[..., 0], -y)
    line = 0.2 - 0.42 * y - 0.06 * np.exp(-(p[..., 0] / 0.12) ** 2) * (y < -0.4)
    grow = np.clip((z - line) / 0.22, 0.0, 1.0)
    grow = grow * grow * (3 - 2 * grow)
    locks = np.sin(9 * angle + 2.5 * np.sin(11 * z)) * np.sin(13 * z + 2.0 * np.sin(7 * angle))
    crown = np.clip((z - 0.55) / 0.5, 0.0, 1.0)  # more volume on top, as hair stands off the crown
    hair = ellipsoid(p, (0, 0.06, 0.3), (0.72, 0.84, 0.75)) + 0.03 - grow * (0.085 + 0.05 * crown + 0.028 * locks)
    d = smin(d, hair, 0.03)
    neck = p * np.array([0.9, 1.0, 1.0])
    d = smin(d, capsule(neck, (0, 0.12, -0.45), (0, 0.16, -1.75), 0.4, 0.44), 0.25)  # neck
    d = smin(d, capsule(m, (0.48, 0.22, -0.4), (0.07, -0.16, -1.5), 0.08, 0.07), 0.14)  # neck muscles, ear to collarbone
    d = smin(d, ellipsoid(p, (0, -0.27, -1.0), (0.06, 0.07, 0.09)), 0.06)       # larynx
    d = smin(d, capsule(m, (0.22, 0.32, -1.1), (0.85, 0.22, -1.72), 0.18, 0.22), 0.25)  # trapezius slope
    d = smin(d, ellipsoid(p, (0, 0.1, -2.0), (1.45, 0.62, 0.5)), 0.35)       # shoulders and chest
    d = smin(d, capsule(m, (0.12, -0.38, -1.62), (0.8, -0.1, -1.58), 0.035, 0.04), 0.16)  # collarbones
    return smax(d, half_space(p, 2, -2.0, True), 0.03)                          # flat cut under the bust


def plush_field(p):
    m = mirror_x(p)
    d = ellipsoid(p, (0, 0, -0.35), (0.78, 0.7, 0.72))                         # body
    d = smin(d, ellipsoid(p, (0, -0.05, 0.55), (0.72, 0.64, 0.6)), 0.25)       # head
    d = smin(d, ellipsoid(m, (0.42, -0.05, 1.06), (0.2, 0.14, 0.24)), 0.12)    # ears
    d = smin(d, capsule(m, (0.55, -0.1, -0.15), (0.85, -0.25, -0.45), 0.2, 0.18), 0.12)  # arms
    d = smin(d, ellipsoid(m, (0.34, -0.22, -1.0), (0.24, 0.3, 0.16)), 0.12)    # feet
    d = smin(d, ellipsoid(p, (0, -0.64, 0.38), (0.16, 0.08, 0.1)), 0.08)       # snout
    return smax(d, half_space(p, 2, -1.12, True), 0.04)


def load_openvdb():
    """Accept the upstream and distro binding names, preserving broken dependency errors."""
    try:
        return import_module('openvdb')
    except ModuleNotFoundError as error:
        if error.name != 'openvdb':
            raise
        return import_module('pyopenvdb')


def field_mesh(name, field, low, high, detail):
    """Meshes `field` (negative inside) over the box low..high, `detail` voxels along its longest side."""
    openvdb = load_openvdb()
    low, high = np.asarray(low, float), np.asarray(high, float)
    step = float((high - low).max()) / detail
    axes = [low[i] + step * np.arange(int(math.ceil((high[i] - low[i]) / step)) + 1) for i in range(3)]
    density = np.empty([len(a) for a in axes], np.float32)
    yy, zz = np.meshgrid(axes[1], axes[2], indexing='ij')
    for i, x in enumerate(axes[0]):  # one slab at a time keeps memory flat at high detail
        slab = np.stack([np.full_like(yy, x), yy, zz], axis=-1)
        # Density 1 inside, 0 outside, a linear ramp three voxels wide; meshed at 0.5, the field's zero set.
        density[i] = np.clip(0.5 - field(slab) / (3 * step), 0.0, 1.0)
    grid = openvdb.FloatGrid()
    grid.copyFromArray(density)
    grid.transform = openvdb.createLinearTransform(voxelSize=step)
    grid.name = 'density'
    folder = tempfile.mkdtemp(prefix='frameforge-')
    path = os.path.join(folder, f'{name}.vdb')
    openvdb.write(path, grids=[grid])
    data = bpy.data.volumes.new(f'{name}-volume')
    data.filepath = path
    data.grids.load()
    volume = bpy.data.objects.new(f'{name}-volume', data)
    volume.location = tuple(low)
    bpy.context.scene.collection.objects.link(volume)
    obj = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    bpy.context.scene.collection.objects.link(obj)
    convert = obj.modifiers.new('mesh', 'VOLUME_TO_MESH')
    convert.object, convert.threshold, convert.adaptivity, convert.resolution_mode = volume, 0.5, 0.0, 'GRID'
    bpy.context.view_layer.update()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    obj.modifiers.clear()
    obj.data = mesh
    bpy.data.objects.remove(volume)
    os.remove(path)
    os.rmdir(folder)
    relax = obj.modifiers.new('relax', 'CORRECTIVE_SMOOTH')
    relax.factor, relax.iterations, relax.use_only_smooth = 0.5, 4, True
    obj.modifiers.new('subdivide', 'SUBSURF').levels = obj.modifiers['subdivide'].render_levels = 1
    mesh.shade_smooth()
    return obj


# --- builders ----------------------------------------------------------------------------------------------------------------

def build_head(detail):
    head = field_mesh('head', head_field, (-1.6, -1.15, -2.02), (1.6, 1.1, 1.22), detail)
    # Centre the bust on the origin and bring it to about 2.4 units tall.
    head.scale = (0.8,) * 3
    head.location = (0, 0, 0.38)
    # A turned socle under the chest, so the bust reads as a sculpture on its stand rather than a shop mannequin.
    plinth = lathe('plinth', [(0.6, -1.64), (0.64, -1.62), (0.64, -1.53), (0.58, -1.5), (0.4, -1.42), (0.34, -1.36),
                              (0.34, -1.27), (0.46, -1.24), (0.46, -1.2)])
    return [(head, 'body'), (plinth, 'plinth')]


def build_plush(detail):
    body = field_mesh('plush', plush_field, (-1.15, -1.0, -1.15), (1.15, 1.0, 1.35), detail)
    parts = [(body, 'body')]
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, segments=48, ring_count=24, location=(side * 0.26, -0.6, 0.62))
        eye = bpy.context.active_object
        eye.scale = (1.0, 0.6, 1.25)
        eye.data.shade_smooth()
        parts.append((eye, 'eye'))
    return parts


def offset_profile(profile, wall):
    """The (radius, z) profile moved `wall` inwards, perpendicular to each segment (corners use the mean of their two)."""
    out = []
    for i, (r, z) in enumerate(profile):
        normals = []
        for a, b in ((profile[max(i - 1, 0)], profile[i]), (profile[i], profile[min(i + 1, len(profile) - 1)])):
            dr, dz = b[0] - a[0], b[1] - a[1]
            length = math.hypot(dr, dz)
            if length > 1e-9:
                normals.append((-dz / length, dr / length))  # left of travel: towards the axis when climbing the outside
        nr, nz = (sum(n[0] for n in normals) / len(normals), sum(n[1] for n in normals) / len(normals))
        length = math.hypot(nr, nz) or 1.0
        out.append((r + wall * nr / length, z + wall * nz / length))
    return out


def lathe(name, profile, segments=128):
    """Spins a (radius, z) profile about the z axis into a closed smooth solid."""
    # Wide flat ends get rings of their own before the fan to the axis: long thin fan triangles bend the smooth normals
    # across the whole cap, which glass and liquid refract as a sawtooth.
    rings_in = lambda r, z: [(r * f, z) for f in (0.08, 0.35, 0.65, 0.88)] if r > 0.15 else []
    profile = rings_in(*profile[0]) + list(profile) + rings_in(*profile[-1])[::-1]
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for step in range(segments):
        angle = 2 * math.pi * step / segments
        rings.append([bm.verts.new((r * math.cos(angle), r * math.sin(angle), z)) for r, z in profile])
    for step in range(segments):
        a, b = rings[step], rings[(step + 1) % segments]
        for i in range(len(profile) - 1):
            bm.faces.new((a[i], b[i], b[i + 1], a[i + 1]))
    bottom, top = bm.verts.new((0, 0, profile[0][1])), bm.verts.new((0, 0, profile[-1][1]))
    for step in range(segments):
        a, b = rings[step], rings[(step + 1) % segments]
        bm.faces.new((b[0], a[0], bottom))
        bm.faces.new((a[-1], b[-1], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.modifiers.new('subdivide', 'SUBSURF').levels = obj.modifiers['subdivide'].render_levels = 2
    mesh.shade_smooth()
    return obj


BOTTLE = [(0.62, -1.1), (0.7, -1.08), (0.72, -1.0), (0.72, 0.25), (0.7, 0.4), (0.6, 0.52), (0.3, 0.6), (0.22, 0.62), (0.22, 0.75)]
WALL = 0.035  # glass wall; the base is three walls thick, as moulded bottles are


def build_bottle(detail, options=None):
    """A squat serum bottle with a tall faceted cap, blown as a hollow shell: up the outside, over the lip, down the
    inside to a thick base, so glass refracts two walls and whatever is inside, not a solid lump. `liquid` {fill (0..1 of
    the body's height), colour} adds a liquid volume a hair inside the wall. Profile points are doubled at the corners so
    subdivision keeps them crisp but softened, like a moulded edge."""
    options = options or {}
    inner = offset_profile(BOTTLE, WALL)
    floor = BOTTLE[0][1] + 3 * WALL
    inside = [(r, max(z, floor)) for r, z in inner if z > floor - WALL][::-1]
    shell = BOTTLE + [(BOTTLE[-1][0] - WALL, BOTTLE[-1][1])] + inside[1:]
    body = lathe('bottle', shell)
    body['shell'] = WALL
    parts = [(body, 'body'), (lathe('cap', [(0.27, 0.72), (0.29, 0.74), (0.29, 1.3), (0.27, 1.33)], 12), 'trim')]
    liquid = options.get('liquid')
    if liquid:
        # The liquid's surface sits at `fill` of the way from the inner floor to the shoulder; its side a hair inside the glass.
        top = floor + (0.4 - floor) * min(max(float(liquid.get('fill', 0.6)), 0.05), 1.0)
        gap = 0.012  # liquid a little inside the glass: touching walls would z-fight
        side = [(r, z) for r, z in offset_profile(BOTTLE, WALL + gap) if r > 0.3]  # the body's wall, below the neck

        def radius_at(z):
            for (r0, z0), (r1, z1) in zip(side, side[1:]):
                if z0 <= z <= z1 and z1 > z0:
                    return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
            return side[-1][0] if z > side[-1][1] else side[0][0]
        bottom = floor + gap
        # Corners doubled (a step in, a step up) so subdivision keeps a flat floor, straight sides and a flat surface.
        profile = [(radius_at(bottom) - 0.03, bottom), (radius_at(bottom + 0.02), bottom + 0.02)] + \
                  [(r, z) for r, z in side if bottom + 0.02 < z < top - 0.02] + [(radius_at(top - 0.02), top - 0.02), (radius_at(top) - 0.03, top)]
        parts.append((lathe('liquid', profile), 'liquid'))
    return parts


def build_gem(detail):
    """A round brilliant: table, star and kite facets on the crown, 16-sided girdle, pavilion to a point (convex hull)."""
    bm = bmesh.new()
    points = []
    ring = lambda n, r, z, turn=0.0: [(r * math.cos(2 * math.pi * (i + turn) / n), r * math.sin(2 * math.pi * (i + turn) / n), z) for i in range(n)]
    points += ring(8, 0.55, 0.62, 0.5)          # table
    points += ring(8, 0.82, 0.42)               # star facet tips
    points += ring(16, 1.0, 0.22, 0.25)         # upper girdle
    points += ring(16, 1.0, 0.16, 0.25)         # lower girdle
    points += ring(8, 0.55, -0.45, 0.5)         # pavilion mains
    points += [(0.0, 0.0, -1.0)]                # culet
    verts = [bm.verts.new(p) for p in points]
    bmesh.ops.convex_hull(bm, input=verts)
    mesh = bpy.data.meshes.new('gem')
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('gem', mesh)
    bpy.context.scene.collection.objects.link(obj)
    bevel = obj.modifiers.new('edges', 'BEVEL')
    bevel.width, bevel.segments, bevel.limit_method = 0.006, 2, 'ANGLE'
    return [(obj, 'body')]


def build_knot(detail):
    """A (2, 3) torus knot swept with a rounded-triangle profile that twists three times along the path."""
    curve = bpy.data.curves.new('knot', 'CURVE')
    curve.dimensions = '3D'
    spline = curve.splines.new('POLY')
    count = 600
    spline.points.add(count - 1)
    for i in range(count):
        t = 2 * math.pi * i / count
        r = 0.62 + 0.3 * math.cos(3 * t)
        spline.points[i].co = (r * math.cos(2 * t), r * math.sin(2 * t), 0.3 * math.sin(3 * t) * 1.2, 1.0)
        spline.points[i].tilt = 3 * t * 2 / 3  # with a three-lobed profile, two full turns read as a steady twist
    spline.use_cyclic_u = True
    profile = bpy.data.curves.new('knot-profile', 'CURVE')
    shape = profile.splines.new('POLY')
    lobes = 72
    shape.points.add(lobes - 1)
    for i in range(lobes):
        a = 2 * math.pi * i / lobes
        r = 0.16 * (1 + 0.22 * math.cos(3 * a))
        shape.points[i].co = (r * math.cos(a), r * math.sin(a), 0, 1)
    shape.use_cyclic_u = True
    profile_obj = bpy.data.objects.new('knot-profile', profile)
    bpy.context.scene.collection.objects.link(profile_obj)
    curve.bevel_mode, curve.bevel_object, curve.use_fill_caps = 'OBJECT', profile_obj, True
    knot = bpy.data.objects.new('knot-curve', curve)
    bpy.context.scene.collection.objects.link(knot)
    bpy.context.view_layer.update()
    mesh = bpy.data.meshes.new_from_object(knot.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(knot)
    bpy.data.objects.remove(profile_obj)
    obj = bpy.data.objects.new('knot', mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.shade_smooth()
    obj.modifiers.new('subdivide', 'SUBSURF').levels = obj.modifiers['subdivide'].render_levels = 1
    return [(obj, 'body')]


def build(name, detail=256, options=None):
    """The builtin subject `name` at the origin, about 2 units across like a primitive, as [(object, role)]; `options` is
    the shot's subject (the bottle reads `liquid`)."""
    builders = {'head': build_head, 'bottle': build_bottle, 'gem': build_gem, 'knot': build_knot, 'plush': build_plush}
    parts = builders[name](detail, options) if name == 'bottle' else builders[name](detail)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj, _ in parts:  # bake the relax and subdivision once, so frame changes do not re-evaluate a million-face stack
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
        obj.modifiers.clear()
        obj.data = mesh
    return parts
