import { Color3 } from '@babylonjs/core/Maths/math.color';
import { SmoothStep } from '@babylonjs/core/Maths/math.scalar.functions';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { createCurbSurface } from './axisRail.ts';

export const assets = import.meta.env.BASE_URL + 'assets/';

export function buildGarden(scene: Scene) {
  const w = 7;
  const h = 5;
  const railDepth = .32;
  const midX = (w - 1) / 2;
  const midZ = (h - 1) / 2;
  const lawnY = -.35;
  const bounds: Vector3[] = [];
  const shadowCasters: Mesh[] = [];
  const northCurb = h - .5 + railDepth;
  const eastCurb = w - .5 + railDepth;
  const grassGap = .65;
  const rearFlowerDepth = .37;
  const rearFlowerZ = northCurb + grassGap + (rearFlowerDepth + .12) / 2;
  const fenceBack = rearFlowerZ + (rearFlowerDepth + .12) / 2 + .45;
  const fenceFront = -.5 - railDepth - grassGap;
  const fenceRight = eastCurb + grassGap;
  const frontFlowerZ = fenceFront - .60;
  const batches = new Map<StandardMaterial, Mesh[]>();
  const materials = new Map<string, StandardMaterial>();
  const paint = (hex: string) => {
    let m = materials.get(hex);
    if (!m) {
      m = new StandardMaterial(hex, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.specularColor = new Color3(.07, .07, .07);
      materials.set(hex, m);
    }
    return m;
  };
  function place(mesh: Mesh, m: StandardMaterial, x: number, y: number, z: number, batch: boolean) {
    mesh.material = m;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    if (batch) {
      if (!batches.has(m)) batches.set(m, []);
      batches.get(m)!.push(mesh);
    }
    return mesh;
  }
  const box = (name: string, dimensions: [number, number, number], x: number, y: number, z: number, m: StandardMaterial, batch = true) =>
    place(CreateBox(name, { width: dimensions[0], height: dimensions[1], depth: dimensions[2] }, scene), m, x, y, z, batch);
  const orb = (name: string, dims: [number, number, number], x: number, y: number, z: number, m: StandardMaterial, batch = true) =>
    place(CreateSphere(name, { diameterX: dims[0], diameterY: dims[1], diameterZ: dims[2], segments: 8 }, scene), m, x, y, z, batch);
  const cylinder = (name: string, d: number, height: number, x: number, y: number, z: number, m: StandardMaterial, batch = true) =>
    place(CreateCylinder(name, { diameter: d, height, tessellation: 20 }, scene), m, x, y, z, batch);
  function register(x1: number, x2: number, y1: number, y2: number, z1: number, z2: number) {
    for (const x of [x1, x2]) for (const y of [y1, y2]) for (const z of [z1, z2]) bounds.push(new Vector3(x, y, z));
  }
  register(-.95, w - .05, -.35, 0, -1.37, h - .07);

  const ground = paint('#a6c48e');
  ground.specularColor = Color3.Black();
  const fenceWood = paint('#ead1a0');
  const fenceShade = paint('#b8885c');
  const darkMulch = paint('#775847');
  const clay = paint('#a16c52');
  const wood = paint('#c59470');
  const woodShade = paint('#99705a');
  const boards = paint('#daa67d');
  const grid = paint('#62a6ac');
  grid.emissiveColor = new Color3(.026, .11, .14);
  const gridEdge = paint('#67bbc4');
  gridEdge.emissiveColor = new Color3(.032, .15, .19);
  const railWood = paint('#65402e');
  const mint = paint('#62b6a5');
  const deepMint = paint('#426f65');
  const green = paint('#467052');
  const leaf = paint('#669456');
  const paleLeaf = paint('#7da96e');
  const glass = paint('#86d9d9');
  glass.alpha = .37;
  glass.specularColor = new Color3(.42,.55,.52);
  glass.specularPower = 70;
  const cream = paint('#f1dfb3');
  const coral = paint('#cd776d');
  const brick = paint('#a26555');
  const peach = paint('#dd9a82');
  const seedColor = paint('#e9ba66');
  const pink = paint('#ea6484');
  const yellow = paint('#f2c16b');
  const lilac = paint('#b489ca');
  const trim = paint('#f8e7b9');

  const meadowSize = 70;
  const meadow = CreateGround('Meadow', { width: meadowSize, height: meadowSize, subdivisions: 56 }, scene);
  const vertices = meadow.getVerticesData(VertexBuffer.PositionKind)!;
  const meadowColors = new Float32Array(vertices.length / 3 * 4);
  for (let i=0; i<vertices.length; i+=3) {
    const x=vertices[i], z=vertices[i+2];
    const light=.94+.036*Math.sin(.88*x+.37*z)+.025*Math.cos(.44*x-.65*z);
    meadowColors.set([light,light,.97*light,1],i / 3 * 4);
  }
  meadow.setVerticesData(VertexBuffer.ColorKind, meadowColors, true);
  meadow.hasVertexAlpha = true;
  meadow.alphaIndex = 0; // Blend before greenhouse glass and the other transparent details.
  place(meadow,ground,midX,lawnY,midZ,false).receiveShadows=true;

  function fadeMeadow(cameraUp: Vector3, center: Vector3, halfHeight: number) {
    const offset = Vector3.Dot(meadow.position, cameraUp) - Vector3.Dot(center, cameraUp);
    for (let i=0; i<vertices.length; i+=3) {
      const x=vertices[i], z=vertices[i+2];
      const height = (offset + x * cameraUp.x + z * cameraUp.z) / halfHeight;
      const edgeDistance = meadowSize / 2 - Math.max(Math.abs(x), Math.abs(z));
      const horizon = SmoothStep(1, 0, (height - .46) / .54);
      const edge = SmoothStep(0, 1, edgeDistance / 8);
      meadowColors[i / 3 * 4 + 3] = horizon * edge;
    }
    meadow.updateVerticesData(VertexBuffer.ColorKind, meadowColors);
  }

  box('Raised clay bed', [w+.14, .32, h+.14], midX, -.181, midZ, clay);
  box('Bed lower lip', [w+.23,.12,h+.23], midX, -.271, midZ, woodShade);
  const soil = new StandardMaterial('Baked soil', scene);
  soil.specularColor = Color3.Black();
  let loadSoil!: () => void;
  let failSoil!: (error: Error) => void;
  const soilReady = new Promise<void>((resolve, reject) => {
    loadSoil = resolve;
    failSoil = reject;
  });
  const texture = new Texture(assets + 'soil.png', scene, {
    onLoad: loadSoil,
    onError: () => failSoil(new Error('Garden soil could not load.')),
  });
  texture.uScale = w / 2.1;
  texture.vScale = h / 2.1;
  texture.anisotropicFilteringLevel = 16;
  soil.diffuseTexture = texture;
  const groundSurface = CreateGround('Soil', { width: w, height: h }, scene);
  place(groundSurface, soil, midX, 0, midZ, false).receiveShadows=true;
  const railOffset = -.5 - railDepth / 2;
  const railTop = .025;
  const sides = [
    { name:'South', length:w, x:midX, z:railOffset, rotation:0, axis:'x' },
    { name:'West', length:h, x:railOffset, z:midZ, rotation:Math.PI / 2, axis:h > 1 ? 'y' : undefined },
    { name:'North', length:w, x:midX, z:h - 1 - railOffset, rotation:Math.PI },
    { name:'East', length:h, x:w - 1 - railOffset, z:midZ, rotation:-Math.PI / 2 },
  ] as const;
  for (const side of sides) {
    const name = `${side.name} garden curb`;
    const surface = createCurbSurface(scene, name, side.length, railDepth, 'axis' in side ? side.axis : undefined);
    surface.position.set(side.x, railTop, side.z);
    surface.rotation.y = side.rotation;
    // Front and back support the corner joints. The side boards fit between them.
    const runsAlongX = side.rotation % Math.PI === 0;
    const dimensions: [number, number, number] = runsAlongX
      ? [side.length + railDepth * 2, .08, railDepth]
      : [railDepth, .08, side.length];
    box(`${name} support`, dimensions, side.x, railTop - .041, side.z, railWood);
  }
  for (let x=0; x<=w; x++) {
    const edge=x===0 || x===w;
    box('North-facing grid line', [edge ? .036 : .029,.009,h], x-.5,edge ? railTop : .009,midZ,edge ? gridEdge : grid);
  }
  for (let y=0; y<=h; y++) {
    const edge=y===0 || y===h;
    box('East-facing grid line', [w,.009,edge ? .036 : .029], midX,edge ? railTop : .009,y-.5,edge ? gridEdge : grid);
  }
  function flower(x: number, y: number, z: number, scale: number, color: StandardMaterial) {
    cylinder('Stem',.05*scale,.53*scale,x,y+.26*scale,z,green);
    orb('Leaf',[.25*scale,.08*scale,.12*scale],x+.10*scale,y+.24*scale,z,leaf).rotation.z=.42;
    orb('Leaf',[.25*scale,.076*scale,.12*scale],x-.09*scale,y+.31*scale,z,paleLeaf).rotation.z=-.48;
    for (let i=0;i<6;i++) {
      const angle=i*Math.PI/3;
      const petal=orb('Petal',[.20*scale,.113*scale,.13*scale],x+.123*scale*Math.cos(angle),y+.55*scale,z+.123*scale*Math.sin(angle),color);
      petal.rotation.y=-angle;
      petal.rotation.z=.30;
    }
    orb('Flower heart',[.19*scale,.13*scale,.19*scale],x,y+.57*scale,z,yellow);
  }
  const gx=.02, gz=fenceBack+1.76;
  const glassWidth=1.72, glassDepth=1.18, frameBase=-.24, eave=.58;
  box('Greenhouse plinth',[1.96,.12,1.34],gx,-.286,gz,trim);
  box('Greenhouse foundation',[1.82,.115,1.24],gx,-.174,gz,mint);
  for (const side of [-1,1]) {
    const z=gz+side*glassDepth/2;
    box('Greenhouse sill',[1.81,.065,.074],gx,frameBase+.08,z,mint);
    box('Greenhouse eave',[1.90,.053,.065],gx,eave,z,trim);
    if (side===1) box('Greenhouse back glass',[glassWidth,.74,.021],gx,.19,z,glass,false);
    if (side===-1) {
      for (const offset of [-.58,.58]) box('Greenhouse front glass',[.56,.74,.018],gx+offset,.19,z,glass,false);
    }
    for (const x of [gx-.86,gx-.28,gx+.28,gx+.86]) {
      box('Greenhouse frame post',[.063,.81,.063],x,.194,z,mint);
    }
  }
  for (const side of [-1,1]) {
    const x=gx+side*glassWidth/2;
    box('Greenhouse side glass',[.019,.74,glassDepth],x,.19,gz,glass,false);
    box('Greenhouse side mullion',[.065,.79,.047],x,.205,gz,mint);
    box('Greenhouse side sill',[.060,.06,glassDepth],x,-.147,gz,mint);
    box('Greenhouse seed bench',[.32,.093,.78],gx+side*.57,.075,gz,woodShade);
    for (const offset of [-.23,.15]) {
      cylinder('Greenhouse plant pot',.19,.14,gx+side*.57,.19,gz+offset,clay);
      flower(gx+side*.57,.248,gz+offset,.39,side===1 ? lilac : pink);
    }
    const slope=side*.44;
    const roof=box('Translucent pitched roof',[1.94,.029,.71],gx,.731,gz+side*.31,glass,false);
    roof.rotation.x=slope;
    for (const offset of [-.92,-.46,0,.46,.92]) {
      const rib=box('Greenhouse roof rib',[.044,.055,.73],gx+offset,.75,gz+side*.31,mint);
      rib.rotation.x=slope;
    }
  }
  box('Greenhouse ridge',[1.98,.061,.066],gx,.902,gz,trim);
  box('Greenhouse door',[.49,.75,.055],gx,.188,gz-.612,deepMint);
  box('Door glass',[.36,.43,.022],gx,.291,gz-.649,glass,false);
  orb('Brass handle',[.063,.063,.057],gx+.159,.091,gz-.666,seedColor);
  register(gx-1,gx+1,lawnY,.94,gz-.68,gz+.68);
  const cx = w-1.10, cz = fenceBack+1.86;
  box('Cottage walls',[1.43,.87,1.01],cx,.075,cz,cream);
  box('Stone foundation',[1.49,.15,1.06],cx,-.262,cz,woodShade);
  const gable = new Mesh('Cottage gable',scene);
  const roofBase=.45, peak=.847, half=.69;
  const positions = [-half,roofBase,-.506, 0,peak,-.506, half,roofBase,-.506,
                      -half,roofBase,.506, 0,peak,.506, half,roofBase,.506];
  const indices = [0,2,1, 3,4,5, 0,1,4, 0,4,3, 1,2,5, 1,5,4, 0,3,5, 0,5,2];
  const normals:number[]=[];
  VertexData.ComputeNormals(positions,indices,normals);
  const gableGeometry = new VertexData();
  gableGeometry.positions=positions; gableGeometry.indices=indices; gableGeometry.normals=normals;
  gableGeometry.applyToMesh(gable);
  place(gable,peach,cx,0,cz,true);
  const roofSpan=.91;
  for (const s of [-1,1]) {
    const roof=box('Coral roof',[roofSpan,.115,1.18],cx+s*.388,.655,cz,coral);
    roof.rotation.z=-s*.5;
    for (let j=0;j<6;j++) {
      const seam=box('Roof tile seams',[roofSpan,.018,.024],cx+s*.39,.72,cz-.53+j*.21,brick);
      seam.rotation.z=roof.rotation.z;
    }
  }
  box('Chimney',[.24,.40,.25],cx+.39,.78,cz+.22,brick);
  box('Chimney cap',[.31,.072,.31],cx+.39,1.01,cz+.22,coral);
  box('Blue door',[.38,.58,.068],cx+.27,.003,cz-.535,deepMint);
  box('Window frame',[.41,.35,.073],cx-.36,.185,cz-.538,woodShade);
  const windowLight=paint('#f7d78a');
  windowLight.emissiveColor=new Color3(.13,.077,.024);
  box('Cottage window panes',[.32,.26,.019],cx-.36,.185,cz-.582,windowLight);
  box('Cottage crossbar',[.34,.037,.029],cx-.36,.188,cz-.599,woodShade);
  box('Cottage mullion',[.036,.28,.029],cx-.36,.185,cz-.599,woodShade);
  box('Cottage exterior shutters',[.072,.37,.038],cx-.59,.185,cz-.584,deepMint);
  box('Cottage exterior shutters',[.072,.37,.038],cx-.13,.185,cz-.584,deepMint);
  box('Cottage doorstep',[.56,.11,.28],cx+.27,-.273,cz-.674,trim);
  orb('Cottage brass knob',[.067,.052,.045],cx+.37,.024,cz-.58,seedColor);
  box('Flower box',[.51,.10,.16],cx-.36,-.014,cz-.60,brick);
  for (const x of [-.52,-.36,-.20]) flower(cx+x,.035,cz-.62,.33,pink);
  register(cx-.9,cx+.9,-.38,1.05,cz-.62,cz+.63);
  let randomSeed=27361;
  const rand=()=> { randomSeed = (Math.imul(randomSeed,1664525)+1013904223)>>>0; return randomSeed/4294967296; };
  function picketFence(x1:number,z1:number,x2:number,z2:number,height:number) {
    const dx=x2-x1, dz=z2-z1, length=Math.hypot(dx,dz);
    const spacing=.27, count=Math.round(length/spacing);
    for (const fraction of [.31,.70]) {
      const rail=box('Picket rail',[length,.062,.063],(x1+x2)/2,lawnY+height*fraction,(z1+z2)/2,fenceShade);
      rail.rotation.y=-Math.atan2(dz,dx);
    }
    for (let i=0;i<=count;i++) {
      const end=i===0 || i===count;
      const t=i/count, x=x1+dx*t, z=z1+dz*t, top=height+(end ? .11 : 0);
      const width=end ? .13 : .083;
      box('Picket',[width,top,width*.85],x,lawnY+top/2,z,end ? fenceShade : fenceWood);
      const cap=box('Picket cap',[width*.72,width*.72,width*.79],x,lawnY+top,z,end ? fenceShade : fenceWood);
      cap.rotation.z=Math.PI/4;
    }
  }
  const left=-.87;
  picketFence(left,fenceBack,fenceRight,fenceBack,.57);
  if (h>1) picketFence(fenceRight,fenceBack,fenceRight,-.46,.43);
  const gateX=1;
  if (gateX-left>.95) picketFence(left,fenceFront,gateX-.59,fenceFront,.28);
  if (fenceRight-gateX>.95) picketFence(gateX+.59,fenceFront,fenceRight,fenceFront,.28);

  function flowerBed(x:number,z:number,width:number,depth:number,color:StandardMaterial) {
    if (width<.35) return;
    box('Flower bed timber frame',[width+.12,.13,depth+.12],x,lawnY+.052,z,wood);
    box('Flower bed mulch',[width,.118,depth],x,lawnY+.071,z,darkMulch);
    const cols=Math.max(1,Math.ceil(width/.33)), rows=Math.max(1,Math.ceil(depth/.35));
    for (let i=0;i<cols;i++) for (let j=0;j<rows;j++) {
      const fx=x+((i+.5)/cols-.5)*width+(rand()-.5)*.15;
      const fz=z+((j+.5)/rows-.5)*depth+(rand()-.5)*.16;
      flower(fx,lawnY+.13,fz,.40+rand()*.31,color);
    }
  }
  flowerBed(w*.19-.45,rearFlowerZ,w*.37,rearFlowerDepth,pink);
  flowerBed(w*.71-.45,rearFlowerZ,w*.48,rearFlowerDepth,yellow);
  if (h>2) flowerBed(fenceRight+.56,midZ,.48,h-.75,lilac);
  const leftFlowers=gateX-.78-left, rightFlowers=fenceRight-(gateX+.78);
  flowerBed(left+leftFlowers/2,frontFlowerZ,leftFlowers,.43,lilac);
  flowerBed(fenceRight-rightFlowers/2,frontFlowerZ,rightFlowers,.43,pink);

  for (let row=0;row<3;row++) {
    for (const side of [-1,1]) {
      const stone=box('Sandstone path paver',[.39,.081,.36],
        gateX+side*.221+(rand()-.5)*.08,lawnY+.035,fenceFront+.12-row*.418, row%2 ? boards : trim);
      stone.rotation.y=(rand()-.5)*.13;
    }
  }
  register(gateX-.51,gateX+.51,lawnY,-.23,fenceFront-.92,fenceFront+.32);

  const bark=paint('#92674f');
  function tree(x:number,z:number,size:number,bloom:boolean) {
    cylinder('Orchard tree trunk',.16*size,.94*size,x,lawnY+.47*size,z,bark);
    const crown=bloom ? paint('#dc91a7') : paint('#7fba76');
    const tips=bloom ? paint('#eda5b9') : paint('#95c581');
    const canopy = [
      { x:0, y:1.19, z:0, radii:[.58,.62,.50], material:crown },
      { x:-.31, y:1.21, z:.09, radii:[.43,.50,.42], material:tips },
      { x:.29, y:1.36, z:.13, radii:[.37,.46,.36], material:crown },
    ];
    for (const tuft of canopy) {
      const mesh = CreateIcoSphere('Orchard crown', {
        radiusX:tuft.radii[0]*size, radiusY:tuft.radii[1]*size, radiusZ:tuft.radii[2]*size,
        subdivisions:3,
      },scene);
      place(mesh,tuft.material,x+tuft.x*size,lawnY+tuft.y*size,z+tuft.z*size,true);
    }
  }
  tree(-1.43,fenceBack+.70,1.16,true);
  tree(w+.48,fenceBack+1.38,1.19,false);

  // Door-to-door stepping stones run behind the fence.
  const pathStone = ['#a5a098','#bcb1a0','#afa797'].map(paint);
  const pathStart = gx, pathEnd = cx+.27;
  const intervals = Math.ceil((pathEnd-pathStart)/.44);
  for (let i=0; i<=intervals; i++) {
    const t=i/intervals;
    const x=pathStart+(pathEnd-pathStart)*t;
    const z=fenceBack+.94+.13*Math.sin(Math.PI*t)+(rand()-.5)*.07;
    const stone = place(CreateCylinder('Stone footpath paver',{
      diameterTop:.33+rand()*.06, diameterBottom:.39+rand()*.06, height:.056, tessellation:6,
    },scene),pathStone[i%pathStone.length],x,lawnY+.025,z,true);
    stone.scaling.z=.88+rand()*.10;
    stone.rotation.y=rand()*Math.PI/3;
  }


  // Combine static scenery by material to keep the garden within a small draw budget.
  for (const meshes of batches.values()) {
    const merged = Mesh.MergeMeshes(meshes, true, true);
    if (!merged) continue;
    merged.isPickable = false;
    merged.receiveShadows = true;
    shadowCasters.push(merged);
  }

  return { bounds, shadowCasters, fadeMeadow, soilReady };
}
