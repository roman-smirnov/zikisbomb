import {test,expect} from '@playwright/test';
import {puzzles} from '../../src/puzzles.ts';

const longest = puzzles.reduce((a, b) => a.code.length > b.code.length ? a : b);

for(const [width,height] of [[1920,1080],[1366,768],[1024,768]]) {
 test(`projector layout, field states and restart LCD at ${width}x${height}`,async({page})=>{
  // Exercise the longest puzzle first at each supported classroom viewport.
  await page.addInitScript(value=>{Math.random=()=>value;}, (puzzles.indexOf(longest) + .5) / puzzles.length);
  await page.setViewportSize({width,height});
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible({timeout:60_000});
  await page.screenshot({path:`test-results/evidence/visual-polish/title-${width}x${height}.png`});
  await page.click('#start');
  const input=page.locator('#answer'), cursor=page.locator('.blinking-underscore');
  await expect(input).toBeEnabled();await expect(input).toBeFocused();
  expect(await page.locator('#challenge-code').textContent()).toBe(longest.code);
  await expect(page.locator('.line-number,.bracket')).toHaveCount(0);
  await expect(cursor).toHaveCSS('display','block');
  await expect(cursor).toHaveCSS('animation-name','answer-cursor-blink');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(cursor).toHaveCSS('animation-name','none');
  await expect(cursor).toHaveCSS('opacity','1');

  const geometry=()=>page.evaluate(()=>{
   const box=(selector:string)=>{
    const e=document.querySelector(selector) as HTMLElement,r=e.getBoundingClientRect(),style=getComputedStyle(e);
    return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,font:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight)};
   };
   return {panel:box('#hud'),strip:box('.code-strip'),code:box('#challenge-code'),label:box('.answer-label'),input:box('#answer'),feedback:box('#feedback')};
  });
  const before=await geometry();
  expect(before.code.height).toBeCloseTo(before.code.lineHeight * 2, 0);
  expect(before.code.scrollWidth).toBeLessThanOrEqual(before.code.clientWidth + 1);
  expect(before.code.x).toBeGreaterThan(before.strip.x);
  expect(before.code.right).toBeLessThan(before.strip.right);
  expect(before.code.font).toBeGreaterThanOrEqual(12.5);
  expect(before.input.right).toBeLessThan(before.panel.right);
  expect(before.panel.right).toBeLessThanOrEqual(width);
  await page.screenshot({path:`test-results/evidence/visual-polish/gameplay-${width}x${height}.png`});

  // The entire visible field focuses the native input, including its right padding.
  await input.evaluate(e=>e.blur());
  await page.waitForTimeout(180);
  const restingBorder=await input.evaluate(e=>getComputedStyle(e).borderColor);
  await input.click({position:{x:before.input.width-4,y:before.input.height/2}});
  await expect(input).toBeFocused();await page.waitForTimeout(180);
  expect(await input.evaluate(e=>getComputedStyle(e).borderColor)).not.toBe(restingBorder);
  await page.keyboard.type('-12345.6');await expect(input).toHaveValue('-12345.6');
  await expect(cursor).toBeHidden();
  expect(await input.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  for(let i=0;i<8;i++)await page.keyboard.press('Backspace');
  await expect(cursor).toBeVisible();
  for(const answer of ['3.5','-3.5','.5']){
   await page.keyboard.type(answer);await expect(input).toHaveValue(answer);
   for(let i=0;i<answer.length;i++)await page.keyboard.press('Backspace');
  }
  await input.evaluate(e=>{
   const clipboardData=new DataTransfer();clipboardData.setData('text','3.5x');
   e.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));
  });
  await expect(input).toHaveValue('');
  await page.keyboard.press('Numpad3');await page.keyboard.press('NumpadDecimal');await page.keyboard.press('Numpad5');
  await expect(input).toHaveValue('3.5');await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveText('ACCESS DENIED // −10 SECONDS');
  await expect(input).toBeDisabled();await expect(cursor).toBeHidden();
  const denied=await geometry();expect(denied.panel).toEqual(before.panel);expect(denied.input).toEqual(before.input);
  expect(denied.feedback.scrollWidth).toBeLessThanOrEqual(denied.feedback.clientWidth+1);
  await page.screenshot({path:`test-results/evidence/visual-polish/denied-${width}x${height}.png`});
  await expect(input).toBeEnabled();await expect(input).toBeFocused();await expect(cursor).toBeVisible();

  await page.keyboard.press('2');
  await expect.poll(()=>page.evaluate(()=>(window as any).counterCode.scene().keyCues),{intervals:[16],timeout:500}).toContain('2');
  await page.screenshot({path:`test-results/evidence/visual-polish/keypad-${width}x${height}.png`});
  await page.keyboard.press('Backspace');await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');
  await expect(page.locator('#success')).toBeVisible();await page.waitForTimeout(1300);
  expect(await page.evaluate(()=>(window as any).counterCode.scene().lcdText)).toMatch(/true$/);
  await page.screenshot({path:`test-results/evidence/visual-polish/green-lcd-${width}x${height}.png`});
  await page.click('#success [data-action="rematch"]');await expect(input).toBeEnabled();
  await expect(input).toBeFocused();await expect(input).toHaveValue('');await expect(cursor).toBeVisible();
  const visual=await page.evaluate(()=>(window as any).counterCode.scene());
  expect(visual.lcdText).toBe('01:00false');expect(visual.glowIntensity).toBeLessThanOrEqual(.26);
  expect(Math.max(...visual.ledEmission)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`test-results/evidence/visual-polish/restart-red-lcd-${width}x${height}.png`});
  await page.keyboard.type(String(await page.evaluate(()=>(window as any).counterCode.snapshot().puzzle.expected)));await page.keyboard.press('Enter');
  await expect(page.locator('#success')).toBeVisible();await page.waitForTimeout(1300);
  expect(await page.evaluate(()=>(window as any).counterCode.scene().lcdText)).toMatch(/true$/);
  await page.screenshot({path:`test-results/evidence/visual-polish/restart-green-lcd-${width}x${height}.png`});
 });
}
