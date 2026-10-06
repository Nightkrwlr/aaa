/**
 * creatures — every non-humanoid enemy, hand-built in the KayKit visual language (chunky bevelled low-poly, baked gradient
 * colour, strong silhouette, emissive accents in the Resonance cyan / amber / hollow violet).
 *
 * Each builder returns a model: { root, rig, height, s, tick(st, dt), ...refs }.  `tick` is driven by EntityViews with the
 * simulation-derived state `st` (mps, cast{phase,p,hint,t,windup,recover}, dash, hurt, dead, deadT, aggro, buried, emergeT, t).
 * Joints are named Groups so `boneWorldPos` can find them; meshes come from stylekit (shared, cached geometry).
 */
import * as THREE from 'three';
import { P, J, G, add, shade, mix } from './stylekit.js';

const PI = Math.PI;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const outq = (t) => 1 - (1 - t) * (1 - t);
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

/** own a per-instance copy of a glow mesh's material so it can pulse independently */
function own(mesh) { mesh.material = mesh.material.clone(); mesh.userData.base = mesh.material.color.clone(); return mesh; }
function pulse(mesh, k) { mesh.material.color.copy(mesh.userData.base).multiplyScalar(k); }

/** limb hanging from its joint: tapered cylinder of length `len` + rounded end cap */
function limb(len, r0, r1, color, { cap = true, seg = 7, top = 1.15, bot = 0.8 } = {}) {
  const g = G();
  g.add(P('cyl', [r0, r1, len, seg], color, { pos: [0, -len / 2, 0], top, bot }));
  if (cap) g.add(P('sph', [r1 * 1.12, 8, 6], color, { pos: [0, -len, 0], top: 1.05, bot: 0.9 }));
  return g;
}

/** two-segment animal leg: hip joint → upper → knee joint → lower → paw. Returns { hip, knee }. */
function leg(parent, pos, { upper = 0.36, lower = 0.38, r = 0.085, color = '#6d6256', paw = '#4a423a', pawSize = [0.14, 0.07, 0.22], claws = '#e6dcc4', name = 'leg', flip = 1 } = {}) {
  const hip = J(`${name}`, pos);
  hip.add(P('sph', [r * 1.45, 9, 7], color, { pos: [0, 0.02, 0], top: 1.1, bot: 0.9 }));      // shoulder / haunch mass blends the limb into the torso
  hip.add(limb(upper, r * 1.05, r * 0.78, color));
  const knee = J(`${name}Low`, [0, -upper, 0]);
  knee.add(limb(lower, r * 0.74, r * 0.52, color, { cap: false }));
  const foot = J(`${name}Paw`, [0, -lower, 0]);
  foot.add(P('rbox', [pawSize[0], pawSize[1], pawSize[2], 0.025], paw, { pos: [0, pawSize[1] / 2 - 0.01, pawSize[2] * 0.25] }));
  if (claws) for (let i = -1; i <= 1; i++) foot.add(P('cone', [0.016, 0.07, 4], claws, { pos: [i * pawSize[0] * 0.3, pawSize[1] * 0.4, pawSize[2] * 0.62], rot: [PI / 2, 0, 0] }));
  knee.add(foot); hip.add(knee); parent.add(hip);
  return { hip, knee, foot };
}

/** a chain of tapered segments that can whip: returns the array of joints */
function tailChain(parent, pos, segs, { len = 0.3, r0 = 0.09, r1 = 0.02, color = '#6d6256', tipColor = null, curve = 0.1 } = {}) {
  const joints = [];
  let cur = parent, p = pos;
  for (let i = 0; i < segs; i++) {
    const j = J(`tail${i}`, p);
    const ra = lerp(r0, r1, i / segs), rb = lerp(r0, r1, (i + 1) / segs);
    j.add(P('cyl', [rb, ra, len, 6], i === segs - 1 && tipColor ? tipColor : color, { pos: [0, 0, -len / 2], rot: [PI / 2, 0, 0] }));
    j.add(P('sph', [rb * 1.05, 6, 5], color, { pos: [0, 0, -len] }));
    cur.add(j); joints.push(j); cur = j; p = [0, 0, -len];
  }
  return joints;
}

/** simulation-state helpers shared by every tick */
function castInfo(st) {
  const c = st.cast; if (!c) return { k: 0, phase: null, hint: null, windup: 0, strike: 0, recover: 0 };
  const windup = c.phase === 'windup' ? ease(clamp(c.p)) : 1;
  const strike = c.phase === 'recover' ? (c.p < 0.2 ? clamp(c.p / 0.2) : 1 - ease((c.p - 0.2) / 0.8)) : 0;
  const rec = c.phase === 'recover' ? clamp((c.p - 0.2) / 0.8) : 0;
  return { phase: c.phase, hint: c.hint, windup: c.phase === 'windup' ? windup : (c.phase === 'channel' ? 1 : 0), strike, recover: rec, p: c.p };
}

// ═════════════════════════════════════════════════════ QUADRUPEDS (stalker · boar · matriarch)
const QUAD = {
  stalker: { stride: 1.5, bodyLen: 1.05, upper: 0.3, lower: 0.34, r: 0.115, hind: 1.0, front: 1.0 },
  boar: { stride: 1.7, bodyLen: 1.35, upper: 0.24, lower: 0.28, r: 0.21, hind: 1.0, front: 1.0 },
  matriarch: { stride: 2.3, bodyLen: 1.5, upper: 0.46, lower: 0.5, r: 0.26, hind: 1.0, front: 1.0 },
};

function quadruped(p, kind) {
  const s = p.scale ?? 1;
  const cfg = QUAD[kind];
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  const hide = p.color, belly = p.belly, bone = p.bone ?? '#e6dcc4', glow = p.glow ?? '#7fe3ff';
  const legH = (cfg.upper + cfg.lower) * 0.93;           // body centre height so the paws just touch the ground in the rest pose
  const body = J('body', [0, legH + 0.1, 0]); wrap.add(body);
  const parts = { glows: [] };
  const L = cfg.bodyLen;
  if (kind === 'stalker') {
    body.add(P('rbox', [0.5, 0.5, L, 0.17], hide, { pos: [0, 0, 0] }));
    body.add(P('rbox', [0.58, 0.62, 0.52, 0.2], hide, { pos: [0, 0.04, L * 0.36] }));            // chest
    body.add(P('rbox', [0.5, 0.52, 0.5, 0.18], mix(hide, '#000000', 0.08), { pos: [0, -0.01, -L * 0.4] }));   // rump
    body.add(P('rbox', [0.4, 0.26, L * 0.9, 0.1], belly, { pos: [0, -0.2, 0.0], top: 1.1, bot: 0.9 }));
    for (let i = 0; i < 6; i++) body.add(P('cone', [0.055 - i * 0.004, 0.24 - i * 0.02, 5], bone, { pos: [0, 0.3 + (i < 2 ? 0.04 : 0), L * 0.42 - i * 0.18], rot: [-0.25, 0, 0], flat: true }));
    for (const sx of [-1, 1]) parts.glows.push(body.add(own(P('rbox', [0.025, 0.035, 0.7, 0.01], glow, { glow: 1.8, pos: [sx * 0.265, 0.06, 0.02] }))) && body.children[body.children.length - 1]);
  } else if (kind === 'boar') {
    body.add(P('rbox', [0.98, 0.86, 1.2, 0.3], hide, { pos: [0, 0, -0.02] }));
    body.add(P('rbox', [1.08, 0.96, 0.62, 0.34], hide, { pos: [0, 0.07, L * 0.34] }));             // heavy shoulders
    body.add(P('rbox', [0.9, 0.7, 0.6, 0.26], mix(hide, '#000000', 0.12), { pos: [0, -0.04, -L * 0.38] }));
    body.add(P('rbox', [0.7, 0.34, L * 0.9, 0.14], belly, { pos: [0, -0.3, 0.0], top: 1.1, bot: 0.9 }));
    // cracked stone hide: a mane of jagged shards down the spine, two shoulder slabs, glowing fissures along the flanks
    const stone = mix(hide, '#9a9284', 0.35);
    for (let i = 0; i < 7; i++) {
      const hgt = 0.42 - Math.abs(i - 2) * 0.045 + (i % 2) * 0.05;
      body.add(P('cone', [0.13 - i * 0.004, hgt, 4], stone, { pos: [((i % 3) - 1) * 0.06, 0.46 + hgt * 0.35, L * 0.42 - i * 0.2], rot: [-0.35, i * 0.7, ((i % 2) - 0.5) * 0.25], flat: true }));
    }
    for (const sx of [-1, 1]) {
      body.add(P('rbox', [0.34, 0.12, 0.5, 0.04], stone, { pos: [sx * 0.42, 0.42, L * 0.3], rot: [0.1, sx * 0.1, sx * -0.35], flat: true }));
      body.add(P('rbox', [0.3, 0.1, 0.46, 0.04], stone, { pos: [sx * 0.38, 0.36, -L * 0.28], rot: [-0.1, -sx * 0.1, sx * -0.3], flat: true }));
      for (let k = 0; k < 3; k++) { const g = own(P('rbox', [0.035, 0.34 - k * 0.04, 0.05, 0.015], glow, { glow: 2.1, pos: [sx * (0.5 + k * 0.012), 0.02 - k * 0.04, 0.34 - k * 0.34], rot: [0, 0, sx * (0.12 + k * 0.1)] })); body.add(g); parts.glows.push(g); }
      const g2 = own(P('rbox', [0.2, 0.035, 0.05, 0.015], glow, { glow: 2.3, pos: [sx * 0.2, 0.52, L * 0.3], rot: [0, sx * 0.5, 0] })); body.add(g2); parts.glows.push(g2);
    }
  } else { // matriarch
    body.add(P('rbox', [1.0, 0.95, 1.55, 0.34], hide, { pos: [0, 0, 0] }));
    body.add(P('rbox', [1.14, 1.12, 0.72, 0.4], hide, { pos: [0, 0.08, L * 0.36] }));
    body.add(P('rbox', [0.96, 0.9, 0.7, 0.34], mix(hide, '#000000', 0.1), { pos: [0, 0, -L * 0.38] }));
    body.add(P('rbox', [0.76, 0.4, L * 0.95, 0.16], belly, { pos: [0, -0.34, 0.0], top: 1.1, bot: 0.9 }));
    // brood sacs on the back: glowing translucent egg clusters
    const sacs = [[-0.28, 0.62, 0.35, 0.3], [0.3, 0.6, 0.05, 0.34], [-0.1, 0.66, -0.35, 0.28], [0.26, 0.58, -0.5, 0.24], [-0.32, 0.55, -0.1, 0.22]];
    parts.sacs = [];
    for (const [x, y, z, r] of sacs) {
      const g = J('sac', [x, y, z]);
      g.add(P('sph', [r, 9, 7], shade(hide, 0.2), { opacity: 0.88, scale: [1, 0.85, 1] }));
      const core = own(P('sph', [r * 0.62, 8, 6], glow, { glow: 1.6 })); g.add(core); parts.glows.push(core); parts.sacs.push(g);
      body.add(g);
    }
    for (let i = 0; i < 5; i++) body.add(P('cone', [0.1, 0.42 - i * 0.04, 5], bone, { pos: [(i % 2 ? 1 : -1) * 0.3, 0.52, L * 0.42 - i * 0.28], rot: [-0.25, 0, (i % 2 ? -1 : 1) * 0.35], flat: true }));
  }

  // ── head
  const head = J('head', [0, kind === 'boar' ? 0.02 : 0.2, L * (kind === 'boar' ? 0.6 : 0.62)]); body.add(head);
  const jaw = J('jaw', [0, -0.1, 0.1]);
  const eyeG = [];
  if (kind === 'stalker') {
    head.add(P('rbox', [0.42, 0.36, 0.46, 0.13], hide, { pos: [0, 0.03, 0.14] }));
    head.add(P('rbox', [0.26, 0.2, 0.34, 0.08], belly, { pos: [0, -0.04, 0.4] }));
    for (let i = -2; i <= 2; i++) head.add(P('cone', [0.04, 0.16 - Math.abs(i) * 0.03, 4], bone, { pos: [i * 0.075, 0.2, -0.08], rot: [-0.7, 0, -i * 0.2], flat: true }));   // ruff of bone spikes
    jaw.add(P('rbox', [0.2, 0.06, 0.3, 0.02], shade(belly, -0.1), { pos: [0, -0.01, 0.15] }));
    for (const sx of [-1, 1]) { jaw.add(P('cone', [0.018, 0.07, 4], '#ffffff', { pos: [sx * 0.07, 0.04, 0.26], rot: [PI, 0, 0] })); head.add(P('cone', [0.018, 0.07, 4], '#ffffff', { pos: [sx * 0.07, -0.08, 0.46], rot: [PI, 0, 0] })); }
    for (const sx of [-1, 1]) {
      const e = own(P('rbox', [0.07, 0.03, 0.045, 0.01], glow, { glow: 2.6, pos: [sx * 0.135, 0.09, 0.3], rot: [0, sx * 0.4, 0] })); head.add(e); eyeG.push(e);
      head.add(P('tube', [[[sx * 0.1, 0.16, 0.06], [sx * 0.2, 0.34, -0.06], [sx * 0.22, 0.44, -0.3], [sx * 0.18, 0.4, -0.5]], 0.05, 0.008, { segs: 8, radial: 5 }], bone, { top: 1.15, bot: 0.9 }));
      head.add(P('cone', [0.05, 0.14, 4], hide, { pos: [sx * 0.15, 0.2, 0.0], rot: [-0.2, 0, -sx * 0.4] }));
    }
  } else if (kind === 'boar') {
    head.add(P('rbox', [0.66, 0.56, 0.62, 0.2], hide, { pos: [0, 0.0, 0.3] }));
    head.add(P('rbox', [0.4, 0.3, 0.3, 0.1], belly, { pos: [0, -0.1, 0.62] }));                  // snout
    head.add(P('rbox', [0.3, 0.2, 0.06, 0.04], '#3a302a', { pos: [0, -0.06, 0.78] }));          // nose disc
    jaw.position.set(0, -0.2, 0.3); jaw.add(P('rbox', [0.34, 0.08, 0.3, 0.03], '#4a3e34', { pos: [0, 0, 0.1] }));
    for (const sx of [-1, 1]) {
      head.add(P('tube', [[[sx * 0.2, -0.12, 0.62], [sx * 0.34, -0.2, 0.74], [sx * 0.42, 0.0, 0.84], [sx * 0.4, 0.22, 0.82]], 0.07, 0.012, { segs: 8, radial: 5 }], '#efe3c8', { top: 1.2, bot: 0.85 }));
      const e = own(P('rbox', [0.08, 0.04, 0.04, 0.01], glow, { glow: 2.8, pos: [sx * 0.2, 0.12, 0.56], rot: [0, 0, sx * -0.35] })); head.add(e); eyeG.push(e);
      head.add(P('cone', [0.09, 0.2, 4], hide, { pos: [sx * 0.24, 0.32, 0.12], rot: [-0.1, 0, -sx * 0.5] }));
      head.add(P('rbox', [0.14, 0.1, 0.18, 0.04], shade(hide, 0.1), { pos: [sx * 0.2, 0.22, 0.4], flat: true }));
    }
  } else {
    head.add(P('rbox', [0.7, 0.58, 0.8, 0.22], hide, { pos: [0, 0.05, 0.28] }));
    head.add(P('rbox', [0.46, 0.32, 0.5, 0.12], mix(hide, bone, 0.25), { pos: [0, -0.07, 0.72] }));
    jaw.position.set(0, -0.22, 0.3); jaw.add(P('rbox', [0.4, 0.1, 0.62, 0.04], shade(belly, -0.1), { pos: [0, 0, 0.3] }));
    for (const sx of [-1, 1]) {
      jaw.add(P('cone', [0.035, 0.16, 4], '#ffffff', { pos: [sx * 0.14, 0.1, 0.54], rot: [PI, 0, 0] }));
      head.add(P('cone', [0.035, 0.16, 4], '#ffffff', { pos: [sx * 0.14, -0.14, 0.9], rot: [PI, 0, 0] }));
      const e = own(P('rbox', [0.1, 0.05, 0.05, 0.012], glow, { glow: 2.8, pos: [sx * 0.25, 0.22, 0.52], rot: [0, 0, sx * -0.3] })); head.add(e); eyeG.push(e);
      head.add(P('tube', [[[sx * 0.2, 0.28, 0.1], [sx * 0.42, 0.5, -0.1], [sx * 0.62, 0.62, -0.4], [sx * 0.64, 0.5, -0.7]], 0.12, 0.018, { segs: 10, radial: 6 }], bone, { top: 1.2, bot: 0.85 }));
    }
    // bony crest fanning behind the head
    for (let i = -2; i <= 2; i++) head.add(P('cone', [0.1, 0.62 - Math.abs(i) * 0.1, 5], bone, { pos: [i * 0.17, 0.46 - Math.abs(i) * 0.04, -0.12], rot: [-0.55, 0, i * -0.22], flat: true }));
  }
  head.add(jaw);
  const neckLen = kind === 'matriarch' ? 0.55 : kind === 'boar' ? 0.35 : 0.4;
  body.add(P('rbox', [kind === 'matriarch' ? 0.62 : kind === 'boar' ? 0.7 : 0.3, kind === 'matriarch' ? 0.66 : kind === 'boar' ? 0.62 : 0.32, neckLen, 0.12], hide, { pos: [0, kind === 'boar' ? 0.04 : 0.14, L * 0.5 + 0.02] }));
  body.add(head);

  // ── legs
  const lx = kind === 'boar' ? 0.34 : kind === 'matriarch' ? 0.4 : 0.26, lz = L * 0.34;
  const legOpt = { upper: cfg.upper, lower: cfg.lower, r: cfg.r, color: hide, paw: shade(hide, -0.25), claws: kind === 'boar' ? null : bone, pawSize: kind === 'matriarch' ? [0.3, 0.12, 0.42] : kind === 'boar' ? [0.26, 0.12, 0.3] : [0.14, 0.07, 0.22] };
  const legs = {
    FL: leg(body, [lx, -0.1, lz], { ...legOpt, name: 'legFL' }), FR: leg(body, [-lx, -0.1, lz], { ...legOpt, name: 'legFR' }),
    BL: leg(body, [lx, -0.1, -lz], { ...legOpt, name: 'legBL' }), BR: leg(body, [-lx, -0.1, -lz], { ...legOpt, name: 'legBR' }),
  };
  // ── tail
  const tailOpt = kind === 'boar' ? { len: 0.16, r0: 0.07, r1: 0.025, color: hide, tipColor: '#2a2018' } : kind === 'matriarch' ? { len: 0.5, r0: 0.2, r1: 0.04, color: hide, tipColor: bone } : { len: 0.3, r0: 0.08, r1: 0.015, color: hide, tipColor: glow };
  const tail = tailChain(body, [0, 0.06, -L * 0.62], kind === 'boar' ? 2 : kind === 'matriarch' ? 4 : 5, tailOpt);
  // the Discordant "desafine": a faint duplicated echo of the tail / crest slightly out of phase
  let echo = null;
  if (kind === 'stalker') { echo = J('echo', [0, 0.1, -L * 0.6]); echo.add(P('tube', [[[0, 0, 0], [0.05, 0.18, -0.3], [-0.04, 0.34, -0.62], [0.06, 0.3, -0.95]], 0.07, 0.01, { segs: 8, radial: 5 }], glow, { glow: 1.4, opacity: 0.35 })); body.add(echo); }

  const model = {
    root, rig: kind, s, height: (kind === 'matriarch' ? 2.4 : kind === 'boar' ? 1.5 : 1.3) * s, body, head, jaw, legs, tail, echo, cfg, parts, eyeG, legH, phase: Math.random() * 6, yOff: 0, rollZ: 0, rollX: 0, atk: 0,
    tick: (st, dt) => quadTick(model, st, dt, kind),
  };
  return model;
}

function quadTick(m, st, dt, kind) {
  const { body, head, jaw, legs, tail, cfg, parts } = m;
  const t = st.t + m.phase;
  const mps = st.dash ? Math.max(st.mps, 6) : st.mps;
  const gait = clamp(mps / 5.2, 0, 1.3);
  m.gaitPh = (m.gaitPh ?? 0) + dt * (mps / cfg.stride) * PI * 2;
  const ph = m.gaitPh, moving = clamp(mps / 1.2, 0, 1);
  const c = castInfo(st);
  const hint = c.hint;
  const base = { fl: 0.3, fl2: -0.65, bl: 0.35, bl2: -0.75 };
  // rest + gait (diagonal pairs)
  const A = (0.5 + gait * 0.35) * moving, B = (0.55 + gait * 0.4) * moving;
  const setLeg = (lg, a1, a2, phase, front) => {
    const s1 = Math.sin(ph + phase), c1 = Math.cos(ph + phase);
    lg.hip.rotation.x = a1 + s1 * A * (front ? 1 : 0.9);
    lg.knee.rotation.x = a2 - Math.max(0, c1) * B - (front ? 0 : 0.0);
    lg.foot.rotation.x = -(lg.hip.rotation.x + lg.knee.rotation.x) * 0.9 + (front ? 0 : 0.1);
  };
  setLeg(legs.FL, base.fl, base.fl2, 0, true); setLeg(legs.BR, base.bl, base.bl2, 0, false);
  setLeg(legs.FR, base.fl, base.fl2, PI, true); setLeg(legs.BL, base.bl, base.bl2, PI, false);
  // body: bob + spine undulation + idle breathing
  const breath = Math.sin(t * 2.0) * 0.012;
  let by = m.legH + 0.1 + breath + Math.abs(Math.sin(ph)) * 0.05 * moving, bx = 0, bz = 0, bzRoll = 0, bzPos = 0;
  body.rotation.set(0, Math.sin(ph) * 0.06 * moving, 0);
  let headX = Math.sin(ph * 1 + 0.6) * 0.06 * moving + Math.sin(t * 0.7) * 0.05 * (1 - moving), headY = Math.sin(t * 0.5 + 1) * 0.18 * (1 - moving) * (st.aggro ? 0.15 : 1), headZ = 0;
  let jawOpen = 0.05 + Math.max(0, Math.sin(t * 0.9)) * 0.03;
  const tailSwing = (0.25 + gait * 0.2) * Math.sin(t * 2.4 + 1) + Math.sin(ph) * 0.15 * moving;
  let tailLift = 0.1;
  parts.glows.forEach((g, i) => pulse(g, 0.8 + 0.3 * Math.sin(t * 2.2 + i) + (st.aggro ? 0.3 : 0) + c.windup * 0.8));

  // ── attacks
  if (st.cast || st.dash) {
    const dashAir = st.dash && !st.dash.iframes;
    if (hint === 'leap' || (dashAir && kind === 'stalker')) {
      // pounce: crouch → spring → stretched flight
      if (!st.dash) { by -= 0.22 * c.windup; bx = -0.25 * c.windup; headX += 0.3 * c.windup; for (const lg of Object.values(legs)) { lg.hip.rotation.x += 0.5 * c.windup; lg.knee.rotation.x -= 0.5 * c.windup; } jawOpen += 0.25 * c.windup; tailLift = 0.5; }
      else { bx = 0.18; by += 0.15; legs.FL.hip.rotation.x = legs.FR.hip.rotation.x = -0.9; legs.FL.knee.rotation.x = legs.FR.knee.rotation.x = -0.2; legs.BL.hip.rotation.x = legs.BR.hip.rotation.x = 1.0; legs.BL.knee.rotation.x = legs.BR.knee.rotation.x = -0.1; jawOpen = 0.55; headX = -0.2; tailLift = -0.05; }
    } else if (hint === 'charge' || (dashAir && kind !== 'stalker')) {
      if (!st.dash) { // paw the ground, head low, glow rising
        const k = c.windup; headX += 0.5 * k; by -= 0.1 * k; bx = 0.08 * k;
        legs.FL.hip.rotation.x = base.fl - 0.2 - Math.abs(Math.sin(t * 16)) * 0.9 * k; legs.FL.knee.rotation.x = base.fl2 - 0.2;
        jawOpen += 0.12 * k; body.rotation.z = Math.sin(t * 40) * 0.015 * k;
      } else { bx = 0.14; headX += 0.5; by -= 0.04; jawOpen = 0.2; }
    } else if (hint === 'bite' || hint === 'stab' || hint === 'swing' || hint === 'sting' || hint === 'gore' || hint === 'smash' || hint === 'swing_h') {
      if (c.phase === 'windup') { headX -= 0.55 * c.windup; headZ -= 0.12 * c.windup; jawOpen += 0.5 * c.windup; bz -= 0.1 * c.windup; bx = -0.1 * c.windup; if (kind === 'boar') headX = 0.5 * c.windup; }
      else { headZ += 0.34 * c.strike; headX += (kind === 'boar' ? -0.7 : 0.35) * c.strike; jawOpen = lerp(0.6, 0.02, c.strike > 0.7 ? 1 : c.strike); bz += 0.28 * c.strike; bx = 0.12 * c.strike; }
    } else if (hint === 'howl' || hint === 'wail' || hint === 'toll' || hint === 'summon' || hint === 'pray' || hint === 'fuse' || hint === 'brace') {
      const k = c.phase === 'windup' ? c.windup : 1 - c.recover; // rear up and screech / call the brood
      headX -= 0.7 * k; jawOpen += 0.8 * k; by += 0.12 * k; bx = -0.28 * k;
      legs.FL.hip.rotation.x -= 0.5 * k; legs.FR.hip.rotation.x -= 0.5 * k;
      if (parts.sacs) parts.sacs.forEach((s, i) => s.scale.setScalar(1 + 0.18 * k * (1 + Math.sin(t * 18 + i)) * 0.5));
    } else { // cast / lob / spit / fire … head back then forward
      if (c.phase === 'windup') { headX -= 0.45 * c.windup; jawOpen += 0.6 * c.windup; bx = -0.12 * c.windup; }
      else { headX += 0.25 * c.strike; jawOpen = lerp(0.7, 0.05, c.strike); bz += 0.15 * c.strike; }
    }
  }
  // hurt flinch
  if (st.hurt > 0) { bz -= st.hurt * 0.14; headX -= st.hurt * 0.3; jawOpen += st.hurt * 0.3; }
  body.position.set(0, by, bz); body.rotation.x = bx; body.rotation.z += bzRoll;
  head.rotation.set(headX, headY, 0); head.position.z = (kind === 'boar' ? 0.6 : 0.62) * cfg.bodyLen + headZ;
  jaw.rotation.x = jawOpen;
  tail.forEach((j, i) => { j.rotation.y = tailSwing * (0.5 + i * 0.28) * (i % 2 ? 1 : 0.8); j.rotation.x = -tailLift * (1 - i * 0.1) + Math.sin(t * 2 + i * 0.7) * 0.05; });
  if (m.echo) { m.echo.rotation.y = Math.sin(t * 2.4 + 1.7) * 0.45; m.echo.rotation.z = Math.sin(t * 1.3) * 0.12; m.echo.visible = !st.dead; }

  // ── death: topple onto the side, limbs go slack
  if (st.dead) {
    const k = ease(clamp(st.deadT / 0.5)), bounce = Math.sin(clamp(st.deadT / 0.5, 0, 1) * PI) * 0.1;
    m.rollZ = k * (m.dir ?? (m.dir = (st.uid & 1) ? 1.45 : -1.45));
    body.rotation.z = m.rollZ; body.position.y = lerp(m.legH + 0.1, kind === 'matriarch' ? 0.62 : kind === 'boar' ? 0.5 : 0.28, k) + bounce;
    for (const lg of Object.values(legs)) { lg.hip.rotation.x = lerp(lg.hip.rotation.x, 0.3, k); lg.knee.rotation.x = lerp(lg.knee.rotation.x, -0.9, k); }
    head.rotation.x = lerp(head.rotation.x, 0.4, k); jaw.rotation.x = lerp(jaw.rotation.x, 0.5, k);
    tail.forEach((j) => { j.rotation.y = lerp(j.rotation.y, 0.4, k); j.rotation.x = lerp(j.rotation.x, 0.2, k); });
    m.eyeG.forEach((e) => { e.scale.setScalar(Math.max(0.001, 1 - k * 1.2)); });
    parts.glows.forEach((g) => pulse(g, Math.max(0.05, 1 - k)));
  } else if (m.eyeG[0] && m.eyeG[0].scale.x < 1) m.eyeG.forEach((e) => e.scale.setScalar(1));
}

// ═════════════════════════════════════════════════════ CHIME SPITTER (toad with a bell throat sac)
function spitter(p) {
  const s = p.scale ?? 1, hide = p.color ?? '#6f8a54', belly = p.belly ?? '#c4d79a', glow = p.glow ?? '#b6ff4a';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  const body = J('body', [0, 0.52, 0]); wrap.add(body);
  body.add(P('rbox', [0.86, 0.6, 0.92, 0.28], hide, { pos: [0, 0.0, -0.05] }));
  body.add(P('rbox', [0.7, 0.34, 0.7, 0.16], belly, { pos: [0, -0.2, 0.05], top: 1.1, bot: 0.9 }));
  // warts / lime glands along the back
  const warts = [];
  for (const [x, y, z, r] of [[-0.22, 0.3, -0.2, 0.07], [0.24, 0.3, -0.05, 0.08], [0.0, 0.34, -0.35, 0.065], [-0.3, 0.2, 0.12, 0.055], [0.12, 0.33, 0.15, 0.06]]) { const w = own(P('sph', [r, 7, 5], glow, { glow: 1.5, pos: [x, y, z] })); body.add(w); warts.push(w); }
  // head with wide mouth and bulging eyes
  const head = J('head', [0, 0.1, 0.5]); body.add(head);
  head.add(P('rbox', [0.74, 0.34, 0.56, 0.14], hide, { pos: [0, 0.0, 0.1] }));
  const jaw = J('jaw', [0, -0.12, 0.0]); jaw.add(P('rbox', [0.7, 0.12, 0.54, 0.05], shade(belly, -0.1), { pos: [0, 0, 0.1] })); head.add(jaw);
  head.add(P('rbox', [0.5, 0.025, 0.04, 0.01], '#25301a', { pos: [0, -0.07, 0.36] }));
  const eyes = [];
  for (const sx of [-1, 1]) {
    head.add(P('sph', [0.13, 9, 7], hide, { pos: [sx * 0.26, 0.22, 0.12] }));
    const eye = own(P('sph', [0.085, 8, 6], '#f2ff9a', { glow: 1.6, pos: [sx * 0.27, 0.25, 0.2] })); head.add(eye); eyes.push(eye);
    head.add(P('rbox', [0.03, 0.1, 0.03, 0.01], '#10150a', { pos: [sx * 0.27, 0.25, 0.28] }));
  }
  // the chime: bell-shaped vocal sac under the chin that swells before every spit
  const sac = J('sac', [0, -0.18, 0.28]); head.add(sac);
  sac.add(P('lathe', [[[0.0, -0.3], [0.2, -0.28], [0.3, -0.14], [0.27, 0.06], [0.14, 0.14], [0.0, 0.15]], 12], belly, { opacity: 0.9, top: 1.15, bot: 0.8 }));
  const core = own(P('sph', [0.13, 8, 6], glow, { glow: 1.6, pos: [0, -0.1, 0] })); sac.add(core);
  sac.add(P('tor', [0.2, 0.025, 5, 14], '#c9954a', { pos: [0, -0.02, 0], rot: [PI / 2, 0, 0] }));
  // legs: short front arms, big folded haunches
  const front = [], back = [];
  for (const sx of [-1, 1]) {
    const a = J('armF', [sx * 0.34, -0.12, 0.34]); a.add(limb(0.3, 0.075, 0.055, hide)); a.add(P('rbox', [0.2, 0.06, 0.2, 0.025], shade(hide, -0.15), { pos: [0, -0.3, 0.06] })); body.add(a); front.push(a);
    const h = J('haunch', [sx * 0.42, -0.02, -0.3]); h.add(P('sph', [0.26, 9, 7], hide, { scale: [0.75, 1, 1.05] }));
    const lw = J('hlow', [0, -0.12, -0.04]); lw.add(limb(0.34, 0.1, 0.06, hide)); const foot = J('foot', [0, -0.34, 0]); foot.add(P('rbox', [0.22, 0.06, 0.34, 0.03], shade(hide, -0.2), { pos: [0, 0.0, 0.1] })); lw.add(foot); h.add(lw); body.add(h); back.push({ h, lw, foot });
  }
  const model = { root, rig: 'spitter', s, height: 1.3 * s, body, head, jaw, sac, core, eyes, warts, front, back, phase: Math.random() * 6, hop: 0, tick: (st, dt) => spitterTick(model, st, dt) };
  return model;
}
function spitterTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  const mv = clamp(st.mps / 1.5, 0, 1);
  m.hopPh = (m.hopPh ?? 0) + dt * (st.mps / 1.1) * PI * 2;
  const hop = Math.max(0, Math.sin(m.hopPh)) * mv;           // 0..1 airborne
  let by = 0.52 + hop * 0.34 + Math.sin(t * 1.8) * 0.012, sq = 1 - hop * 0.12 + (1 - Math.abs(Math.cos(m.hopPh))) * 0.0;
  let headX = -hop * 0.25 + Math.sin(t * 0.7) * 0.05, jaw = 0.04 + Math.max(0, Math.sin(t * 1.1)) * 0.03, sac = 1 + Math.sin(t * 2.4) * 0.05, bx = 0;
  const glow = 0.8 + Math.sin(t * 2.2) * 0.2;
  if (c.phase) {
    if (c.phase === 'windup' || c.phase === 'channel') { sac = 1 + c.windup * 0.75; bx = -0.18 * c.windup; headX -= 0.35 * c.windup; jaw += 0.12 * c.windup; by -= 0.04 * c.windup; }
    else { sac = lerp(1.75, 1.0, c.strike > 0.5 ? 1 : c.strike * 2); bx = 0.2 * c.strike; headX += 0.3 * c.strike; jaw = 0.6 * (1 - c.recover); }
  }
  if (st.hurt > 0) { by -= st.hurt * 0.08; sq += st.hurt * 0.1; }
  m.body.position.y = by; m.body.rotation.x = bx; m.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  m.head.rotation.x = headX; m.jaw.rotation.x = jaw; m.sac.scale.setScalar(sac);
  pulse(m.core, 0.7 + (sac - 1) * 1.4 + glow * 0.4);
  m.warts.forEach((w, i) => pulse(w, 0.7 + 0.3 * Math.sin(t * 2 + i) + (sac - 1) * 0.8));
  m.back.forEach((b, i) => { b.h.rotation.x = -0.2 - hop * 0.9; b.lw.rotation.x = 0.9 + hop * 1.0; b.foot.rotation.x = -0.7 - hop * 0.3; });
  m.front.forEach((a) => { a.rotation.x = 0.2 - hop * 0.8 + Math.sin(t * 1.1) * 0.03; });
  if (st.dead) {
    const k = ease(clamp(st.deadT / 0.4));
    m.body.rotation.z = k * 1.55; m.body.position.y = lerp(by, 0.28, k); m.body.scale.set(1 + k * 0.1, 1 - k * 0.2, 1 + k * 0.1); m.sac.scale.setScalar(lerp(sac, 0.5, k)); m.jaw.rotation.x = 0.6;
    m.eyes.forEach((e) => e.scale.setScalar(Math.max(0.01, 1 - k)));
    m.back.forEach((b) => { b.h.rotation.x = 0.3; b.lw.rotation.x = 1.4; });
  } else if (m.eyes[0].scale.x < 1) m.eyes.forEach((e) => e.scale.setScalar(1));
}

// ═════════════════════════════════════════════════════ DRONE SWARM (three chime-bugs buzzing around one centre)
function drone(p) {
  const s = p.scale ?? 1, body = p.color ?? '#7a8a46', glow = p.glow ?? '#7fe3ff';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  const bugs = [];
  for (let i = 0; i < 3; i++) {
    const b = J(`bug${i}`, [0, 0, 0]);
    const hover = J('hover'); b.add(hover);
    hover.add(P('sph', [0.12, 9, 7], body, { scale: [1, 0.9, 1.1] }));                                       // thorax
    hover.add(P('tor', [0.115, 0.02, 5, 14], '#2a2a1a', { pos: [0, 0, 0.02], rot: [0, PI / 2, 0] }));
    const abd = J('abd', [0, -0.02, -0.17]); hover.add(abd);
    abd.add(P('sph', [0.14, 9, 7], shade(body, -0.1), { scale: [1, 0.95, 1.25] }));
    abd.add(P('tor', [0.12, 0.018, 5, 14], '#e8c23a', { pos: [0, 0, -0.04] }));
    const lamp = own(P('sph', [0.085, 8, 6], glow, { glow: 2.2, pos: [0, -0.01, -0.3] })); abd.add(lamp);
    abd.add(P('cone', [0.03, 0.14, 5], '#2a2218', { pos: [0, -0.03, -0.42], rot: [-PI / 2 - 0.2, 0, 0] }));        // stinger
    const head = J('head', [0, 0.01, 0.14]); hover.add(head);
    head.add(P('sph', [0.075, 8, 6], shade(body, 0.1)));
    for (const sx of [-1, 1]) {
      head.add(P('sph', [0.04, 6, 5], glow, { glow: 2.0, pos: [sx * 0.05, 0.02, 0.05] }));
      head.add(P('tube', [[[sx * 0.03, 0.05, 0.05], [sx * 0.07, 0.13, 0.12], [sx * 0.09, 0.2, 0.2]], 0.008, 0.004, { segs: 4, radial: 4 }], '#2a2218'));
    }
    const wings = [];
    for (const sx of [-1, 1]) { const w = J('wing', [sx * 0.07, 0.09, 0.0]); w.add(P('rbox', [0.3, 0.012, 0.15, 0.005], '#dcf4ff', { pos: [sx * 0.15, 0, -0.02], opacity: 0.5 })); hover.add(w); wings.push(w); }
    bugs.push({ b, hover, abd, lamp, wings, head, a: (i / 3) * PI * 2 });
    wrap.add(b);
  }
  const model = { root, rig: 'drone', s, height: 1.1 * s, bugs, phase: Math.random() * 6, tick: (st, dt) => droneTick(model, st, dt) };
  return model;
}
function droneTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  const fall = st.dead ? ease(clamp(st.deadT / 0.5)) : 0;
  m.bugs.forEach((bg, i) => {
    const a = bg.a + t * (0.8 + i * 0.1) * (st.cast ? 0.4 : 1), r = 0.3 + 0.05 * Math.sin(t * 1.3 + i);
    const x = Math.cos(a) * r; let z = Math.sin(a) * r * 0.8, y = 0.95 + Math.sin(t * 3.1 + i * 2.1) * 0.1 + Math.sin(t * 7 + i) * 0.02;
    let pitch = 0.1 + st.speed * 0.3; const yaw = Math.sin(t * 0.9 + i) * 0.4;
    if (c.phase && i === 0) { // the lead bug dives with its stinger
      const w = c.phase === 'windup' ? c.windup : 0;
      z += 0.7 * c.strike - 0.25 * w; y -= 0.35 * c.strike - 0.1 * w; pitch = -0.7 * c.strike + 0.5 * w; bg.abd.rotation.x = -0.6 * (c.phase === 'windup' ? c.windup : 1 - c.recover);
    } else bg.abd.rotation.x = Math.sin(t * 6 + i) * 0.08;
    if (st.hurt > 0 && i === 0) z -= st.hurt * 0.15;
    bg.b.position.set(x, lerp(y, 0.12, fall), z);
    bg.b.rotation.set(pitch + fall * 1.3, yaw + fall * (3 + i), fall * (0.8 + i * 0.3));
    const flap = st.dead ? 0 : Math.sin(t * (58 + i * 4)) * 0.75;
    bg.wings[0].rotation.z = flap; bg.wings[1].rotation.z = -flap;
    pulse(bg.lamp, st.dead ? Math.max(0, 1 - fall * 1.4) : 0.8 + 0.35 * Math.sin(t * 4 + i) + (st.cast ? 0.6 : 0));
  });
}

// ═════════════════════════════════════════════════════ ECHO BURROWER (ringed worm that erupts from a dirt mound)
function burrower(p) {
  const s = p.scale ?? 1, sand = p.color ?? '#9a7a56', dark = shade(sand, -0.28), glow = p.glow ?? '#7fe3ff';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  const mound = G(); wrap.add(mound);
  mound.add(P('sph', [1.05, 10, 6], '#7b6648', { pos: [0, -0.18, 0], scale: [1, 0.3, 1], top: 1.2, bot: 0.8 }));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2 + 0.3; mound.add(P('dodeca', [0.16 + (i % 3) * 0.05, 0], '#8a7c6c', { pos: [Math.sin(a) * 0.82, 0.04, Math.cos(a) * 0.82], rot: [a, a * 2, 0], scale: [1, 0.7, 1], flat: true })); }
  mound.add(P('tor', [0.52, 0.12, 6, 18], '#6a5238', { pos: [0, 0.02, 0], rot: [PI / 2, 0, 0], scale: [1, 1, 0.5] }));
  const body = J('body', [0, 0, 0]); wrap.add(body);
  const segs = []; let parent = body;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const r = 0.46 - i * 0.025, j = J(`seg${i}`, [0, i === 0 ? 0 : 0.34, 0]);
    j.add(P('sph', [r, 10, 7], i % 2 ? sand : mix(sand, '#b89a6e', 0.35), { pos: [0, 0.18, 0], scale: [1, 0.78, 1], top: 1.2, bot: 0.78 }));
    j.add(P('tor', [r * 0.96, 0.035, 5, 16], dark, { pos: [0, 0.02, 0], rot: [PI / 2, 0, 0] }));
    parent.add(j); segs.push(j); parent = j;
  }
  const head = J('head', [0, 0.36, 0.0]); parent.add(head);
  head.add(P('sph', [0.5, 11, 8], mix(sand, '#c9a878', 0.25), { pos: [0, 0.14, 0.0], scale: [1, 0.95, 1.05] }));
  const mouth = J('mouth', [0, 0.18, 0.34]); mouth.rotation.x = -0.35; head.add(mouth);
  mouth.add(P('tor', [0.3, 0.1, 6, 16], '#d9b58a'));
  mouth.add(P('sph', [0.26, 9, 6], '#2a1410', { pos: [0, 0, -0.06], scale: [1, 1, 0.5] }));
  const throat = own(P('sph', [0.18, 8, 6], glow, { glow: 2.0, pos: [0, 0, -0.1], scale: [1, 1, 0.5] })); mouth.add(throat);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; const tooth = P('cone', [0.035, 0.17, 4], '#efe3c8', { pos: [Math.sin(a) * 0.27, Math.cos(a) * 0.27, 0.03], flat: true }); tooth.rotation.set(PI / 2, 0, 0); tooth.rotateOnWorldAxis?.(new THREE.Vector3(0, 0, 1), 0); tooth.rotation.set(Math.cos(a) * -0.5 + PI / 2 * 0, 0, 0); tooth.lookAt(Math.sin(a) * 0.1, Math.cos(a) * 0.1, 0.6); mouth.add(tooth); }
  const eyes = [];
  for (const [x, y] of [[-0.24, 0.42], [0.0, 0.5], [0.24, 0.42]]) { const e = own(P('sph', [0.06, 7, 5], glow, { glow: 2.4, pos: [x, y, 0.3] })); head.add(e); eyes.push(e); }
  for (const sx of [-1, 1]) head.add(P('tube', [[[sx * 0.4, 0.3, 0.0], [sx * 0.55, 0.5, -0.1], [sx * 0.5, 0.72, -0.2]], 0.07, 0.015, { segs: 6, radial: 5 }], '#efe3c8'));
  const model = { root, rig: 'burrower', s, height: 2.3 * s, body, segs, head, mouth, mound, throat, eyes, phase: Math.random() * 6, tick: (st, dt) => burrowerTick(model, st, dt) };
  return model;
}
function burrowerTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  const emerge = st.buried ? 0 : clamp((st.emergeT ?? 9) / 0.5);
  let rise = st.buried ? -1.9 : -1.9 + 1.9 * Math.min(1.08, outq(emerge) * 1.06);
  let lean = 0; const sway = Math.sin(t * 1.3) * 0.07; let headDip = 0, mouthOpen = 0.0;
  if (c.phase === 'windup') { rise += 0.25 * c.windup; lean = -0.35 * c.windup; headDip = -0.2 * c.windup; mouthOpen = 0.3 * c.windup; }
  else if (c.phase) { lean = 0.9 * c.strike; headDip = 0.6 * c.strike; rise -= 0.2 * c.strike; mouthOpen = 0.3 * (1 - c.strike); }
  if (st.hurt > 0) { lean -= st.hurt * 0.3; rise -= st.hurt * 0.15; }
  m.body.position.y = rise;
  m.segs.forEach((j, i) => { j.rotation.x = lean * (0.12 + i * 0.05) + Math.sin(t * 1.6 - i * 0.7) * 0.05; j.rotation.z = sway * (0.6 + i * 0.12); });
  m.head.rotation.x = headDip + 0.2; m.mouth.scale.setScalar(1 + mouthOpen);
  m.mound.scale.set(1 + (1 - emerge) * 0.2, 1, 1 + (1 - emerge) * 0.2);
  pulse(m.throat, 0.8 + mouthOpen * 2 + 0.3 * Math.sin(t * 2.5));
  m.eyes.forEach((e, i) => pulse(e, 0.8 + 0.4 * Math.sin(t * 3 + i)));
  if (st.dead) { const k = ease(clamp(st.deadT / 0.8)); m.body.position.y = lerp(rise, -1.6, k); m.segs.forEach((j, i) => { j.rotation.x = k * 0.35 * (i % 2 ? 1 : -1); }); m.head.rotation.x = 0.9 * k; m.eyes.forEach((e) => e.scale.setScalar(Math.max(0.01, 1 - k))); }
  else m.eyes.forEach((e) => e.scale.setScalar(1));
}

// ═════════════════════════════════════════════════════ PULSING COCOON (translucent egg that heals its brood)
function cocoon(p) {
  const s = p.scale ?? 1, shellC = p.color ?? '#c9b6e6', glow = p.glow ?? '#7fe3ff';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  const base = G(); wrap.add(base);
  base.add(P('sph', [0.95, 10, 6], '#5a4a72', { pos: [0, 0.02, 0], scale: [1, 0.26, 1], top: 1.2, bot: 0.8 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + 0.3, cx = Math.sin(a), cz = Math.cos(a);
    base.add(P('tube', [[[cx * 0.4, 0.12, cz * 0.4], [cx * 0.85, 0.18, cz * 0.85], [cx * 1.25 + Math.sin(a * 3) * 0.1, 0.05, cz * 1.25]], 0.1, 0.02, { segs: 8, radial: 5 }], '#7a66a0'));
  }
  const pods = [];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + 0.9, g = J('pod', [Math.sin(a) * 1.0, 0.1, Math.cos(a) * 1.0]); g.add(P('cyl', [0.02, 0.03, 0.45, 5], '#6a5a88', { pos: [0, 0.22, 0] })); const bulb = own(P('sph', [0.1, 8, 6], i % 2 ? glow : '#b6ff4a', { glow: 1.6, pos: [0, 0.5, 0] })); g.add(bulb); base.add(g); pods.push({ g, bulb }); }
  const shellJ = J('shell', [0, 1.0, 0]); wrap.add(shellJ);
  shellJ.add(P('sph', [0.72, 12, 9], shellC, { opacity: 0.82, scale: [1, 1.35, 1], top: 1.18, bot: 0.78 }));
  for (const [rx, rz] of [[0, 0], [PI / 3, 0.4], [-PI / 3, -0.5]]) shellJ.add(P('tor', [0.73, 0.018, 4, 24], glow, { glow: 1.2, opacity: 0.55, rot: [rx, 0, rz], scale: [1, 1.35, 1] }));
  const core = own(P('sph', [0.3, 10, 8], glow, { glow: 1.9 })); shellJ.add(core);
  const embryo = P('oct', [0.2, 0], '#ffffff', { glow: 2.2, scale: [0.7, 1.4, 0.7] }); shellJ.add(embryo);
  for (let i = 0; i < 3; i++) { const a = i * 2.1; shellJ.add(P('tube', [[[Math.sin(a) * 0.12, 0.9, Math.cos(a) * 0.12], [Math.sin(a) * 0.25, 1.25, Math.cos(a) * 0.25], [Math.sin(a) * 0.1, 1.55, Math.cos(a) * 0.1]], 0.05, 0.01, { segs: 6, radial: 5 }], '#9a86b8')); }
  const model = { root, rig: 'cocoon', s, height: 2.0 * s, shell: shellJ, core, embryo, pods, phase: Math.random() * 6, tick: (st, dt) => cocoonTick(model, st, dt) };
  return model;
}
function cocoonTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  let k = 1 + Math.sin(t * 2.4) * 0.04;
  if (c.phase) k += 0.2 * (c.phase === 'windup' ? c.windup : c.strike);
  if (st.hurt > 0) k -= st.hurt * 0.07;
  m.shell.scale.set(k, k * 1.02, k); m.shell.position.y = 1.0 + Math.sin(t * 1.2) * 0.03;
  pulse(m.core, 0.8 + 0.4 * Math.sin(t * 2.4) + (c.phase ? 1.0 * (c.phase === 'windup' ? c.windup : c.strike) : 0) + (st.aggro ? 0.2 : 0));
  m.embryo.rotation.y = t * 0.8; m.embryo.position.y = Math.sin(t * 1.7) * 0.06;
  m.pods.forEach((p2, i) => { p2.g.rotation.z = Math.sin(t * 1.4 + i) * 0.1; p2.g.rotation.x = Math.cos(t * 1.1 + i) * 0.1; pulse(p2.bulb, 0.8 + 0.4 * Math.sin(t * 2.6 + i * 1.7) + (c.phase ? 0.6 : 0)); });
  if (st.dead) { const d = clamp(st.deadT / 0.5); const kk = d < 0.3 ? 1 + d * 1.2 : lerp(1.36, 0.1, ease((d - 0.3) / 0.7)); m.shell.scale.set(kk, kk * 0.9, kk); m.shell.position.y = lerp(1.0, 0.3, ease(d)); pulse(m.core, Math.max(0, 1 - d * 1.2)); }
}

// ═════════════════════════════════════════════════════ KEENING WISP (wailing flame-ghost with a trailing tail)
function wisp(p) {
  const s = p.scale ?? 1, glow = p.glow ?? '#c58cff', core = p.color ?? '#efe6ff';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  const body = J('body', [0, 1.25, 0]); wrap.add(body);
  const orb = P('sph', [0.3, 12, 9], core, { glow: 1.1, scale: [1, 1.08, 1] }); body.add(orb);
  const shell = P('sph', [0.43, 12, 9], glow, { glow: 0.9, opacity: 0.32, scale: [1, 1.12, 1] }); body.add(shell);
  const face = J('face', [0, 0.02, 0.27]); body.add(face);
  for (const sx of [-1, 1]) face.add(P('rbox', [0.1, 0.045, 0.03, 0.015], '#2a1a40', { pos: [sx * 0.11, 0.1, 0], rot: [0, 0, sx * -0.3] }));
  const mouth = P('sph', [0.1, 9, 7], '#1c1030', { pos: [0, -0.08, 0], scale: [1.2, 1, 0.5] }); face.add(mouth);
  const halo = J('halo', [0, 0.05, -0.08]); body.add(halo);
  halo.add(P('tor', [0.58, 0.028, 5, 28], glow, { glow: 1.8, rot: [PI / 2 - 0.4, 0, 0] }));
  const sparks = []; for (let i = 0; i < 3; i++) { const sp = P('oct', [0.045, 0], '#ffffff', { glow: 2.4 }); halo.add(sp); sparks.push(sp); }
  const arms = [];
  for (const sx of [-1, 1]) { const a = J('arm', [sx * 0.3, -0.02, 0.0]); a.add(P('tube', [[[0, 0, 0], [sx * 0.2, -0.14, 0.08], [sx * 0.28, -0.4, 0.2], [sx * 0.2, -0.62, 0.32]], 0.07, 0.012, { segs: 8, radial: 5 }], core, { glow: 0.9, opacity: 0.8 })); body.add(a); arms.push(a); }
  const tail = []; for (let i = 0; i < 5; i++) { const r = 0.24 - i * 0.04; const o = P('sph', [r, 9, 7], glow, { glow: 1.1 - i * 0.12, opacity: 0.8 - i * 0.12 }); wrap.add(o); tail.push(o); }
  const model = { root, rig: 'wisp', s, height: 1.9 * s, body, orb, shell, mouth, halo, sparks, arms, tail, phase: Math.random() * 6, tick: (st, dt) => wispTick(model, st, dt) };
  return model;
}
function wispTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  let bob = Math.sin(t * 1.9) * 0.1, sc = 1, mouth = 0.5 + Math.sin(t * 3) * 0.1, ring = 1; const lean = clamp(st.mps / 4, 0, 1) * 0.35;
  if (c.phase) { mouth = 0.5 + 1.8 * (c.phase === 'windup' ? c.windup : 1); sc = 1 + 0.25 * (c.phase === 'windup' ? c.windup : c.strike); bob += 0.18 * (c.phase === 'windup' ? c.windup : 0); ring = 1 + 1.2 * c.strike; }
  if (st.hurt > 0) { bob -= st.hurt * 0.15; sc -= st.hurt * 0.1; }
  m.body.position.y = 1.25 + bob; m.body.rotation.x = lean; m.body.scale.setScalar(sc);
  m.mouth.scale.set(1.2 * (0.8 + mouth * 0.4), 0.4 + mouth * 0.9, 0.5);
  m.halo.rotation.y = t * 1.4; m.halo.scale.setScalar(ring);
  m.sparks.forEach((sp, i) => { const a = (i / 3) * PI * 2 + t * 2.4; sp.position.set(Math.sin(a) * 0.58, Math.cos(a * 1.3) * 0.08, Math.cos(a) * 0.58); });
  m.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.2 + Math.sin(t * 2.1 + i) * 0.15 + (c.phase ? 0.6 * c.windup : 0)); a.rotation.x = -0.2 + (c.phase ? -0.7 * (c.phase === 'windup' ? c.windup : c.strike) : 0); });
  m.tail.forEach((o, i) => { o.position.set(Math.sin(t * 2 - i * 0.7) * 0.1 * (i + 1) * 0.5, 1.0 + bob - 0.3 - i * 0.17, -0.1 - i * 0.12 - lean * 0.5 * (i + 1) * 0.4); o.scale.setScalar(sc * (1 - i * 0.02)); });
  if (st.dead) { const k = ease(clamp(st.deadT / 0.7)); m.body.scale.setScalar(Math.max(0.01, sc * (1 - k))); m.body.position.y = 1.25 + bob + k * 0.7; m.tail.forEach((o) => o.scale.setScalar(Math.max(0.001, 1 - k * 1.4))); m.halo.scale.setScalar(1 + k * 2); }
}

// ═════════════════════════════════════════════════════ TUNING TURRET (stone plinth + brass tuning-fork emitter)
function turret(p) {
  const s = p.scale ?? 1, brass = p.color ?? '#c9954a', glow = p.glow ?? '#7fe3ff', stone = p.stone ?? '#7d8696';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  wrap.add(P('cyl', [0.78, 0.92, 0.42, 8], stone, { pos: [0, 0.21, 0], top: 1.15, bot: 0.75, flat: true }));
  wrap.add(P('tor', [0.8, 0.07, 5, 18], brass, { pos: [0, 0.42, 0], rot: [PI / 2, 0, 0] }));
  wrap.add(P('cyl', [0.34, 0.5, 0.5, 8], stone, { pos: [0, 0.68, 0], flat: true }));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; wrap.add(P('rbox', [0.1, 0.5, 0.24, 0.03], brass, { pos: [Math.sin(a) * 0.4, 0.5, Math.cos(a) * 0.4], rot: [Math.cos(a) * -0.35, a, Math.sin(a) * 0.35] })); }
  const swivel = J('swivel', [0, 0.96, 0]); wrap.add(swivel);
  swivel.add(P('cyl', [0.4, 0.46, 0.14, 10], brass, { top: 1.2, bot: 0.8 }));
  const ring = J('ring', [0, 0.1, 0]); ring.add(P('tor', [0.46, 0.035, 5, 20], glow, { glow: 1.5, rot: [PI / 2, 0, 0] })); swivel.add(ring);
  const head = J('head', [0, 0.4, 0]); swivel.add(head);
  head.add(P('rbox', [0.62, 0.46, 0.66, 0.12], brass, { pos: [0, 0, -0.02], top: 1.2, bot: 0.8 }));
  head.add(P('rbox', [0.5, 0.1, 0.5, 0.04], stone, { pos: [0, 0.28, -0.05], flat: true }));
  head.add(P('cyl', [0.18, 0.22, 0.3, 8], '#59616e', { pos: [0, 0.0, -0.46], rot: [PI / 2, 0, 0] }));
  const prongs = [];
  for (const sx of [-1, 1]) { const pr = J('prong', [sx * 0.18, 0.0, 0.3]); pr.add(P('rbox', [0.1, 0.12, 0.95, 0.04], '#d9b070', { pos: [0, 0, 0.42], top: 1.25, bot: 0.8 })); pr.add(P('sph', [0.075, 7, 5], glow, { glow: 2.3, pos: [0, 0, 0.9] })); head.add(pr); prongs.push(pr); }
  const lens = own(P('sph', [0.13, 9, 7], glow, { glow: 2.2, pos: [0, 0, 0.72] })); head.add(lens);
  const halo = P('tor', [0.2, 0.02, 5, 16], glow, { glow: 1.6, pos: [0, 0, 0.72] }); head.add(halo);
  const model = { root, rig: 'turret', s, height: 1.9 * s, swivel, head, ring, prongs, lens, halo, phase: Math.random() * 6, tick: (st, dt) => turretTick(model, st, dt) };
  return model;
}
function turretTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  const charge = c.phase === 'windup' ? c.windup : c.phase === 'channel' ? 1 : 0;
  m.ring.rotation.y = t * (0.8 + charge * 6);
  let recoil = 0; if (c.phase === 'recover') recoil = c.strike * 0.14;
  m.head.position.z = -recoil; m.head.rotation.x = -0.04 * Math.sin(t * 0.8) + (st.hurt > 0 ? st.hurt * 0.18 : 0) - charge * 0.05;
  m.prongs.forEach((pr, i) => { pr.rotation.z = Math.sin(t * 60 + i * PI) * 0.025 * (0.3 + charge * 2.2); pr.rotation.y = (i ? -1 : 1) * (0.02 + charge * 0.05); });
  pulse(m.lens, 0.7 + 0.2 * Math.sin(t * 2) + charge * 1.6 + c.strike * 1.2 + (st.aggro ? 0.3 : 0));
  m.halo.scale.setScalar(1 + charge * 0.6 + c.strike * 0.5); m.halo.rotation.z = t * 3;
  if (st.dead) { const k = ease(clamp(st.deadT / 0.6)); m.head.rotation.x = k * 0.7; m.head.position.y = 0.4 - k * 0.18; pulse(m.lens, Math.max(0, 1 - k * 1.5)); m.prongs.forEach((pr, i) => { pr.rotation.z = (i ? 1 : -1) * k * 0.5; }); }
}

// ═════════════════════════════════════════════════════ WIRE SPIDER (clockwork brass spider with a wire spool)
function spider(p) {
  const s = p.scale ?? 1, brass = p.color ?? '#c9954a', glow = p.glow ?? '#ffb050', dark = '#4a3a2a';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  const body = J('body', [0, 0.5, 0]); wrap.add(body);
  body.add(P('rbox', [0.5, 0.3, 0.55, 0.12], brass, { pos: [0, 0, 0.1] }));
  body.add(P('rbox', [0.36, 0.1, 0.4, 0.04], '#8a6428', { pos: [0, 0.2, 0.08], flat: true }));
  const gear = J('gear', [0, 0.3, 0.1]); gear.add(P('cyl', [0.15, 0.15, 0.05, 10], '#d9b070', { flat: true })); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; gear.add(P('rbox', [0.05, 0.05, 0.06, 0.01], '#d9b070', { pos: [Math.sin(a) * 0.17, 0, Math.cos(a) * 0.17] })); } body.add(gear);
  const abd = J('abd', [0, 0.06, -0.42]); body.add(abd);
  abd.add(P('cyl', [0.3, 0.3, 0.46, 12], dark, { rot: [0, 0, PI / 2], top: 1.15, bot: 0.8 }));
  for (let i = -2; i <= 2; i++) abd.add(P('tor', [0.3, 0.025, 4, 16], i % 2 ? '#e8b45a' : glow, { pos: [i * 0.08, 0, 0], rot: [0, PI / 2, 0], glow: i % 2 ? undefined : 1.2 }));
  for (const sx of [-1, 1]) abd.add(P('cyl', [0.34, 0.34, 0.04, 12], brass, { pos: [sx * 0.25, 0, 0], rot: [0, 0, PI / 2] }));
  abd.add(P('cone', [0.04, 0.2, 5], '#2a2218', { pos: [0, 0.0, -0.36], rot: [-PI / 2, 0, 0] }));
  const head = J('head', [0, 0.0, 0.42]); body.add(head);
  head.add(P('rbox', [0.3, 0.24, 0.26, 0.09], brass));
  const eyes = [];
  for (const [x, y, r] of [[-0.09, 0.05, 0.04], [0.09, 0.05, 0.04], [-0.04, 0.1, 0.028], [0.04, 0.1, 0.028]]) { const e = own(P('sph', [r, 6, 5], glow, { glow: 2.6, pos: [x, y, 0.13] })); head.add(e); eyes.push(e); }
  const mand = []; for (const sx of [-1, 1]) { const m2 = J('mand', [sx * 0.07, -0.08, 0.12]); m2.add(P('cone', [0.035, 0.2, 4], '#d9d0b8', { pos: [0, 0, 0.08], rot: [PI / 2 + 0.2, 0, 0], flat: true })); head.add(m2); mand.push(m2); }
  const legs = [];
  const zs = [0.24, 0.1, -0.06, -0.22];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? 1 : -1, k = i % 4;
    const hip = J(`leg${i}`, [side * 0.2, 0.04, zs[k]]);
    hip.add(P('tube', [[[0, 0, 0], [side * 0.22, 0.2, 0], [side * 0.5, 0.22, 0]], 0.045, 0.035, { segs: 5, radial: 5 }], brass));
    hip.add(P('sph', [0.055, 6, 5], '#d9b070', { pos: [side * 0.5, 0.22, 0] }));
    const knee = J('knee', [side * 0.5, 0.22, 0]); knee.add(P('tube', [[[0, 0, 0], [side * 0.14, -0.3, 0], [side * 0.2, -0.64, 0]], 0.035, 0.02, { segs: 5, radial: 5 }], mix(brass, '#000000', 0.15))); knee.add(P('cone', [0.025, 0.1, 4], '#2a2218', { pos: [side * 0.2, -0.68, 0], rot: [PI, 0, 0] }));
    hip.add(knee); body.add(hip); legs.push({ hip, knee, side, k, base: (k - 1.5) * 0.28 });
  }
  const model = { root, rig: 'spider', s, height: 1.0 * s, body, gear, abd, head, eyes, mand, legs, phase: Math.random() * 6, tick: (st, dt) => spiderTick(model, st, dt) };
  return model;
}
function spiderTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  m.gaitPh = (m.gaitPh ?? 0) + dt * (st.mps / 1.2) * PI * 2;
  const ph = m.gaitPh, mv = clamp(st.mps / 1.5, 0, 1);
  let by = 0.5 + Math.sin(ph * 2) * 0.025 * mv + Math.sin(t * 1.7) * 0.01, bx = 0, rear = 0;
  if (c.phase) { const k = c.phase === 'windup' ? c.windup : 1 - c.recover; rear = k; bx = -0.45 * k; by += 0.12 * k; }
  if (st.hurt > 0) by -= st.hurt * 0.1;
  m.body.position.y = by; m.body.rotation.x = bx;
  m.legs.forEach((l) => {
    const grp = (l.k + (l.side > 0 ? 0 : 1)) % 2, s1 = Math.sin(ph + grp * PI), c1 = Math.cos(ph + grp * PI);
    l.hip.rotation.y = l.base * 0.6 + s1 * 0.38 * mv;
    l.hip.rotation.z = -l.side * (Math.max(0, c1) * 0.4 * mv);
    l.knee.rotation.z = l.side * Math.max(0, c1) * 0.35 * mv;
    if (l.k === 0 && rear) { l.hip.rotation.z = l.side * -0.2; l.hip.rotation.x = -0.9 * rear; l.knee.rotation.z = l.side * 0.5 * rear; } else l.hip.rotation.x = 0;
  });
  m.gear.rotation.y = t * (1.2 + (c.phase ? 6 : 0)); m.abd.rotation.x = -rear * 0.3 + Math.sin(t * 2) * 0.02;
  m.mand.forEach((md, i) => { md.rotation.y = (i ? -1 : 1) * (0.1 + Math.abs(Math.sin(t * 5 + i)) * 0.05 + rear * 0.4); });
  m.eyes.forEach((e, i) => pulse(e, 0.8 + 0.4 * Math.sin(t * 3 + i) + (st.aggro ? 0.4 : 0)));
  if (st.dead) { const k = ease(clamp(st.deadT / 0.5)); m.body.position.y = lerp(by, 0.32, k); m.body.rotation.z = k * PI * 0.92; m.legs.forEach((l, i) => { l.hip.rotation.z = -l.side * (0.7 + (i % 3) * 0.2) * k; l.knee.rotation.z = l.side * 1.2 * k; }); m.eyes.forEach((e) => e.scale.setScalar(Math.max(0.01, 1 - k))); }
  else m.eyes.forEach((e) => e.scale.setScalar(1));
}

// ═════════════════════════════════════════════════════ REAPER GEAR (a toothed saw-wheel on a stone rail)
function reaper(p) {
  const s = p.scale ?? 1, brass = p.color ?? '#c9954a', stone = '#7d8696', glow = '#ffb050';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  wrap.add(P('rbox', [1.0, 0.22, 2.4, 0.07], stone, { pos: [0, 0.09, 0], flat: true }));
  for (const sz of [-1, 1]) wrap.add(P('rbox', [1.08, 0.1, 0.16, 0.03], brass, { pos: [0, 0.22, sz * 1.15] }));
  const axle = J('axle', [0, 0.95, 0]); wrap.add(axle);
  for (const sx of [-1, 1]) wrap.add(P('rbox', [0.12, 1.15, 0.2, 0.04], stone, { pos: [sx * 0.34, 0.62, 0], flat: true }));
  const saw = J('saw', [0, 0, 0]); axle.add(saw);
  saw.add(P('cyl', [0.82, 0.82, 0.12, 20], '#8a8f98', { rot: [0, 0, PI / 2], top: 1.1, bot: 0.8 }));
  saw.add(P('cyl', [0.62, 0.62, 0.16, 16], '#5a626e', { rot: [0, 0, PI / 2] }));
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * PI * 2;
    const tooth = P('cone', [0.12, 0.34, 3], i % 2 ? '#d9d0b8' : '#c9ced4', { pos: [0, Math.sin(a) * 0.92, Math.cos(a) * 0.92], flat: true });
    tooth.rotation.set(a, 0, 0);   // cone axis (+y) points outward from the hub
    saw.add(tooth);
  }
  saw.add(P('cyl', [0.26, 0.26, 0.26, 10], brass, { rot: [0, 0, PI / 2], top: 1.2, bot: 0.8 }));
  const core = own(P('sph', [0.14, 8, 6], glow, { glow: 2.2 })); saw.add(core);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; saw.add(P('rbox', [0.2, 0.06, 0.5, 0.02], brass, { pos: [0, Math.sin(a) * 0.4, Math.cos(a) * 0.4], rot: [-a, 0, 0] })); }
  const model = { root, rig: 'reaper', s, height: 1.9 * s, axle, saw, core, phase: Math.random() * 6, rot: 0, tick: (st, dt) => reaperTick(model, st, dt) };
  return model;
}
function reaperTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  const roll = st.mps / 0.85;
  const spin = 2.2 + roll + (c.phase ? 9 : 0) + (st.aggro ? 2 : 0);
  m.rot += dt * spin; m.saw.rotation.x = m.rot;
  m.axle.position.y = 0.95 + Math.sin(t * 22) * 0.008 * (spin > 4 ? 1 : 0.3);
  pulse(m.core, 0.8 + 0.3 * Math.sin(t * 8) + (c.phase ? 1.2 : 0));
  if (st.hurt > 0) m.axle.rotation.z = Math.sin(t * 60) * 0.03 * st.hurt;
  if (st.dead) { const k = ease(clamp(st.deadT / 0.8)); m.rot += dt * spin * (1 - k); m.axle.position.y = lerp(0.95, 0.55, k); m.axle.rotation.z = k * 0.5; pulse(m.core, Math.max(0, 1 - k)); }
}

// ═════════════════════════════════════════════════════ FACILITY CORE (gyroscopic resonance engine)
function core(p) {
  const s = p.scale ?? 1, brass = p.color ?? '#c9954a', glow = p.glow ?? '#ffb050', stone = '#7d8696';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  wrap.add(P('cyl', [1.1, 1.3, 0.4, 10], stone, { pos: [0, 0.2, 0], top: 1.15, bot: 0.75, flat: true }));
  wrap.add(P('tor', [1.15, 0.09, 5, 24], brass, { pos: [0, 0.4, 0], rot: [PI / 2, 0, 0] }));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; wrap.add(P('rbox', [0.3, 1.5, 0.3, 0.07], stone, { pos: [Math.sin(a) * 0.95, 1.05, Math.cos(a) * 0.95], rot: [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25], flat: true })); wrap.add(P('rbox', [0.36, 0.12, 0.36, 0.04], brass, { pos: [Math.sin(a) * 0.82, 1.78, Math.cos(a) * 0.82] })); }
  const gimbal = J('gimbal', [0, 1.65, 0]); wrap.add(gimbal);
  const rings = [];
  const mk = (r, tube, axis, speed) => { const j = J('ring', [0, 0, 0]); j.add(P('tor', [r, tube, 6, 28], brass, { rot: [PI / 2, 0, 0], top: 1.2, bot: 0.8 })); for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2; j.add(P('rbox', [0.16, 0.16, 0.16, 0.04], '#d9b070', { pos: [Math.sin(a) * r, 0, Math.cos(a) * r] })); } gimbal.add(j); rings.push({ j, axis, speed }); return j; };
  mk(0.95, 0.07, 'y', 0.6); mk(1.2, 0.06, 'x', -0.9); mk(1.45, 0.05, 'z', 0.5);
  const eye = J('eye', [0, 0, 0]); gimbal.add(eye);
  const coreMesh = own(P('ico', [0.52, 1], glow, { glow: 1.9 })); eye.add(coreMesh);
  eye.add(P('ico', [0.66, 1], glow, { glow: 0.9, opacity: 0.28 }));
  eye.add(P('sph', [0.2, 8, 6], '#2a1a10', { pos: [0, 0, 0.5], scale: [1, 1, 0.5] }));
  eye.add(P('tor', [0.22, 0.03, 5, 16], '#d9b070', { pos: [0, 0, 0.52] }));
  const plates = []; for (let i = 0; i < 6; i++) { const pl = P('rbox', [0.34, 0.5, 0.08, 0.025], i % 2 ? brass : stone, { flat: true }); gimbal.add(pl); plates.push(pl); }
  const model = { root, rig: 'core', s, height: 3.0 * s, gimbal, rings, eye, coreMesh, plates, phase: Math.random() * 6, spin: 0, tick: (st, dt) => coreTick(model, st, dt) };
  return model;
}
function coreTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  const charge = c.phase === 'windup' ? c.windup : c.phase === 'channel' ? 1 : 0;
  m.spin += dt * (1 + charge * 4 + c.strike * 3);
  m.rings.forEach((r, i) => { const a = m.spin * r.speed + i; r.j.rotation.set(r.axis === 'x' ? a : r.axis === 'z' ? Math.sin(a) * 0.5 : 0.3, r.axis === 'y' ? a : 0, r.axis === 'z' ? a : r.axis === 'x' ? 0.4 : 0); });
  m.gimbal.position.y = 1.65 + Math.sin(t * 1.4) * 0.07 + charge * 0.08;
  pulse(m.coreMesh, 0.8 + 0.25 * Math.sin(t * 2.2) + charge * 1.5 + c.strike * 1.4 + (st.aggro ? 0.2 : 0));
  m.eye.rotation.z = t * 0.4;
  m.plates.forEach((pl, i) => { const a = (i / 6) * PI * 2 + t * 0.35 * (1 + charge); const r = 1.85 + charge * 0.2 + c.strike * 0.4; pl.position.set(Math.sin(a) * r, Math.sin(a * 2 + i) * 0.3, Math.cos(a) * r); pl.rotation.set(0, a, 0.15 * Math.sin(t + i)); });
  m.gimbal.position.z = st.hurt > 0 ? -st.hurt * 0.08 : 0;
  if (st.dead) { const k = ease(clamp(st.deadT / 0.8)); m.gimbal.position.y = lerp(1.65, 0.7, k); pulse(m.coreMesh, Math.max(0, 1 - k * 1.3)); m.rings.forEach((r) => { r.j.rotation.x += k * 0.7; }); m.plates.forEach((pl) => { pl.position.y = lerp(pl.position.y, -1.2, k); }); }
}

// ═════════════════════════════════════════════════════ RESONANCE NODE (rune pylon crowned with a violet crystal)
function node(p) {
  const s = p.scale ?? 1, glow = p.glow ?? '#b79cff', stone = p.color ?? '#7d8696', brass = '#c9954a', cyan = '#7fe3ff';
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  wrap.add(P('cyl', [0.8, 0.98, 0.34, 8], stone, { pos: [0, 0.17, 0], top: 1.15, bot: 0.75, flat: true }));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2; wrap.add(P('rbox', [0.2, 0.62, 0.34, 0.05], stone, { pos: [Math.sin(a) * 0.62, 0.55, Math.cos(a) * 0.62], rot: [Math.cos(a) * -0.5, a, Math.sin(a) * 0.5], flat: true })); }
  wrap.add(P('cyl', [0.34, 0.5, 1.05, 6], stone, { pos: [0, 0.84, 0], top: 1.2, bot: 0.8, flat: true }));
  const runes = [];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; const r = own(P('rbox', [0.05, 0.62, 0.03, 0.01], cyan, { glow: 1.8, pos: [Math.sin(a) * 0.4, 0.84, Math.cos(a) * 0.4], rot: [0, a, 0] })); wrap.add(r); runes.push(r); }
  wrap.add(P('tor', [0.4, 0.05, 5, 16], brass, { pos: [0, 1.38, 0], rot: [PI / 2, 0, 0] }));
  const crown = J('crown', [0, 1.95, 0]); wrap.add(crown);
  const crystal = own(P('oct', [0.34, 0], glow, { glow: 1.8, scale: [0.8, 1.7, 0.8] })); crown.add(crystal);
  crown.add(P('oct', [0.46, 0], glow, { glow: 0.8, opacity: 0.25, scale: [0.9, 1.75, 0.9] }));
  const ring = J('ring', [0, 0, 0]); ring.add(P('tor', [0.7, 0.03, 5, 28], glow, { glow: 1.5, rot: [PI / 2 - 0.3, 0, 0] })); crown.add(ring);
  const shards = []; for (let i = 0; i < 4; i++) { const sh = own(P('oct', [0.12, 0], i % 2 ? cyan : glow, { glow: 2.0, scale: [0.7, 1.4, 0.7] })); crown.add(sh); shards.push(sh); }
  const model = { root, rig: 'node', s, height: 2.8 * s, crown, crystal, ring, shards, runes, phase: Math.random() * 6, tick: (st, dt) => nodeTick(model, st, dt) };
  return model;
}
function nodeTick(m, st, dt) {
  const t = st.t + m.phase, c = castInfo(st);
  const charge = c.phase === 'windup' ? c.windup : 0, burst = c.strike;
  m.crown.position.y = 1.95 + Math.sin(t * 1.3) * 0.08 + charge * 0.12;
  m.crystal.rotation.y = t * 0.8; pulse(m.crystal, 0.8 + 0.25 * Math.sin(t * 2.4) + charge * 1.2 + burst * 1.5);
  m.ring.rotation.y = t * 1.1; m.ring.scale.setScalar(1 - charge * 0.45 + burst * 1.1);
  m.shards.forEach((sh, i) => { const a = (i / 4) * PI * 2 + t * (0.9 + charge * 2); const r = 0.85 - charge * 0.45 + burst * 0.8; sh.position.set(Math.sin(a) * r, Math.sin(a * 1.7 + i) * 0.2, Math.cos(a) * r); sh.rotation.y = a; pulse(sh, 0.8 + burst * 1.3 + charge * 0.8); });
  m.runes.forEach((r, i) => pulse(r, 0.7 + 0.3 * Math.sin(t * 2.2 + i * 2) + charge * 0.8));
  m.crown.position.x = st.hurt > 0 ? Math.sin(t * 70) * 0.03 * st.hurt : 0;
  if (st.dead) { const k = ease(clamp(st.deadT / 0.7)); m.crown.position.y = lerp(1.95, 0.9, k); m.crown.rotation.z = k * 0.9; pulse(m.crystal, Math.max(0, 1 - k * 1.3)); m.shards.forEach((sh) => pulse(sh, Math.max(0, 1 - k * 1.4))); m.runes.forEach((r) => pulse(r, Math.max(0, 1 - k * 1.2))); }
}

// ═════════════════════════════════════════════════════ TRAINING DUMMY
function dummy(p) {
  const s = p.scale ?? 1;
  const root = J('root'); const wrap = J('scale'); wrap.scale.setScalar(s); root.add(wrap);
  wrap.add(P('rbox', [1.0, 0.16, 0.2, 0.05], '#7a5a3a', { pos: [0, 0.08, 0], rot: [0, 0.5, 0] })); wrap.add(P('rbox', [1.0, 0.16, 0.2, 0.05], '#6a4a2e', { pos: [0, 0.08, 0], rot: [0, -0.5, 0] }));
  const sway = J('sway', [0, 0.16, 0]); wrap.add(sway);
  sway.add(P('cyl', [0.08, 0.1, 1.5, 7], '#6a4a2e', { pos: [0, 0.75, 0] }));
  sway.add(P('rbox', [0.5, 0.7, 0.34, 0.14], '#c9a86a', { pos: [0, 1.0, 0] }));
  for (const y of [0.8, 1.05, 1.28]) sway.add(P('tor', [0.27, 0.03, 4, 14], '#7a5a3a', { pos: [0, y, 0], rot: [PI / 2, 0, 0], scale: [1, 1.3, 1] }));
  sway.add(P('rbox', [1.1, 0.12, 0.12, 0.04], '#6a4a2e', { pos: [0, 1.22, 0] }));
  for (const sx of [-1, 1]) sway.add(P('sph', [0.12, 7, 5], '#c9a86a', { pos: [sx * 0.58, 1.22, 0] }));
  const head = J('head', [0, 1.62, 0]); sway.add(head);
  head.add(P('sph', [0.26, 10, 8], '#d9bc82'));
  for (const sx of [-1, 1]) for (const r of [0.7, -0.7]) head.add(P('rbox', [0.06, 0.02, 0.02, 0.005], '#2a1a10', { pos: [sx * 0.09, 0.04, 0.24], rot: [0, 0, r] }));
  head.add(P('rbox', [0.16, 0.025, 0.02, 0.005], '#2a1a10', { pos: [0, -0.08, 0.25] }));
  for (let i = 0; i < 5; i++) head.add(P('cone', [0.025, 0.18, 4], '#e8d28a', { pos: [Math.sin(i * 1.3) * 0.12, 0.28, Math.cos(i * 1.3) * 0.1], rot: [0.3 * Math.sin(i), 0, 0.4 * Math.cos(i)] }));
  const model = { root, rig: 'dummy', s, height: 1.95 * s, sway, head, wob: 0, vel: 0, phase: 0, tick: (st, dt) => dummyTick(model, st, dt) };
  return model;
}
function dummyTick(m, st, dt) {
  if (st.hurt > 0.9) m.vel += 4.5;
  m.vel += (-m.wob * 90 - m.vel * 5) * dt; m.wob += m.vel * dt;
  m.sway.rotation.z = clamp(m.wob, -0.5, 0.5) * 0.4; m.head.rotation.z = -m.wob * 0.2;
  if (st.dead) { const k = ease(clamp(st.deadT / 0.5)); m.sway.rotation.x = -k * 1.5; }
}

export const CREATURES = {
  stalker: (p) => quadruped(p, 'stalker'),
  boar: (p) => quadruped(p, 'boar'),
  matriarch: (p) => quadruped(p, 'matriarch'),
  spitter, drone, burrower, cocoon, wisp, turret, spider, reaper, core, node, dummy,
};
