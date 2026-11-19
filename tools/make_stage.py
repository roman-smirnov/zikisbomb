"""Generate the original deterministic studio reflection maps; no external images."""
import math, struct, zlib, pathlib
root=pathlib.Path(__file__).resolve().parents[1]/'public/assets/textures'
def png(name,w,h,pixels):
 def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
 raw=b''.join(b'\0'+bytes(pixels[y*w*3:(y+1)*w*3]) for y in range(h))
 (root/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
for face in ['px','py','pz','nx','ny','nz']:
 p=[]; size=128
 for y in range(size):
  for x in range(size):
   u=x/size; v=y/size
   light=math.exp(-((u-.3)/.24)**8-((v-.35)/.4)**8)*(.65 if face=='py' else .3 if face in ['px','pz'] else .06)
   p.extend([int(15+light*170),int(20+light*190),int(26+light*210)])
 png('studio-'+face+'.png',size,size,p)
