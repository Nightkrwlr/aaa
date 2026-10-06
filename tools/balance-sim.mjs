#!/usr/bin/env node
/**
 * balance-sim — headless balance report. For each class × level it builds a character with level-appropriate
 * gear (best-of-N fine/attuned rolls per slot, talents auto-allocated greedily), fights target dummies and real
 * enemy tiers with the scripted Bot, and reports DPS vs the central model, time-to-kill per tier, damage taken and
 * the loot/economy yield per kill. Exit code 1 if anything drifts beyond tolerance (CI "balance guard").
 *
 * usage: node tools/balance-sim.mjs [--levels 1,5,10,20,30,45,60] [--classes belfry,prismatist,skirmisher] [--quick] [--json]
 */
import { freshRegistry } from '../src/core/nodeLoader.js';
import { Rng } from '../src/core/rng.js';
import { Balance } from '../src/sim/balance.js';
import { World } from '../src/sim/world.js';
import { NavGrid } from '../src/sim/nav.js';
import { createPlayerEntity } from '../src/sim/player.js';
import { Character } from '../src/sim/character.js';
import { ItemFactory } from '../src/sim/items/generator.js';
import { rollDrops } from '../src/sim/items/loot.js';
import { Bot } from '../src/sim/bot.js';
import { summarize } from '../src/sim/items/compare.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const quick = args.includes('--quick');
const LEVELS = (opt('levels', quick ? '1,10,30' : '1,5,10,20,30,45,60')).split(',').map(Number);
const CLASSES = (opt('classes', 'belfry,prismatist,skirmisher')).split(',').map((c) => `cls.${c}`);
// Curated gear (best-of-10 per slot), every talent point spent, and a perfect rotation on a stationary dummy is a *strong* build:
// 2–4× the median model is expected, 5× would be a break. Class spread at the same level must stay within SPREAD.
const TOL = { dps: [0.55, 5.0], ttkStd: [0.4, 2.6] };
const SPREAD = 2.4;
const GEAR_SEEDS = quick ? 2 : 5; // median over several gear rolls: one lucky weapon must not move the verdict

const reg = freshRegistry();
const bal = Balance.from(reg);
const SLOTS = ['weapon', 'offhand', 'head', 'chest', 'hands', 'feet', 'neck', 'ring', 'ring', 'relic'];

function buildCharacter(classId, level, seed, { kit = false } = {}) {
  const factory = new ItemFactory(reg, bal);
  const ch = new Character({ registry: reg, balance: bal, factory, classId });
  ch.level = level; ch.autoLoadout();
  if (kit) { // class kit only: starting weapon, no other gear, no talents — isolates skill/resource design from item scaling
    const w = factory.roll(new Rng(`${seed}:kit`), { ilvl: level, rarity: 'common', slot: 'weapon', baseId: ch.cls.startingWeapon, noUnique: true });
    ch.equipment.weapon = w; return { ch, factory };
  }
  const rng = new Rng(`${seed}:gear`);
  // gear: for each slot keep the best-by-power of 10 rolls (bias toward fine/attuned like a player who curates)
  for (const slot of SLOTS) {
    let best = null, bp = -1;
    for (let i = 0; i < 10; i++) {
      const it = factory.roll(rng.fork(`${slot}${i}`), { ilvl: level, slot, bias: 0.45, tags: ch.buildTags(), classId, noUnique: true });
      const p = factory.power(it);
      if (p > bp && ch.canEquip(it, ch.slotFor(it)).ok !== false) { bp = p; best = it; }
    }
    if (!best) continue;
    const target = ch.slotFor(best);
    if (ch.canEquip(best, target).ok) ch.equipment[target] = best;
  }
  // talents: greedy by "reachable & affordable", preferring the first branch for coherence
  let guard = 400;
  while (ch.talentPoints() > 0 && guard-- > 0) {
    const cands = [...ch.tree.nodes.values()].filter((n) => ch.tree.canAllocate(ch.alloc, n.id, { points: ch.talentPoints(), level }).ok && n.kind !== 'keystone');
    if (!cands.length) break;
    cands.sort((a, b) => (a.branch === 'A' ? -1 : 1) - (b.branch === 'A' ? -1 : 1) || a.id.localeCompare(b.id));
    ch.alloc.add(cands[0].id);
  }
  return { ch, factory };
}

function arena(ch, level, seed, difficulty = 'seeker') {
  const nav = new NavGrid(120, 120, 1);
  const w = new World({ registry: reg, nav, seed, areaLevel: level, difficulty, balance: bal });
  const p = w.addPlayer(createPlayerEntity(w, ch.cls, level, 60, 60));
  p.corpseTime = 1e9;
  ch.recompute(w, p); p.hp = p.hpMax;
  return { w, p };
}

function fight(ch, level, enemyId, { seed, tier, count = 1, maxT = 90, elite = false }) {
  const { w, p } = arena(ch, level, seed);
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const e = w.spawnEnemy(enemyId, 60 + Math.sin(a) * 7 + 3, 60 + Math.cos(a) * 7, { level, elite });
    e.yaw = Math.atan2(p.x - e.x, p.z - e.z); e.ai.target = p; e.alerted = true;
    enemies.push(e);
  }
  const bot = new Bot(w, { skill: 0.85, reaction: 0.2, kite: ch.cls.profile.weaponKinds?.includes('caster') ?? false });
  let dmgTaken = 0; w.events.on('damage', (i) => { if (i.target === p) dmgTaken += i.amount; });
  let t = 0, killedAt = null;
  while (t < maxT) {
    bot.update(1 / 60); w.step(1 / 60); t += 1 / 60;
    if (p.dead) return { ttk: Infinity, died: true, dmgPct: dmgTaken / p.hpMax, t };
    if (enemies.every((e) => e.dead)) { killedAt = t; break; }
  }
  return { ttk: killedAt ?? Infinity, died: false, dmgPct: dmgTaken / p.hpMax, t };
}

const rows = [], problems = [], kitRows = [];
for (const classId of CLASSES) for (const level of LEVELS) {
  const seed = `bal:${classId}:${level}`;
  if (level <= 10) { // kit-only DPS: every class's starter kit should sit in the same band around the model
    const k = buildCharacter(classId, level, seed, { kit: true });
    const a = arena(k.ch, level, `${seed}:kit`); const dd = a.w.spawnEnemy('enm.test_dummy', 63, 60, { level }); dd.hpMax = dd.hp = 1e9; dd.ai.target = null;
    const bb = new Bot(a.w, { skill: 1, reaction: 0 }); let dl = 0; a.w.events.on('damage', (i) => { if (i.target === dd) dl += i.amount; });
    for (let i = 0; i < 20 * 60; i++) { bb.update(1 / 60); a.w.step(1 / 60); }
    kitRows.push({ class: classId.slice(4), level, kitDps: +(dl / 20).toFixed(1), kitRatio: +(dl / 20 / bal.expectedDps(level)).toFixed(2) });
    if (dl / 20 / bal.expectedDps(level) > 1.8 || dl / 20 / bal.expectedDps(level) < 0.6) problems.push(`${classId.slice(4)} L${level}: starter-kit DPS ratio ${(dl / 20 / bal.expectedDps(level)).toFixed(2)} outside 0.6–1.8`);
  }
  const { ch, factory } = buildCharacter(classId, level, seed);
  const sum = summarize(ch, ch.equipment);
  // 1) DPS on a dummy over 20 s with the full bot rotation — median over several independent gear rolls
  const dummyDps = (c, sd) => {
    const { w } = arena(c, level, `${sd}:dps`);
    const d = w.spawnEnemy('enm.test_dummy', 63, 60, { level }); d.hpMax = d.hp = 1e9; d.ai.target = null;
    const bot = new Bot(w, { skill: 1, reaction: 0 });
    let dealt = 0; w.events.on('damage', (i) => { if (i.target === d) dealt += i.amount; });
    for (let i = 0; i < 20 * 60; i++) { bot.update(1 / 60); w.step(1 / 60); }
    return dealt / 20;
  };
  const runs = [dummyDps(ch, seed)];
  for (let g = 1; g < GEAR_SEEDS; g++) runs.push(dummyDps(buildCharacter(classId, level, `${seed}#${g}`).ch, `${seed}#${g}`));
  runs.sort((a, b) => a - b);
  const dps = runs[Math.floor(runs.length / 2)], expected = bal.expectedDps(level);
  // 2) TTK + damage taken against real tiers (families chosen for generic behaviour)
  const std = fight(ch, level, 'enm.hollow_chorister', { seed: `${seed}:std`, count: 1, maxT: 40 });
  const grp = fight(ch, level, 'enm.hollow_chorister', { seed: `${seed}:grp`, count: 4, maxT: 60 });
  // tough/elite verdicts use the best of 3 spawn layouts: one unlucky blink/shield layout must not read as "the kit cannot finish it"
  const best = (id, o) => { let r = null; for (let k = 0; k < 3; k++) { const x = fight(ch, level, id, { ...o, seed: `${o.seed}#${k}` }); if (!r || x.ttk < r.ttk) r = x; if (Number.isFinite(x.ttk)) break; } return r; };
  const tough = best('enm.hollow_shieldbearer', { seed: `${seed}:tough`, maxT: 60 });
  const elite = best('enm.cracked_cantor', { seed: `${seed}:elite`, maxT: 90, elite: true });
  // 3) loot yield over 4000 standard kills
  const rng = new Rng(`${seed}:loot`); const c = { lootFind: 0, difficulty: 'seeker', buildTags: ch.buildTags(), classId, playerLevel: level };
  const def = reg.get('enm.hollow_chorister'); let items = 0, chimes = 0; const rar = { common: 0, fine: 0, attuned: 0, relic: 0 };
  for (let i = 0; i < 4000; i++) for (const dr of rollDrops({ registry: reg, balance: bal, factory, rng, def, level, tier: 'standard', ctx: c })) { if (dr.type === 'item') { items++; rar[dr.item.rarity]++; } if (dr.type === 'chimes') chimes += dr.amount; }
  const row = { class: classId.slice(4), level, dps: +dps.toFixed(1), expected: +expected.toFixed(1), ratio: +(dps / expected).toFixed(2), ehp: sum.ehp, ttkStd: +std.ttk.toFixed(1), ttkGroup4: +grp.ttk.toFixed(1), ttkTough: +tough.ttk.toFixed(1), ttkElite: +elite.ttk.toFixed(1), dmgStd: +(std.dmgPct * 100).toFixed(0), dmgGrp: +(grp.dmgPct * 100).toFixed(0), died: [std, grp, tough, elite].filter((x) => x.died).length, itemsPer1000: +(items / 4 ).toFixed(0), chimesPerKill: +(chimes / 4000).toFixed(1), fineShare: +(rar.fine / Math.max(1, items)).toFixed(2), attunedShare: +(rar.attuned / Math.max(1, items)).toFixed(3) };
  rows.push(row);
  const tStd = bal.tier('standard').ttk;
  if (row.ratio < TOL.dps[0] || row.ratio > TOL.dps[1]) problems.push(`${row.class} L${level}: DPS ratio ${row.ratio} outside ${TOL.dps}`);
  if (std.ttk > tStd * TOL.ttkStd[1] * 2 && Number.isFinite(std.ttk)) problems.push(`${row.class} L${level}: standard TTK ${row.ttkStd}s (target ${tStd}s)`);
  for (const [name, r] of [['tough', tough], ['elite', elite]]) if (!Number.isFinite(r.ttk) && !r.died) problems.push(`${row.class} L${level}: ${name} enemy not killed within 90 s (kit cannot finish it)`);
  if (std.died) problems.push(`${row.class} L${level}: died against a single standard enemy`);
}

if (args.includes('--json')) console.log(JSON.stringify(rows, null, 1));
else {
  console.log('class        lvl   dps   exp  ratio |  ehp  | ttk std grp4 tough elite | dmg%% std/grp | died | items/1k chimes/kill fine attuned');
  for (const r of rows) console.log(`${r.class.padEnd(11)} ${String(r.level).padStart(3)} ${String(r.dps).padStart(6)} ${String(r.expected).padStart(5)} ${String(r.ratio).padStart(5)} | ${String(r.ehp).padStart(5)} |     ${String(r.ttkStd).padStart(4)} ${String(r.ttkGroup4).padStart(4)} ${String(r.ttkTough).padStart(5)} ${String(r.ttkElite).padStart(5)} |  ${String(r.dmgStd).padStart(3)}/${String(r.dmgGrp).padStart(3)}     |  ${r.died}   | ${String(r.itemsPer1000).padStart(6)}   ${String(r.chimesPerKill).padStart(6)}    ${r.fineShare} ${r.attunedShare}`);
  console.log('\nstarter kit (no gear/talents): ' + kitRows.map((r) => `${r.class} L${r.level}=${r.kitRatio}×`).join('  '));
  const tiers = Object.entries(bal.d.enemyTiers).map(([k, v]) => `${k}:${v.ttk}s`).join(' ');
  console.log(`\ntargets: TTK ${tiers}`);
  const resp = [1, 10, 20, 30, 45, 60].map((l) => `L${l}=${bal.respecCost(l, 0)}/${bal.respecCost(l, 5)}`).join(' ');
  console.log(`economy: respec cost (first/6th) ${resp}`);
}
for (const lv of LEVELS) {
  const at = rows.filter((r) => r.level === lv); if (at.length < 2) continue;
  const hi = at.reduce((a, b) => (b.ratio > a.ratio ? b : a)), lo = at.reduce((a, b) => (b.ratio < a.ratio ? b : a));
  if (hi.ratio / lo.ratio > SPREAD) problems.push(`L${lv}: class spread ${(hi.ratio / lo.ratio).toFixed(2)}× (${hi.class} ${hi.ratio} vs ${lo.class} ${lo.ratio}) exceeds ${SPREAD}×`);
}
for (const p of problems) console.error(`⚠ ${p}`);
console.log(problems.length ? `BALANCE GUARD: ${problems.length} warnings` : 'BALANCE GUARD: OK');
process.exit(problems.length ? 1 : 0);
