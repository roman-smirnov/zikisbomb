import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const snapshot=(page:any)=>page.evaluate(()=>(window as any).counterCode.snapshot());
const audio=(page:any)=>page.evaluate(()=>(window as any).counterCode.audio());
const output='test-results/evidence/ambience';
test.beforeAll(async()=>{await mkdir(output,{recursive:true});});

test('offline ambience balance, announcement duck, modest late texture and exact silence',async({page})=>{
 await page.goto('/');await expect(page.locator('#start')).toBeVisible({timeout:60_000});
 const {channels,...audit}=await page.evaluate(()=>(window as any).counterCode.ambienceAudit());
 await writeFile(`${output}/bed-audit.json`,JSON.stringify(audit,null,2)+'\n');
 const frames=channels[0].length,bytes=frames*4,wav=Buffer.alloc(44+bytes);
 wav.write('RIFF');wav.writeUInt32LE(36+bytes,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(audit.sampleRate,24);wav.writeUInt32LE(audit.sampleRate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
 for(let i=0;i<frames;i++)for(let c=0;c<2;c++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*2+c)*2);
 await writeFile(`${output}/isolated-bed-unity.wav`,wav);
 console.log('Ambience measurements',audit);
 expect(audit.sourceLooping).toBe(false);expect(audit.sourceDuration).toBeGreaterThan(105);
 expect(audit.relativeToBeepDb).toBeLessThan(-22);expect(audit.duckDb).toBeLessThan(-12);
 expect(Math.abs(audit.lateChangeDb)).toBeLessThan(1.5);expect(audit.finalElectricalTexture).toBe(1.25);
 expect(audit.leftRms).toBeGreaterThan(audit.rightRms);expect(audit.silencePeak).toBe(0);
});

test('real full-round bed, sparse details between recorded beeps, failure cutoff and lifecycle',async({page})=>{
 test.setTimeout(140_000);
 test.setTimeout(180_000);
 await page.addInitScript(()=>{
  const original=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination:any,...args:any[]){
   if(destination instanceof AudioDestinationNode&&this.context instanceof AudioContext){
    const capture=this.context.createMediaStreamDestination();original.call(this,capture);
    const chunks:BlobPart[]=[],recorder=new MediaRecorder(capture.stream);
    recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();
    (window as any).stopAudioCapture=()=>new Promise(resolve=>{recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve((reader.result as string).split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'audio/webm'}));};recorder.stop();});
   }
   return (original as any).call(this,destination,...args);
  };
 });
 await page.goto('/');await expect(page.locator('#start')).toBeVisible({timeout:60_000});await page.click('#start');
 await expect.poll(async()=>(await audio(page)).ambience.duck).toBe(.18);
 await expect(page.locator('#answer')).toBeEnabled();
 await expect.poll(async()=>(await audio(page)).ambience.duck,{timeout:6000}).toBe(1);
 const roundRemaining=(await snapshot(page)).remaining;
 const started=(await audio(page)).ambience;expect(started.layers).toBe(3);expect(started.texture).toBe(1);
 await expect.poll(async()=>(await snapshot(page)).phase,{timeout:roundRemaining+5000,intervals:[100]}).toBe('failureTransition');
 const failure=(await audio(page)).ambience;
 expect(failure.starts).toBe(started.starts);expect(failure.layers).toBe(3);expect(failure.texture).toBe(1.25);
 expect(failure.details).toBeGreaterThanOrEqual(2);expect(failure.details).toBeLessThanOrEqual(Math.ceil(roundRemaining/8000)+1);
 for(const [i,detail] of failure.history.entries()){
  expect(detail.sinceBeep).toBeGreaterThan(225);expect(detail.untilBeep).toBeGreaterThan(260);
  if(i)expect(detail.at-failure.history[i-1].at).toBeGreaterThanOrEqual(8000);
 }
 await expect.poll(async()=>(await snapshot(page)).time-(await snapshot(page)).entered).toBeGreaterThan(2900);
 const silent=await audio(page);expect(silent.gate).toBe(0);expect(silent.peak).toBeLessThan(.00001);expect(silent.ambience.layers).toBe(0);expect(silent.voices).toBe(0);
 await expect(page.locator('#failure-actions')).toBeVisible();
 expect((await audio(page)).ambience.starts).toBe(started.starts);
 const base64=await page.evaluate(()=>(window as any).stopAudioCapture());
 await writeFile(`${output}/full-round.webm`,Buffer.from(base64 as string,'base64'));
 await writeFile(`${output}/live-audit.json`,JSON.stringify({started,failure,silent},null,2)+'\n');
 await page.click('#failure-actions [data-action="rematch"]');await expect(page.locator('#answer')).toBeEnabled();
 expect((await audio(page)).ambience.layers).toBe(3);expect((await audio(page)).ambience.details).toBe(0);expect((await audio(page)).ambience.texture).toBe(1);
 await page.keyboard.press('KeyM');await page.waitForTimeout(250);expect((await audio(page)).peak).toBeLessThan(.00001);await page.keyboard.press('KeyM');
 await page.keyboard.press('Shift+KeyP');await page.waitForTimeout(100);expect((await audio(page)).voices).toBe(0);
 await page.click('#resume');await expect.poll(async()=>(await audio(page)).ambience.layers).toBe(3);
 await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');await expect(page.locator('#success')).toBeVisible();await expect.poll(async()=>(await audio(page)).success.active).toBe(false);await expect.poll(async()=>(await audio(page)).gate).toBe(0);await page.waitForTimeout(100);
 expect((await audio(page)).voices).toBe(0);expect((await audio(page)).peak).toBeLessThan(.00001);
});
