import {test, expect} from '@playwright/test';
import {puzzles} from '../../src/puzzles.ts';

test('every Math puzzle fits the projector panel, checks its answer, and changes on restart', async ({page}) => {
  await page.addInitScript(() => {
    Math.random = () => Number((window as any).puzzleRandom ?? 0);
  });
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible({timeout:60_000});
  let previous: typeof puzzles[number] | undefined;
  for (const puzzle of puzzles) {
    const choices = puzzles.filter(p => p !== previous);
    await page.evaluate(value => { (window as any).puzzleRandom = value; }, (choices.indexOf(puzzle) + .5) / choices.length);
    await page.click(previous ? '#success [data-action="rematch"]' : '#start');
    await expect(page.locator('#answer')).toBeEnabled();
    expect(await page.locator('#challenge-code').textContent()).toBe(puzzle.code);
    const selected = await page.evaluate(() => (window as any).counterCode.snapshot().puzzle);
    expect(selected).toEqual(puzzle);
    expect(selected.code).not.toBe(previous?.code);
    await expect(page.locator('#reveal-card')).toBeEmpty();
    await expect(page.locator('#answer')).toHaveValue('');

    for (const [width,height] of [[1920,1080],[1366,768],[1024,768]]) {
      await page.setViewportSize({width,height});
      const bounds = await page.evaluate(() => {
        const code = document.querySelector('#challenge-code')!, strip = document.querySelector('.code-strip')!;
        const panel = document.querySelector('#hud')!.getBoundingClientRect();
        return {code:code.getBoundingClientRect().toJSON(),strip:strip.getBoundingClientRect().toJSON(),
          lineHeight:parseFloat(getComputedStyle(code).lineHeight),panel:panel.toJSON(),clipped:code.scrollWidth > code.clientWidth + 1};
      });
      expect(bounds.code.height).toBeCloseTo(bounds.lineHeight * 2, 0);
      expect(bounds.clipped).toBe(false);
      expect(bounds.code.right).toBeLessThan(bounds.strip.right);
      expect(bounds.strip.right).toBeLessThanOrEqual(width);
      expect(bounds.panel.y).toBeGreaterThan(0);
      expect(bounds.panel.bottom).toBeLessThan(height);
    }
    if (puzzle.expected !== 6) {
      await page.keyboard.type('6');await page.keyboard.press('Enter');
      await expect(page.locator('#feedback')).toContainText('ACCESS DENIED');
      await expect(page.locator('#answer')).toBeEnabled();
    }
    await page.keyboard.type(String(puzzle.expected));await page.keyboard.press('Enter');
    await expect(page.locator('#success')).toBeVisible();
    previous = puzzle;
  }
});
