import { loadRegistry } from '../../src/core/nodeLoader.js';
import { World } from '../../src/sim/world.js';
import { NavGrid } from '../../src/sim/nav.js';
import { createPlayerEntity } from '../../src/sim/player.js';

export const reg = loadRegistry();

export function makeWorld({ seed = 'test', level = 3, size = 80, difficulty = 'seeker' } = {}) {
  const nav = new NavGrid(size, size, 1);
  return new World({ registry: reg, nav, seed, areaLevel: level, difficulty });
}

export function makePlayer(w, classId = 'cls.belfry', level = 3, x = 40, z = 40) {
  const p = w.addPlayer(createPlayerEntity(w, reg.require(classId), level, x, z));
  return p;
}

export function run(w, seconds) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) w.step(1 / 60);
}
