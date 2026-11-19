import {test,expect,type Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const visual=(page:Page)=>page.evaluate(()=>(window as any).counterCode.scene());
const snapshot=(page:Page)=>page.evaluate(()=>(window as any).counterCode.snapshot());
async function start(page:Page){
 await page.goto('/');await expect(page.locator('#start')).toBeVisible({timeout:60_000});
 await page.screenshot({path:'test-results/evidence/excitement/ready.png'});
 await page.click('#start');await expect(page.locator('#answer')).toBeEnabled();
}
async function wrong(page:Page){const answer=(await snapshot(page)).puzzle.expected;await page.keyboard.press(answer===0?'1':'0');await page.keyboard.press('Enter');}

test('red and green room flashes, camera recovery and clean rematch',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await start(page);const base=await visual(page);
 expect(base.effects.stage).toBe('normal');expect(base.effects.warningIntensities).toEqual([0,0]);expect(base.displayLightIntensity).toBe(0);expect(base.effects.rejectionLightIntensity).toBe(0);expect(base.effects.defusalLightIntensity).toBe(0);
 const directions=base.effects.directions;await page.waitForTimeout(300);
 expect((await visual(page)).effects.directions).not.toEqual(directions);
 await page.screenshot({path:'test-results/evidence/excitement/normal.png'});
 const code=await page.locator('code').boundingBox();
 await wrong(page);
 await expect.poll(async()=>(await visual(page)).effects.cameraOffset.some((n:number)=>n!==0),{intervals:[16],timeout:500}).toBe(true);
 expect((await visual(page)).effects.rejectionLightIntensity).toBeGreaterThan(0);
 expect((await visual(page)).effects.denied).toBe(0);
 expect(await page.locator('code').boundingBox()).toEqual(code);
 await page.keyboard.press('Shift+KeyP');await expect(page.locator('#pause')).toBeVisible();
 await page.waitForTimeout(50);const flash=(await visual(page)).effects;
 expect(flash.rejectionLightIntensity).toBeGreaterThan(0);
 await page.screenshot({path:'test-results/evidence/excitement/denied-flash.png',style:'#pause{visibility:hidden!important}'});
 await page.waitForTimeout(100);expect((await visual(page)).effects).toEqual(flash);
 await page.click('#resume');
 await expect(page.locator('#answer')).toBeEnabled();
 expect((await visual(page)).effects.cameraOffset).toEqual([0,0,0]);expect((await visual(page)).effects.denied).toBe(0);expect((await visual(page)).effects.rejectionLightIntensity).toBe(0);
 await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');await expect(page.locator('#success')).toBeVisible();
 await page.waitForFunction(()=>(window as any).counterCode.scene().effects.defusalFlash>.15,{},{timeout:1000});
 const canvas=await page.evaluate(()=>document.querySelector<HTMLCanvasElement>('#scene')!.toDataURL('image/png'));
 await writeFile('test-results/evidence/excitement/defused-flash-canvas.png',Buffer.from(canvas.split(',')[1]!, 'base64'));
 expect((await visual(page)).effects.cameraOffset).toEqual([0,0,0]);
 await expect.poll(async()=>(await visual(page)).effects.stage).toBe('defused');
 expect((await visual(page)).effects.success).toBe(0);
 let v=await visual(page);expect(v.effects.rejectionLightIntensity).toBe(0);expect(v.effects.warningIntensities).toEqual([0,0]);expect(v.lcdText).toMatch(/true$/);expect(v.displayLightIntensity).toBe(.52);
 await page.screenshot({path:'test-results/evidence/excitement/defused-immediate.png'});
 await page.waitForTimeout(1250);v=await visual(page);expect(v.effects.defusalLightIntensity).toBe(0);expect(v.effects.success).toBe(0);expect(v.effects.denied).toBe(0);
 await page.screenshot({path:'test-results/evidence/excitement/defused.png'});
 await page.click('#success [data-action="rematch"]');await expect(page.locator('#answer')).toBeEnabled();v=await visual(page);
 expect(v.effects.stage).toBe('normal');expect(v.effects.warningIntensities).toEqual([0,0]);expect(v.displayLightIntensity).toBe(0);expect(v.effects.defusalLightIntensity).toBe(0);expect(v.effects.denied).toBe(0);expect(v.effects.success).toBe(0);
 expect(v.meshes).toBe(base.meshes);expect(v.textures).toBe(base.textures);expect(v.lcdText).toBe('01:00false');
 await page.keyboard.press('KeyT');await page.click('#teacher-menu [data-action="title"]');await expect(page.locator('#ready')).toBeVisible();
 await expect.poll(async()=>(await visual(page)).effects.stage).toBe('idle');expect((await visual(page)).effects.warningIntensities).toEqual([0,0]);
 expect(errors).toEqual([]);
});

test('real countdown crosses amber and critical thresholds; pause freezes lighting',async({page})=>{
 test.setTimeout(100_000);await start(page);
 await page.waitForFunction(()=>(window as any).counterCode.snapshot().remaining<28000,{},{timeout:40_000});
 await expect.poll(async()=>(await visual(page)).effects.amber).toBe(1);
 let v=await visual(page);expect(v.effects.stage).toBe('amber');expect(v.effects.amber).toBe(1);
 expect(v.effects.warningIntensities.every((n:number)=>n>0)).toBe(true);expect(v.displayLightIntensity).toBe(0);
 await page.screenshot({path:'test-results/evidence/excitement/amber.png'});
 await page.waitForFunction(()=>(window as any).counterCode.snapshot().remaining<8400,{},{timeout:25000});
 await expect.poll(async()=>(await visual(page)).effects.critical).toBe(1);
 v=await visual(page);expect(v.effects.stage).toBe('critical');expect(v.effects.critical).toBe(1);
 const intensity=v.effects.warningIntensities[0];await page.waitForTimeout(250);
 expect((await visual(page)).effects.warningIntensities[0]).not.toBe(intensity);expect(v.displayLightIntensity).toBe(0);
 await page.screenshot({path:'test-results/evidence/excitement/critical.png'});
 await page.keyboard.press('Shift+KeyP');await expect(page.locator('#pause')).toBeVisible();
 await page.waitForTimeout(100);const frozen=(await visual(page)).effects,paused=await snapshot(page);
 await page.waitForTimeout(400);expect((await visual(page)).effects).toEqual(frozen);expect((await snapshot(page)).remaining).toBe(paused.remaining);
 await page.click('#resume');await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');await expect(page.locator('#success')).toBeVisible();
 await expect.poll(async()=>(await visual(page)).effects.warningIntensities).toEqual([0,0]);
});

test('fatal wrong answer jolts, then failure and rematch clear effects',async({page})=>{
 await start(page);for(let i=0;i<5;i++){await wrong(page);await expect(page.locator('#answer')).toBeEnabled();}
 await wrong(page);expect((await snapshot(page)).phase).toBe('failureTransition');
 await expect.poll(async()=>(await visual(page)).effects.jolt,{intervals:[16],timeout:500}).toBeGreaterThan(0);
 expect((await visual(page)).effects.denied).toBe(0);
 expect((await visual(page)).effects.rejectionLightIntensity).toBeGreaterThan(0);
 expect((await visual(page)).effects.warningIntensities).toEqual([0,0]);
 await expect(page.locator('#failure-actions')).toBeVisible({timeout:6000});
 expect((await visual(page)).effects.denied).toBe(0);expect((await visual(page)).effects.cameraOffset).toEqual([0,0,0]);
 await page.click('#failure-actions [data-action="rematch"]');await expect(page.locator('#answer')).toBeEnabled();
 expect((await visual(page)).effects.stage).toBe('normal');expect((await visual(page)).effects.denied).toBe(0);
});

test('reduced motion keeps steady lighting and removes camera and sweeping effects',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await start(page);
 const before=(await visual(page)).effects;expect(before.reducedMotion).toBe(true);
 await page.waitForTimeout(200);expect((await visual(page)).effects.directions).toEqual(before.directions);
 await wrong(page);await expect(page.locator('#answer')).toBeDisabled();
 expect((await visual(page)).effects.denied).toBe(0);
 expect((await visual(page)).effects.cameraOffset).toEqual([0,0,0]);
 expect((await visual(page)).effects.rejectionLightIntensity).toBeLessThanOrEqual(1.75);
 await expect(page.locator('#answer')).toBeEnabled();await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');
 await expect(page.locator('#success')).toBeVisible();
 await expect.poll(async()=>(await visual(page)).effects.stage).toBe('defused');const v=await visual(page);
 expect(v.effects.defusalLightIntensity).toBeLessThanOrEqual(1.75);
 expect(v.effects.success).toBe(0);expect(v.effects.warningIntensities).toEqual([0,0]);expect(v.lcdText).toMatch(/true$/);expect(v.displayLightIntensity).toBe(.52);
});
