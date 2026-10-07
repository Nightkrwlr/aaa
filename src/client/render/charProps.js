/**
 * charProps — hand-made props for rigged characters (things the KayKit packs do not ship: bell hammers, prism staves,
 * hand bells, tuning forks, hanging bells). Convention = KayKit weapons: origin at the grip, the weapon extends along +Y
 * (out of the fist), so they attach to `handslot.r/.l` exactly like the built-in meshes.
 *
 *   buildProp('bell_hammer', { scale: 1 }) → { obj: Group, tick?(t,dt,st) }
 */
import * as THREE from 'three';
import { P, J, G, add, shade } from './stylekit.js';

const PI = Math.PI;
const BRONZE = '#c98f3e', BRONZE_D = '#8a5a22', WOOD = '#6b4a2e', WOOD_D = '#4a3220', IRON = '#59616e', BONE = '#e9dfc8';

/** bell profile (x = radius, y = height; mouth at y=0, crown at the top) */
const BELL = (r, h) => [[r * 1.0, 0.0], [r * 0.94, h * 0.1], [r * 0.7, h * 0.34], [r * 0.5, h * 0.58], [r * 0.38, h * 0.8], [r * 0.2, h * 0.94], [0.0, h * 1.0]];
const BELL_IN = (r, h) => [[0.0, h * 0.92], [r * 0.18, h * 0.86], [r * 0.34, h * 0.66], [r * 0.46, h * 0.44], [r * 0.64, h * 0.22], [r * 0.9, h * 0.02]];

/** wide dome with a flared lip: covers a chunky KayKit skull (radius ~0.4) */
const DOME = (r, h) => [[r * 1.0, 0.0], [r * 0.93, h * 0.07], [r * 0.82, h * 0.2], [r * 0.8, h * 0.42], [r * 0.7, h * 0.66], [r * 0.5, h * 0.84], [r * 0.24, h * 0.95], [0.0, h * 1.0]];
const DOME_IN = (r, h) => [[0.0, h * 0.94], [r * 0.2, h * 0.9], [r * 0.46, h * 0.78], [r * 0.64, h * 0.6], [r * 0.74, h * 0.4], [r * 0.76, h * 0.2], [r * 0.9, h * 0.02]];

function bell(r, h, color = BRONZE, { glow = '#7fe3ff', band = true, seg = 12, dome = false } = {}) {
  const g = G();
  g.add(P('lathe', [dome ? DOME(r, h) : BELL(r, h), seg], color, { gloss: true, top: 1.2, bot: 0.72 }));
  g.add(P('lathe', [dome ? DOME_IN(r, h) : BELL_IN(r, h), seg], shade(color, -0.55), { top: 1.0, bot: 0.55 }));
  if (band) {
    g.add(P('tor', [r * 0.9, r * 0.065, 5, seg + 4], shade(color, 0.18), { pos: [0, h * 0.13, 0], rot: [PI / 2, 0, 0], top: 1.1, bot: 1.0 }));
    g.add(P('tor', [r * 0.6, r * 0.045, 5, seg + 4], shade(color, 0.12), { pos: [0, h * 0.46, 0], rot: [PI / 2, 0, 0], top: 1.1, bot: 1.0 }));
  }
  g.add(P('sph', [r * 0.16, 8, 6], shade(color, -0.2), { pos: [0, h * 0.02, 0] }));            // clapper
  if (glow) g.add(P('oct', [r * 0.2], glow, { glow: 2.4, pos: [0, h * 0.2, 0], scale: [0.8, 1.2, 0.8] }));
  return g;
}

export const PROPS = {
  /** Campanario's war-hammer: a great bronze bell mounted sideways on an oak haft */
  bell_hammer({ scale = 1, glow = '#7fe3ff', color = BRONZE } = {}) {
    const g = G();
    g.add(P('cyl', [0.034, 0.042, 1.5, 8], WOOD, { pos: [0, 0.42, 0], top: 1.15, bot: 0.8 }));
    for (const y of [-0.05, 0.05, 0.15]) g.add(P('cyl', [0.047, 0.047, 0.05, 8], WOOD_D, { pos: [0, y, 0] }));      // leather grip wraps
    g.add(P('sph', [0.058, 8, 6], shade(color, -0.35), { pos: [0, -0.34, 0] }));                                              // pommel
    const head = J('head', [0, 1.1, 0.0]);
    const b = bell(0.34, 0.52, color, { glow });
    b.rotation.x = PI / 2;                                         // crown (+y) → +z? rotate so the mouth faces -z... then flip
    b.rotation.x = -PI / 2; b.position.set(0, 0, 0.22);            // crown to the back, mouth to the front (+z)
    head.add(b);
    head.add(P('cyl', [0.075, 0.075, 0.2, 8], BRONZE_D, { pos: [0, 0.0, 0.0] }));                                   // collar where the haft meets the bell
    head.add(P('tor', [0.1, 0.026, 5, 12], IRON, { pos: [0, -0.04, 0.0], rot: [PI / 2, 0, 0] }));
    g.add(head);
    g.scale.setScalar(scale);
    return { obj: g, tick: (t) => { head.rotation.z = Math.sin(t * 2.2) * 0.01; } };
  },

  /** Prismante's staff: long pale haft, brass claw, floating cyan prism and three orbiting shards */
  prism_staff({ scale = 1, color = '#7fe3ff', shards = 3 } = {}) {
    const g = G();
    g.add(P('cyl', [0.03, 0.036, 1.9, 7], BONE, { pos: [0, 0.55, 0], top: 1.1, bot: 0.85 }));
    for (const y of [0.1, 0.6, 1.3]) g.add(P('tor', [0.04, 0.012, 5, 10], BRONZE, { pos: [0, y, 0], rot: [PI / 2, 0, 0], top: 1.1, bot: 1.0 }));
    g.add(P('sph', [0.05, 8, 6], BRONZE_D, { pos: [0, -0.4, 0] }));
    const top = J('top', [0, 1.62, 0]);
    // claw: 3 curved prongs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      top.add(P('tube', [[[Math.sin(a) * 0.04, -0.06, Math.cos(a) * 0.04], [Math.sin(a) * 0.12, 0.08, Math.cos(a) * 0.12], [Math.sin(a) * 0.1, 0.26, Math.cos(a) * 0.1]], 0.022, 0.008, { segs: 6, radial: 5 }], BRONZE, { top: 1.2, bot: 0.9 }));
    }
    const prism = P('oct', [0.17, 0], color, { glow: 2.2, pos: [0, 0.14, 0], scale: [0.62, 1.55, 0.62] });
    top.add(prism);
    top.add(P('oct', [0.22, 0], color, { glow: 0.9, opacity: 0.28, pos: [0, 0.14, 0], scale: [0.8, 1.75, 0.8] }));
    const orbit = J('orbit', [0, 0.14, 0]);
    const sh = [];
    for (let i = 0; i < shards; i++) { const s = P('oct', [0.06, 0], '#e8fbff', { glow: 2.4, scale: [0.6, 1.3, 0.6] }); sh.push(s); orbit.add(s); }
    top.add(orbit);
    g.add(top);
    g.scale.setScalar(scale);
    return {
      obj: g,
      tick: (t, dt, st) => {
        prism.rotation.y = t * 0.9; prism.position.y = 0.14 + Math.sin(t * 1.6) * 0.02;
        const spd = st?.cast ? 3.2 : 1.1;
        sh.forEach((s, i) => { const a = (i / sh.length) * PI * 2 + t * spd; s.position.set(Math.sin(a) * 0.3, Math.sin(a * 1.7 + i) * 0.1, Math.cos(a) * 0.3); s.rotation.y = a; });
      },
    };
  },

  /** brass hand bell with a turned wooden grip (Mute Bellringer) */
  handbell({ scale = 1 } = {}) {
    const g = G();
    g.add(P('cyl', [0.03, 0.036, 0.26, 7], WOOD, { pos: [0, 0.04, 0] }));
    const b = bell(0.2, 0.26, BRONZE, { glow: null, band: true });
    b.rotation.x = PI; b.position.set(0, 0.5, 0);                     // mouth down hmm: crown at the grip end, mouth up? ring it mouth-down
    b.rotation.x = 0; b.position.set(0, 0.17, 0);
    g.add(b);
    g.scale.setScalar(scale);
    return { obj: g };
  },

  /** the tuner's fork: a big steel Y that hums cyan (Hesk) */
  tuning_fork({ scale = 1, glow = '#7fe3ff' } = {}) {
    const g = G();
    g.add(P('cyl', [0.03, 0.034, 0.5, 7], WOOD, { pos: [0, 0.15, 0] }));
    g.add(P('rbox', [0.12, 0.06, 0.06, 0.02], IRON, { pos: [0, 0.42, 0] }));
    for (const s of [-1, 1]) {
      g.add(P('rbox', [0.045, 0.62, 0.05, 0.018], '#aeb8c4', { pos: [s * 0.075, 0.76, 0], top: 1.25, bot: 0.8 }));
      g.add(P('sph', [0.034, 6, 5], glow, { glow: 2.2, pos: [s * 0.075, 1.09, 0] }));
    }
    g.scale.setScalar(scale);
    return { obj: g, tick: (t) => { g.rotation.z = Math.sin(t * 40) * 0.003; } };
  },

  /** small bell that hangs from the belt and swings with the walk */
  hip_bell({ scale = 1 } = {}) {
    const g = G();
    const pivot = J('swing', [0, 0, 0]);
    const b = bell(0.11, 0.15, BRONZE, { glow: null, band: false, seg: 10 });
    b.rotation.x = PI; b.position.set(0, -0.04, 0);
    pivot.add(b);
    pivot.add(P('cyl', [0.008, 0.008, 0.1, 5], IRON, { pos: [0, 0.03, 0] }));
    g.add(pivot);
    g.scale.setScalar(scale);
    return { obj: g, tick: (t, dt, st) => { const m = Math.min(1, (st?.mps ?? 0) / 4); pivot.rotation.z = Math.sin(t * (6 + m * 8)) * (0.08 + 0.45 * m); pivot.rotation.x = Math.cos(t * (5 + m * 7)) * 0.2 * m; } };
  },

  /** pale lantern with a violet flame (Sacristan, Penitent) */
  lantern({ scale = 1, color = '#b79cff' } = {}) {
    const g = G();
    g.add(P('cyl', [0.012, 0.012, 0.36, 5], IRON, { pos: [0, 0.12, 0] }));
    g.add(P('rbox', [0.16, 0.2, 0.16, 0.03], IRON, { pos: [0, 0.38, 0] }));
    g.add(P('oct', [0.07, 0], color, { glow: 2.4, pos: [0, 0.38, 0], scale: [0.8, 1.3, 0.8] }));
    g.scale.setScalar(scale);
    return { obj: g, tick: (t) => { g.children[2].scale.y = 1.3 + Math.sin(t * 13) * 0.12; } };
  },

  /** a bronze bell worn as a helm (Mute Bellringer): mouth down over the skull. Attach to `head`. */
  bell_helm({ scale = 1, color = BRONZE, glow = '#b79cff', y = 0.02 } = {}) {
    const g = G();
    const b = bell(0.56, 1.02, color, { glow: null, band: true, seg: 16, dome: true });
    b.position.y = y;
    g.add(b);
    g.add(P('rbox', [0.34, 0.07, 0.05, 0.02], glow, { glow: 2.8, pos: [0, y + 0.3, 0.53] }));   // glowing slit under the lip: the bellringer's gaze
    g.scale.setScalar(scale);
    return { obj: g };
  },

  /** pair of glowing eyes / visor slit attached to the head (constructs). opts: color, w, h, x, y, z */
  eye_glow({ color = '#7fe3ff', w = 0.1, h = 0.05, x = 0.14, y = 0.55, z = 0.36, intensity = 2.6, scale = 1 } = {}) {
    const g = G();
    for (const s of [-1, 1]) g.add(P('rbox', [w, h, 0.04, 0.012], color, { glow: intensity, pos: [s * x, y, z] }));
    g.scale.setScalar(scale);
    return { obj: g };
  },

  /** halo of light behind the head + a crown of small spikes (Ildra). Attach to `head`. */
  halo_crown({ color = '#b79cff', scale = 1, y = 0.9 } = {}) {
    const g = G();
    const ring = P('tor', [0.62, 0.03, 6, 28], color, { glow: 2.2, pos: [0, y, -0.12], rot: [PI / 2 - 0.25, 0, 0] });
    g.add(ring);
    g.add(P('tor', [0.82, 0.016, 5, 28], color, { glow: 1.2, opacity: 0.6, pos: [0, y, -0.12], rot: [PI / 2 - 0.25, 0, 0] }));
    for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; g.add(P('cone', [0.045, 0.26, 4], shade(color, 0.35), { glow: 2.0, pos: [Math.sin(a) * 0.4, y + 0.04, Math.cos(a) * 0.4 - 0.1], rot: [0, 0, 0], scale: [1, 1 + (i % 2) * 0.5, 1] })); }
    g.scale.setScalar(scale);
    return { obj: g, tick: (t) => { ring.rotation.z = t * 0.3; } };
  },

  /** floating glowing notes / crystals circling the wearer (Ildra, Tarn's echo). Attach to `chest`. */
  orbit_notes({ color = '#b79cff', count = 5, radius = 0.95, y = 0.3, scale = 1, speed = 0.9 } = {}) {
    const g = G();
    const items = [];
    for (let i = 0; i < count; i++) {
      const it = G();
      it.add(P('oct', [0.1, 0], color, { glow: 2.4, scale: [0.7, 1.3, 0.7] }));
      it.add(P('oct', [0.17, 0], color, { glow: 0.8, opacity: 0.3, scale: [0.8, 1.5, 0.8] }));
      items.push(it); g.add(it);
    }
    g.scale.setScalar(scale);
    return {
      obj: g,
      tick: (t, dt, st) => {
        const sp = speed * (st?.cast ? 2.6 : 1);
        items.forEach((it, i) => { const a = (i / count) * PI * 2 + t * sp; it.position.set(Math.sin(a) * radius, y + Math.sin(a * 2 + i) * 0.18, Math.cos(a) * radius); it.rotation.y = a * 1.5; });
      },
    };
  },

  /** hissing fuse spark (Penitent's powder keg): a flickering ember with a short wick. Attach to `chest`. */
  fuse_spark({ scale = 1, color = '#ff9a3a', x = 0, y = 0.55, z = 0.3 } = {}) {
    const g = G();
    g.add(P('cyl', [0.012, 0.012, 0.16, 5], '#2a2218', { pos: [x, y, z] }));
    const ember = P('oct', [0.06, 0], color, { glow: 3.2, pos: [x, y + 0.11, z], scale: [1, 1.2, 1] });
    const halo = P('sph', [0.14, 8, 6], color, { glow: 1.0, opacity: 0.35, pos: [x, y + 0.11, z] });
    g.add(ember, halo);
    g.scale.setScalar(scale);
    return { obj: g, tick: (t) => { const f = 0.8 + Math.sin(t * 31) * 0.2 + Math.sin(t * 17.3) * 0.15; ember.scale.set(f, f * 1.3, f); halo.scale.setScalar(0.9 + f * 0.3); } };
  },

  /** the brass tolling clapper chain (decorative belt) not used by default */
  bell_pendant({ scale = 1 } = {}) {
    const g = G();
    g.add(bell(0.09, 0.12, BRONZE, { glow: null, band: false, seg: 8 }));
    g.rotation.x = PI; g.scale.setScalar(scale);
    return { obj: g };
  },
};

export function buildProp(kind, opts = {}) {
  const f = PROPS[kind];
  if (!f) return null;
  return f(opts);
}

/** re-export so the factory can place props without importing three itself */
export { THREE };
