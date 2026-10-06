/**
 * Procedural animation: locomotion cycles + two-keyframe attack poses (A = wind-up, B = strike) driven by
 * the simulation's cast phase. Quality comes from timing (anticipation → snap → follow-through), not mocap.
 * st = { speed, cast:{phase,p,hint}|null, hurt (0..1 fresh), dead, deadT, dashing, dashP, dashHint, t, listening }
 */
import { clamp, lerp } from '../../core/math.js';

const PI = Math.PI;
const ease = (t) => t * t * (3 - 2 * t);
const out = (t) => 1 - (1 - t) * (1 - t);

// pose = additive euler rotations (radians) per role + optional hip offset [x,y,z]
const BIPED_POSES = {
  swing_h: { A: { armR: [-2.2, 0.5, 0.2], armL: [-0.5, 0, 0], body: [0, -0.55, 0], head: [0, 0.2, 0] }, B: { armR: [0.1, -0.7, 0], armL: [0.2, 0, 0], body: [0.12, 0.7, 0], head: [0, -0.2, 0], pos: [0, 0, 0.12] } },
  slam: { A: { armR: [-3.0, 0, -0.1], armL: [-3.0, 0, 0.1], body: [-0.28, 0, 0], pos: [0, 0.05, -0.05] }, B: { armR: [0.5, 0, 0], armL: [0.5, 0, 0], body: [0.55, 0, 0], pos: [0, -0.16, 0.2] } },
  smash: null, knell: null,
  throw: { A: { armR: [-0.6, 0, -1.2], body: [0, -0.6, 0.1], armL: [0.3, 0, 0.4] }, B: { armR: [-1.5, 0, 0.1], body: [0.1, 0.55, 0], armL: [-0.3, 0, 0] } },
  cast: { A: { armR: [-1.0, 0, 0.1], armL: [-1.0, 0, -0.1], body: [-0.12, 0, 0] }, B: { armR: [-1.55, 0, 0.1], armL: [-1.55, 0, -0.1], body: [0.12, 0, 0], pos: [0, 0, 0.05] } },
  pray: { A: { armR: [-2.4, 0, 0.5], armL: [-2.4, 0, -0.5], head: [-0.4, 0, 0], body: [-0.1, 0, 0] }, B: { armR: [-2.9, 0, 0.8], armL: [-2.9, 0, -0.8], head: [-0.6, 0, 0] } },
  toll: { A: { armR: [-2.6, 0, 0.2], armL: [-2.6, 0, -0.2], body: [-0.2, 0, 0] }, B: { armR: [-0.3, 0, 0.1], armL: [-0.3, 0, -0.1], body: [0.35, 0, 0], pos: [0, -0.06, 0.08] } },
  stab: { A: { armR: [-0.5, 0, 0], body: [0, -0.35, 0], pos: [0, -0.04, -0.12] }, B: { armR: [-1.5, 0, 0], body: [0.2, 0.35, 0], pos: [0, -0.05, 0.38] } },
  bash: { A: { armL: [-0.4, 0, 0], armR: [-0.5, 0, 0], body: [0, 0.3, 0], pos: [0, 0, -0.1] }, B: { armL: [-1.45, 0, 0], armR: [-0.3, 0, 0], body: [0.15, -0.2, 0], pos: [0, 0, 0.3] } },
  swing: null, wail: { A: { armR: [-2.7, 0, 0.9], armL: [-2.7, 0, -0.9], head: [-0.7, 0, 0], body: [-0.2, 0, 0] }, B: { armR: [-1.0, 0, 1.2], armL: [-1.0, 0, -1.2], head: [0.2, 0, 0], body: [0.2, 0, 0] } },
  charge: { A: { body: [0.5, 0, 0], armR: [-0.4, 0, 0], armL: [-0.4, 0, 0], pos: [0, -0.2, -0.1] }, B: { body: [0.65, 0, 0], armR: [-1.3, 0, 0], armL: [-1.3, 0, 0], pos: [0, -0.15, 0.2] } },
  leap: { A: { body: [0.5, 0, 0], pos: [0, -0.25, -0.1] }, B: { body: [-0.3, 0, 0], armR: [-2.2, 0, 0], armL: [-2.2, 0, 0], pos: [0, 0.1, 0.2] } },
  brace: { A: { armR: [-1.2, 0, 0.6], armL: [-1.2, 0, -0.6], body: [0.15, 0, 0], pos: [0, -0.08, 0] }, B: { armR: [-1.4, 0, 0.5], armL: [-1.4, 0, -0.5], body: [0.1, 0, 0], pos: [0, -0.1, 0] } },
  summon: { A: { armR: [-2.5, 0, 1.0], armL: [-2.5, 0, -1.0], head: [-0.5, 0, 0] }, B: { armR: [-1.2, 0, 0.5], armL: [-1.2, 0, -0.5], head: [0.1, 0, 0] } },
  fuse: { A: { armR: [-0.5, 0, 0.4], armL: [-0.5, 0, -0.4], body: [0.2, 0, 0], pos: [0, -0.1, 0] }, B: { armR: [-3, 0, 0.4], armL: [-3, 0, -0.4], body: [-0.4, 0, 0] } },
};
BIPED_POSES.smash = BIPED_POSES.slam; BIPED_POSES.knell = BIPED_POSES.slam; BIPED_POSES.swing = BIPED_POSES.swing_h; BIPED_POSES.lob = BIPED_POSES.throw; BIPED_POSES.howl = BIPED_POSES.wail;
BIPED_POSES.stomp = BIPED_POSES.slam; BIPED_POSES.gore = BIPED_POSES.charge; BIPED_POSES.bite = BIPED_POSES.stab; BIPED_POSES.sting = BIPED_POSES.stab; BIPED_POSES.pulse = BIPED_POSES.pray;

const _rest = new Map();
function setRot(m, name, rx = 0, ry = 0, rz = 0) {
  const o = m.roles[name]; if (!o) return;
  const r = m.rest[name].r;
  o.rotation.set(r.x + rx, r.y + ry, r.z + rz);
}
function pose(a, b, k) { // lerp two pose dictionaries into a flat map role→[x,y,z]
  const res = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    const A = a?.[key] ?? [0, 0, 0], B = b?.[key] ?? [0, 0, 0];
    res[key] = [lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)];
  }
  return res;
}
function attackPose(table, c) {
  const P = table[c.hint] ?? table.cast ?? null;
  if (!P) return null;
  if (c.phase === 'windup') return pose({}, P.A, ease(clamp(c.p, 0, 1)));
  if (c.phase === 'channel') return pose(P.A, P.B, 0.5 + Math.sin(c.p * 40) * 0.1);
  // recover: A→B snap in the first 18 %, then B→rest
  if (c.p < 0.18) return pose(P.A, P.B, ease(c.p / 0.18));
  return pose(P.B, {}, out((c.p - 0.18) / 0.82));
}

export function animate(m, st, dt) {
  const f = RIGS[m.rig] ?? RIGS.biped;
  m.phase = (m.phase ?? Math.random() * 6) + dt * (4 + st.speed * 9);
  f(m, st, dt);
  // generic death
  if (st.dead) {
    const k = clamp(st.deadT / 0.55, 0, 1);
    m.root.rotation.x = -ease(k) * (m.rig === 'quadruped' ? 0.0 : PI / 2);
    if (m.rig === 'quadruped') m.root.rotation.z = ease(k) * (PI / 2);
    m.root.position.y = -ease(clamp((st.deadT - 1.6) / 1.6, 0, 1)) * 0.9;
    if (m.rig === 'floater' || m.rig === 'swarm') m.root.position.y = -ease(k) * (m.hoverY ?? 1);
  } else { m.root.rotation.x = 0; m.root.rotation.z = 0; }
}

const RIGS = {
  biped(m, st, dt) {
    const sp = st.speed, ph = m.phase;
    const swing = Math.sin(ph) * 0.85 * sp;
    const hips = m.hips, s = m.s;
    const breathe = Math.sin(st.t * 1.8 + (m.seed ?? 0)) * 0.012;
    hips.position.copy(m.rest.body.p);
    hips.position.y += Math.abs(Math.sin(ph)) * 0.05 * sp * s + breathe + (m.extras.hover ? 0.2 + Math.sin(st.t * 2) * 0.08 : 0);
    setRot(m, 'legL', swing, 0, 0); setRot(m, 'legR', -swing, 0, 0);
    setRot(m, 'legLShin', Math.max(0, -swing) * 0.9, 0, 0); setRot(m, 'legRShin', Math.max(0, swing) * 0.9, 0, 0);
    let armR = [-swing * 0.8, 0, 0.05], armL = [swing * 0.8, 0, -0.05];
    if (m.spec.p.weaponR) armR = [-0.35 - swing * 0.25, 0, 0.05];
    setRot(m, 'armL', ...armL); setRot(m, 'armR', ...armR);
    setRot(m, 'armLFore', -0.18 - sp * 0.2, 0, 0); setRot(m, 'armRFore', -0.18 - sp * 0.2, 0, 0);
    setRot(m, 'body', 0.08 * sp, Math.sin(ph) * 0.12 * sp, 0); setRot(m, 'head', -0.04 * sp, -Math.sin(ph) * 0.06 * sp, 0);
    if (st.cast) {
      const P = attackPose(BIPED_POSES, st.cast);
      if (P) {
        const g = (k) => P[k] ?? [0, 0, 0];
        setRot(m, 'armR', ...g('armR')); setRot(m, 'armL', ...g('armL'));
        setRot(m, 'armRFore', -0.3 + (g('armR')[0] < -1 ? -0.2 : 0.2), 0, 0); setRot(m, 'armLFore', -0.3, 0, 0);
        setRot(m, 'body', ...g('body')); setRot(m, 'head', ...g('head'));
        const pp = P.pos ?? [0, 0, 0]; hips.position.x += pp[0] * s; hips.position.y += pp[1] * s; hips.position.z += pp[2] * s;
        const rest = m.rest.legL.r;
        if (st.cast.phase !== 'windup' || st.cast.hint === 'leap') { setRot(m, 'legL', 0.25, 0, 0); setRot(m, 'legR', -0.35, 0, 0); }
      }
    }
    if (st.dashing && st.dashHint === 'roll') { hips.rotation.x = st.dashP * PI * 2; hips.position.y -= 0.25 * s; } else if (!st.cast) hips.rotation.x = m.rest.body.r.x;
    if (st.hurt > 0) { hips.rotation.x -= st.hurt * 0.4; }
    if (st.listening) { setRot(m, 'head', 0.1, 0.35 * Math.sin(st.t * 1.4), 0.12); }
    if (m.extras.orbit) {
      const o = m.extras.orbit; o.position.y = (1.15 + Math.sin(st.t * 1.5) * 0.08) * s;
      o.children.forEach((c, i) => { const a = c.userData.phase + st.t * (st.cast ? 3.2 : 1.1); c.position.set(Math.sin(a) * 0.62 * s, Math.sin(a * 1.7) * 0.15 * s, Math.cos(a) * 0.62 * s); c.rotation.y = a; c.rotation.x = a * 0.7; });
    }
    if (m.extras.hangBell) m.extras.hangBell.rotation.z = Math.sin(ph * 1) * 0.5 * sp + Math.sin(st.t * 3) * 0.04;
    if (m.extras.scarfTail) m.extras.scarfTail.rotation.x = 0.5 + Math.sin(st.t * 6 + ph) * 0.12 + sp * 0.5;
  },

  quadruped(m, st) {
    const sp = st.speed, ph = m.phase, s = m.s;
    const sw = Math.sin(ph * 1.2) * 0.9 * sp;
    m.hips.position.copy(m.rest.body.p); m.hips.position.y += Math.abs(Math.sin(ph * 1.2)) * 0.06 * sp * s;
    setRot(m, 'legFL', sw); setRot(m, 'legBR', sw); setRot(m, 'legFR', -sw); setRot(m, 'legBL', -sw);
    setRot(m, 'tail', 0, Math.sin(ph * 0.6) * 0.4 * (0.4 + sp), 0); setRot(m, 'head', Math.sin(ph * 1.2) * 0.08 * sp, Math.sin(st.t * 0.9) * 0.12 * (1 - sp), 0);
    setRot(m, 'body', 0, 0, 0);
    if (st.cast) {
      const c = st.cast, k = c.phase === 'windup' ? ease(c.p) : (c.p < 0.18 ? 1 : 1 - out((c.p - 0.18) / 0.82));
      const strike = c.phase !== 'windup' && c.p < 0.3 ? 1 : 0;
      if (c.hint === 'leap' || c.hint === 'charge') {
        setRot(m, 'body', (c.phase === 'windup' ? 0.35 * k : -0.25 * k), 0, 0); m.hips.position.y -= (c.phase === 'windup' ? 0.28 * k : -0.1 * k) * s;
        setRot(m, 'head', c.hint === 'charge' ? 0.5 * k : -0.3 * k, 0, 0);
        for (const n of ['legFL', 'legFR', 'legBL', 'legBR']) setRot(m, n, c.phase === 'windup' ? 0.6 * k : -0.9 * k);
        if (c.hint === 'charge' && c.phase === 'windup') { m.roles.legFL && setRot(m, 'legFL', -0.9 * Math.abs(Math.sin(st.t * 18))); } // paw the ground
      } else { // bite / gore
        setRot(m, 'head', (c.phase === 'windup' ? -0.5 * k : 0.45 * (1 - k) + 0.1), 0, 0); m.hips.position.z += (c.phase === 'windup' ? -0.12 : 0.28 * (1 - k)) * s; setRot(m, 'body', strike * 0.12, 0, 0);
      }
    }
    if (st.hurt > 0) m.hips.position.z -= st.hurt * 0.15 * s;
  },

  floater(m, st) {
    const s = m.s;
    m.hips.position.y = m.rest.body.p.y + Math.sin(st.t * 1.9 + (m.seed ?? 0)) * 0.12 * s;
    const halo = m.extras.halo; halo.rotation.y = st.t * (st.cast ? 6 : 1.6); halo.rotation.x = Math.sin(st.t * 1.2) * 0.3;
    for (const w of ['wingL', 'wingR']) if (m.roles[w]) m.roles[w].rotation.z = (w === 'wingL' ? 1 : -1) * Math.sin(st.t * 24) * 0.5;
    m.hips.rotation.x = st.speed * 0.25;
    let sc = 1;
    if (st.cast) { const c = st.cast; sc = c.phase === 'windup' ? 1 + 0.35 * ease(c.p) : 1 + 0.35 * (1 - out(c.p)); m.hips.position.y += c.phase === 'windup' ? 0.25 * ease(c.p) : 0; }
    halo.scale.setScalar(sc);
    m.hips.scale.setScalar(st.cast ? 1 + (sc - 1) * 0.3 : 1);
    if (st.hurt > 0) m.hips.position.z -= st.hurt * 0.2;
  },

  swarm(m, st) {
    m.hips.position.y = m.rest.body.p.y + Math.sin(st.t * 3 + (m.seed ?? 0)) * 0.12;
    for (const w of ['wingL', 'wingR']) m.roles[w].rotation.z = (w === 'wingL' ? 1 : -1) * Math.sin(st.t * 60 + (m.seed ?? 0)) * 0.7;
    m.hips.rotation.x = st.cast ? (st.cast.phase === 'windup' ? -0.6 : 0.5) : 0.15 * st.speed;
    if (st.cast && st.cast.phase !== 'windup' && st.cast.p < 0.3) m.hips.position.z += 0.25;
  },

  crawler(m, st) {
    const ph = m.phase, sp = st.speed;
    for (let i = 0; i < 8; i++) { const l = m.roles[`leg${i}`]; if (!l) continue; const k = (i % 2 ? 1 : -1) * Math.sin(ph * 1.6 + i) * 0.35 * sp; l.rotation.y = m.rest[`leg${i}`].r.y + k; l.position.y = Math.max(0, Math.sin(ph * 1.6 + i)) * 0.06 * sp; }
    m.hips.position.y = m.rest.body.p.y + Math.sin(st.t * 2.2) * 0.012;
    if (st.cast) { const c = st.cast; m.hips.rotation.x = c.phase === 'windup' ? -0.45 * ease(c.p) : 0.3 * (1 - out(c.p)); m.hips.position.y -= c.phase === 'windup' ? 0.05 : 0; }
    else m.hips.rotation.x = 0;
    if (st.hurt > 0) m.hips.position.z -= st.hurt * 0.12;
  },

  turret(m, st) {
    const h = m.extras.head; h.position.y = m.rest.head ? m.rest.head.p.y : h.position.y;
    h.rotation.x = 0;
    if (st.cast) { const c = st.cast; const k = c.phase === 'windup' ? ease(c.p) : 1 - out(c.p); h.position.z = -0.12 * (c.phase === 'windup' ? k : -0.6 * k); h.scale.setScalar(1 + 0.08 * k); } else { h.position.z = 0; h.scale.setScalar(1); }
  },

  burrower(m, st) {
    // buried: scale y near 0; emerge when visible
    const emerge = st.buried ? 0.04 : clamp(st.emergeT / 0.45, 0, 1);
    m.hips.scale.set(1, 0.02 + emerge * 0.98, 1);
    m.extras.mound.visible = emerge < 0.95 || st.buried;
    m.extras.mound.scale.setScalar(1 - emerge * 0.5);
    if (st.cast) { const c = st.cast; m.hips.rotation.x = c.phase === 'windup' ? -0.4 * ease(c.p) : 0.5 * (1 - out(c.p)); } else m.hips.rotation.x = Math.sin(st.t * 1.5) * 0.08;
    m.hips.rotation.z = Math.sin(st.t * 1.3) * 0.06;
    if (st.hurt > 0) m.hips.rotation.x -= st.hurt * 0.4;
  },

  cocoon(m, st) {
    const pulse = 1 + Math.sin(st.t * 2.6) * 0.05 + (st.cast ? (st.cast.phase === 'windup' ? 0.25 * ease(st.cast.p) : 0.25 * (1 - out(st.cast.p))) : 0);
    m.hips.scale.set(pulse, pulse * 1.02, pulse);
    m.extras.core.material.emissiveIntensity = 1.2 + Math.sin(st.t * 2.6) * 0.6;
    if (st.hurt > 0) m.hips.scale.multiplyScalar(1 - st.hurt * 0.1);
  },

  reaper(m, st) {
    m.extras.saw.rotation.y += 0.45 + st.speed * 0.2;
    m.hips.position.y = m.rest.body.p.y + Math.sin(st.t * 14) * 0.015;
  },

  dummy(m, st) { m.hips.rotation.z = st.hurt * 0.3; },
};
