import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { SpotLight } from '@babylonjs/core/Lights/spotLight.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import type { GameController, Effect } from './game.ts';
import { visualEffects } from './visualEffects.ts';

type Visual = ReturnType<typeof visualEffects>;

export class SceneEffects {
  private motion=matchMedia('(prefers-reduced-motion: reduce)');
  private deniedAt=-Infinity;
  private visual:Visual=visualEffects('ready',60000,0,0,-Infinity);
  private warnings:{light:SpotLight;side:number}[]=[];
  private feedbackLight:PointLight;
  readonly cameraOffset=Vector3.Zero();
  constructor(scene:Scene, _glow:GlowLayer, private game:GameController) {
    // A broad room light illuminates the model and surrounding tabletop together.
    this.feedbackLight=new PointLight('Answer feedback room flash',new Vector3(0,1.15,-.1),scene);
    this.feedbackLight.diffuse=Color3.FromHexString('#ff2014');
    this.feedbackLight.specular=Color3.FromHexString('#3a0804');
    this.feedbackLight.range=3.5;this.feedbackLight.intensity=0;
    // Virtual sources keep the warning light in the room without adding visible props.
    for(const side of [-1,1]) {
      const light=new SpotLight(`Sweeping warning light ${side}`,new Vector3(side*1.25,.85,.4),new Vector3(-side,-.65,-.4).normalize(),1.55,2,scene);
      light.range=4;light.intensity=0;light.specular=Color3.FromHexString('#3a1010');
      this.warnings.push({light,side});
    }
  }
  addSurface(material:PBRMaterial){material.maxSimultaneousLights=7;}
  effects(events:Effect[]){
    for(const event of events){
      if(event.type==='denied'||(event.type==='failure'&&event.key==='penalty'))this.deniedAt=this.game.time();
      if(event.type==='reset'||event.type==='success')this.deniedAt=-Infinity;
    }
  }
  update(){
    const s=this.game.state,now=this.game.time();
    const fx=this.visual=visualEffects(s.phase,this.game.remaining,now,s.entered,this.deniedAt,this.motion.matches);
    const red=Color3.FromHexString('#ff2418'),amber=Color3.FromHexString('#ff9d25');
    const color=Color3.Lerp(amber,red,fx.critical);
    for(const {light,side} of this.warnings){
      light.diffuse=color;
      light.intensity=fx.warning*(3.6*(1-fx.critical)+fx.critical*6*fx.pulse);
      light.direction=new Vector3(-light.position.x,-.65,-light.position.z+fx.sweep*.6*side).normalize();
    }
    const defused=s.phase==='success';
    this.feedbackLight.diffuse=Color3.FromHexString(defused?'#27ff70':'#ff2014');
    this.feedbackLight.specular=Color3.FromHexString(defused?'#083a13':'#3a0804');
    this.feedbackLight.intensity=5*Math.max(fx.rejectionFlash,fx.defusalFlash);
    const age=now-this.deniedAt;
    if(fx.jolt)this.cameraOffset.set(Math.sin(age*.062)*.006*fx.jolt,Math.sin(age*.081)*.003*fx.jolt,0);
    else this.cameraOffset.setAll(0);
  }
  stats(){return {...this.visual,rejectionLightIntensity:5*this.visual.rejectionFlash,defusalLightIntensity:5*this.visual.defusalFlash,reducedMotion:this.motion.matches,warningIntensities:this.warnings.map(b=>b.light.intensity),
    directions:this.warnings.map(b=>b.light.direction.asArray()),cameraOffset:this.cameraOffset.asArray()};}
}
