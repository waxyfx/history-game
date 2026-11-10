"""Axis-aligned convex subsectors with an independently generated BSP tree."""
import struct
def make(pack,name):
 xs=[-64,0,320,640,960,1008,1536,1600];ys=[-64,0,320,448,576,704,1024,1088]
 nx=len(xs)-1;ny=len(ys)-1;verts=[(x,y) for x in xs for y in ys];vid=lambda i,j:i*len(ys)+j
 edges={};lines=[];sides=[];segs=[];subs=[];sectors=[];nodes=[]
 for i in range(nx):
  for j in range(ny):
   rim=i in (0,nx-1) or j in (0,ny-1)
   gate=i==4 and j==3;fence=i==4 and not rim and not gate
   floor=0 if rim else 72 if fence or gate else 8 if j in (1,5) else 0
   ceil=0 if rim else 256
   tex='WOOD1' if gate or fence else 'STONE2'
   sectors.append(pack('hh',floor,ceil)+name('THPATH' if j==3 else 'THGRASS')+name('F_SKY1')+pack('hhh',235 if not rim else 200,0,91 if gate else 0))
   a=[vid(i,j),vid(i,j+1),vid(i+1,j+1),vid(i+1,j)]
   subs.append(pack('HH',4,len(segs)))
   for k,u in enumerate(a):
    v=a[(k+1)%4];s=len(sides);sides.append(pack('hh',0,0)+name(tex)+name('WOOD1' if i in (3,4,5) else tex)+name('-')+pack('h',i*ny+j))
    if (v,u) in edges:
     idx=edges[v,u];lines[idx][2]=4;lines[idx][6]=s;di=1
    else:
     idx=len(lines);edges[u,v]=idx;lines.append([u,v,1,0,0,s,65535]);di=0
    segs.append(pack('HHHHHH',u,v,[16384,0,49152,32768][k],idx,di,0))
 def bsp(i,j,k,l):
  if k-i==l-j==1:return 32768+i*ny+j
  if k-i>=l-j:
   mid=(i+k)//2;axis=(xs[mid],0,0,1);parts=[(mid,j,k,l),(i,j,mid,l)]
  else:
   mid=(j+l)//2;axis=(0,ys[mid],1,0);parts=[(i,j,k,mid),(i,mid,k,l)]
  ch=[bsp(*p) for p in parts]
  nodes.append(pack('hhhh',*axis)+b''.join(pack('hhhh',ys[d],ys[b],xs[a],xs[c]) for a,b,c,d in parts)+pack('HH',*ch))
  return len(nodes)-1
 bsp(0,0,nx,ny)
 for ln in lines:
  if ln[6]==65535:
   s=ln[5];sides[s]=sides[s][:20]+name('STONE2')+sides[s][28:]
 things=[(96,512,0,1),(360,665,0,30),(556,725,0,30),(711,350,0,31),(430,385,0,31),(660,626,0,46),(510,600,0,85),(750,563,0,86),(805,461,0,36),(811,650,0,32),(932,596,0,33),(932,425,0,33),(427,802,0,34),(1390,512,0,33),(1184,738,180,3004),(1260,310,180,3002),(1420,675,180,3001)]
 for x,y in [(204,350),(288,838),(862,872),(1090,230),(1320,850),(190,678)]:things.append((x,y,0,47))
 w,h=14,10;cnt=w*h;block=pack('hhhh',-128,-128,w,h)+pack('H',4+cnt)*cnt+pack('H',0)+b''.join(pack('H',i) for i in range(len(lines)))+pack('H',65535)
 return list(zip(['MAP01','THINGS','LINEDEFS','SIDEDEFS','VERTEXES','SEGS','SSECTORS','NODES','SECTORS','REJECT','BLOCKMAP'],[b'',b''.join(pack('hhhhh',*t,7) for t in things),b''.join(pack('HHHHHHH',*l) for l in lines),b''.join(sides),b''.join(pack('hh',*v) for v in verts),b''.join(segs),b''.join(subs),b''.join(nodes),b''.join(sectors),bytes((len(sectors)**2+7)//8),block]))
