import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    await context.route('**/assets/phaser.esm-*.js', route => route.abort());
    const page = await context.newPage();
    await page.goto('http://localhost:4173/');
    await page.locator('#stages option').first().waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('#world').getContext('2d').getImageData(100, 100, 1, 1).data[3] > 0);
    await page.getByText('Zusätzliche Effekte konnten nicht geladen werden.', { exact: false }).waitFor();
    await page.locator('#play').click();
    assert.ok(await page.locator('#hud').isVisible());
    await page.keyboard.down('Space');
    await page.waitForTimeout(2300);
    await page.keyboard.up('Space');
    assert.ok(Number(await page.locator('#score').textContent()) > 0, 'fish remain catchable without Phaser');
    console.log(`${engine.name()}: game starts and catches fish when Phaser fails to load`);
  } finally { await browser.close(); }
}
