import { GameController, type Effect } from './game.ts';
import { createAmbience, makeAmbientNoise, deviceDetail, detailFitsGap, type Ambience } from './ambience.ts';
import { deviceCue, makeNoise, countdownInterval, recordedCue, type Voice, type Cue } from './soundPalette.ts';
const audioAssets = `${import.meta.env.BASE_URL}assets/audio/`;

/** One context, bounded scheduler, and a post-compressor gate that cuts every round voice. */
export class AudioEngine {
  context: AudioContext | null = null; private master?: GainNode; private gate?: GainNode; private mix?: GainNode;
  private voices = new Set<Voice>(); private timer?: number; private nextTick = 0; private lastPhase = ''; private run = -1;
  private failureAnchor = -1; private failureCutoff = -1; private ambient?: Ambience; private ambientNoise?:AudioBuffer; private announcementEnd=-1; private nextDetail=0; private detailCount=0; private ambientStarts=0; private lastDetail=-Infinity; private detailHistory:{at:number;sinceBeep:number;untilBeep:number}[]=[]; private analyser?: AnalyserNode; private noiseBuffer?:AudioBuffer; private startupBuffer?:AudioBuffer; private beepBuffer?:AudioBuffer; private successBuffer?:AudioBuffer; private successPlays=0; volume = .35; muted = false;
  lastBeep = -Infinity; ticks = 0; onInterruption = () => {};
  constructor(private game: GameController) {}
  async unlock() {
    if (!this.context) {
      const ctx = this.context = new AudioContext();this.noiseBuffer=makeNoise(ctx);this.ambientNoise=makeAmbientNoise(ctx,undefined,this.game.config.duration/1000+20); this.master = ctx.createGain(); this.gate = ctx.createGain(); this.mix = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -12; compressor.ratio.value = 3;
      this.mix.connect(compressor); compressor.connect(this.gate); this.gate.connect(this.master); this.analyser=ctx.createAnalyser();this.analyser.fftSize=2048;this.master.connect(this.analyser);this.analyser.connect(ctx.destination);
      this.master.gain.value = this.muted ? 0 : this.volume;
      ctx.onstatechange = () => { if (ctx.state !== 'running' && ctx.state !== 'closed') this.onInterruption(); };
      this.timer = window.setInterval(() => this.schedule(),25);
    }
    await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Audio is unavailable. Retry or continue muted.');
    if (!this.startupBuffer) {
      const response = await fetch(`${audioAssets}protocol-start.mp3`);
      if (!response.ok) throw new Error('Starting sound could not load. Retry or continue muted.');
      this.startupBuffer = await this.context.decodeAudioData(await response.arrayBuffer());
    }
    if (!this.beepBuffer) {
      const response=await fetch(`${audioAssets}csgo-c4-beep.wav`);
      if(!response.ok)throw new Error('CS:GO beep could not load. Retry or continue muted.');
      this.beepBuffer=await this.context.decodeAudioData(await response.arrayBuffer());
    }
    if (!this.successBuffer) {
      const response=await fetch(`${audioAssets}csgo-bomb-defused.wav`).catch(()=>null);
      if(!response?.ok)throw new Error('CS:GO defuse announcement could not load. Retry or continue muted.');
      this.successBuffer=await this.context.decodeAudioData(await response.arrayBuffer());
    }
  }
  setVolume(value: number) { this.volume = value; this.applyVolume(); }
  toggleMute() { this.muted = !this.muted; this.applyVolume(); }
  private applyVolume() { if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume,this.context.currentTime,.015); }
  private cue(kind:Cue,at:number,key=''){
    if(!this.context||!this.mix||!this.noiseBuffer)return;
    const voices=deviceCue(this.context,this.mix,this.noiseBuffer,kind,at,key);
    for(const voice of voices){const cleanup=voice.source.onended;voice.source.onended=e=>{cleanup?.call(voice.source,e);this.voices.delete(voice);};this.voices.add(voice);}
    return voices[0];
  }
  private beep(at:number){
    if(!this.context||!this.mix||!this.beepBuffer)return;
    const voice=recordedCue(this.context,this.mix,this.beepBuffer,at,.22,'tick');
    const cleanup=voice.source.onended;voice.source.onended=e=>{cleanup?.call(voice.source,e);this.voices.delete(voice);};this.voices.add(voice);
  }
  private track(voices:Voice[]) {
    for(const voice of voices){const cleanup=voice.source.onended;voice.source.onended=e=>{cleanup?.call(voice.source,e);this.voices.delete(voice);};this.voices.add(voice);}
  }
  private cancel(category?: string, keepAmbience=false) {
    const at = this.context?.currentTime ?? 0;
    for (const v of this.voices) if ((!category || v.category === category) && !(keepAmbience && v.category==='ambient')) { v.gain.gain.cancelScheduledValues(at); v.gain.gain.setTargetAtTime(0,at,.002); try { v.source.stop(at+.008); } catch {} }
    if (!category && !keepAmbience) this.ambient = undefined;
  }
  effects(effects: Effect[]) {
    if (!this.context || !this.gate) return;
    const at = this.context.currentTime;
    for (const event of effects) {
      if (event.runId !== this.game.state.runId) continue;
      if(event.type==='reset'){this.lastBeep=-Infinity;this.announcementEnd=-1;this.nextDetail=7000+Math.random()*6000;this.detailCount=0;this.lastDetail=-Infinity;this.detailHistory=[];this.successPlays=0;}
      if (event.type === 'reset' || event.type === 'pause') { this.cancel(); this.gate.gain.cancelScheduledValues(at); this.gate.gain.setValueAtTime(0,at); this.failureAnchor = -1; this.lastPhase = ''; this.nextTick = this.game.time(); }
      if (event.type === 'resume') { this.lastPhase = ''; this.nextTick = this.game.time(); }
      if (event.type === 'key') { this.cue('key',at,event.key); }
      if (event.type === 'denied') { this.cancel('tick'); this.nextTick = this.game.time()+280; this.cue('denied',at); }
      if (event.type === 'success') {
        this.cancel();this.gate.gain.cancelScheduledValues(at);this.gate.gain.setValueAtTime(1,at);
        if(this.successBuffer&&this.mix){
          const voice=recordedCue(this.context,this.mix,this.successBuffer,at,.32,'success');
          this.track([voice]);this.successPlays++;
          // Let the entire recording clear the compressor's lookahead before closing the gate.
          this.gate.gain.setValueAtTime(0,voice.end+.04);
        }else this.gate.gain.setValueAtTime(0,at);
      }
      if (event.type === 'failure') { this.cancel(undefined,true); if(event.key==='penalty')this.cue('key',at,'Backspace'); }
    }
    this.schedule();
  }
  private schedule() {
    const ctx = this.context; if (!ctx || !this.gate || ctx.state !== 'running') return;
    const s = this.game.sample(); const now = this.game.time(); const at = ctx.currentTime;
    if (s.paused || ['ready','missionFailed','educationalReveal'].includes(s.phase)) return;
    if (this.run !== s.runId) { this.run = s.runId; this.nextTick = now; this.lastPhase = ''; }
    if (this.lastPhase !== s.phase) {
      if (s.phase === 'intro' && this.startupBuffer && this.mix) {
        const offset = Math.max(0,(now-s.entered)/1000);
        if (offset < this.startupBuffer.duration) {
          const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.startupBuffer;let peak=0;for(let channel=0;channel<this.startupBuffer.numberOfChannels;channel++)for(const value of this.startupBuffer.getChannelData(channel))peak=Math.max(peak,Math.abs(value));gain.gain.value=.32/Math.max(.01,peak);
          source.connect(gain);gain.connect(this.mix);
          const voice={source,gain,end:at+this.startupBuffer.duration-offset,category:'startup'};
          this.announcementEnd=voice.end;this.voices.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};source.start(at,offset);
        }
      }
      if (s.phase !== 'success') { this.gate.gain.cancelScheduledValues(at); this.gate.gain.setValueAtTime(1,at); }
      if (s.phase === 'failureTransition') { this.failureAnchor = now; this.failureCutoff = at + Math.max(0,(2800-(now-s.entered))/1000); this.gate.gain.setValueAtTime(0,this.failureCutoff); this.nextTick = now; }
      this.lastPhase = s.phase;
    }
    const failing = s.phase === 'failureTransition';
    // Keep the existing bed through failure, and never recreate it after the silent cutoff.
    if (failing && (now-s.entered >= 2800 || this.failureAnchor < 0)) { this.cancel(); return; }
    if (!this.ambient && this.ambientNoise && this.mix && ['intro','playing','incorrectFeedback','failureTransition'].includes(s.phase)) {
      this.ambient=createAmbience(ctx,this.mix,this.ambientNoise,at);this.track(this.ambient.voices);this.ambientStarts++;
    }
    this.ambient?.update(at,this.game.remaining,this.announcementEnd);
    if (!['playing','incorrectFeedback','failureTransition'].includes(s.phase)) return;
    const rem = this.game.remaining; const interval = failing ? 200-100*Math.min(1,(now-s.entered)/2800) : countdownInterval(rem,this.game.config.duration);
    if (this.nextTick < now-100) this.nextTick = now;
    if (this.nextTick <= now+100) {
      const target = at + Math.max(0,(this.nextTick-now)/1000);
      if ((!failing && this.nextTick < s.deadline!) || (failing && target+.03 < this.failureCutoff)) {
        this.beep(target); this.lastBeep = this.nextTick; this.ticks++;
      }
      this.nextTick += interval;
    }
    if(s.phase==='playing'&&now>=this.nextDetail&&at>this.announcementEnd+.4&&this.mix&&this.noiseBuffer&&this.beepBuffer&&detailFitsGap(now,this.lastBeep,this.nextTick,this.beepBuffer.duration*1000)){
      this.track(deviceDetail(ctx,this.mix,this.noiseBuffer,at,Math.random()<.4));this.detailCount++;this.lastDetail=now;this.detailHistory.push({at:now,sinceBeep:now-this.lastBeep,untilBeep:this.nextTick-now});if(this.detailHistory.length>16)this.detailHistory.shift();
      this.nextDetail=now+8000+Math.random()*7000;
    }
  }
  diagnostics() { const samples=new Float32Array(2048);this.analyser?.getFloatTimeDomainData(samples);const peak=samples.reduce((p,v)=>Math.max(p,Math.abs(v)),0);return { peak, context:this.context?.state ?? 'uninitialized', voices:this.voices.size, ticks:this.ticks, gate:this.gate?.gain.value ?? 0, cutoff:this.failureCutoff,success:{duration:this.successBuffer?.duration??0,plays:this.successPlays,active:[...this.voices].some(v=>v.category==='success')}, ambience:{layers:[...this.voices].filter(v=>v.category==='ambient').length,starts:this.ambientStarts,duck:this.ambient?.duckLevel??0,texture:this.ambient?.texture??1,details:this.detailCount,history:this.detailHistory,lastDetail:this.lastDetail,lastBeep:this.lastBeep,nextBeep:this.nextTick} }; }
  dispose() { clearInterval(this.timer); this.cancel(); void this.context?.close(); }
}

/** Render the actual shared palette with deliberately excessive cue overlap at full master gain. */
export async function auditAudio(){
 const ctx=new OfflineAudioContext(1,48000*4,48000),mix=ctx.createGain(),compressor=ctx.createDynamicsCompressor(),gate=ctx.createGain();
 compressor.threshold.value=-12;compressor.ratio.value=3;mix.connect(compressor);compressor.connect(gate);gate.connect(ctx.destination);gate.gain.setValueAtTime(0,2.8);
 const noise=makeNoise(ctx),bed=createAmbience(ctx,mix,makeAmbientNoise(ctx,710),0,710);bed.update(0,0,-1);deviceDetail(ctx,mix,noise,.15,false);deviceDetail(ctx,mix,noise,1.6,true);
 const beep=await ctx.decodeAudioData(await (await fetch(`${audioAssets}csgo-c4-beep.wav`)).arrayBuffer());
 let t=0;while(t<2.75){recordedCue(ctx,mix,beep,t,.22,'tick');t+=.2-.1*Math.min(1,t/2.8);}
 for(const t of [0,.7,1.4,2.1])for(const cue of ['denied','key'] as const)deviceCue(ctx,mix,noise,cue,t,'Enter');
 const defused=await ctx.decodeAudioData(await (await fetch(`${audioAssets}csgo-bomb-defused.wav`)).arrayBuffer());
 recordedCue(ctx,mix,defused,2.1,.32,'success');
 const startup=await ctx.decodeAudioData(await (await fetch(`${audioAssets}protocol-start.mp3`)).arrayBuffer());
 let recordedPeak=0;for(let c=0;c<startup.numberOfChannels;c++)for(const v of startup.getChannelData(c))recordedPeak=Math.max(recordedPeak,Math.abs(v));
 const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=startup;gain.gain.value=.32/Math.max(.01,recordedPeak);source.connect(gain);gain.connect(mix);source.start();
 const result=await ctx.startRendering(),samples=result.getChannelData(0);let peak=0,silencePeak=0;for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));if(i>=48000*2.805)silencePeak=Math.max(silencePeak,Math.abs(samples[i]));}
 return {peak,peakDb:20*Math.log10(peak),silencePeak,sampleRate:result.sampleRate,cutoffSeconds:2.8,samples:Array.from(samples)};
}

/** Isolated bed at unity gain: quantify ducking, steady air, late texture and sample-exact silence. */
export async function auditAmbience(){
 const rate=24000,ctx=new OfflineAudioContext(2,rate*20,rate),gate=ctx.createGain();
 gate.connect(ctx.destination);gate.gain.setValueAtTime(0,18);
 const ambientNoise=makeAmbientNoise(ctx,710),bed=createAmbience(ctx,gate,ambientNoise,0,710);
 for(let t=0;t<18;t+=.25)bed.update(t,t<12?60000:Math.max(0,(17-t)*3000),3);
 const beep=await ctx.decodeAudioData(await (await fetch(`${audioAssets}csgo-c4-beep.wav`)).arrayBuffer());
 let beepPeak=0,beepEnergy=0;const beepData=beep.getChannelData(0);
 for(const value of beepData){beepPeak=Math.max(beepPeak,Math.abs(value));beepEnergy+=value*value;}
 const beepRms=Math.sqrt(beepEnergy/beepData.length)*.22/Math.max(.01,beepPeak);
 const result=await ctx.startRendering(),channels=[result.getChannelData(0),result.getChannelData(1)];
 const rms=(start:number,end:number,channel?:number)=>{
  let energy=0,count=0;for(const data of channel===undefined?channels:[channels[channel]])for(let i=Math.floor(start*rate);i<Math.floor(end*rate);i++){energy+=data[i]*data[i];count++;}
  return Math.sqrt(energy/count);
 };
 let peak=0,silencePeak=0;for(const data of channels)for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));if(i>=18*rate)silencePeak=Math.max(silencePeak,Math.abs(data[i]));}
 const earlyRms=rms(5,10),lateRms=rms(15.5,17.5),duckedRms=rms(1.5,2.5);
 return {sampleRate:rate,peak,earlyRms,lateRms,duckedRms,duckDb:20*Math.log10(duckedRms/earlyRms),relativeToBeepDb:20*Math.log10(earlyRms/beepRms),lateChangeDb:20*Math.log10(lateRms/earlyRms),leftRms:rms(5,10,0),rightRms:rms(5,10,1),silencePeak,cutoffSeconds:18,sourceLooping:bed.voices.some(v=>(v.source as AudioBufferSourceNode).loop),sourceDuration:ambientNoise.duration,finalElectricalTexture:bed.texture,channels:channels.map(data=>Array.from(data))};
}
