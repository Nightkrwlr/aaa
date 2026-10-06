#!/usr/bin/env node
/**
 * e2e-smoke — runs the browser end-to-end scenarios (headless Chromium + software WebGL) and fails on any
 * check failure, page error or crash. Screenshots land in artifacts/shots (git-ignored).
 *
 * usage: node tools/e2e-smoke.mjs [--suite play|panels|dungeon|tour|combat|all] [--size 1280x720]
 *   play    real-input playthrough: boot → lore → move → click-to-move → combat → loot → UI → dialogue → portal → save/load
 *   panels  opens every UI panel on a populated session (visual QA)
 *   dungeon enters each dungeon family through the Resonance Chart and captures key rooms
 *   tour/combat  screenshot tours (never fail unless the page errors)
 * Uses ?fixed=1 (1/30 s per frame) so slow software GL stays deterministic.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const suite = opt('suite', 'play');
const size = opt('size', '1280x720');
const SUITES = {
  play: { script: 'tools/e2e/play.mjs', query: 'e2e=1&autostart=belfry&seed=play&fixed=1&quality=low', wait: 2000, timeout: 900 },
  panels: { script: 'tools/e2e/panels.mjs', query: 'e2e=1&autostart=belfry&seed=panels&fixed=1&quality=low', wait: 2000, timeout: 600 },
  dungeon: { script: 'tools/e2e/dungeon.mjs', query: 'e2e=1&autostart=belfry&seed=dungeons&fixed=1&quality=low', wait: 2000, timeout: 900 },
  tour: { script: 'tools/e2e/tour.mjs', query: 'e2e=1&autostart=belfry&seed=tour&quality=low', wait: 2000, timeout: 600 },
  combat: { script: 'tools/e2e/combat.mjs', query: 'e2e=1&autostart=belfry&seed=combat&quality=low', wait: 2000, timeout: 600 },
};
const names = suite === 'all' ? Object.keys(SUITES) : [suite];
if (names.some((n) => !SUITES[n])) { console.error(`unknown suite "${suite}" (play|panels|dungeon|tour|combat|all)`); process.exit(2); }

mkdirSync('artifacts/shots', { recursive: true });
let failed = 0;
for (const name of names) {
  const s = SUITES[name];
  console.log(`\n── e2e:${name} ──`);
  const r = spawnSync('node', ['tools/shot.mjs', `artifacts/shots/${name}_end.png`, '--script', s.script, '--wait', String(s.wait), '--size', size, '--query', s.query], { encoding: 'utf8', timeout: s.timeout * 1000, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  process.stdout.write(out);
  const crashed = r.status !== 0 || r.error;
  const pageErrors = (out.match(/\[pageerror\]|frame failed/g) ?? []).length;
  const checkFails = (out.match(/^FAIL /gm) ?? []).length;
  const ok = !crashed && !pageErrors && !checkFails && (name !== 'play' || /E2E OK/.test(out));
  console.log(ok ? `✔ e2e:${name} OK` : `✖ e2e:${name} FAILED (exit ${r.status}${r.error ? `, ${r.error.message}` : ''}; ${checkFails} failed checks; ${pageErrors} page errors)`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
