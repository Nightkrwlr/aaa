#!/usr/bin/env node
// Opens the stand-alone art viewer in headless Chromium and runs a script against window.__viewer.
// usage: node tools/viewer-shot.mjs [script=tools/e2e/assets.mjs]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const script = process.argv[2] ?? 'tools/e2e/assets.mjs';
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen(); const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = []; page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); }); page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/tools/viewer/index.html`);
await page.waitForFunction(() => window.__viewer, null, { timeout: 60000 });
const mod = await import(pathToFileURL(resolve(script)).href);
await mod.default({ page, wait: (ms) => page.waitForTimeout(ms), shot: (n) => page.screenshot({ path: n }), logs });
if (logs.length) console.log('LOGS\n' + [...new Set(logs)].slice(0, 20).join('\n'));
await browser.close(); await server.close();
