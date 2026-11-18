import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { MorphTarget } from '@babylonjs/core/Morph/morphTarget';
import { buildDial, buildShady } from './actors.ts';
import { assets, buildGarden } from './garden.ts';
import type { Phase } from './game.ts';

type Graphics = 'loading' | 'ready' | 'fallback';
type SceneView = Readonly<{ phase: Phase; paused: boolean; low: boolean; time: string; reduced: boolean }>;
const direction = new Vector3(-.40, .94, -1.39).normalize();
const right = Vector3.Cross(direction, Vector3.Up()).normalize();
const up = Vector3.Cross(right, direction).normalize();

export class GardenScene {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private garden: ReturnType<typeof buildGarden>;
  private dial: ReturnType<typeof buildDial>;
  private drone: TransformNode;
  private shadows: ShadowGenerator;
  private observer: ResizeObserver;
  private abort = new AbortController();
  private view: SceneView = { phase: 'ready', paused: false, low: false, time: '01:00', reduced: false };
  private disposed = false;
  private loaded = false;
  private painted = false;
  private lost = false;
  private elapsed = 0;
  private reactionAge = 0;
  private rotors: TransformNode[] = [];
  private eyes: { mesh: AbstractMesh; height: number }[] = [];
  private brows: AbstractMesh[] = [];
  private frown?: MorphTarget;

  constructor(private canvas: HTMLCanvasElement, private focus: HTMLElement, private graphics: (status: Graphics) => void) {
    if (!Engine.IsSupported) throw new Error('WebGL is unavailable.');
    this.engine = new Engine(canvas, true, { alpha: true, stencil: false, premultipliedAlpha: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0, 0, 0, 0);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = Color3.FromHexString('#f7e5c8');
    this.scene.fogDensity = .006;
    this.camera = new FreeCamera('Garden camera', Vector3.Zero(), this.scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = .15;
    this.camera.maxZ = 100;

    const sky = new HemisphericLight('Sky fill', new Vector3(.12, 1, -.32), this.scene);
    sky.diffuse = Color3.FromHexString('#d7e8ff');
    sky.groundColor = Color3.FromHexString('#a4b99b');
    sky.intensity = .68;
    const sun = new DirectionalLight('Afternoon sun', new Vector3(.49, -1, .45).normalize(), this.scene);
    sun.diffuse = Color3.FromHexString('#ffe6bf');
    sun.intensity = .83;
    sun.position = new Vector3(3, 0, 3).subtract(sun.direction.scale(16));
    sun.shadowFrustumSize = 19;
    sun.shadowMinZ = 7;
    sun.shadowMaxZ = 26;
    this.shadows = new ShadowGenerator(1024, sun);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.bias = .0014;
    this.shadows.normalBias = .024;
    this.shadows.darkness = .25;

    this.garden = buildGarden(this.scene);
    this.dial = buildDial(this.scene);
    const shady = buildShady(this.scene);
    for (const mesh of [...this.garden.shadowCasters, ...this.dial.meshes, ...shady.getChildMeshes()]) {
      this.shadows.addShadowCaster(mesh, false);
    }
    this.drone = new TransformNode('Ziki reaction pivot', this.scene);
    this.drone.position.set(1.52, .86, 1.72);
    this.drone.rotation.y = Math.PI + .22;
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.observer.observe(focus);
    this.engine.onContextLostObservable.add(() => {
      this.lost = true;
      this.painted = false;
      this.graphics('fallback');
      this.manageLoop();
    });
    this.engine.onContextRestoredObservable.add(() => {
      this.lost = false;
      this.resize();
      this.manageLoop();
    });
    document.addEventListener('visibilitychange', this.manageLoop);
    this.resize();
  }

  async load() {
    const [response] = await Promise.all([
      fetch(assets + 'ziki.glb', { signal: this.abort.signal }),
      this.garden.soilReady,
    ]);
    if (!response.ok) throw new Error('Ziki could not load.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (this.disposed) return;
    const container = await LoadAssetContainerAsync(bytes, this.scene, { pluginExtension: '.glb', name: 'ziki.glb' });
    if (this.disposed) {
      container.dispose();
      return;
    }
    container.addAllToScene();
    for (const root of container.rootNodes) root.parent = this.drone;
    this.rotors = container.transformNodes.filter(node => /^Rotor_\d$/.test(node.name));
    this.eyes = container.meshes.filter(mesh => mesh.name.startsWith('Mint eye'))
      .map(mesh => ({ mesh, height: mesh.scaling.y }));
    this.brows = container.meshes.filter(mesh => mesh.name.startsWith('Sad brow'));
    for (const mesh of container.meshes) {
      if (mesh.name === 'Visor mouth' && mesh instanceof Mesh) this.frown = mesh.morphTargetManager?.getTargetByName('Frown') ?? undefined;
      if (this.brows.includes(mesh)) mesh.setEnabled(false);
      else if (mesh.getTotalVertices() > 0) {
        mesh.receiveShadows = true;
        this.shadows.addShadowCaster(mesh, false);
      }
    }
    this.loaded = true;
    this.manageLoop();
  }

  update(view: SceneView) {
    if (this.view.phase !== view.phase) this.reactionAge = 0;
    this.view = view;
  }

  private resize = () => {
    if (this.disposed || this.lost) return;
    this.engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, 1.75));
    this.engine.resize();
    const canvas = this.canvas.getBoundingClientRect();
    const focus = this.focus.getBoundingClientRect();
    if (focus.width < 1 || focus.height < 1 || canvas.width < 1 || canvas.height < 1) return;

    // Frame the garden in the open area while the full-width canvas extends behind the controls.
    const corners = this.garden.bounds.concat(new Vector3(1.75, 1.64, 7.15), new Vector3(4.45, 1.63, 7.25));
    const xs = corners.map(point => Vector3.Dot(point, right));
    const ys = corners.map(point => Vector3.Dot(point, up));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const size = Math.max((maxX - minX + .65) / focus.width, (maxY - minY + .48) / focus.height);
    const offsetX = canvas.width / 2 - (focus.left - canvas.left + focus.width / 2);
    const offsetY = focus.top - canvas.top + focus.height / 2 - canvas.height / 2;
    const center = right.scale((minX + maxX) / 2 + size * offsetX).add(up.scale((minY + maxY) / 2 + size * offsetY));
    this.camera.position.copyFrom(center.add(direction.scale(37)));
    this.camera.setTarget(center);
    this.camera.orthoLeft = -canvas.width * size / 2;
    this.camera.orthoRight = canvas.width * size / 2;
    this.camera.orthoTop = canvas.height * size / 2;
    this.camera.orthoBottom = -this.camera.orthoTop;
    this.garden.fadeMeadow(up, center, this.camera.orthoTop);
  };

  private manageLoop = () => {
    if (this.disposed || this.lost || document.hidden || !this.loaded) {
      this.engine.stopRenderLoop(this.render);
    } else {
      this.engine.runRenderLoop(this.render);
    }
  };

  private render = () => {
    const view = this.view;
    const dt = Math.min(.05, this.engine.getDeltaTime() / 1000);
    if (!view.paused && !view.reduced) {
      this.elapsed += dt;
      this.reactionAge += dt;
      for (const [index, rotor] of this.rotors.entries()) {
        rotor.rotationQuaternion = null;
        rotor.rotation.y += dt * (index % 2 ? -7 : 7);
      }
    }
    const relieved = view.phase === 'success';
    const concerned = view.phase === 'expired';
    const bob = view.reduced ? 0 : .037 * Math.sin(this.elapsed * 4);
    const lift = relieved && !view.reduced ? Math.max(0, Math.sin(Math.min(Math.PI, this.reactionAge * 3.5))) * .17 : 0;
    this.drone.position.y = .86 + bob + lift - (concerned ? .11 : 0);
    this.drone.rotation.z = concerned && !view.reduced ? -.09 : 0;
    for (const { mesh, height } of this.eyes) mesh.scaling.y = height * (concerned ? .65 : relieved ? 1.18 : 1);
    for (const brow of this.brows) brow.setEnabled(concerned);
    if (this.frown) this.frown.influence = Number(concerned);
    this.dial.show(relieved || concerned || view.phase === 'ready' ? '' : view.time, view.low);
    this.scene.render();
    if (!this.painted && this.scene.isReady()) {
      this.painted = true;
      this.graphics('ready');
    }
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.manageLoop);
    this.engine.dispose();
  }
}
