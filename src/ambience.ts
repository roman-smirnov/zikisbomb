import type {Voice} from './soundPalette.ts';

/** Longer than intro + the full round + failure. No source loops or tonal oscillators. */
export function makeAmbientNoise(ctx:BaseAudioContext,seed=(Math.random()*0xffffffff)>>>0,durationSeconds=110){
 const rate=24000,buffer=ctx.createBuffer(2,rate*durationSeconds,rate);
 for(let channel=0;channel<2;channel++){
  const data=buffer.getChannelData(channel);
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
 }
 return buffer;
}
export const electricalTexture=(remaining:number)=>1+.25*Math.max(0,Math.min(1,(15000-remaining)/15000));
/** Leave space for the unchanged recorded beep, a short detail, and both guard gaps. */
export const detailFitsGap=(now:number,lastBeep:number,nextBeep:number,beepDuration:number)=>now-lastBeep>beepDuration+100&&nextBeep-now>260;
export type Ambience={voices:Voice[];update:(at:number,remaining:number,announcementEnd:number)=>void;duckLevel:number;texture:number};

export function createAmbience(ctx:BaseAudioContext,out:AudioNode,noise:AudioBuffer,at:number,seed=(Math.random()*0xffffffff)>>>0):Ambience{
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const bus=ctx.createGain(),electrical=ctx.createGain(),voices:Voice[]=[];
 bus.connect(out);electrical.connect(bus);let live=3;
 // Irregular smooth changes rather than a periodic LFO or a repeated waveform.
 const wander=(param:AudioParam,base:number,depth:number,minStep:number,maxStep:number)=>{
  param.setValueAtTime(base,at);let t=at;
  while(t<at+noise.duration){t+=minStep+random()*(maxStep-minStep);param.linearRampToValueAtTime(base*(1+depth*(random()*2-1)),t);}
 };
 const layer=(offset:number,hzLow:number,hzHigh:number,level:number,pan?:number,band?:number)=>{
  const source=ctx.createBufferSource(),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter(),drift=ctx.createGain(),gain=ctx.createGain();
  source.buffer=noise;high.type='highpass';high.frequency.value=hzLow;low.type='lowpass';low.frequency.value=hzHigh;
  high.Q.value=low.Q.value=.55;
  if(pan!==undefined){high.channelCount=1;high.channelCountMode='explicit';}
  source.connect(high);high.connect(low);let tail:AudioNode=low;
  const extras:AudioNode[]=[high,low,drift];
  if(band){const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=band;filter.Q.value=.8;tail.connect(filter);tail=filter;extras.push(filter);}
  tail.connect(drift);drift.connect(gain);
  wander(drift.gain,1,pan===undefined?.045:.22,pan===undefined?4:.3,pan===undefined?9:2.7);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+1.1);
  if(pan!==undefined){const panner=ctx.createStereoPanner();panner.pan.value=pan;gain.connect(panner);panner.connect(electrical);extras.push(panner);}else gain.connect(bus);
  const voice={source,gain,end:at+noise.duration-offset,category:'ambient'};
  source.onended=()=>{source.disconnect();gain.disconnect();extras.forEach(n=>n.disconnect());if(--live===0){bus.disconnect();electrical.disconnect();}};
  source.start(at,offset);source.stop(voice.end);voices.push(voice);
 };
 layer(random()*2,85,1250,.023); // Spacious, soft stereo ventilation.
 layer(2+random()*2,55,480,.019,-.45,155); // Diffuse low electrical presence, toward the bomb.
 layer(5+random()*2,350,1850,.006,-.45,870); // Quiet, uneven grain rather than a tiring pure tone.
 let previousDuck=-1,previousTexture=-1;
 const bed:Ambience={voices,duckLevel:1,texture:1,update(time,remaining,announcementEnd){
  const duck=time<announcementEnd+.1?.18:1,texture=electricalTexture(remaining);
  if(duck!==previousDuck){if(previousDuck<0)bus.gain.setValueAtTime(duck,time);else bus.gain.setTargetAtTime(duck,time,duck<previousDuck?.04:.35);previousDuck=duck;}
  if(texture!==previousTexture){electrical.gain.setTargetAtTime(texture,time,.8);previousTexture=texture;}
  bed.duckLevel=duck;bed.texture=texture;
 }};
 return bed;
}

/** Tiny local relay contact or a brief irregular electrical flutter, below foreground cues. */
export function deviceDetail(ctx:BaseAudioContext,out:AudioNode,noise:AudioBuffer,at:number,flutter:boolean):Voice[]{
 const voices:Voice[]=[];
 const contact=(offset:number,duration:number,level:number,hz:number)=>{
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),pan=ctx.createStereoPanner();
  source.buffer=noise;filter.type='bandpass';filter.frequency.value=hz;filter.Q.value=.7;pan.pan.value=-.45;
  source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(out);
  const start=at+offset;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+.0015);gain.gain.exponentialRampToValueAtTime(.00001,start+duration);gain.gain.setValueAtTime(0,start+duration+.001);
  const voice={source,gain,end:start+duration+.002,category:'device-detail'};
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();};source.start(start,.2+offset);source.stop(voice.end);voices.push(voice);
 };
 if(flutter){[0,.023,.061].forEach((d,i)=>contact(d,.025,.014-i*.002,1050+i*170));}
 else{contact(0,.018,.035,1650);contact(.026,.012,.012,950);}
 return voices;
}
