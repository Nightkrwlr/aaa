#!/usr/bin/env node
/**
 * pack-sim — how much does an opening pack fight cost? A scripted player (the same Bot the balance simulator uses) fights each
 * encounter template at the level the zone places it, in open ground, and we report clear time, potions and damage taken as a
 * share of max life. This is the number behind "does the first hour feel fair": a standard pack should cost roughly a quarter of
 * your life, a hard one (shields, constructs) up to two thirds, and nothing in the first levels should be a coin flip.
 *
 * usage: node tools/pack-sim.mjs [--class belfry,prismatist,skirmisher] [--skill 0.85] [--seeds 3] [--offset 0] [--strict]
 *        --offset n   player level = encounter level + n (0 = exactly on level, the usual first visit)
 *        --strict     exit 1 when a standard pack costs more than 45 % of life on average, or any fight is lost
 */
import { makeSession, teleport } from '../tests/helpers/session.js';
import { Bot } from '../src/sim/bot.js';
import { composeEncounter } from '../src/sim/director/encounters.js';
import { Rng } from '../src/core/rng.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const classes = opt('class', 'belfry,prismatist,skirmisher').split(','), skill = Number(opt('skill', 0.85)), seeds = Number(opt('seeds', 3)), off = Number(opt('offset', 0));
const strict = args.includes('--strict');
// [template, level, kind] — the packs of the opening zone (kind 'std' must stay cheap, 'hard' has shields / constructs)
const TEMPLATES = [['enc.first_blood', 1, 'std'], ['enc.hollow_walkers', 2, 'std'], ['enc.spit_and_shamble', 2, 'std'], ['enc.whispers_in_wind', 3, 'std'], ['enc.bull_run', 3, 'std'], ['enc.bell_and_blast', 4, 'std'], ['enc.fortified_line', 3, 'hard'], ['enc.construct_guard', 4, 'hard']];

function fight(cls, tpl, level, seed) {
  const s = makeSession({ seed: `pk-${seed}`, classId: `cls.${cls}`, level: level + off });
  const w = s.world, p = s.player, ch = s.character;
  let guard = 12; while (ch.talentPoints() > 0 && guard-- > 0) { const c = [...ch.tree.nodes.values()].find((n) => n.kind !== 'keystone' && ch.tree.canAllocate(ch.alloc, n.id, { points: ch.talentPoints(), level: ch.level }).ok); if (!c) break; s.allocateTalent?.(c.id) ?? ch.alloc.add(c.id); }
  for (const e of w.entities) if (e.team === 'enemy') { e.dead = true; e.removed = true; }
  const list = composeEncounter(w.registry, tpl, new Rng(`pk-${seed}`), { level, difficulty: 'seeker' });
  const cx = -30, cz = 20;                                          // open ground of the opening zone
  teleport(s, cx - 13, cz);
  const mem = [], yaw = Math.PI / 2, c = Math.cos(yaw), si = Math.sin(yaw);
  for (const m of list) { let x = cx + m.dx * c + m.dz * si, z = cz - m.dx * si + m.dz * c; if (!w.nav.isWalkable(x, z)) { const n = w.nav.nearestWalkable(x, z, 6); if (!n) continue; x = n.x; z = n.z; } mem.push(w.spawnEnemy(m.id, x, z, { level, elite: m.elite, eliteMods: m.eliteMods })); }
  const bot = new Bot(w, { skill, reaction: 0.25, kite: ch.cls.profile.weaponKinds?.includes('caster') ?? false });
  let t = 0, potionCd = 0, potions = 0, dmg = 0;
  w.events.on('damage', (i) => { if (i.target === p) dmg += i.amount; });
  while (t < 90 && mem.some((e) => !e.dead) && !p.dead) {
    potionCd -= 1 / 60; if (p.hp / p.hpMax < 0.4 && potionCd <= 0 && s.usePotion()?.ok) { potions++; potionCd = 3; }
    const alive = mem.filter((e) => !e.dead), near = alive.some((e) => Math.hypot(e.x - p.x, e.z - p.z) < 18);
    if (!near) p.cmd.moveTo = { x: alive[0].x, z: alive[0].z }; else { p.cmd.moveTo = null; bot.update(1 / 60); }
    s.update(1 / 60); t += 1 / 60;
  }
  return { win: !mem.some((e) => !e.dead), dead: p.dead, t, potions, dmgPct: dmg / p.hpMax, n: mem.length };
}

console.log(`pack-sim · skill ${skill} · player level = encounter level + ${off} · ${seeds} seeds`);
console.log('class       template                 L  n   win%  clear  potions  dmg% of max life  deaths');
let bad = 0, stdCost = [];
for (const c of classes) for (const [tpl, L, kind] of TEMPLATES) {
  const r = Array.from({ length: seeds }, (_, i) => fight(c, tpl, L, i + 1)), avg = (f) => r.reduce((a, x) => a + f(x), 0) / r.length;
  const win = r.filter((x) => x.win).length / r.length, dmg = avg((x) => x.dmgPct);
  if (kind === 'std') stdCost.push(dmg);
  if (win < 1 && kind === 'std') bad++;
  console.log(`${c.padEnd(11)} ${tpl.padEnd(24)} ${L} ${String(Math.round(avg((x) => x.n))).padStart(2)} ${String(Math.round(win * 100)).padStart(5)}% ${avg((x) => x.t).toFixed(0).padStart(5)}s ${avg((x) => x.potions).toFixed(1).padStart(8)} ${(dmg * 100).toFixed(0).padStart(14)}% ${r.filter((x) => x.dead).length}/${r.length}${kind === 'hard' ? '  (hard)' : ''}`);
}
const mean = stdCost.reduce((a, b) => a + b, 0) / Math.max(1, stdCost.length);
console.log(`\nmean cost of a standard pack: ${(mean * 100).toFixed(0)} % of max life${mean > 0.45 ? '  ✖ above the 45 % target' : '  ✔'}`);
if (mean > 0.45) bad++;
process.exit(strict && bad ? 1 : 0);
