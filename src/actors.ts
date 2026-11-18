import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

function paint(scene: Scene, name: string, hex: string, emissive = 0) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(hex);
  material.emissiveColor = material.diffuseColor.scale(emissive);
  material.specularColor = new Color3(.11, .11, .11);
  return material;
}

function box(parent: TransformNode, name: string, size: number[], at: number[], material: StandardMaterial) {
  const [width, height, depth] = size;
  const mesh = CreateBox(name, { width, height, depth }, parent.getScene());
  mesh.parent = parent;
  mesh.position.set(at[0], at[1], at[2]);
  mesh.material = material;
  return mesh;
}

function roundedCase(parent: TransformNode, name: string, width: number, height: number, depth: number, bevel: number, material: StandardMaterial) {
  const shape = [
    [-width / 2 + bevel, -height / 2], [width / 2 - bevel, -height / 2],
    [width / 2, -height / 2 + bevel], [width / 2, height / 2 - bevel],
    [width / 2 - bevel, height / 2], [-width / 2 + bevel, height / 2],
    [-width / 2, height / 2 - bevel], [-width / 2, -height / 2 + bevel],
  ];
  const positions = [-depth / 2, depth / 2].flatMap(z => shape.flatMap(([x, y]) => [x, y, z]));
  const indices: number[] = [];
  const count = shape.length;
  for (let i = 1; i < count - 1; i++) indices.push(0, i, i + 1, count, count + i + 1, count + i);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    indices.push(i, i + count, j, j, i + count, j + count);
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  const mesh = new Mesh(name, parent.getScene());
  data.applyToMesh(mesh);
  mesh.convertToFlatShadedMesh();
  mesh.parent = parent;
  mesh.material = material;
  return mesh;
}

export function buildDial(scene: Scene) {
  const base = new TransformNode('Countdown module', scene);
  base.position.set(3.33, .27, 1.02);
  base.rotation.y = .33;
  const body = paint(scene, 'Module teal enamel', '#45676e');
  const rim = paint(scene, 'Module graphite trim', '#283c41');
  const cream = paint(scene, 'Module brass accent', '#dca965');
  const light = paint(scene, 'Module status lamp', '#ffb651', .55);
  roundedCase(base, 'Module case', 1.42, .48, .86, .11, body);
  roundedCase(base, 'Module display frame', 1.26, .35, .048, .064, rim).position.set(0, .015, -.44);
  box(base, 'Raised amber inlay', [.59, .015, .035], [0, .244, -.12], cream);
  for (const x of [-.55, .55]) {
    box(base, 'Module rubber foot', [.14, .12, .64], [x, -.207, 0], rim);
    box(base, 'Module corner trim', [.055, .13, .65], [x > 0 ? .68 : -.68, .05, .015], cream);
  }
  const status = CreateCylinder('Module status lamp', { diameter: .12, height: .045, tessellation: 12 }, scene);
  status.parent = base;
  status.position.set(.43, .247, -.11);
  status.material = light;

  const panel = CreatePlane('Countdown display', { width: 1.08, height: .263 }, scene);
  panel.parent = base;
  panel.position.set(0, .015, -.469);
  const texture = new DynamicTexture('Digit face', { width: 512, height: 128 }, scene, true);
  const screen = new StandardMaterial('Matte amber display', scene);
  screen.diffuseTexture = texture;
  screen.emissiveTexture = texture;
  screen.emissiveColor = Color3.White();
  screen.disableLighting = true;
  panel.material = screen;

  let previous = '';
  return {
    meshes: base.getChildMeshes().filter(mesh => mesh !== panel),
    show(text: string, low: boolean) {
      const signature = text + low;
      if (signature === previous) return;
      previous = signature;
      status.setEnabled(Boolean(text));
      light.diffuseColor = Color3.FromHexString(low ? '#ff9a52' : '#ffbf64');
      light.emissiveColor = light.diffuseColor.scale(.55);
      const ctx = texture.getContext();
      ctx.fillStyle = '#212929';
      ctx.fillRect(0, 0, 512, 128);
      if (text) {
        ctx.font = 'bold 96px monospace';
        ctx.fillStyle = low ? '#ffc08a' : '#ffdc98';
        ctx.fillText(text, (512 - ctx.measureText(text).width) / 2, 98);
      }
      texture.update();
    },
  };
}

export function buildShady(scene: Scene) {
  const model = new TransformNode('Shady', scene);
  model.position.set(3.12, 1.30, 7.06);
  model.rotation.set(.08, .35, -.05);
  model.scaling.setAll(.85);
  const olive = paint(scene, 'Shady weathered olive', '#606747');
  const under = paint(scene, 'Shady wing slate', '#404e4d');
  const gold = paint(scene, 'Shady ochre tabs', '#b3924e');
  const black = paint(scene, 'Shady face glass', '#202e29');

  roundedCase(model, 'Shady fuselage', .74, .50, 1.72, .14, olive);
  roundedCase(model, 'Shady nose trim', .68, .45, .07, .09, under).position.z = -.88;
  roundedCase(model, 'Shady visor', .53, .36, .025, .06, black).position.z = -.928;
  for (const side of [-1, 1]) {
    const wing = new Mesh('Shady swept wing', scene);
    const contour = [[.23, -.38], [1.36, .44], [1.48, .78], [.78, .79], [.27, .61]];
    const positions = contour.flatMap(([x, z]) => [side * x, x * .13 - .14, z]);
    const front = [0, 1, 2, 0, 2, 3, 0, 3, 4];
    const indices = front.concat(front.slice().reverse());
    const normals: number[] = [];
    // The paint is double-sided because the wings are thin sheets.
    const data = new VertexData();
    const vertices = positions.concat(positions);
    const separated = indices.map((index, i) => i < front.length ? index : index + contour.length);
    VertexData.ComputeNormals(vertices, separated, normals);
    data.positions = vertices;
    data.indices = separated;
    data.normals = normals;
    data.applyToMesh(wing);
    wing.parent = model;
    wing.material = side === 1 ? olive : under;
    box(model, 'Shady wing tip', [.048, .21, .32], [side * 1.39, .103, .61], under).rotation.z = -.26 * side;
    box(model, 'Shady wing paint', [.21, .026, .061], [side * 1.05, .012, .59], gold).rotation.y = -.23 * side;
  }
  box(model, 'Shady rear fin', [.075, .32, .45], [0, .29, .68], under).rotation.x = .34;
  box(model, 'Shady antenna', [.027, .23, .027], [0, .31, .19], under).rotation.z = -.26;

  const pixels = [
    '  ##   ##  ',
    '   ## ##   ',
    '    # #    ',
    '           ',
    '    ###    ',
    '   #   #   ',
  ];
  const ember = paint(scene, 'Shady ember pixels', '#ff784c', 1);
  ember.diffuseColor = Color3.Black();
  ember.disableLighting = true;
  for (const [row, line] of pixels.entries()) {
    for (const [column, pixel] of Array.from(line).entries()) {
      if (pixel === '#') box(model, 'Shady visor pixel', [.035, .034, .007], [(column - 5) * .039, (.09 - row * .033), -.947], ember);
    }
  }
  return model;
}
