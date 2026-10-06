// Dev tool: ASCII map of a zone (walkability, heights, POIs). usage: node tools/zone-ascii.mjs [zoneId] [step]
import { loadRegistry } from '../src/core/nodeLoader.js';
import { buildZone, validateZone } from '../src/sim/world/zone.js';
const id = process.argv[2] ?? 'zone.calvarre_lower';
const step = Number(process.argv[3] ?? 2);
const z = buildZone(loadRegistry(), id);
const marks = new Map();
const put = (x, zz, ch) => marks.set(`${Math.floor((x - z.bounds.x0) / step)},${Math.floor((zz - z.bounds.z0) / step)}`, ch);
for (const p of z.pois) put(p.x, p.z, p.type === 'waypoint' ? 'W' : p.type === 'dungeon' ? 'D' : p.type === 'arena' ? 'A' : p.type === 'start' ? 'S' : p.type === 'gate' ? 'G' : '*');
for (const n of z.npcs) put(n.x, n.z, 'N');
for (const s of z.def.spawns) put(s.pos[0], s.pos[1], 'e');
for (const s of z.def.bosses) put(s.pos[0], s.pos[1], 'B');
let out = '';
for (let j = 0; j < z.def.size[1] / step; j++) {
  let row = '';
  for (let i = 0; i < z.def.size[0] / step; i++) {
    const m = marks.get(`${i},${j}`);
    if (m) { row += m; continue; }
    const x = z.bounds.x0 + (i + 0.5) * step, zz = z.bounds.z0 + (j + 0.5) * step;
    const blocked = z.nav.isBlockedCell(z.nav.cx(x), z.nav.cz(zz));
    const h = z.heightAt(x, zz);
    row += blocked ? '#' : h > 10 ? '^' : h > 4 ? 'o' : h > 0.8 ? ':' : h < -1.5 ? '_' : '.';
  }
  out += row + '\n';
}
console.log(out);
console.log('errors:', validateZone(z));
