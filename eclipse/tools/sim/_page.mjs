// Ayudante común de las simulaciones: sirve dist/eclipse.html, lo abre en Chromium y ejecuta código en la página.
// No renderiza nada útil: solo necesita que el juego evalúe sus fragmentos para exponer window.__eco.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, ROOT } from '../_pw.mjs';

export async function withPage(fn, { html = 'dist/eclipse.html', seed = 7 } = {}) {
  const arg = process.argv.indexOf('--html');
  const file = path.resolve(ROOT, arg >= 0 ? process.argv[arg + 1] : html);
  const buf = fs.readFileSync(file);
  const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(buf); }).listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
  const port = server.address().port;
  await page.route('**/*', (route) => (route.request().url().startsWith(`http://127.0.0.1:${port}`) ? route.continue() : route.abort()));
  await page.addInitScript((s0) => { window.__SEED = s0; }, seed);
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__eco, null, { timeout: 120000 });
  try { return await fn(page, errors); } finally { await browser.close(); server.close(); }
}
