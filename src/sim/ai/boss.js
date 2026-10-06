/**
 * BossBrain — hand-authored multi-phase fights driven by data (enemy.boss.phases).
 *  • rotation: weighted ability list with distance conditions & randomised gaps (readable patterns)
 *  • enter: phase transition (brief invulnerability, cleanse, abilities, subtitle line)
 *  • hazards / summons: concurrent timers (falling notes, adds)
 *  • shield (Ildra): her voice shield blocks ~98 % of damage until the player lands a TRIAD chord
 *    (differentiator #1 applied to a boss). Breaking it opens a vulnerable window.
 *  • crash (Brannoch): his charge self‑staggers against pillars → "use the environment".
 */
import { BRAINS } from './brains.js';
import { clamp } from '../../core/math.js';

export const BossBrain = {
  init(e, w) {
    const cfg = e.def.boss;
    e.boss = { cfg, phaseIdx: -1, nextAt: 0, started: false, home: { x: e.x, z: e.z }, hazNext: [], sumNext: 0, shield: null };
    e.ai.cfg.instantAggro = true; e.ai.cfg.noLeash = true; e.ai.cfg.fov = Math.PI * 2; e.noSeparate = true;
    e.bossShield = null;
    if (cfg.shield) {
      e.damageGate = function gate(dmg) {
        const b = this.boss;
        if (b.shield?.up) { this.shieldHitT = this.world.time; return Math.max(1, Math.round(dmg * 0.02)); }
        return dmg;
      };
      e.world = w;
      w.events.on('cadence:chord', (i) => {
        if (e.dead || !e.boss.started || !e.boss.shield?.up || i.chord.type !== 'triad') return;
        if (Math.hypot(i.entity.x - e.x, i.entity.z - e.z) > 40) return;
        BossBrain.breakShield(e, w);
      });
    }
    w.events.on('entity:died', (i) => { if (i.entity === w.player && e.boss.started && !e.dead) BossBrain.reset(e, w); });
  },

  reset(e, w) {
    const b = e.boss;
    b.started = false; b.phaseIdx = -1; b.shield = null; e.bossShield = null;
    e.ai.target = null; e.ai.state = 'idle'; e.phase = 1; e.cast = null; e.dash = null;
    e.hp = e.hpMax; e.x = b.home.x; e.z = b.home.z; e.invulnerableUntil = 0;
    w.status.clear(e, () => true);
    for (const o of w.entities) if (o.owner === e && !o.dead) { o.noLoot = true; w.kill(o, null); }
    w.events.emit('boss:reset', { entity: e });
  },

  enterPhase(e, w, idx) {
    const b = e.boss, ph = b.cfg.phases[idx];
    b.phaseIdx = idx; e.phase = idx + 1;
    b.nextAt = w.time + 1.6;
    b.hazNext = (ph.hazards ?? []).map((h) => w.time + h.every * 0.6);
    b.sumNext = w.time + (ph.summons ? ph.summons.every * 0.5 : 1e9);
    if (b.cfg.shield) BossBrain.raiseShield(e, w, ph);
    if (idx > 0) {
      e.invulnerableUntil = w.time + 1.6;
      w.status.clear(e, (d) => d.tags?.includes('control') || d.tags?.includes('curse'));
      for (const ab of ph.enter?.abilities ?? []) w.abilities.castImmediate(e, ab, w.player?.x ?? e.x, w.player?.z ?? e.z);
    }
    const say = ph.enter?.say ?? ph.say;
    w.events.emit('boss:phase', { entity: e, phase: idx + 1, say, count: b.cfg.phases.length });
  },

  raiseShield(e, w, ph) {
    const s = ph.shield ?? e.boss.cfg.shield ?? {};
    e.boss.shield = { up: true, window: s.window ?? 8, regen: s.regen ?? 12, until: 0 };
    e.bossShield = { value: 1, max: 1 };
    w.events.emit('boss:shield_up', { entity: e });
  },

  breakShield(e, w) {
    const s = e.boss.shield;
    s.up = false; s.until = w.time + s.window;
    e.bossShield = { value: 0, max: 1 };
    w.status.apply(e, 'st.boss_vuln', { duration: s.window });
    w.status.apply(e, 'st.staggered', { duration: 1.4 });
    w.events.emit('boss:shield_break', { entity: e, window: s.window });
  },

  tick(e, w, dt, tk, sys) {
    const b = e.boss;
    if (e.dead) return;
    if (BRAINS.charger && b.cfg.crash) BRAINS.charger.tick(e, w);
    if (!b.started) return;
    // phase thresholds
    const next = b.cfg.phases[b.phaseIdx + 1];
    if (next && e.hp / e.hpMax <= next.at) BossBrain.enterPhase(e, w, b.phaseIdx + 1);
    const ph = b.cfg.phases[b.phaseIdx];
    // shield regeneration after the vulnerable window
    if (b.shield && !b.shield.up && w.time >= b.shield.until) BossBrain.raiseShield(e, w, ph);
    if (b.shield?.up) e.bossShield.value = 1;
    else if (b.shield) e.bossShield.value = clamp(1 - (b.shield.until - w.time) / b.shield.window, 0, 1) * 0; // empty while broken
    // hazards (independent of the main rotation)
    (ph.hazards ?? []).forEach((h, i) => {
      if (w.time >= b.hazNext[i] && e.ai.target) { b.hazNext[i] = w.time + h.every; w.abilities.castImmediate(e, h.ab, e.ai.target.x, e.ai.target.z); }
    });
    // summons
    if (ph.summons && w.time >= b.sumNext) {
      b.sumNext = w.time + ph.summons.every;
      const alive = w.entities.filter((o) => o.owner === e && !o.dead).length;
      if (alive < 6 && !e.cast) w.abilities.tryCast(e, ph.summons.ab, e.x, e.z, { free: true });
    }
    // keep the fight inside the arena
    const a = b.cfg.arena && { x: b.home.x, z: b.home.z, r: b.cfg.arena.r };
    if (a) { const d = Math.hypot(e.x - a.x, e.z - a.z); if (d > a.r - 1) { e.x = a.x + (e.x - a.x) / d * (a.r - 1); e.z = a.z + (e.z - a.z) / d * (a.r - 1); } }
    // invulnerable during transitions
    e.invulnerableUntil = e.invulnerableUntil ?? 0;
  },

  engage(e, w, dt, tk, sys) {
    const b = e.boss, ai = e.ai, t = ai.target;
    if (!t) return sys.set(e, 'search');
    if (!b.started) { b.started = true; BossBrain.enterPhase(e, w, 0); w.events.emit('boss:start', { entity: e }); }
    ai.dt = dt;
    const ph = b.cfg.phases[b.phaseIdx];
    const d = tk.dist(e, t);
    if (e.cast) { if (e.cast.phase === 'windup') tk.faceTarget(e, t, dt, b.cfg.style === 'hover' ? 3 : 2.2); return; }
    if (e.dash || w.time < (e.invulnerableUntil ?? 0)) return;
    if (w.time >= b.nextAt) {
      const cands = [];
      for (const r of ph.rotation) {
        if (r.minD !== undefined && d < r.minD) continue;
        if (r.maxD !== undefined && d > r.maxD) continue;
        if (!w.abilities.canCast(e, r.ab).ok) continue;
        cands.push(r);
      }
      if (cands.length) {
        const r = w.rng.weighted(cands, (x) => x.w ?? 1);
        if (tk.tryAbility(e, w, r.ab, t)) {
          const diffAi = w.balance.d.enemyDamage.difficultyAi[w.difficulty] ?? 1;
          b.nextAt = w.time + w.rng.range(ph.gap[0], ph.gap[1]) / diffAi;
          return;
        }
      }
    }
    // positioning
    if (b.cfg.style === 'hover') {
      const [min, max] = ph.range ?? b.cfg.range ?? [7, 11];
      if (d < min) tk.moveAway(e, t.x, t.z, 0.85);
      else if (d > max) tk.followTo(sys, e, t.x, t.z, 0.9, dt);
      else { if (ai.sT === undefined || w.time > ai.sT) { ai.sT = w.time + 2 + w.rng.next() * 2; ai.sDir = w.rng.sign(); } tk.strafe(e, t, ai.sDir, 0.45, 0); }
    } else {
      const reach = (b.cfg.reach ?? 3.4) + t.radius;
      if (d > reach * 0.8) tk.followTo(sys, e, t.x, t.z, 1, dt); else tk.faceTarget(e, t, dt);
    }
  },
};

BRAINS.boss = BossBrain;
