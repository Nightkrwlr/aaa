/**
 * WorldAssets — loads the KayKit CC0 kit pieces the overworld needs (graveyard + dungeon groups) as baked, instancing-ready
 * geometries, and builds recoloured atlas variants (green pines instead of autumn orange, warm limestone instead of dungeon grey)
 * so the third-party art sits in OUR palette. Everything degrades gracefully: when a model or the manifest fails to load the
 * callers get null and use their procedural fallbacks.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Assets } from './assets.js';
import { logger } from '../../core/logger.js';
import { kitMaterial } from './worldMaterials.js';

const log = logger('worldAssets');

/** every kit piece the world uses (group/id) */
export const KIT_LIST = [
  ...['tree_pine_orange_small', 'tree_pine_orange_medium', 'tree_pine_orange_large', 'tree_pine_yellow_small', 'tree_pine_yellow_medium', 'tree_pine_yellow_large',
    'tree_dead_small', 'tree_dead_medium', 'tree_dead_large', 'tree_dead_large_decorated',
    'lantern_standing', 'lantern_hanging', 'post_lantern', 'post', 'post_skull', 'fence', 'fence_broken', 'fence_gate', 'fence_pillar', 'fence_pillar_broken', 'fence_seperate', 'fence_seperate_broken',
    'arch', 'arch_gate', 'gravestone', 'grave_A', 'grave_A_destroyed', 'grave_B', 'gravemarker_A', 'gravemarker_B', 'crypt', 'shrine', 'shrine_candles', 'plaque', 'plaque_candles',
    'bench', 'bench_decorated', 'path_A', 'path_B', 'path_C', 'path_D', 'pillar', 'candle', 'candle_triple', 'candle_melted', 'candle_thin', 'bone_A', 'bone_B', 'bone_C', 'skull', 'skull_candle', 'ribcage',
    'coffin', 'coffin_decorated', 'pumpkin_orange', 'pumpkin_orange_small', 'pumpkin_yellow', 'pumpkin_yellow_small', 'pumpkin_orange_jackolantern'].map((i) => `graveyard/${i}`),
  ...['barrel_large', 'barrel_large_decorated', 'barrel_small', 'barrel_small_stack', 'box_large', 'box_small', 'box_small_decorated', 'box_stacked', 'crates_stacked', 'trunk_large_A', 'trunk_large_B', 'trunk_medium_A', 'trunk_small_A',
    'banner_red', 'banner_blue', 'banner_green', 'banner_white', 'banner_yellow', 'banner_brown', 'banner_thin_red', 'banner_thin_blue', 'banner_thin_white', 'banner_patternA_red', 'banner_patternA_blue', 'banner_patternA_white', 'banner_patternB_red', 'banner_patternB_blue', 'banner_patternC_white', 'banner_shield_red', 'banner_shield_blue', 'banner_shield_white', 'banner_triple_red', 'banner_triple_blue',
    'torch', 'torch_lit', 'torch_mounted', 'column', 'pillar', 'pillar_decorated', 'rubble_half', 'rubble_large', 'wall', 'wall_broken', 'wall_half', 'wall_cracked', 'wall_pillar', 'wall_arched', 'wall_doorway', 'wall_endcap', 'wall_half_endcap', 'wall_corner', 'wall_corner_small',
    'wall_archedwindow_open', 'wall_window_open', 'wall_window_closed', 'chest', 'chest_gold', 'keg', 'keg_decorated', 'table_long', 'table_medium', 'table_small', 'table_long_tablecloth', 'table_medium_tablecloth', 'table_small_decorated_A', 'chair', 'stool',
    'shelf_large', 'shelf_small', 'shelf_small_candles', 'shelves', 'bottle_A_brown', 'bottle_A_green', 'bottle_B_brown', 'bottle_B_green', 'bottle_C_brown', 'bottle_C_green', 'plate', 'plate_small', 'plate_stack', 'plate_food_A', 'plate_food_B',
    'candle', 'candle_lit', 'candle_triple', 'candle_thin_lit', 'floor_dirt_large', 'floor_dirt_small_A', 'floor_dirt_small_weeds', 'floor_tile_large', 'floor_tile_small', 'floor_tile_large_rocks', 'floor_tile_small_weeds_A', 'floor_foundation_front', 'floor_foundation_corner',
    'stairs', 'stairs_narrow', 'stairs_wide', 'stairs_wood', 'barrier', 'barrier_half', 'barrier_column', 'barrier_corner', 'sword_shield', 'sword_shield_gold', 'bed_floor', 'bed_frame', 'coin_stack_small', 'coin_stack_medium', 'keyring_hanging', 'wall_scaffold', 'wall_open_scaffold'].map((i) => `dungeon/${i}`),
];

const GRID = { cols: 8, rows: 4 };

/**
 * Merge every mesh of a glTF template into ONE float geometry (position/normal/uv) in the template's own world space.
 * The shipped GLBs are meshopt-quantised (normalised int16 positions): applying a node matrix to such an attribute would clamp it
 * to [-1,1], so every attribute is first expanded to Float32.
 */
function bakeTemplate(scene) {
  scene.updateMatrixWorld(true);
  const geoms = []; let map = null;
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry.clone();
    for (const name of ['position', 'normal', 'uv']) {
      const a = g.attributes[name]; if (!a) continue;
      const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
      g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
    }
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(o.matrixWorld);
    geoms.push(g);
    const mm = Array.isArray(o.material) ? o.material[0] : o.material; map ??= mm?.map ?? null;
  });
  if (!geoms.length) return null;
  const hasIndex = geoms.every((g) => g.index), none = geoms.every((g) => !g.index);
  const list = hasIndex || none ? geoms : geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  const geometry = list.length === 1 ? list[0] : mergeGeometries(list, false);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, map };
}

/** HSV recolour of atlas swatch cells. op = { c, r, dh (hue shift °), setH, sMul, sMin, vMul } */
function recolorAtlas(baseTex, ops) {
  const img = baseTex.image;
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const cw = cv.width / GRID.cols, ch = cv.height / GRID.rows;
  for (const op of ops) {
    const d = g.getImageData(op.c * cw, op.r * ch, cw, ch), px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      let r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn;
      let h = 0; if (dl > 1e-5) { if (mx === r) h = ((gg - b) / dl) % 6; else if (mx === gg) h = (b - r) / dl + 2; else h = (r - gg) / dl + 4; h *= 60; if (h < 0) h += 360; }
      let s = mx === 0 ? 0 : dl / mx, v = mx;
      if (op.setH !== undefined) h = op.setH + (op.hSpread ?? 0) * (v - 0.5); else h = (h + (op.dh ?? 0) + 360) % 360;
      s = Math.min(1, Math.max(op.sMin ?? 0, s * (op.sMul ?? 1))); v = Math.min(1, v * (op.vMul ?? 1));
      // hsv → rgb
      const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
      let rr, g2, bb; const hh = Math.floor(h / 60) % 6;
      if (hh === 0) [rr, g2, bb] = [c, x, 0]; else if (hh === 1) [rr, g2, bb] = [x, c, 0]; else if (hh === 2) [rr, g2, bb] = [0, c, x]; else if (hh === 3) [rr, g2, bb] = [0, x, c]; else if (hh === 4) [rr, g2, bb] = [x, 0, c]; else [rr, g2, bb] = [c, 0, x];
      px[i] = (rr + m) * 255; px[i + 1] = (g2 + m) * 255; px[i + 2] = (bb + m) * 255;
    }
    g.putImageData(d, op.c * cw, op.r * ch);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; t.wrapS = baseTex.wrapS; t.wrapT = baseTex.wrapT; t.userData = { shared: true };
  return t;
}

/** atlas variants per group: name → recolour ops */
const VARIANTS = {
  graveyard: {
    forest: [{ c: 0, r: 1, dh: 96, sMul: 0.8, vMul: 0.78 }, { c: 1, r: 1, dh: 52, sMul: 0.82, vMul: 0.8 }],
    pine: [{ c: 0, r: 1, dh: 118, sMul: 0.6, vMul: 0.52 }, { c: 1, r: 1, dh: 80, sMul: 0.62, vMul: 0.56 }],
    limestone: [{ c: 3, r: 0, setH: 38, hSpread: 8, sMin: 0.1, sMul: 1.6, vMul: 1.18 }, { c: 2, r: 0, setH: 36, sMin: 0.1, sMul: 1.4, vMul: 1.1 }, { c: 4, r: 0, setH: 40, sMin: 0.06, sMul: 1.2 }],
    violet: [{ c: 3, r: 0, setH: 258, sMin: 0.045, sMul: 0.6, vMul: 1.12 }],
  },
  dungeon: {
    limestone: [{ c: 1, r: 0, setH: 40, hSpread: 6, sMin: 0.12, sMul: 1.7, vMul: 1.22 }, { c: 0, r: 0, setH: 34, sMin: 0.1, sMul: 1.6, vMul: 1.25 }, { c: 5, r: 0, setH: 38, sMin: 0.12, sMul: 1.6, vMul: 1.1 }, { c: 7, r: 0, setH: 32, sMin: 0.12, sMul: 1.1, vMul: 1.05 }],
    cool: [{ c: 1, r: 0, setH: 225, sMin: 0.08, sMul: 1.1, vMul: 1.05 }],
  },
};

export class WorldAssets {
  /** @param {Assets|null} assets shared Assets instance (optional) */
  constructor(assets = null) {
    this.assets = assets ?? new Assets();
    this.geos = new Map(); this.baseAtlas = {}; this.atlas = new Map(); this.mats = new Map();
    this.ready = false; this.failed = false; this.loaded = 0; this.total = 0;
    this.promise = null;
  }

  /** load the manifest (if nobody did) and the requested models; resolves true when at least the core pieces are available */
  load(list = KIT_LIST) {
    this.promise ??= (async () => {
      const a = this.assets;
      try {
        if (!a.manifest) { const r = await fetch(a.base + 'manifest.json'); if (!r.ok) throw new Error(`manifest ${r.status}`); a.manifest = await r.json(); }
      } catch (e) { log.warn('kit manifest unavailable — procedural fallbacks only', e); this.failed = true; return false; }
      const wanted = list.filter((k) => a.has(...k.split('/')));
      this.total = wanted.length;
      await Promise.all(wanted.map(async (key) => {
        const [g, id] = key.split('/');
        try {
          const tpl = await a.template(g, id);
          const b = tpl ? bakeTemplate(tpl.scene) : null;
          if (b?.geometry) { b.geometry.userData.shared = true; this.geos.set(key, b.geometry); if (!this.baseAtlas[g] && b.map) this.baseAtlas[g] = b.map; }
        } catch (e) { log.warn(`kit piece ${key} failed`, e); }
        this.loaded++;
      }));
      this.ready = this.geos.size > 0;
      return this.ready;
    })();
    return this.promise;
  }

  has(key) { return this.geos.has(key); }
  geo(key) { return this.geos.get(key) ?? null; }

  /** atlas texture for a group/variant ('base' = the original) */
  atlasFor(group, variant = 'base') {
    const base = this.baseAtlas[group]; if (!base) return null;
    if (variant === 'base') return base;
    const key = `${group}/${variant}`;
    let t = this.atlas.get(key);
    if (!t) {
      const ops = VARIANTS[group]?.[variant];
      if (!ops) return base;
      try { t = recolorAtlas(base, ops); } catch (e) { log.warn(`recolour ${key} failed`, e); t = base; }
      this.atlas.set(key, t);
    }
    return t;
  }

  /** shared kit material for a group/variant; wind options make it sway (trees, banners) */
  material(group, variant = 'base', o = {}) {
    const key = `${group}/${variant}|${o.wind ? `w${o.swayHeight ?? 6}${o.windFlip ? 'f' : ''}${o.swayAmt ?? ''}` : ''}|${o.aoK ?? ''}|${o.fade === false ? 'nf' : ''}|${o.cloud === false ? 'nc' : ''}|${o.vertexColors ? 'vc' : ''}`;
    let m = this.mats.get(key);
    if (!m) {
      const map = this.atlasFor(group, variant); if (!map) return null;
      m = kitMaterial({ map, rough: 0.8, ...o });
      this.mats.set(key, m);
    }
    return m;
  }

  /** bounding size of a baked piece (for fitting) */
  size(key) { const g = this.geo(key); if (!g) return null; g.computeBoundingBox(); return g.boundingBox.getSize(new THREE.Vector3()); }
}
