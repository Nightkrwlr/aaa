import test from 'node:test';
import assert from 'node:assert/strict';
import { NavGrid } from '../src/sim/nav.js';

test('A* finds a path around a wall and smooths it', () => {
  const nav = new NavGrid(40, 40, 1);
  nav.blockRect(18, 5, 20, 34);
  const p = nav.findPath(5, 20, 35, 20);
  assert.ok(p && p.length >= 2);
  // never passes through a blocked cell
  let prev = { x: 5, z: 20 };
  for (const w of p) { assert.ok(nav.los(prev.x, prev.z, w.x, w.z, 0.3)); prev = w; }
  assert.ok(Math.hypot(prev.x - 35, prev.z - 20) < 1.5);
});

test('unreachable goal returns null; blocked goal snaps to nearest', () => {
  const nav = new NavGrid(30, 30, 1);
  nav.blockRect(0, 14, 29, 15); // full wall
  assert.equal(nav.findPath(3, 3, 3, 25), null);
  const nav2 = new NavGrid(30, 30, 1);
  nav2.blockRect(10, 10, 12, 12);
  const p = nav2.findPath(2, 2, 11, 11);
  assert.ok(p);
});

test('circle collision slides along walls and never tunnels', () => {
  const nav = new NavGrid(20, 20, 1);
  nav.blockRect(10, 0, 10.9, 19);
  const e = { x: 8, z: 5 };
  nav.moveCircle(e, 30, 1.5, 0.4); // very fast shove into wall
  assert.ok(e.x <= 10 - 0.39, `x=${e.x}`);
  assert.ok(e.z > 5);
});

test('performance: 200 paths on 160x160 grid under 1.5s', () => {
  const nav = new NavGrid(160, 160, 1);
  for (let i = 0; i < 40; i++) nav.blockRect(10 + i * 3, 20, 11 + i * 3, 120);
  const t0 = performance.now();
  let ok = 0;
  for (let i = 0; i < 200; i++) if (nav.findPath(2, 2 + (i % 100), 158, 150 - (i % 100) * 0.5)) ok++;
  const dt = performance.now() - t0;
  assert.ok(ok > 150);
  assert.ok(dt < 1500, `paths took ${dt}ms`);
});
