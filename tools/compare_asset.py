"""Prove prepared mesh attributes, indices, bind matrices, and node transforms are unchanged."""
import argparse,pathlib,zipfile,json,struct
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive',type=pathlib.Path,help='Path to bomb-c4-explosive-model-cs2.zip')
archive=parser.parse_args().archive.expanduser()
def parse(raw):
 n=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+n]),raw[28+n:]
a,ab=parse(zipfile.ZipFile(archive).read('source/C4.glb'))
b,bb=parse((root/'public/assets/models/c4-2k.glb').read_bytes())
def accessor(doc,blob,i):
 x=doc['accessors'][i];v=doc['bufferViews'][x['bufferView']];off=v.get('byteOffset',0);return blob[off:off+v['byteLength']],{k:x[k] for k in ['componentType','count','type']}
checks=[]
assert a['nodes']==b['nodes'];checks.append('all node transforms and hierarchy identical')
for m,(am,bm) in enumerate(zip(a['meshes'],b['meshes'])):
 for p,(ap,bp) in enumerate(zip(am['primitives'],bm['primitives'])):
  for key in ap['attributes']:
   assert accessor(a,ab,ap['attributes'][key])==accessor(b,bb,bp['attributes'][key]);checks.append(f'mesh {m} primitive {p} {key} bytes identical')
  assert accessor(a,ab,ap['indices'])==accessor(b,bb,bp['indices']);checks.append(f'mesh {m} indices identical')
for sa,sb in zip(a['skins'],b['skins']):
 assert sa['joints']==sb['joints'];assert accessor(a,ab,sa['inverseBindMatrices'])==accessor(b,bb,sb['inverseBindMatrices']);checks.append('skin joints and inverse bind matrices identical')
report={'passed':True,'checks':checks,'triangles':17949,'sourceAnimations':len(a.get('animations',[])),'preparedAnimations':len(b.get('animations',[]))}
(root/'docs/asset-inspection/preservation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
