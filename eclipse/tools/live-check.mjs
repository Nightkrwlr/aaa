#!/usr/bin/env node
// carga la URL REAL en Chromium (por el proxy de salida), arranca partida y captura; informa de errores de consola y de red
import { chromium } from './_pw.mjs';
const url = process.argv[2], out = process.argv[3], dev = process.argv[4] || 'desktop';
const D = { desktop: { w: 960, h: 540, dpr: 1, mobile: false }, pixel7: { w: 915, h: 412, dpr: 1, mobile: true, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' } }[dev];
const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:37723' }, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: D.dpr, isMobile: D.mobile, hasTouch: D.mobile, ...(D.ua ? { userAgent: D.ua } : {}) });
const page = await ctx.newPage();
const logs = [], fails = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => fails.push(`${r.url().slice(0, 120)} ← ${r.failure()?.errorText}`));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 300000 });
console.log('load', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'title:', await page.title());
await page.waitForSelector('#loading', { state: 'detached', timeout: 300000 });
await page.waitForFunction(() => window.__G?.R, null, { timeout: 120000 });
console.log('juego listo', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}-menu.png` });
await page.click('text=Nueva partida'); await page.waitForTimeout(600); await page.click('#mGo'); await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}-juego.png` });
const st = await page.evaluate(() => ({ started: window.__G.started, hp: window.__G.player.hp, q: window.__G.R.quality, hdr: window.__G.R.post?.hdr, msaa: window.__G.R.post?.msaa, fxaa: window.__G.R.post?.uniforms?.uFxaa?.value }));
console.log('estado', JSON.stringify(st));
const manifest = await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); if (!l) return 'sin <link rel=manifest>'; const r = await fetch(l.href); return `${r.status} ${r.headers.get('content-type')} ${(await r.json()).name}`; });
console.log('manifiesto', manifest);
console.log('fallos de red:', fails.length ? [...new Set(fails)].join('\n  ') : 'ninguno');
console.log('logs:', logs.length ? [...new Set(logs)].join('\n  ') : 'ninguno');
await browser.close();
