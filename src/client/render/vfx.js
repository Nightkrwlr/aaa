import * as THREE from 'three';
import { Particles } from './particles.js';
import { GroundFx, FX_COLORS } from './groundFx.js';
import { mat, sphere, cyl, box, ico, group } from './kit.js';

const ELEMS = ['sonic', 'fire', 'frost', 'shock', 'toxic', 'hollow', 'physical'];
const elemOf = (ab, fallback = 'physical') => ab?.tags?.find((t) => ELEMS.includes(t)) ?? fallback;
const COLORS = { physical: '#f2e7cf', sonic: '#7fe3ff', fire: '#ff8a3a', frost: '#9fe8ff', shock: '#ffe34a', toxic: '#9ad13a', hollow: '#b79cff', heal: '#6dff9a' };

/** Event-driven visual effects. Reads simulation events; never mutates the simulation. */
export class Vfx {
  constructor(scene, camera, rig, quality, settings) {
    this.scene = scene; this.camera = camera; this.rig = rig; this.q = quality; this.settings = settings;
    this.particles = new Particles(scene, 3500);
    this.particles.density = quality.particles;
    this.ground = new GroundFx(scene, 56);
    this.numbers = [];
    this.projViews = new Map();
    this.zoneViews = new Map();
    this.telegraphFx = new Map();
    this.hitstop = 0;
    this.flash = 0;
    this.listenRings = [];
    this.statusAcc = 0;
    this.t = 0;
    this.shakeBoost = 1;
  }

  /** drop all per-world visuals (projectiles, zones, telegraphs) before binding a new world */
  reset() {
    for (const v of this.projViews.values()) { this.scene.remove(v.mesh); if (v.land) this.ground.release(v.land); }
    for (const v of this.zoneViews.values()) { this.ground.release(v.fx); v.orbit?.forEach((b) => this.scene.remove(b)); }
    for (const fx of this.telegraphFx.values()) this.ground.release(fx);
    this.projViews.clear(); this.zoneViews.clear(); this.telegraphFx.clear();
    this.numbers.length = 0; this.listenRings.length = 0; this.hitstop = 0; this.flash = 0;
  }

  bind(world, zone) {
    this.world = world; this.zone = zone;
    const ev = world.events;
    const gy = (x, z) => zone.heightAt(x, z);
    ev.on('damage', (i) => this.#onDamage(i));
    ev.on('heal', (i) => this.#number(i.target, `+${Math.round(i.amount)}`, '#6dff9a', 0.9, false));
    ev.on('area:hit', (i) => {
      const el = elemOf(i.ab, 'physical');
      if (i.entity.team !== 'player' && i.effect?.hit?.every?.((h) => h.op === 'heal')) return;
      const color = i.color && FX_COLORS[i.color] ? i.color : el;
      const s = i.shape;
      this.ground.spawn({ kind: s.kind, x: i.x, y: gy(i.x, i.z), z: i.z, yaw: i.yaw, radius: s.radius, angle: (s.angle ?? 360) * Math.PI / 180, width: s.width, length: s.length, inner: s.inner, color, life: s.kind === 'ring' ? 0.5 : 0.28, alpha: 0.9, mode: 'flash', band: 1.1 });
      if (i.entity.team === 'player') this.particles.emit({ x: i.x, y: gy(i.x, i.z) + 0.3, z: i.z, count: Math.min(30, 6 + s.radius * 3), color: COLORS[el], speed: s.radius * 1.5, up: 1.4, life: 0.5, size: 0.2, gravity: 4, spread: 1 });
    });
    ev.on('cast:impact', (i) => {
      const fx = i.ab.fx ?? {};
      if (fx.shake && i.entity.team === 'player') this.rig.addShake(fx.shake * 0.7);
      if (i.entity.team === 'player' && i.ab.slotType !== 'dodge') this.#castFlair(i);
    });
    ev.on('dash:start', (i) => { this.#dashTrail(i.entity, i.dx, i.dz); });
    ev.on('blink', (i) => {
      for (const p of [i.from, i.to]) this.particles.emit({ x: p.x, y: gy(p.x, p.z) + 1, z: p.z, count: 24, color: '#7fe3ff', speed: 4, up: 2, life: 0.5, size: 0.22 });
    });
    ev.on('entity:died', (i) => this.#onDeath(i.entity));
    ev.on('cadence:chord', (i) => this.#chord(i));
    ev.on('listen:pulse', (i) => this.#listenPulse(i));
    ev.on('burst', (i) => { this.ground.spawn({ kind: 'circle', x: i.x, y: gy(i.x, i.z), z: i.z, yaw: 0, radius: i.radius, color: COLORS[i.type] ? i.type : 'sonic', life: 0.35, mode: 'flash', alpha: 0.9 }); this.particles.emit({ x: i.x, y: gy(i.x, i.z) + 0.6, z: i.z, count: 26, color: COLORS[i.type] ?? '#fff', speed: i.radius * 2, up: 3, life: 0.6, size: 0.25 }); });
    ev.on('arc', (i) => this.#arc(i.from, i.to));
    ev.on('resource:overflow', (i) => { this.flash = Math.max(this.flash, 0.6); this.rig.addShake(0.5); this.particles.emit({ x: i.entity.x, y: i.entity.y + 1, z: i.entity.z, count: 50, color: '#fff0b0', speed: 7, up: 3, life: 0.7, size: 0.3 }); });
    ev.on('status:applied', (i) => { const d = world.registry.get(i.statusId); if (d?.color) this.particles.emit({ x: i.target.x, y: i.target.y + (i.target.height ?? 1.5) * 0.7, z: i.target.z, count: 8, color: d.color, speed: 1.4, up: 2.5, life: 0.5, size: 0.18, gravity: -1 }); });
    ev.on('perfectDodge', (i) => { this.#number(i.entity, '✦', '#ffe27a', 1.2, true); this.particles.emit({ x: i.entity.x, y: i.entity.y + 1, z: i.entity.z, count: 30, color: '#ffe27a', speed: 5, up: 1, life: 0.6, size: 0.2 }); });
    ev.on('shield', (i) => this.particles.emit({ x: i.target.x, y: i.target.y + 1, z: i.target.z, count: 16, color: '#9fe8ff', speed: 2.5, up: 2, life: 0.6, size: 0.2 }));
    ev.on('summon', (i) => this.particles.emit({ x: i.entity.x, y: i.entity.y + 0.2, z: i.entity.z, count: 20, color: '#b79cff', speed: 2, up: 4, life: 0.7, size: 0.22, gravity: 2 }));
    ev.on('buff:cast', (i) => { const d = world.registry.get(i.status); this.ground.spawn({ kind: 'circle', x: i.entity.x, y: gy(i.entity.x, i.entity.z), z: i.entity.z, yaw: 0, radius: i.radius ?? 1.5, color: i.entity.team === 'player' ? 'gold' : 'benign', life: 0.6, mode: 'flash', alpha: 0.8 }); });
  }

  // ───────────────────────── event handlers
  #onDamage(i) {
    const t = i.target;
    const isPlayerHurt = t.team === 'player';
    const el = i.type;
    const col = COLORS[el] ?? '#fff';
    this.particles.emit({ x: t.x, y: t.y + (t.height ?? 1.5) * 0.6, z: t.z, count: i.crit ? 16 : 8, color: i.dot ? col : '#ffffff', speed: i.crit ? 6 : 3.5, up: 2, life: 0.35, size: 0.16, gravity: 8 });
    if (!i.dot || isPlayerHurt || i.amount > t.hpMax * 0.02) {
      const colr = isPlayerHurt ? '#ff6a5a' : i.crit ? '#ffd27a' : i.dot ? col : '#ffffff';
      if (!i.dot || this.numbers.length < 40) this.#number(t, String(Math.round(i.amount)), colr, i.crit ? 1.45 : i.dot ? 0.8 : 1, i.crit, isPlayerHurt);
    }
    if (i.source?.team === 'player' && !i.dot) {
      const base = i.fx?.hitstop ?? 30;
      const ms = Math.min(this.world.balance.d.hitStop.maxMs, Math.max(this.world.balance.d.hitStop.minMs, base * (i.crit ? 1.4 : 1)));
      if (this.settings.hitStop) this.hitstop = Math.max(this.hitstop, ms / 1000);
      if (i.fx?.shake) this.rig.addShake(i.fx.shake * (i.crit ? 1.3 : 1) * 0.6);
    }
    if (isPlayerHurt && !i.dot) { this.rig.addShake(0.25 + Math.min(0.5, i.amount / Math.max(1, t.hpMax) * 3)); this.flash = Math.max(this.flash, Math.min(0.5, i.amount / t.hpMax * 3)); }
    if (i.absorbed > 0) this.particles.emit({ x: t.x, y: t.y + 1.1, z: t.z, count: 6, color: '#9fe8ff', speed: 2, up: 1, life: 0.3, size: 0.15 });
    if (t.shieldHit) { t.shieldHit = false; this.particles.emit({ x: t.x + Math.sin(t.yaw) * 0.6, y: t.y + 1, z: t.z + Math.cos(t.yaw) * 0.6, count: 10, color: '#ffd27a', speed: 3, up: 1, life: 0.3, size: 0.16 }); this.#number(t, '🛡', '#ffd27a', 0.9, false); }
  }

  #number(ent, text, color, scale, crit, onPlayer) {
    if (this.numbers.length > 70) this.numbers.shift();
    this.numbers.push({ x: ent.x + (Math.random() - 0.5) * 0.6, y: (ent.y ?? 0) + (ent.height ?? 1.6) + 0.2, z: ent.z + (Math.random() - 0.5) * 0.6, text, color, scale, crit, t: 0, life: crit ? 1.2 : 0.9, vy: crit ? 2.2 : 1.7 });
  }

  #castFlair(i) {
    const e = i.entity, el = elemOf(i.ab, 'sonic');
    const gy = this.zone.heightAt(e.x, e.z);
    const c = i.cast;
    this.particles.emit({ x: e.x + Math.sin(c.yaw) * 0.9, y: gy + 1.2, z: e.z + Math.cos(c.yaw) * 0.9, count: 10, color: COLORS[el], speed: 3, up: 0.5, life: 0.3, size: 0.16, dirX: Math.sin(c.yaw), dirZ: Math.cos(c.yaw), cone: 1 });
  }

  #dashTrail(e, dx, dz) {
    for (let k = 0; k < 8; k++) this.particles.emit({ x: e.x - dx * k * 0.5, y: e.y + 0.4, z: e.z - dz * k * 0.5, count: 3, color: '#e8dcc0', speed: 1.2, up: 0.6, life: 0.4, size: 0.2, gravity: 0.5 });
  }

  #onDeath(e) {
    const col = e.def?.family === 'fam.hollow' ? '#b79cff' : e.def?.family === 'fam.serrane_construct' ? '#d9a24a' : '#7fe3ff';
    const big = e.tier === 'boss' ? 4 : e.tier === 'miniboss' ? 3 : e.tier === 'elite' ? 2 : 1;
    this.particles.emit({ x: e.x, y: e.y + (e.height ?? 1.5) * 0.5, z: e.z, count: 18 * big, color: col, speed: 4 * big * 0.6, up: 3, life: 0.8, size: 0.22, gravity: 3 });
    if (big > 1) { this.rig.addShake(0.4 * big * 0.5); this.flash = Math.max(this.flash, 0.2); }
  }

  #chord(i) {
    const e = i.entity, c = i.chord;
    const col = c.type === 'triad' ? '#7fe3ff' : c.type === 'unison' ? '#ffd27a' : '#c58cff';
    this.ground.spawn({ kind: 'ring', x: e.x, y: this.zone.heightAt(e.x, e.z), z: e.z, yaw: 0, radius: 4.2, inner: 0, color: col, life: 0.6, mode: 'flash', alpha: 1, band: 0.7 });
    this.particles.emit({ x: e.x, y: e.y + 1, z: e.z, count: 34, color: col, speed: 5, up: 4, life: 0.8, size: 0.22, gravity: -1 });
    this.#number(e, c.type === 'triad' ? '♪♪♪' : c.type === 'unison' ? '♫♫♫' : '♪♫♪', col, 1.35, true);
    this.rig.addShake(0.12);
  }

  #listenPulse(i) {
    const e = i.entity;
    this.listenRings.push({ x: e.x, z: e.z, y: this.zone.heightAt(e.x, e.z), t: 0, range: i.range });
  }

  #arc(from, to) {
    const n = 8; let px = from.x, py = from.y + 1, pz = from.z;
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 0.5, y = from.y + 1 + (to.y - from.y) * t + (Math.random() - 0.5) * 0.4, z = from.z + (to.z - from.z) * t + (Math.random() - 0.5) * 0.5;
      this.particles.emit({ x, y, z, count: 3, color: '#ffe34a', speed: 0.6, up: 0.3, life: 0.25, size: 0.2, gravity: 0, jitter: 0.1 });
      px = x; py = y; pz = z;
    }
  }

  // ───────────────────────── per-frame
  update(dt, t, world, entityViews) {
    this.t = t;
    this.particles.update(dt);
    this.ground.update(dt, t);
    this.#syncProjectiles(world, dt, t);
    this.#syncZones(world, dt, t);
    this.#syncTelegraphs(world, entityViews);
    this.#statusEmitters(world, dt);
    for (let i = this.listenRings.length - 1; i >= 0; i--) {
      const r = this.listenRings[i]; r.t += dt;
      const k = r.t / 1.1;
      if (k >= 1) { this.listenRings.splice(i, 1); continue; }
      if (!r.fx) r.fx = this.ground.spawn({ kind: 'ring', x: r.x, y: r.y, z: r.z, yaw: 0, radius: 0.1, inner: 0, color: 'echo', life: 99, mode: 'zone', alpha: 0.8 });
      const rad = r.range * (1 - (1 - k) ** 2);
      const u = r.fx.m.uniforms; u.uR.value = rad; u.uInner.value = Math.max(0, rad - 0.7); u.uAlpha.value = (1 - k) * 0.9; u.uProg.value = 1; u.uExtent.value = rad + 1; r.fx.mesh.scale.set(rad + 1, 1, rad + 1);
      if (k > 0.97) { this.ground.release(r.fx); r.fx = null; }
    }
    for (let i = this.numbers.length - 1; i >= 0; i--) { const n = this.numbers[i]; n.t += dt; n.y += n.vy * dt; n.vy *= 0.94; if (n.t > n.life) this.numbers.splice(i, 1); }
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.hitstop > 0) this.hitstop -= dt;
  }

  #syncProjectiles(world, dt, t) {
    const live = new Set();
    for (const p of world.projectiles) {
      if (p.dead) continue;
      live.add(p.uid);
      let v = this.projViews.get(p.uid);
      if (!v) { v = this.#makeProjectile(p); this.projViews.set(p.uid, v); }
      const y = this.zone.heightAt(p.x, p.z) + 1.1 + (p.h ?? 0);
      v.mesh.position.set(p.x, y, p.z);
      v.mesh.rotation.y = Math.atan2(p.vx, p.vz);
      if (v.spin) v.mesh.rotation.z += dt * 14;
      if (v.update) v.update(t);
      this.particles.emit({ x: p.x, y, z: p.z, count: 1, color: v.color, speed: 0.3, up: 0.2, life: 0.3, size: 0.2, gravity: 0, jitter: 0.1 });
      if (p.targetPoint) { // landing indicator for lobbed shots
        if (!v.land) v.land = this.ground.spawn({ kind: 'circle', x: p.targetPoint.x, y: this.zone.heightAt(p.targetPoint.x, p.targetPoint.z), z: p.targetPoint.z, yaw: 0, radius: 2.3, color: 'danger', life: 99, mode: 'zone', alpha: 0.9 });
        this.ground.setProgress(v.land, Math.min(1, p.age / p.flightT));
      }
    }
    for (const [uid, v] of this.projViews) if (!live.has(uid)) { this.scene.remove(v.mesh); if (v.land) this.ground.release(v.land); this.projViews.delete(uid); }
  }

  #makeProjectile(p) {
    const color = p.color ?? COLORS[elemOf(p.ab)] ?? '#ffffff';
    let mesh, spin = false, update = null;
    switch (p.model) {
      case 'chainbell': mesh = group([cyl(0.12, 0.28, 0.36, '#d9a24a', { seg: 8, metal: 0.6, fade: false }), sphere(0.07, '#7a5a2a', { pos: [0, -0.22, 0], fade: false })]); spin = true; break;
      case 'beam': mesh = group([box(0.12, 0.12, 1.6, color, { emissive: color, ei: 2, fade: false })]); break;
      case 'glob': mesh = ico(0.32, color, { emissive: color, ei: 0.9, fade: false }); spin = true; break;
      case 'wire': mesh = group([box(0.06, 0.06, 0.9, '#d9a24a', { emissive: '#d9a24a', ei: 0.8, fade: false })]); break;
      case 'note': mesh = group([ico(0.2, color, { emissive: color, ei: 1.8, fade: false })]); update = (t) => { mesh.scale.setScalar(1 + Math.sin(t * 20) * 0.1); }; break;
      case 'wisp': mesh = group([sphere(0.22, color, { emissive: color, ei: 1.6, fade: false })]); break;
      default: mesh = group([sphere(0.2, color, { emissive: color, ei: 2.0, fade: false }), sphere(0.34, color, { emissive: color, ei: 0.8, opacity: 0.3, fade: false })]);
    }
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
    this.scene.add(mesh);
    return { mesh, spin, update, color };
  }

  #syncZones(world, dt, t) {
    const live = new Set();
    for (const z of world.zones) {
      if (z.dead) continue;
      live.add(z.uid);
      let v = this.zoneViews.get(z.uid);
      const y = this.zone.heightAt(z.x, z.z);
      if (!v) {
        const kind = z.shape === 'ring' ? 'ring' : z.shape;
        const hazardCol = z.trigger === 'timer' ? 'danger' : null;
        const col = hazardCol ? hazardCol : z.kind === 'hush' ? 'hush' : z.kind === 'acid' || z.kind === 'toxic' ? 'toxic' : z.kind === 'shock' ? 'shock' : z.kind === 'snare' ? 'danger' : z.benign ? 'benign' : (z.team === 'player' ? elemOf(z.ab, 'sonic') : 'danger');
        const fx = this.ground.spawn({ kind: kind === 'ring' ? 'ring' : kind, x: z.x, y, z: z.z, yaw: z.yaw, radius: z.radius, inner: z.inner, angle: z.angle ? z.angle * Math.PI / 180 : Math.PI * 2, width: z.width, length: z.length, color: col, life: 99, mode: 'zone', alpha: z.team === 'player' ? 0.55 : 0.8, pulse: z.kind === 'acid' || z.kind === 'hush' || z.kind === 'toxic' ? 1 : 0 });
        v = { fx, orbit: null };
        if (z.kind === 'orbit_bells') {
          const bells = [];
          for (let i = 0; i < 4; i++) { const b = group([cyl(0.1, 0.26, 0.34, '#d9a24a', { seg: 8, metal: 0.6, fade: false }), sphere(0.06, '#7a5a2a', { pos: [0, -0.2, 0], fade: false })]); this.scene.add(b); bells.push(b); }
          v.orbit = bells;
        }
        this.zoneViews.set(z.uid, v);
      }
      v.fx.m.uniforms.uProg.value = z.trigger === 'proximity' || z.trigger === 'timer' ? (z.t >= z.arm ? 1 : z.t / Math.max(0.01, z.arm)) : 1;
      this.ground.move(v.fx, { kind: z.shape === 'ring' ? 'ring' : z.shape, x: z.x, y, z: z.z, yaw: z.yaw, radius: z.radius, inner: z.inner, angle: z.angle ? z.angle * Math.PI / 180 : Math.PI * 2, width: z.width, length: z.length, color: v.fx.o.color, alpha: v.fx.o.alpha, pulse: v.fx.o.pulse });
      if (z.duration - z.t < 0.8) v.fx.m.uniforms.uAlpha.value = (v.fx.o.alpha ?? 1) * Math.max(0, (z.duration - z.t) / 0.8);
      if (v.orbit) v.orbit.forEach((b, i) => { const a = z.yaw + (i / v.orbit.length) * Math.PI * 2; const rr = (z.radius + (z.inner ?? 0)) / 2; b.position.set(z.x + Math.sin(a) * rr, y + 1.1 + Math.sin(t * 4 + i) * 0.12, z.z + Math.cos(a) * rr); b.rotation.z = Math.sin(t * 5 + i) * 0.5; });
      if (z.kind === 'shock' && z.tickT < 0.9) v.fx.m.uniforms.uProg.value = 1 - z.tickT / 0.9;
      if (z.kind === 'shock' && z.tickT > z.tick - 0.15) this.particles.emit({ x: z.x, y: y + 0.4, z: z.z, count: 14, color: '#ffe34a', speed: z.radius * 1.5, up: 2, life: 0.35, size: 0.18 });
      if ((z.kind === 'acid' || z.kind === 'toxic') && Math.random() < 0.3) this.particles.emit({ x: z.x + (Math.random() - 0.5) * z.radius, y: y + 0.2, z: z.z + (Math.random() - 0.5) * z.radius, count: 1, color: '#9ad13a', speed: 0.2, up: 1.2, life: 0.8, size: 0.2, gravity: -0.5 });
      if (z.kind === 'hush' && Math.random() < 0.3) this.particles.emit({ x: z.x + (Math.random() - 0.5) * z.radius * 1.6, y: y + 0.2, z: z.z + (Math.random() - 0.5) * z.radius * 1.6, count: 1, color: '#b79cff', speed: 0.2, up: 1.0, life: 1.0, size: 0.22, gravity: -0.2 });
    }
    for (const [uid, v] of this.zoneViews) if (!live.has(uid)) { this.ground.release(v.fx); v.orbit?.forEach((b) => this.scene.remove(b)); this.zoneViews.delete(uid); }
  }

  #syncTelegraphs(world, entityViews) {
    const list = entityViews.telegraphs(world);
    const live = new Set();
    for (const { uid, tel, p } of list) {
      live.add(uid);
      const s = tel.shape;
      const o = { kind: s.kind, x: tel.x, y: this.zone.heightAt(tel.x, tel.z), z: tel.z, yaw: tel.yaw, radius: s.radius, angle: (s.angle ?? 360) * Math.PI / 180, width: s.width, length: s.length ?? s.radius, inner: s.inner, color: tel.hush ? 'hush' : tel.benign ? 'benign' : 'danger', alpha: 1, pulse: p > 0.8 ? 1 : 0 };
      let fx = this.telegraphFx.get(uid);
      if (!fx) { fx = this.ground.spawn({ ...o, life: 99, mode: 'zone' }); this.telegraphFx.set(uid, fx); }
      this.ground.move(fx, o);
      this.ground.setProgress(fx, p);
    }
    for (const [uid, fx] of this.telegraphFx) if (!live.has(uid)) { this.ground.release(fx); this.telegraphFx.delete(uid); }
  }

  #statusEmitters(world, dt) {
    this.statusAcc += dt;
    if (this.statusAcc < 0.12) return;
    this.statusAcc = 0;
    for (const e of world.entities) {
      if (e.dead || !e.st.length) continue;
      if (Math.hypot(e.x - world.player.x, e.z - world.player.z) > 30) continue;
      for (const s of e.st) {
        const v = s.def.vfx; if (!v) continue;
        const col = s.def.color;
        const y = e.y + (e.height ?? 1.5) * 0.5;
        switch (v) {
          case 'embers': this.particles.emit({ x: e.x, y, z: e.z, count: 2, color: '#ff8a3a', speed: 0.8, up: 2.4, life: 0.7, size: 0.16, gravity: -2 }); break;
          case 'bubbles': this.particles.emit({ x: e.x, y, z: e.z, count: 1, color: '#9ad13a', speed: 0.5, up: 1.4, life: 0.8, size: 0.18, gravity: -1 }); break;
          case 'droplets': this.particles.emit({ x: e.x, y, z: e.z, count: 1, color: '#c4202e', speed: 0.5, up: 0.5, life: 0.5, size: 0.14, gravity: 6 }); break;
          case 'frost': case 'ice': this.particles.emit({ x: e.x, y, z: e.z, count: 1, color: '#d6f6ff', speed: 0.6, up: 0.4, life: 0.8, size: 0.14, gravity: 0.5 }); break;
          case 'sparks': this.particles.emit({ x: e.x, y, z: e.z, count: 1, color: '#ffe34a', speed: 1.5, up: 1.5, life: 0.25, size: 0.14, gravity: 0 }); break;
          case 'stars': this.particles.emit({ x: e.x + Math.sin(this.t * 6) * 0.4, y: e.y + (e.height ?? 1.5) + 0.2, z: e.z + Math.cos(this.t * 6) * 0.4, count: 1, color: '#fff1a8', speed: 0, up: 0, life: 0.2, size: 0.18, gravity: 0 }); break;
          case 'mark': case 'resonant': this.particles.emit({ x: e.x, y: e.y + (e.height ?? 1.5) + 0.4, z: e.z, count: 1, color: col, speed: 0.1, up: 0.2, life: 0.25, size: 0.3, gravity: 0 }); break;
          case 'dissonance': this.particles.emit({ x: e.x + Math.sin(this.t * 4) * 0.5, y, z: e.z + Math.cos(this.t * 4) * 0.5, count: 1 + s.stacks, color: col, speed: 0.4, up: 0.6, life: 0.4, size: 0.16, gravity: 0 }); break;
          case 'heal': case 'tuned': case 'wind': case 'glow': this.particles.emit({ x: e.x, y: e.y + 0.2, z: e.z, count: 1, color: col, speed: 0.8, up: 1.6, life: 0.7, size: 0.14, gravity: -1 }); break;
          default: break;
        }
      }
    }
  }
}
