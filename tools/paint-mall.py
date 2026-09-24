from pathlib import Path
from PIL import Image,ImageDraw
import random
random.seed(101)
for name,base in [('mall-plaster',(112,119,104)),('mall-stone',(148,142,124)),('mall-shutter',(92,103,99))]:
 im=Image.new('RGB',(256,256));px=im.load()
 for y in range(256):
  for x in range(256):
   noise=random.randint(-12,10);dark=1-.14*(1-y/255)
   if name=='mall-shutter':noise+=-20 if y%12<3 else 0
   px[x,y]=tuple(max(0,min(255,int(c*dark)+noise)) for c in base)
 d=ImageDraw.Draw(im)
 for i in range(20):
  x=random.randrange(256);y=random.randrange(100);width=random.randrange(2,9)
  d.line((x,y,x+random.randrange(-5,5),y+random.randrange(25,150)),fill=tuple(int(c*.7) for c in base),width=width)
 im.save('public/assets/models/'+name+'.png')
Path('art-source/models/material-palette.txt').write_text('256px painted material family: plaster water runs, limestone edge shadow, steel shutter slats. Seed 101. Original project art.\n')
