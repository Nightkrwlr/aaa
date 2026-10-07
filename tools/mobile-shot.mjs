#!/usr/bin/env node
/**
 * mobile-shot — runs a script against the game inside an emulated PHONE/TABLET (touch events, DPR, safe areas, mobile UA).
 * usage: node tools/mobile-shot.mjs [script=tools/e2e/mobile.mjs] [--device pixel7|iphone14|se|small|tablet] [--portrait] [--dpr 1] [--query "e2e=1&..."]
 * --dpr overrides the device pixel ratio (layout is in CSS px, so dpr 1 is a much cheaper software-GL run with the same checks)
 * The script receives { page, cdp, touch, wait, shot, logs, device, size } — `touch` drives real CDP touch events (multi-touch aware):
 *   touch.down(id,x,y) · touch.move(id,x,y) · touch.up(id) · touch.tap(x,y) · touch.doubleTap(x,y) · touch.drag(id,[x0,y0],[x1,y1],steps)
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const script = args.find((a) => a.endsWith('.mjs')) ?? 'tools/e2e/mobile.mjs';
const DEVICES = {
  pixel7: { w: 915, h: 412, dpr: 2.625, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36', insets: { top: 24, right: 0, bottom: 0, left: 0 } },
  iphone14: { w: 844, h: 390, dpr: 3, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', insets: { top: 0, right: 47, bottom: 21, left: 47 } },
  se: { w: 667, h: 375, dpr: 2, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1', insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  tablet: { w: 1080, h: 810, dpr: 2, ua: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', insets: { top: 0, right: 0, bottom: 20, left: 0 } },
  small: { w: 640, h: 300, dpr: 2, ua: 'Mozilla/5.0 (Linux; Android 11; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36', insets: { top: 0, right: 0, bottom: 0, left: 0 } },
};
const device = opt('device', 'pixel7'); const D = DEVICES[device];
const portrait = args.includes('--portrait');
const size = portrait ? { width: D.h, height: D.w } : { width: D.w, height: D.h };
const insets = portrait ? { top: D.insets.top || 40, right: 0, bottom: D.insets.bottom, left: 0 } : D.insets;
const query = opt('query', 'e2e=1&autostart=belfry&seed=mobile&fixed=1&quality=low');

const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen(); const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: size, screen: size, deviceScaleFactor: Number(opt('dpr', D.dpr)), isMobile: true, hasTouch: true, userAgent: D.ua });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack?.split('\n').slice(0, 4).join('\n')}`));
const cdp = await ctx.newCDPSession(page);

// real multi-touch through CDP (Chromium turns these into touch + pointer events)
const pts = new Map();
const send = (type, timestamp) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.values()].map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 0.6 })), ...(timestamp ? { timestamp } : {}) });
const touch = {
  clock: 0,
  async down(id, x, y) { pts.set(id, { id, x, y }); await send('touchStart'); },
  async move(id, x, y) { const p = pts.get(id); if (!p) return; p.x = x; p.y = y; await send('touchMove'); },
  async up(id) { pts.delete(id); await send('touchEnd'); },
  // taps carry explicit event times (50 ms apart) so a slow software-GL frame cannot stretch them into long presses
  // `after` (seconds) chains a tap onto the previous one on the event clock, however long the software renderer took to get here
  async tap(x, y, id = 90, after = null) { const t = after != null && touch.clock ? touch.clock + after : Date.now() / 1000; touch.clock = t + 0.05; pts.set(id, { id, x, y }); await send('touchStart', t); pts.delete(id); await send('touchEnd', t + 0.05); },
  // two taps 140 ms apart on the *event* clock, however slowly the software renderer lets the CDP calls through
  async doubleTap(x, y, id = 91) { const t = Date.now() / 1000; for (const d of [0, 0.14]) { pts.set(id, { id, x, y }); await send('touchStart', t + d); pts.delete(id); await send('touchEnd', t + d + 0.05); } },
  async drag(id, [x0, y0], [x1, y1], steps = 8) { await touch.down(id, x0, y0); for (let i = 1; i <= steps; i++) await touch.move(id, x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); },
};

// emulate the notch / home-indicator safe areas: expose them as CSS env() via an injected style on :root vars used by mobile.css
await page.addInitScript((ins) => {
  const apply = () => { const r = document.documentElement; if (!r) return; r.style.setProperty('--sat', `${ins.top}px`); r.style.setProperty('--sar', `${ins.right}px`); r.style.setProperty('--sab', `${ins.bottom}px`); r.style.setProperty('--sal', `${ins.left}px`); };
  new MutationObserver(apply).observe(document, { childList: true, subtree: true }); document.addEventListener('DOMContentLoaded', apply); apply();
}, insets);

await page.goto(`http://127.0.0.1:${port}/?${query}`);
await page.waitForFunction(() => window.__game?.running, null, { timeout: 90000 }).catch((e) => logs.push(`[boot] ${e.message}`));
await page.waitForTimeout(1500);
const wait = async (ms) => { const n = Math.max(1, Math.ceil(ms / 33)); const f0 = await page.evaluate(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 180000, polling: 50 }); };
const mod = await import(pathToFileURL(resolve(script)).href);
const failed = await mod.default({ page, cdp, touch, wait, shot: (n) => page.screenshot({ path: n }), logs, device, size, insets, D });
if (logs.length) console.log('LOGS\n' + [...new Set(logs)].slice(0, 25).join('\n'));
await browser.close(); await server.close();
process.exit(failed ? 1 : 0);
