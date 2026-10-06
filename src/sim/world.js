/**
 * World — the headless, deterministic simulation container.
 * Fixed 60 Hz step. Knows nothing about rendering, DOM or audio: the client observes it through
 * `world.events` and by reading entity state. Everything random goes through world.rng.
 */
import { Rng } from '../core/rng.js';
import { EventBus } from '../core/events.js';
import { logger } from '../core/logger.js';
import { dist2, clamp } from '../core/math.js';
import { StatusSystem } from './status.js';
import { DamageModel } from './damage.js';
import { Balance } from './balance.js';
import { statDefsFrom } from './stats.js';
import { createEnemy, baseEntity, syncLife } from './entity.js';
import { AbilityRuntime } from './abilities.js';
import { ResourceSystem } from './resources.js';
import { AiSystem } from './ai/ai.js';
import { PlayerController } from './controller.js';
import { ListenSystem } from './listen.js';
import { TriggerSystem } from './triggers.js';
import { ElitesSystem, pickEliteMods } from './director/elites.js';

const log = logger('world');
export const STEP = 1 / 60;

class SpatialHash {
  constructor(cell = 4) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  key(cx, cz) { return (cx + 4096) * 8192 + (cz + 4096); }
  insert(e) {
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.z / this.cell));
    let b = this.map.get(k);
    if (!b) this.map.set(k, (b = []));
    b.push(e);
  }
  query(x, z, r, out) {
    const c = this.cell;
    const c0 = Math.floor((x - r) / c), c1 = Math.floor((x + r) / c), r0 = Math.floor((z - r) / c), r1 = Math.floor((z + r) / c);
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
      const b = this.map.get(this.key(i, j));
      if (b) for (const e of b) out.push(e);
    }
    return out;
  }
}

export class World {
  /**
   * @param {{registry:any, nav:any, seed?:string|number, difficulty?:string, areaLevel?:number, events?:EventBus, balance?:Balance}} o
   */
  constructor(o) {
    this.registry = o.registry;
    this.balance = o.balance ?? Balance.from(o.registry);
    this.nav = o.nav;
    this.events = o.events ?? new EventBus();
    this.rng = new Rng(o.seed ?? 1);
    this.seed = o.seed ?? 1;
    this.difficulty = o.difficulty ?? 'seeker';
    this.areaLevel = o.areaLevel ?? 1;
    this.statDefs = statDefsFrom(o.registry);
    this.statRules = this.balance.statRules();
    this.time = 0;
    this.acc = 0;
    this.tickCount = 0;
    this.nextUid = 1;
    /** @type {any[]} */ this.entities = [];
    this.byUid = new Map();
    this.projectiles = [];
    this.zones = [];
    this.hash = new SpatialHash(4);
    this.player = null;
    this.timeScale = 1;
    this.paused = false;
    this.hooks = { onKill: [], onSpawn: [] };
    this.metrics = { damageDealt: 0, damageTaken: 0, kills: 0, casts: 0 };

    this.dmg = new DamageModel(this.balance);
    this.status = new StatusSystem({
      registry: this.registry, balance: this.balance, events: this.events, now: () => this.time,
      hooks: {
        dealDot: (p) => this.dealDirect(p.source, p.target, p.amount, p.type, { dot: true, ignoreArmor: p.ignoreArmor, statusId: p.statusId }),
        burst: (p) => this.burstAt(p),
        echoHit: (p) => this.dealDirect(p.source, p.target, p.amount, p.type, { reaction: true }),
        chainDamage: (p) => this.chainReaction(p),
        refund: (p) => p.source && this.resources.gainFraction(p.source, p.fraction),
      },
    });
    this.resources = new ResourceSystem(this);
    this.abilities = new AbilityRuntime(this);
    this.ai = new AiSystem(this);
    this.controller = new PlayerController(this);
    this.listen = new ListenSystem(this);
    this.echoes = [];
    this.triggers = new TriggerSystem(this);
    this.elites = new ElitesSystem(this);
    this._tmp = [];
  }

  // ───────────────────────── entity management
  add(e) {
    this.entities.push(e);
    this.byUid.set(e.uid, e);
    this.hash.insert(e);
    return e;
  }

  spawnEnemy(defId, x, z, opts = {}) {
    const e = createEnemy(this, defId, x, z, opts.elite || opts.eliteMods ? { ...opts, tier: 'elite' } : opts);
    if (opts.yaw !== undefined) e.yaw = opts.yaw;
    if (opts.elite || opts.eliteMods) this.elites.apply(e, opts.eliteMods ?? pickEliteMods(this.registry, e.def, e.level, this.rng, opts.eliteCount));
    this.add(e);
    this.events.emit('entity:spawned', { entity: e });
    return e;
  }

  addPlayer(e) { this.player = e; this.add(e); this.events.emit('entity:spawned', { entity: e }); return e; }
  get(uid) { return this.byUid.get(uid); }

  isHostile(a, b) { return a !== b && a.team !== b.team && a.team !== 'neutral' && b.team !== 'neutral'; }

  /** entities within radius r (circle vs circle using entity radius). pred filters. */
  queryCircle(x, z, r, pred, out = []) {
    const tmp = this.hash.query(x, z, r + 2.5, []);
    for (const e of tmp) {
      if (e.dead || e.removed) continue;
      const rr = r + e.radius;
      if (dist2(x, z, e.x, e.z) <= rr * rr && (!pred || pred(e))) out.push(e);
    }
    return out;
  }

  nearestHostile(from, range, pred) {
    let best = null, bd = range * range;
    for (const e of this.hash.query(from.x, from.z, range + 2, [])) {
      if (e.dead || e.removed || !this.isHostile(from, e) || e.untargetable || e.hiddenFromAi) continue;
      if (pred && !pred(e)) continue;
      const d = dist2(from.x, from.z, e.x, e.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ───────────────────────── main loop
  /** advance by real dt seconds; returns number of steps run */
  update(dt) {
    if (this.paused) return 0;
    this.acc += Math.min(dt, 0.25) * this.timeScale;
    let n = 0;
    while (this.acc >= STEP) { this.step(STEP); this.acc -= STEP; n++; }
    return n;
  }

  step(dt) {
    this.time += dt;
    this.tickCount++;
    // rebuild spatial hash
    this.hash.clear();
    for (const e of this.entities) if (!e.removed) this.hash.insert(e);

    this.controller.update(dt);
    this.elites.update();
    this.ai.update(dt);
    this.listen.tick();
    for (const e of this.entities) {
      if (e.dead || e.removed) continue;
      if (e.asleep) continue;
      this.abilities.updateCast(e, dt);
      this.#integrate(e, dt);
    }
    this.#separate();
    this.abilities.updateProjectiles(dt);
    this.abilities.updateZones(dt);
    for (const e of this.entities) {
      if (e.dead || e.removed || e.asleep) continue;
      this.status.tick(e, dt);
      this.resources.update(e, dt);
      this.#regen(e, dt);
      if (e.invuln > 0 && this.time > e.invuln) e.invuln = 0;
    }
    this.#cleanup();
  }

  #integrate(e, dt) {
    if (e.dash) { this.abilities.updateDash(e, dt); }
    else {
      const slow = e.ctl.stunned || e.ctl.rooted ? 0 : 1;
      let mv = e.intent;
      let vx = 0, vz = 0;
      if (mv && slow && !e.dead) {
        const castMul = e.cast ? (e.cast.moveFactor ?? 0) : 1;
        const sp = e.stats.get('moveSpeed') * (mv.speedMult ?? 1) * castMul * (e.listenSlow ?? 1);
        vx = mv.x * sp; vz = mv.z * sp;
      }
      e.vx = vx; e.vz = vz;
      if (vx || vz) this.nav.moveCircle(e, vx * dt, vz * dt, e.radius);
    }
    if (e.kb) {
      const k = e.kb;
      k.t -= dt;
      const f = Math.max(0, k.t / k.dur);
      this.nav.moveCircle(e, k.vx * f * dt, k.vz * f * dt, e.radius);
      if (k.t <= 0) e.kb = null;
    }
  }

  #separate() {
    // gentle push-apart so enemies don't stack on one pixel
    const out = this._tmp;
    for (const e of this.entities) {
      if (e.dead || e.removed || e.asleep || e.kind === 'object' || e.noSeparate) continue;
      out.length = 0;
      this.hash.query(e.x, e.z, e.radius + 1.2, out);
      for (const o of out) {
        if (o === e || o.dead || o.kind === 'object' || o.noSeparate) continue;
        const dx = e.x - o.x, dz = e.z - o.z;
        const min = e.radius + o.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.25 * (e.kind === 'player' ? 0.25 : 1);
        this.nav.moveCircle(e, (dx / d) * push, (dz / d) * push, e.radius);
      }
    }
  }

  #regen(e, dt) {
    if (e.dead) return;
    const pct = Math.min(this.balance.caps().lifeRegenPctPerSec, e.stats.get('lifeRegenPct'));
    const flat = e.stats.get('lifeRegen');
    if (e.team === 'player' && (pct > 0 || flat > 0)) this.heal(e, (e.hpMax * pct + flat) * dt, null, true);
    if (e.flags.has('shieldRegen') && e.shield < e.shieldMax && this.time - e.lastHurtTime > 3) e.shield = Math.min(e.shieldMax, e.shield + e.shieldMax * 0.22 * dt);
  }

  #cleanup() {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.dead && !e.removed && this.time - e.deathTime > (e.corpseTime ?? 3.5)) e.removed = true;
      if (e.removed) { this.entities.splice(i, 1); this.byUid.delete(e.uid); this.events.emit('entity:removed', { entity: e }); }
    }
  }

  // ───────────────────────── damage & healing
  /**
   * Resolve a full hit: roll → mitigate → apply. Used by ability hit ops.
   */
  hit(source, target, eff, ab, ctx = {}) {
    if (target.dead || target.removed) return null;
    const tags = ab ? (eff.dot ? [...ab.tags, 'dot'] : [...ab.tags, 'hit']) : ['hit'];
    const roll = this.dmg.roll(source, eff, tags, this.rng, { target, extraMore: ctx.extraMore, forceCrit: ctx.forceCrit });
    let amount = roll.amount;
    if (ctx.damageMult) amount *= ctx.damageMult;
    const res = this.#apply(source, target, amount, roll.type, {
      crit: roll.crit, ab, pen: source.stats.get('pen', tags), ctx, base: roll.amount, ignoreArmor: eff.ignoreArmor,
    });
    return res ? { ...res, base: roll.amount, crit: roll.crit, type: roll.type } : null;
  }

  /** direct damage with a precomputed outgoing value (DoTs, reactions, bursts, environment) */
  dealDirect(source, target, amount, type, o = {}) {
    if (target.dead || target.removed) return null;
    return this.#apply(source, target, amount, type, { ...o, base: amount, crit: false });
  }

  #apply(source, target, amount, type, o) {
    if (target.untargetable) return null;
    const isDot = !!o.dot;
    if (target.invuln && !isDot) {
      if (target.dodging && source && this.time - (target.lastPerfect ?? -9) > 0.5) {
        target.lastPerfect = this.time;
        this.events.emit('perfectDodge', { entity: target, source });
      }
      return null;
    }
    if (target.invulnerableUntil && this.time < target.invulnerableUntil) return null;
    if (target.hitImmuneFlag) return null;
    let dmg = this.dmg.mitigate(target, amount, type, { ignoreArmor: o.ignoreArmor, pen: o.pen, attackerLevel: source?.level });
    if (target.damageGate) dmg = target.damageGate(dmg, { source, type, ab: o.ab, world: this }) ?? dmg;
    let absorbed = 0;
    if (target.shield > 0) {
      absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
    }
    const prevHp = target.hp;
    target.hp = Math.max(0, target.hp - dmg);
    const dealt = absorbed + dmg;
    target.lastHurtTime = this.time;
    if (source) source.lastHitTime = this.time;
    if (source?.team === 'player') this.metrics.damageDealt += dealt; else this.metrics.damageTaken += dealt;
    const info = { source, target, amount: dealt, life: dmg, absorbed, type, crit: !!o.crit, ab: o.ab, dot: isDot, killed: false, fx: o.ab?.fx };
    this.events.emit('damage', info);
    const refl = target.stats.get('reflectPct');
    if (refl > 0 && source && !isDot && !o.reaction && source !== target && dealt > 0) this.dealDirect(target, source, dealt * refl, 'sonic', { reaction: true });
    if (!isDot && !o.reaction) {
      this.resources.onHit(source, target, info);
      this.status.onHit(target, { source, type, amount: o.base ?? dealt, crit: !!o.crit });
      this.#onHitEffects(source, target, info);
    }
    if (target.hp <= 0 && !target.dead) {
      if (target.deathGate?.(target, source, this) === false) { target.hp = Math.max(1, target.hp); }
      else { info.killed = true; this.kill(target, source, info); }
    } else if (dmg > 0 && target.onHurt) target.onHurt(target, source, info, this);
    return info;
  }

  #onHitEffects(source, target, info) {
    if (!source || source.dead) return;
    const lh = source.stats.get('lifeOnHit');
    const leech = Math.min(this.balance.caps().leechPct, source.stats.get('lifeLeech'));
    if (lh || leech) this.heal(source, lh + info.amount * leech, source, true);
    const th = target.stats.get('thorns');
    if (th > 0 && info.ab?.tags?.includes('melee') && source.team !== target.team) this.dealDirect(target, source, th, 'physical', { reaction: true });
    if (source.hooksOnHit) for (const h of source.hooksOnHit) h(source, target, info, this);
  }

  heal(target, amount, source = null, quiet = false) {
    if (target.dead || amount <= 0) return 0;
    const prev = target.hp;
    target.hp = Math.min(target.hpMax, target.hp + amount);
    const gained = target.hp - prev;
    if (gained > 0 && !quiet) this.events.emit('heal', { target, source, amount: gained });
    return gained;
  }

  addShield(e, amount, duration = 0) {
    e.shield = Math.min((e.shieldMax || 0) + amount, e.shield + amount);
    e.hasTempShield = true;
    if (duration) e.shieldExpire = this.time + duration;
    this.events.emit('shield', { target: e, amount });
  }

  kill(e, killer, info) {
    if (e.dead) return;
    e.dead = true; e.hp = 0; e.deathTime = this.time;
    e.intent = null; e.cast = null; e.dash = null;
    if (e.def?.deathAbility) this.abilities.castImmediate(e, e.def.deathAbility);
    if (e.boss) this.events.emit('boss:defeated', { entity: e, killer });
    this.events.emit('entity:died', { entity: e, killer, info });
    if (e.team === 'enemy') {
      this.metrics.kills++;
      if (killer) {
        const lok = killer.stats.get('lifeOnKill');
        if (lok) this.heal(killer, lok, killer, true);
        this.resources.onKill(killer, e);
      }
    }
    for (const h of this.hooks.onKill) h(e, killer, this);
  }

  /** AoE burst reaction / bursts from statuses */
  burstAt({ target, source, amount, type, radius }) {
    this.events.emit('burst', { x: target.x, z: target.z, radius, type });
    const victims = this.queryCircle(target.x, target.z, radius, (o) => source ? this.isHostile(source, o) : o.team !== target.team || o === target);
    for (const v of victims) this.dealDirect(source, v, amount * (v === target ? 1 : 0.6), type, { reaction: true });
  }

  chainReaction({ target, source, amount, type, radius, targets }) {
    const victims = this.queryCircle(target.x, target.z, radius, (o) => o !== target && (source ? this.isHostile(source, o) : true)).slice(0, targets);
    for (const v of victims) {
      this.events.emit('arc', { from: target, to: v, type });
      this.dealDirect(source, v, amount, type, { reaction: true });
    }
  }

  knockback(target, fromX, fromZ, force, duration = 0.28) {
    const resist = target.kbResist ?? 0;
    if (resist >= 1 || target.dead) return;
    const dx = target.x - fromX, dz = target.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    const dist = force * (1 - resist);
    target.kb = { vx: (dx / l) * dist / duration * 2, vz: (dz / l) * dist / duration * 2, t: duration, dur: duration };
  }
  pull(target, toX, toZ, dist, duration = 0.3) {
    if ((target.kbResist ?? 0) >= 1) return;
    const dx = toX - target.x, dz = toZ - target.z;
    const l = Math.hypot(dx, dz) || 1;
    const d = Math.min(dist * (1 - (target.kbResist ?? 0)), l - 0.6);
    if (d <= 0) return;
    target.kb = { vx: (dx / l) * d / duration * 2, vz: (dz / l) * d / duration * 2, t: duration, dur: duration };
  }

  /** place player entity and refresh life */
  refreshLife(e, full = false) { syncLife(e, full); }
  makeObject(props) { const e = baseEntity(this, 'object', props.team ?? 'neutral', props); e.hpMax = e.hp = props.hp ?? 1; e.untargetable = props.untargetable ?? false; e.noSeparate = true; this.add(e); return e; }
}
