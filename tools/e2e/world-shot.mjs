// Same contract as tools/shot.mjs, but built for long art-direction runs on software GL:
//  - Vite HMR / file watching are OFF (editing a source file while a tour runs must not reload the page under the script),
//  - generous timeouts, console warnings are echoed live (shader compile errors show up immediately).
// usage: node tools/e2e/world-shot.mjs out.png --script tools/e2e/world.mjs [--wait ms] [--size 1280x720] [--query "e2e=1&autostart=belfry&seed=world&fixed=1&quality=high"]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const out = args[0] ?? 'shot.png';
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const wait = Number(opt('wait', 2500));
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const query = opt('query', 'e2e=1&autostart=belfry&seed=world&fixed=1&quality=high');
const script = opt('script', 'tools/e2e/world.mjs');
const quiet = args.includes('--quiet');

const server = await createServer({ server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(300000);
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) { const t = m.text(); if (/toNonIndexed/.test(t)) return; logs.push(`[${m.type()}] ${t}`); if (!quiet) console.log(`[page ${m.type()}] ${t.slice(0, 500)}`); } });
page.on('pageerror', (e) => { logs.push(`[pageerror] ${e.message}`); console.log(`[pageerror] ${e.message}\n${e.stack?.split('\n').slice(0, 4).join('\n')}`); });
try {
  await page.goto(`http://127.0.0.1:${port}/?${query}`);
  await page.waitForFunction(() => window.__game?.running, null, { timeout: 120000 }).catch((e) => logs.push(`[boot] ${e.message}`));
  await page.waitForTimeout(wait);
  if (script) {
    const mod = await import(pathToFileURL(resolve(script)).href);
    await mod.default({ page, wait: (ms) => page.waitForTimeout(ms), shot: (n) => page.screenshot({ path: n, timeout: 300000 }), logs });
  }
  await page.screenshot({ path: out, timeout: 300000 });
  const info = await page.evaluate(() => window.__game ? ({ fps: window.__game.fps.toFixed(1), entities: window.__game.world.entities.length, calls: window.__game.scene3d.renderer.info.render.calls, tris: window.__game.scene3d.renderer.info.render.triangles }) : null).catch(() => null);
  console.log('INFO', JSON.stringify(info));
} finally {
  await browser.close();
  await server.close();
}
