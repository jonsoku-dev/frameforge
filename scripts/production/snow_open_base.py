"""First-party safe inspection/render helper for externally supplied CC-BY Snow.
Always invoke Blender with --disable-autoexec. Never executes bundled texts,
regenerates rig, overwrites original files or saves a derivative .blend.
Third-party credit: Snow Rig (CC) Blender Foundation | studio.blender.org
Asset: https://studio.blender.org/characters/snow/v4/ (CC-BY4.0).
Embedded CloudRig UI code is separately GPL-3.0-or-later and stays disabled.
"""
import os
os.environ.setdefault('LP_NUM_THREADS','1')
import bpy, sys, json, argparse, hashlib, math, time
from pathlib import Path
from mathutils import Vector, Matrix
P=argparse.ArgumentParser();P.add_argument('--asset',required=True);P.add_argument('--output',required=True);P.add_argument('--mode',choices=['baseline','pose-test','courier','motion-keys','motion-preview'],default='baseline');P.add_argument('--samples',type=int,default=32);P.add_argument('--width',type=int,default=720);P.add_argument('--height',type=int,default=960);P.add_argument('--fps',type=int,default=30);A=P.parse_args(sys.argv[sys.argv.index('--')+1:])
if '--disable-autoexec' not in sys.argv:raise RuntimeError('Explicit --disable-autoexec startup is required')
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
asset=Path(A.asset).resolve();out=Path(A.output).resolve();out.mkdir(parents=True,exist_ok=True)
if asset.suffix!='.blend' or not asset.is_file():raise RuntimeError('Supply the extracted official blend')
source=Path(__file__).read_bytes();original_hash=hashlib.sha256(asset.read_bytes()).hexdigest();started=time.perf_counter()
bpy.ops.wm.open_mainfile(filepath=str(asset),load_ui=False,use_scripts=False)
if bpy.context.preferences.filepaths.use_scripts_auto_execute:raise RuntimeError('Autoexec must remain disabled')
S=bpy.context.scene;rig=bpy.data.objects.get('RIG-Snow')
if not rig or rig.type!='ARMATURE':raise RuntimeError('Expected official RIG-Snow')
report={'mode':A.mode,'credit':'Snow Rig (CC) Blender Foundation | studio.blender.org','license':'https://creativecommons.org/licenses/by/4.0/','source_page':'https://studio.blender.org/characters/snow/v4/','asset_sha256':original_hash,'helper_sha256':hashlib.sha256(source).hexdigest(),'blender':bpy.app.version_string,'autoexec':bpy.context.preferences.filepaths.use_scripts_auto_execute,'autoexec_fail':bpy.app.autoexec_fail,'autoexec_fail_message':bpy.app.autoexec_fail_message,'embedded_texts':[{'name':t.name,'use_module':t.use_module} for t in bpy.data.texts],'material_slots':{},'images':[],'modifications':[]}
for o in bpy.data.objects:
 if o.type=='MESH' and o.name.startswith('GEO-'):
  report['material_slots'][o.name]=[{'slot':i,'link':slot.link,'material':slot.material.name if slot.material else None} for i,slot in enumerate(o.material_slots)]
for im in bpy.data.images:
 path=bpy.path.abspath(im.filepath);files=[path.replace('<UDIM>',str(tile.number)) for tile in im.tiles] if im.source=='TILED' else [path]
 report['images'].append({'name':im.name,'source':im.source,'files':[{'path':f,'exists':Path(f).is_file()} for f in files],'packed':bool(im.packed_file)})
missing=[x for x in report['images'] if not x['packed'] and any(not f['exists'] for f in x['files'])]
if missing:raise RuntimeError('Actual texture files missing: '+str(missing))
bpy.context.view_layer.update()
def head_vertices():
 o=bpy.data.objects['GEO-snow-head'];ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();points=[ev.matrix_world@v.co for v in me.vertices];ev.to_mesh_clear();return points
before=head_vertices();head=rig.pose.bones['FK-Head'];saved_mode=head.rotation_mode;saved_basis=head.matrix_basis.copy()
if A.mode in ['pose-test','courier','motion-keys','motion-preview']:
 head.rotation_mode='XYZ';head.rotation_euler=(math.radians(-3),math.radians(10),math.radians(-8));bpy.context.view_layer.update();after=head_vertices()
 if len(before)!=len(after):raise RuntimeError('Unexpected pose-test topology change')
 distances=[(a-b).length for a,b in zip(before,after)];report['head_pose_response']={'vertices':len(before),'max_world_displacement':max(distances),'mean_world_displacement':sum(distances)/len(distances)}
 if max(distances)<.001:raise RuntimeError('Head FK control did not visibly deform source mesh')
 report['modifications'].append('FK-Head rotation(-3,10,-8)degrees through ordinary bpy pose API; no bundled script executed')
 if A.mode=='pose-test':head.matrix_basis=saved_basis;head.rotation_mode=saved_mode;bpy.context.view_layer.update()
if A.mode in ['courier','motion-keys','motion-preview']:
 # A bounded palette adaptation of actual source wardrobe meshes, never replacement geometry.
 changes={'snow.shirt':('C76D32',.64),'snow.pants':('183F51',.72),'snow.shoe':('392B25',.54)}
 for name,(color,rough) in changes.items():
  material=bpy.data.materials.get(name)
  if not material:raise RuntimeError('Missing source wardrobe material '+name)
  clone=material.copy();clone.name=name+'.courier-proof';node=next((n for n in clone.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if not node:raise RuntimeError('No source Principled surface '+name)
  socket=node.inputs['Base Color']
  # Keep source normal/roughness textures; blend only the source garment diffuse into a courier palette.
  rgb=tuple(int(color[i:i+2],16)/255 for i in (0,2,4));linear=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)
  if socket.is_linked:
   old=socket.links[0].from_socket;mix=clone.node_tree.nodes.new('ShaderNodeMixRGB');mix.name='Courier wardrobe tint';mix.blend_type='MIX';mix.inputs[0].default_value=.72;mix.inputs[2].default_value=(*linear,1);clone.node_tree.links.new(old,mix.inputs[1]);clone.node_tree.links.new(mix.outputs[0],socket)
  else:socket.default_value=(*linear,1)
  node.inputs['Roughness'].default_value=rough
  for o in bpy.data.objects:
   if o.type=='MESH' and o.name.startswith('GEO-'):
    for slot in o.material_slots:
     if slot.material==material:slot.material=clone
  report['modifications'].append(name+' cloned and tinted '+color+'; source texture/normal nodes retained')
 # Ordinary FK control posing of the existing armature; no CloudRig UI or regeneration.
 props=rig.pose.bones['Properties'];wrist_before={};wrist_after={}
 for side,angle in [('L',55),('R',-55)]:
  props['ik_'+('left' if side=='L' else 'right')+'_upperarm']=0.0
 bpy.context.view_layer.update()
 for side,angle in [('L',55),('R',-55)]:
  arm=rig.pose.bones['FK-UpperArm.'+side];wrist_before[side]=list(rig.pose.bones['FK-Wrist.'+side].matrix.translation);pivot=arm.matrix.translation.copy();arm.matrix=Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(angle),4,'Y') @ Matrix.Translation(-pivot) @ arm.matrix
 bpy.context.view_layer.update()
 for side in ['L','R']:wrist_after[side]=list(rig.pose.bones['FK-Wrist.'+side].matrix.translation)
 report['arm_fk_response']={'before':wrist_before,'after':wrist_after}
 report['modifications'].append('Existing FK upper-arm controls lowered55degrees about rigY, with source IK/FK property switched toFK')
 forearm=rig.pose.bones['FK-Forearm.L'];forearm_rest=forearm.matrix.copy();pivot=forearm.matrix.translation.copy();forearm.matrix=Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-100),4,'Y') @ Matrix.Translation(-pivot) @ forearm.matrix
 face_before=head_vertices()
 for side,x in [('L',-.016),('R',.016)]:rig.pose.bones['ACT-Lips_Corner.'+side].location=(x,.012,0)
 bpy.context.view_layer.update();face_after=head_vertices();report['facial_control_response']={'max_world_displacement':max((a-b).length for a,b in zip(face_before,face_after)),'smile_shape_values':{side:bpy.data.objects['GEO-snow-head'].data.shape_keys.key_blocks['Smile.'+side].value for side in ['L','R']},'lip_up_properties':{side:rig.pose.bones['ACT-Lips_Corner.'+side].get('RIG-snow-LipsUp.'+side) for side in ['L','R']}}
 report['modifications'].append('Source FK-left-forearm lifted100degrees about rigY; source ACT lip-corner controls set to restrained smile, response recorded')
 # Reposition/copy the source lights, not new character geometry.
 lights=sorted((o for o in S.objects if o.type=='LIGHT'),key=lambda o:o.name)
 settings=[((-1.4,-2,2.8),175,(1,.9,.8),2),((1.8,-1.4,1.8),100,(.65,.78,1),2),((0,1.7,2.6),240,(1,.78,.45),1.4),((0,-1,3.5),50,(1,1,1),2)]
 for lamp,(position,energy,color,size) in zip(lights,settings):
  lamp.data=lamp.data.copy();lamp.data.type='AREA';lamp.location=position;lamp.rotation_euler=(Vector((0,0,1.25))-lamp.location).to_track_quat('-Z','Y').to_euler();lamp.data.energy=energy;lamp.data.color=color;lamp.data.shape='DISK';lamp.data.size=size
 report['modifications'].append('Existing source light datablocks copied/repositioned as warm key,cool fill,rim; no model geometry added')
 if S.world and S.world.use_nodes:
  bg=next((n for n in S.world.node_tree.nodes if n.type=='BACKGROUND'),None)
  if bg:bg.inputs['Color'].default_value=(.025,.045,.075,1);bg.inputs['Strength'].default_value=.35
 report['modifications'].append('Camera re-aimed for a source-model upper-body3/4 study; source meshes/rig/skin/facial topology retained')
 camera=S.camera;camera.location=(1.10,-2.45,1.55);camera.rotation_euler=(Vector((0,0,1.40))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='PERSP';camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=32;camera.data.shift_x=0;camera.data.shift_y=0;camera.data.lens=85
# Drivers may use restricted simple expressions; validity is recorded only after actual evaluation.
report['drivers_after_evaluation']=[{'path':f.data_path,'expression':f.driver.expression,'valid':f.driver.is_valid,'simple':f.driver.is_simple_expression} for block in list(bpy.data.objects)+list(bpy.data.shape_keys) if block.animation_data for f in block.animation_data.drivers]
report['camera']={'location':list(S.camera.location),'rotation':list(S.camera.rotation_euler),'lens':S.camera.data.lens}
if A.mode!='pose-test':
 S.render.engine='CYCLES';S.cycles.device='CPU';S.cycles.samples=A.samples;S.cycles.seed=1949;S.cycles.use_animated_seed=False;S.cycles.use_adaptive_sampling=False;S.cycles.use_denoising=False;S.cycles.max_bounces=6;S.render.threads_mode='FIXED';S.render.threads=2;S.render.resolution_x=A.width;S.render.resolution_y=A.height;S.render.resolution_percentage=100;S.render.image_settings.file_format='PNG';S.render.fps=A.fps
 frames=([0,30,59] if A.mode=='motion-keys' else list(range(60))) if A.mode.startswith('motion') else [None]
 report['render']={'width':A.width,'height':A.height,'samples':A.samples,'engine':S.render.engine,'fps':A.fps,'frames':frames,'audio':'intentionally silent rig proof'};report['pose_checks']=[]
 if A.mode.startswith('motion'):
  camera=S.camera;camera.location=(1.0,-3.0,1.65);camera.rotation_euler=(Vector((.10,0,1.20))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=52;camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=32
  report['camera']={'location':list(camera.location),'rotation':list(camera.rotation_euler),'lens':camera.data.lens,'sensor_height':camera.data.sensor_height}
  report['modifications'].append('Two-second absolute source-control head/forearm/facial motion; wider portrait retains gesturing hand; no new model geometry')
 def ease(a,b,f):
  t=max(0,min(1,(f-a)/(b-a)));return t*t*(3-2*t)
 for frame in frames:
  if frame is not None:
   S.frame_set(frame);up=ease(0,30,frame);recovery=ease(30,59,frame);gesture=up*(1-.55*recovery);expression=.12+.88*up-.4*recovery
   head.rotation_mode='XYZ';head.rotation_euler=tuple(math.radians(x) for x in [-2-up,-6+16*up-4*recovery,6-14*up+5*recovery])
   forearm.matrix=Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-85*gesture),4,'Y') @ Matrix.Translation(-pivot) @ forearm_rest
   for side,x in [('L',-.016),('R',.016)]:rig.pose.bones['ACT-Lips_Corner.'+side].location=(x*expression,.012*expression,0)
   bpy.context.view_layer.update()
   from bpy_extras.object_utils import world_to_camera_view
   hand_points=[]
   for name in ['FK-Wrist.L','FK-Finger_Middle1.L','FK-Finger_Middle2.L','FK-Finger_Middle3.L','FK-Finger_Index3.L','FK-Finger_Thumb3.L']:
    bone=rig.pose.bones.get(name)
    if bone:
     for point in [bone.head,bone.tail]:hand_points.append(world_to_camera_view(S,camera,rig.matrix_world@point))
   report['pose_checks'].append({'frame':frame,'head_euler':list(head.rotation_euler),'expression_factor':expression,'gesture_factor':gesture,'smile_values':{side:bpy.data.objects['GEO-snow-head'].data.shape_keys.key_blocks['Smile.'+side].value for side in ['L','R']},'hand_projected_bounds':[min(v.x for v in hand_points),min(v.y for v in hand_points),max(v.x for v in hand_points),max(v.y for v in hand_points)]})
  target=out/(f'{frame:04d}.png' if frame is not None else A.mode+'.png')
  if target.exists():raise RuntimeError('Preserve existing render; choose new output folder')
  S.render.filepath=str(target);tick=time.perf_counter();bpy.ops.render.render(write_still=True)
  if frame is not None:report['pose_checks'][-1]['render_seconds']=time.perf_counter()-tick
report['seconds']=time.perf_counter()-started;report['original_unchanged']=hashlib.sha256(asset.read_bytes()).hexdigest()==original_hash
if not report['original_unchanged']:raise RuntimeError('Original asset changed unexpectedly')
(out/(A.mode+'-provenance.json')).write_text(json.dumps(report,indent=2));(out/'maker_source.py').write_bytes(source)
print('SNOW_RESULT',json.dumps({k:report[k] for k in ['mode','blender','autoexec','original_unchanged','seconds','modifications']}));print('HEAD_RESPONSE',report.get('head_pose_response'));print('MATERIALS',report['material_slots']);print('INVALID_DRIVERS',sum(not d['valid'] for d in report['drivers_after_evaluation']))
