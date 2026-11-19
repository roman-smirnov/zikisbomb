import { ShadyDevicePalette } from './devicePalette.ts';
import { addGardenBench, createBenchTexture } from './gardenBench.ts';
import { visualPulse } from './visualPulse.ts';
import { SceneEffects } from './sceneEffects.ts';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import { EnvironmentTextureTools } from '@babylonjs/core/Misc/environmentTextureTools.js';
import { HDRFiltering } from '@babylonjs/core/Materials/Textures/Filtering/hdrFiltering.js';
import '@babylonjs/loaders/glTF';
import { GameController, formatTime, type Effect } from './game.ts';
import type { AudioEngine } from './audio.ts';
const assets = `${import.meta.env.BASE_URL}assets/`;
const C = (hex:string) => Color3.FromHexString(hex);
export class GameScene {
  readonly engine: Engine; readonly scene: Scene; readonly camera: FreeCamera; private instrumentation: SceneInstrumentation;
  private root: TransformNode; private lcd?: DynamicTexture; private lcdMat?: StandardMaterial; private panel?: Mesh;
  private sceneEffects: SceneEffects;
  private glow: GlowLayer; private shadows: ShadowGenerator; private pipeline: DefaultRenderingPipeline;
  private displayLight: PointLight; private led: Mesh; private ledMat: StandardMaterial; private keys = new Map<string,Mesh>(); private presses = new Map<string,number>();
  private lastDisplay = ''; private frame?: () => void; private lastKey=-Infinity;
  readonly quality = 'high';
  private basePosition = new Vector3(.6,2.65,-1.85); private target = new Vector3(.6,0,0);
  diagnostics: Record<string,unknown> = {};
  constructor(canvas: HTMLCanvasElement, private game: GameController, private audio: AudioEngine) {
    this.engine = new Engine(canvas,true,{stencil:true,preserveDrawingBuffer:true, powerPreference:'high-performance'});
    this.engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio,1.5)); this.scene = new Scene(this.engine); const scene = this.scene;
    this.instrumentation=new SceneInstrumentation(scene);this.instrumentation.captureFrameTime=true;
    scene.clearColor = new Color4(.70,.77,.51,1);
    this.camera = new FreeCamera('Fixed classroom camera',this.basePosition.clone(),scene); this.camera.fov = .61; this.camera.minZ=.02; this.camera.maxZ=20; this.camera.setTarget(this.target); this.camera.inputs.clear();
    const ip = scene.imageProcessingConfiguration; ip.toneMappingEnabled=true; ip.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure=1.62; ip.contrast=1.05;
    ip.vignetteEnabled=false;
    scene.environmentTexture = location.search.includes('bake-environment') ? CubeTexture.CreateFromImages(['px','py','pz','nx','ny','nz'].map(x=>`${assets}textures/studio-${x}.png`),scene) : CubeTexture.CreateFromPrefilteredData(`${assets}textures/studio.env`,scene);
    scene.environmentIntensity=.57;
    const key = new DirectionalLight('Garden afternoon sun', new Vector3(.5, -1, .35), scene);
    key.position = new Vector3(-1.3, 2, -1);
    key.diffuse = C('#ffd5a3');
    key.specular = C('#ecc59b');
    key.intensity = 2.85;
    key.autoCalcShadowZBounds = true;
    key.shadowMinZ = .1;
    key.shadowMaxZ = 6;

    const fill = new HemisphericLight('Afternoon sky fill', new Vector3(0, 1, 0), scene);
    fill.diffuse = C('#d7e8ff');
    fill.groundColor = C('#a4b99b');
    fill.intensity = .54;
    const rim = new PointLight('Soft garden bounce', new Vector3(.1, 1, 1), scene);
    rim.diffuse = C('#badbc6');
    rim.specular = C('#dbccae');
    rim.intensity = .50;
    rim.range = 3;
    this.displayLight = new PointLight('LCD spill',new Vector3(0,.25,.1),scene); this.displayLight.diffuse=C('#ff281d'); this.displayLight.intensity=0; this.displayLight.range=.46;
    this.displayLight.specular=Color3.Black();
    this.shadows = new ShadowGenerator(2048, key);
    this.shadows.useContactHardeningShadow = true;
    this.shadows.contactHardeningLightSizeUVRatio = .028;
    this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadows.bias = .0001;
    this.shadows.normalBias = .0009;
    this.shadows.setDarkness(.17);
    const wood = new PBRMaterial('Warm garden bench', scene);
    wood.albedoTexture = createBenchTexture(scene);
    wood.albedoColor = C('#dfc8af');
    wood.roughness = .88;
    wood.metallic = 0;
    addGardenBench(scene, wood);
    this.root = new TransformNode('BombRoot',scene);
    this.glow = new GlowLayer('LCD and key glow',scene,{mainTextureRatio:.5,blurKernelSize:32}); this.glow.intensity=.2;
    this.sceneEffects=new SceneEffects(scene,this.glow,game);this.sceneEffects.addSurface(wood);
    this.led=MeshBuilder.CreateSphere('StatusLED',{diameter:.012,segments:8},scene);this.led.position.set(.20,.455,.04);this.ledMat=new StandardMaterial('Device status indicator',scene);this.ledMat.disableLighting=true;this.led.material=this.ledMat;this.glow.addIncludedOnlyMesh(this.led);
    this.pipeline = new DefaultRenderingPipeline('One final image pipeline',true,scene,[this.camera]); this.pipeline.samples=1; this.pipeline.fxaaEnabled=true; this.pipeline.bloomEnabled=false;
    window.addEventListener('resize',this.resize); document.addEventListener('fullscreenchange',this.resize);
  }
  async load(progress:(text:string)=>void) {
    progress('DECODING DEVICE GEOMETRY');
    const container = await SceneLoader.LoadAssetContainerAsync(`${assets}models/`,'c4-2k.glb',this.scene);
    container.addAllToScene(); container.animationGroups.forEach(g=>g.dispose());
    for (const node of container.rootNodes) node.parent=this.root;
    for (const mesh of container.meshes) { mesh.computeWorldMatrix(true); if (mesh instanceof Mesh && mesh.getTotalVertices()) { mesh.refreshBoundingInfo({applySkeleton:true}); this.shadows.addShadowCaster(mesh); mesh.receiveShadows=true; } }
    // Preserve conversion root, skeleton and source quaternion. Normalize only our parent adapter.
    const body = container.meshes.find(m=>m.name.endsWith('body_hd')) as Mesh;
    const p = container.meshes.find(m=>m.name.endsWith('controlpanel0')) as Mesh;
    if(body?.material instanceof PBRMaterial) {
      body.material.metallicReflectanceColor = C('#ead3bb');
      body.material.environmentIntensity = .64;
      if (body.material.bumpTexture) body.material.bumpTexture.level *= .54;
      new ShadyDevicePalette(body.material);
    }
    if (!body || !p) throw new Error('Selected CS2 model is missing its body or LCD.');
    const bounds = body.getBoundingInfo().boundingBox; const size = bounds.maximumWorld.subtract(bounds.minimumWorld); const center = bounds.centerWorld.clone();
    this.diagnostics.sourceBounds={min:bounds.minimumWorld.asArray(),max:bounds.maximumWorld.asArray(),size:size.asArray()};
    const scale=1.48/Math.max(size.x,size.y,size.z); this.root.rotation.y=.10; this.root.scaling.setAll(scale); this.root.position=center.scale(-scale);
    this.root.computeWorldMatrix(true); body.computeWorldMatrix(true); body.refreshBoundingInfo({applySkeleton:true});
    this.root.position.y -= body.getBoundingInfo().boundingBox.minimumWorld.y; this.root.position.y+=.008;
    this.panel=p;
    for(const material of new Set(container.meshes.map(m=>m.material))) {
      if(material instanceof PBRMaterial)this.sceneEffects.addSurface(material);
    }
    // The supplied panel uses a small region of its test-grid UV atlas. Normalize its actual UV bounds.
    const uv=p.getVerticesData('uv'); if (uv) { const us=uv.filter((_,i)=>i%2===0), vs=uv.filter((_,i)=>i%2===1); const u0=Math.min(...us), v0=Math.min(...vs), du=Math.max(...us)-u0, dv=Math.max(...vs)-v0; this.diagnostics.uv={u0,v0,du,dv}; p.setVerticesData('uv',uv.map((v,i)=>i%2===0?(v-u0)/du:(v-v0)/dv)); }
    this.lcd=new DynamicTexture('Physical 512 x 128 countdown',{width:512,height:128},this.scene,false,Texture.BILINEAR_SAMPLINGMODE);
    this.lcdMat=new StandardMaterial('Self-lit live LCD',this.scene); this.lcdMat.disableLighting=true; this.lcdMat.emissiveTexture=this.lcd; this.lcdMat.diffuseColor=Color3.Black(); this.lcdMat.emissiveColor=Color3.Black(); this.lcdMat.backFaceCulling=false;
    const grid=p.material;p.material=this.lcdMat;grid?.dispose(false,true); this.glow.addIncludedOnlyMesh(p); this.glow.customEmissiveColorSelector=(mesh,_sub,_mat,color)=>{ if(mesh===p)color.set(1,1,1,1);else {const m=mesh.material as StandardMaterial; color.set(m.emissiveColor.r,m.emissiveColor.g,m.emissiveColor.b,m.alpha);} };
    this.addKeyAnchors(new Vector3(-.1104,.460,-.0775),new Vector3(.103,0,-.01246),new Vector3(-.00592,0,-.09255),new Vector3(0,1,0));
    progress('CALIBRATING LIVE DISPLAY');
    this.drawLCD(formatTime(this.game.config.duration),false);
    this.scene.render(); await this.scene.whenReadyAsync();
    for(let i=0;i<5;i++) this.scene.render();
    // Surface anchors are authored in the model's own post-skin coordinates after visual calibration.
    this.diagnostics.meshes=container.meshes.map(m=>({name:m.name,position:m.getAbsolutePosition().asArray(),bounds:m.getBoundingInfo().boundingBox.extendSizeWorld.asArray()}));
    this.diagnostics.triangles=container.meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0);
    this.diagnostics.engine=this.engine.webGLVersion; this.diagnostics.panelUV=p.getVerticesData('uv'); this.diagnostics.panelPositions=p.getPositionData(true,true); this.diagnostics.panelMatrix=p.getWorldMatrix().asArray(); this.diagnostics.lcdPixels=Array.from(this.lcd.getContext().getImageData(55,25,1,1).data);
  }
  /** Anchors use world coordinates from the retained rest pose; they never move the rig. */
  addKeyAnchors(origin:Vector3,across:Vector3,down:Vector3,normal:Vector3) {
    const layout=['1','2','3','4','5','6','7','8','9','Backspace','0','Enter'];
    const rotation=Quaternion.FromRotationMatrix(Matrix.FromXYZAxesToRef(across.normalizeToNew(),down.normalizeToNew(),normal.normalizeToNew(),Matrix.Identity()));
    layout.forEach((key,i)=> {
      const mesh=MeshBuilder.CreatePlane(`KeyCue-${key}`,{width:across.length()*.7,height:down.length()*.7,sideOrientation:Mesh.DOUBLESIDE},this.scene);
      mesh.position=origin.add(across.scale(i%3)).add(down.scale(Math.floor(i/3))).add(normal.scale(.002)); mesh.rotationQuaternion=rotation;
      const mat=new StandardMaterial(`Cue-${key}`,this.scene); mat.disableLighting=true; mat.emissiveColor=C('#9af3de'); mat.alpha=0; mesh.material=mat; mesh.isPickable=false;
      this.keys.set(key,mesh); this.glow.addIncludedOnlyMesh(mesh);
    });
  }
  effects(events:Effect[]) { this.sceneEffects.effects(events); for(const event of events) { if(event.type==='key' && event.key) {this.presses.set(event.key,this.game.time());this.lastKey=this.game.time();} if(event.type==='reset'){this.presses.clear();this.lastKey=-Infinity;this.lastDisplay='';} } }
  private drawLCD(text:string,green:boolean) {
    if(!this.lcd)return; const ctx=this.lcd.getContext(); ctx.fillStyle=green?'#081e10':'#280604'; ctx.fillRect(0,0,512,128);
    const segments:Record<string,number[]>={'0':[0,1,2,3,4,5],'1':[1,2],'2':[0,1,6,4,3],'3':[0,1,6,2,3],'4':[5,6,1,2],'5':[0,5,6,2,3],'6':[0,5,6,4,2,3],'7':[0,1,2],'8':[0,1,2,3,4,5,6],'9':[0,1,2,3,5,6]};
    const bars=[[12,5,48,8],[60,12,8,43],[60,64,8,43],[12,109,48,8],[4,64,8,43],[4,12,8,43],[12,57,48,8]];
    let x=40;
    for(const ch of text) {
      if(ch===':') {ctx.fillStyle=green?'#74ff99':'#ff5038';ctx.fillRect(x+5,37,9,9);ctx.fillRect(x+5,79,9,9);x+=32;continue;}
      bars.forEach(([bx,by,w,h],i)=>{ctx.fillStyle=segments[ch]?.includes(i)?green?'#74ff99':'#ff5038':green?'#0d2916':'#3b0b07';ctx.fillRect(x+bx,by,w,h);});x+=92;
    }
    this.lcd.update(false);
  }
  update() {
    this.sceneEffects.update();
    this.camera.position.copyFrom(this.basePosition).addInPlace(this.sceneEffects.cameraOffset);
    const s=this.game.state, now=this.game.time(); const green=s.phase==='success'; const text=formatTime(this.game.remaining); const signature=text+green;
    if(signature!==this.lastDisplay) {this.lastDisplay=signature;this.drawLCD(text,green);}
    this.displayLight.diffuse=green?C('#39f57d'):C('#ff281d');this.displayLight.intensity=green?.52:0;const pulse=Math.max(visualPulse(now,this.audio.lastBeep,100),visualPulse(now,this.lastKey,100));this.ledMat.emissiveColor=(green?C('#39f57d'):C('#ff281d')).scale(green?1:pulse);
    if(this.panel) {this.panel.computeWorldMatrix(true); this.panel.refreshBoundingInfo({applySkeleton:true}); this.displayLight.position=this.panel.getBoundingInfo().boundingBox.centerWorld.add(new Vector3(0,.07,0));}
    for(const [key,mesh] of this.keys) {(mesh.material as StandardMaterial).alpha=.5*visualPulse(now,this.presses.get(key)??-Infinity,130);}
    // LED envelope follows the scheduler's actual game timestamp.
    this.glow.intensity=green?.15:.18+visualPulse(now,this.audio.lastBeep,100)*.08;
  }
  start(frame:()=>void) { this.frame=frame; this.wake(); }
  wake(){if(this.frame)this.engine.runRenderLoop(this.frame);}
  sleep(){if(this.frame)this.engine.stopRenderLoop(this.frame);}
  resize=()=> {
    const ratio=innerWidth/innerHeight;
    this.camera.fov=ratio<1.3?.85:.61;
    this.engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio,1.5));
    this.engine.resize();
    // Static off-axis framing shifts the device left without scaling or moving its parts.
    // Ease out the offset on narrow projectors so the left edge stays in frame.
    const shift=.03*Math.max(0,Math.min(1,(ratio-1.4)/.3));
    this.camera.unfreezeProjectionMatrix();
    const projection=this.camera.getProjectionMatrix(true).clone();
    projection.addAtIndex(8,-2*shift);
    this.camera.freezeProjectionMatrix(projection);
    this.wake();
  };
  async bakeEnvironment(){const texture=this.scene.environmentTexture as CubeTexture;await new HDRFiltering(this.engine,{quality:64}).prefilter(texture);return EnvironmentTextureTools.CreateEnvTextureAsync(texture,{imageType:'image/png'});}
  stats() {return {...this.diagnostics,effects:this.sceneEffects.stats(),fps:this.engine.getFps(),drawCalls:this.instrumentation.drawCallsCounter.current,frameMs:this.instrumentation.frameTimeCounter.current,meshes:this.scene.meshes.length,textures:this.scene.textures.length,quality:this.quality,exposure:this.scene.imageProcessingConfiguration.exposure,renderScale:1/this.engine.getHardwareScalingLevel(),glowIntensity:this.glow.intensity,displayLightIntensity:this.displayLight.intensity,ledEmission:this.ledMat.emissiveColor.asArray(),lcdText:this.lastDisplay,keyCues:[...this.keys].filter(([,m])=>(m.material as StandardMaterial).alpha>0).map(([k])=>k)};}
  dispose(){if(this.frame)this.engine.stopRenderLoop(this.frame);window.removeEventListener('resize',this.resize);document.removeEventListener('fullscreenchange',this.resize);this.instrumentation.dispose();this.scene.dispose();this.engine.dispose();}
}
