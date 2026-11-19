/** Original near-field device Foley. Shared by live playback and offline mix verification. */
export type Voice = { source: AudioScheduledSourceNode; gain: GainNode; end: number; category: string };
export type Cue = 'key' | 'denied';
export function makeNoise(ctx:BaseAudioContext){
 const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);let seed=710;
 for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}return buffer;
}
export function deviceCue(ctx:BaseAudioContext,out:AudioNode,noise:AudioBuffer,cue:Cue,at:number,key=''):Voice[]{
 const voices:Voice[]=[];
 const envelope=(gain:GainNode,start:number,duration:number,level:number,attack=.002)=>{
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+attack);
  gain.gain.exponentialRampToValueAtTime(.00001,start+duration);gain.gain.setValueAtTime(0,start+duration+.002);
 };
 const track=(source:AudioScheduledSourceNode,gain:GainNode,start:number,duration:number,extras:AudioNode[]=[])=>{
  const voice={source,gain,end:start+duration+.003,category:cue==='denied'?'feedback':cue};voices.push(voice);
  source.onended=()=>{source.disconnect();gain.disconnect();extras.forEach(n=>n.disconnect());};source.start(start);source.stop(voice.end);
 };
 const tone=(hz:number,start:number,duration:number,level:number,type:OscillatorType='sine')=>{
  const source=ctx.createOscillator(),gain=ctx.createGain();source.frequency.value=hz;source.type=type;envelope(gain,start,duration,level);source.connect(gain);gain.connect(out);track(source,gain,start,duration);
 };
 const click=(start:number,duration:number,level:number,hz:number,q=1)=>{
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=noise;filter.type='bandpass';filter.frequency.value=hz;filter.Q.value=q;
  envelope(gain,start,duration,level);source.connect(filter);filter.connect(gain);gain.connect(out);track(source,gain,start,duration,[filter]);
 };
 if(cue==='key'){
  const index=/^\d$/.test(key)?Number(key):0;
  click(at,.022,.14,1900+index*70,.8);tone(430+index*17,at,.045,.045,'triangle');click(at+.038,.018,.055,3200,1.2);
  if(key==='Enter')tone(1320,at+.035,.055,.045);
  if(key==='Backspace')tone(330,at,.055,.045);
 }
 if(cue==='denied'){
  // Broken-contact triplet: a short local electrical rejection, with no impact or siren.
  [0,.062,.14].forEach((d,i)=>{tone(i===2?185:247,at+d,.065,i===2?.12:.09,'triangle');tone(494,at+d,.032,.026);click(at+d,.024,.09,1100,.7);});
 }
 return voices;
}

/** Play an unchanged game recording, with gain matching only; no pitch/filter overlays. */
export function recordedCue(ctx:BaseAudioContext,out:AudioNode,buffer:AudioBuffer,at:number,level:number,category:string):Voice{
 let peak=0;for(let channel=0;channel<buffer.numberOfChannels;channel++)for(const value of buffer.getChannelData(channel))peak=Math.max(peak,Math.abs(value));
 const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;gain.gain.value=level/Math.max(.01,peak);source.connect(gain);gain.connect(out);
 const voice={source,gain,end:at+buffer.duration,category};source.onended=()=>{source.disconnect();gain.disconnect();};source.start(at);return voice;
}

/** Stretch the existing cadence bands to the configured round length. */
export function countdownInterval(remaining:number,duration:number):number {
 const fraction=remaining/duration;
 return fraction>.5?1200:fraction>.25?850:fraction>1/12?500:250;
}
