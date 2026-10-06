/**
 * AiSystem — modular enemy AI. A shared FSM (idle/patrol/investigate/alert/chase/attack/retreat/flank/
 * support/search/return/special) + pluggable "brains" (ai/brains.js) that decide *how* each state behaves.
 * Distance LOD: far enemies sleep; mid-range ones think at half rate.
 */
import { angleTo, dist2, turnToward, clamp } from '../../core/math.js';
import { BRAINS } from './brains.js';
import './boss.js';
import { logger } from '../../core/logger.js';
import * as tk from './toolkit.js';

const log = logger('ai');

export class AiSystem {
  constructor(world) {
    this.w = world;
    this.pathBudget = 0;
    this.stats = { thinks: 0, skipped: 0, asleep: 0, paths: 0 };
  }

  update(dt) {
    const w = this.w;
    const pl = w.player;
    const bal = w.balance.d.aggro;
    this.pathBudget = 10;
    this.stats.thinks = this.stats.skipped = this.stats.asleep = 0;
    const odd = w.tickCount & 1;
    for (const e of w.entities) {
      if (e.kind !== 'enemy' && e.kind !== 'summon') continue;
      if (e.dead || e.removed) continue;
      if (e.lifetimeEnd && w.time > e.lifetimeEnd) { w.kill(e, null); continue; }
      const far = pl ? Math.hypot(e.x - pl.x, e.z - pl.z) : 0;
      if (pl && far > bal.sleepRadius && e.ai.state === 'idle') { e.asleep = true; e.intent = null; this.stats.asleep++; continue; }
      e.asleep = false;
      if (pl && far > bal.activeRadius && ((e.uid + w.tickCount) & 1) !== 0) { this.stats.skipped++; continue; }
      this.think(e, dt * (pl && far > bal.activeRadius ? 2 : 1));
      this.stats.thinks++;
    }
  }

  think(e, dt) {
    const w = this.w, ai = e.ai;
    const brain = BRAINS[ai.brain] ?? BRAINS.melee;
    if (!ai.inited) { ai.inited = true; brain.init?.(e, w, tk); }
    ai.stateT += dt;
    e.intent = null;
    ai.dt = dt;
    if (brain.tick) brain.tick(e, w, dt, tk, this);
    if (e.ctl.stunned || e.dash) return;
    if (e.ctl.rooted) { tk.faceTarget(e, ai.target, dt); }

    // perception
    this.perceive(e, dt);

    switch (ai.state) {
      case 'idle': this.sIdle(e, dt, brain); break;
      case 'patrol': this.sPatrol(e, dt, brain); break;
      case 'investigate': this.sInvestigate(e, dt, brain); break;
      case 'alert': this.sAlert(e, dt, brain); break;
      case 'search': this.sSearch(e, dt, brain); break;
      case 'return': this.sReturn(e, dt, brain); break;
      case 'retreat': brain.retreat ? brain.retreat(e, w, dt, tk, this) : this.sRetreat(e, dt); break;
      case 'chase': case 'attack': case 'flank': case 'support': case 'special':
        if (brain.engage) brain.engage(e, w, dt, tk, this); else this.defaultEngage(e, dt, brain);
        break;
      default: this.set(e, 'idle');
    }
  }

  set(e, state) { if (e.ai.state !== state) { e.ai.state = state; e.ai.stateT = 0; this.w.events.emit('ai:state', { entity: e, state }); } }

  // ───────────────────────── perception
  perceive(e, dt) {
    const w = this.w, ai = e.ai;
    if (ai.tauntUntil > w.time && ai.target && !ai.target.dead) return;
    const cfg = ai.cfg;
    const pl = w.player;
    if (ai.target && (ai.target.dead || ai.target.removed)) { ai.target = null; }
    if (!pl || pl.dead) { if (ai.target === pl) ai.target = null; return; }
    const diffAi = w.balance.d.enemyDamage.difficultyAi[w.difficulty] ?? 1;
    let range = (cfg.aggroRange ?? 13) * (0.9 + 0.1 * diffAi);
    if (pl.ctl.cloaked) range *= 0.25;
    if (pl.flags.has('cloakWalk')) range *= 0.7;
    if (e.hidden) range = Math.min(range, cfg.ambushRange ?? 5);
    const d2 = dist2(e.x, e.z, pl.x, pl.z);
    const sees = d2 < range * range && (ai.sightT = (ai.sightT ?? 0) + dt) >= 0;
    if (sees && (!ai.losAt || w.time - ai.losAt > 0.25)) { ai.losAt = w.time; ai.los = w.nav.los(e.x, e.z, pl.x, pl.z, 0.2); }
    if (d2 < range * range && ai.los) {
      ai.lastSeen = { x: pl.x, z: pl.z, t: w.time };
      if (!ai.target && ai.state !== 'alert') {
        // facing cone for non-alert idle enemies (back-stab possible): within 2.5 m always notice
        const ang = Math.abs(angleDiffTo(e, pl));
        if (ang < (cfg.fov ?? Math.PI * 0.75) || d2 < 6.25 || e.alerted) { ai.target = pl; this.onAggro(e); }
      }
    }
    // hearing: player attacks make noise
    if (!ai.target && pl.lastHitTime > w.time - 0.4 && d2 < (cfg.hearRange ?? 16) ** 2 && ai.state !== 'investigate' && ai.state !== 'alert') {
      ai.noise = { x: pl.x, z: pl.z };
      if (ai.state === 'idle' || ai.state === 'patrol') this.set(e, 'investigate');
    }
    // lose target
    if (ai.target && !ai.los && ai.lastSeen && w.time - ai.lastSeen.t > (cfg.loseTime ?? 6)) {
      ai.target = null; this.set(e, 'search');
    }
    if (ai.target && Math.hypot(e.x - ai.home.x, e.z - ai.home.z) > (cfg.leash ?? 38) && !cfg.noLeash) {
      ai.target = null; this.set(e, 'return');
    }
  }

  onAggro(e) {
    const w = this.w, ai = e.ai;
    this.set(e, e.ai.cfg.instantAggro ? 'chase' : 'alert');
    ai.alertDelay = (0.25 + (e.uid % 5) * 0.1) / (w.balance.d.enemyDamage.difficultyAi[w.difficulty] ?? 1);
    w.events.emit('ai:aggro', { entity: e });
    // pack alert
    if (e.group) for (const o of w.entities) if (o !== e && o.group === e.group && !o.dead && o.ai && !o.ai.target && Math.hypot(o.x - e.x, o.z - e.z) < 18) { o.alerted = true; o.ai.target = ai.target; if (o.ai.state === 'idle' || o.ai.state === 'patrol') this.set(o, 'alert'); }
  }

  // ───────────────────────── passive states
  sIdle(e, dt, brain) {
    const ai = e.ai;
    if (ai.target) return this.set(e, 'alert');
    if (e.ai.cfg.patrol && ai.stateT > 1.5 + (e.uid % 4)) return this.set(e, 'patrol');
    if (brain.idle) return brain.idle(e, this.w, dt, tk);
    // small wander
    ai.wander ??= null;
    if (!ai.wander && ai.stateT > 2 + (e.uid % 5)) {
      const a = (e.uid * 2.399 + this.w.time) % 6.28, r = 1 + (e.uid % 3);
      ai.wander = { x: ai.home.x + Math.sin(a) * r, z: ai.home.z + Math.cos(a) * r };
      ai.stateT = 0;
    }
    if (ai.wander) {
      if (tk.stepToward(e, ai.wander.x, ai.wander.z, 0.35) < 0.4) { ai.wander = null; ai.stateT = 0; }
    }
  }

  sPatrol(e, dt) {
    const ai = e.ai, pts = ai.cfg.patrol ?? [];
    if (ai.target) return this.set(e, 'alert');
    if (!pts.length) return this.set(e, 'idle');
    ai.pIdx ??= 0;
    const p = pts[ai.pIdx % pts.length];
    const tx = ai.home.x + p[0], tz = ai.home.z + p[1];
    if (tk.followTo(this, e, tx, tz, 0.5, dt) < 0.8) { ai.pIdx++; if (ai.cfg.patrolPause) this.set(e, 'idle'); }
  }

  sInvestigate(e, dt) {
    const ai = e.ai;
    if (ai.target) return this.set(e, 'alert');
    const n = ai.noise;
    if (!n) return this.set(e, 'return');
    if (tk.followTo(this, e, n.x, n.z, 0.6, dt) < 1.2 || ai.stateT > 6) { ai.noise = null; this.set(e, 'search'); }
  }

  sAlert(e, dt) {
    const ai = e.ai;
    tk.faceTarget(e, ai.target, dt, 10);
    if (ai.stateT >= (ai.alertDelay ?? 0.4)) this.set(e, ai.target ? 'chase' : 'search');
  }

  sSearch(e, dt) {
    const ai = e.ai;
    if (ai.target) return this.set(e, 'alert');
    const ls = ai.lastSeen;
    if (ls && ai.stateT < 3) { if (tk.followTo(this, e, ls.x, ls.z, 0.7, dt) < 1) { e.yaw += dt * 2.2; } }
    else if (ai.stateT > (ai.cfg.searchTime ?? 5)) this.set(e, 'return');
    else e.yaw += dt * 1.6;
  }

  sReturn(e, dt) {
    const ai = e.ai;
    if (ai.target) return this.set(e, 'alert');
    const d = tk.followTo(this, e, ai.home.x, ai.home.z, 0.8, dt);
    if (d < 1) { this.set(e, 'idle'); e.hp = Math.min(e.hpMax, e.hp + e.hpMax * 0.5); }
  }

  sRetreat(e, dt) {
    const ai = e.ai, t = ai.target;
    if (!t) return this.set(e, 'return');
    tk.moveAway(e, t.x, t.z, 1.1);
    if (ai.stateT > 2.5) this.set(e, 'chase');
  }

  // ───────────────────────── engaged default (melee)
  defaultEngage(e, dt, brain) { BRAINS.melee.engage(e, this.w, dt, tk, this); }
}

function angleDiffTo(e, t) {
  const want = angleTo(e.x, e.z, t.x, t.z);
  let d = want - e.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
