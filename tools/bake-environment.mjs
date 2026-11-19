import {chromium} from '@playwright/test';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/?bake-environment');await page.locator('#start').waitFor({state:'visible',timeout:60000});
const bytes=await page.evaluate(async()=>window.counterCode.bakeEnvironment());
await writeFile('public/assets/textures/studio.env',Buffer.from(bytes));console.log('Baked studio.env',bytes.length);await browser.close();
