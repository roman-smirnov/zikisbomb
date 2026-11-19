import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import type { Material } from '@babylonjs/core/Materials/material.js';
import type { Scene } from '@babylonjs/core/scene.js';

export function createBenchTexture(scene: Scene) {
  const size = 1024;
  const texture = new DynamicTexture('Garden bench planks', size, scene, true);
  const ctx = texture.getContext();
  const boards = ['#b38f72', '#af8b6c', '#b59070', '#b18c70', '#b38d6d', '#b69477', '#b29073'];
  const width = size / boards.length;
  ctx.fillStyle = '#937252';
  ctx.fillRect(0, 0, size, size);

  for (const [index, color] of boards.entries()) {
    const left = index * width;
    const surface = ctx.createLinearGradient(left, 0, left + width, 0);
    surface.addColorStop(0, '#a38364');
    surface.addColorStop(.065, '#bd9a7a');
    surface.addColorStop(.20, color);
    surface.addColorStop(.87, color);
    surface.addColorStop(1, '#ac896b');
    ctx.fillStyle = surface;
    ctx.fillRect(left + .7, 0, width - 1.4, size);

    const glaze = ctx.createLinearGradient(left, size * (index % 2), left + width, size * (1 - index % 2));
    glaze.addColorStop(0, '#fff0cf15');
    glaze.addColorStop(.46, '#fff0cf00');
    glaze.addColorStop(1, '#77563c16');
    ctx.fillStyle = glaze;
    ctx.fillRect(left + .7, 0, width - 1.4, size);

    for (let i = 1; i < 16; i++) {
      const x = left + (i + .21 * Math.sin(index * 2.9 + i * 1.7)) * width / 17;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 16; y <= size; y += 16) {
        ctx.lineTo(x + 2.1 * Math.sin(y / 136 + i * .73 + index) + .4 * Math.sin(y / 29 + i), y);
      }
      ctx.strokeStyle = i % 3 === 0 ? '#fff2d422' : '#5e442b12';
      ctx.lineWidth = i % 5 === 0 ? 1.5 : .9;
      ctx.stroke();
    }
  }
  texture.anisotropicFilteringLevel = 8;
  texture.update();
  return texture;
}

const bench = { x: .6, z: .23, width: 3.44, depth: 2.66, deckY: -.005 };
type RimEdge = { inset: number; y: number };

function outline({ inset, y }: RimEdge) {
  const x = bench.width / 2 - inset;
  const z = bench.depth / 2 - inset;
  const corner = Math.max(.018, .102 - inset * .6);
  return [
    [-x + corner, y, -z], [x - corner, y, -z], [x, y, -z + corner], [x, y, z - corner],
    [x - corner, y, z], [-x + corner, y, z], [-x, y, z - corner], [-x, y, -z + corner],
  ];
}

function addRimBand(scene: Scene, name: string, material: Material, from: RimEdge, to: RimEdge) {
  const outer = outline(from);
  const inner = outline(to);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let side = 0; side < outer.length; side++) {
    const next = (side + 1) % outer.length;
    const start = positions.length / 3;
    positions.push(...outer[side], ...outer[next], ...inner[next], ...inner[side]);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;

  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.position.set(bench.x, 0, bench.z);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
}

function addLawn(scene: Scene) {
  const width = 16;
  const depth = 14;
  const size = 512;
  const texture = new DynamicTexture('Soft moss lawn and bench shadow', size, scene, true);
  const ctx = texture.getContext();
  const pixels = new ImageData(size, size);
  for (let row = 0; row < size; row++) {
    const z = (.5 - (row + .5) / size) * depth;
    for (let column = 0; column < size; column++) {
      const x = ((column + .5) / size - .5) * width;
      // The long, low-frequency tones follow the meadow treatment in Ziki's Garden.
      const variation = .98 + .06 * Math.sin(1.62 * x + .7 * z) + .036 * Math.cos(.69 * x - 1.44 * z)
        + .017 * Math.sin(4.25 * x + .9 * z) * Math.sin(3.3 * z - x);
      const gapX = Math.max(0, Math.abs(x - .045) - bench.width / 2);
      const gapZ = Math.max(0, Math.abs(z - .025) - bench.depth / 2);
      const shade = Math.max(0, 1 - Math.hypot(gapX, gapZ) / .31);
      const light = variation * (1 - .28 * shade * shade);
      const offset = (row * size + column) * 4;
      pixels.data[offset] = 170 * light;
      pixels.data[offset + 1] = 196 * light;
      pixels.data[offset + 2] = 134 * light;
      pixels.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  texture.update();

  const grass = new StandardMaterial('Moss lawn', scene);
  grass.disableLighting = true;
  grass.diffuseColor = Color3.Black();
  grass.specularColor = Color3.Black();
  grass.emissiveColor = Color3.Black();
  grass.emissiveTexture = texture;
  const ground = MeshBuilder.CreateGround('Lawn below the bench', { width, height: depth }, scene);
  ground.position.set(bench.x, -.17, bench.z);
  ground.material = grass;
  ground.isPickable = false;
}

function addLeafShadow(scene: Scene) {
  const mask = new DynamicTexture('Stationary leaf shadow mask', 256, scene, true);
  const ctx = mask.getContext() as CanvasRenderingContext2D;
  ctx.shadowColor = 'rgba(255, 255, 255, .8)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(255, 255, 255, .35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(17, 30);
  ctx.quadraticCurveTo(73, 57, 121, 92);
  ctx.quadraticCurveTo(157, 112, 190, 156);
  ctx.stroke();

  const leaves = [
    { x: 55, y: 57, length: 30, width: 14, angle: 2.16 },
    { x: 68, y: 80, length: 37, width: 14, angle: 1.45 },
    { x: 104, y: 57, length: 43, width: 15, angle: -.65 },
    { x: 127, y: 115, length: 41, width: 16, angle: 1.17 },
    { x: 153, y: 95, length: 42, width: 15, angle: -.44 },
    { x: 196, y: 151, length: 34, width: 13, angle: .41 },
  ];
  ctx.fillStyle = 'rgba(255, 255, 255, .72)';
  for (const leaf of leaves) {
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.angle);
    ctx.beginPath();
    ctx.moveTo(-leaf.length, 0);
    ctx.quadraticCurveTo(-leaf.length * .2, -leaf.width * 1.75, leaf.length, 0);
    ctx.quadraticCurveTo(leaf.length * .13, leaf.width * 1.75, -leaf.length, 0);
    ctx.fill();
    ctx.restore();
  }
  mask.hasAlpha = true;
  mask.update();

  const shade = new StandardMaterial('Soft foliage shade', scene);
  shade.disableLighting = true;
  shade.diffuseColor = Color3.Black();
  shade.specularColor = Color3.Black();
  shade.emissiveColor = Color3.FromHexString('#4b4934').toLinearSpace();
  shade.opacityTexture = mask;
  shade.alpha = .16;

  const patch = MeshBuilder.CreateGround('Stationary leaf shadow', { width: .89, height: .58 }, scene);
  patch.position.set(-.52, bench.deckY + .001, 1.09);
  patch.material = shade;
  patch.isPickable = false;
}

export function addGardenBench(scene: Scene, playingSurface: Material) {
  const deckInset = .126;
  const deck = MeshBuilder.CreateBox('Wooden potting bench', {
    width: bench.width - 2 * deckInset, height: .08, depth: bench.depth - 2 * deckInset,
  }, scene);
  deck.position.set(bench.x, bench.deckY - .04, bench.z);
  deck.material = playingSurface;
  deck.isPickable = false;
  deck.receiveShadows = true;

  function matte(name: string, color: string) {
    const material = new PBRMaterial(name, scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace();
    material.roughness = .92;
    material.metallic = 0;
    return material;
  }
  const side = matte('Bench dark end grain', '#795946');
  const bevel = matte('Bench sunlit bevel', '#b48e70');
  const trim = matte('Bench timber rim', '#a58265');
  const groove = matte('Bench inlay groove', '#82705b');
  const inlay = matte('Garden cyan inlay', '#74aaa9');

  // Cross section of the timber rim, from the lawn up and inward to the planks.
  const profile = [
    { inset: 0, y: -.165 },
    { inset: 0, y: -.046, finish: side },
    { inset: .042, y: .012, finish: bevel },
    { inset: .063, y: .012, finish: trim },
    { inset: .068, y: .008, finish: groove },
    { inset: .078, y: .008, finish: inlay },
    { inset: .083, y: .012, finish: groove },
    { inset: .115, y: .012, finish: trim },
    { inset: .130, y: bench.deckY, finish: trim },
  ];
  for (const [index, edge] of profile.entries()) {
    if (edge.finish) addRimBand(scene, edge.finish.name, edge.finish, profile[index - 1], edge);
  }

  addLawn(scene);
  addLeafShadow(scene);
}
