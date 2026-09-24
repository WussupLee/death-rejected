"""Original DEATH REJECTED mesh authoring. Writes editable Blockbench generic models and glTF 2 GLB.
No reference images or third-party meshes are used. Units: meters in GLB, 16 units/m in Blockbench.
"""
import json, struct, math, uuid, random
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models'; SRC=ROOT/'art-source/models'
OUT.mkdir(parents=True,exist_ok=True); SRC.mkdir(parents=True,exist_ok=True)
random.seed(71)
# A deliberately painted 256px palette atlas: seams, oxide, bone cracks, skin and leather.
colors=['#25292b','#657470','#671a28','#c6b697','#89614c','#dcdac4','#343333','#38272b']
atlas=Image.new('RGB',(256,256)); d=ImageDraw.Draw(atlas)
for tile,color in enumerate(colors):
 x=(tile%4)*64;y=(tile//4)*128
 d.rectangle((x,y,x+63,y+127),fill=color)
 base=tuple(int(color[k:k+2],16) for k in (1,3,5))
 for j in range(1100):
  px=x+random.randrange(64);py=y+random.randrange(128);v=random.randint(-16,12)
  d.point((px,py),fill=tuple(max(0,min(255,c+v)) for c in base))
 d.line((x+3,y+2,x+3,y+125),fill=tuple(max(0,c-22) for c in base),width=2)
 for j in range(9):
  xx=x+random.randrange(8,56);yy=y+random.randrange(10,108)
  d.line((xx,yy,xx+random.randrange(-4,5),yy+random.randrange(4,15)),fill=tuple(max(0,c-30) for c in base))
atlas.save(OUT/'reliquary-atlas.png');atlas.save(SRC/'reliquary-atlas.png')
PNG=(OUT/'reliquary-atlas.png').read_bytes()

def model(name): return {'name':name,'parts':[],'clips':{}}
def part(m,name,pos,size,tile=0,parent=None,rotation=None,taper=1):
 m['parts'].append(dict(name=name,pos=pos,size=size,tile=tile,parent=parent,rotation=rotation or [0,0,0],taper=taper));return name

def arm(m,name,x,z=0):
 part(m,name,[x,-.17,z],[.105,.3,.12],0,rotation=[-.6,0,.15 if x<0 else -.15],taper=.8)
 part(m,name+'-wrist',[0,-.18,0],[.085,.12,.09],4,parent=name)
 part(m,name+'-hand',[0,-.26,-.025],[.1,.14,.13],0,parent=name)
 for i in range(3):part(m,name+f'-ring{i}',[(i-1)*.024,-.27,-.1],[.013,.035,.018],1,parent=name)

models=[]
p=model('blackthorn');part(p,'receiver',[0,0,0],[.15,.13,.34],0,taper=.87)
part(p,'slide',[0,.09,-.06],[.135,.085,.43],1)
part(p,'barrel',[0,.06,-.295],[.075,.066,.09],0)
part(p,'muzzle',[0,.06,-.343],[.04,.033,.004],6)
part(p,'grip',[0,-.14,.095],[.115,.22,.125],2,rotation=[-.24,0,0],taper=.85)
part(p,'magazine',[0,-.255,.068],[.112,.045,.12],1)
part(p,'front-sight',[0,.148,-.21],[.016,.029,.025],5)
for x in [-.045,.045]:part(p,'rear-sight'+str(x),[x,.15,.1],[.014,.035,.04],0)
for i in range(7):part(p,'slide-serration'+str(i),[.07,.093,.01+i*.014],[.005,.063,.005],0)
part(p,'guard-front',[0,-.13,-.075],[.09,.02,.14],1)
part(p,'guard-upright',[0,-.086,-.14],[.085,.095,.017],1)
arm(p,'right-arm',.035,.19);arm(p,'support-arm',-.12,.18)
p['clips']={'fire':{'slide':('translation',[[0,.09,-.06],[0,.09,.015],[0,.09,-.06]],[0,.04,.16])},'reload':{'magazine':('translation',[[0,-.255,.068],[0,-.7,.068],[0,-.7,.068],[0,-.255,.068]],[0,.2,.65,1.05]),'support-arm':('rotation',[[0,0,0],[.7,.1,-.8],[.7,.1,-.8],[0,0,0]],[0,.2,.7,1.05])}}
models.append(p)
p=model('widowmaker');part(p,'receiver',[0,0,.05],[.2,.18,.5],0,taper=.9)
part(p,'barrel',[0,.07,-.43],[.082,.08,.57],1)
part(p,'mag-tube',[0,-.045,-.37],[.067,.065,.48],0)
part(p,'pump',[0,-.065,-.38],[.19,.14,.25],2)
for i in range(6):part(p,'pump-rib'+str(i),[0,0,-.1+i*.037],[.195,.145,.012],0,parent='pump')
part(p,'stock',[0,-.035,.42],[.16,.22,.28],3,rotation=[-.2,0,0],taper=.6)
part(p,'sight',[0,.13,-.64],[.022,.026,.04],5)
arm(p,'right-arm',.045,.32);arm(p,'support-arm',-.095,-.16)
p['clips']={'fire':{'pump':('translation',[[0,-.065,-.38],[0,-.065,-.38],[0,-.065,-.19],[0,-.065,-.38]],[0,.15,.32,.57]),'support-arm':('translation',[[-.095,-.17,-.16],[-.095,-.17,-.16],[-.095,-.17,.02],[-.095,-.17,-.16]],[0,.15,.32,.57])},'reload':{'right-arm':('rotation',[[0,0,0],[.5,0,.8],[0,0,0]],[0,.55,1.38])}}
models.append(p)
p=model('knife');arm(p,'right-arm',0,.16)
part(p,'hilt',[0,-.1,-.1],[.09,.085,.23],2)
part(p,'guard',[0,-.1,-.24],[.23,.035,.045],1)
part(p,'blade',[0,-.1,-.45],[.08,.014,.39],1,taper=.05)
part(p,'blood-groove',[0,-.09,-.41],[.016,.006,.25],2)
p['clips']={'slash':{'right-arm':('rotation',[[0,0,0],[0,.5,.3],[0,-.8,-1.1],[0,0,0]],[0,.09,.22,.44])}}
models.append(p)

for kind in ['thrall','stalker','hunter']:
 m=model(kind);human=kind!='stalker';skin=4 if kind=='hunter' else 7
 part(m,'torso',[0,1.28 if human else .78,0],[.53 if human else .62,.68 if human else .4,.3 if human else 1.1],0 if kind=='hunter' else 7,taper=.72)
 if human:
  part(m,'coat',[0,.68,.025],[.73,.86,.42],0,taper=.6)
  for side in [-1,1]:
   part(m,f'leg{side}',[side*.17,.68,0],[.19,.6,.19],0,rotation=[0,0,side*.04])
   part(m,f'boot{side}',[0,-.42,.075],[.23,.25,.36],0,parent=f'leg{side}')
   part(m,f'arm{side}',[side*.38,1.54,0],[.17,.58,.18],0 if kind=='hunter' else 7,rotation=[-.18,0,side*.15])
   part(m,f'forearm{side}',[0,-.47,.05],[.14,.43,.15],skin,parent=f'arm{side}',taper=.7)
   part(m,f'fingers{side}',[0,-.76,.12],[.16,.22,.1],skin,parent=f'arm{side}',taper=.2 if kind=='thrall' else .8)
   part(m,f'lapel{side}',[side*.13,1.5,.175],[.09,.36,.04],1 if kind=='thrall' else 0,rotation=[0,0,side*-.27])
 else:
  for side in [-1,1]:
   for z in [-.4,.4]:
    n=f'leg{side}-{z}';part(m,n,[side*.38,.82,z],[.15,.5,.2],7,rotation=[.4 if z<0 else -.4,0,side*.45])
    part(m,n+'shin',[0,-.43,.12],[.1,.43,.12],3,parent=n,rotation=[-.5,0,0],taper=.6)
    part(m,n+'talon',[0,-.62,.27],[.2,.08,.34],1,parent=n,taper=.1)
  for i in range(5):part(m,'spine'+str(i),[0,1.03,-.4+i*.21],[.085,.27,.12],3,taper=.08)
 headY=1.99 if human else 1.06;headZ=.035 if human else .64
 part(m,'head',[0,headY,headZ],[.32,.41 if human else .27,.3 if human else .53],skin if kind=='hunter' else 3,taper=.73)
 for side in [-1,1]:
  part(m,'socket'+str(side),[side*.083,.047,.154 if human else .267],[.097,.058,.015],0,parent='head')
  part(m,'eye'+str(side),[side*.083,.047,.165 if human else .278],[.062,.023,.01],5,parent='head')
 if kind=='thrall':
  for side in [-1,1]:
   part(m,'crown'+str(side),[side*.18,2.3,0],[.11,.48,.12],3,rotation=[0,0,side*-.3],taper=.02)
   part(m,'shoulder'+str(side),[side*.44,1.69,0],[.27,.16,.42],1,rotation=[0,0,side*-.4],taper=.2)
  part(m,'jaw',[0,1.77,.15],[.19,.14,.16],7,taper=.4)
  for i in range(5):part(m,'tooth'+str(i),[(i-2)*.035,1.82,.23],[.023,.09,.022],3,taper=.03)
 elif kind=='stalker':
  part(m,'jaw',[0,.9,.77],[.25,.12,.42],7,taper=.6)
  for i in range(6):part(m,'tooth'+str(i),[(i%3-1)*.078,.94,.82+(i//3)*.15],[.035,.1,.04],3,taper=.01)
 else:
  part(m,'nose',[0,1.99,.21],[.065,.12,.09],4,taper=.6)
  part(m,'goatee',[0,1.83,.179],[.15,.11,.03],0,taper=.5)
  part(m,'tattoo-cross',[.136,2.01,.15],[.012,.09,.017],0)
  part(m,'tattoo-bar',[.136,2.03,.15],[.06,.012,.018],0)
  for i in range(18):
   a=i*2.399;part(m,'curl'+str(i),[math.cos(a)*(.17 if i<12 else .11),2.15+(i%3)*.045,math.sin(a)*.15],[.11,.12,.1],0,rotation=[i*.3,i*.6,i*.2],taper=.65)
  for i in range(13):
   x=(i-6)*.029;part(m,'chain'+str(i),[x,1.52+abs(x)*.9,.19],[.024,.04,.025],1,rotation=[0,0,math.sin(i)*.35])
  part(m,'pendant',[0,1.43,.2],[.048,.095,.025],1)
 legs=[p['name'] for p in m['parts'] if p['name'].startswith('leg') and 'shin' not in p['name'] and 'talon' not in p['name']]
 m['clips']={'walk':{},'attack':{},'hurt':{},'death':{},'idle':{}}
 for i,n in enumerate(legs):
  a=.5 if i%2 else -.5
  m['clips']['walk'][n]=('rotation',[[a,0,0],[-a,0,0],[a,0,0]],[0,.35,.7])
 for n in (['arm-1','arm1'] if human else legs[:2]):m['clips']['attack'][n]=('rotation',[[0,0,0],[-1.8,0,.1],[-.9,0,0],[0,0,0]],[0,.2,.32,.75])
 m['clips']['hurt']['torso']=('rotation',[[0,0,0],[-.22,0,.08],[0,0,0]],[0,.06,.25])
 m['clips']['death']['torso']=('rotation',[[0,0,0],[.6,0,.3],[1.4,0,.3]],[0,.3,.8])
 m['clips']['idle']['head']=('rotation',[[0,-.035,0],[0,.035,0],[0,-.035,0]],[0,1.2,2.4])
 if kind=='hunter':m['clips']['scratch']={'arm1':('rotation',[[-.3,0,-.1],[-1.6,0,-.8],[-1.3,0,-.9],[-.3,0,-.1]],[0,.5,.9,1.4])}
 models.append(m)
# Authored reusable store module with inset panes, mullions, canopy and decayed display.
m=model('storefront');part(m,'lintel',[0,4.15,0],[11,.38,.65],0)
for side in [-1,1]:part(m,'jamb'+str(side),[side*5.35,2,0],[.3,4,.6],1)
for i in range(5):
 part(m,'pane'+str(i),[-4.1+i*2.05,1.85,.12],[1.96,3.4,.08],6)
 part(m,'mullion'+str(i),[-5.1+i*2.05,1.85,.2],[.07,3.5,.12],1)
part(m,'display',[0,.35,.75],[8,.7,1.1],0)
models.append(m)

# The structural module family uses the same collision dimensions as WorldLayout.
m=model('pillar')
part(m,'shaft',[0,2.55,0],[1.1,5.1,1.1],3)
for y in [.18,.65,4.7,5.0]:part(m,'band'+str(y),[0,y,0],[1.18,.12,1.18],1)
part(m,'water-stain',[.556,2.2,0],[.005,2.2,.2],6)
models.append(m)
m=model('fountain')
part(m,'basin',[0,0,0],[9.1,1,9.1],3)
m['parts'][-1]['lathe']=[[0,4.55],[.15,4.55],[.2,4.25],[.78,4.25],[.84,3.8],[.3,3.7]]
part(m,'pedestal',[0,.38,0],[2.5,2.7,2.5],3)
m['parts'][-1]['lathe']=[[0,1.25],[.2,1.2],[.3,.72],[1.85,.65],[2.1,1.65],[2.35,1.7],[2.4,1.35]]
models.append(m)
m=model('escalator')
for i in range(40):
 h=(i+1)/40*5.4
 part(m,'tread'+str(i),[0,h/2,i*.3+.15],[3.4,h,.3],1 if i%2 else 0)
for side in [-1,1]:
 part(m,'handrail'+str(side),[side*1.8,3.6,6],[.16,.22,math.hypot(12,5.4)],0,rotation=[-math.atan2(5.4,12),0,0])
models.append(m)
m=model('service-door')
part(m,'door',[0,1.3,0],[1.5,2.6,.12],6)
for side in [-1,1]:part(m,'jamb'+str(side),[side*.82,1.35,.06],[.12,2.7,.18],1)
part(m,'lintel',[0,2.7,.06],[1.75,.12,.18],1)
part(m,'push-bar',[0,1.2,.13],[1.1,.08,.06],1)
part(m,'vent',[0,.4,.08],[1,.45,.03],0)
models.append(m)
m=model('railing')
part(m,'top',[0,1.05,0],[2,.12,.12],1)
for side in [-1,1]:part(m,'post'+str(side),[side*.96,.54,0],[.08,1.08,.08],1)
models.append(m)
m=model('debris')
part(m,'fallen-tile',[0,.04,0],[.6,.08,.6],3,rotation=[0,.1,0])
part(m,'torn-board',[.2,.12,.1],[.8,.05,.25],0,rotation=[0,-.3,.1])
models.append(m)

def quat(e):
 x,y,z=[a/2 for a in e];cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
 return [sx*cy*cz+cx*sy*sz,cx*sy*cz-sx*cy*sz,cx*cy*sz+sx*sy*cz,cx*cy*cz-sx*sy*sz]

def export(m):
 buf=bytearray();views=[];acc=[];meshes=[];nodes=[];elements=[];groups=[];ids={p['name']:str(uuid.uuid5(uuid.NAMESPACE_URL,m['name']+'/'+p['name'])) for p in m['parts']}
 def blob(data):
  while len(buf)%4:buf.append(0)
  start=len(buf);buf.extend(data);views.append({'buffer':0,'byteOffset':start,'byteLength':len(data)});return len(views)-1
 def accessor(values,n,kind='VEC3'):
  flat=[v for row in values for v in row] if isinstance(values[0],list) else values
  view=blob(struct.pack('<'+'f'*len(flat),*flat));a={'bufferView':view,'componentType':5126,'count':len(flat)//n,'type':kind}
  if kind=='SCALAR':a.update(min=[min(flat)],max=[max(flat)])
  if kind=='VEC3':a.update(min=[min(flat[i::n]) for i in range(n)],max=[max(flat[i::n]) for i in range(n)])
  acc.append(a);return len(acc)-1
 indices={p['name']:i for i,p in enumerate(m['parts'])}
 for p in m['parts']:
  w,h,l=[v/2 for v in p['size']];t=p['taper']
  # Faceted anatomy and chamfered metal profiles, rather than stacked cubes.
  anatomy=m['name'] in ['thrall','stalker','hunter'] and any(p['name'].startswith(k) for k in ['head','torso','coat','arm','forearm','leg','curl','boot','fingers','jaw','nose','crown','spine','tooth'])
  armshape='arm' in p['name'] or 'wrist' in p['name'] or 'hand' in p['name']
  verts=[];faces=[]
  if 'lathe' in p:
   profile=p['lathe']
   for yy,radius in profile:
    for j in range(16):verts.append([math.cos(j*math.pi/8)*radius,yy,math.sin(j*math.pi/8)*radius])
   for ring in range(len(profile)-1):
    for j in range(16):faces.append([ring*16+j,(ring+1)*16+j,(ring+1)*16+(j+1)%16,ring*16+(j+1)%16])
  elif anatomy or armshape:
   rings=[(-1,.66),(-.65,.92),(.25,1),(.78,.84),(1,.55)] if p['name'].startswith(('head','curl')) else [(-1,.7),(-.75,.93),(.55,1),(1,.68)]
   if p['name'].startswith(('crown','spine','tooth')):rings=[(-1,1),(0,.6),(1,.015)]
   for yy,scale in rings:
    for j in range(8):
     angle=j*math.pi/4+math.pi/8
     verts.append([math.cos(angle)*w*scale,yy*h,math.sin(angle)*l*scale])
   faces.append(list(range(8)))
   for ring in range(len(rings)-1):
    for j in range(8):faces.append([ring*8+j,(ring+1)*8+j,(ring+1)*8+(j+1)%8,ring*8+(j+1)%8])
   faces.append(list(range(len(rings)*8-1,(len(rings)-1)*8-1,-1)))
  else:
   bevel=.22
   profile=[(-1,-1+bevel),(-1+bevel,-1),(1-bevel,-1),(1,-1+bevel),(1,1-bevel),(1-bevel,1),(-1+bevel,1),(-1,1-bevel)]
   for zz,scale in [(-l,1),(l,t)]:
    for xx,yy in profile:verts.append([xx*w*scale,yy*h,zz])
   faces=[list(range(7,-1,-1)),list(range(8,16))]+[[j,(j+1)%8,(j+1)%8+8,j+8] for j in range(8)]
  positions=[];normals=[];uvs=[];bbfaces={}
  tx=(p['tile']%4)*64;ty=(p['tile']//4)*128
  for fi,face in enumerate(faces):
   a,b,c=[verts[j] for j in face[:3]];u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
   norm=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];ln=math.sqrt(sum(q*q for q in norm));norm=[q/ln for q in norm]
   coords=[[tx+32+27*math.cos(j*2*math.pi/len(face)),ty+64+56*math.sin(j*2*math.pi/len(face))] for j in range(len(face))]
   for j in [v for k in range(1,len(face)-1) for v in [0,k,k+1]]:positions.append(verts[face[j]]);normals.append(norm);uvs.append([coords[j][0]/256,coords[j][1]/256])
   bbfaces[str(fi)]={'vertices':[str(k) for k in face],'uv':{str(k):coords[j] for j,k in enumerate(face)},'texture':0}
  meshes.append({'name':p['name'],'primitives':[{'attributes':{'POSITION':accessor(positions,3),'NORMAL':accessor(normals,3),'TEXCOORD_0':accessor(uvs,2,'VEC2')},'material':0}]})
  n={'name':p['name'],'mesh':len(meshes)-1,'translation':p['pos'],'rotation':quat(p['rotation'])}
  children=[indices[q['name']] for q in m['parts'] if q['parent']==p['name']]
  if children:n['children']=children
  nodes.append(n)
  elements.append({'name':p['name'],'type':'mesh','uuid':str(uuid.uuid5(uuid.NAMESPACE_URL,ids[p['name']]+'/mesh')),'origin':[v*16 for v in p['pos']],'rotation':[v*180/math.pi for v in p['rotation']],'vertices':{str(i):[v*16 for v in vert] for i,vert in enumerate(verts)},'faces':bbfaces,'visibility':True,'color':p['tile']})
 def group(p):return {'name':p['name'],'uuid':ids[p['name']],'origin':[v*16 for v in p['pos']],'children':[str(uuid.uuid5(uuid.NAMESPACE_URL,ids[p['name']]+'/mesh'))]+[group(q) for q in m['parts'] if q['parent']==p['name']]}
 animations=[];bbanims=[]
 for name,tracks in m['clips'].items():
  samplers=[];channels=[];animators={};duration=0
  for partname,(path,values,times) in tracks.items():
   duration=max(duration,max(times));out=[quat(v) for v in values] if path=='rotation' else values
   samplers.append({'input':accessor(times,1,'SCALAR'),'output':accessor(out,4 if path=='rotation' else 3,'VEC4' if path=='rotation' else 'VEC3'),'interpolation':'LINEAR'})
   channels.append({'sampler':len(samplers)-1,'target':{'node':indices[partname],'path':path}})
   animators[ids[partname]]={'name':partname,'type':'bone','keyframes':[{'channel':'rotation' if path=='rotation' else 'position','time':time,'data_points':[dict(zip(['x','y','z'],[v*180/math.pi if path=='rotation' else v*16 for v in value]))],'interpolation':'linear','uuid':str(uuid.uuid5(uuid.NAMESPACE_URL,m['name']+'/'+name+'/'+partname+'/'+str(time)))} for time,value in zip(times,values)]}
  animations.append({'name':name,'samplers':samplers,'channels':channels});bbanims.append({'name':name,'uuid':str(uuid.uuid5(uuid.NAMESPACE_URL,m['name']+'/clip/'+name)),'loop':'loop' if name in ['walk','idle'] else 'once','length':duration,'animators':animators})
 imageview=blob(PNG)
 gltf={'asset':{'version':'2.0','generator':'DEATH REJECTED authored mesh pipeline'},'scene':0,'scenes':[{'nodes':[i for i,p in enumerate(m['parts']) if p['parent'] is None]}],'nodes':nodes,'meshes':meshes,'materials':[{'name':'Reliquary painted atlas','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':.18,'roughnessFactor':.78}}],'textures':[{'sampler':0,'source':0}],'samplers':[{'magFilter':9728,'minFilter':9984}],'images':[{'bufferView':imageview,'mimeType':'image/png'}],'bufferViews':views,'accessors':acc,'buffers':[{'byteLength':len(buf)}]}
 if animations:gltf['animations']=animations
 jb=json.dumps(gltf,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);buf+=b'\0'*((-len(buf))%4)
 glb=struct.pack('<III',0x46546c67,2,12+8+len(jb)+8+len(buf))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(buf),0x004e4942)+buf
 (OUT/(m['name']+'.glb')).write_bytes(glb)
 import base64
 bb={'meta':{'format_version':'4.10','model_format':'free','box_uv':False},'name':m['name'],'resolution':{'width':256,'height':256},'elements':elements,'outliner':[group(p) for p in m['parts'] if p['parent'] is None],'textures':[{'name':'reliquary-atlas.png','uuid':str(uuid.uuid5(uuid.NAMESPACE_URL,'death-rejected/atlas')),'source':'data:image/png;base64,'+base64.b64encode(PNG).decode(),'width':256,'height':256}],'animations':bbanims}
 (SRC/(m['name']+'.bbmodel')).write_text(json.dumps(bb,indent=2))
 return {'url':'assets/models/'+m['name']+'.glb','source':'art-source/models/'+m['name']+'.bbmodel','animations':list(m['clips']),'triangles':sum(a['count']//3 for a in acc if a.get('type')=='VEC3' and a.get('min') is not None)//2}
manifest={'version':1,'assets':{m['name']:export(m) for m in models}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
