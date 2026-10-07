/**
 * Procedural character/creature models. Data (data/models/*.json) selects a template + parameters;
 * templates build a named-joint hierarchy (roles) that the Animator drives. Replacing a model with a
 * glTF later only requires matching the role names listed in docs/ART_BIBLE.md §6.
 */
import { mergeStatic } from './mergeStatic.js';
import * as THREE from 'three';
import { mat, box, cyl, cone, sphere, ico, torus, group } from './kit.js';
import { CharFactory } from './charFactory.js';
import { CREATURES } from './creatures.js';
import { logger } from '../../core/logger.js';

const log = logger('models');

/** one factory for the whole client: set by Game once the glTF assets are ready (specs with a `glb` block use it, everything else is procedural) */
let factory = null;
export function setModelAssets(assets) { factory = assets ? new CharFactory(assets) : null; }
export function modelFactory() { return factory; }

const PI = Math.PI;
const J = (name, pos = [0, 0, 0]) => { const g = new THREE.Group(); g.name = name; g.position.set(...pos); return g; };

// ───────────────────────── weapons
const WEAPONS = {
  bell_hammer: (c) => group([
    cyl(0.04, 0.05, 1.5, '#6a4e34', { pos: [0, 0.2, 0.0], seg: 6 }),
    cyl(0.16, 0.34, 0.6, c.metal ?? '#d9a24a', { pos: [0, 1.05, 0], seg: 10, metal: 0.6, rough: 0.35 }),
    sphere(0.1, '#7a5a2a', { pos: [0, 0.72, 0], seg: 6 }),
    box(0.1, 0.1, 0.1, '#e8dcc0', { pos: [0, 1.4, 0], emissive: '#7fe3ff', ei: 0.7 }),
  ], { rot: [0.0, 0, 0] }),
  handbell: (c) => group([cyl(0.04, 0.04, 0.3, '#6a4e34', { pos: [0, 0, 0] }), cyl(0.1, 0.2, 0.28, c.metal ?? '#d9a24a', { pos: [0, 0.28, 0], metal: 0.6 })]),
  staff: (c) => group([
    cyl(0.035, 0.045, 1.9, '#d8d0bc', { pos: [0, 0.45, 0], seg: 6 }),
    ico(0.14, c.glow ?? '#7fe3ff', { pos: [0, 1.55, 0], emissive: c.glow ?? '#7fe3ff', ei: 1.0 }),
    torus(0.2, 0.025, '#d9a24a', { pos: [0, 1.55, 0], rot: [PI / 2, 0, 0] }),
  ]),
  blade: (c) => group([
    box(0.05, 0.55, 0.12, '#cfd6dc', { pos: [0, 0.38, 0], metal: 0.7, rough: 0.3 }),
    box(0.05, 0.12, 0.22, '#d9a24a', { pos: [0, 0.08, 0] }),
    box(0.04, 0.16, 0.05, '#3a3028', { pos: [0, -0.04, 0] }),
  ], { rot: [PI / 2, 0, 0] }),
  shield: (c) => group([cyl(0.5, 0.5, 0.1, c.metal ?? '#b88a3e', { rot: [PI / 2, 0, 0], seg: 10, metal: 0.5 }), cyl(0.12, 0.12, 0.14, '#7a5a2a', { rot: [PI / 2, 0, 0], pos: [0, 0, 0.06], seg: 6 })], { pos: [0, 0, 0.1] }),
  club: (c) => group([cyl(0.05, 0.1, 1.1, c.metal ?? '#6a5a48', { pos: [0, 0.3, 0], seg: 6 }), sphere(0.2, c.metal ?? '#6a5a48', { pos: [0, 0.95, 0] })]),
  great_hammer: (c) => group([cyl(0.08, 0.08, 2.4, '#4a4036', { pos: [0, 0.7, 0], seg: 6 }), box(1.1, 0.9, 0.9, c.metal ?? '#7c7468', { pos: [0, 2.0, 0], metal: 0.4 }), box(1.2, 0.18, 1.0, '#d9a24a', { pos: [0, 2.5, 0] })]),
  wire: () => group([cyl(0.02, 0.02, 0.9, '#d9a24a', { pos: [0, 0.2, 0] })]),
  none: () => group(),
};

// ───────────────────────── templates
const TEMPLATES = {
  biped(p) {
    const s = p.scale ?? 1, bulk = p.bulk ?? 1, h = (p.height ?? 1.8) * s;
    const skin = p.skin ?? '#c9b9a2', cloth = p.cloth ?? '#6a6a78', trim = p.trim ?? '#d9a24a', glow = p.glow;
    const root = J('root');
    const hipsY = 0.95 * s * (h / (1.8 * s));
    const hips = J('body', [0, hipsY, 0]); root.add(hips);
    const torso = group([
      box(0.52 * bulk * s, 0.62 * s, 0.3 * bulk * s, cloth, { pos: [0, 0.38 * s, 0] }),
      box(0.56 * bulk * s, 0.12 * s, 0.34 * bulk * s, trim, { pos: [0, 0.07 * s, 0] }),
    ]); hips.add(torso);
    if (p.chestGlow) torso.add(box(0.2 * s, 0.26 * s, 0.05, glow ?? '#b79cff', { pos: [0, 0.45 * s, 0.17 * bulk * s], emissive: glow ?? '#b79cff', ei: 1.2 }));
    if (p.tabard) torso.add(box(0.3 * s, 0.7 * s, 0.04, p.tabard, { pos: [0, 0.1 * s, 0.17 * bulk * s] }));
    if (p.cloak) { const c = cone(0.5 * s * bulk, 1.3 * s, p.cloak, { pos: [0, -0.05 * s, -0.16 * s], seg: 7, scale: [1, 1, 0.55], rot: [0.08, 0, 0] }); hips.add(c); }
    if (p.shoulders) for (const sx of [-1, 1]) torso.add(sphere(0.17 * s * bulk, p.shoulders, { pos: [sx * 0.34 * bulk * s, 0.63 * s, 0], scale: [1, 0.7, 1], metal: 0.5, rough: 0.4 }));
    const headJ = J('head', [0, 0.78 * s, 0]); hips.add(headJ);
    const headMesh = sphere(0.17 * s, p.headColor ?? skin, { pos: [0, 0.14 * s, 0] }); headJ.add(headMesh);
    if (p.head === 'hood') headJ.add(cone(0.22 * s, 0.4 * s, cloth, { pos: [0, 0.2 * s, -0.04 * s], seg: 7, rot: [-0.25, 0, 0] }));
    if (p.head === 'helm') { headJ.add(sphere(0.19 * s, p.trim ?? '#8a8f98', { pos: [0, 0.17 * s, 0], scale: [1, 0.9, 1.03], metal: 0.6 })); headJ.add(box(0.28 * s, 0.04, 0.04, '#0a0a10', { pos: [0, 0.14 * s, 0.17 * s] })); }
    if (p.head === 'hollow') { headMesh.material = mat(skin, { emissive: glow ?? '#b79cff', ei: 0.12 }); headJ.add(box(0.1 * s, 0.03, 0.03, '#120a1c', { pos: [0, 0.1 * s, 0.17 * s] })); headJ.add(torus(0.2 * s, 0.015, glow ?? '#b79cff', { pos: [0, 0.34 * s, 0], rot: [PI / 2, 0, 0], emissive: glow ?? '#b79cff', ei: 1.2 })); } // mouth sealed
    if (p.head === 'scarf') { headJ.add(cone(0.21 * s, 0.34 * s, cloth, { pos: [0, 0.22 * s, -0.03 * s], seg: 7 })); headJ.add(box(0.3 * s, 0.1 * s, 0.22 * s, p.scarf ?? '#e0803a', { pos: [0, 0.04 * s, 0.02 * s] })); }
    if (p.head === 'crown') headJ.add(torus(0.18 * s, 0.025, '#d9a24a', { pos: [0, 0.3 * s, 0], rot: [PI / 2, 0, 0] }));
    if (p.head === 'bell') headJ.add(cyl(0.26 * s, 0.34 * s, 0.4 * s, '#b88a3e', { pos: [0, 0.2 * s, 0], seg: 10, metal: 0.6 }));
    const mkArm = (name, sx) => {
      const a = J(name, [sx * 0.34 * bulk * s, 0.66 * s, 0]);
      a.add(box(0.13 * s * bulk, 0.34 * s, 0.13 * s * bulk, cloth, { pos: [0, -0.15 * s, 0] }));
      const fore = J(`${name}Fore`, [0, -0.32 * s, 0]);
      fore.add(box(0.11 * s * bulk, 0.3 * s, 0.11 * s * bulk, skin, { pos: [0, -0.14 * s, 0] }));
      fore.add(sphere(0.07 * s, skin, { pos: [0, -0.3 * s, 0], seg: 5 }));
      a.add(fore); hips.add(a);
      return a;
    };
    const armL = mkArm('armL', -1), armR = mkArm('armR', 1);
    const mkLeg = (name, sx) => {
      const l = J(name, [sx * 0.13 * bulk * s, 0, 0]);
      l.add(box(0.15 * s * bulk, 0.5 * s, 0.16 * s * bulk, p.legs ?? '#4a4a56', { pos: [0, -0.24 * s, 0] }));
      const shin = J(`${name}Shin`, [0, -0.48 * s, 0]);
      shin.add(box(0.13 * s * bulk, 0.44 * s, 0.14 * s * bulk, p.legs ?? '#4a4a56', { pos: [0, -0.2 * s, 0] }));
      shin.add(box(0.15 * s * bulk, 0.08 * s, 0.26 * s * bulk, p.boots ?? '#2a2622', { pos: [0, -0.43 * s, 0.05 * s] }));
      l.add(shin); hips.add(l);
      return l;
    };
    mkLeg('legL', -1); mkLeg('legR', 1);
    // weapons (right hand / left hand)
    const mkWeapon = (kind, parent, o = {}) => {
      if (!kind || !WEAPONS[kind]) return null;
      const w = WEAPONS[kind](p); w.name = 'weapon'; w.scale.setScalar(s * (o.scale ?? 1));
      w.position.set(0, -0.36 * s, 0.04 * s); w.rotation.set(o.rx ?? PI / 2 - 0.3, 0, 0);
      parent.getObjectByName(`${parent.name}Fore`).add(w);
      return w;
    };
    const wR = mkWeapon(p.weaponR, armR), wL = mkWeapon(p.weaponL, armL, { rx: PI / 2 - 0.2 });
    // extras: orbiting crystals / hanging bell / trailing scarf
    const extras = {};
    if (p.orbit) {
      const orb = J('orbit', [0, 1.1 * s, 0]);
      for (let i = 0; i < p.orbit; i++) { const c = ico(0.11 * s, p.glow ?? '#7fe3ff', { emissive: p.glow ?? '#7fe3ff', ei: 1.2, detail: 0 }); c.userData.phase = (i / p.orbit) * PI * 2; orb.add(c); }
      root.add(orb); extras.orbit = orb;
    }
    if (p.hangBell) { const hb = J('hangBell', [0.28 * bulk * s, 0.05, 0.1]); hb.add(cyl(0.05 * s, 0.1 * s, 0.16 * s, '#d9a24a', { pos: [0, -0.1 * s, 0], metal: 0.6 })); hips.add(hb); extras.hangBell = hb; }
    if (p.scarfTail) { const st = J('scarfTail', [0, 0.72 * s, -0.12 * s]); st.add(box(0.12 * s, 0.05, 0.7 * s, p.scarf ?? '#e0803a', { pos: [0, 0, -0.35 * s] })); hips.add(st); extras.scarfTail = st; }
    if (p.hover) extras.hover = true;
    return { root, rig: 'biped', hips, extras, s, h, height: h };
  },

  quadruped(p) {
    const s = p.scale ?? 1, c = p.color ?? '#8a7a68', belly = p.belly ?? '#b7a78a', glow = p.glow ?? '#7fe3ff';
    const root = J('root');
    const body = J('body', [0, 0.62 * s, 0]); root.add(body);
    body.add(box(0.7 * s, 0.55 * s, 1.15 * s, c, { pos: [0, 0, 0] }));
    body.add(box(0.5 * s, 0.2 * s, 0.9 * s, belly, { pos: [0, -0.22 * s, 0] }));
    if (p.spikes) for (let i = 0; i < 4; i++) body.add(cone(0.08 * s, 0.34 * s, p.spikeColor ?? '#d9cbb0', { pos: [0, 0.34 * s, -0.4 * s + i * 0.28 * s], seg: 4 }));
    const head = J('head', [0, 0.18 * s, 0.62 * s]); body.add(head);
    head.add(box(0.42 * s, 0.38 * s, 0.5 * s, c, { pos: [0, 0, 0.1 * s] }));
    head.add(box(0.28 * s, 0.2 * s, 0.3 * s, belly, { pos: [0, -0.1 * s, 0.38 * s] }));
    for (const sx of [-1, 1]) {
      head.add(sphere(0.045 * s, glow, { pos: [sx * 0.14 * s, 0.08 * s, 0.32 * s], emissive: glow, ei: 1.4, seg: 5 }));
      if (p.horns) head.add(cone(0.07 * s, 0.4 * s, p.hornColor ?? '#e8dcc0', { pos: [sx * 0.2 * s, 0.28 * s, 0.05 * s], rot: [0, 0, -sx * 0.4], seg: 5 }));
      if (p.tusks) head.add(cone(0.05 * s, 0.3 * s, '#efe3c8', { pos: [sx * 0.17 * s, -0.12 * s, 0.5 * s], rot: [-0.9, 0, sx * 0.2], seg: 5 }));
    }
    const tail = J('tail', [0, 0.1 * s, -0.58 * s]); tail.add(cone(0.09 * s, 0.7 * s, c, { pos: [0, 0, -0.3 * s], rot: [-PI / 2 - 0.3, 0, 0], seg: 5 })); body.add(tail);
    const mkLeg = (name, x, z) => { const l = J(name, [x * s, -0.1 * s, z * s]); l.add(box(0.14 * s, 0.55 * s, 0.14 * s, c, { pos: [0, -0.26 * s, 0] })); l.add(box(0.16 * s, 0.07 * s, 0.22 * s, belly, { pos: [0, -0.54 * s, 0.04 * s] })); body.add(l); return l; };
    mkLeg('legFL', -0.27, 0.42); mkLeg('legFR', 0.27, 0.42); mkLeg('legBL', -0.27, -0.42); mkLeg('legBR', 0.27, -0.42);
    if (p.glowVeins) body.add(box(0.06 * s, 0.04 * s, 1.0 * s, glow, { pos: [0, 0.29 * s, 0], emissive: glow, ei: 1.0 }));
    return { root, rig: 'quadruped', hips: body, extras: {}, s, height: 1.1 * s };
  },

  floater(p) {
    const s = p.scale ?? 1, glow = p.glow ?? '#c58cff', core = p.color ?? '#dcd2f0';
    const root = J('root');
    const body = J('body', [0, 1.1 * s, 0]); root.add(body);
    body.add(ico(0.3 * s, core, { emissive: glow, ei: 0.5, detail: 1 }));
    body.add(sphere(0.12 * s, glow, { emissive: glow, ei: 1.8, pos: [0, 0, 0.18 * s] }));
    const halo = J('halo', [0, 0.1 * s, 0]); halo.add(torus(0.5 * s, 0.025 * s, glow, { rot: [PI / 2, 0, 0], emissive: glow, ei: 1.3, seg: 24 })); body.add(halo);
    for (let i = 0; i < (p.tendrils ?? 5); i++) { const a = (i / (p.tendrils ?? 5)) * PI * 2; const t = J(`tendril${i}`, [Math.sin(a) * 0.15 * s, -0.2 * s, Math.cos(a) * 0.15 * s]); t.add(cone(0.05 * s, 0.7 * s, core, { pos: [0, -0.35 * s, 0], rot: [PI, 0, 0], seg: 4, emissive: glow, ei: 0.4 })); body.add(t); }
    const wings = [];
    if (p.wings) for (const sx of [-1, 1]) { const w = J(sx < 0 ? 'wingL' : 'wingR', [sx * 0.2 * s, 0.1 * s, 0]); w.add(box(0.7 * s, 0.02, 0.3 * s, '#d8f0ff', { pos: [sx * 0.35 * s, 0, 0], opacity: 0.55, emissive: glow, ei: 0.3 })); body.add(w); wings.push(w); }
    return { root, rig: 'floater', hips: body, extras: { halo }, s, height: 1.8 * s, hoverY: 1.1 * s };
  },

  crawler(p) {
    const s = p.scale ?? 1, c = p.color ?? '#8a7a58', glow = p.glow ?? '#d9a24a';
    const root = J('root');
    const body = J('body', [0, 0.45 * s, 0]); root.add(body);
    body.add(ico(0.38 * s, c, { scale: [1, 0.7, 1.25], detail: 0, metal: p.metal ?? 0.5 }));
    body.add(sphere(0.2 * s, c, { pos: [0, 0.05 * s, 0.5 * s], metal: 0.5 }));
    for (const sx of [-1, 1]) body.add(sphere(0.05 * s, glow, { pos: [sx * 0.1 * s, 0.1 * s, 0.65 * s], emissive: glow, ei: 1.5, seg: 5 }));
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1, k = i % 4, a = 0.6 + k * 0.45;
      const leg = J(`leg${i}`, [side * 0.28 * s, 0, (k - 1.5) * 0.24 * s]);
      leg.add(box(0.05 * s, 0.05 * s, 0.6 * s, '#6a5a3c', { pos: [side * 0.3 * s, 0.05 * s, 0], rot: [0, 0, side * -0.5], metal: 0.4 }));
      leg.add(box(0.04 * s, 0.5 * s, 0.04 * s, '#6a5a3c', { pos: [side * 0.55 * s, -0.2 * s, 0] }));
      leg.rotation.y = side * (a - 1.2) * 0.4;
      body.add(leg);
    }
    body.add(box(0.28 * s, 0.14 * s, 0.4 * s, glow, { pos: [0, 0.22 * s, -0.25 * s], emissive: glow, ei: 0.9 }));
    return { root, rig: 'crawler', hips: body, extras: {}, s, height: 0.8 * s };
  },

  swarm(p) {
    const s = p.scale ?? 1, c = p.color ?? '#6a7a50', glow = p.glow ?? '#7fe3ff';
    const root = J('root');
    const body = J('body', [0, 1.0 * s, 0]); root.add(body);
    body.add(ico(0.16 * s, c, { scale: [1, 0.85, 1.4], detail: 0 }));
    body.add(sphere(0.07 * s, glow, { emissive: glow, ei: 1.5, pos: [0, 0, 0.2 * s], seg: 5 }));
    body.add(cone(0.05 * s, 0.22 * s, '#dccf9a', { pos: [0, -0.04 * s, -0.26 * s], rot: [-PI / 2, 0, 0], seg: 4 }));
    for (const sx of [-1, 1]) { const w = J(sx < 0 ? 'wingL' : 'wingR', [sx * 0.1 * s, 0.1 * s, 0]); w.add(box(0.34 * s, 0.01, 0.16 * s, '#cfe9ff', { pos: [sx * 0.17 * s, 0, 0], opacity: 0.55, emissive: glow, ei: 0.25 })); body.add(w); }
    return { root, rig: 'swarm', hips: body, extras: {}, s, height: 1.2 * s, hoverY: 1.0 * s };
  },

  turret(p) {
    const s = p.scale ?? 1, brass = p.color ?? '#b88a3e', glow = p.glow ?? '#7fe3ff';
    const root = J('root');
    root.add(cyl(0.7 * s, 0.9 * s, 0.5 * s, '#6d6458', { pos: [0, 0.25 * s, 0], seg: 8 }));
    root.add(cyl(0.35 * s, 0.45 * s, 0.7 * s, brass, { pos: [0, 0.85 * s, 0], seg: 8, metal: 0.6, rough: 0.4 }));
    const head = J('head', [0, 1.35 * s, 0]); root.add(head);
    head.add(box(0.7 * s, 0.5 * s, 0.8 * s, brass, { metal: 0.6, rough: 0.4 }));
    head.add(cyl(0.12 * s, 0.14 * s, 0.9 * s, '#3a3a40', { pos: [0, 0, 0.75 * s], rot: [PI / 2, 0, 0], seg: 6, metal: 0.7 }));
    head.add(sphere(0.12 * s, glow, { pos: [0, 0, 1.2 * s], emissive: glow, ei: 1.8, seg: 5 }));
    head.add(torus(0.3 * s, 0.03 * s, glow, { pos: [0, 0.32 * s, 0], rot: [PI / 2, 0, 0], emissive: glow, ei: 1.0 }));
    return { root, rig: 'turret', hips: head, extras: { head }, s, height: 1.9 * s };
  },

  burrower(p) {
    const s = p.scale ?? 1, c = p.color ?? '#7a6a58', glow = p.glow ?? '#7fe3ff';
    const root = J('root');
    const body = J('body', [0, 0, 0]); root.add(body);
    for (let i = 0; i < 5; i++) body.add(sphere((0.4 - i * 0.05) * s, i % 2 ? c : '#8d7c66', { pos: [0, (0.3 + i * 0.28) * s, -i * 0.05 * s], scale: [1, 0.9, 1], seg: 7 }));
    const head = J('head', [0, 1.7 * s, 0.1 * s]); body.add(head);
    head.add(sphere(0.32 * s, c, { seg: 7 }));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; head.add(cone(0.06 * s, 0.3 * s, '#efe3c8', { pos: [Math.sin(a) * 0.22 * s, 0.05 * s, 0.22 * s + Math.cos(a) * 0.1 * s], rot: [PI / 2 + 0.2, a * 0.3, 0], seg: 4 })); }
    head.add(sphere(0.08 * s, glow, { pos: [0, 0.18 * s, 0.26 * s], emissive: glow, ei: 1.6, seg: 5 }));
    const mound = box(1.6 * s, 0.25 * s, 1.6 * s, '#8a7a60', { pos: [0, 0.1 * s, 0], rot: [0, 0.4, 0] }); root.add(mound);
    return { root, rig: 'burrower', hips: body, extras: { mound }, s, height: 2.0 * s };
  },

  cocoon(p) {
    const s = p.scale ?? 1, c = p.color ?? '#c7b7dc', glow = p.glow ?? '#7fe3ff';
    const root = J('root');
    const body = J('body', [0, 0.85 * s, 0]); root.add(body);
    body.add(ico(0.7 * s, c, { scale: [1, 1.35, 1], detail: 1, emissive: glow, ei: 0.35, opacity: 0.95 }));
    const core = sphere(0.28 * s, glow, { emissive: glow, ei: 1.6, seg: 7 }); body.add(core);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; body.add(cone(0.12 * s, 0.7 * s, '#9a86b8', { pos: [Math.sin(a) * 0.62 * s, -0.7 * s, Math.cos(a) * 0.62 * s], rot: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5], seg: 4 })); }
    root.add(cyl(0.9 * s, 1.0 * s, 0.2 * s, '#6b5f78', { pos: [0, 0.1 * s, 0], seg: 8 }));
    return { root, rig: 'cocoon', hips: body, extras: { core }, s, height: 1.8 * s };
  },

  reaper(p) {
    const s = p.scale ?? 1, brass = '#b88a3e';
    const root = J('root');
    const body = J('body', [0, 0.7 * s, 0]); root.add(body);
    const saw = J('saw', [0, 0, 0]); body.add(saw);
    saw.add(cyl(0.9 * s, 0.9 * s, 0.14 * s, '#8a8f98', { seg: 18, metal: 0.7, rough: 0.35 }));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; saw.add(cone(0.12 * s, 0.34 * s, '#c9ced4', { pos: [Math.sin(a) * 0.95 * s, 0, Math.cos(a) * 0.95 * s], rot: [0, 0, 0], seg: 3 })).rotation.set(PI / 2 * 0 + 0, a, -PI / 2); }
    saw.add(cyl(0.22 * s, 0.22 * s, 0.3 * s, brass, { seg: 8, metal: 0.6 }));
    body.add(box(0.14 * s, 0.8 * s, 0.14 * s, '#4a4036', { pos: [0, -0.1 * s, 0] }));
    root.add(box(0.9 * s, 0.2 * s, 0.9 * s, '#4a4036', { pos: [0, 0.1 * s, 0] }));
    saw.rotation.x = PI / 2 - 1.2;
    return { root, rig: 'reaper', hips: body, extras: { saw }, s, height: 1.6 * s };
  },

  dummy() {
    const root = J('root');
    const body = J('body', [0, 0.9, 0]); root.add(body);
    body.add(cyl(0.3, 0.3, 1.2, '#a8825a', { seg: 8 }));
    body.add(sphere(0.25, '#d8c9a0', { pos: [0, 0.8, 0] }));
    return { root, rig: 'dummy', hips: body, extras: {}, s: 1, height: 1.9 };
  },
};

/**
 * Build a model from a spec { tpl, p, glb? }.
 *  • spec.glb + ready assets → a rigged KayKit character (see charFactory.js)
 *  • otherwise the procedural template named by spec.tpl (hand-made creatures and the primitive biped fallback)
 * Every model exposes: root, height, meshes[], kind ('rig' | 'proc'), rig (animation family) and, for new-style models, tick(st, dt).
 */
export function buildModelFromSpec(spec, opts = {}) {
  if (spec.glb && factory?.ready) {
    try { const m = factory.build(spec, opts); if (m) return m; } catch (err) { log.error(`rig build failed for ${spec.id}, using the procedural fallback`, err); }
  }
  const make = CREATURES[spec.tpl] ?? TEMPLATES[spec.tpl];
  if (!make) throw new Error(`unknown model template ${spec.tpl}`);
  const m = make(spec.p ?? {}, opts);
  mergeStatic(m.root);          // 60-mesh creatures become ~15 draw calls: only unnamed parts that never move relative to their joint are baked together
  m.spec = spec;
  m.kind = 'proc';
  m.fallback = !!spec.glb;       // true = this is the stand-in for a rigged model (EntityViews upgrades it when the assets arrive)
  m.roles = {};
  m.meshes = [];
  m.root.traverse((o) => {
    if (o.name) m.roles[o.name] = o;
    if (o.isMesh) { m.meshes.push(o); o.userData.mat0 = o.material; }
  });
  m.rest = {};
  for (const k in m.roles) { const o = m.roles[k]; m.rest[k] = { r: o.rotation.clone(), p: o.position.clone() }; }
  m.height ??= m.h ?? 1.8;
  return m;
}

const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
export function setFlash(m, on) {
  if (m.kind === 'rig') return;            // rigs flash through rig.flash() (emissive pulse), see EntityViews
  if (m.flashed === on) return;
  m.flashed = on;
  for (const me of m.meshes) me.material = on ? flashMat : me.userData.mat0;
}
export function setGhost(m, on, color = '#7fe3ff') {
  if (m.kind === 'rig') { m.ghost(on); return; }
  const gm = on ? mat(color, { emissive: color, ei: 1, opacity: 0.45 }) : null;
  for (const me of m.meshes) me.material = on ? gm : me.userData.mat0;
}
