import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';

const url = process.env.PELICAN_URL || 'http://localhost:4173';
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const stale = await context.newPage(); await stale.goto(url); await stale.locator('#settings').click();
    const active = await context.newPage(); await active.clock.install(); await active.goto(url);
    await active.locator('#play').click();
    await active.keyboard.down('Space'); await active.clock.runFor(1400); await active.keyboard.up('Space'); await active.clock.runFor(1150);
    await active.locator('#pause').click(); await active.locator('#quit').click();
    const banked = await active.evaluate(() => JSON.parse(localStorage.getItem('pelican-v1')));
    assert.ok(banked.totalFish > 0 && banked.bests[0] > 0);
    await stale.locator('#music').uncheck();
    const afterSetting = await stale.evaluate(() => JSON.parse(localStorage.getItem('pelican-v1')));
    assert.equal(afterSetting.totalFish, banked.totalFish); assert.deepEqual(afterSetting.bests, banked.bests);

    const pages = await Promise.all([0, 1].map(async () => {
      const page = await context.newPage(); await page.clock.install(); await page.goto(url); await page.locator('#play').click();
      await page.keyboard.down('Space'); await page.clock.runFor(1400); await page.keyboard.up('Space'); await page.clock.runFor(1150);
      return page;
    }));
    await Promise.all(pages.map(async page => { await page.locator('#pause').click(); await page.locator('#quit').click(); }));
    const totals = await Promise.all(pages.map(page => page.locator('#result-fish').textContent().then(Number)));
    await Promise.all(pages.map(page => page.close()));
    await active.reload(); await active.locator('#play').waitFor();
    const combined = await active.evaluate(() => JSON.parse(localStorage.getItem('pelican-v1')));
    assert.equal(combined.totalFish, banked.totalFish + totals[0] + totals[1]);
    assert.equal(new Set(combined.attemptIds).size, 3);

    const failed = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await failed.addInitScript(() => {
      window.failWrites = true;
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) {
        if (window.failWrites) throw new DOMException('forced write failure', 'QuotaExceededError');
        return write.apply(this, args);
      };
    });
    await failed.goto(url); await failed.locator('#play').click(); await failed.locator('#pause').click(); await failed.locator('#quit').click();
    assert.ok((await failed.locator('#result-mission').textContent()).includes('konnte nicht gespeichert werden'));
    await failed.waitForTimeout(3100); assert.ok(await failed.locator('#retry-save').isVisible());
    await failed.evaluate(() => { window.failWrites = false; }); await failed.locator('#retry-save').click();
    assert.ok((await failed.locator('#result-mission').textContent()).includes('ist gespeichert'));
    assert.ok(await failed.locator('#retry-save').isHidden());
    const retried = await failed.evaluate(() => JSON.parse(localStorage.getItem('pelican-v1')));
    assert.equal(retried.attemptIds.length, 1); await failed.reload();
    assert.equal((await failed.evaluate(() => JSON.parse(localStorage.getItem('pelican-v1')))).attemptIds.length, 1);
    await failed.close();
    console.log(`${name}: stale settings, three exact attempts, persistent failure and idempotent retry passed`);
  } finally { await browser.close(); }
}
