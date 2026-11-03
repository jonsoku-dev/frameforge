"""Original, standalone Blender scenes for NEW entertainment reconstructions.
Run: blender -b -t 8 -P scripts/production/entertainment_scenes.py -- starfall --frames 142
No external models/textures, downloads, addons, hidden state or recovered source.
"""
import os
os.environ.setdefault('LP_NUM_THREADS', '1')  # same software-render worker default as repository wrapper
import bpy, math, sys, argparse, json, hashlib, time
from pathlib import Path
from mathutils import Vector, Matrix, Euler
from collections import Counter
P=argparse.ArgumentParser();P.add_argument('film',choices=['starfall','moonpost','neon-tide']);P.add_argument('--frames',default='0-359');P.add_argument('--samples',type=int,default=32);P.add_argument('--scale',type=float,default=1);P.add_argument('--output');P.add_argument('--engine',choices=['cycles','eevee'],default='cycles');A=P.parse_args(sys.argv[sys.argv.index('--')+1:])
SOURCE_BYTES=Path(__file__).read_bytes();SOURCE_SHA=hashlib.sha256(SOURCE_BYTES).hexdigest();ROOT=Path(__file__).resolve().parents[2];SLUG=A.film+'-reconstruction';OUT=Path(A.output) if A.output else ROOT/'public/assets/generated'/SLUG/'scene';OUT.mkdir(parents=True,exist_ok=True);(OUT/'maker_source.py').write_bytes(SOURCE_BYTES);TIMINGS=[]
bpy.ops.wm.read_factory_settings(use_empty=True);S=bpy.context.scene;S.render.engine='CYCLES' if A.engine=='cycles' else 'BLENDER_EEVEE_NEXT';S.cycles.samples=A.samples;S.cycles.max_bounces=5;S.cycles.diffuse_bounces=2;S.cycles.glossy_bounces=3;S.cycles.transmission_bounces=3;S.cycles.volume_bounces=0;S.cycles.use_denoising=False;S.eevee.taa_render_samples=A.samples;S.cycles.seed=1949;S.cycles.use_animated_seed=False;S.cycles.use_adaptive_sampling=False;S.render.threads_mode='FIXED';S.render.threads=2;S.render.resolution_x=int((720 if A.film=='moonpost' else 1080)*A.scale);S.render.resolution_y=int((1280 if A.film=='moonpost' else 1920)*A.scale);S.render.resolution_percentage=100;S.render.image_settings.file_format='PNG';S.render.film_transparent=False;S.render.fps=30;S.view_settings.view_transform='AgX';S.world=bpy.data.worlds.new('authored-world');S.world.use_nodes=True;S.world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.04,.075,1);S.world.node_tree.nodes['Background'].inputs[1].default_value=.38

def mat(name,hex,rough=.4,metal=0,emit=0,cloth=False):
 srgb=tuple(int(hex[i:i+2],16)/255 for i in (0,2,4));c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb);m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emit:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emit
 if cloth:
  p.inputs['Sheen Weight'].default_value=.45;n=m.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=120;b=m.node_tree.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.12;b.inputs['Distance'].default_value=.035;m.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']);m.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
 return m
INK=mat('obsidian pupils','07131F',.16);CREAM=mat('warm cream felt','F7DFC0',.68,cloth=True);GOLD=mat('brass','DFA23E',.26,.75);ORANGE=mat('saffron flight jacket','D96024',.6,cloth=True);BLUE=mat('deep petrol enamel','096675',.24,.35);LEATHER=mat('satchel leather','553526',.57);CLOTH=mat('violet woven reward','613596',.72,cloth=True);WHITE=mat('eye pearl','F7F4E8',.26);PINK=mat('nose and cheek','D47D69',.54);STAR=mat('amber star enamel','FFC837',.22,.35,1.2)

def finish(o,m,parent=None):
 if m:o.data.materials.append(m)
 if parent:o.parent=parent
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
 return o

def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o

def uv(name,loc,scale,m,parent=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;return finish(o,m,parent)

def box(name,loc,scale,m,bevel=.08,parent=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:q=o.modifiers.new('edge catches','BEVEL');q.width=bevel;q.segments=3;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
 return finish(o,m,parent)

def cyl(name,loc,r,depth,m,parent=None,rot=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name
 if rot:o.rotation_euler=rot
 q=o.modifiers.new('machined bevel','BEVEL');q.width=.035;q.segments=3;return finish(o,m,parent)

def cone(name,loc,r1,r2,depth,m,parent=None):
 bpy.ops.mesh.primitive_cone_add(vertices=64,radius1=r1,radius2=r2,depth=depth,location=loc);o=bpy.context.object;o.name=name;q=o.modifiers.new('soft roof edge','BEVEL');q.width=.04;q.segments=3;return finish(o,m,parent)

def line(name,points,r,m,parent=None):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for b,p in zip(s.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);return finish(o,m,parent)

def between(name,a,b,r,m,parent=None):return line(name,[a,b],r,m,parent)

def light(name,loc,power,color,size,target=(0,0,1)):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o

def camera(loc,target,scale):
 d=bpy.data.cameras.new('final camera');o=bpy.data.objects.new('final camera',d);bpy.context.collection.objects.link(o);S.camera=o;d.type='PERSP';d.lens=50;d.sensor_fit='VERTICAL';d.sensor_height=32;d.ortho_scale=scale;look(o,loc,target);return o

def look(o,loc,target):o.location=loc;o.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
def smooth(a,b,f):
 t=max(0,min(1,(f-a)/(b-a)));return t*t*(3-2*t)
def lerp(a,b,t):return Vector(a).lerp(Vector(b),t)
def visible(o,v):
 o.hide_render=not v
 for child in o.children:visible(child,v)

def star(name,loc,size,parent=None):
 vs=[]
 for y in [-.10,.10]:
  for i in range(10):a=math.pi/2+i*math.pi/5;r=size*(1 if i%2==0 else .46);vs.append((r*math.cos(a),y,r*math.sin(a)))
 fs=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)];me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.location=loc;q=o.modifiers.new('rounded enamel edges','BEVEL');q.width=.045;q.segments=3;return finish(o,STAR,parent)

def cloth(name,parent):
 vs=[];fs=[]
 for j in range(16):
  v=j/15
  for i in range(13):
   u=i/12;x=(u-.5)*1.65*(.45+.55*v);z=2.5-v*1.7+.09*math.sin(u*8+v*6)
   # Keep the fabric outside the actual coat ellipsoid rather than cutting through its back.
   coat_back=.43*math.sqrt(max(0,1-(x/.58)**2-((z-1.95)/.74)**2))
   y=max(.10+v*.65,coat_back+.045);vs.append((x,y,z-2.5))
 for j in range(15):
  for i in range(12):a=j*13+i;fs.append((a,a+1,a+14,a+13))
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,CLOTH,parent);o.location.z=2.5;q=o.modifiers.new('cloth thickness','SOLIDIFY');q.thickness=.035;q=o.modifiers.new('cloth smoothing','SUBSURF');q.levels=1;return o

def pilot(root,moth=False):
 body=uv('tailored coat',(0,0,1.95),(.58,.43,.74),CREAM if moth else ORANGE,root)
 box('zipper',(0,-.425,2.0),(.055,.05,.8),GOLD,.02,root)
 for x in [-.35,.35]:
  between('trouser leg',(x,0,1.46),(x,-.08,1.02),.13,LEATHER,root);uv('planted boot',(x,-.12,.89),(.25,.43,.2),LEATHER,root)
 head=empty('head articulation',(0,0,2.95),root);uv('head',(0,0,0),(.68,.52,.66),CREAM,head)
 if not moth:
  uv('leather flight helmet',(0,.08,.21),(.71,.53,.56),LEATHER,head)
  for x in [-.55,.55]:uv('round listening ear',(x,.02,.53),(.29,.18,.31),CREAM,head)
 else:
  for x in [-.3,.3]:line('antenna',[(x,0,.48),(x*1.3,0,.94),(x*1.65,-.05,1.05)],.028,GOLD,head);uv('antenna tip',(x*1.65,-.05,1.05),(.08,.065,.09),GOLD,head)
 for x in [-.26,.26]:

  if not moth:uv('integrated cream cheek',(x,-.43,-.03),(.27,.065,.29),CREAM,head)

  if not moth:uv('eye white',(x,-.515,.07),(.16,.045,.19),WHITE,head)
  uv('gaze iris',(x+.035,-.574,.055),(.095,.028,.125),INK,head);uv('eye catchlight',(x+.009,-.602,.105),(.029,.009,.033),WHITE,head)
  line('expressive brow',[(x-.10,-.525,.31),(x,-.55,.34),(x+.10,-.52,.32)],.023,LEATHER,head)
 uv('nose',(0,-.59,-.11),(.12,.085,.085),PINK,head);line('smile',[(-.15,-.523,-.25),(0,-.57,-.30),(.16,-.52,-.24)],.022,LEATHER,head)
 bag=box('satchel at right hip',(.64,.13,1.72),(.62,.45,.72),LEATHER,.12,root);box('satchel opening',(.64,-.03,2.06),(.58,.34,.10),INK,.04,root);line('satchel brass rim',[(.37,-.19,2.1),(.65,-.23,2.12),(.92,-.18,2.1)],.028,GOLD,root);line('satchel shoulder strap',[(-.37,-.34,2.55),(.17,-.48,2.06),(.67,-.17,1.72)],.055,LEATHER,root)
 left=uv('left steering glove',(-.62,-.58,1.94),(.18,.19,.18),CREAM,root);right=empty('right action hand',(.75,-.58,2.22),root);uv('glove palm',(0,0,0),(.17,.16,.17),CREAM,right);uv('gripping thumb',(-.12,-.04,.12),(.095,.1,.11),CREAM,right)
 for j in range(3):uv('curled glove finger',(.02+j*.055,-.08,.13),(.052,.09,.065),CREAM,right)
 # Articulated arm endpoints are updated to follow the action hand.
 arm=between('action sleeve',(.41,-.04,2.31),right.location,.14,CREAM if moth else ORANGE,root)
 between('steering sleeve',(-.4,-.01,2.3),left.location,.14,ORANGE if not moth else CREAM,root)
 return head,right,arm

def setarm(arm,hand):
 pts=arm.data.splines[0].bezier_points;pts[0].co=(.41,-.04,2.31);pts[1].co=hand.location

def island(name,loc,scale,top,rock):
 o=uv(name,loc,scale,rock);uv(name+' moss top',(loc[0],loc[1],loc[2]+scale[2]*.55),(scale[0]*.97,scale[1]*.95,scale[2]*.48),top);return o

def floating_island(name,loc,scale,top,rock):
 vs=[(0,0,.28)];n=15
 for z,r in [(.2,1),(-.35,.83),(-1.1,.20)]:
  for i in range(n):
   a=i*math.tau/n;variation=1+.10*math.sin(i*2.7)+.06*math.cos(i*5.2);vs.append((math.cos(a)*r*variation,math.sin(a)*r*variation,z+.06*math.sin(i*3.4)))
 fs=[]
 for i in range(n):fs.append((0,1+i,1+(i+1)%n))
 for ring in range(2):
  for i in range(n):a=1+ring*n+i;b=1+ring*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 fs.append(tuple(range(1+2*n,1+3*n)));me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.location=loc;o.scale=scale;me.materials.append(rock);me.materials.append(top)
 for i,p in enumerate(me.polygons):p.material_index=1 if i<n else 0
 return o

def sky():
 tree=S.world.node_tree;tree.nodes.clear();out=tree.nodes.new('ShaderNodeOutputWorld');sky=tree.nodes.new('ShaderNodeBackground');sky.inputs[0].default_value=(.28,.36,.57,1);sky.inputs[1].default_value=.8;env=tree.nodes.new('ShaderNodeBackground');env.inputs[0].default_value=(.12,.16,.25,1);env.inputs[1].default_value=.3;ray=tree.nodes.new('ShaderNodeLightPath');mix=tree.nodes.new('ShaderNodeMixShader');tree.links.new(ray.outputs['Is Camera Ray'],mix.inputs[0]);tree.links.new(env.outputs[0],mix.inputs[1]);tree.links.new(sky.outputs[0],mix.inputs[2]);tree.links.new(mix.outputs[0],out.inputs[0])

light('warm soft key',(-4,-6,9),1350,(1,.76,.51),5);light('cool sky fill',(5,-2,6),450,(.43,.69,1),4);light('rim',(0,4,7),1700,(.71,.5,1),3)

def starfall():
 sky()
 rock=mat('violet floating stone','493E69',.88);top=mat('dusky lavender moss','8C779E',.91);cloud=mat('soft cloud','B4A7C9',.94);root=empty('courier scooter assembly');head,hand,arm=pilot(root);cape=cloth('earned shoulder cape',root)
 uv('speeder hull',(0,-.02,1.06),(.97,1.50,.40),BLUE,root);uv('speeder cream nose',(0,-1.12,1.10),(.66,.61,.29),CREAM,root);box('seat',(0,.24,1.47),(.90,.78,.18),LEATHER,.1,root)
 for x in [-.78,.78]:
  cyl('turbine housing',(x,.75,1.10),.33,.7,BLUE,root,(math.pi/2,0,0));cyl('brass turbine rim',(x,.39,1.1),.28,.055,GOLD,root,(math.pi/2,0,0));uv('engine blue glow',(x,1.12,1.1),(.19,.11,.19),mat('electric blue','4BD9EE',.2,0,3),root)
 between('steering bar',(-.65,-.62,1.94),(.65,-.62,1.94),.055,GOLD,root)
 # Foreground/midground/background features are independent, not camera-attached overlays.
 for i,(x,y,z,sc) in enumerate([(-3,1,-.5,1.8),(3,4,.3,2),(-2,9,1,2),(4,13,2,3),(-4,-4,-1.5,2)]):
  floating_island('floating rock '+str(i),(x,y,z),(sc,sc*.75,sc*.65),top,rock)
  for k in range(3):
   tx=x+(k-1)*sc*.4;ty=y+.2;stem=mat('island teal stem '+str(i)+' '+str(k),'447A75',.8);cyl('slim tree trunk',(tx,ty,z+sc*.2+.35),.06,.7,GOLD);uv('teal tree canopy',(tx,ty,z+sc*.2+.8),(.25,.25,.48),stem)
  for j in range(3):uv('cotton cloud',(x+(j-1)*.7,y+1,z+1.7),(1,.6,.4),cloud)
 # Inhabited destination silhouettes on the flight line.
 for x,y,h in [(-2,9,1.0),(4,13,2.0)]:
  box('cloud harbor tower',(x,y,h+1.1),(.65,.65,1.7),CREAM,.06);cone('harbor blue roof',(x,y,h+2.15),.55,.06,.55,BLUE);box('hangar entry',(x,y-.35,h+.95),(.32,.04,.8),BLUE,.08)
 # Route arches provide destination and changing parallax.
 for j in range(3):
  y=7+j*5;line('course gateway '+str(j),[(-1.6,y,.6),(-1.6,y,3.4),(0,y,4.2),(1.6,y,3.4),(1.6,y,.6)],.085,GOLD)
 emblem=star('earned cape brass badge',(0,.56,1.63),.20,root);emblem.data.materials.clear();emblem.data.materials.append(GOLD)
 bpy.context.view_layer.update();evaluated=cape.evaluated_get(bpy.context.evaluated_depsgraph_get());hit,point,normal,_=evaluated.ray_cast(Vector((0,10,1.63-2.5)),Vector((0,-1,0)))
 if not hit:raise RuntimeError('Cape badge must attach to evaluated cloth surface')
 emblem.location=point+cape.location+normal*.105;emblem.rotation_euler=normal.to_track_quat('Y','Z').to_euler()
 dock=box('arrival dock',(0,-4.5,.05),(3.7,3.8,.25),BLUE,.12);stars=[star('collectible '+str(i),(0,0,0),.30) for i in range(3)];cam=camera((6,-12,7),(0,0,2.7),8.8)
 def pose(f):
  travel=-4.5*smooth(60,240,f)
  location=Vector((.16*math.sin(f/24),travel,.15*math.sin(f/18) if f<300 else -.50*smooth(300,320,f)+.12*math.sin((f-320)/10)*max(0,1-(f-320)/30)))
  rotation=Euler((0,.035*math.sin(f/20),-.1*math.sin(f/25)))
  return location,rotation
 def update(f):
  visible(dock,f>=300);location,rotation=pose(f);root.location=location;root.rotation_euler=rotation;hand.location=(.75,-.58,2.22);head.rotation_euler=(0,0,-.1*math.sin(f/35));visible(cape,f>=240);visible(emblem,f>=260);cape.scale.z=max(.001,smooth(240,260,f))
  bpy.context.view_layer.update()
  target=Vector((.85,-.58,2.35));handoff=Vector((.64,-.03,2.44));destination=Vector((.64,.13,1.68))
  for i,(s,contact,stored) in enumerate(zip(stars,[90,142,198],[106,158,218])):
   contact_location,contact_rotation=pose(contact);world_contact=Matrix.Translation(contact_location) @ contact_rotation.to_matrix().to_4x4() @ target
   release=stored-8;drop=max(0,min(1,(f-release)/8));local=target if f<contact else lerp(target,handoff,smooth(contact,release,f)) if f<release else lerp(handoff,destination,drop*drop);s.location=world_contact if f<contact else root.matrix_world @ local;s.rotation_euler=(0,.2,0);s.scale=(1,1,1) if f<stored else (.001,.001,.001)
   if contact-20<=f<=stored+12:
    hand_target=(local if f<release else handoff)+Vector((-.08,.03,-.12));recover=smooth(stored,stored+12,f);hand.location=lerp(lerp((.75,-.58,2.22),hand_target,smooth(contact-20,contact,f)),(.75,-.58,2.22),recover);head.rotation_euler.z=.95*smooth(contact-20,contact-6,f)*(1-recover);head.rotation_euler.x=(.25+.25*smooth(release,stored,f))*smooth(contact-20,contact-6,f)*(1-recover)
  setarm(arm,hand)
  if f<60:look(cam,(3.2,-8.5,4.8),(0,-.2,2.9));cam.data.lens=55
  elif f<120:look(cam,(6,-12,7),(0,.3,2.65));cam.data.lens=48
  elif f<180:look(cam,(4,-9.5,5.5),(.1,0,2.6));cam.data.lens=51
  elif f<240:look(cam,(3,-8.5,5),(.35,-.1,2.5));cam.data.lens=53
  elif f<300:look(cam,(-4,5,4.5),(0,0,2.1));cam.data.lens=43
  else:look(cam,(5,-11,6),(0,0,2.4));cam.data.lens=48
  cam.location.y+=location.y
 return update

def moonpost():
 moss=mat('velvet moss','456963',.95,cloth=True);rock=mat('blue island stone','243C59',.9);housemat=mat('porcelain house','8EADC3',.32);roof=mat('plum ceramic shingles','564276',.29);paper=mat('warm letter paper','F7DFB2',.82);wingmat=mat('moth wing velvet','DBCBB1',.82,cloth=True);window=mat('window warm after delivery','FFC157',.28,0,0)
 island('postal garden',(0,0,-.4),(4,3,.7),moss,rock)
 for i in range(12):
  t=i/11;x=-2.6+4.4*t;y=.8*math.sin(t*3.5)-1.1;uv('curved garden stepping stone',(x,y,.10),(.21,.17,.06),housemat)
  if i%2==0:
   for k in [-1,0,1]:line('garden blade',[(x,y+.38,.08),(x+k*.12,y+.42,.35),(x+k*.15,y+.46,.45)],.025,moss)
 house=box('tiny post house',(1.25,1.4,1.2),(1.7,1.55,2.4),housemat,.16);cone('pitched roof',(1.25,1.4,2.8),1.0,.08,1.1,roof);cyl('chimney',(1.8,1.7,3.16),.18,.7,housemat)
 box('lit window recess',(1.35,.603,1.65),(.7,.07,.78),GOLD,.16);win=box('warm visible window',(1.35,.55,1.65),(.54,.07,.61),window,.12);box('window mullion',(1.35,.50,1.65),(.045,.06,.59),housemat,.01);box('door',(.84,.59,.55),(.6,.08,1.05),LEATHER,.11)
 cyl('mailbox pedestal',(.45,-.32,.9),.075,1.8,GOLD);box('curved mailbox',(.45,-.32,2.0),(1.1,.65,.65),BLUE,.24);box('black slot',(.45,-.661,2.07),(.83,.04,.135),INK,.05);line('slot brass lip',[(.03,-.69,1.98),(.86,-.69,1.98)],.025,GOLD)
 root=empty('moth courier',(-.75,-.15,.08));head,hand,arm=pilot(root,True);head.scale=(.92,.92,.92);spill=light('warm window spill',(1.1,.3,1.65),0,(1,.48,.13),1.0,(-.7,-.1,1.4));spill.data.type='POINT';spill.data.shadow_soft_size=.6
 wings=[]
 for side in [-1,1]:
  w=empty('wing hinge',(side*.30,.27,2.26),root);uv('upper velvet wing',(side*.53,.2,.4),(.64,.13,.96),wingmat,w);uv('lower velvet wing',(side*.48,.16,-.35),(.5,.12,.63),wingmat,w)
  for j in range(3):line('wing vein',[(0,0,0),(side*(.4+j*.1),.055,.2+j*.15),(side*(.6+j*.1),.09,.6+j*.13)],.018,GOLD,w)
  uv('wing eye mark',(side*.66,.045,.58),(.22,.06,.29),CLOTH,w);uv('wing eye core',(side*.66,-.015,.58),(.11,.025,.16),GOLD,w);w.scale=(.85,.85,.85);wings.append(w)
 letters=[]
 for i in range(3):
  e=empty('route letter '+str(i));box('paper', (0,0,0),(.52,.055,.38),paper,.025,e);line('envelope flap',[(-.25,-.037,.17),(0,-.042,-.03),(.25,-.037,.17)],.009,LEATHER,e);uv('wax seal',(0,-.054,-.02),(.06,.025,.06),CLOTH,e);letters.append(e)
 delivery=empty('delivery envelope');box('delivered paper',(0,0,0),(.55,.045,.37),paper,.025,delivery);line('delivery envelope outline',[(-.26,-.029,.16),(0,-.033,-.03),(.26,-.029,.16)],.01,LEATHER,delivery);uv('outlined wax seal',(0,-.047,-.02),(.07,.025,.07),INK,delivery);uv('violet wax',(0,-.071,-.02),(.052,.015,.052),CLOTH,delivery)
 cam=camera((6,-11,6.5),(0,.2,2.3),8)
 def update(f):
  root.location=(-.75,-.15,.08+.12*math.sin(f/14) if f<270 else .08-.45*smooth(270,282,f));root.rotation_euler=(0,0,0);head.rotation_euler=(0,0,0);hand.location=(.75,-.58,2.22)
  for i,(e,c,s) in enumerate(zip(letters,[76,108,138],[94,118,154])):
   p=lerp((1.0+i*.2,-.9,3.1),(.8,-.58,2.35),smooth(c-20,c,f)) if f<c else lerp((.8,-.58,2.35),(.64,-.03,2.06),smooth(c,s,f));e.location=root.location+p;e.scale=(1,1,1) if f<s else (.001,.001,.001)
   if c-16<=f<s:hand.location=p+Vector((-.07,.03,-.12))
  visible(delivery,f>=165)
  # Hand and paper share the world path until support transfer, then hand withdraws.
  begin=Vector((-.18,-.75,2.23));entry=Vector((.45,-.85,2.07));inside=Vector((.45,-.49,2.07))
  pos=lerp(begin,entry,smooth(175,196,f)) if f<196 else lerp(entry,inside,smooth(196,215,f));delivery.location=pos;delivery.rotation_euler=(math.pi/2*smooth(175,196,f),0,0);delivery.scale=(1,1,1) if f<215 else (.001,.001,.001)
  if 165<=f<236:head.rotation_euler.z=1.1*smooth(165,186,f);head.rotation_euler.x=.3*smooth(165,186,f)
  if f>=165:
   hp=pos+Vector((-.06,-.32,-.09));hp=lerp(hp,root.location+Vector((.65,-.57,1.95)),smooth(215,231,f));hand.location=hp-root.location
  setarm(arm,hand);warm=smooth(226,240,f);window.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=tuple(a+(b-a)*warm for a,b in zip((.008,.015,.035,1),(1,.53,.1,1)));window.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=2.5*warm;spill.data.energy=95*warm
  if f>=236:head.rotation_euler.z=1.1+.10*smooth(236,258,f);head.rotation_euler.x=.30-.08*smooth(236,258,f);root.rotation_euler.z=.40*smooth(236,258,f)
  compression=.12*math.sin(math.pi*smooth(282,300,f));bpy.data.objects['tailored coat'].location.z=1.95-compression;head.location.z=2.95-compression
  for i,w in enumerate(wings):
   w.location.z=2.26-compression;w.rotation_euler.z=(-1 if i==0 else 1)*(.16*math.sin(f/5)*(1-smooth(280,310,f))+.45*smooth(300,328,f))
  if f<60:look(cam,(6,-11,6.5),(.15,.3,2.4));cam.data.lens=42
  elif f<180:look(cam,(4,-10,5.3),(-.55,0,2.4));cam.data.lens=43
  elif f<240:look(cam,(2.3,-10,5.0),(.35,.25,1.9));cam.data.lens=44
  else:look(cam,(6,-11,6.6),(.15,.3,2.3));cam.data.lens=42
 return update

def neon():
 metal=mat('tidal polished silver','B2C6DE',.20,.95);black=mat('wet ink','050C20',.19,.7);magenta=mat('magenta lacquer','A70E71',.22,.55);cyan=mat('cyan light','0CC8EF',.3,.1,3);rose=mat('rose light','F51D8F',.25,.1,3)
 title=empty('persistent two line title')
 fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';font=bpy.data.fonts.load(fontpath)
 words=[]
 for txt,z in [('NEON',.88),('TIDE',-.17)]:
  c=bpy.data.curves.new(txt,'FONT');c.body=txt;c.font=font;c.align_x='CENTER';c.align_y='CENTER';c.size=1.22;c.extrude=.14;c.bevel_depth=.025;c.bevel_resolution=4;c.resolution_u=16;o=bpy.data.objects.new(txt,c);bpy.context.collection.objects.link(o);o.rotation_euler=(math.pi/2,0,0);o.location=(0,-.1,z);o.scale=(.84,1,1.15);finish(o,metal,title);words.append(o)
 title.location=(0,0,2.3);title.scale=(1.4,1.4,1.4)
 # Wave ribbons are sculpted physical surfaces, not screenspace rings.
 ribbons=[]
 for k in range(3):
  pts=[]
  for j in range(60):x=-7+j*14/59;pts.append((x,(k-1)*1.0+.7*math.sin(x*.8+k*.25),-.1+.12*k+.7*math.sin(x*.6+k*.35)))
  ribbons.append(line('tidal lacquer ridge '+str(k),pts,.28 if k==1 else .09,magenta if k==1 else black))
 for side in [-1,1]:
  strip=line('reflection strip '+str(side),[(side*3.3,1,-1),(side*3.3,1,5),(side*2.2,1,6)],.055,rose if side<0 else cyan);strip.visible_camera=False
 vs=[];fs=[];profile=[(-100,-.7),(3,-.7)]+[(3+6*math.sin(i*math.pi/2/32),-.7+6*(1-math.cos(i*math.pi/2/32))) for i in range(1,33)]+[(9,30)]
 for y,z in profile:vs.extend([(-100,y,z),(100,y,z)])
 for i in range(len(profile)-1):a=i*2;fs.append((a,a+1,a+3,a+2))
 me=bpy.data.meshes.new('continuous curved tidal chamber');me.from_pydata(vs,[],fs);me.update();chamber=bpy.data.objects.new('continuous curved tidal chamber',me);bpy.context.collection.objects.link(chamber);finish(chamber,black)
 light('wide front reflection',(0,-6,7),1900,(.75,.86,1),5,(0,0,2));light('cyan reflection',(4,-3,4),1600,(.08,.6,1),3,(0,0,2));light('pink reflection',(-4,0,5),1600,(1,.05,.32),3,(0,0,2));cam=camera((5,-12,6),(0,0,2.4),8.6)
 def update(f):
  pulse=math.exp(-((f%15)/4));title.rotation_euler=(0,.13*(1-smooth(0,270,f)),0);title.location=(0,0,2.2)
  for k,r in enumerate(ribbons):r.location.z=.12*math.sin(f/16+k*.7);r.location.y=.15*math.sin(f/28+k)
  if f<90:
   t=smooth(0,89,f);look(cam,lerp((4,-8,3.7),(5,-12,6),t),(0,0,2.3));cam.data.lens=66-18*t
  elif f<180:look(cam,(5-2*smooth(90,179,f),-12,6),(0,0,2.4));cam.data.lens=48
  elif f<270:
   t=smooth(180,269,f);look(cam,(-4+8*t,-12,6),(0,0,2.35));cam.data.lens=42;words[0].location.x=-.5*math.sin(math.pi*t);words[1].location.x=.5*math.sin(math.pi*t)
  else:
   words[0].location.x=0;words[1].location.x=0;t=smooth(270,314,f);look(cam,lerp((4,-12,6),(0,-13,5.5),t),(0,0,2.4));cam.data.lens=48;title.rotation_euler=tuple(v*(1-t) for v in title.rotation_euler)
 return update

UPDATE={'starfall':starfall,'moonpost':moonpost,'neon-tide':neon}[A.film]()
# Provenance also reports actual face-material use; source hash identifies this maker.
materials={o.name:{str(i):o.data.materials[i].name if i<len(o.data.materials) and o.data.materials[i] else 'UNASSIGNED' for i in Counter(p.material_index for p in o.data.polygons)} for o in S.objects if o.type=='MESH'}
frames=[]
for token in A.frames.split(','):
 if '-' in token:a,b=map(int,token.split('-'));frames.extend(range(a,b+1))
 else:frames.append(int(token))
for f in frames:
 output=OUT/f'{f:04d}.png'
 if output.exists():raise RuntimeError(f'Preserving existing output: {output}; choose new --output')
 began=time.perf_counter();S.frame_set(f);UPDATE(f);bpy.context.view_layer.update();S.render.filepath=str(output);bpy.ops.render.render(write_still=True);TIMINGS.append({'frame':f,'seconds':time.perf_counter()-began})
(OUT/'provenance.json').write_text(json.dumps({'label':'NEW RECONSTRUCTION, no recovered source bytes','source':str(Path(__file__).relative_to(ROOT)),'source_sha256':SOURCE_SHA,'blender':bpy.app.version_string,'engine':S.render.engine,'samples':A.samples,'seed':1949,'frames':frames,'width':S.render.resolution_x,'height':S.render.resolution_y,'fps':30,'material_faces':materials,'frame_timings':TIMINGS},indent=2))
