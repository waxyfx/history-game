"""Original indexed pixel art for the framing camp. No external imagery."""
from PIL import Image,ImageDraw
import random,math,struct
from functools import lru_cache
def camp_art(base,patch,color):
 col=lru_cache(None)(lambda s:color(*bytes.fromhex(s)))
 def pic(w,h):
  im=Image.new('RGBA',(w,h)); return im,ImageDraw.Draw(im)
 def encode(im,left=None,top=None):
  p=im.load()
  return patch(*im.size,lambda x,y:col('%02x%02x%02x'%p[x,y][:3]) if p[x,y][3] else None,im.width//2 if left is None else left,im.height if top is None else top)
 def person(role,f):
  im,d=pic(58,68); stride=[-3,0,3,0][f%4]; hit=4<=f<=6
  robe={'POSS':'#925131','SARG':'#405871','TROO':'#7b3a38','TLMP':'#387666','TLP2':'#97633b','COL5':'#647744'}[role]
  d.ellipse((13,61,46,66),fill='#514830')
  for x,step in [(24,stride),(34,-stride)]:
   d.line((x,40,x+step,54,x+step+1,62),fill='#453328',width=5);d.line((x+step-3,63,x+step+2,63),fill='#302623',width=4)
  d.polygon([(22,21),(33,21),(38,43),(33,48),(18,46)],fill=robe,outline='#45372c')
  d.line((25,23,32,39),fill='#c29a60',width=2);d.line((21,37,35,37),fill='#573b27',width=3)
  d.ellipse((23,10,33,23),fill='#c7905b');d.arc((23,10,33,23),0,100,fill='#654332',width=2)
  d.polygon([(20,15),(24,8),(29,5),(33,10),(35,15)],fill='#593d30');d.line((21,15,35,15),fill='#d2b88c',width=2)
  y=24 if hit else 34;d.line((22,25,17,33,24,y+1),fill=robe,width=4);d.line((34,25,39,y),fill=robe,width=4);d.ellipse((37,y-1,41,y+3),fill='#cf9964')
  if role=='POSS':d.arc((33,y-15,51,y+16),265,92,fill='#e4b873',width=2);d.line((41,y-15,35 if hit else 40,y,41,y+15),fill='#e8d8b8')
  if role in ('TROO','TLP2'): 
   end=(56,23) if hit else (44,3);d.line((14,49,*end),fill='#ae7943',width=3);d.polygon([end,(end[0]-2,end[1]+8),(end[0]-6,end[1]+6)],fill='#c3c4a8')
  if role=='SARG':d.line((38,y+3,54 if hit else 43,y-18),fill='#ced0ac',width=3);d.line((35,y,43,y+2),fill='#d19b48',width=2)
  if f>=8 and role in ('POSS','SARG','TROO'):im=im.resize((58,max(12,65-(f-7)*10))); 
  return encode(im)
 def prop(kind,f=0):
  im,d=pic(140,94)
  if kind=='yurt':
   d.ellipse((6,77,135,91),fill='#574d33');d.rounded_rectangle((12,41,126,82),8,fill='#d1b792',outline='#6b503b',width=2)
   d.polygon([(8,47),(30,31),(59,20),(62,15),(80,15),(84,21),(113,32),(131,47)],fill='#ead8b1',outline='#745d43')
   for x in [18,37,56,85,104,122]:d.line((70,20,x,45),fill='#bea681')
   for y in (47,69):d.rectangle((13,y,125,y+3),fill='#8c493a')
   for x in range(17,120,10):d.line((x,55,x+4,51,x+8,55,x+4,59,x,55),fill='#996342')
   d.rectangle((57,49,82,82),fill='#80543b');d.rectangle((61,51,78,82),fill='#342c25');d.polygon([(61,51),(78,51),(61,72)],fill='#b38a5b')
  elif kind=='tent':
   d.polygon([(10,84),(65,12),(131,83)],fill='#ae734c',outline='#634530');d.polygon([(65,12),(87,83),(53,83)],fill='#554132');d.line((2,88,65,11,137,87),fill='#d4ba88',width=2)
  elif kind=='cart':
   for x in (38,93):
    d.ellipse((x-15,52,x+15,82),outline='#453529',width=4)
    for a in range(0,360,45):d.line((x,67,x+13*math.cos(math.radians(a)),67+13*math.sin(math.radians(a))),fill='#745737',width=2)
   d.polygon([(16,37),(103,41),(99,58),(22,57)],fill='#9a6e42',outline='#463728');d.line((93,53,136,61),fill='#715132',width=4)
   for y in (44,50):d.line((20,y,100,y+2),fill='#65472e')
  elif kind=='flag':
   d.line((57,90,57,6),fill='#815733',width=4);d.polygon([(59,10),(98,14),(93,27),(97,35),(59,30)],fill='#27766e');d.line((70,21,77,16,84,22,76,26,70,21),fill='#ecc68b',width=2)
  elif kind=='fire':
   for x in range(45,91,7):d.ellipse((x,78+abs(67-x)//8,x+11,89),fill='#746952')
   d.polygon([(50,81),(54,65),(59,72),(65,50+f*3),(70,65),(77,57),(84,81)],fill='#db682c');d.polygon([(58,82),(68,65),(70,74),(76,68),(76,82)],fill='#ffd576')
  elif kind=='rock':d.polygon([(36,87),(45,69),(67,57),(88,64),(100,86)],fill='#827c66');d.polygon([(45,69),(67,57),(78,63),(61,72)],fill='#aaa38a')
  elif kind=='artifact':
   d.polygon([(57,88),(61,56),(72,48),(80,53),(83,88)],fill='#a29472',outline='#5b5344');d.line((68,58,74,66,68,72,76,79),fill='#edd193',width=2)
  box=im.getbbox(); im=im.crop(box);return encode(im)
 sprites={}
 props={'COL1':'yurt','COL2':'tent','COL3':'cart','COL4':'flag','SMIT':'rock','CAND':'artifact','TRED':'fire'}
 for n,b in base:
  k=n[:4]
  if k in props:sprites[n]=prop(props[k],ord(n[4])-65)
  elif k in ['POSS','SARG','TROO','TLMP','TLP2','COL5'] and len(n)>=6:sprites[n]=person(k,ord(n[4])-65)
  elif k in ['PISG','PUNG','PISF','BAL1','CLIP']:
   im,d=pic(130,110);f=ord(n[4])-65
   if k=='PISG':
    dy=f*4;pts=[(66,7+dy),(86,24+dy),(95,50+dy),(95,64+dy),(85,84+dy),(69,108)]
    d.line(pts,fill='#412c20',width=6);d.line(pts,fill='#c39455',width=3);d.line((66,7+dy,59-f*5,77,69,108),fill='#d7d2ac')
    d.line((41,109,90,45+dy),fill='#b68b52',width=3);d.polygon([(91,42+dy),(89,53+dy),(84,49+dy)],fill='#b7bbaa')
    d.polygon([(86,110),(79,86),(85,71),(95,65),(102,70),(95,85),(107,110)],fill='#825f42');d.line((85,77,94,70),fill='#d2a077',width=6)
   elif k=='PUNG':
    d.polygon([(76,85),(70,79),(94-f*20,12),(102-f*20,3),(99-f*20,23)],fill='#c5ccbb',outline='#56615c');d.line((63,78,86,86),fill='#c6a068',width=5);d.line((74,86,67,105),fill='#795436',width=6);d.line((69,94,84,110),fill='#b88a63',width=10)
   elif k in ['BAL1','CLIP']:
    im,d=pic(22,9);d.line((1,7,18,2),fill='#c69e62',width=2);d.polygon([(21,1),(16,1),(17,4)],fill='#dad4b5')
   sprites[n]=encode(im,-130,-91) if k in ['PISG','PUNG','PISF'] else encode(im)
 rng=random.Random(34)
 flats={}
 for k,pal in [('THGRASS',['77764a','818153','93905b','686e46']),('THPATH',['aa9467','a18b61','ad986f','938158'])]:
  arr=[col(rng.choice(pal)) for i in range(4096)];flats[k]=bytes(arr)
 im,d=pic(256,128)
 for y in range(128):
  t=min(1,y/97);d.line((0,y,255,y),fill=tuple(int(a+(b-a)*t) for a,b in zip((84,146,180),(244,215,163))))
 for i in range(12):
  x=rng.randrange(256);y=rng.randrange(39,64);d.ellipse((x,y,x+rng.randrange(9,30),y+2),fill='#e9dabc')
 for basey,amp,shade in [(92,20,'#a0a9aa'),(99,16,'#828e87'),(106,12,'#74806a'),(111,6,'#858760')]:
  pts=[(x,int(basey+amp*(.5*math.sin(x*math.pi/64)+.35*math.cos(x*math.pi/16)+.15*math.sin(x*math.pi/8)))) for x in range(256)]
  d.polygon(pts+[(255,127),(0,127)],fill=shade)
 return sprites,flats,encode(im,0,0)
