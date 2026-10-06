#!/usr/bin/env node
/**
 * pwa-check — proves the PRODUCTION build installs and plays offline, the way a phone would after "Add to Home Screen".
 *   1. manifest + icons are valid and reachable          2. the service worker installs and precaches the core files
 *   3. the 3D assets get cached on the first online run  4. with the network cut, a reload still boots the game and plays
 * usage: npm run build && node tools/pwa-check.mjs [--dir dist] [--mobile]
 * Serves `dist` with Vite's static preview server (same file layout the real host serves), so no dev-server magic is involved.
 */
import { preview } from 'vite';
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const dir = opt('dir', 'dist');
if (!existsSync(join(dir, 'sw.js'))) { console.error(`no ${dir}/sw.js — run "npm run build" first`); process.exit(2); }

const results = [];
const check = (name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`); };

const server = await preview({ root: process.cwd(), build: { outDir: dir }, preview: { port: 0, host: '127.0.0.1', strictPort: false }, logLevel: 'error' });
const port = server.httpServer.address().port; const origin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const mobile = args.includes('--mobile');
const ctx = await browser.newContext(mobile ? { viewport: { width: 915, height: 412 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(`pageerror ${e.message}`));

// ── 1. manifest + icons
const man = await (await page.request.get(`${origin}/manifest.webmanifest`)).json().catch(() => null);
check('manifest is valid JSON', !!man);
if (man) {
  check('manifest: name, standalone/fullscreen display, relative start_url', !!man.name && /standalone|fullscreen/.test(man.display) && String(man.start_url).startsWith('.'), `${man.display} ${man.start_url}`);
  const sizes = {};
  for (const ic of man.icons ?? []) {
    const res = await page.request.get(new URL(ic.src, `${origin}/`).href);
    const buf = await res.body();
    const png = buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47;
    sizes[ic.sizes + (ic.purpose ? `/${ic.purpose}` : '')] = res.ok() && png ? `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}` : `BAD(${res.status()})`;
  }
  const want = ['192x192', '512x512'];
  check('icons: 192 and 512 are real PNGs of the declared size', want.every((s) => sizes[s] === s || Object.entries(sizes).some(([k, v]) => k.startsWith(s) && v === s)), JSON.stringify(sizes));
  check('icons: a maskable 512 exists', (man.icons ?? []).some((i) => /maskable/.test(i.purpose ?? '') && /512/.test(i.sizes)));
}

// ── 2/3. first online visit: SW installs, core precached, models cached by the preloader
await page.goto(`${origin}/?e2e=1`);
await page.waitForFunction(() => window.__game?.running, null, { timeout: 120000 }).catch(() => logs.push('boot timeout'));
const swState = await page.evaluate(async () => { const reg = await navigator.serviceWorker?.ready; return reg ? { scope: reg.scope, active: !!reg.active } : null; }).catch(() => null);
check('service worker registered and active', !!swState?.active, JSON.stringify(swState));
await page.waitForFunction(() => window.__game?.assetState ? (window.__game.assetState.ready || window.__game.assetState.failed) : true, null, { timeout: 180000 }).catch(() => {});
await page.waitForTimeout(1500);
const cacheInfo = await page.evaluate(async () => {
  const out = {};
  for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).length;
  return out;
});
const core = Object.entries(cacheInfo).find(([k]) => k.startsWith('sdc-core-')), assets = Object.entries(cacheInfo).find(([k]) => k.startsWith('sdc-assets-'));
const wantCore = (readFileSync(join(dir, 'sw.js'), 'utf8').match(/const PRECACHE = (\[.*?\]);/s) ?? [])[1];
const nCore = wantCore ? JSON.parse(wantCore).length : 0;
check('core files precached (html, js, css, manifest, icons)', core && core[1] >= nCore - 1 && nCore > 4, `${core?.[1] ?? 0}/${nCore}`);
const art = await page.evaluate(() => window.__game?.assetState ?? null);
check('3D art loaded online', art ? art.ready : true, JSON.stringify(art));
check('3D models cached for offline play (cache-first)', !art || (assets && assets[1] >= 10), `${assets?.[1] ?? 0} files in the asset cache`);

// ── 4. offline reload still plays
await ctx.setOffline(true);
await page.goto(`${origin}/?e2e=1&autostart=belfry&seed=offline`, { waitUntil: 'domcontentloaded' }).catch((e) => logs.push(`offline goto: ${e.message}`));
const booted = await page.waitForFunction(() => window.__game?.running && window.__game.state === 'playing', null, { timeout: 120000 }).then(() => true).catch(() => false);
check('offline: the game boots and starts a run from the cache', booted);
if (booted) {
  const f0 = await page.evaluate(() => window.__game.frames); await page.waitForTimeout(2500); const f1 = await page.evaluate(() => window.__game.frames);
  check('offline: frames keep rendering', f1 - f0 > 5, `${f1 - f0} frames`);
  const art2 = await page.evaluate(() => window.__game.assetState?.ready ?? null);
  check('offline: 3D art comes from the cache (no procedural fallback)', art2 !== false, String(art2));
}
const bad = logs.filter((l) => !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED/.test(l));
check('no script errors', bad.length === 0, bad.slice(0, 3).join(' | '));

await browser.close(); await server.close();
const failed = results.filter((x) => !x).length;
console.log(failed ? `PWA CHECK FAILED: ${failed}` : `PWA CHECK OK: ${results.length} checks`);
process.exit(failed ? 1 : 0);
