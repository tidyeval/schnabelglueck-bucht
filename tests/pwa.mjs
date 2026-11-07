import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'vite';
import viteConfig from '../vite.config.js';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const fixture = await mkdtemp(join(tmpdir(), 'schnabel-pwa-'));
const builds = [join(fixture, 'build-1'), join(fixture, 'build-2')];
for (let i = 0; i < builds.length; i++) {
  const publicDir = join(fixture, `public-${i}`); await cp(new URL('../public', import.meta.url), publicDir, { recursive: true });
  if (i === 1) {
    const manifestPath = join(publicDir, 'manifest.webmanifest');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')); manifest.description = 'Aktualisierte kleine Auszeit am Meer.';
    await writeFile(manifestPath, JSON.stringify(manifest));
  }
  await build({ ...viteConfig, publicDir, build: { ...(viteConfig.build || {}), outDir: builds[i], emptyOutDir: true }, logLevel: 'silent' });
}
let deployment = 0;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    let body = await readFile(join(builds[deployment], path === '/' ? 'index.html' : path.slice(1)));
    if (path === '/sw.js' && deployment > 0) body = Buffer.from(body.toString() + `\nself.addEventListener('install', event => event.waitUntil(new Promise(resolve => setTimeout(resolve, 2000))));`);
    const ext = path.split('.').pop();
    res.setHeader('Content-Type', ({ js: 'text/javascript', css: 'text/css', webmanifest: 'application/manifest+json', png: 'image/png', svg: 'image/svg+xml' })[ext] || 'text/html');
    res.setHeader('Vary', 'Origin, X-Offline-Probe');
    res.setHeader('Cache-Control', 'no-store'); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  await page.locator('#install').click(); await page.locator('#install-help[open]').waitFor();
  await page.locator('#install-help button').click();
  await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = async () => { window.installClicked = true; }; dispatchEvent(e); });
  await page.locator('#install').click(); assert.equal(await page.evaluate(() => window.installClicked), true);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  await page.evaluate(async () => {
    localStorage.setItem('pelican-v1', JSON.stringify({ record: 123, totalFish: 42, completed: 2, bests: [300, 400, 0] }));
    const cache = await caches.open('unrelated-site'); await cache.put(location.href, new Response('wrong site'));
  });
  await page.reload(); await page.locator('#play').waitFor();
  deployment = 1;
  await page.locator('#update').click();
  await page.locator('#settings').click();
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).installing));
  assert.ok(!(await page.locator('#toast').textContent()).includes('Kein neues Update'), 'never claim no update while it is downloading');
  await page.waitForFunction(() => document.querySelector('#update').textContent === 'Update verfügbar · neu laden');
  assert.ok(await page.locator('#settings-dialog').isVisible(), 'a pending update waits while a dialog is open');
  await Promise.all([page.waitForEvent('load'), page.locator('.close-settings').click()]);
  assert.equal(await page.locator('#record').textContent(), '123');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pelican-v1')).totalFish), 42);
  assert.equal(await page.evaluate(async () => (await (await caches.match(new URL('manifest.webmanifest', location.href))).json()).description), 'Aktualisierte kleine Auszeit am Meer.');
  await page.screenshot({ path: 'test-results/pwa-menu.png' });
  await page.evaluate(async () => {
    for (const name of await caches.keys()) if (name.startsWith('schnabel-voll-glueck:')) {
      const cache = await caches.open(name);
      await cache.put(location.origin + '/', new Response('<h1>Alte Pelican-Version</h1>', { headers: { 'Content-Type': 'text/html' } }));
    }
  });
  await page.goto(url); await page.getByRole('heading', { name: 'Alte Pelican-Version' }).waitFor();
  await page.goto(url + 'aktualisieren.html'); await page.locator('#refresh').click();
  await page.locator('#play').waitFor();
  assert.equal(await page.locator('h1').textContent(), 'Schnabelglück');
  assert.equal(await page.locator('#record').textContent(), '123');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pelican-v1')).totalFish), 42);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  await page.context().setExtraHTTPHeaders({ 'X-Offline-Probe': 'reopened' });
  await page.context().setOffline(true); await page.reload();
  assert.equal(await page.locator('#stages').inputValue(), '2');
  await page.locator('#play').click();
  assert.ok(await page.locator('#hud').isVisible());
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pelican-v1')).completed), 2);
  await page.context().setOffline(false);
  console.log('Offline restart preserves unlocked stage');
  console.log('Stale cached page recovered; records and fish preserved');
  console.log('Install fallback, install action, scoped cache, automatic menu update after dialog close and preserved records passed');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await rm(fixture, { recursive: true, force: true }); }
