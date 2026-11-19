"""Prepare the selected archive without modifying its rig, transforms or source.
Requires ImageMagick (magick). Geometry/bind matrices are copied byte for byte.
"""
import argparse, json, struct, zipfile, subprocess, tempfile, pathlib, hashlib
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive',type=pathlib.Path,help='Path to bomb-c4-explosive-model-cs2.zip')
archive=parser.parse_args().archive.expanduser()
raw=zipfile.ZipFile(archive).read('source/C4.glb')
size=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+size]); data=raw[28+size:]
with tempfile.TemporaryDirectory() as temp:
 for i,img in enumerate(doc['images']):
  view=doc['bufferViews'][img['bufferView']]; off=view.get('byteOffset',0)
  src=pathlib.Path(temp)/f'{i}.png'; dst=pathlib.Path(temp)/f'{i}-2k.png'
  src.write_bytes(data[off:off+view['byteLength']])
  # Source normal map RGB is meaningful even though its alpha is entirely zero.
  # Disable alpha BEFORE resizing data maps; associated-alpha filtering would erase it.
  args=['magick',str(src)]+(['-alpha','off'] if i<3 else [])+['-resize','2048x2048>','-depth','8','-strip','-define','png:compression-level=9',str(dst)]
  subprocess.run(args,check=True)
  # Rebuild all referenced bufferViews below, dropping superseded image / animation buffers.
  img['_bytes']=dst.read_bytes()
doc.pop('animations',None)
# Drop animation-only accessors and remap only real mesh/skin references.
used=set()
for mesh in doc['meshes']:
 for primitive in mesh['primitives']:
  used.update(primitive['attributes'].values())
  if 'indices' in primitive:used.add(primitive['indices'])
  for target in primitive.get('targets',[]):used.update(target.values())
for skin in doc.get('skins',[]):
 if 'inverseBindMatrices' in skin:used.add(skin['inverseBindMatrices'])
accessor_map={old:new for new,old in enumerate(sorted(used))}
doc['accessors']=[doc['accessors'][old] for old in sorted(used)]
for mesh in doc['meshes']:
 for primitive in mesh['primitives']:
  primitive['attributes']={k:accessor_map[v] for k,v in primitive['attributes'].items()}
  if 'indices' in primitive:primitive['indices']=accessor_map[primitive['indices']]
  for target in primitive.get('targets',[]):
   for k,v in target.items():target[k]=accessor_map[v]
for skin in doc.get('skins',[]):
 if 'inverseBindMatrices' in skin:skin['inverseBindMatrices']=accessor_map[skin['inverseBindMatrices']]
# Only retain referenced bufferViews and new images, compacting old payloads.
keep={a[k] for a in doc['accessors'] for k in ['bufferView'] if k in a}
newbuf=bytearray(); views=[]; mapping={}
for i,v in enumerate(doc['bufferViews']):
 if i not in keep: continue
 while len(newbuf)%4:newbuf.append(0)
 mapping[i]=len(views); copy=dict(v); copy['byteOffset']=len(newbuf)
 views.append(copy); off=v.get('byteOffset',0); newbuf+=data[off:off+v['byteLength']]
for a in doc['accessors']:
 if 'bufferView' in a:a['bufferView']=mapping[a['bufferView']]
for img in doc['images']:
 while len(newbuf)%4:newbuf.append(0)
 b=img.pop('_bytes'); img['bufferView']=len(views)
 views.append({'buffer':0,'byteOffset':len(newbuf),'byteLength':len(b)}); newbuf+=b
while len(newbuf)%4:newbuf.append(0)
doc['bufferViews']=views; doc['buffers']=[{'byteLength':len(newbuf)}]
encoded=json.dumps(doc,separators=(',',':')).encode()
encoded+=b' '*((-len(encoded))%4)
out=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(newbuf))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(newbuf),0x004e4942)+newbuf
path=root/'public/assets/models/c4-2k.glb'; path.write_bytes(out)
report={'sourceSHA256':hashlib.sha256(raw).hexdigest(),'preparedSHA256':hashlib.sha256(out).hexdigest(),'sourceBytes':len(raw),'preparedBytes':len(out),'geometry':'unchanged','skinAndTransforms':'unchanged','animations':0,'textureLimit':2048,'textures':[{'name':im.get('name',str(i)),'width':struct.unpack_from('>I',newbuf,views[im['bufferView']]['byteOffset']+16)[0],'height':struct.unpack_from('>I',newbuf,views[im['bufferView']]['byteOffset']+20)[0]} for i,im in enumerate(doc['images'])]}
(root/'docs/asset-inspection/prepared.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
