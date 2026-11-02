"""Offline Blender proof: primitive cube, no external models or OpenVDB binding required."""
import json
import os
import sys
import tempfile

import bpy

sys.path.insert(0, os.path.abspath('scripts/assets'))
import blender_scene

with tempfile.TemporaryDirectory(prefix='frameforge-compositor-') as out:
    spec = os.path.join(out, '3d.json')
    with open(spec, 'w') as f:
        json.dump({'slug': 'compositor-compat', 'shots': [{
            'name': 'cube', 'engine': 'cycles', 'samples': 1, 'width': 64, 'height': 64,
            'fps': 30, 'frames': 1, 'bloom': 0, 'background': '#0B0D14',
            'subject': {'kind': 'primitive', 'primitive': 'cube'},
            'material': {'base': '#FFFFFF', 'emission': 4},
        }]}, f)
    for transparent in (False, True):
        with open(spec) as f:
            data = json.load(f)
        data['shots'][0]['transparent'] = transparent
        with open(spec, 'w') as f:
            json.dump(data, f)
        scene, shot, *_ = blender_scene.setup(spec, 'cube')
        scene.render.image_settings.file_format = 'OPEN_EXR'
        scene.render.image_settings.color_mode = 'RGBA'
        scene.render.image_settings.color_depth = '32'
        scene.frame_set(0)

        def pixels(name):
            scene.render.filepath = os.path.join(out, name + '.exr')
            bpy.ops.render.render(write_still=True)
            image = bpy.data.images.load(scene.render.filepath, check_existing=False)
            values = list(image.pixels)
            bpy.data.images.remove(image)
            return values

        original = pixels('original')
        results = []
        for strength in (0, 0.5, 2):
            blender_scene.make_post(scene, {'bloom': strength})
            results.append(pixels(str(strength)))
        zero, half, double = results
        assert max(abs(a - b) for a, b in zip(original, zero)) < 1e-5, 'zero bloom must preserve original'
        rgb = [i for i in range(len(original)) if i % 4 != 3]
        delta = [half[i] - original[i] for i in rgb]
        assert min(delta) > -1e-5, 'positive bloom must not dim original'
        assert max(delta) > 0.001, 'positive bloom must add visible energy'
        assert max(abs((double[i] - original[i]) - 4 * (half[i] - original[i])) for i in rgb) < 1e-4, 'strength >1 must scale glare, not clamp the blend factor'
        for image in results:
            assert max(abs(image[i] - original[i]) for i in range(3, len(original), 4)) < 1e-6, 'bloom must preserve alpha'
        print('compositor compatibility render ok', bpy.app.version_string, 'max half-strength added light', max(delta), 'transparent', transparent)
