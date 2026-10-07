import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CharacterRig } from './assets.js';
import { CharAnimator } from './charAnim.js';
import { buildProp } from './charProps.js';
import { logger } from '../../core/logger.js';

const log = logger('chars');

/**
 * CharFactory — builds rigged KayKit models from a model spec's `glb` block (see data/models/models.json):
 *
 *   glb: { char, scale, equip[], hide[], external[{bone,group,id,pos,rot,scale}], props[{bone,kind,...}],
 *          palette{ "col,row": "#hex" | {hue,sat,light} , ranges:[{from,to,dh,s,l}] }, emissiveTiles{ "col,row": "#hex" },
 *          tint, eyes{color,intensity}, rim{color,k,pow}, style, walk, run, runAt, idle[], variants[], hover, skeleton }
 *
 * Performance notes
 *  • every character is 9–10 skinned meshes in the glTF; we merge them into ONE SkinnedMesh per variant (one skeleton to
 *    update, one bone texture, two draw calls) — the per-mesh dequantisation baked into each skin's inverse-bind matrices
 *    is folded back into the vertex positions so the merge is exact (verified, with a fallback to the original parts).
 *  • atlas recolours are canvas textures cached by recipe and shared by every instance of that recipe.
 *  • materials are cloned per rig (flash/tint/rim are per-instance), but they all share ONE shader program.
 */

export function dependenciesOf(specs) {
  const keys = new Set();
  for (const s of specs) {
    const g = s.glb; if (!g) continue;
    keys.add(`chars/${g.char}`);
    for (const x of g.external ?? []) keys.add(`${x.group}/${x.id}`);
    for (const k of g.kit ?? []) keys.add(`${k.group ?? 'dungeon'}/${k.id}`);
  }
  return [...keys];
}

const NOM_HEIGHT = 2.15; // metres at scale 1 (hips 0.4, head bone 1.24, skull top about 2.1: the KayKit proportions are chunky, ~3 heads)
const IDENT = new THREE.Matrix4();

const maxDiff = (a, b) => { let d = 0; for (let i = 0; i < 16; i++) d = Math.max(d, Math.abs(a.elements[i] - b.elements[i])); return d; };

/** merge the skinned body parts of a cloned character into one multi-material SkinnedMesh; returns false (and leaves the tree untouched) if anything looks off */
function mergeSkinned(root, exclude) {
  const parts = [];
  root.traverse((o) => { if (o.isSkinnedMesh && !exclude.has(o.name)) parts.push(o); });
  if (parts.length < 2) return false;
  const ref = parts[0];
  const names = (m) => m.skeleton.bones.map((b) => b.name).join('|');
  const refNames = names(ref), refIBM = ref.skeleton.boneInverses;
  const Qs = [], tmp = new THREE.Matrix4();
  for (const m of parts) {
    if (names(m) !== refNames || !m.matrix.equals(IDENT) || maxDiff(m.bindMatrix, ref.bindMatrix) > 1e-5 || !m.geometry.index) return false;
    const q = new THREE.Matrix4().copy(refIBM[0]).invert().multiply(m.skeleton.boneInverses[0]);
    for (let k = 0; k < refIBM.length; k++) { tmp.copy(refIBM[k]).multiply(q); if (maxDiff(tmp, m.skeleton.boneInverses[k]) > 2e-3) return false; }
    Qs.push(q);
  }
  // order by material so each material is one contiguous index range (one draw call)
  const mats = [];
  for (const m of parts) if (!mats.includes(m.material)) mats.push(m.material);
  const order = parts.map((m, i) => ({ m, q: Qs[i], mi: mats.indexOf(m.material) })).sort((a, b) => a.mi - b.mi);
  let nv = 0, ni = 0;
  for (const { m } of order) { nv += m.geometry.attributes.position.count; ni += m.geometry.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), sIdx = new Uint8Array(nv * 4), sW = new Float32Array(nv * 4);
  const idx = nv < 65535 ? new Uint16Array(ni) : new Uint32Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  const groups = [];
  for (const { m, q, mi } of order) {
    const g = m.geometry, p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    nm.getNormalMatrix(q);
    const start = io;
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(q); pos.set([v.x, v.y, v.z], (vo + i) * 3);
      v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
      if (t) uv.set([t.getX(i), t.getY(i)], (vo + i) * 2);
      sIdx.set([si.getX(i), si.getY(i), si.getZ(i), si.getW(i)], (vo + i) * 4);
      sW.set([sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], (vo + i) * 4);
    }
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
    io += g.index.count; vo += p.count;
    const last = groups[groups.length - 1];
    if (last && last.materialIndex === mi) last.count += io - start; else groups.push({ start, count: io - start, materialIndex: mi });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(sIdx, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sW, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  for (const gr of groups) geo.addGroup(gr.start, gr.count, gr.materialIndex);
  geo.computeBoundingSphere();
  const merged = new THREE.SkinnedMesh(geo, mats.length === 1 ? mats[0] : mats);
  merged.name = 'body'; merged.frustumCulled = false;
  const parent = ref.parent;
  for (const m of parts) m.removeFromParent();
  parent.add(merged);
  merged.bind(ref.skeleton, new THREE.Matrix4());
  return true;
}

// ───────────────────────── atlas recolour
const RGB2HSL = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
};
const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
const HSL2RGB = (h, s, l) => { h = ((h % 360) + 360) % 360 / 360; if (s === 0) return [l, l, l]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]; };

/**
 * Recolour an atlas image. The KayKit atlas is an 8×4 grid of vertical gradient swatches, so every operation works per swatch
 * ("col,row") and keeps the gradient (light → dark) intact:
 *   "2,2": "#6a4fa8"                         → colourise the swatch to that hue/saturation, keeping its relative lightness
 *   "2,2": { hue: -40, sat: 1.1, light: .9 }  → shift
 *   ranges: [{ from: 190, to: 270, dh: 150, s: 1, l: 1 }]  → shift every pixel (any swatch) whose hue is in [from,to]
 */
function recolorAtlas(img, palette) {
  const W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H), px = data.data;
  const tw = W / 8, th = H / 4;
  const ranges = palette.ranges ?? [];
  let tileOps = Object.entries(palette).filter(([k]) => /^\d,\d$/.test(k));
  if (palette['*']) { const all = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) all.push([`${c},${r}`, palette['*']]); tileOps = all; }
  const tmp = new THREE.Color();
  // per-tile mean lightness (for colourise)
  const meanL = {};
  for (const [k] of tileOps) {
    const [tc, tr] = k.split(',').map(Number); let sum = 0, n = 0;
    for (let y = tr * th; y < (tr + 1) * th; y += 4) for (let x = tc * tw; x < (tc + 1) * tw; x += 4) { const i = (y * W + x) * 4; sum += RGB2HSL(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255)[2]; n++; }
    meanL[k] = sum / Math.max(1, n);
  }
  for (const [k, op] of tileOps) {
    const [tc, tr] = k.split(',').map(Number);
    let tgt = null; if (typeof op === 'string') { tmp.set(op); const hsl = {}; tmp.getHSL(hsl, THREE.SRGBColorSpace); tgt = { h: hsl.h * 360, s: hsl.s, l: hsl.l }; }
    for (let y = tr * th; y < (tr + 1) * th; y++) for (let x = tc * tw; x < (tc + 1) * tw; x++) {
      const i = (y * W + x) * 4;
      // THREE.Color.set() works in linear space; the atlas is sRGB, so convert the target through sRGB first
      const [h, s, l] = RGB2HSL(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
      let nh, ns, nl;
      if (tgt) { nh = tgt.h; ns = Math.min(1, tgt.s * (0.65 + 0.7 * s)); nl = Math.min(0.98, Math.max(0.02, l * (tgt.l / Math.max(0.05, meanL[k])))); }
      else { nh = h + (op.hue ?? 0); ns = Math.min(1, s * (op.sat ?? 1)); nl = Math.min(0.98, l * (op.light ?? 1)); }
      const [r, g, b] = HSL2RGB(nh, ns, nl);
      px[i] = r * 255; px[i + 1] = g * 255; px[i + 2] = b * 255;
    }
  }
  if (ranges.length) {
    for (let i = 0; i < px.length; i += 4) {
      const [h, s, l] = RGB2HSL(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
      if (s < 0.12) continue;
      for (const r of ranges) {
        if (h >= r.from && h <= r.to) { const [rr, gg, bb] = HSL2RGB(h + (r.dh ?? 0), Math.min(1, s * (r.s ?? 1)), Math.min(0.98, l * (r.l ?? 1))); px[i] = rr * 255; px[i + 1] = gg * 255; px[i + 2] = bb * 255; break; }
      }
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/** emissive map: black everywhere except the given swatches, which keep their gradient shape tinted by the colour */
function emissiveAtlas(img, tiles) {
  const W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const tw = W / 8, th = H / 4;
  for (const [k, hex] of Object.entries(tiles)) {
    const [tc, tr] = k.split(',').map(Number);
    ctx.fillStyle = hex; ctx.fillRect(tc * tw, tr * th, tw, th);
  }
  return c;
}

/** shared shader patch: fresnel rim light with per-material uniforms (characters never dither-fade: they are what the player must always see) */
function patchMaterial(m) {
  const U = { uRimColor: { value: new THREE.Color('#ffffff') }, uRimK: { value: 0 }, uRimPow: { value: 2.6 } };
  m.userData.rim = U;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimK; uniform float uRimPow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 { float rimF = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), uRimPow); totalEmissiveRadiance += uRimColor * (rimF * uRimK); }`);
  };
  m.customProgramCacheKey = () => 'rig-rim-1';
}

const ghostMat = new THREE.MeshStandardMaterial({ color: '#7fe3ff', emissive: '#7fe3ff', emissiveIntensity: 1.0, transparent: true, opacity: 0.45, depthWrite: false });
ghostMat.userData.shared = true;

export class CharFactory {
  /** @param {import('./assets.js').Assets} assets */
  constructor(assets) {
    this.assets = assets;
    this.variants = new Map();     // `${char}|${hide}` → template root (merged skinned parts)
    this.atlases = new Map();      // recipe → texture
    this.failedChars = new Set();
  }

  get ready() { return !!this.assets?.ready; }

  #variant(charId, hide) {
    const key = `${charId}|${[...hide].sort().join(',')}`;
    let v = this.variants.get(key);
    if (v) return v;
    const t = this.assets.templates.get(`chars/${charId}`);
    if (!t || typeof t.then === 'function') return null;
    const root = SkeletonUtils.clone(t.scene);
    let merged = false;
    try { merged = mergeSkinned(root, hide); } catch (e) { log.warn(`skinned merge failed for ${charId}`, e); }
    if (!merged) { // keep the original parts, just honour `hide`
      root.traverse((o) => { if (o.isSkinnedMesh && hide.has(o.name)) o.visible = false; });
    }
    v = { root, merged };
    this.variants.set(key, v);
    return v;
  }

  #texture(charId, palette, emissive) {
    const key = `${charId}|${JSON.stringify(palette ?? {})}|${JSON.stringify(emissive ?? {})}`;
    if (this.atlases.has(key)) return this.atlases.get(key);
    const t = this.assets.templates.get(`chars/${charId}`);
    let src = null; t.scene.traverse((o) => { if (!src && o.isMesh && o.material?.map) src = o.material.map; });
    const out = { map: null, emissiveMap: null };
    if (src?.image) {
      const mk = (canvas, srgb) => { const tex = new THREE.CanvasTexture(canvas); tex.flipY = false; tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; tex.wrapS = src.wrapS; tex.wrapT = src.wrapT; tex.anisotropy = src.anisotropy; tex.channel = src.channel; tex.needsUpdate = true; return tex; };
      if (palette && Object.keys(palette).length) out.map = mk(recolorAtlas(src.image, palette), true);
      if (emissive && Object.keys(emissive).length) out.emissiveMap = mk(emissiveAtlas(src.image, emissive), true);
    }
    this.atlases.set(key, out);
    return out;
  }

  /** @returns {object|null} model: { root, kind:'rig', rig:'glb', rigObj, anim, meshes, height, tick, flash, ghost, setRim, bone } */
  build(spec, { uid = 0 } = {}) {
    const g = spec.glb;
    if (!g || !this.ready || this.failedChars.has(g.char)) return null;
    const hideSkinned = new Set(g.hide ?? []);
    const variant = this.#variant(g.char, hideSkinned);
    if (!variant) { this.failedChars.add(g.char); return null; }
    const scale = g.scale ?? 1;
    const root = SkeletonUtils.clone(variant.root);
    const wrap = new THREE.Group(); wrap.add(root); wrap.scale.setScalar(scale);
    const rig = new CharacterRig(g.char, wrap, this.assets.anims, { height: NOM_HEIGHT * scale });
    rig.equip(g.equip ?? []);
    for (const n of g.hide ?? []) { const o = rig.root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)); if (o) o.visible = false; }

    // materials: atlas recolour / emissive map / tint / eye glow / shader patch
    const atlas = this.#texture(g.char, g.palette, g.emissiveTiles);
    const tint = g.tint ? new THREE.Color(g.tint) : null;
    for (const m of rig.materials) {
      patchMaterial(m);
      const isGlow = m.name === 'Glow';
      if (isGlow) {
        const e = g.eyes ?? {};
        m.color.set('#000000'); m.emissive.set(e.color ?? '#7fe3ff'); m.emissiveIntensity = e.intensity ?? 2.2; m.metalness = 0; m.roughness = 1;
        m.userData.base = { color: m.color.clone(), emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity };
        continue;
      }
      if (atlas.map && m.map) m.map = atlas.map;
      if (atlas.emissiveMap) { m.emissiveMap = atlas.emissiveMap; m.emissive.set('#ffffff'); m.emissiveIntensity = g.emissiveIntensity ?? 1.0; }
      if (tint) m.color.multiply(tint);
      m.color.multiplyScalar(g.exposure ?? 0.84);          // the scene is lit hard (sun 3.2 + hemi 1.55): keep near-white swatches (bone) from clipping
      m.roughness = g.roughness ?? 0.78;
      m.userData.base = { color: m.color.clone(), emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity };
      m.needsUpdate = true;
    }
    if (g.ghost) {   // spectral look: translucent, self-lit (echoes, decoys)
      for (const m of rig.materials) {
        if (m.name === 'Glow') continue;
        m.transparent = true; m.opacity = g.ghost.opacity ?? 0.6; m.depthWrite = false;
        m.emissive.set(g.ghost.color ?? '#7fe3ff'); m.emissiveIntensity = g.ghost.glow ?? 0.8; if (m.emissiveMap) m.emissiveMap = null;
        m.userData.base = { color: m.color.clone(), emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity };
        m.needsUpdate = true;
      }
    }
    const rim = g.rim ?? {};
    for (const m of rig.materials) if (m.userData.rim) { m.userData.rim.uRimColor.value.set(rim.color ?? '#9fe8ff'); m.userData.rim.uRimPow.value = rim.pow ?? 2.6; m.userData.rim.uRimK.value = rim.k ?? 0; m.userData.rimBase = rim.k ?? 0; }

    // attachments: external kit props + procedural props
    const tickers = [];
    for (const x of g.external ?? []) {
      const p = this.assets.prop(x.group, x.id); if (!p) { log.warn(`missing prop ${x.group}/${x.id}`); continue; }
      rig.attach(x.bone, p, { position: x.pos ?? null, rotation: x.rot ?? null, scale: x.scale ?? 1 });
    }
    for (const x of g.props ?? []) {
      const built = buildProp(x.kind, x);
      if (!built) { log.warn(`unknown prop ${x.kind}`); continue; }
      rig.attach(x.bone, built.obj, { position: x.pos ?? null, rotation: x.rot ?? null, scale: built.obj.scale.x });
      if (built.tick) tickers.push(built.tick);
    }
    // soft ambient accents (head glow etc.) could be added here in future

    const prof = {
      style: g.style ?? '1h', scale, walk: g.walk ?? 'Walking_A', run: g.run ?? 'Running_B', runAt: g.runAt, idle: g.idle ?? ['Idle'], combatIdle: g.combatIdle ?? 'Idle_Combat',
      variants: g.variants ?? ['Idle_B'], skeleton: !!g.skeleton, noBlock: !!g.noBlock, death: g.death, noCombatIdle: !!g.noCombatIdle,
    };
    const anim = new CharAnimator(rig, prof);
    const meshes = [];
    rig.root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const mm of meshes) { mm.userData.mat0 = mm.material; }
    const model = {
      kind: 'rig', rig: 'glb', spec, root: rig.root, rigObj: rig, anim, meshes, height: NOM_HEIGHT * scale, s: scale, tickers, uid,
      hover: g.hover ?? 0, seed: uid * 0.37,
      tick(st, dt) { for (const f of tickers) f(st.t, dt, st); anim.update(st, dt); },
      flash(seconds = 0.12, color = '#ffffff') { rig.flash(color, seconds); },
      ghost(on) { for (const mm of meshes) mm.material = on ? ghostMat : mm.userData.mat0; },
      setRim(color, k) { for (const m of rig.materials) { const U = m.userData.rim; if (!U) continue; if (color) U.uRimColor.value.set(color); U.uRimK.value = k; } },
      resetRim() { const rm = g.rim ?? {}; for (const m of rig.materials) { const U = m.userData.rim; if (!U) continue; U.uRimColor.value.set(rm.color ?? '#9fe8ff'); U.uRimK.value = rm.k ?? 0; } },
      bone(name) { return rig.bones.get(THREE.PropertyBinding.sanitizeNodeName(name)) ?? null; },
      dispose() { anim.dispose(); rig.dispose(); },
    };
    return model;
  }
}
