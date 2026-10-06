/**
 * AbilityRuntime — executes data-driven abilities for ANY entity (player skills, enemy attacks, voices).
 *
 *  resolve():    base JSON  +  patches from talents/uniques/gems  →  concrete ability (cached per entity version)
 *  tryCast():    gating (stun/silence/cd/cost) → pay → cadence chord → windup → impact → recover
 *  impact():     runs `effects[]` (area / projectile / dash / blink / buff / heal / shield / summon / zone / trap …)
 *  hit ops:      damage / status / knockback / pull / heal / resource / cleanse  — applied per target
 *
 * Adding a new ability = adding JSON. Adding a new effect op = one function in EFFECTS.
 */
import { clone, getPath, setPath, angleTo, turnToward, TAU } from '../core/math.js';
import { logger } from '../core/logger.js';
import { shapeContains, shapeReach } from './shapes.js';
import { Cadence } from './cadence.js';

const log = logger('abilities');
const DEG = Math.PI / 180;

export class AbilityRuntime {
  constructor(world) {
    this.w = world;
    this.cadence = new Cadence(world);
    this.projUid = 1;
  }

  // ───────────────────────── resolution (patches)
  resolve(e, id) {
    const key = `${id}@${e.abVersion ?? 0}`;
    e._abCache ??= new Map();
    let ab = e._abCache.get(key);
    if (ab) return ab;
    const base = this.w.registry.get(id);
    if (!base || base.kind !== 'ability') { log.warn(`missing ability ${id}`); return null; }
    ab = clone(base);
    ab.id = base.id;
    ab.tags ??= [];
    ab.cast ??= { windup: 0.2, recover: 0.2 };
    for (const p of e.patches ?? []) {
      if (!matches(p, ab)) continue;
      try { applyPatch(ab, p); } catch (err) { log.warn(`patch ${p.id ?? '?'} failed on ${id}: ${err.message}`); }
    }
    e._abCache.set(key, ab);
    return ab;
  }
  invalidate(e) { e.abVersion = (e.abVersion ?? 0) + 1; e._abCache?.clear(); }

  // ───────────────────────── gating
  cooldownLeft(e, id) { return Math.max(0, (e.cd[id] ?? 0) - this.w.time); }
  chargesOf(e, ab) {
    if (!ab.charges) return null;
    const max = ab.slotType === 'dodge' ? e.stats.get('dodgeCharges') : ab.charges;
    e.chg ??= {};
    const c = (e.chg[ab.id] ??= { n: max, at: 0 });
    if (c.n > max) c.n = max;
    return { c, max };
  }

  canCast(e, id, opts = {}) {
    if (e.dead || e.ctl.stunned) return { ok: false, reason: 'stunned' };
    const ab = this.resolve(e, id);
    if (!ab) return { ok: false, reason: 'missing' };
    if (e.ctl.silenced && ab.slotType !== 'primary' && ab.slotType !== 'dodge' && ab.slotType !== 'enemyBasic') return { ok: false, reason: 'silenced' };
    if (e.cast && !opts.interrupt) {
      const c = e.cast;
      const canCancel = (ab.slotType === 'dodge' && c.ab.cast?.dodgeCancel !== false) || (c.phase === 'recover' && c.t >= (c.recover * (c.ab.cast?.cancelAt ?? 1)));
      if (!canCancel) return { ok: false, reason: 'busy' };
    }
    const ch = this.chargesOf(e, ab);
    if (ch) { if (ch.c.n < 1) return { ok: false, reason: 'cooldown' }; }
    else if ((e.cd[id] ?? 0) > this.w.time) return { ok: false, reason: 'cooldown' };
    if (ab.slotType === 'voice' && (e.voices?.charges ?? 0) < 1) return { ok: false, reason: 'charges' };
    if (ab.cost && !this.w.resources.canAfford(e, ab.cost)) return { ok: false, reason: 'resource' };
    return { ok: true, ab };
  }

  /**
   * Begin casting. aim = world point. opts: {target:uid, free:true (no cost/cd)}
   */
  tryCast(e, id, aimX, aimZ, opts = {}) {
    const chk = this.canCast(e, id, opts);
    if (!chk.ok) { if (opts.report) opts.report.reason = chk.reason; return false; }
    const ab = chk.ab, w = this.w;
    if (e.cast) { this.#cancel(e, 'replaced'); }
    // aim handling
    let ax = aimX, az = aimZ;
    const dx = ax - e.x, dz = az - e.z;
    const dd = Math.hypot(dx, dz);
    let yaw = dd > 0.01 ? Math.atan2(dx, dz) : e.yaw;
    const range = ab.range ?? 0;
    if (ab.aim === 'direction' || ab.aim === 'self') { ax = e.x + Math.sin(yaw) * Math.max(range, 1); az = e.z + Math.cos(yaw) * Math.max(range, 1); }
    else if (ab.aim === 'ground' && range > 0 && dd > range) { ax = e.x + (dx / dd) * range; az = e.z + (dz / dd) * range; }

    if (!opts.free) {
      w.resources.spend(e, ab.cost);
      if (ab.slotType === 'voice') e.voices.charges--;
      this.#startCooldown(e, ab);
    }
    if (ab.gain?.perCast) w.resources.gain(e, ab.gain.perCast, 'cast');

    const speed = ab.cast.noSpeedScale ? 1 : Math.max(0.4, e.stats.get('actionSpeed', ab.tags, e.flags));
    const cast = {
      ab, id, t: 0, phase: 'windup', windup: Math.max(0, (ab.cast.windup ?? 0) / speed), recover: Math.max(0.03, (ab.cast.recover ?? 0.2) / speed),
      aimX: ax, aimZ: az, yaw, moveFactor: ab.cast.moveFactor ?? 0, hitSet: new Set(), targetUid: opts.target ?? null,
      extraMore: 0, areaMult: 1, chord: null, trackFrac: ab.cast.track ?? (e.team === 'player' ? 0 : 0.55), pulses: 0, chanT: 0, chanElapsed: 0, hitBudget: ab.gain?.maxHits ?? 6,
    };
    if (e.team === 'player') e.yaw = yaw;
    e.cast = cast;
    if (ab.tone && e.cadenceEnabled) cast.chord = this.cadence.onCast(e, ab, cast);
    w.metrics.casts++;
    w.events.emit('cast:start', { entity: e, ab, cast });
    if (ab.slotType === 'dodge') this.#onDodgeStart(e, ab);
    if (cast.windup <= 0.001) this.#impact(e, cast);
    return true;
  }

  #startCooldown(e, ab) {
    const rate = Math.max(0.5, e.stats.get('cooldownRate', ab.tags, e.flags));
    const cdBase = (ab.cooldown ?? 0);
    const ch = this.chargesOf(e, ab);
    if (ch) {
      ch.c.n--;
      if (!ch.c.at || ch.c.at < this.w.time) ch.c.at = this.w.time + (cdBase || 1) * (ab.slotType === 'dodge' ? e.stats.get('dodgeCooldown') : 1) / rate;
      return;
    }
    if (cdBase > 0) e.cd[ab.id] = this.w.time + cdBase / rate;
  }

  #cancel(e, reason) {
    if (!e.cast) return;
    this.w.events.emit('cast:cancel', { entity: e, ab: e.cast.ab, reason });
    e.cast = null;
  }
  cancel(e, reason = 'manual') { this.#cancel(e, reason); }

  #onDodgeStart(e, ab) {
    e.dodging = true;
    this.w.resources.onDodge(e, false);
  }

  // ───────────────────────── per-tick cast state
  updateCast(e, dt) {
    // charge recharge
    if (e.chg) for (const id in e.chg) {
      const c = e.chg[id];
      const ab = this.w.registry.get(id);
      if (!ab) continue;
      const max = ab.slotType === 'dodge' ? e.stats.get('dodgeCharges') : ab.charges;
      if (c.n < max && c.at && this.w.time >= c.at) {
        c.n++;
        const rate = Math.max(0.5, e.stats.get('cooldownRate', ab.tags ?? []));
        c.at = c.n < max ? this.w.time + (ab.cooldown || 1) * (ab.slotType === 'dodge' ? e.stats.get('dodgeCooldown') : 1) / rate : 0;
      }
    }
    if (e.shieldExpire && this.w.time > e.shieldExpire) { e.shield = Math.min(e.shield, e.shieldMax || 0); e.shieldExpire = 0; e.hasTempShield = false; }
    const c = e.cast;
    if (!c) return;
    if (e.ctl.stunned && !c.ab.cast.uninterruptible) { this.#cancel(e, 'stunned'); return; }
    c.t += dt;
    if (c.phase === 'windup') {
      // tracking: enemies keep turning toward their target until lock fraction of the windup
      if (e.team !== 'player' && c.windup > 0) {
        const tgt = c.targetUid ? this.w.get(c.targetUid) : e.ai?.target;
        if (tgt && !tgt.dead && c.t < c.windup * c.trackFrac && c.ab.aim !== 'self') {
          const ab = c.ab;
          let ax = tgt.x, az = tgt.z;
          const dx = ax - e.x, dz = az - e.z, dd = Math.hypot(dx, dz);
          if (ab.aim === 'ground' && ab.range && dd > ab.range) { ax = e.x + dx / dd * ab.range; az = e.z + dz / dd * ab.range; }
          if (ab.aim === 'direction') { ax = e.x + dx; az = e.z + dz; }
          c.aimX = ax; c.aimZ = az;
        }
        c.yaw = turnToward(c.yaw, angleTo(e.x, e.z, c.aimX, c.aimZ), (c.ab.cast.turnRate ?? 7) * dt);
        e.yaw = c.yaw;
      }
      if (c.t >= c.windup) this.#impact(e, c);
    } else if (c.phase === 'channel') {
      const ch = c.ab.channel;
      c.chanElapsed += dt; c.chanT += dt;
      // channel aims at the cursor/target continuously
      if (e.team === 'player' && e.aimPoint) { c.aimX = e.aimPoint.x; c.aimZ = e.aimPoint.z; c.yaw = angleTo(e.x, e.z, c.aimX, c.aimZ); e.yaw = c.yaw; }
      const held = e.team === 'player' ? e.channelHeld : true;
      while (c.chanT >= ch.interval) {
        c.chanT -= ch.interval;
        if (ch.costPerTick && !this.w.resources.canAfford(e, ch.costPerTick)) { c.phase = 'recover'; c.t = 0; break; }
        if (ch.costPerTick) this.w.resources.spend(e, ch.costPerTick);
        this.#runEffects(e, c, ch.effects ?? c.ab.effects);
        if (ch.gainPerTick) this.w.resources.gain(e, ch.gainPerTick, 'channel');
      }
      if (!held || c.chanElapsed >= (ch.maxDuration ?? 4)) { c.phase = 'recover'; c.t = 0; }
    } else if (c.phase === 'recover') {
      if (c.t >= c.recover) { e.cast = null; e.dodging = e.dash ? e.dodging : false; this.w.events.emit('cast:end', { entity: e, ab: c.ab }); }
    }
  }

  #impact(e, c) {
    const ab = c.ab;
    c.t = 0;
    if (ab.channel) { c.phase = 'channel'; c.chanT = ab.channel.interval; this.w.events.emit('cast:impact', { entity: e, ab, cast: c }); return; }
    c.phase = 'recover';
    this.w.events.emit('cast:impact', { entity: e, ab, cast: c });
    this.#runEffects(e, c, ab.effects);
    if (c.chord?.type === 'unison') this.cadence.afterUnison(e, c);
  }

  #runEffects(e, c, effects) {
    for (const eff of effects ?? []) {
      const fn = EFFECTS[eff.op];
      if (!fn) { log.warn(`unknown effect op ${eff.op} in ${c.ab.id}`); continue; }
      if (eff.delay) { this.later(eff.delay, () => { if (!e.dead) fn(this, e, c, eff); }); continue; }
      fn(this, e, c, eff);
    }
  }
  later(delay, fn) { (this.w.timers ??= []).push({ at: this.w.time + delay, fn }); }
  runTimers() {
    const ts = this.w.timers; if (!ts?.length) return;
    for (let i = ts.length - 1; i >= 0; i--) if (this.w.time >= ts[i].at) { const t = ts.splice(i, 1)[0]; try { t.fn(); } catch (err) { log.error('timer failed', err); } }
  }

  // ───────────────────────── helpers used by effects
  origin(e, c, eff) {
    switch (eff.origin ?? 'self') {
      case 'aim': return { x: c.aimX, z: c.aimZ };
      case 'target': { const t = c.targetUid ? this.w.get(c.targetUid) : e.ai?.target; return t ? { x: t.x, z: t.z } : { x: c.aimX, z: c.aimZ }; }
      default: return { x: e.x, z: e.z };
    }
  }

  /** apply hit ops to a target. returns true if any damage landed */
  applyHit(e, c, target, ops, o = {}) {
    let last = null, landed = false;
    for (const op of ops) {
      switch (op.op) {
        case 'damage': {
          const res = this.w.hit(e, target, op, c.ab, { extraMore: c.extraMore + (o.extraMore ?? 0), damageMult: o.damageMult });
          if (res) { last = res; landed = true; if (c.ab.gain?.perHit && c.hitBudget > 0) { c.hitBudget--; this.w.resources.gain(e, c.ab.gain.perHit, 'abilityHit'); } }
          break;
        }
        case 'status': {
          if (target.dead) break;
          const chance = (op.chance ?? 1) + (op.chance !== undefined && e.team === 'player' ? e.stats.get('statusChance', c.ab.tags, e.flags) : 0);
          if (chance < 1 && this.w.rng.next() >= chance) break;
          const def = this.w.registry.get(op.id);
          if (!def) break;
          const snap = last?.base ?? (def.behavior === 'dot' ? this.w.dmg.roll(e, { type: def.damageType, coef: op.coef ?? 1, scaling: op.scaling }, c.ab.tags, this.w.rng, { noCrit: true }).amount : 0);
          const pot = (op.potency ?? 1) * (e.team === 'player' ? e.stats.get('statusPotency', c.ab.tags, e.flags) : 1);
          const dm = (e.team === 'player' ? e.stats.get('statusDuration', c.ab.tags, e.flags) : 1);
          this.w.status.apply(target, op.id, { source: e, snapshot: snap, potency: pot, durMult: dm, duration: op.duration, build: op.build, stacks: op.stacks });
          break;
        }
        case 'knockback': {
          const org = o.origin ?? { x: e.x, z: e.z };
          this.w.knockback(target, org.x, org.z, op.force ?? 2, op.duration);
          break;
        }
        case 'pull': { const org = o.origin ?? { x: e.x, z: e.z }; this.w.pull(target, org.x, org.z, op.force ?? 3); break; }
        case 'heal': this.w.heal(target, op.pct ? target.hpMax * op.pct : op.amount ?? 0, e); break;
        case 'resource': this.w.resources.gain(e, op.amount, 'hitop'); break;
        case 'cleanse': this.w.status.clear(target, (d) => d.tags?.includes('ailment') || d.tags?.includes('curse')); break;
        case 'taunt': if (target.ai) { target.ai.target = e; target.ai.tauntUntil = this.w.time + (op.duration ?? 3); } break;
        default: log.warn(`unknown hit op ${op.op}`);
      }
    }
    return landed;
  }

  hostiles(e, x, z, r) { return this.w.queryCircle(x, z, r, (o) => this.w.isHostile(e, o) && !o.untargetable && !(o.hidden && !o.revealedHit)); }

  // ───────────────────────── projectiles
  spawnProjectile(e, c, eff, yaw, ox, oz) {
    const w = this.w;
    const tags = c.ab.tags;
    const speed = (eff.speed ?? 14) * (e.team === 'player' ? e.stats.get('projectileSpeed', tags, e.flags) : 1);
    const pierce = (eff.pierce ?? 0) + (e.team === 'player' && tags.includes('projectile') ? e.stats.get('pierce', tags, e.flags) : 0);
    const chain = (eff.chain ?? 0) + (e.team === 'player' && tags.includes('projectile') ? e.stats.get('chain', tags, e.flags) : 0);
    const p = {
      uid: this.projUid++, x: ox, z: oz, yaw, vx: Math.sin(yaw) * speed, vz: Math.cos(yaw) * speed, speed, radius: (eff.radius ?? 0.35) * 1,
      range: (eff.range ?? 16), travelled: 0, pierce, chain, homing: eff.homing ?? 0, team: e.team, source: e, ab: c.ab, cast: c,
      hit: eff.hit ?? [], onHit: eff.onHit ?? null, onEnd: eff.onEnd ?? null, hitSet: new Set(), extraMore: c.extraMore, model: eff.model ?? 'bolt', color: eff.color, gravity: eff.arc ?? 0,
      age: 0, lifetime: eff.lifetime ?? 6, sticky: eff.sticky, wallPass: eff.wallPass, targetPoint: eff.arc ? { x: c.aimX, z: c.aimZ } : null, from: { x: ox, z: oz }, dead: false, bounce: eff.bounce ?? 0,
    };
    if (eff.arc) { // lobbed: flies to aim point in fixed time
      const d = Math.hypot(c.aimX - ox, c.aimZ - oz);
      p.flightT = Math.max(0.2, d / speed); p.vx = (c.aimX - ox) / p.flightT; p.vz = (c.aimZ - oz) / p.flightT; p.range = d + 0.01; p.arcH = eff.arcHeight ?? Math.min(4, d * 0.35);
    }
    w.projectiles.push(p);
    w.events.emit('projectile:spawned', { projectile: p, source: e });
    return p;
  }

  updateProjectiles(dt) {
    const w = this.w;
    this.runTimers();
    for (let i = w.projectiles.length - 1; i >= 0; i--) {
      const p = w.projectiles[i];
      if (p.dead) { w.projectiles.splice(i, 1); continue; }
      p.age += dt;
      if (p.age > p.lifetime) { this.#endProjectile(p, 'timeout'); w.projectiles.splice(i, 1); continue; }
      // homing
      if (p.homing > 0 && !p.targetPoint) {
        const t = w.nearestHostile({ team: p.team, x: p.x, z: p.z }, 10, (o) => !p.hitSet.has(o.uid));
        if (t) { const want = angleTo(p.x, p.z, t.x, t.z); p.yaw = turnToward(p.yaw, want, p.homing * dt); p.vx = Math.sin(p.yaw) * p.speed; p.vz = Math.cos(p.yaw) * p.speed; }
      }
      const steps = Math.max(1, Math.ceil(p.speed * dt / Math.max(0.25, p.radius)));
      const sdt = dt / steps;
      let ended = false;
      for (let s = 0; s < steps && !ended; s++) {
        const px = p.x, pz = p.z;
        p.x += p.vx * sdt; p.z += p.vz * sdt;
        p.travelled += p.speed * sdt;
        if (p.targetPoint) {
          const t = Math.min(1, p.age / p.flightT);
          p.h = Math.sin(t * Math.PI) * p.arcH;
          if (p.age >= p.flightT) { p.x = p.targetPoint.x; p.z = p.targetPoint.z; this.#endProjectile(p, 'landed'); ended = true; break; }
          continue;
        }
        if (!p.wallPass && !w.nav.losProjectile(px, pz, p.x, p.z)) {
          if (p.bounce > 0) { p.bounce--; p.vx = -p.vx; p.vz = -p.vz; p.yaw += Math.PI; p.x = px; p.z = pz; continue; }
          this.#endProjectile(p, 'wall'); ended = true; break;
        }
        // collisions
        const cands = w.queryCircle(p.x, p.z, p.radius, (o) => w.isHostile({ team: p.team }, o) && !o.untargetable && !p.hitSet.has(o.uid) && !(o.hidden && !o.revealedHit));
        for (const t of cands) {
          p.hitSet.add(t.uid);
          const c = p.cast;
          c.hitBudget = c.ab.gain?.maxHits ?? 6;
          this.applyHit(p.source, p.cast, t, p.hit, { origin: { x: px, z: pz }, extraMore: p.extraMore });
          w.events.emit('projectile:hit', { projectile: p, target: t });
          if (p.onHit) this.runAt(p.source, p.cast, p.onHit, p.x, p.z, p.yaw);
          if (p.pierce > 0) { p.pierce--; continue; }
          if (p.chain > 0) {
            p.chain--;
            const nxt = w.nearestHostile({ team: p.team, x: p.x, z: p.z }, 7, (o) => !p.hitSet.has(o.uid) && w.nav.losProjectile(p.x, p.z, o.x, o.z));
            if (nxt) { p.yaw = angleTo(p.x, p.z, nxt.x, nxt.z); p.vx = Math.sin(p.yaw) * p.speed; p.vz = Math.cos(p.yaw) * p.speed; w.events.emit('projectile:chain', { projectile: p, target: nxt }); break; }
          }
          this.#endProjectile(p, 'hit'); ended = true; break;
        }
        if (!ended && p.travelled >= p.range) { this.#endProjectile(p, 'range'); ended = true; }
      }
      if (p.dead) w.projectiles.splice(i, 1);
    }
  }

  #endProjectile(p, why) {
    if (p.dead) return;
    p.dead = true;
    if (p.onEnd && why !== 'hit' || (p.onEnd && p.onEnd.always)) this.runAt(p.source, p.cast, Array.isArray(p.onEnd) ? p.onEnd : p.onEnd.effects, p.x, p.z, p.yaw);
    this.w.events.emit('projectile:end', { projectile: p, why });
  }
  /** run effects with a custom origin point (explosions at projectile end) */
  runAt(e, c, effects, x, z, yaw) {
    const c2 = { ...c, aimX: x, aimZ: z, yaw, originOverride: { x, z } };
    for (const eff of effects) {
      const fn = EFFECTS[eff.op];
      if (fn) fn(this, e, c2, { ...eff, origin: 'aim' });
    }
  }

  // ───────────────────────── dash
  updateDash(e, dt) {
    const d = e.dash;
    d.t += dt;
    const step = Math.min(d.speed * dt, d.dist - d.travelled);
    const sx = d.dx * step, sz = d.dz * step;
    const blocked = this.w.nav.moveCircle(e, sx, sz, e.radius);
    d.travelled += step;
    e.vx = d.dx * d.speed; e.vz = d.dz * d.speed;
    if (d.hit?.length) {
      for (const t of this.hostiles(e, e.x, e.z, d.radius ?? 1.2)) {
        if (d.hitSet.has(t.uid)) continue;
        d.hitSet.add(t.uid);
        this.applyHit(e, d.cast, t, d.hit, { origin: { x: e.x - d.dx, z: e.z - d.dz } });
      }
    }
    if (d.travelled >= d.dist - 0.01 || d.t >= d.dur * 1.5 || (blocked && step < 0.02)) this.#endDash(e);
  }
  #endDash(e) {
    const d = e.dash;
    e.dash = null;
    if (d.onEnd) this.runAt(e, d.cast, d.onEnd, e.x, e.z, e.yaw);
    if (d.iframes) { e.dodging = false; }
    this.w.events.emit('dash:end', { entity: e });
  }
}

// ───────────────────────── effects library
const EFFECTS = {
  area(rt, e, c, eff) {
    const w = rt.w;
    const o = c.originOverride && eff.origin === 'aim' ? c.originOverride : rt.origin(e, c, eff);
    const scale = e.team === 'player' ? e.stats.get('areaSize', c.ab.tags, e.flags) * c.areaMult : 1;
    const shape = { kind: eff.shape ?? 'circle', radius: (eff.radius ?? 3) * (eff.noScale ? 1 : scale), angle: eff.angle, length: eff.length ? eff.length * (eff.noScale ? 1 : scale) : undefined, width: eff.width, inner: eff.inner };
    const yaw = eff.origin === 'aim' && !eff.faceCaster ? c.yaw : c.yaw;
    const targets = w.queryCircle(o.x, o.z, shapeReach(shape), (t) => w.isHostile(e, t) && !t.untargetable && !(t.hidden && !t.revealedHit));
    w.events.emit('area:hit', { entity: e, ab: c.ab, shape, x: o.x, z: o.z, yaw, effect: eff, color: eff.color });
    let n = 0;
    const max = eff.maxTargets ?? 99;
    c.hitBudget = c.ab.gain?.maxHits ?? 6;
    targets.sort((a, b) => (a.x - o.x) ** 2 + (a.z - o.z) ** 2 - ((b.x - o.x) ** 2 + (b.z - o.z) ** 2));
    for (const t of targets) {
      if (!shapeContains(shape, o.x, o.z, yaw, t.x, t.z, t.radius)) continue;
      if (n >= max) break;
      if (rt.applyHit(e, c, t, eff.hit ?? [], { origin: o })) n++; else if (!eff.hit?.some((h) => h.op === 'damage')) n++;
    }
    if (eff.allyHit) for (const t of w.queryCircle(o.x, o.z, shape.radius, (a) => !w.isHostile(e, a) && a.team === e.team && !a.dead)) rt.applyHit(e, c, t, eff.allyHit, { origin: o });
    if (eff.hitSelf) rt.applyHit(e, c, e, eff.hitSelf);
  },

  projectile(rt, e, c, eff) {
    const count = (eff.count ?? 1) + (e.team === 'player' && c.ab.tags.includes('projectile') ? Math.floor(e.stats.get('extraProjectiles', c.ab.tags, e.flags)) : 0);
    const spread = (eff.spread ?? 0) * DEG;
    const o = eff.muzzle === 'ground' || eff.arc ? { x: e.x, z: e.z } : { x: e.x + Math.sin(c.yaw) * (e.radius + 0.2), z: e.z + Math.cos(c.yaw) * (e.radius + 0.2) };
    for (let i = 0; i < count; i++) {
      const off = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
      const jitter = eff.jitter ? (rt.w.rng.next() - 0.5) * eff.jitter * DEG : 0;
      rt.spawnProjectile(e, c, eff, c.yaw + off + jitter, o.x, o.z);
    }
  },

  dash(rt, e, c, eff) {
    const dist = (eff.distance ?? 5) * (eff.noScale ? 1 : 1);
    const dur = Math.max(0.08, (eff.duration ?? 0.25) / (c.ab.slotType === 'dodge' ? 1 : e.stats.get('actionSpeed') * 0.8 + 0.2));
    let dx = Math.sin(c.yaw), dz = Math.cos(c.yaw);
    if (eff.toAim) { const dd = Math.hypot(c.aimX - e.x, c.aimZ - e.z); if (dd > 0.1) { dx = (c.aimX - e.x) / dd; dz = (c.aimZ - e.z) / dd; } }
    if (eff.backward) { dx = -dx; dz = -dz; }
    let d = dist;
    if (eff.toAim) d = Math.min(dist, Math.hypot(c.aimX - e.x, c.aimZ - e.z));
    e.dash = { dx, dz, dist: d, travelled: 0, t: 0, dur, speed: d / dur, hit: eff.hit, hitSet: new Set(), radius: eff.radius, cast: c, iframes: !!eff.iframes, onEnd: eff.onEnd };
    if (eff.iframes) {
      const frac = rt.w.balance.d.dodge.iFrameFraction;
      e.invuln = rt.w.time + dur * frac + (e.stats.get('dodgeIframes') || 0);
      e.dodging = true;
    }
    if (!eff.keepYaw) e.yaw = Math.atan2(dx, dz);
    rt.w.events.emit('dash:start', { entity: e, ab: c.ab, dx, dz, dist: d, dur });
  },

  blink(rt, e, c, eff) {
    const w = rt.w;
    const d0 = Math.hypot(c.aimX - e.x, c.aimZ - e.z);
    const d = Math.min(eff.distance ?? 7, d0 || (eff.distance ?? 7));
    const yaw = c.yaw;
    let tx = e.x + Math.sin(yaw) * d, tz = e.z + Math.cos(yaw) * d;
    // step back until walkable & visible
    for (let k = 0; k < 14 && (!w.nav.isWalkable(tx, tz) || !w.nav.los(e.x, e.z, tx, tz, 0.3)); k++) { tx -= Math.sin(yaw) * 0.5; tz -= Math.cos(yaw) * 0.5; }
    const from = { x: e.x, z: e.z };
    e.x = tx; e.z = tz;
    if (eff.iframes) { e.invuln = w.time + (eff.invuln ?? 0.35); e.dodging = true; rt.later(0.4, () => { e.dodging = false; }); }
    w.events.emit('blink', { entity: e, from, to: { x: tx, z: tz } });
    if (eff.onArrive) rt.runAt(e, c, eff.onArrive, tx, tz, yaw);
    if (eff.onDepart) rt.runAt(e, c, eff.onDepart, from.x, from.z, yaw);
  },

  buff(rt, e, c, eff) {
    const w = rt.w;
    const targets = eff.target === 'allies' ? w.queryCircle(e.x, e.z, eff.radius ?? 8, (a) => a.team === e.team && !a.dead) : [e];
    for (const t of targets) {
      if (eff.excludeSelf && t === e) continue;
      w.status.apply(t, eff.status, { source: e, duration: eff.duration, potency: eff.potency });
    }
    w.events.emit('buff:cast', { entity: e, targets, status: eff.status, radius: eff.radius });
  },

  heal(rt, e, c, eff) {
    const w = rt.w;
    const targets = eff.target === 'allies' ? w.queryCircle(e.x, e.z, eff.radius ?? 8, (a) => a.team === e.team && !a.dead) : [e];
    for (const t of targets) {
      if (eff.excludeSelf && t === e) continue;
      const amt = eff.pct ? t.hpMax * eff.pct : (eff.amount ?? 0);
      w.heal(t, amt, e);
    }
  },

  shield(rt, e, c, eff) {
    const amt = eff.pct ? e.hpMax * eff.pct : (eff.amount ?? 10);
    rt.w.addShield(e, amt * (e.stats.get('shieldPower') || 1), eff.duration ?? 8);
  },

  summon(rt, e, c, eff) {
    const w = rt.w;
    const owned = w.entities.filter((s) => s.owner === e && s.summonSrc === c.ab.id && !s.dead);
    const max = eff.max ?? 4;
    const count = Math.min(eff.count ?? 1, Math.max(0, max - owned.length));
    for (let i = 0; i < count; i++) {
      const ang = c.yaw + (i - (count - 1) / 2) * 0.9 + (eff.ring ? (i / count) * TAU : 0);
      const r = eff.radius ?? 2;
      let x = e.x + Math.sin(ang) * r, z = e.z + Math.cos(ang) * r;
      if (!w.nav.isWalkable(x, z)) { const n = w.nav.nearestWalkable(x, z, 5); if (!n) continue; x = n.x; z = n.z; }
      const s = w.spawnEnemy(eff.enemy, x, z, { level: e.level, team: e.team, tier: eff.tier, hpMult: eff.hpMult, damageMult: eff.damageMult });
      s.owner = e; s.summonSrc = c.ab.id; s.lifetimeEnd = eff.lifetime ? w.time + eff.lifetime : 0;
      s.noLoot = true; s.noXp = true;
      if (eff.inheritStats) s.stats.add('inherit', [{ stat: 'damage', op: 'more', group: 'summon', value: e.stats.get('summonDamage') || 0 }]);
      w.events.emit('summon', { entity: s, owner: e });
    }
  },

  zone(rt, e, c, eff) {
    const o = c.originOverride && eff.origin === 'aim' ? c.originOverride : rt.origin(e, c, eff);
    const scale = e.team === 'player' ? e.stats.get('areaSize', c.ab.tags, e.flags) * c.areaMult : 1;
    const z = {
      uid: rt.projUid++, x: o.x, z: o.z, yaw: c.yaw, shape: eff.shape ?? 'circle', radius: (eff.radius ?? 3) * scale, angle: eff.angle, inner: eff.inner, length: eff.length, width: eff.width,
      duration: eff.duration ?? 4, t: 0, tick: eff.tick ?? 0.5, tickT: eff.firstTick ?? (eff.tick ?? 0.5), team: e.team, source: e, ab: c.ab, cast: c, hit: eff.hit ?? [], allyHit: eff.allyHit ?? null,
      follow: !!eff.follow, color: eff.color ?? 'danger', kind: eff.kind ?? 'zone', arm: eff.arm ?? 0, trigger: eff.trigger, once: !!eff.once, orbit: eff.orbit ?? 0, auraStatus: eff.auraStatus,
      extraMore: c.extraMore, benign: !!eff.benign, fx: eff.fx, onExpire: eff.onExpire, dead: false, id: eff.id ?? null, spin: eff.spin ?? 0,
    };
    if (eff.max) {
      const mine = rt.w.zones.filter((q) => q.source === e && q.ab.id === c.ab.id && !q.dead);
      if (mine.length >= eff.max) mine[0].dead = true;
    }
    rt.w.zones.push(z);
    rt.w.events.emit('zone:spawned', { zone: z });
  },

  resource(rt, e, c, eff) { rt.w.resources.gain(e, eff.amount ?? 0, 'effect'); },

  cooldown(rt, e, c, eff) {
    // reduce cooldowns of abilities with a given tone/tag (Reprise chord, talents)
    for (const id of Object.keys(e.cd)) {
      const ab = rt.w.registry.get(id);
      if (!ab) continue;
      if ((eff.tone && ab.tone === eff.tone) || (eff.tag && ab.tags?.includes(eff.tag)) || eff.all) e.cd[id] -= eff.seconds;
    }
    if (e.chg) for (const id in e.chg) { const ab = rt.w.registry.get(id); if (ab && (eff.all || (eff.tag && ab.tags?.includes(eff.tag))) && e.chg[id].at) e.chg[id].at -= eff.seconds; }
  },

  status(rt, e, c, eff) { rt.w.status.apply(e, eff.id, { source: e, duration: eff.duration, potency: eff.potency }); },

  voiceCharge(rt, e, c, eff) { if (e.voices) e.voices.charges = Math.min(e.voices.max, e.voices.charges + (eff.amount ?? 1)); },

  telegraphOnly() { /* visual-only marker; the client reads cast state */ },

  spawnObject(rt, e, c, eff) {
    const w = rt.w;
    const o = rt.origin(e, c, eff);
    const obj = w.makeObject({ id: eff.id, x: o.x, z: o.z, radius: eff.radius ?? 0.5, hp: eff.hp ?? 1, team: e.team, level: e.level, untargetable: !eff.targetable });
    obj.lifetimeEnd = eff.lifetime ? w.time + eff.lifetime : 0; obj.owner = e;
    return obj;
  },
};
export const EFFECT_OPS = Object.keys(EFFECTS);

// ───────────────────────── zones
AbilityRuntime.prototype.updateZones = function updateZones(dt) {
  const w = this.w;
  for (let i = w.zones.length - 1; i >= 0; i--) {
    const z = w.zones[i];
    if (z.dead || z.source?.removed) { w.zones.splice(i, 1); continue; }
    z.t += dt;
    if (z.follow && z.source && !z.source.dead) { z.x = z.source.x; z.z = z.source.z; if (z.spin) z.yaw += z.spin * dt; }
    if (z.follow && z.source?.dead) { z.dead = true; continue; }
    if (z.t >= z.duration) {
      if (z.onExpire) this.runAt(z.source, z.cast, z.onExpire, z.x, z.z, z.yaw);
      w.events.emit('zone:end', { zone: z });
      w.zones.splice(i, 1);
      continue;
    }
    if (z.t < z.arm) continue;
    const shape = { kind: z.shape, radius: z.radius, angle: z.angle, inner: z.inner, length: z.length, width: z.width };
    if (z.trigger === 'proximity') {
      const near = w.queryCircle(z.x, z.z, z.radius, (o) => w.isHostile({ team: z.team }, o) && !o.untargetable && !o.hidden);
      if (near.length) {
        for (const t of near) this.applyHit(z.source, z.cast, t, z.hit, { origin: { x: z.x, z: z.z }, extraMore: z.extraMore });
        w.events.emit('zone:trigger', { zone: z });
        if (z.once) z.t = z.duration;
      }
      continue;
    }
    if (z.auraStatus) {
      for (const t of w.queryCircle(z.x, z.z, z.radius + 1, (o) => w.isHostile({ team: z.team }, o) && !o.dead)) {
        if (shapeContains(shape, z.x, z.z, z.yaw, t.x, t.z, t.radius)) w.status.apply(t, z.auraStatus, { source: z.source, silent: true });
      }
    }
    z.tickT -= dt;
    if (z.tickT <= 0 && (z.hit.length || z.allyHit)) {
      z.tickT += z.tick;
      z.cast.hitBudget = 3;
      for (const t of w.queryCircle(z.x, z.z, z.radius + 1, (o) => !o.dead && !o.untargetable)) {
        if (!shapeContains(shape, z.x, z.z, z.yaw, t.x, t.z, t.radius)) continue;
        if (w.isHostile({ team: z.team }, t)) this.applyHit(z.source, z.cast, t, z.hit, { origin: { x: z.x, z: z.z }, extraMore: z.extraMore });
        else if (z.allyHit && t.team === z.team) this.applyHit(z.source, z.cast, t, z.allyHit, { origin: { x: z.x, z: z.z } });
      }
    }
  }
};

// ───────────────────────── patches
function matches(p, ab) {
  if (p.ability) return p.ability === ab.id;
  if (p.matchTags) return p.matchTags.every((t) => ab.tags.includes(t)) && (!p.excludeTags || !p.excludeTags.some((t) => ab.tags.includes(t)));
  return false;
}

/**
 * Patch ops: set | add | mul | push | remove | merge | addTag | removeTag | replaceEffects
 * path: dotted, array indices numeric ("effects.0.hit.0.coef"). Selector "effects[op=projectile]" picks by field.
 */
export function applyPatch(ab, p) {
  const path = resolveSelectors(ab, p.path);
  switch (p.op) {
    case 'set': setPath(ab, path, clone(p.value)); break;
    case 'add': setPath(ab, path, (getPath(ab, path) ?? 0) + p.value); break;
    case 'mul': setPath(ab, path, (getPath(ab, path) ?? 0) * p.value); break;
    case 'push': { const arr = getPath(ab, path); if (Array.isArray(arr)) arr.push(clone(p.value)); else setPath(ab, path, [clone(p.value)]); break; }
    case 'remove': { const parts = path.split('.'); const idx = Number(parts.pop()); const arr = getPath(ab, parts.join('.')); if (Array.isArray(arr)) arr.splice(idx, 1); break; }
    case 'merge': { const cur = getPath(ab, path) ?? {}; setPath(ab, path, { ...cur, ...clone(p.value) }); break; }
    case 'addTag': for (const t of [].concat(p.value)) if (!ab.tags.includes(t)) ab.tags.push(t); break;
    case 'removeTag': ab.tags = ab.tags.filter((t) => ![].concat(p.value).includes(t)); break;
    case 'replaceEffects': ab.effects = clone(p.value); break;
    case 'setTone': ab.tone = p.value; break;
    default: throw new Error(`unknown patch op ${p.op}`);
  }
}
function resolveSelectors(ab, path) {
  if (!path || !path.includes('[')) return path ?? '';
  return path.replace(/([\w.]+)\[(\w+)=([\w.]+)\]/g, (m, arrPath, field, val) => {
    const arr = getPath(ab, arrPath.replace(/^\./, ''));
    const i = Array.isArray(arr) ? arr.findIndex((x) => String(x[field]) === val) : -1;
    if (i < 0) throw new Error(`selector ${m} not found`);
    return `${arrPath}.${i}`;
  });
}
