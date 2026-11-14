"""Original three-courtyard maps, art and BSP. Uses permitted Freedoom resources."""
from pathlib import Path
import struct as st, math, zipfile, hashlib, subprocess, sys
R=Path(__file__).resolve().parents[1]; out=R/'public'/'engine'
pack=lambda fmt,*v:st.pack('<'+fmt,*v)
name=lambda s:s.encode('ascii').ljust(8,b'\0')[:8]
def readwad(p):
 d=p.read_bytes();n,off=st.unpack_from('<ii',d,4)
 return [(d[off+i*16+8:off+i*16+16].rstrip(b'\0').decode(),d[a:a+l]) for i in range(n) for a,l in [st.unpack_from('<ii',d,off+i*16)]]
def writewad(p,lumps,kind=b'PWAD'):
 data=bytearray(b'\0'*12);entries=[]
 for n,d in lumps:entries.append((len(data),len(d),n));data+=d
 off=len(data)
 for pos,l,n in entries:data+=pack('ii',pos,l)+name(n)
 data[:12]=kind+pack('ii',len(entries),off);p.write_bytes(data)
base=readwad(out/'freedoom2.wad'); palette=dict(base)['PLAYPAL'][:768]
def color(r,g,b):return min(range(256),key=lambda i:sum((palette[i*3+j]-v)**2 for j,v in enumerate((r,g,b))))
gold=color(195,155,85);sand=color(113,88,58);dark=color(38,43,37);teal=color(68,170,161)
def patch(w,h,fn,left=0,top=0):
 data=bytearray(pack('hhhh',w,h,left,top)+b'\0'*(w*4))
 for x in range(w):
  st.pack_into('<i',data,8+x*4,len(data));y=0
  while y<h:
   if fn(x,y) is None:y+=1;continue
   start=y;px=[]
   while y<h and fn(x,y) is not None:px.append(fn(x,y));y+=1
   data+=bytes([start,len(px),0,*px,0])
  data+=b'\xff'
 return bytes(data)
def wall(x,y):
 if y%32 in (0,1) or (x+(32 if (y//32)%2 else 0))%64<2:return dark
 if 42<y<58 and (abs((x%32)-16)+abs(y-50))%12<3:return gold
 return sand+(x*7+y*3)%3
lumps=[('TARWALL',patch(64,128,wall)),('TARFLAT',bytes(sand if (x//8+y//8)%2 else dark for y in range(64) for x in range(64))),('TARCEIL',bytes([dark])*4096)]
# Append new texture definition to existing table (preserve engine prerequisites).
bd=dict(base); pn=bd['PNAMES'];cnt=st.unpack_from('<i',pn)[0];lumps+=[('PNAMES',pack('i',cnt+1)+pn[4:]+name('TARWALL'))]
tx=bd['TEXTURE1'];tc=st.unpack_from('<i',tx)[0];offsets=st.unpack_from('<'+'i'*tc,tx,4)
body=tx[4+tc*4:];newstart=4+(tc+1)*4
newtex=name('TARWALL')+pack('ihhih',0,64,128,0,1)+pack('hhhhh',0,0,cnt,0,0)
lumps+=[('TEXTURE1',pack('i',tc+1)+b''.join(pack('i',o+4) for o in offsets)+pack('i',newstart+len(body))+body+newtex)]
# Replace lamp graphic with original luminous historical stele; no borrowed image.
lumps += [('S_START',b''),('COLUA0',patch(32,80,lambda x,y: (teal if (x+y)%9<3 else gold) if 5<x<27 and y>5 else None,16,80)),('S_END',b''),('F_START',b''),('TARFLAT',bytes(sand if (x//8+y//8)%2 else dark for y in range(64) for x in range(64))),('TARCEIL',bytes([dark])*4096),('F_END',b'')]
for level in range(1,11):
 verts=[(0,0),(0,1024),(512,0),(512,1024),(1024,0),(1024,1024),(1536,0),(1536,1024)]
 # Clockwise polygon edges; shared borders have two sides.
 lines=[];sides=[];segs=[];ss=[]
 edge_map={}
 for sec,ids in enumerate([(0,1,3,2),(2,3,5,4),(4,5,7,6)]):
  first=len(segs)
  for j in range(4):
   a,b=ids[j],ids[(j+1)%4];shared=(b,a) in edge_map
   sid=len(sides);sides.append(pack('hh',0,0)+name('TARWALL')+name('TARWALL')+name('-' if (a//2!=b//2 or a in (0,1,6,7)) else 'TARWALL')+pack('h',sec))
   if shared:
    li=edge_map[(b,a)];lines[li][2]=4;lines[li][6]=sid;direction=1
   else:
    li=len(lines);lines.append([a,b,1,0,0,sid,65535]);edge_map[(a,b)]=li;direction=0
   dx=verts[b][0]-verts[a][0];dy=verts[b][1]-verts[a][1];ang=int(math.atan2(dy,dx)*65536/(2*math.pi))&65535
   segs.append(pack('HHHHHH',a,b,ang,li,direction,0))
  ss.append(pack('HH',4,first))
 # Set middle textures only on external walls; internal portals have no middle.
 for line in lines:
  for sid in [line[5],line[6]]:
   if sid==65535:continue
   d=bytearray(sides[sid]);d[20:28]=name('-' if line[2]==4 else 'TARWALL');sides[sid]=bytes(d)
 sectors=b''.join(pack('hh',0,0 if i==1 else 160)+name('TARFLAT')+name('TARCEIL')+pack('hhh',200-i*8,0,i) for i in range(3))
 bbox=lambda l,r:pack('hhhh',1024,0,l,r)
 nodes=pack('hhhh',1024,0,0,1024)+bbox(1024,1536)+bbox(512,1024)+pack('HH',0x8002,0x8001)
 nodes+=pack('hhhh',512,0,0,1024)+bbox(512,1536)+bbox(0,512)+pack('HH',0,0x8000)
 things=[(256,512,0,1,7),(400,512,0,2028,7),(128,800,0,2028,7),(1408,512,0,2028,7)]
 for i in range(min(4,(level-1)//2)):things.append((1150+(i%2)*150,200+(i//2)*600,180,3004,7))
 # Easter egg: the author's yurt hides in a corner of the Kazakh Khanate courtyard (sprite COL1 = yurt).
 if level==10:things.append((112,150,45,30,7))
 # Conservative blockmap: every cell references every line; correct for a tiny map.
 cells=13*9;head=pack('hhhh',-64,-64,13,9);offset=4+cells
 block=head+b''.join(pack('H',offset) for _ in range(cells))+pack('H',0)+b''.join(pack('H',i) for i in range(len(lines)))+pack('H',65535)
 lumps += [(f'MAP{level:02}',b''),('THINGS',b''.join(pack('hhhhh',*t) for t in things)),('LINEDEFS',b''.join(pack('HHHHHHH',*v) for v in lines)),('SIDEDEFS',b''.join(sides)),('VERTEXES',b''.join(pack('hh',*v) for v in verts)),('SEGS',b''.join(segs)),('SSECTORS',b''.join(ss)),('NODES',nodes),('SECTORS',sectors),('REJECT',bytes(2)),('BLOCKMAP',block)]
from camp_art import camp_art
from camp_map import make
sprites,flats,sky=camp_art(base,patch,color)
s=lumps.index(('S_END',b''));lumps[s:s]=list(sprites.items())
s=lumps.index(('F_END',b''));lumps[s:s]=list(flats.items())
s=lumps.index(('MAP01',b''));lumps[s:s+11]=make(pack,name)
lumps.append(('RSKY1',sky))
writewad(out/'tarikh.wad',lumps)
# All maps are replaced; omit unused map, music and sound lumps to reduce download.
trim=[];skip=0
for n,d in base:
 if n.startswith('MAP') and n[3:].isdigit():skip=10;continue
 if skip:skip-=1;continue
 if n.startswith(('DS','DP')):continue
 trim.append((n,d))
if not any(n=='D_RUNNIN' for n,d in trim):
 import tempfile
 with zipfile.ZipFile(R.parent/'tools'/'freedoom.zip') as z, tempfile.TemporaryDirectory(dir=R.parent/'tools'/'build-temp') as tmp:
  original=Path(tmp)/'base.wad';original.write_bytes(z.read(next(k for k in z.namelist() if k.endswith('/freedoom2.wad'))))
  trim.extend((n,d) for n,d in readwad(original) if n.startswith('D_'))
writewad(out/'freedoom2.wad',trim,b'IWAD')
# Classic renderer selects the final namespaces. Include all Freedoom sprites
# and flats plus overrides, otherwise a one-sprite namespace hides actors.
subprocess.run([sys.executable,str(R/'scripts'/'prepare-assets.py')],check=True)
print('WAD ready:',[(p.name,p.stat().st_size) for p in out.glob('*.wad')])
