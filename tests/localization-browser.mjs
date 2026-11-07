import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.PELICAN_URL || 'http://localhost:4173';
const expected = {
  de: { title: 'Schnabelglück', play: 'Los gehts!', stage: 'Geschützte Bucht', air: 'LUFT', settings: 'Wie klingtdein Meer?' },
  en: { title: 'Happy Beak', play: 'Let’s go!', stage: 'Sheltered Bay', air: 'AIR', settings: 'How doesyour sea sound?' },
  es: { title: 'Pico Feliz', play: '¡Vamos!', stage: 'Bahía protegida', air: 'AIRE', settings: '¿Cómo suenatu mar?' },
};
await mkdir('test-results/localization', { recursive: true });

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(url); await page.locator('#play').waitFor();
    assert.equal(await page.locator('#wardrobe').count(), 0, 'wardrobe is removed from the menu');
    assert.equal(await page.locator('[data-locale]').count(), 3);
    for (const locale of ['de', 'en', 'es']) {
      const copy = expected[locale];
      const button = page.locator(`[data-locale="${locale}"]`);
      await button.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.documentElement.lang), locale);
      assert.equal(await page.title(), copy.title);
      assert.equal(await page.locator('#game-title').innerText(), copy.title);
      assert.equal(await page.locator('#game-title em').innerText(), { de: 'glück', en: 'Beak', es: 'Feliz' }[locale]);
      assert.equal(await page.locator('#game-title').evaluate(title => getComputedStyle(title).color !== getComputedStyle(title.querySelector('em')).color), true, 'every localized title uses two colors');
      assert.equal(await page.locator('#play-label').innerText(), copy.play);
      assert.match(await page.locator('#stages').innerText(), new RegExp(copy.stage));
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.ok(await button.getAttribute('aria-label'));
      await page.locator('#settings').click();
      assert.equal((await page.locator('#settings-dialog h2').innerText()).replace(/\s/g, ''), copy.settings.replace(/\s/g, ''));
      await page.locator('.close-settings').click();
      await page.locator('#play').click();
      assert.equal(await page.locator('#air-label').textContent(), copy.air);
      await page.locator('#pause').click(); await page.locator('#quit').click(); await page.locator('#back-home').click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pelican-bucht-test-v1')).language), locale);
      await page.reload(); await page.locator('#play').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.lang), locale, 'locale survives reload');
    }
    await page.evaluate(() => localStorage.setItem('pelican-bucht-test-v1', JSON.stringify({ language: 'xx' })));
    await page.reload(); await page.locator('#play').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'de', 'invalid locale falls back to German');
    await page.locator('[data-locale="es"]').click();
    for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
      await page.setViewportSize({ width, height });
      const bounds = await page.locator('.start-bottom').boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height, `${width}×${height}: menu fits vertically`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}×${height}: no horizontal overflow`);
      if (width === 430) await page.screenshot({ path: `test-results/localization/${name}-es-430.png` });
    }
    assert.deepEqual(errors, []);
    console.log(`${name}: language selection, persistence and fallback passed`);
  } finally { await browser.close(); }
}
