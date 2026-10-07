#!/usr/bin/env node
/**
 * shot — arranca Operación Eclipse en Chromium (GL por software), empieza una partida y ejecuta un guion.
 *
 *   node tools/shot.mjs [--html dist/eclipse.html] [--scenario tools/scenarios/tour.mjs] [--out /ruta/salida]
 *                       [--device desktop|pixel7|iphone14|se|tablet] [--portrait] [--dpr 1] [--quality low|medium|high]
 *                       [--tag nombre]   prefijo para los ficheros   [--size 960x540]  [--seed N]
 *
 * El guion (export default async (ctx) => …) recibe:
 *   page, ev(fn,arg), wait(frames), shot(name), G() → estado del juego (window.__G),
 *   teleport(x,z), region(key), setTime(0..1), setWeather?, spawn(kind,x,z,lvl), step(n,dt), logs, size, device
 * Las regiones se identifican con la clave de De[]: valle, ciudad, desierto, … (ver src/game/09-regions.js).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, ROOT } from './_pw.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const htmlPath = path.resolve(ROOT, opt('html', 'dist/eclipse.html'));
const scenarioPath = path.resolve(ROOT, opt('scenario', 'tools/scenarios/tour.mjs'));
const outDir = path.resolve(opt('out', path.join(ROOT, '../artifacts/eclipse-shots')));
const tag = opt('tag', path.basename(scenarioPath, '.mjs'));
const portrait = args.includes('--portrait');
const DEVICES = {
  desktop: { w: 1280, h: 720, dpr: 1, mobile: false },
  pixel7: { w: 915, h: 412, dpr: 2.625, mobile: true, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' },
  iphone14: { w: 844, h: 390, dpr: 3, mobile: true, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' },
  se: { w: 667, h: 375, dpr: 2, mobile: true, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' },
  tablet: { w: 1080, h: 810, dpr: 2, mobile: true, ua: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' },
};
const deviceName = opt('device', 'desktop');
const D = DEVICES[deviceName];
let size = portrait && D.mobile ? { width: D.h, height: D.w } : { width: D.w, height: D.h };
if (opt('size', null)) { const [w, h] = opt('size').split('x').map(Number); size = { width: w, height: h }; }   // p. ej. --size 960x540 (más rápido en GL por software)
const dpr = Number(opt('dpr', D.dpr));
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(htmlPath);
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); }).listen(0, '127.0.0.1');
await new Promise((r) => server.on('listening', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: size, screen: size, deviceScaleFactor: dpr, isMobile: D.mobile, hasTouch: D.mobile, ...(D.ua ? { userAgent: D.ua } : {}) });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 400)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
await page.route('**/*', (route) => (route.request().url().startsWith(`http://127.0.0.1:${port}`) ? route.continue() : route.abort()));

// determinismo: Math.random con semilla (las capturas "antes/después" deben ser comparables)
const seed = Number(opt('seed', 1));
await page.addInitScript((s0) => { window.__SEED = (s0 * 2654435761) >>> 0 || 1; let s = window.__SEED; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }, seed);
const ev = (fn, arg) => page.evaluate(fn, arg);
// toques reales multitáctiles por CDP (solo en dispositivos móviles emulados)
const cdp = D.mobile ? await ctx.newCDPSession(page) : null;
const pts = new Map();
const sendTouch = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.values()].map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 0.6 })) });
const touch = D.mobile ? {
  async down(id, x, y) { pts.set(id, { id, x, y }); await sendTouch('touchStart'); },
  async move(id, x, y) { const p = pts.get(id); if (!p) return; p.x = x; p.y = y; await sendTouch('touchMove'); },
  async up(id) { pts.delete(id); await sendTouch('touchEnd'); },
  async tap(x, y, id = 90) { pts.set(id, { id, x, y }); await sendTouch('touchStart'); pts.delete(id); await sendTouch('touchEnd'); },
  async drag(id, [x0, y0], [x1, y1], steps = 8) { await touch.down(id, x0, y0); for (let i = 1; i <= steps; i++) await touch.move(id, x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); },
} : null;
const wait = (frames = 10) => page.evaluate((n) => new Promise((r) => { let c = 0; const f = () => (++c >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), frames);
const shot = async (name) => { const p = path.join(outDir, `${tag}-${name}.png`); await page.screenshot({ path: p }); console.log('shot', path.relative(process.cwd(), p)); return p; };
const G = () => ev(() => window.__G);
const api = {
  page, ev, wait, shot, logs, size, touch, cdp, device: deviceName, outDir, tag, portrait, quality: opt('quality', null),
  async boot({ cls = 'Astronaut_FinnTheFrog', name = 'Espectro' } = {}) {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForSelector('#loading', { state: 'detached', timeout: 240000 });
    await page.waitForFunction(() => window.__G?.R, null, { timeout: 60000 });
    await page.waitForTimeout(800);
  },
  async newGame({ char = 0, difficulty = null } = {}) {
    await page.click('text=Nueva partida'); await page.waitForTimeout(500);
    if (char) await page.click(`[data-c]:nth-of-type(${char + 1})`).catch(() => {});
    await page.click('#mGo'); await page.waitForTimeout(1500);
    if (api.quality) await ev((q) => { window.__G.S.settings.quality = q; window.__G.R.setQuality(q); }, api.quality);
    await wait(20);
  },
  async teleport(x, z) { await ev(([x, z]) => { const G = window.__G; G.world.loadWorld({ x, z }); }, [x, z]); await wait(30); },
  async region(key) {
    const c = await ev((key) => window.__regionCenter?.(key) ?? null, key);
    if (!c) throw new Error('región desconocida o ganchos __regionCenter ausentes: ' + key);
    await api.teleport(c.x, c.z); return c;
  },
  async setTime(t) { await ev((t) => { window.__G.S.time = t; }, t); await wait(60); },
  /** invulnerable (x.uiBlockDamage): para auditar regiones de nivel alto sin morir */
  async god(on = true) { await ev((o) => { window.__G.uiBlockDamage = o; }, on); },
  /** congela la simulación (x.paused): las capturas son estáticas y comparables */
  async freeze(on = true) { await ev((o) => { window.__G.paused = o; }, on); await wait(2); },
  /** captura «quieta»: HUD oculto (o no), simulación congelada un instante, sin diálogos */
  async still(name, { ui = false, settle = 6 } = {}) {
    await api.hideUi(!ui); await wait(settle); await api.freeze(true); await wait(3);
    const p = await shot(name); await api.freeze(false); await api.hideUi(false); return p;
  },
  async hideUi(hide = true) { await ev((h) => { document.getElementById('hud').style.visibility = h ? 'hidden' : ''; document.getElementById('ov').style.visibility = h ? 'hidden' : ''; document.getElementById('toasts').style.display = h ? 'none' : ''; }, hide); },
  // OJO: el gancho del juego es window.__spawn(tipo, NIVEL, x, z, opciones); aquí se expone con el orden natural (tipo, x, z, nivel, opciones)
  async spawn(kind, x, z, lvl = 1, opts = {}) { return ev(([k, x, z, l, o]) => { const e = window.__spawn(k, l, x, z, o); return !!e; }, [kind, x, z, lvl, opts]); },
  /** presupuesto de render de UN fotograma completo (todas las pasadas del composer): llamadas, triángulos, programas, texturas */
  async perf() {
    return ev(async () => {
      const r = window.__G.R.r, info = r.info; info.autoReset = false;
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      info.reset(); await new Promise((res) => requestAnimationFrame(res));
      const out = { calls: info.render.calls, triangles: info.render.triangles, lines: info.render.lines, points: info.render.points, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0 };
      info.autoReset = true; return out;
    });
  },
  async step(n, dt = 1 / 30) { await ev(([n, dt]) => window.__step(n, dt), [n, dt]); },
};

const mod = await import(pathToFileURL(scenarioPath).href);
let code = 0;
try { await mod.default(api); } catch (e) { console.error('scenario failed:', e); code = 1; }
if (logs.length) console.log('LOGS\n' + [...new Set(logs)].slice(0, 20).join('\n'));
await browser.close(); server.close();
process.exit(code);
