import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
const url = process.env.PELICAN_URL || 'http://localhost:4174/schnabel-voll-glueck/';
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.clock.install();
    await page.goto(url);
    assert.equal(await page.title(), 'Schnabelglück');
    const manifestURL = await page.locator('link[rel=manifest]').evaluate(e => e.href);
    const manifest = await (await context.request.get(manifestURL)).json();
    assert.equal(new URL(manifest.start_url, manifestURL).href, url);
    assert.equal(new URL(manifest.scope, manifestURL).href, url);
    for (const icon of manifest.icons) assert.ok((await context.request.get(new URL(icon.src, manifestURL).href)).ok());
    await page.locator('#play').click();
    await page.keyboard.down('Space'); await page.clock.runFor(2500);
    await page.keyboard.up('Space'); await page.clock.runFor(550);
    assert.ok(Number(await page.locator('#score').textContent()) > 0);
    if (engine === chromium) {
      const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
      assert.equal(scope, url);
      await page.reload();
      await context.setOffline(true);
      await page.goto(url + '?offline-check=1');
      await page.locator('#play').click(); await page.clock.runFor(1000);
      assert.ok(await page.locator('#hud').isVisible());
    }
    assert.deepEqual(errors, []);
    console.log(`${engine.name()}: ${url} — assets, manifest, gameplay${engine === chromium ? ', scoped offline fallback' : ''} passed`);
  } finally { await browser.close(); }
}
