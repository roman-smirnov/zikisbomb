import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';

export function createCurbSurface(scene: Scene, name: string, tiles: number, depth: number, axis?: 'x' | 'y') {
  const innerHalf = tiles / 2;
  const outerHalf = innerHalf + depth;
  // Miter the top surface where the four pieces meet. The UVs keep the
  // numbers aligned with the tile centers all the way to the corners.
  const corner = depth / (2 * outerHalf);
  const vertices = new VertexData();
  vertices.positions = [
    -innerHalf, 0, depth / 2, innerHalf, 0, depth / 2,
    -outerHalf, 0, -depth / 2, outerHalf, 0, -depth / 2,
  ];
  vertices.normals = [0,1,0, 0,1,0, 0,1,0, 0,1,0];
  vertices.uvs = [corner,1, 1-corner,1, 0,0, 1,0];
  vertices.indices = [3,1,0, 2,3,0];
  const mesh = new Mesh(name, scene);
  vertices.applyToMesh(mesh);
  mesh.material = railMaterial(scene, name, tiles, depth, axis);
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  return mesh;
}

function railMaterial(scene: Scene, name: string, tiles: number, depth: number, axis?: 'x' | 'y') {
  const tileWidth = 160;
  const endAllowance = depth * tileWidth;
  const width = Math.round(tiles * tileWidth + 2 * endAllowance);
  const height = Math.round(depth * tileWidth);
  const texture = new DynamicTexture(name, { width, height }, scene, true);
  texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 16;

  const ctx = texture.getContext();
  const wood = ctx.createLinearGradient(0, 0, 0, height);
  wood.addColorStop(0, '#57392c');
  wood.addColorStop(.10, '#6b4835');
  wood.addColorStop(.72, '#75513a');
  wood.addColorStop(.96, '#694633');
  wood.addColorStop(1, '#583a2a');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, width, height);

  for (let y = 4, i = 0; y < height - 3; y += 4, i++) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 12; x <= width; x += 12) {
      ctx.lineTo(x, y + 1.5 * Math.sin(x / 68 + i * 1.8) + .6 * Math.sin(x / 24 - i));
    }
    ctx.strokeStyle = i % 3 === 0 ? '#f3b27c1a' : '#33191025';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = '#e2aa7a4d';
  ctx.fillRect(0, height - 4, width, 1.25);
  if (axis) {
    ctx.font = 'bold 43px "Trebuchet MS", Arial, sans-serif';
    for (let tile = 0; tile < tiles; tile++) {
      const slot = axis === 'y' ? tiles - 1 - tile : tile;
      const center = endAllowance + (slot + .5) * tileWidth;
      const numeral = String(tile);
      const metrics = ctx.measureText(numeral);
      const ascent = metrics.actualBoundingBoxAscent || 30;
      const descent = metrics.actualBoundingBoxDescent || 0;

      // The short inlay points from the coordinate toward its tile center.
      ctx.fillStyle = '#deb180';
      ctx.fillRect(center - 1.25, 0, 2.5, 5);

      ctx.save();
      ctx.translate(center, height * .55);
      // Let the west digits face the same direction as the ones along the dock side.
      if (axis === 'y') ctx.rotate(-Math.PI / 2);
      const x = -metrics.width / 2;
      const baseline = (ascent - descent) / 2;
      const inlay = ctx.createLinearGradient(0, -ascent / 2, 0, ascent / 2);
      inlay.addColorStop(0, tile === 0 ? '#ffe7b9' : '#f9dcb0');
      inlay.addColorStop(1, '#deb07a');

      ctx.fillStyle = '#382018';
      ctx.fillText(numeral, x, baseline + 1);
      ctx.shadowColor = '#f1a55b75';
      ctx.shadowBlur = 3;
      ctx.fillStyle = inlay;
      ctx.fillText(numeral, x, baseline);
      ctx.restore();
    }
  }
  texture.update();

  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.emissiveColor = new Color3(.12, .09, .06);
  material.specularColor = Color3.Black();
  return material;
}
