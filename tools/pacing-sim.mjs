#!/usr/bin/env node
/**
 * pacing-sim — plays the OPENING of the game with a scripted, reasonably competent player and reports the pacing:
 * time to the first kill, level-ups, kills/minute, loot drops, potions, damage taken, deaths and dead stretches.
 * The numbers are what "does this hook in the first ten minutes?" looks like: see docs/BALANCE.md › Pacing targets.
 *
 * usage: node tools/pacing-sim.mjs [--class belfry|prismatist|skirmisher|all] [--minutes 10] [--seeds 3] [--skill 0.85] [--strict] [--json out.json]
 * The player follows the quest tracker (hear the cylinder), fights what is near, picks up loot, equips upgrades, drinks potions at low
 * life and spends talent points; between fights it walks to the next group (no teleporting). Deterministic per seed.
 */
import { writeFileSync } from 'node:fs';
import { makeSession, ia } from '../tests/helpers/session.js';
import { Bot } from '../src/sim/bot.js';
import { compareItem } from '../src/sim/items/compare.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const classes = opt('class', 'all') === 'all' ? ['belfry', 'prismatist', 'skirmisher'] : [opt('class', 'belfry')];
const MINUTES = Number(opt('minutes', 10)), SEEDS = Number(opt('seeds', 3)), SKILL = Number(opt('skill', 0.85));
const strict = args.includes('--strict');

// targets for a competent player (per class, median over seeds). Missing = the opening is too slow / too dead / too punishing.
const TARGET = { firstKill: 45, level2: 75, level5: 480, level8: 840, killsPerMin: 5, dropsPerMin: 1.4, maxDeadStretch: 25, deaths: 1 };

function playOne(classKey, seed) {
  const s = makeSession({ seed: `pace-${seed}`, classId: `cls.${classKey === 'prismatist' ? 'prismatist' : classKey}` });
  const w = s.world, p = s.player, ch = s.character;
  const bot = new Bot(w, { skill: SKILL, reaction: 0.25, kite: ch.cls.profile.weaponKinds?.includes('caster') ?? false });
  // the zone has plateaus and cliffs: only enemies that can be walked to count as targets (checked at 4 Hz, not every tick)
  const reach = new Map(); let reachAt = -1;
  const reachable = (e) => { if (M.t - reachAt > 0.25) { reach.clear(); reachAt = M.t; } let r = reach.get(e.uid); if (r === undefined) { r = !!w.nav.findPath(p.x, p.z, e.x, e.z); reach.set(e.uid, r); } return r; };
  const ignore = new Map();   // uid → until: targets the bot cannot hurt from where it stands (no line of fire) are approached, not shot at forever
  let progressAt = 0, lastDealt = 0, approachUntil = 0;
  bot.pickTarget = (pl) => {
    let best = null, bd = 20 * 20;
    for (const e of w.entities) {
      if (e.dead || e.team !== 'enemy' || e.untargetable || e.hidden) continue;
      if ((e.tier === 'boss' || e.tier === 'miniboss') && ch.level < e.level) continue;       // a sensible player does not walk up to a boss under its level
      let d = (e.x - pl.x) ** 2 + (e.z - pl.z) ** 2; if (e.role?.includes('support') || e.role?.includes('summoner')) d *= 0.6;
      if (d < bd && reachable(e) && !(ignore.get(e.uid) > M.t)) { bd = d; best = e; }
    }
    return best;
  };
  const M = { t: 0, kills: 0, firstKill: null, levels: {}, drops: 0, potions: 0, deaths: 0, dmgTaken: 0, hpMax: p.hpMax, deadStretch: 0, longest: 0, equips: 0, quiet: 0 };
  const ev = s.events, wev = w.events;
  ev.on('kill', () => { M.kills++; M.firstKill ??= M.t; });
  wev.on('level:up', (i) => { M.levels[i.level] = M.t; });
  wev.on('loot:drop', () => { M.drops++; });
  let engagedAt = 0, deadFor = 0;
  wev.on('damage', (i) => { if (i.target === p) M.dmgTaken += i.amount; if (i.target === p || i.source === p) engagedAt = M.t; });
  let lastHitBy = null; wev.on('damage', (i) => { if (i.target === p && i.source) lastHitBy = i.source; });
  ev.on('player:died', () => { M.deaths++; if (process.env.PACE_DEATHS) console.log(`  ☠ t=${M.t.toFixed(0)}s lvl=${ch.level} at (${p.x.toFixed(0)},${p.z.toFixed(0)}) killed by ${lastHitBy?.id ?? '?'} L${lastHitBy?.level ?? '?'} ${lastHitBy?.tier ?? ''}${lastHitBy?.eliteMods?.length ? ' elite' : ''}`); });

  // the intended route: hear the cylinder → walk to Orrel (fighting what is on the way) → talk → head for the quarry (Brannoch)
  const cyl = ia(s, 'poi.voice_cylinder_1'), orrel = ia(s, 'npc.orrel');
  // long walks: the controller's own click-to-move gives up on very long paths, so walk the planned path waypoint by waypoint
  let route = null, routeAt = -9, routeGoal = null;
  const goto = (x, z) => {
    if (!route || M.t - routeAt > 1 || !routeGoal || Math.hypot(routeGoal.x - x, routeGoal.z - z) > 3) { route = w.nav.findPath(p.x, p.z, x, z, { maxNodes: 60000 }); routeAt = M.t; routeGoal = { x, z }; }
    const wp = route?.find((q) => Math.hypot(q.x - p.x, q.z - p.z) > 2.2) ?? { x, z };
    p.cmd.moveTo = { x: wp.x, z: wp.z }; p.cmd.attackTarget = null;
  };
  const near = (o, r) => Math.hypot(o.x - p.x, o.z - p.z) <= r;
  const quarry = () => ({ x: 34, z: -4 });                      // the quarry's ramp: Brannoch waits further in
  let step = 0, potionCd = 0, lastAct = 0, equipT = 0, lastPick = 0;
  const objective = () => (step === 0 ? cyl : step === 1 ? orrel : quarry());

  const dt = 1 / 60, end = MINUTES * 60;
  for (let i = 0; i < end * 60; i++) {
    M.t = i * dt;
    if (p.dead || s.dead) { deadFor += dt; if (deadFor > 3) { s.respawn(); deadFor = 0; engagedAt = lastPick = M.t; } s.update(dt); continue; }
    const busy = !!bot.pickTarget(p) || M.t < approachUntil;
    if (!busy) progressAt = M.t;
    potionCd -= dt;
    if (p.hp / p.hpMax < 0.4 && potionCd <= 0) { const r = s.usePotion(); if (r?.ok) { M.potions++; potionCd = 3; } }

    const obj = objective();
    if (busy) {
      if (w.metrics.damageDealt > lastDealt + 0.5) { lastDealt = w.metrics.damageDealt; progressAt = M.t; }
      if (M.t - progressAt > 5) {                       // five seconds of shooting without hurting anything: walk up to it instead
        const t = bot.pickTarget(p); if (t) { ignore.set(t.uid, M.t + 25); approachUntil = M.t + 3; goto(t.x, t.z); }
        progressAt = M.t;
      }
      if (M.t < approachUntil) { /* closing in: keep the walk order */ } else { p.cmd.moveTo = null; bot.update(dt); }
      lastAct = M.t;
    } else {
      p.cmd.moveDir = null; p.cmd.holdPrimary = false;      // the bot's kite vector must not outlive the fight
      // loot within reach first
      const ground = s.loot?.ground ?? [];
      let best = null, bd = 14 * 14;
      for (const g of ground) { const d = (g.x - p.x) ** 2 + (g.z - p.z) ** 2; if (d < bd) { bd = d; best = g; } }
      if (best) { if (bd < 1.6 * 1.6) { s.pickup(best.uid, { force: true }); lastPick = M.t; } else goto(best.x, best.z); }
      else if (step <= 1 && obj && near(obj, 2.4)) {
        if (step === 0) { s.interact(obj); step = 1; }
        else { let v = s.interact(obj)?.dialogue, g = 0; while (v && g++ < 40) v = s.dialogue.advance(v.choices.length ? v.choices[v.choices.length - 1].index : null); step = 2; }
        p.cmd.moveTo = null;
      } else if (obj) goto(obj.x, obj.z);
      else { /* nothing left to do */ }
      if (step >= 2 && near(obj, 8)) {
        // at the quarry: go hunting the nearest reachable enemy so the stretch is never idle
        const cands = w.entities.filter((e) => !e.dead && e.team === 'enemy' && !e.untargetable && !e.hidden && !((e.tier === 'boss' || e.tier === 'miniboss') && ch.level < e.level) && (e.x - p.x) ** 2 + (e.z - p.z) ** 2 < 70 * 70).sort((a, b) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2));
        const t = cands.slice(0, 6).find((e) => w.nav.findPath(p.x, p.z, e.x, e.z)); if (t) goto(t.x, t.z);
      }
    }
    // upgrades + talents, every few seconds
    if (M.t - equipT > 4) {
      equipT = M.t;
      for (const it of ch.inv.items()) { try { if (compareItem(ch, s.factory, it).verdict === 'upgrade' && s.equip(it.iid)?.ok) M.equips++; } catch { /* unequippable */ } }
      let guard = 8; while (ch.talentPoints() > 0 && guard-- > 0) {
        const c = [...ch.tree.nodes.values()].find((n) => n.kind !== 'keystone' && ch.tree.canAllocate(ch.alloc, n.id, { points: ch.talentPoints(), level: ch.level }).ok);
        if (!c) break; s.allocateTalent?.(c.id) ?? ch.alloc.add(c.id);
      }
    }
    // dead stretch = time since the player last dealt or took damage or picked something up (walking across the map is not "something to do")
    if (M.t - Math.max(engagedAt, lastPick) > M.longest) M.longest = M.t - Math.max(engagedAt, lastPick);
    if (process.env.PACE_TRACE && i % 300 === 0) { const ne = w.entities.filter((e) => !e.dead && e.team === 'enemy').map((e) => Math.hypot(e.x - p.x, e.z - p.z)).sort((a, b) => a - b)[0]; console.log(`t=${M.t.toFixed(0)}s pos=(${p.x.toFixed(0)},${p.z.toFixed(0)}) hp=${(p.hp / p.hpMax * 100).toFixed(0)}% nearest=${ne?.toFixed(0)}m cast=${p.cast ? `${p.cast.ab?.id}:${p.cast.phase}` : '-'} dash=${p.dash ? 1 : 0} rooted=${w.status.has?.(p, 'st.rooted') ? 1 : 0} moveTo=${p.cmd.moveTo ? `${p.cmd.moveTo.x.toFixed(0)},${p.cmd.moveTo.z.toFixed(0)}` : '-'} kills=${M.kills} xp=${ch.xp}`); }
    s.update(dt);
  }
  return { ...M, level: ch.level, dmgPct: M.dmgTaken / Math.max(1, M.hpMax) };
}

const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
const fmt = (v, d = 0) => (v == null ? '  —' : v.toFixed(d));
const out = {}; let bad = 0;
console.log(`pacing-sim · ${MINUTES} min · ${SEEDS} seeds · skill ${SKILL}`);
console.log('class        firstKill  L2    L3    L5    L8    kills/min drops/min potions deaths dmg%   longestIdle  endLvl');
for (const c of classes) {
  const runs = Array.from({ length: SEEDS }, (_, i) => playOne(c, i + 1));
  const row = {
    firstKill: med(runs.map((r) => r.firstKill)), l2: med(runs.map((r) => r.levels[2])), l3: med(runs.map((r) => r.levels[3])), l5: med(runs.map((r) => r.levels[5])), l8: med(runs.map((r) => r.levels[8])),
    kpm: med(runs.map((r) => r.kills / MINUTES)), dpm: med(runs.map((r) => r.drops / MINUTES)), potions: med(runs.map((r) => r.potions)), deaths: med(runs.map((r) => r.deaths)),
    dmg: med(runs.map((r) => r.dmgPct)), longest: med(runs.map((r) => r.longest)), level: med(runs.map((r) => r.level)),
  };
  out[c] = row;
  console.log(`${c.padEnd(12)} ${fmt(row.firstKill).padStart(7)}s ${fmt(row.l2).padStart(5)} ${fmt(row.l3).padStart(5)} ${fmt(row.l5).padStart(5)} ${fmt(row.l8).padStart(5)} ${fmt(row.kpm, 1).padStart(9)} ${fmt(row.dpm, 1).padStart(9)} ${fmt(row.potions).padStart(7)} ${fmt(row.deaths).padStart(6)} ${(row.dmg * 100).toFixed(0).padStart(4)}% ${fmt(row.longest).padStart(9)}s ${fmt(row.level).padStart(8)}`);
  const miss = [];
  if (row.firstKill == null || row.firstKill > TARGET.firstKill) miss.push(`first kill ${fmt(row.firstKill)}s > ${TARGET.firstKill}s`);
  if (row.l2 == null || row.l2 > TARGET.level2) miss.push(`level 2 at ${fmt(row.l2)}s > ${TARGET.level2}s`);
  if (row.l5 == null || row.l5 > TARGET.level5) miss.push(`level 5 at ${fmt(row.l5)}s > ${TARGET.level5}s`);
  if (row.kpm < TARGET.killsPerMin) miss.push(`kills/min ${fmt(row.kpm, 1)} < ${TARGET.killsPerMin}`);
  if (row.dpm < TARGET.dropsPerMin) miss.push(`drops/min ${fmt(row.dpm, 1)} < ${TARGET.dropsPerMin}`);
  if (row.longest > TARGET.maxDeadStretch) miss.push(`dead stretch ${fmt(row.longest)}s > ${TARGET.maxDeadStretch}s`);
  if (row.deaths > TARGET.deaths) miss.push(`deaths ${fmt(row.deaths)} > ${TARGET.deaths}`);
  if (miss.length) { bad++; console.log(`   ✖ ${miss.join(' · ')}`); }
}
const json = opt('json', null); if (json) writeFileSync(json, JSON.stringify(out, null, 2));
console.log(bad ? `\n${bad} class(es) miss the pacing targets` : '\nall classes within the pacing targets');
process.exit(strict && bad ? 1 : 0);
