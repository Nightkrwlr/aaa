#!/usr/bin/env node
/**
 * boss-sim — how fair is the first boss? A scripted player (the Bot the balance simulator uses, drinking potions below 40 % life)
 * fights Brannoch in the real zone, starting at the arena's east entrance, for each class × level × skill, and we report the win
 * rate, the fight length, the potions used and how close the boss got to dying. Targets for the intended level (L5): the average
 * player wins most first attempts, in one to two minutes, with a couple of potions.
 *
 * usage: node tools/boss-sim.mjs [--class belfry,prismatist,skirmisher] [--level 4,5,6] [--skill 0.7,0.9] [--seeds 4] [--alone] [--start 54,0] [--strict]
 *        --alone   remove every other enemy first (the boss on its own: isolates the boss design from the zone layout)
 *        --strict  exit 1 when the mean win rate at the boss's own level is below 60 %
 */
import { makeSession, teleport } from '../tests/helpers/session.js';
import { Bot } from '../src/sim/bot.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const classes = opt('class', 'belfry,prismatist,skirmisher').split(','), levels = opt('level', '4,5,6').split(',').map(Number), skills = opt('skill', '0.7,0.9').split(',').map(Number), seeds = Number(opt('seeds', 4));
const alone = args.includes('--alone'), strict = args.includes('--strict'), start = opt('start', '54,0').split(',').map(Number);

function fight(cls, level, skill, seed) {
  const s = makeSession({ seed: `boss-${seed}`, classId: `cls.${cls}`, level });
  const w = s.world, p = s.player, ch = s.character;
  let guard = 12; while (ch.talentPoints() > 0 && guard-- > 0) { const c = [...ch.tree.nodes.values()].find((n) => n.kind !== 'keystone' && ch.tree.canAllocate(ch.alloc, n.id, { points: ch.talentPoints(), level: ch.level }).ok); if (!c) break; s.allocateTalent?.(c.id) ?? ch.alloc.add(c.id); }
  const boss = w.entities.find((e) => e.def?.id === 'boss.brannoch');
  if (!boss) throw new Error('no Brannoch in the zone');
  if (alone) for (const e of w.entities) if (e.team === 'enemy' && e !== boss) { e.dead = true; e.removed = true; }
  teleport(s, start[0], start[1]); s.update(1 / 60);
  const bot = new Bot(w, { skill, reaction: 0.25, kite: ch.cls.profile.weaponKinds?.includes('caster') ?? false });
  bot.pickTarget = () => boss;
  let t = 0, potionCd = 0, potions = 0, minHp = 1, bossMin = 1;
  while (t < 240 && !boss.dead && !p.dead) {
    potionCd -= 1 / 60; if (p.hp / p.hpMax < 0.4 && potionCd <= 0 && s.usePotion()?.ok) { potions++; potionCd = 3; }
    bot.update(1 / 60); s.update(1 / 60); t += 1 / 60;
    minHp = Math.min(minHp, p.hp / p.hpMax); if (!p.dead) bossMin = Math.min(bossMin, boss.hp / boss.hpMax);   // a dead player resets the boss
  }
  return { win: boss.dead, t, potions, minHp, bossMin };
}

console.log(`boss-sim · Brannoch (L5 miniboss) · start (${start}) · ${alone ? 'boss alone' : 'real zone'} · ${seeds} seeds`);
console.log('class       lvl skill  win%  fight  potions  lowest-HP  boss-HP-min');
const rates = [];
for (const c of classes) for (const L of levels) for (const sk of skills) {
  const r = Array.from({ length: seeds }, (_, i) => fight(c, L, sk, i + 1)), avg = (f) => r.reduce((a, x) => a + f(x), 0) / r.length;
  const win = r.filter((x) => x.win).length / r.length;
  if (L === 5) rates.push(win);
  console.log(`${c.padEnd(11)} ${String(L).padStart(3)} ${String(sk).padStart(5)} ${String(Math.round(win * 100)).padStart(4)}% ${avg((x) => x.t).toFixed(0).padStart(5)}s ${avg((x) => x.potions).toFixed(1).padStart(8)} ${(avg((x) => x.minHp) * 100).toFixed(0).padStart(8)}% ${(avg((x) => x.bossMin) * 100).toFixed(0).padStart(10)}%`);
}
const mean = rates.reduce((a, b) => a + b, 0) / Math.max(1, rates.length);
console.log(`\nmean win rate at the boss's own level (L5): ${(mean * 100).toFixed(0)} %${mean < 0.6 ? '  ✖ below the 60 % target' : '  ✔'}`);
process.exit(strict && mean < 0.6 ? 1 : 0);
