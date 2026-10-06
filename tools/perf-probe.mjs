#!/usr/bin/env node
/**
 * perf-probe — render budget probe: draw calls, triangles, GPU resources, scene size, JS heap and frame cost,
 * per quality preset and per scenario (quiet settlement · open field · field with a horde).
 *
 * Software GL (SwiftShader) cannot tell real GPU time, but draw calls / triangles / programs / textures are hardware-independent
 * proxies for what a phone's driver and tile GPU pay for, and they are the numbers that regress silently when art is added.
 * `ms` is the software-rendered frame cost: only compare it between runs of this tool, never read it as a phone's frame time.
 *
 * usage: node tools/perf-probe.mjs [--preset low,medium,high] [--size 915x412] [--dpr 1] [--frames 24] [--strict] [--json out.json]
 *   --strict  exit 1 when a preset goes over its budget (BUDGET below; the numbers a mid-range phone can carry at 30–60 fps)
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const presets = opt('preset', 'low,medium,high').split(',');
const [W, H] = opt('size', '915x412').split('x').map(Number);
const dpr = Number(opt('dpr', 1));
const FRAMES = Number(opt('frames', 24));
const strict = args.includes('--strict');

// per-frame ceilings, shadow passes and post-processing included; "low" must be comfortable on a 2019 mid-range phone.
// Baseline of the procedural-model build (before the glTF art): low 67–405 calls / 247k tris, medium 330–944 calls — the horde is what breaks it.
const BUDGET = {
  low:    { calls: 220, tris: 260_000, programs: 24, textures: 60 },
  medium: { calls: 380, tris: 450_000, programs: 32, textures: 90 },
  high:   { calls: 650, tris: 900_000, programs: 40, textures: 120 },
};

const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen(); const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] });

const rows = []; const logs = [];
for (const preset of presets) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[${preset}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[${preset}] pageerror ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/?e2e=1&autostart=belfry&seed=perf&fixed=1&quality=${preset}`);
  await page.waitForFunction(() => window.__game?.running, null, { timeout: 120000 }).catch((e) => logs.push(`[${preset}] boot ${e.message}`));
  await page.waitForFunction(() => window.__game?.assetsReady ? window.__game.assetState?.ready || window.__game.assetState?.failed : true, null, { timeout: 120000 }).catch(() => {});
  const frames = (n) => page.evaluate((k) => new Promise((res) => { const g = window.__game, t = g.frames + k; const id = setInterval(() => { if (g.frames >= t) { clearInterval(id); res(); } }, 16); }), n);
  await frames(30);

  const measure = async (name) => {
    await frames(20);                                                   // let the camera, streaming and particles settle
    await page.evaluate(() => { const i = window.__game.scene3d.renderer.info; i.autoReset = false; i.reset(); window.__t0 = performance.now(); });
    await frames(FRAMES);
    const r = await page.evaluate((n) => {
      const g = window.__game, rd = g.scene3d.renderer, i = rd.info, dt = performance.now() - window.__t0;
      let objects = 0, meshes = 0, skinned = 0, lights = 0, shadowCasters = 0, instanced = 0;
      g.scene3d.scene.traverse((o) => {
        objects++;
        if (o.isLight) lights++;
        if (o.isMesh || o.isPoints || o.isLine) { if (o.visible) meshes++; if (o.isSkinnedMesh) skinned++; if (o.isInstancedMesh) instanced++; if (o.castShadow) shadowCasters++; }
      });
      const out = {
        calls: Math.round(i.render.calls / n), tris: Math.round(i.render.triangles / n), points: Math.round(i.render.points / n),
        programs: i.programs?.length ?? 0, geometries: i.memory.geometries, textures: i.memory.textures,
        objects, meshes, skinned, instanced, lights, shadowCasters,
        entities: g.world.entities.length, ms: +(dt / n).toFixed(1),
        heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(0) : null,
        px: `${rd.domElement.width}x${rd.domElement.height}`,
      };
      i.autoReset = true; return out;
    }, FRAMES);
    rows.push({ preset, scenario: name, ...r });
  };

  await measure('settlement');
  // open field with trees: same spot the combat e2e uses
  await page.evaluate(() => { const g = window.__game, p = g.player; p.x = -24; p.z = 14; g.rig.initialised = false; p.stats.add('godmode', [{ stat: 'life', op: 'flat', value: 99999 }]); g.world.refreshLife(p, true); for (const e of g.world.entities) if (e.team === 'enemy') { e.dead = true; e.removed = true; } });
  await measure('field');
  await page.evaluate(() => {
    const g = window.__game, w = g.world, p = g.player;
    const ids = ['enm.hollow_shieldbearer', 'enm.cracked_cantor', 'enm.hollow_chorister', 'enm.crackhide_boar', 'enm.chime_spitter', 'enm.keening_wisp'];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = 4 + (i % 4) * 1.6; try { w.spawnEnemy(ids[i % ids.length], p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, { level: 3 }); } catch { /* id removed by a content change: skip */ } }
  });
  await measure('horde');
  await ctx.close();
}
await browser.close(); await server.close();

// ── report
const cols = ['preset', 'scenario', 'calls', 'tris', 'programs', 'textures', 'geometries', 'meshes', 'skinned', 'lights', 'shadowCasters', 'entities', 'px', 'heapMB', 'ms'];
const pad = (v, n) => String(v ?? '-').padEnd(n);
console.log(cols.map((c) => pad(c, c === 'scenario' ? 11 : c === 'px' ? 10 : 8)).join(''));
for (const r of rows) console.log(cols.map((c) => pad(r[c], c === 'scenario' ? 11 : c === 'px' ? 10 : 8)).join(''));

let over = 0;
for (const r of rows) {
  const b = BUDGET[r.preset]; if (!b) continue;
  for (const k of Object.keys(b)) if (r[k] > b[k]) { over++; console.log(`OVER BUDGET  ${r.preset}/${r.scenario}: ${k} ${r[k]} > ${b[k]}`); }
}
if (logs.length) console.log('LOGS\n' + [...new Set(logs)].slice(0, 12).join('\n'));
const json = opt('json', null); if (json) writeFileSync(json, JSON.stringify(rows, null, 2));
console.log(over ? `\n${over} budget violation(s)` : '\nall presets within budget');
process.exit(strict && over ? 1 : 0);
