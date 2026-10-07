import * as THREE from 'three';
import { buildModelFromSpec, setFlash, setGhost } from './models.js';
import { animate } from './anim.js';
import { blobTexture } from './stylekit.js';
import { telegraphOf } from '../../sim/telegraph.js';
import { logger } from '../../core/logger.js';

const log = logger('views');
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const CREATE_R = 58, DESTROY_R = 82, CREATE_PER_FRAME = 4;
const AGGRO_STATES = new Set(['chase', 'attack', 'flank', 'special', 'alert', 'support']);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * EntityViews — mirrors simulation entities into 3D models and drives their animation from simulation state.
 *
 *  • one view = root (ground position + yaw) → pivot (hover, recoil, sink, scale) → model.root (rig or procedural creature)
 *  • rigged KayKit characters are animated by CharAnimator (charAnim.js) from the state assembled in #state()
 *  • hit reactions (flash + recoil + hit clip), spawn/awaken, boss taunt, emotes and corpse sink are handled here
 *  • views are created lazily around the player, animated at a distance-based rate and culled outside the camera frustum
 *
 * Public API used by other modules: update · pick · telegraphs · rigOf(uid) · boneWorldPos(uid, bone, out) ·
 * hitReact(uid, {dx,dz,power}) · emote(uid, name) · bindSession(session) · dispose()
 */
export class EntityViews {
  /**
   * @param {THREE.Object3D} scene content group
   * @param {object} registry @param {object} zone (heightAt) @param {object} vfx
   * @param {import('./assets.js').Assets} [assets] only used to know when the art finished loading (models.js owns the factory)
   * @param {THREE.Camera} [camera] enables frustum culling of off-screen characters
   */
  constructor(scene, registry, zone, vfx, assets = null, camera = null) {
    this.scene = scene; this.reg = registry; this.zone = zone; this.vfx = vfx; this.assets = assets; this.camera = camera;
    this.views = new Map();
    this.specs = new Map(registry.all('model').map((m) => [m.id, m]));
    this.ringGeo = new THREE.RingGeometry(0.62, 0.74, 36).rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(0.66, 32).rotateX(-Math.PI / 2);
    this.blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.auraGeo = new THREE.RingGeometry(0.86, 1.12, 40).rotateX(-Math.PI / 2);
    this.auraGeo2 = new THREE.RingGeometry(1.18, 1.26, 40).rotateX(-Math.PI / 2);
    this.t = 0;
    this.noModel = new Set();
    this.born = new Map();
    this.offs = []; this.world = null; this.sessionOffs = [];
    this.frustum = new THREE.Frustum(); this._pv = new THREE.Matrix4(); this._sph = new THREE.Sphere();
    this.artReady = false;
    this.stats = { views: 0, animated: 0, culled: 0 };
    this._v3 = new THREE.Vector3(); this._n = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }

  modelIdFor(e) {
    if (e.kind === 'player') return e.cls?.model ?? 'mdl.belfry';
    return e.def?.model;
  }

  // ───────────────────────── world / session event wiring
  #bind(world) {
    for (const off of this.offs) off();
    this.offs = []; this.world = world;
    const ev = world.events;
    this.offs.push(ev.on('damage', (i) => this.#onDamage(i)));
    this.offs.push(ev.on('entity:spawned', (i) => { if (i.entity) this.born.set(i.entity.uid, world.time); }));
    this.offs.push(ev.on('boss:start', (i) => this.emote(i.entity?.uid, 'taunt', { interrupt: true })));
    this.offs.push(ev.on('entity:died', (i) => { const v = this.views.get(i.entity?.uid); if (v && i.info?.source) this.#deathPush(v, i.info.source); }));
  }

  /** session-level triggers for the player's own animations (cheer on level-up, interact / pick-up) */
  bindSession(session) {
    for (const off of this.sessionOffs) off();
    this.sessionOffs = [];
    const ev = session.events, uid = () => session.player?.uid;
    this.sessionOffs.push(ev.on('level:up', () => this.emote(uid(), 'cheer', { interrupt: true })));
    this.sessionOffs.push(ev.on('interact', (i) => { if (i.kind === 'npc' || i.kind === 'event_npc') return; this.emote(uid(), 'interact'); }));
    this.sessionOffs.push(ev.on('loot:picked', () => { const v = this.views.get(uid()); if (v && v.mps < 0.6) this.emote(uid(), 'pickup', { speed: 1.5 }); }));
  }

  // ───────────────────────── creation / removal
  create(e) {
    if (e.isHazard || this.noModel.has(e.uid)) return null;
    const mid = this.modelIdFor(e);
    const spec = this.specs.get(mid);
    if (!spec) { log.warn(`no model ${mid} for ${e.id}`); this.noModel.add(e.uid); return null; }
    let model;
    try { model = buildModelFromSpec(spec, { uid: e.uid }); } catch (err) { log.error(`model ${mid} failed`, err); this.noModel.add(e.uid); return null; }
    model.seed = e.uid * 0.37;
    const root = new THREE.Group(); root.name = `view:${e.id}`;
    const pivot = new THREE.Group(); pivot.name = 'pivot'; root.add(pivot);
    pivot.add(model.root);
    const tier = e.tier ?? 'standard';
    const big = tier === 'elite' || tier === 'miniboss' || tier === 'boss';
    const isPlayer = e.kind === 'player';
    const r = Math.max(0.5, e.radius ?? 0.5);
    // contact shadow blob (also the grounding cue when real shadows are off)
    const blob = new THREE.Mesh(this.blobGeo, new THREE.MeshBasicMaterial({ map: blobTexture(), color: '#05060a', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    blob.scale.setScalar(r * 3.0); blob.position.y = 0.035; blob.renderOrder = 1; root.add(blob);
    // hover / selection ring
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    ring.position.y = 0.05; ring.renderOrder = 3; root.add(ring);
    const v = { e, uid: e.uid, model, root, pivot, ring, blob, aura: null, pring: null, spec, t: Math.random() * 10, dead: false, yaw: undefined, speed: 0, mps: 0, mpsSm: 0, lodN: 0, dtAcc: 0, recoil: new THREE.Vector2(), slide: new THREE.Vector2(), lastCast: null, lastDash: null, dashId: 0, wasDead: false, rimKey: '', baseScale: 1, hover: model.hover ?? 0, culled: false, hitT: -9 };
    v.baseScale = tier === 'elite' ? 1.14 : 1;
    if (big) {
      const col = tier === 'elite' ? (e.eliteColor ?? '#ffcf5a') : '#ff6a4a';
      const mk = (geo, op) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      const a1 = mk(this.auraGeo, 0.6), a2 = mk(this.auraGeo2, 0.35);
      const aura = new THREE.Group(); aura.add(a1, a2); aura.position.y = 0.07; aura.scale.setScalar(Math.max(1, r * 1.45)); aura.renderOrder = 2;
      root.add(aura); v.aura = { g: aura, a1, a2, col };
    }
    if (isPlayer) {
      const g = new THREE.Group();
      const col = spec.glb?.ringColor ?? '#ffe6a8';
      const disc = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      const rg = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      g.add(disc, rg); g.position.y = 0.06; g.renderOrder = 2; root.add(g); v.pring = { g, disc, rg };
    }
    // spawn / awaken animation for freshly summoned units
    const born = this.born.get(e.uid);
    if (born !== undefined && this.world && this.world.time - born < 0.6 && (e.owner || e.summonSrc) && model.anim) model.anim.spawn(spec.glb?.skeleton ? 'skeleton' : 'ground', 1.4);
    this.scene.add(root);
    this.views.set(e.uid, v);
    this.#rim(v, e, false, true);
    return v;
  }

  remove(uid) {
    const v = this.views.get(uid);
    if (!v) return;
    this.scene.remove(v.root);
    v.model.dispose?.();
    v.root.traverse((o) => {
      if (o.isMesh && o.material && !o.userData.mat0 && !o.material.userData?.shared) o.material.dispose?.();
      if (o.isMesh && o.geometry?.userData.owned) o.geometry.dispose();           // merged (per-instance) geometry; cached shape buffers are shared and stay
    });
    this.views.delete(uid);
  }

  dispose() {
    for (const uid of [...this.views.keys()]) this.remove(uid);
    for (const off of this.offs) off(); for (const off of this.sessionOffs) off();
    this.offs = []; this.sessionOffs = []; this.world = null;
  }

  /** art finished loading after some views were already built as procedural stand-ins: rebuild those as rigs */
  #upgrade() {
    for (const v of this.views.values()) {
      if (!v.model.fallback) continue;
      let model; try { model = buildModelFromSpec(v.spec, { uid: v.uid }); } catch { continue; }
      if (model.fallback) continue;
      v.pivot.remove(v.model.root); v.model = model; model.seed = v.uid * 0.37; v.pivot.add(model.root); v.hover = model.hover ?? 0; v.rimKey = '';
    }
  }

  // ───────────────────────── frame
  update(world, dt, t, hoverUid) {
    this.t = t;
    if (world !== this.world) this.#bind(world);
    if (!this.artReady && this.assets?.ready) { this.artReady = true; this.#upgrade(); }
    if (this.camera) { this.camera.updateMatrixWorld(); this._pv.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this._pv); }
    const pl = world.player;
    const seen = new Set();
    let created = 0, animated = 0, culled = 0;
    for (const e of world.entities) {
      if (e.removed || e.isHazard) continue;
      let v = this.views.get(e.uid);
      const d = pl ? Math.hypot(e.x - pl.x, e.z - pl.z) : 0;
      if (!v) {
        if (d > CREATE_R || created >= CREATE_PER_FRAME) continue;
        v = this.create(e); if (!v) continue; created++;
      } else if (d > DESTROY_R && !e.dead && e !== pl) { this.remove(e.uid); continue; }
      seen.add(e.uid);
      const r = this.#sync(world, v, e, dt, t, hoverUid, d);
      if (r === 1) animated++; else if (r === 2) culled++;
    }
    for (const uid of [...this.views.keys()]) if (!seen.has(uid)) this.remove(uid);
    this.stats.views = this.views.size; this.stats.animated = animated; this.stats.culled = culled;
  }

  /** world-space hit direction → recoil, deaths push the body along the blow */
  #deathPush(v, src) {
    const dx = v.e.x - src.x, dz = v.e.z - src.z, l = Math.hypot(dx, dz) || 1;
    v.slide.set(dx / l * 3.2, dz / l * 3.2);
  }

  #onDamage(i) {
    if (i.dot) return;
    const v = this.views.get(i.target?.uid); if (!v) return;
    const src = i.source, e = v.e;
    let dx = 0, dz = 0;
    if (src) { dx = e.x - src.x; dz = e.z - src.z; }
    const power = clamp01(i.amount / Math.max(1, e.hpMax) * 3.5 + (i.crit ? 0.3 : 0.12));
    this.hitReact(e.uid, { dx, dz, power, block: this.#blocked(e, src) });
  }

  /** frontal shield block (mirrors the arc test in sim/entity.js frontalGate) */
  #blocked(e, src) {
    const sh = e.def?.shield; if (!sh || !src) return false;
    let d = Math.atan2(src.x - e.x, src.z - e.z) - e.yaw;
    while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    return Math.abs(d) <= (sh.arc ?? 140) * Math.PI / 360;
  }

  /**
   * Public: play the hit reaction of an entity (flash, recoil, hit clip). power 0..1; dx,dz = direction the blow pushes the body (world).
   */
  hitReact(uid, { dx = 0, dz = 0, power = 0.5, block = false } = {}) {
    const v = this.views.get(uid); if (!v || v.e.dead) return;
    v.hitT = this.t;
    const l = Math.hypot(dx, dz);
    if (l > 1e-4) { const k = (0.1 + power * 0.28) / l; v.recoil.x += dx * k; v.recoil.y += dz * k; }
    const m = v.model;
    if (m.kind === 'rig') { m.flash(block ? 0.08 : 0.13, block ? '#ffe6a8' : '#ffffff'); m.anim.hit(power, block); }
    v.squash = 1;
  }

  /** Public: play an emote on a character (cheer / interact / pickup / taunt / use). Returns whether it started. */
  emote(uid, name, opts = {}) {
    const v = this.views.get(uid); const a = v?.model.anim; if (!a || v.e.dead) return false;
    const map = { cheer: 'Cheer', interact: 'Interact', pickup: 'PickUp', taunt: ['Taunt', 'Cheer'], use: 'Use_Item', taunt_long: 'Taunt_Longer' };
    return a.emote(map[name] ?? name, opts);
  }

  /** @returns {import('./assets.js').CharacterRig|null} */
  rigOf(uid) { return this.views.get(uid)?.model.rigObj ?? null; }

  /** world position of a bone (rigs) or of the matching joint role (procedural creatures); null when unknown */
  boneWorldPos(uid, boneName, out = new THREE.Vector3()) {
    const v = this.views.get(uid); if (!v) return null;
    const m = v.model;
    let o = null;
    if (m.kind === 'rig') o = m.bone(boneName);
    else if (m.roles) {
      const alias = { 'handslot.r': 'weapon', 'handslot.l': 'weaponL', hand: 'weapon', chest: 'body', hips: 'body', spine: 'body', 'hand.r': 'weapon', 'hand.l': 'weaponL', muzzle: 'muzzle', mouth: 'mouth' };
      o = m.roles[boneName] ?? m.roles[alias[boneName]] ?? (boneName === 'head' ? m.roles.head : null) ?? m.roles.body ?? m.root;
    }
    if (!o) return null;
    o.getWorldPosition(out);
    return out;
  }

  // ───────────────────────── per-entity sync
  /** @returns 1 animated · 2 culled · 0 skipped this frame */
  #sync(world, v, e, dt, t, hoverUid, distToPlayer) {
    const m = v.model, root = v.root, pivot = v.pivot;
    const gy = this.zone.heightAt(e.x, e.z);
    e.y = gy;
    root.position.set(e.x, gy, e.z);
    // smooth yaw (NPCs look at a nearby player)
    let targetYaw = e.yaw;
    if (e.kind === 'npc' && world.player && !e.dead) {
      const dx = world.player.x - e.x, dz = world.player.z - e.z;
      if (dx * dx + dz * dz < 7.5 * 7.5) targetYaw = Math.atan2(dx, dz);
    }
    let d = targetYaw - (v.yaw ?? targetYaw); while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    v.yaw = (v.yaw ?? targetYaw) + d * Math.min(1, dt * (e.kind === 'npc' ? 4 : 16));
    root.rotation.y = v.yaw;

    // visibility: hidden/ghost enemies, frustum culling
    const hiddenNow = e.hidden && e.untargetable && e.ai?.buried;
    let vis = !(hiddenNow && !e.revealedHit && !(e.revealedUntil > world.time));
    let culled = false;
    if (vis && this.camera) {
      this._sph.center.set(e.x, gy + 1, e.z); this._sph.radius = 3.2 + (m.height ?? 1.8) * 1.1;
      if (!this.frustum.intersectsSphere(this._sph)) { vis = false; culled = true; }
    }
    root.visible = vis;
    if (hiddenNow) setGhost(m, true); else if (m.ghosted) setGhost(m, false);
    m.ghosted = hiddenNow;
    v.culled = culled;

    // measured ground speed
    const mps = Math.hypot(e.vx || 0, e.vz || 0);
    v.mps = mps; v.mpsSm += (mps - v.mpsSm) * Math.min(1, dt * 14);
    const speed = Math.min(1.2, mps / Math.max(0.1, (e.stats.get('moveSpeed') || 5.6)));
    v.speed += (speed - v.speed) * Math.min(1, dt * 12);

    // corpse bookkeeping (sink after ~2.2 s; the sim removes the entity at corpseTime)
    const deadT = e.dead ? world.time - e.deathTime : 0;
    if (e.dead && !v.wasDead) { v.wasDead = true; this.#rim(v, e, false, true); v.ring.material.opacity = 0; if (v.pring) v.pring.g.visible = false; }
    else if (!e.dead && v.wasDead) { v.wasDead = false; v.deadOff = null; v.slide.set(0, 0); v.pring && (v.pring.g.visible = true); m.anim?.revive(); this.#rim(v, e, false, true); }   // player respawn

    // slide/recoil (decaying world-space offsets → pivot local)
    v.recoil.multiplyScalar(Math.exp(-dt * 13));
    let ox = v.recoil.x, oz = v.recoil.y;
    if (e.dead) { v.slide.multiplyScalar(Math.exp(-dt * 5.5)); ox += 0; }
    const sx = v.slide.x * (e.dead ? 1 : 0), sz = v.slide.y * (e.dead ? 1 : 0);
    if (e.dead && (sx || sz)) { v.deadOff = v.deadOff ?? new THREE.Vector2(); v.deadOff.x += sx * dt; v.deadOff.y += sz * dt; }
    if (v.deadOff) { ox += v.deadOff.x; oz += v.deadOff.y; }
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
    const lx = ox * cy - oz * sy, lz = ox * sy + oz * cy;
    let py = v.hover ? (e.dead ? v.hover * (1 - smooth(clamp01(deadT / 0.45))) : v.hover + Math.sin(t * 1.9 + m.seed) * 0.07) : 0;
    if (e.dead && deadT > 2.1) { const k = smooth(clamp01((deadT - 2.1) / 1.3)); py -= k * 1.1; pivot.scale.setScalar(Math.max(0.001, v.baseScale * (1 - k * 0.35))); }
    else pivot.scale.setScalar(v.baseScale * (1 + (v.squash ? 0 : 0)));
    if (v.squash) { v.squash = Math.max(0, v.squash - dt * 9); const k = smooth(v.squash); pivot.scale.set(v.baseScale * (1 + k * 0.05), v.baseScale * (1 - k * 0.07), v.baseScale * (1 + k * 0.05)); }
    pivot.position.set(lx, py, lz);

    // ground cues
    const hovered = hoverUid === e.uid && !e.dead;
    this.#groundCues(v, e, t, hovered, deadT, gy);
    this.#rim(v, e, hovered, false);

    if (culled && !e.dead) { v.dtAcc += dt; return 2; }
    if (!vis) { v.dtAcc += dt; return 0; }

    // simulation state for the animation layer
    const since = world.time - e.lastHurtTime;
    const st = { uid: e.uid, t, dt, yaw: v.yaw, speed: v.speed, mps: v.mpsSm, dead: e.dead, deadT, hurt: since < 0.18 ? 1 - since / 0.18 : 0, cast: null, dash: null, dashing: !!e.dash, dashP: 0, dashHint: null, listening: !!e.listen?.active,
      aggro: e.kind === 'player' ? (world.time - e.lastHitTime < 3 || !!e.cast) : !!(e.ai && (e.ai.target || AGGRO_STATES.has(e.ai.state))), stunned: !!e.ctl?.stunned, kind: e.kind, tier: e.tier };
    if (m.kind !== 'rig') setFlash(m, since < 0.07 && !e.dead);
    if (e.dash) {
      if (e.dash !== v.lastDash) { v.lastDash = e.dash; v.dashId++; }
      const dd = e.dash;
      st.dashP = Math.min(1, dd.t / dd.dur); st.dashHint = dd.cast?.ab?.fx?.anim ?? null;
      st.dash = { ref: dd, uid: v.dashId, t: dd.t, dur: dd.dur, dx: dd.dx, dz: dd.dz, iframes: !!dd.iframes, hint: st.dashHint, speed: dd.speed };
    }
    const c = e.cast;
    if (c) {
      const hint = c.ab.fx?.anim ?? 'cast';
      if (c.phase === 'windup') st.cast = { ref: c, phase: 'windup', p: c.windup > 0 ? c.t / c.windup : 1, hint, t: c.t, windup: c.windup, recover: c.recover };
      else if (c.phase === 'channel') st.cast = { ref: c, phase: 'channel', p: c.chanElapsed, hint, t: c.t, windup: c.windup, recover: c.recover, chanT: c.chanElapsed };
      else st.cast = { ref: c, phase: 'recover', p: Math.min(1, c.t / c.recover), hint, t: c.t, windup: c.windup, recover: c.recover };
    }
    if (e.ai?.buried !== undefined) { st.buried = e.ai.buried; if (!e.ai.buried) v.emergeT = (v.emergeT ?? 0) + dt; st.emergeT = v.emergeT ?? 0; }
    // LOD: far characters animate at a lower rate (scrubbed clips stay exact because they are driven by sim time, not by dt)
    const rate = e.dead && deadT > 2.8 ? 8 : distToPlayer < 17 ? 1 : distToPlayer < 28 ? 2 : distToPlayer < 42 ? 3 : 5;
    const force = st.cast?.ref !== v.lastCast || v.wasDead !== v.deadAnimStarted;
    v.lastCast = st.cast?.ref ?? null;
    v.deadAnimStarted = v.wasDead;
    v.lodN++;
    if (rate > 1 && !force && (v.lodN % rate) !== 0) { v.dtAcc += dt; return 0; }
    const adt = dt + v.dtAcc; v.dtAcc = 0;
    animate(m, st, adt);
    return 1;
  }

  /** blob shadow, hover ring, elite aura, player ring — all on the ground, aligned to the terrain slope */
  #groundCues(v, e, t, hovered, deadT, gy) {
    const r = Math.max(0.5, e.radius ?? 0.5), tier = e.tier;
    const fade = e.dead ? clamp01(1 - (deadT - 0.6) / 1.4) : 1;
    // terrain normal (cheap finite difference) → tilt the ground decals
    let tilt = null;
    if (!e.dead) {
      const h = 0.7, hx = this.zone.heightAt(e.x + h, e.z) - this.zone.heightAt(e.x - h, e.z), hz = this.zone.heightAt(e.x, e.z + h) - this.zone.heightAt(e.x, e.z - h);
      if (Math.abs(hx) + Math.abs(hz) > 0.02) { this._n.set(-hx / (2 * h), 1, -hz / (2 * h)).normalize(); this._n.applyAxisAngle(UP, -v.yaw); tilt = this._n; }
    }
    const mat = v.blob.material; mat.opacity = 0.42 * fade;
    v.blob.scale.setScalar(r * 3.1 * (e.kind === 'player' ? 1.0 : 1));
    const q = tilt ? this._q.setFromUnitVectors(UP, tilt) : null;
    if (q) { v.blob.quaternion.copy(q); v.ring.quaternion.copy(q); if (v.pring) v.pring.g.quaternion.copy(q); if (v.aura) v.aura.g.quaternion.copy(q); }
    v.ring.material.opacity = hovered ? 0.95 : 0;
    if (hovered) { v.ring.material.color.set(e.team === 'enemy' ? '#ff6a5a' : '#ffd27a'); v.ring.scale.setScalar(Math.max(0.8, r * 1.5)); }
    if (v.aura) {
      const a = v.aura, tt = t * 0.6;
      a.g.rotation.y = tt; a.a2.rotation.y = -tt * 2.2;
      const pulse = 0.5 + Math.sin(t * 3 + v.uid) * 0.14;
      a.a1.material.opacity = e.dead ? 0 : pulse; a.a2.material.opacity = e.dead ? 0 : pulse * 0.6;
    }
    if (v.pring) { const p = v.pring; p.rg.material.opacity = 0.34 + Math.sin(t * 2.2) * 0.05; p.g.scale.setScalar(1 + Math.sin(t * 2.2) * 0.015); }
  }

  /** rim light: base (spec) → elite/boss tint → hover white */
  #rim(v, e, hovered, force) {
    const m = v.model; if (m.kind !== 'rig') return;
    const tier = e.tier;
    let key = 'base';
    if (hovered) key = 'hover'; else if (tier === 'elite' && !e.dead) key = `elite:${e.eliteColor}`; else if ((tier === 'miniboss' || tier === 'boss') && !e.dead) key = 'boss';
    if (key === v.rimKey && !force) return;
    v.rimKey = key;
    if (key === 'hover') m.setRim('#ffffff', 1.25);
    else if (key.startsWith('elite')) m.setRim(e.eliteColor ?? '#ffcf5a', 0.85);
    else if (key === 'boss') m.setRim('#ff7a5a', 0.55);
    else m.resetRim();
  }

  /** collect telegraph descriptors for casts in progress (drawn by the VFX layer) */
  telegraphs(world) {
    const out = [];
    for (const e of world.entities) {
      const c = e.cast;
      if (!c || e.dead || e.team === 'player' || c.phase !== 'windup') continue;
      const tel = telegraphOf(c.ab, e, c);
      if (!tel) continue;
      out.push({ uid: e.uid, tel, p: c.windup > 0 ? Math.min(1, c.t / c.windup) : 1, e });
    }
    return out;
  }

  /** screen-space pick: nearest entity within pixel radius of (px,py) */
  pick(world, camera, size, px, py, pred) {
    let best = null, bd = Infinity;
    const v = new THREE.Vector3();
    for (const e of world.entities) {
      if (e.dead || e.removed || !pred(e)) continue;
      const view = this.views.get(e.uid);
      if (!view || !view.root.visible) continue;
      const h = Math.max(e.height ?? 1.5, (view.model.height ?? 0) * view.baseScale * 0.9);
      v.set(e.x, e.y + h * 0.55, e.z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * size.w, sy = (-v.y * 0.5 + 0.5) * size.h;
      const pix = Math.max(26, h * 16 + e.radius * 20);
      const d = Math.hypot(sx - px, sy - py);
      if (d < pix && d < bd) { bd = d; best = e; }
    }
    return best;
  }
}
