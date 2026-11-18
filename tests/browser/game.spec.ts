import { expect, test } from '@playwright/test';
import { puzzles } from '../../src/puzzles.ts';

test('renders the Garden and starts on the teacher’s cue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-graphics', 'ready', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Ziki’s Bomb' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('timer')).toBeHidden();
  await page.screenshot({ path: 'test-results/ready-1280.png' });

  // Capture just the garden, with the hero and device framed for either layout.
  await page.setViewportSize({ width: 1080, height: 920 });
  const chrome = await page.addStyleTag({
    content: '.stage{--panel-width:0px} .console,.utilities{visibility:hidden} #scene-focus{margin:20px 45px}',
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: 'test-results/garden-scene.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await chrome.evaluate(node => node.remove());

  await page.getByLabel('Topic').selectOption('Max');
  await page.getByRole('button', { name: 'Start round' }).click();
  await expect(page.getByRole('timer')).toHaveText('01:00');
  await expect(page.getByText('What will this code print?')).toBeVisible();
  const question = await page.locator('#challenge').textContent();
  const puzzle = puzzles.find(item => question === `Console.WriteLine(${item.expression});`)!;
  expect(puzzle.topic).toBe('Max');
  await page.screenshot({ path: 'test-results/playing-1280.png' });
  await page.getByLabel('Answer', { exact: true }).fill(puzzle.displayAnswer);
  await page.getByLabel('Answer', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Garden safe' })).toBeVisible();
  await expect(page.getByText('Printed value')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show solution' }).click();
  await expect(page.locator('output')).toHaveText(puzzle.displayAnswer);
  await expect(page.getByText(puzzle.explanation)).toBeVisible();
  await page.screenshot({ path: 'test-results/solution-1280.png' });
  await page.keyboard.press('Shift+R');
  await expect(page.locator('#challenge')).not.toHaveText(question!);
  await expect(page.locator('output')).toHaveCount(0);
  await expect(page.getByLabel('Answer', { exact: true })).toHaveValue('');
  await page.keyboard.press('F');
  await expect(page.getByRole('button', { name: /exit fullscreen/i })).toBeVisible();
  await page.keyboard.press('F');
  await expect(page.getByRole('button', { name: /^fullscreen$/i })).toBeVisible();
  await expect(page.getByLabel('Answer', { exact: true })).toBeFocused();
  for (const [width, height] of [[1024, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('timer')).toBeInViewport();
    await expect(page.locator('#challenge')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Submit' })).toBeInViewport();
    await page.screenshot({ path: `test-results/playing-${width}.png` });
  }
  expect(errors).toEqual([]);
});

test('plays without WebGL or external requests and expires on its own clock', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', async route => {
    if (!route.request().url().startsWith('http://127.0.0.1:4198/')) {
      external.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...params: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return Reflect.apply(real, this, [type, ...params]);
    } as typeof real;
  });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-graphics', 'fallback');
  const still = await page.request.get('/assets/garden.webp');
  expect(still.headers()['content-type']).toContain('image/webp');
  await page.getByRole('button', { name: 'Start round' }).click();
  const answer = page.getByLabel('Answer', { exact: true });
  await answer.fill('-');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Enter a number.').first()).toBeVisible();
  await expect(answer).toBeFocused();
  await answer.fill('999');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.locator('#feedback')).toContainText('−10 seconds');
  await page.clock.runFor(850);
  await expect(answer).toBeFocused();
  await page.keyboard.press('T');
  await expect(page.getByRole('dialog')).toBeVisible();
  const frozen = await page.getByRole('timer').textContent();
  await page.clock.fastForward(10_000);
  await expect(page.getByRole('timer')).toHaveText(frozen!);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(answer).toBeFocused();
  await page.clock.fastForward(60_000);
  await expect(page.getByRole('heading', { name: 'Time’s up' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('00:00');
  await page.screenshot({ path: 'test-results/expiry-fallback.png' });
  await expect(page.locator('output')).toHaveCount(0);
  await page.keyboard.press('R');
  await expect(page.locator('output')).toBeVisible();
  expect(external).toEqual([]);
});

test('supports touch entry and keeps the mobile quiz readable', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await page.goto('http://127.0.0.1:4198/');
    await expect(page.locator('#world')).toHaveAttribute('data-graphics', 'ready', { timeout: 20_000 });
    await page.getByLabel('Topic').selectOption('Sqrt');
    await page.getByRole('button', { name: 'Start round' }).tap();
    const entry = page.getByLabel('Answer', { exact: true });
    await entry.fill('2');
    await page.getByRole('button', { name: 'Enter decimal point' }).tap();
    await expect(entry).toHaveValue('2.');
    await entry.fill('2,50');
    await expect(entry).toHaveValue('2.50');
    await entry.fill('2..');
    await expect(entry).toHaveValue('2.50');
    const question = await page.locator('#challenge').textContent();
    const puzzle = puzzles.find(item => question === `Console.WriteLine(${item.expression});`)!;
    await entry.fill(puzzle.expected === 2.5 ? '2,50' : puzzle.displayAnswer);
    await page.screenshot({ path: 'test-results/playing-390.png' });
    await page.getByRole('button', { name: 'Submit' }).tap();
    await expect(page.getByRole('heading', { name: 'Garden safe' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally {
    await page.close();
  }
});

test('recovers from graphics context loss during an active countdown', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-graphics', 'ready', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Start round' }).click();
  const contextLoss = await page.locator('canvas').evaluate(canvas => {
    const ctx = (canvas as HTMLCanvasElement).getContext('webgl2');
    const extension = ctx?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    // Chrome invokes the restoration on the original context asynchronously.
    canvas.addEventListener('webglcontextlost', () => window.setTimeout(() => extension.restoreContext(), 1500));
    extension.loseContext();
    return true;
  });
  expect(contextLoss).toBe(true);
  await expect(page.locator('#world')).toHaveAttribute('data-graphics', 'fallback');
  await expect(page.getByRole('timer')).not.toHaveText('01:00');
  await expect(page.locator('#world')).toHaveAttribute('data-graphics', 'ready', { timeout: 20_000 });
  await expect(page.getByLabel('Answer', { exact: true })).toBeEnabled();
});


test('uses the static garden if assets fail and sound is blocked', async ({ page }) => {
  await page.route('**/assets/ziki.glb', route => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', {
      value: class { constructor() { throw new Error('Audio unavailable'); } },
    });
  });
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-graphics', 'fallback');
  await page.getByRole('button', { name: 'Sound off' }).click();
  await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start round' }).click();
  const question = await page.locator('#challenge').textContent();
  const puzzle = puzzles.find(item => question === `Console.WriteLine(${item.expression});`)!;
  await page.getByRole('textbox', { name: 'Answer' }).fill(puzzle.displayAnswer);
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: 'Garden safe' })).toBeVisible();
});
