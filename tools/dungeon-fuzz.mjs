// Fuzz the procedural dungeon generator: many seeds × families × sizes × objectives. Reports failures and stats.
// usage: node tools/dungeon-fuzz.mjs [count=60] [--ascii] [--seed prefix]
import { loadRegistry } from '../src/core/nodeLoader.js';
import { generateDungeon } from '../src/sim/dungeon/index.js';

const reg = loadRegistry();
const count = Number(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 60);
const seedPrefix = process.argv.includes('--seed') ? process.argv[process.argv.indexOf('--seed') + 1] : 'fuzz';
const families = reg.all('dungeonFamily').map((f) => f.id);
const objectives = reg.all('dungeonObjective').map((o) => o.id);
const sizes = ['small', 'medium', 'large'];
const stats = { total: 0, ok: 0, failed: 0, attempts: 0, rooms: 0, tiles: 0, ms: 0, byFamily: {}, failures: [] };
for (const fam of families) {
  stats.byFamily[fam] = { ok: 0, fail: 0, attempts: 0 };
  for (let i = 0; i < count; i++) {
    const spec = { family: fam, seed: `${seedPrefix}-${fam}-${i}`, size: sizes[i % 3], objective: objectives[i % objectives.length], ilvl: 1 + (i % 15) };
    const t0 = performance.now();
    const r = generateDungeon(reg, spec);
    stats.ms += performance.now() - t0; stats.total++;
    stats.attempts += r.attempts; stats.byFamily[fam].attempts += r.attempts;
    if (r.ok) {
      stats.ok++; stats.byFamily[fam].ok++; stats.rooms += r.dungeon.rooms.size; stats.tiles += r.dungeon.map.w * r.dungeon.map.h;
      if (process.argv.includes('--ascii') && i === 0) console.log(`\n=== ${fam} ${spec.size} ${spec.objective} seed ${spec.seed} (attempt ${r.dungeon.attempt}) ===\n${r.dungeon.map.ascii()}`);
    } else { stats.failed++; stats.byFamily[fam].fail++; stats.failures.push({ spec, errors: r.errors.slice(-3) }); }
  }
}
console.log(JSON.stringify({ ...stats, failures: undefined, avgMs: (stats.ms / stats.total).toFixed(1), avgAttempts: (stats.attempts / stats.total).toFixed(2), avgRooms: (stats.rooms / Math.max(1, stats.ok)).toFixed(1) }, null, 1));
if (stats.failures.length) { console.log('FAILURES (first 8):'); for (const f of stats.failures.slice(0, 8)) console.log(JSON.stringify(f)); process.exit(1); }
