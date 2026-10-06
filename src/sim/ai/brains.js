/**
 * Brains — each decides how an engaged enemy moves and when it uses its (data-defined) abilities.
 * They share the FSM in ai.js. Parameters come from enemy.ai in JSON, so variants need no code.
 */
import { angleTo, TAU } from '../../core/math.js';

const speedOf = (e) => e.ai.cfg.speedMult ?? 1;

/** common: pick & cast an ability if possible; returns true if casting started */
function attackIfPossible(e, w, tk, t, d, filter) {
  if (e.cast || (e.ai.nextActionT ?? 0) > w.time) return false;
  const id = tk.pickAbility(e, w, t, d, filter);
  if (!id) return false;
  if (tk.tryAbility(e, w, id, t)) {
    const diffAi = w.balance.d.enemyDamage.difficultyAi[w.difficulty] ?? 1;
    e.ai.nextActionT = w.time + (e.ai.cfg.actionGap ?? 0.5) / diffAi * (0.7 + w.rng.next() * 0.6);
    return true;
  }
  return false;
}

function lowHpRetreat(e, w, sys) {
  const th = e.ai.cfg.retreatHp;
  if (th && e.hp / e.hpMax < th && !e.ai.retreated) { e.ai.retreated = true; sys.set(e, 'retreat'); return true; }
  return false;
}

export const BRAINS = {
  // ───────────────────────── melee: approach, hold ring when tokens are taken, strike
  melee: {
    init(e, w, tk) { e.ai.dir = e.uid % 2 ? 1 : -1; },
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      if (lowHpRetreat(e, w, sys)) return;
      ai.dt = dt;
      const d = tk.dist(e, t);
      const reach = (ai.cfg.attackRange ?? 2.2) + t.radius;
      if (e.cast) { if (e.cast.phase === 'windup') tk.faceTarget(e, t, dt, 2); return; }
      const maxTok = ai.cfg.tokens ?? (3 + (w.difficulty === 'chorister' ? 1 : 0) + (w.difficulty === 'maestro' ? 2 : 0));
      const near = d < 7;
      const hasToken = !near || tk.requestToken(w, e, maxTok);
      if (!hasToken) { // orbit at a ring distance, keeping pressure but not piling in
        if (d < 4.5) tk.moveAway(e, t.x, t.z, 0.6); else tk.strafe(e, t, ai.dir, 0.55, d > 6.5 ? 0.35 : 0);
        sys.set(e, 'chase');
        return;
      }
      sys.set(e, d < reach + 0.5 ? 'attack' : 'chase');
      if (d <= reach + 0.3) { if (attackIfPossible(e, w, tk, t, d)) return; tk.faceTarget(e, t, dt); if (d < reach * 0.6) tk.moveAway(e, t.x, t.z, 0.5); else tk.strafe(e, t, ai.dir, 0.35); }
      else tk.followTo(sys, e, t.x, t.z, speedOf(e), dt);
    },
  },

  // ───────────────────────── flanker: curves around to the target's side/back, pounce, then breaks away
  flanker: {
    init(e) { e.ai.side = e.uid % 2 ? 1 : -1; },
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) { if (e.cast.phase === 'windup') tk.faceTarget(e, t, dt, 3); return; }
      if (ai.retreatUntil > w.time) { tk.moveAway(e, t.x, t.z, 1.15); sys.set(e, 'retreat'); return; }
      if (attackIfPossible(e, w, tk, t, d)) { ai.hits = (ai.hits ?? 0) + 1; if (ai.cfg.hitAndRun && ai.hits % 2 === 0) ai.retreatUntil = w.time + 1.1; return; }
      // flank: go to a point at ~70° from the player's facing line so it arrives from the side
      const pf = t.yaw ?? 0;
      const ang = pf + ai.side * (Math.PI * 0.62);
      const rad = Math.max(3.2, Math.min(d, 7));
      const fx = t.x + Math.sin(ang) * rad * 0.8, fz = t.z + Math.cos(ang) * rad * 0.8;
      sys.set(e, 'flank');
      if (d > 8) tk.followTo(sys, e, t.x, t.z, 1.05, dt);
      else if (d > (ai.cfg.pounceRange ?? 4.5)) tk.followTo(sys, e, fx, fz, 1.1, dt);
      else tk.followTo(sys, e, t.x, t.z, 1.1, dt);
    },
  },

  // ───────────────────────── charger: positions at distance, telegraphs, charges in a line; stuns itself on walls
  charger: {
    init(e) { e.ai.dir = e.uid % 2 ? 1 : -1; e.onCrash = null; },
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) { if (e.cast.phase === 'windup') tk.faceTarget(e, t, dt, 1.2); return; }
      if (e.dash) return;
      if (attackIfPossible(e, w, tk, t, d)) return;
      if (d < 3) tk.moveAway(e, t.x, t.z, 0.8); else if (d > 12) tk.followTo(sys, e, t.x, t.z, 1, dt); else tk.strafe(e, t, ai.dir, 0.6, 0);
      tk.faceTarget(e, t, dt, 3);
    },
    tick(e, w) { // crash detection: dash ended early against a wall → self stun (environment use)
      const ai = e.ai;
      if (e.dash) { ai.wasDashing = true; ai.dashStart ??= { x: e.x, z: e.z }; }
      else if (ai.wasDashing) {
        ai.wasDashing = false;
        const c = e.cast; // cast phase info not needed
        const travelled = ai.dashStart ? Math.hypot(e.x - ai.dashStart.x, e.z - ai.dashStart.z) : 99;
        ai.dashStart = null;
        const planned = ai.cfg.chargeDist ?? 9;
        if (travelled < planned * 0.8 && ai.cfg.crashStun !== 0) {
          w.status.apply(e, 'st.stunned', { duration: ai.cfg.crashStun ?? 2.2 });
          w.status.apply(e, 'st.vulnerable', { duration: ai.cfg.crashStun ?? 2.2 });
          w.events.emit('ai:crash', { entity: e });
        }
      }
    },
  },

  // ───────────────────────── kiter: holds a band of distance, strafes, shoots; runs when approached
  kiter: {
    init(e) { e.ai.dir = e.uid % 2 ? 1 : -1; },
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      if (lowHpRetreat(e, w, sys)) return;
      ai.dt = dt;
      const d = tk.dist(e, t);
      const min = ai.cfg.minRange ?? 6, max = ai.cfg.maxRange ?? 11;
      if (e.cast) { if (e.cast.phase === 'windup') tk.faceTarget(e, t, dt, 2.5); return; }
      if (ai.strafeT === undefined || w.time > ai.strafeT) { ai.strafeT = w.time + 1.2 + w.rng.next() * 1.5; ai.dir = w.rng.sign(); }
      const los = tk.hasLos(w, e, t);
      if (los && attackIfPossible(e, w, tk, t, d)) return;
      if (d < min) { tk.moveAway(e, t.x, t.z, 1.1); sys.set(e, 'retreat'); }
      else if (d > max || !los) { sys.set(e, 'chase'); tk.followTo(sys, e, t.x, t.z, 1, dt); }
      else { sys.set(e, 'attack'); tk.strafe(e, t, ai.dir, 0.5, 0); }
    },
  },

  // ───────────────────────── artillery: far, slow to reposition, lobs with long telegraphs
  artillery: {
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) return;
      if (attackIfPossible(e, w, tk, t, d)) return;
      const min = ai.cfg.minRange ?? 8, max = ai.cfg.maxRange ?? 15;
      if (d < min) { tk.moveAway(e, t.x, t.z, 0.9); sys.set(e, 'retreat'); }
      else if (d > max) { tk.followTo(sys, e, t.x, t.z, 0.9, dt); sys.set(e, 'chase'); }
      else { sys.set(e, 'attack'); tk.faceTarget(e, t, dt, 3); }
    },
  },

  // ───────────────────────── swarm: erratic approach, collective rushes (flying small things)
  swarm: {
    init(e) { e.ai.phase = e.uid * 1.7; },
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) return;
      if (attackIfPossible(e, w, tk, t, d)) return;
      const wob = Math.sin(w.time * 3 + ai.phase) * 0.9;
      const a = angleTo(e.x, e.z, t.x, t.z) + wob * (d > 3 ? 0.6 : 1.2);
      e.intent = { x: Math.sin(a), z: Math.cos(a), speedMult: 1.0 + (d > 6 ? 0.2 : 0) };
      e.yaw = a;
      sys.set(e, d < 3 ? 'attack' : 'chase');
    },
  },

  // ───────────────────────── ambusher: buried & invisible until the target is close (revealed by Listen)
  ambusher: {
    init(e) { e.hidden = true; e.untargetable = true; e.hiddenFromAi = true; e.noSeparate = true; e.ai.buried = true; },
    idle(e, w) { e.intent = null; },
    tick(e, w, dt, tk, sys) {
      const ai = e.ai, t = w.player;
      if (ai.buried && t && !t.dead) {
        const d = tk.dist(e, t);
        const trigger = ai.cfg.ambushRange ?? 4.5;
        if (d < trigger && ai.stateT > 0.2 && !ai.ambushing) {
          ai.ambushing = true;
          ai.target = t;
          e.untargetable = false; e.hidden = false; e.hiddenFromAi = false;
          ai.buried = false;
          w.events.emit('ai:ambush', { entity: e });
          if (ai.cfg.emergeAbility) { w.abilities.tryCast(e, ai.cfg.emergeAbility, t.x, t.z, { free: true, target: t.uid }); }
          sys.set(e, 'chase');
          e.noSeparate = false;
        }
      }
    },
    engage: undefined,
  },

  // ───────────────────────── support: heal / buff allies, stay behind them, flee from the player
  support: {
    init(e) { e.ai.dir = e.uid % 2 ? 1 : -1; },
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      ai.dt = dt;
      const allies = tk.alliesNear(w, e, ai.cfg.supportRange ?? 14, (o) => o.kind === 'enemy' || o.kind === 'summon');
      const hurt = allies.filter((o) => o.hp / o.hpMax < 0.85).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
      if (e.cast) return;
      if (hurt) {
        const d = tk.dist(e, hurt);
        const id = tk.pickAbility(e, w, hurt, d, (ab) => ab.ai?.support);
        if (id && tk.tryAbility(e, w, id, hurt)) { ai.nextActionT = w.time + 0.8; return; }
        if (d > 7) { sys.set(e, 'support'); tk.followTo(sys, e, hurt.x, hurt.z, 1, dt); return; }
      }
      if (t) {
        const d = tk.dist(e, t);
        if (attackIfPossible(e, w, tk, t, d, (ab) => !ab.ai?.support)) return;
        // stay behind the nearest ally relative to the player; flee if player is close
        if (d < (ai.cfg.minRange ?? 7)) { tk.moveAway(e, t.x, t.z, 1.1); sys.set(e, 'retreat'); return; }
        const front = allies.sort((a, b) => tk.dist(a, t) - tk.dist(b, t))[0];
        if (front && d > (ai.cfg.maxRange ?? 12)) tk.followTo(sys, e, front.x, front.z, 0.9, dt);
        else tk.strafe(e, t, ai.dir, 0.35, 0);
      } else sys.set(e, 'search');
    },
  },

  // ───────────────────────── summoner: keeps away, summons when few minions, casts cursing bolts otherwise
  summoner: {
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) { if (e.cast.phase === 'windup') tk.faceTarget(e, t, dt, 2); return; }
      const minions = w.entities.filter((o) => o.owner === e && !o.dead).length;
      if (minions < (ai.cfg.maxMinions ?? 3)) {
        const id = e.abilityIds.find((i) => w.abilities.resolve(e, i)?.ai?.summon);
        if (id && tk.tryAbility(e, w, id, t)) return;
      }
      if (attackIfPossible(e, w, tk, t, d, (ab) => !ab.ai?.summon)) return;
      if (d < (ai.cfg.minRange ?? 8)) { tk.moveAway(e, t.x, t.z, 1); sys.set(e, 'retreat'); }
      else if (d > (ai.cfg.maxRange ?? 13)) { tk.followTo(sys, e, t.x, t.z, 0.9, dt); sys.set(e, 'chase'); }
      else { tk.strafe(e, t, e.uid % 2 ? 1 : -1, 0.3); sys.set(e, 'attack'); }
    },
  },

  // ───────────────────────── tank/guard: slow advance, positions between player and the weakest ally (artillery)
  guard: {
    init(e) { e.ai.dir = e.uid % 2 ? 1 : -1; },
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) { if (e.cast.phase === 'windup') tk.faceTarget(e, t, dt, 1.5); return; }
      // protect: nearest ranged ally
      const prot = ai.cfg.protect ? tk.alliesNear(w, e, 16, (o) => (o.role ?? []).some((r) => ['artillery', 'ranged', 'support'].includes(r))).sort((a, b) => tk.dist(a, t) - tk.dist(b, t))[0] : null;
      const reach = (ai.cfg.attackRange ?? 2.4) + t.radius;
      if (d <= reach + 0.2 && attackIfPossible(e, w, tk, t, d)) return;
      if (prot && d > reach + 3) {
        // stand 2.5 m in front of the protectee toward the player
        const vx = t.x - prot.x, vz = t.z - prot.z, l = Math.hypot(vx, vz) || 1;
        const gx = prot.x + vx / l * 2.8, gz = prot.z + vz / l * 2.8;
        sys.set(e, 'support');
        if (tk.dist(e, { x: gx, z: gz }) > 1) tk.followTo(sys, e, gx, gz, 0.9, dt); else tk.faceTarget(e, t, dt);
        return;
      }
      sys.set(e, d < reach + 0.5 ? 'attack' : 'chase');
      if (d > reach) tk.followTo(sys, e, t.x, t.z, 0.85, dt); else tk.faceTarget(e, t, dt);
    },
  },

  // ───────────────────────── exploder: rush straight, light the fuse in range, explode (also on death)
  exploder: {
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) { if (e.cast.phase === 'windup') e.intent = { x: Math.sin(e.yaw), z: Math.cos(e.yaw), speedMult: 0.4 }; return; }
      if (d < (ai.cfg.fuseRange ?? 3.2) && attackIfPossible(e, w, tk, t, d)) return;
      sys.set(e, 'chase');
      tk.followTo(sys, e, t.x, t.z, 1.15, dt);
    },
  },

  // ───────────────────────── turret: stationary, rotates, can be disabled by puzzles/events
  turret: {
    init(e) { e.noSeparate = true; e.ai.cfg.noLeash = true; e.ai.cfg.instantAggro = true; },
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (e.disabled) return;
      if (!t) return sys.set(e, 'idle');
      ai.dt = dt;
      const d = tk.dist(e, t);
      tk.faceTarget(e, t, dt, ai.cfg.turnRate ?? 2.2);
      if (e.cast) return;
      if (tk.hasLos(w, e, t)) attackIfPossible(e, w, tk, t, d);
    },
  },

  // ───────────────────────── trapper: keeps distance and lays traps near/ahead of the player
  trapper: {
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) return;
      if (w.time > (ai.trapT ?? 0) && d < 12) {
        const ahead = { x: t.x + (t.vx ?? 0) * 0.6, z: t.z + (t.vz ?? 0) * 0.6, radius: 0.3, uid: t.uid };
        if (tk.tryAbility(e, w, e.abilityIds.find((i) => w.abilities.resolve(e, i)?.ai?.trap) ?? e.abilityIds[0], ahead)) { ai.trapT = w.time + (ai.cfg.trapEvery ?? 4.5); return; }
      }
      if (attackIfPossible(e, w, tk, t, d, (ab) => !ab.ai?.trap)) return;
      if (d < 6) { tk.moveAway(e, t.x, t.z, 1.1); sys.set(e, 'retreat'); }
      else if (d > 12) { tk.followTo(sys, e, t.x, t.z, 1, dt); sys.set(e, 'chase'); }
      else tk.strafe(e, t, e.uid % 2 ? 1 : -1, 0.5);
    },
  },

  // ───────────────────────── hazard: follows a fixed loop path (reaper gear). Not aggro-driven.
  hazard: {
    init(e) { e.noSeparate = true; e.ai.cfg.noLeash = true; e.ai.pIdx = 0; },
    tick(e, w, dt, tk, sys) {
      const ai = e.ai, pts = ai.cfg.track ?? [[0, 0], [8, 0]];
      const p = pts[ai.pIdx % pts.length];
      const tx = ai.home.x + p[0], tz = ai.home.z + p[1];
      tk.stepToward(e, tx, tz, 1);
      if (Math.hypot(tx - e.x, tz - e.z) < 0.4) ai.pIdx++;
      ai.dt = dt;
      // contact damage via ability pulses
      if (!e.cast && w.player && tk.dist(e, w.player) < (ai.cfg.contactRange ?? 1.6)) tk.tryAbility(e, w, e.abilityIds[0], w.player);
      e.ai.state = 'special';
    },
    engage() {},
  },

  // ───────────────────────── controller: mid-range area denial (pulls, zones)
  controller: {
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) { if (e.cast.phase === 'windup') tk.faceTarget(e, t, dt, 2); return; }
      if (attackIfPossible(e, w, tk, t, d)) return;
      const min = ai.cfg.minRange ?? 5, max = ai.cfg.maxRange ?? 10;
      if (d < min) tk.moveAway(e, t.x, t.z, 0.8); else if (d > max) tk.followTo(sys, e, t.x, t.z, 0.9, dt); else tk.strafe(e, t, e.uid % 2 ? 1 : -1, 0.3);
    },
  },

  // ───────────────────────── assassin: cloaks, circles behind, bursts, vanishes
  assassin: {
    engage(e, w, dt, tk, sys) {
      const ai = e.ai, t = ai.target;
      if (!t) return sys.set(e, 'search');
      ai.dt = dt;
      const d = tk.dist(e, t);
      if (e.cast) { if (e.cast.phase === 'windup') tk.faceTarget(e, t, dt, 4); return; }
      if (ai.retreatUntil > w.time) { tk.moveAway(e, t.x, t.z, 1.2); return; }
      if (d < 3 && attackIfPossible(e, w, tk, t, d)) { ai.retreatUntil = w.time + 1.6; return; }
      if (!w.status.has(e, 'st.cloaked') && d > 6 && w.rng.chance(0.02)) w.status.apply(e, 'st.cloaked', { duration: 3 });
      const behind = { x: t.x - Math.sin(t.yaw ?? 0) * 2.2, z: t.z - Math.cos(t.yaw ?? 0) * 2.2 };
      sys.set(e, 'flank');
      tk.followTo(sys, e, behind.x, behind.z, 1.2, dt);
    },
  },
};
BRAINS.boss = BRAINS.melee; // replaced at runtime by bosses/ scripts when they register
