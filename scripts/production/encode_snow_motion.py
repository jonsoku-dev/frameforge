"""Encode the sixty real Snow rig frames with diagnostic/CC-BY attribution labels.
No interpolation, generated replacement frames, retouch or audio is introduced.
"""
from pathlib import Path
import argparse, json, subprocess, hashlib
P=argparse.ArgumentParser();P.add_argument('--frames',required=True);P.add_argument('--output',required=True);A=P.parse_args()
folder=Path(A.frames).resolve();output=Path(A.output).resolve()
if output.exists():raise RuntimeError('Preserve existing output; choose new version path')
frames=[folder/f'{i:04d}.png' for i in range(60)]
if not all(p.is_file() for p in frames):raise RuntimeError('All sixty actual PNG frames are required')
provenance=json.loads((folder/'motion-preview-provenance.json').read_text())
if provenance['render']['fps']!=30:raise RuntimeError('This bounded proof expects30fps')
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
if not Path(font).is_file():raise RuntimeError('Install documented DejaVuSans font prerequisite')
output.parent.mkdir(parents=True,exist_ok=True)
texts=[('label-title.txt','SOURCE RIG MOTION PROOF'),('label-limit.txt','480 x 640 | 30 fps | silent preview'),('label-credit.txt','Snow Rig (CC) Blender Foundation'),('label-license.txt','studio.blender.org | CC BY 4.0')]
for name,text in texts:(folder/name).write_text(text)
filters=[]
for name,y,size in [('label-title.txt','12',14),('label-limit.txt','31',12),('label-credit.txt','h-38',12),('label-license.txt','h-21',12)]:
 filters.append(f'drawtext=fontfile={font}:textfile={folder/name}:x=12:y={y}:fontsize={size}:fontcolor=white:shadowcolor=black:shadowx=1:shadowy=1')
command=['ffmpeg','-v','error','-n','-framerate','30','-start_number','0','-i',str(folder/'%04d.png'),'-frames:v','60','-vf',','.join(filters),'-an','-c:v','libx264','-crf','18','-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart',str(output)]
subprocess.run(command,check=True)
metadata={'label':'Low-resolution source-rig temporal diagnostic, not final film','credit':'Snow Rig (CC) Blender Foundation | studio.blender.org','license':'https://creativecommons.org/licenses/by/4.0/','source_page':'https://studio.blender.org/characters/snow/v4/','modified':'source-rig pose/expression, source wardrobe tint, lighting and camera','source_render_provenance':str(folder/'motion-preview-provenance.json'),'source_helper_sha256':provenance['helper_sha256'],'encoder_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'frames':60,'fps':30,'audio':'intentionally silent','frame_sha256':[hashlib.sha256(p.read_bytes()).hexdigest() for p in frames],'video_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'encode_command':command,'playback_observed':False}
output.with_suffix('.provenance.json').write_text(json.dumps(metadata,indent=2));print(output);print(metadata['video_sha256'])
