import {test,expect, type Page} from '@playwright/test';
const snapshot=(page:Page)=>page.evaluate(()=>(window as any).counterCode.snapshot());
const audio=(page:Page)=>page.evaluate(()=>(window as any).counterCode.audio());
async function ready(page:Page){await page.goto('/');await expect(page.locator('#start')).toBeVisible({timeout:60_000});}
async function start(page:Page){await page.click('#start');await expect(page.locator('#answer')).toBeEnabled({timeout:10_000});}
async function wrong(page:Page){const answer=(await snapshot(page)).puzzle.expected;await page.keyboard.press(answer===0?'1':'0');await page.keyboard.press('Enter');}

test('exact challenge, input grammar, penalty once, pause, numpad success and cancellation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));await ready(page);
 await expect(page.locator('#reveal-card')).toBeEmpty();await start(page);expect(await page.locator('#challenge-code').textContent()).toBe((await snapshot(page)).puzzle.code);
 expect((await snapshot(page)).remaining).toBeGreaterThan(59000);
 await page.waitForTimeout(1200);await page.screenshot({path:'test-results/evidence/playing-1080p.png'});
 await page.keyboard.press('Enter');expect((await snapshot(page)).phase).toBe('playing');
 await page.keyboard.press('Minus');await page.keyboard.press('Enter');expect((await snapshot(page)).phase).toBe('playing');await page.keyboard.press('Backspace');
 await page.keyboard.press('Digit3');await page.keyboard.press('Digit8');await page.keyboard.press('Backspace');await page.keyboard.press('Period');await page.keyboard.press('Digit5');await expect(page.locator('#answer')).toHaveValue('3.5');
 const before=await snapshot(page);await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');
 await expect(page.locator('#feedback')).toHaveText('ACCESS DENIED // −10 SECONDS');await expect(page.locator('#answer')).toHaveValue('');
 const denied=await snapshot(page);expect(before.remaining-denied.remaining).toBeGreaterThanOrEqual(10000);expect(before.remaining-denied.remaining).toBeLessThan(10600);
 await page.screenshot({path:'test-results/evidence/access-denied.png'});await page.waitForTimeout(850);
 await page.keyboard.press('Shift+KeyP');await expect(page.locator('#pause h2')).toHaveText('GAME PAUSED');await expect(page.locator('#pause-reason')).toHaveText('Resume when ready');await expect(page.locator('#resume')).toHaveText('RESUME GAME');const paused=await snapshot(page);await page.waitForTimeout(700);expect((await snapshot(page)).remaining).toBe(paused.remaining);expect((await audio(page)).voices).toBe(0);await page.screenshot({path:'test-results/evidence/paused.png'});
 await page.click('#resume');const expected=String((await snapshot(page)).puzzle.expected);
 const numericEquivalent=expected.includes('.') ? `${expected}0` : `${expected}.0`;
 for(const digit of numericEquivalent) {
  await page.keyboard.press(digit==='-' ? 'NumpadSubtract' : digit==='.' ? 'NumpadDecimal' : `Numpad${digit}`);
 }
 await expect(page.locator('#answer')).toHaveValue(numericEquivalent);await page.keyboard.press('NumpadEnter');await expect(page.locator('#success')).toBeVisible();
 const won=await snapshot(page), ticks=(await audio(page)).ticks;await expect.poll(async()=>(await audio(page)).success.active).toBe(false);await expect.poll(async()=>(await audio(page)).gate).toBe(0);await page.waitForTimeout(100);expect((await snapshot(page)).remaining).toBe(won.remaining);expect((await audio(page)).ticks).toBe(ticks);expect((await audio(page)).voices).toBe(0);expect((await audio(page)).peak).toBeLessThan(.00001);await page.screenshot({path:'test-results/evidence/defused.png'});expect(errors).toEqual([]);
});

test('fatal penalties, exact black / silence / failed sequence, explicit reveal, clean rematch',async({page})=>{
 await page.addInitScript(()=>{Math.random=()=>.999999;});
 await ready(page);await start(page);
 for(let i=0;i<5;i++){await wrong(page);await page.waitForTimeout(820);}
 await wrong(page);await expect.poll(async()=> (await snapshot(page)).phase).toBe('failureTransition');
 await expect(page.locator('#failure-actions')).toBeHidden();await page.keyboard.press('KeyR');await expect(page.locator('#reveal-card')).toBeEmpty();
 await expect.poll(async()=> (await snapshot(page)).time-(await snapshot(page)).entered).toBeGreaterThan(2650);
 expect(Number(await page.locator('#blackout').evaluate(e=>(e as HTMLElement).style.opacity))).toBe(1);
 await expect.poll(async()=> (await snapshot(page)).time-(await snapshot(page)).entered).toBeGreaterThan(2900);
 expect((await audio(page)).gate).toBe(0);expect((await audio(page)).peak).toBeLessThan(.00001);await expect(page.locator('#failure-actions')).toBeHidden();
 await page.screenshot({path:'test-results/evidence/failure-black.png'});
 await expect(page.locator('#failure-actions')).toBeVisible();expect((await snapshot(page)).phase).toBe('missionFailed');await expect(page.locator('#reveal')).toHaveText('SHOW ANSWER');await expect(page.locator('#failure-actions [data-action="rematch"]')).toHaveText('RESTART GAME');await expect(page.locator('#failure-actions [data-action="title"]')).toHaveText('END GAME');await page.screenshot({path:'test-results/evidence/mission-failed.png'});
 await page.click('#reveal');const puzzle=(await snapshot(page)).puzzle;await expect(page.locator('#reveal-output')).toHaveText(`Code output: ${puzzle.displayAnswer}`);expect(await page.locator('#reveal-code').textContent()).toBe(puzzle.code);await expect(page.locator('.reveal-prompt')).toHaveText('WHY?');await expect(page.locator('.reveal-note')).toHaveText(puzzle.explanation);await page.screenshot({path:'test-results/evidence/teacher-reveal.png'});
 const old=(await snapshot(page)).runId;await page.click('#reveal-rematch');await expect(page.locator('#answer')).toBeEnabled();expect((await snapshot(page)).runId).toBe(old+1);await expect(page.locator('#reveal-card')).toBeEmpty();await expect(page.locator('#answer')).toHaveValue('');expect((await snapshot(page)).remaining).toBeGreaterThan(59000);
});

test('real sixty-second timeout without guesses, failure pause and resumed cutoff',async({page})=>{
 test.setTimeout(120_000);await ready(page);await start(page);await page.waitForTimeout(60050);await expect.poll(async()=> (await snapshot(page)).phase).toBe('failureTransition');
 await page.keyboard.press('Shift+KeyP');const t=(await snapshot(page)).time;await page.waitForTimeout(500);expect((await snapshot(page)).time).toBe(t);await page.click('#resume');
 await expect(page.locator('#failure-actions')).toBeVisible({timeout:6000});expect((await audio(page)).gate).toBe(0);expect((await audio(page)).peak).toBeLessThan(.00001);
});

test('teacher controls, fullscreen, background countdown and repeated rematches reuse assets',async({page,context})=>{
 await ready(page);await page.click('#fullscreen');await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await page.click('#fullscreen');await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
 await page.click('#menu-button');await expect(page.locator('#quality')).toHaveCount(0);await expect(page.locator('#projector')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).counterCode.scene().quality)).toBe('high');expect(await page.evaluate(()=>(window as any).counterCode.scene().exposure)).toBeGreaterThan(0);await expect(page.locator('body')).toHaveClass('projector');await expect(page.locator('#credits-button')).toHaveCount(0);await expect(page.locator('#teacher-menu [data-action="rematch"]')).toHaveText('RESTART GAME');await expect(page.locator('#teacher-menu [data-action="title"]')).toHaveText('END GAME');await page.click('#close-menu');
 await start(page);const beforeBlur=await snapshot(page);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(2500);await page.bringToFront();await other.close();
 await expect(page.locator('#pause')).toBeHidden();const afterBlur=await snapshot(page);expect(afterBlur.paused).toBe(false);expect(beforeBlur.remaining-afterBlur.remaining).toBeGreaterThan(2400);
 await page.keyboard.press('Shift+KeyP');await expect(page.locator('#pause')).toBeVisible();const manuallyPaused=await snapshot(page);await page.waitForTimeout(300);expect((await snapshot(page)).remaining).toBe(manuallyPaused.remaining);await page.click('#resume');
 const requests:string[]=[];page.on('request',r=>{if(r.url().endsWith('.glb'))requests.push(r.url());});const base=await page.evaluate(()=>(window as any).counterCode.scene());
 for(let i=0;i<5;i++){await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');await expect(page.locator('#success')).toBeVisible();await page.waitForTimeout(900);await page.click('#success [data-action="rematch"]');await expect(page.locator('#answer')).toBeEnabled();}
 expect(requests).toHaveLength(0);const after=await page.evaluate(()=>(window as any).counterCode.scene());expect(after.meshes).toBe(base.meshes);expect(after.textures).toBe(base.textures);
 await page.keyboard.press('KeyT');await page.click('[data-action="title"]:visible');await expect(page.locator('#ready')).toBeVisible();expect((await audio(page)).voices).toBeLessThanOrEqual(1);
 await page.setViewportSize({width:1366,height:768});await start(page);await page.screenshot({path:'test-results/evidence/playing-1366.png'});const box=await page.locator('.code-strip').boundingBox();expect(box!.x+box!.width).toBeLessThanOrEqual(1366);
 await expect(page.locator('#motion')).toHaveCount(0);
});

test('loading error offers retry and muted gameplay remains playable',async({page})=>{
 await page.route('**/c4-2k.glb',r=>r.abort());await page.goto('/');await expect(page.locator('#retry')).toBeVisible();await expect(page.locator('#start')).toBeHidden();await page.unroute('**/c4-2k.glb');await page.click('#retry');await expect(page.locator('#start')).toBeVisible({timeout:60_000});
 await page.click('#mute');await start(page);await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');await expect(page.locator('#success')).toBeVisible();
});

test('offline synthesized worst-case mix has headroom and exact post-gate silence',async({page})=>{
 await ready(page);const audit=await page.evaluate(async()=>{const {samples,...result}=await (window as any).counterCode.audioAudit();return result;});expect(audit.peakDb).toBeLessThan(-3);expect(audit.silencePeak).toBe(0);expect(audit.cutoffSeconds).toBe(2.8);
});

test('LCD and LED emission stay bounded when round time resets through title or rematch',async({page})=>{
 await ready(page);await start(page);await page.waitForTimeout(2500);
 await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');await expect(page.locator('#success')).toBeVisible();await page.waitForTimeout(1300);
 await page.click('#success [data-action="title"]');await expect(page.locator('#ready')).toBeVisible();await page.waitForTimeout(100);
 await page.screenshot({path:'test-results/evidence/lcd-title-reset.png'});
 let visual=await page.evaluate(()=>(window as any).counterCode.scene());expect(visual.glowIntensity).toBeLessThanOrEqual(.26);expect(Math.max(...visual.ledEmission)).toBeLessThanOrEqual(1);expect(visual.lcdText).toBe('01:00false');
 await start(page);await page.waitForTimeout(1200);await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');await expect(page.locator('#success')).toBeVisible();await page.waitForTimeout(1300);
 await page.click('#success [data-action="rematch"]');await expect(page.locator('#answer')).toBeEnabled();
 visual=await page.evaluate(()=>(window as any).counterCode.scene());expect(visual.glowIntensity).toBeLessThanOrEqual(.26);expect(Math.max(...visual.ledEmission)).toBeLessThanOrEqual(1);
 await page.screenshot({path:'test-results/evidence/lcd-rematch-reset.png'});
});
