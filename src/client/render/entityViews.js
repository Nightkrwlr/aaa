import * as THREE from 'three';
import { buildModelFromSpec, setFlash, setGhost } from './models.js';
import { animate } from './anim.js';
import { telegraphOf } from '../../sim/telegraph.js';
import { logger } from '../../core/logger.js';

const log = logger('views');

/**
 * EntityViews — mirrors simulation entities into 3D models, drives animation from sim state
 * (movement, cast phase, hurt, death) and exposes screen-space helpers for picking.
 */
export class EntityViews {
  constructor(scene, registry, zone, vfx) {
    this.scene = scene; this.reg = registry; this.zone = zone; this.vfx = vfx;
    this.views = new Map();
    this.specs = new Map(registry.all('model').map((m) => [m.id, m]));
    this.ringGeo = new THREE.RingGeometry(0.55, 0.68, 28).rotateX(-Math.PI / 2);
    this.t = 0;
  }

  modelIdFor(e) {
    if (e.kind === 'player') return e.cls?.model ?? 'mdl.belfry';
    if (e.kind === 'npc') return e.def?.model;
    return e.def?.model;
  }

  create(e) {
    if (e.isHazard) return null;
    const mid = this.modelIdFor(e);
    const spec = this.specs.get(mid);
    if (!spec) { log.warn(`no model ${mid} for ${e.id}`); return null; }
    const model = buildModelFromSpec(spec);
    model.seed = e.uid * 0.37;
    const root = new THREE.Group();
    root.add(model.root);
    // soft contact shadow blob + selection ring
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false }));
    ring.position.y = 0.06; root.add(ring);
    const tier = e.tier;
    if (tier === 'elite' || tier === 'miniboss' || tier === 'boss') {
      const aura = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: tier === 'elite' ? '#ffcf5a' : '#ff6a4a', transparent: true, opacity: 0.55, depthWrite: false }));
      aura.position.y = 0.07; aura.scale.setScalar(Math.max(1, e.radius * 1.6)); root.add(aura); model.aura = aura;
    }
    this.scene.add(root);
    const v = { e, model, root, ring, t: Math.random() * 10, dead: false, emergeT: 0, scaleBase: e.tier === 'miniboss' || e.tier === 'boss' ? 1 : (1 + ((e.uid % 7) - 3) * 0.015) };
    if (e.modelScale) root.scale.setScalar(e.modelScale);
    this.views.set(e.uid, v);
    return v;
  }

  remove(uid) {
    const v = this.views.get(uid);
    if (!v) return;
    this.scene.remove(v.root);
    v.root.traverse((o) => { if (o.isMesh && !o.userData.mat0) o.geometry?.dispose?.(); });
    this.views.delete(uid);
  }

  update(world, dt, t, hoverUid) {
    this.t = t;
    const seen = new Set();
    for (const e of world.entities) {
      if (e.removed) continue;
      let v = this.views.get(e.uid);
      if (!v) { if (e.isHazard) continue; v = this.create(e); if (!v) continue; }
      seen.add(e.uid);
      this.#sync(world, v, e, dt, t, hoverUid);
    }
    for (const uid of [...this.views.keys()]) if (!seen.has(uid)) this.remove(uid);
  }

  #sync(world, v, e, dt, t, hoverUid) {
    const m = v.model, root = v.root;
    const gy = this.zone.heightAt(e.x, e.z);
    e.y = gy;
    root.position.set(e.x, gy, e.z);
    // smooth yaw
    const targetYaw = e.yaw;
    let d = targetYaw - (v.yaw ?? targetYaw); while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    v.yaw = (v.yaw ?? targetYaw) + d * Math.min(1, dt * 16);
    root.rotation.y = v.yaw;
    const speed = Math.min(1.2, Math.hypot(e.vx || 0, e.vz || 0) / Math.max(0.1, (e.stats.get('moveSpeed') || 5.6)));
    v.speed = (v.speed ?? 0) + (speed - (v.speed ?? 0)) * Math.min(1, dt * 12);
    // animation state
    const st = { speed: v.speed, t, dead: e.dead, deadT: e.dead ? world.time - e.deathTime : 0, hurt: 0, cast: null, dashing: !!e.dash, dashP: 0, dashHint: null, listening: !!e.listen?.active };
    const since = world.time - e.lastHurtTime;
    st.hurt = since < 0.18 ? 1 - since / 0.18 : 0;
    setFlash(m, since < 0.07 && !e.dead);
    if (e.dash) { st.dashP = Math.min(1, e.dash.t / e.dash.dur); st.dashHint = e.dash.cast?.ab?.fx?.anim ?? null; }
    const c = e.cast;
    if (c) {
      const hint = c.ab.fx?.anim ?? 'cast';
      if (c.phase === 'windup') st.cast = { phase: 'windup', p: c.windup > 0 ? c.t / c.windup : 1, hint };
      else if (c.phase === 'channel') st.cast = { phase: 'channel', p: c.chanElapsed, hint };
      else st.cast = { phase: 'recover', p: Math.min(1, c.t / c.recover), hint };
    }
    if (e.ai?.buried !== undefined) { st.buried = e.ai.buried; if (!e.ai.buried) v.emergeT += dt; st.emergeT = v.emergeT; }
    if (m.rig === 'burrower') st.emergeT = v.emergeT;
    animate(m, st, dt);
    // hidden enemies: invisible unless revealed by Listen (then ghost)
    const hiddenNow = e.hidden && e.untargetable && e.ai?.buried;
    root.visible = !(hiddenNow && !e.revealedHit && !(e.revealedUntil > world.time));
    if (hiddenNow) setGhost(m, true); else if (m.ghosted) setGhost(m, false);
    m.ghosted = hiddenNow;
    // selection ring & aura
    const hovered = hoverUid === e.uid && !e.dead;
    v.ring.material.opacity = hovered ? 0.9 : 0;
    v.ring.material.color.set(e.team === 'enemy' ? '#ff6a5a' : '#ffd27a');
    v.ring.scale.setScalar(Math.max(0.8, e.radius * 1.6));
    if (m.aura) { m.aura.rotation.y = t * 0.5; m.aura.material.opacity = e.dead ? 0 : 0.45 + Math.sin(t * 3) * 0.12; }
    // death fade-out of the whole model
    if (e.dead) {
      const k = world.time - e.deathTime;
      if (k > 2.4) root.scale.setScalar(Math.max(0.001, 1 - (k - 2.4) / 1.0));
      v.ring.material.opacity = 0;
    }
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
      v.set(e.x, e.y + (e.height ?? 1.5) * 0.55, e.z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * size.w, sy = (-v.y * 0.5 + 0.5) * size.h;
      const pix = Math.max(26, (e.height ?? 1.5) * 16 + e.radius * 20);
      const d = Math.hypot(sx - px, sy - py);
      if (d < pix && d < bd) { bd = d; best = e; }
    }
    return best;
  }
}
