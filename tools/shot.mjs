// Dev tool: boots the Vite dev server, opens the game in headless Chromium (SwiftShader WebGL),
// optionally runs a script against window.__game, and saves screenshots.
// usage: node tools/shot.mjs out.png [--script file.mjs] [--wait ms] [--size 1280x720] [--query "class=belfry"]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const out = args[0] ?? 'shot.png';
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const wait = Number(opt('wait', 4000));
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const query = opt('query', 'e2e=1');
const script = opt('script', null);

const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack?.split('\n').slice(0, 4).join('\n')}`));
await page.goto(`http://127.0.0.1:${port}/?${query}`);
await page.waitForFunction(() => window.__game?.running, null, { timeout: 60000 }).catch((e) => logs.push(`[boot] ${e.message}`));
await page.waitForTimeout(wait);
if (script) {
  const mod = await import(pathToFileURL(resolve(script)).href);
  await mod.default({ page, wait: (ms) => page.waitForTimeout(ms), shot: (n) => page.screenshot({ path: n }), logs });
}
await page.screenshot({ path: out });
const info = await page.evaluate(() => window.__game ? ({ fps: window.__game.fps.toFixed(1), entities: window.__game.world.entities.length, calls: window.__game.scene3d.renderer.info.render.calls, tris: window.__game.scene3d.renderer.info.render.triangles }) : null).catch(() => null);
console.log('INFO', JSON.stringify(info));
if (logs.length) console.log('LOGS\n' + [...new Set(logs)].slice(0, 25).join('\n'));
await browser.close();
await server.close();
