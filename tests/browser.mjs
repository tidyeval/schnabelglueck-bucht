import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const url = process.env.PELICAN_URL || 'http://localhost:4173';
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.clock.install();
    await page.goto(url);
    await page.locator('#play').waitFor();
    await page.screenshot({ path: `test-results/${name}-start.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');
    await page.locator('#settings').click();
    await page.locator('#music').uncheck();
    await page.locator('#sound').uncheck();
    await page.locator('.close-settings').click();
    await page.locator('#play').click();
    await page.keyboard.down('Space');
    await page.clock.runFor(1400);
    await page.keyboard.up('Space');
    await page.clock.runFor(1150);
    const score = Number(await page.locator('#score').textContent());
    assert.ok(score > 0, 'holding then releasing catches real fish');
    await page.clock.runFor(350); // Finish breaching before the aerial presses.
    for (let i = 0; i < 2; i++) { await page.keyboard.down('Space'); await page.clock.runFor(40); await page.keyboard.up('Space'); await page.clock.runFor(60); }
    await page.clock.runFor(800);
    assert.ok(Number(await page.locator('#score').textContent()) >= score + 50, 'double press completes an airborne trick');
    await page.locator('#pause').click();
    const time = await page.locator('#time').textContent();
    await page.clock.runFor(2000);
    assert.equal(await page.locator('#time').textContent(), time, 'pause freezes the round');
    await page.locator('#resume').click();
    // Exercise a pointer hold as well as keyboard input, including its cancellation.
    await page.mouse.move(180, 500);
    await page.mouse.down();
    await page.clock.runFor(500);
    await page.locator('#app').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'touch', bubbles: true });
    await page.mouse.up();
    await page.clock.runFor(1000);
    await page.screenshot({ path: `test-results/${name}-playing.png` });
    await page.locator('#settings').click();
    const settingsTime = await page.locator('#time').textContent();
    await page.clock.runFor(1000);
    assert.equal(await page.locator('#time').textContent(), settingsTime);
    await page.locator('.close-settings').click();
    await page.locator('#quit').click();
    assert.ok(await page.locator('#result-dialog').isVisible());
    assert.ok(Number(await page.locator('#result-combo').textContent()) > 0, 'best series remains in the result');
    const bank = await page.evaluate(() => JSON.parse(localStorage.getItem('pelican-bucht-test-v1')));
    assert.ok(bank.totalFish > 0); assert.ok(bank.bests[0] >= score); assert.equal(bank.music, false);
    await page.locator('#again').click();
    assert.equal(await page.locator('#score').textContent(), '0');
    await page.keyboard.press('Escape'); assert.ok(await page.locator('#pause-dialog').isVisible()); await page.locator('#resume').click();
    await page.evaluate(() => dispatchEvent(new Event('blur'))); assert.ok(await page.locator('#pause-dialog').isVisible()); await page.locator('#resume').click();
    await page.keyboard.down('Space');
    await page.clock.runFor(9100);
    assert.ok(await page.locator('#result-dialog').isVisible());
    assert.equal(await page.locator('#result-title').textContent(), 'Die Luft ist aus!');
    await page.keyboard.up('Space');
    const endedScore = await page.locator('#score').textContent();
    await page.clock.runFor(1000);
    assert.equal(await page.locator('#score').textContent(), endedScore);
    await page.locator('#back-home').click();
    assert.equal(await page.locator('#wardrobe').count(), 0);
    if (name === 'chromium') {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await context.setOffline(true);
      await page.reload();
      await page.locator('#play').click();
      await page.clock.runFor(1000);
      assert.ok(await page.locator('#hud').isVisible(), 'installed assets work offline');
      await context.setOffline(false);
    }
    assert.deepEqual(errors, [], 'no browser runtime errors');
    console.log(`${name}: mobile gameplay, fish, pause, settings, result, restart, storage${name === 'chromium' ? ', offline' : ''} passed`);
  } finally { await browser.close(); }
}
