import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='test-results/evidence/defuse-sound';
const audio=(page:Page)=>page.evaluate(()=>(window as any).counterCode.audio());
const snapshot=(page:Page)=>page.evaluate(()=>(window as any).counterCode.snapshot());
async function ready(page:Page){await page.goto('/');await expect(page.locator('#start')).toBeVisible({timeout:60_000});}
async function start(page:Page){await page.click('#start');await expect(page.locator('#answer')).toBeEnabled();}
async function solve(page:Page){await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');await expect(page.locator('#success')).toBeVisible();}
test.beforeAll(async()=>{await mkdir(output,{recursive:true});});

test('full recorded defuse announcement plays once, stops countdown and ambience, then silence',async({page})=>{
 await page.addInitScript(()=>{
  const original=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination:any,...args:any[]){
   if(destination instanceof AudioDestinationNode&&this.context instanceof AudioContext){
    const capture=this.context.createMediaStreamDestination();original.call(this,capture);
    (window as any).beginCapture=()=>{
     const chunks:BlobPart[]=[],recorder=new MediaRecorder(capture.stream);recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();
     (window as any).endCapture=()=>new Promise(resolve=>{recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve((reader.result as string).split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'audio/webm'}));};recorder.stop();});
    };
   }
   return (original as any).call(this,destination,...args);
  };
 });
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 await ready(page);await start(page);await page.evaluate(()=>(window as any).beginCapture());await solve(page);
 const won=await snapshot(page),began=await audio(page);expect(began.success.duration).toBeCloseTo(1.7756,3);expect(began.success.plays).toBe(1);expect(began.success.active).toBe(true);
 await page.waitForTimeout(1000);
 const during=await audio(page);expect(during.gate).toBe(1);expect(during.success.active).toBe(true);expect(during.ambience.layers).toBe(0);expect(during.ticks).toBe(began.ticks);
 await page.keyboard.press('Enter');await page.keyboard.press('Enter');expect((await audio(page)).success.plays).toBe(1);
 await expect.poll(async()=>(await audio(page)).success.active).toBe(false);await expect.poll(async()=>(await audio(page)).gate).toBe(0);await expect.poll(async()=>(await audio(page)).peak).toBeLessThan(.00001);
 expect((await audio(page)).voices).toBe(0);expect((await snapshot(page)).remaining).toBe(won.remaining);
 await page.waitForTimeout(250);
 const base64=await page.evaluate(()=>(window as any).endCapture());await writeFile(`${output}/success.webm`,Buffer.from(base64 as string,'base64'));
 await writeFile(`${output}/success-audit.json`,JSON.stringify({began,during,ended:await audio(page)},null,2)+'\n');expect(errors).toEqual([]);
});

test('End Game and Restart interrupt speech immediately and cancel the previous gate deadline',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().endsWith('/csgo-bomb-defused.wav'))requests.push(r.url());});
 await ready(page);await start(page);
 for(const action of ['title','rematch']){
  await solve(page);await page.waitForTimeout(150);expect((await audio(page)).success.active).toBe(true);
  await page.click(`#success [data-action="${action}"]`);
  await expect.poll(async()=>(await audio(page)).success.active).toBe(false);expect((await audio(page)).success.plays).toBe(0);
  if(action==='title'){
   await expect(page.locator('#ready')).toBeVisible();await expect.poll(async()=>(await audio(page)).voices).toBe(0);expect((await audio(page)).gate).toBe(0);await start(page);
  }else await expect(page.locator('#answer')).toBeEnabled();
  // The old announcement would have ended before this new round became playable.
  expect((await audio(page)).gate).toBe(1);expect((await audio(page)).success.active).toBe(false);expect((await snapshot(page)).remaining).toBeGreaterThan(59000);
 }
 expect(requests).toHaveLength(1);
});

test('missing announcement offers retry or muted play; retry caches and decodes the WAV',async({page})=>{
 await page.route('**/csgo-bomb-defused.wav',route=>route.abort());await ready(page);await page.click('#start');
 await expect(page.locator('#audio-error')).toContainText('CS:GO defuse announcement could not load');await expect(page.locator('#muted-start')).toBeVisible();await expect(page.locator('#hud')).toBeHidden();
 await page.unroute('**/csgo-bomb-defused.wav');await start(page);await solve(page);expect((await audio(page)).success.active).toBe(true);
});
