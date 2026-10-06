/**
 * World materials: everything that draws the overworld goes through here so lighting, fog, wind, occlusion fade, cloud shadows
 * and the "painted" look stay consistent.
 *
 *  - palette atlas      a canvas of gradient swatches (light top → dark bottom) in the same spirit as the KayKit atlases;
 *                       procedural meshes (paint.js) pick a swatch per part and the gradient gives free AO-like shading.
 *  - paintMaterial()    palette atlas + analytic surface patterns (stone courses, roof tiles, planks, plaster) driven by the
 *                       per-vertex `aPat`/`aSurf` attributes written by paint.js — crisp at any distance, no textures.
 *  - kitMaterial()      KayKit atlas (or vertex-coloured procedural foliage) with optional wind sway, ground contact AO.
 *  - glowMaterial()     emissive HDR surfaces (windows, lanterns, resonance glyphs) that follow the atmosphere's glow level.
 */
import * as THREE from 'three';
import { applyOcclusionFade } from './kit.js';
import { WORLD, WORLD_GLSL, bindWorldUniforms } from './atmosphere.js';

// ───────────────────────────────────────────────────────── palette atlas
/** [name, top colour, bottom colour] — sRGB; the gradient runs top → bottom across a part's height */
export const PALETTE = [
  ['limestone', '#e9dcbf', '#a3967a'], ['limestoneLight', '#f3e9d0', '#bfb293'], ['limestoneDark', '#bcb094', '#756a58'], ['limestoneCool', '#d6d3c6', '#8a8a86'],
  ['plaster', '#eadfc6', '#b5a688'], ['plasterWarm', '#e6c89c', '#a8845a'], ['plasterRose', '#dcb09a', '#9a6a5a'], ['plasterBlue', '#b8c6cf', '#6f8190'],
  ['slate', '#7a8798', '#3b4350'], ['slateTeal', '#58969a', '#27474f'], ['terracotta', '#d98a5c', '#80402c'], ['thatch', '#d2b565', '#7d6230'],
  ['wood', '#a4764c', '#5b3b26'], ['woodDark', '#6f4e36', '#33241a'], ['woodLight', '#c9a06e', '#8c6743'], ['woodRed', '#9a5a44', '#552a20'],
  ['iron', '#646a73', '#23262b'], ['ironLight', '#9099a3', '#474d56'], ['brass', '#f0c068', '#8c6024'], ['bronze', '#c88a44', '#5c3a1b'],
  ['moss', '#86a65a', '#3c5c36'], ['leaf', '#78ae60', '#2e5c3c'], ['leafDark', '#4f8450', '#1f4634'], ['leafTeal', '#4f9a82', '#1f5048'],
  ['clothRed', '#d0583f', '#702a24'], ['clothCream', '#f2e6ca', '#bcac8a'], ['clothBlue', '#5a7cb4', '#2b3c6a'], ['clothTeal', '#46a6a2', '#205c60'],
  ['clothPurple', '#8a64ae', '#432d62'], ['clothGold', '#e6b54e', '#9a6a22'], ['rope', '#dcc590', '#917849'], ['soot', '#463e38', '#15110e'],
  ['bone', '#f2ead8', '#bbb098'], ['rock', '#b2a68e', '#6c6250'], ['rockViolet', '#a29ab0', '#5b556c'], ['rockWarm', '#c4a888', '#74583f'],
  ['glassCyan', '#cffaff', '#5cc4e6'], ['glowWarm', '#fff2c8', '#ffb050'], ['ember', '#ffc050', '#e5481a'], ['white', '#ffffff', '#c9c9c9'],
  ['water', '#8fd0e0', '#3f7f9a'], ['earth', '#a08462', '#5e4932'], ['grassBase', '#7fa856', '#3f6a3a'], ['void', '#2a2438', '#0e0b16'],
];
const PAL_COLS = 16, PAL_ROWS = 8;
const palIndex = new Map(PALETTE.map((p, i) => [p[0], i]));
export const palette = (name) => { const i = palIndex.get(name); if (i === undefined) throw new Error(`palette: unknown swatch ${name}`); return i; };
/** UV for a swatch at gradient position t (0 = light top, 1 = dark bottom) */
export function paletteUV(index, t, out = [0, 0]) {
  const c = index % PAL_COLS, r = Math.floor(index / PAL_COLS);
  out[0] = (c + 0.5) / PAL_COLS; out[1] = (r + 0.06 + Math.min(1, Math.max(0, t)) * 0.88) / PAL_ROWS;
  return out;
}

let atlasTex = null;
export function getPaletteAtlas() {
  if (atlasTex) return atlasTex;
  const W = 512, H = 512, cw = W / PAL_COLS, ch = H / PAL_ROWS;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  PALETTE.forEach(([, top, bot], i) => {
    const c = i % PAL_COLS, r = Math.floor(i / PAL_COLS);
    const gr = g.createLinearGradient(0, r * ch, 0, (r + 1) * ch);
    gr.addColorStop(0.04, top); gr.addColorStop(0.96, bot);
    g.fillStyle = gr; g.fillRect(c * cw, r * ch, cw, ch);
  });
  atlasTex = new THREE.CanvasTexture(cv);
  atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.flipY = false; atlasTex.anisotropy = 4;
  atlasTex.minFilter = THREE.LinearMipmapLinearFilter; atlasTex.generateMipmaps = true;
  atlasTex.userData = { shared: true };
  return atlasTex;
}

// ───────────────────────────────────────────────────────── shader patches
const PAT_GLSL = `
varying vec2 vSurf; varying float vPat;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// returns albedo multiplier in .rgb and a bump-ish edge term in .a
vec4 surfacePattern(float pat, vec2 s, vec3 wp){
  vec4 r = vec4(1.0, 1.0, 1.0, 0.0);
  float fw = max(fwidth(s.x), fwidth(s.y)) * 1.5 + 1e-4;
  if (pat < 0.5) return r;
  if (pat < 1.5) {                                   // limestone block courses
    float H = 0.46; float row = floor(s.y / H); float off = mod(row, 2.0) * 0.5;
    float W = 0.9 + hsh(vec2(row, 3.0)) * 0.5;
    float u = s.x / W + off + hsh(vec2(row, 7.0));
    float col = floor(u); float fu = fract(u), fv = fract(s.y / H);
    float jx = min(fu, 1.0 - fu) * W, jy = min(fv, 1.0 - fv) * H;
    float j = min(jx, jy);
    float mortar = 1.0 - smoothstep(0.012, 0.012 + fw + 0.02, j);
    float v = hsh(vec2(col, row));
    vec3 tint = vec3(0.9 + 0.2 * v, 0.9 + 0.17 * v, 0.88 + 0.15 * v);
    float topEdge = smoothstep(0.0, 0.07, fv) * (1.0 - smoothstep(0.86, 1.0, fv));
    r.rgb = mix(tint * (0.94 + 0.12 * topEdge), vec3(0.55, 0.52, 0.47), mortar * 0.85);
    r.a = mortar;
  } else if (pat < 2.5) {                            // roof tiles (scalloped rows)
    float H = 0.36; float row = floor(s.y / H); float fv = fract(s.y / H);
    float W = 0.46; float u = s.x / W + mod(row, 2.0) * 0.5; float col = floor(u); float fu = fract(u);
    float scallop = 1.0 - smoothstep(0.0, 0.16, fv - 0.18 * pow(abs(fu - 0.5) * 2.0, 2.0));
    float v = hsh(vec2(col, row));
    float shade = 0.80 + 0.30 * fv;
    r.rgb = vec3((0.92 + 0.16 * v) * shade) * mix(vec3(1.0), vec3(0.62, 0.58, 0.58), scallop * 0.7);
    r.a = scallop;
  } else if (pat < 3.5) {                            // planks (vertical boards)
    float W = 0.32; float col = floor(s.x / W); float fu = fract(s.x / W);
    float gap = 1.0 - smoothstep(0.0, 0.05 + fw / W, min(fu, 1.0 - fu));
    float v = hsh(vec2(col, 1.0));
    float grain = 0.5 + 0.5 * sin(s.y * 9.0 + v * 40.0 + sin(s.x * 23.0) * 1.6);
    r.rgb = mix(vec3(0.86 + 0.24 * v) * (0.93 + 0.1 * grain), vec3(0.4), gap * 0.9);
    r.a = gap;
  } else if (pat < 4.5) {                            // plaster: patchy, speckled
    float a = hsh(floor(s * 6.0)); float b = hsh(floor(s * 23.0) + 5.0);
    r.rgb = vec3(0.94 + 0.08 * a + 0.05 * b);
    r.rgb *= 1.0 - 0.1 * smoothstep(0.82, 1.0, hsh(floor(s * 2.5) + 9.0));
  } else if (pat < 5.5) {                            // thatch: long streaks down the slope
    float c = hsh(vec2(floor(s.x * 9.0), 1.0)); float st = 0.5 + 0.5 * sin(s.y * 5.0 + c * 30.0);
    r.rgb = vec3(0.84 + 0.2 * c + 0.1 * st);
  } else {                                           // rough rock face
    float a = hsh(floor(s * 3.0)); float b = hsh(floor(s * 11.0) + 3.0);
    r.rgb = vec3(0.88 + 0.12 * a + 0.1 * b);
  }
  return r;
}`;

/**
 * Common world patches. Options (all baked into the program key):
 *  fade  dithered occlusion fade     wind  vertex sway (world space)     pat  analytic surface patterns (aPat/aSurf)
 *  ao    contact darkening near local y=0     detail  subtle world-space noise on the albedo     cloud  drifting cloud shadows
 */
export function patchWorldMaterial(material, o = {}) {
  const O = { fade: true, wind: false, windFlip: false, pat: false, ao: true, detail: 0.1, cloud: true, ...o };
  if (O.fade) applyOcclusionFade(material);
  const prev = O.fade ? material.onBeforeCompile : null;
  const U = { uSwayInv: { value: O.swayInv ?? 0.2 }, uSwayAmt: { value: O.swayAmt ?? 1 }, uAOK: { value: O.aoK ?? 0.6 }, uAOH: { value: O.aoH ?? 1.6 }, uDetail: { value: O.detail } };
  material.userData.U = U;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    bindWorldUniforms(shader);
    Object.assign(shader.uniforms, U);
    let vs = shader.vertexShader, fs = shader.fragmentShader;
    vs = vs.replace('#include <common>', `#include <common>
varying vec3 vWPk; varying float vLY;
uniform float uSwayInv, uSwayAmt;
${WORLD_GLSL.vert}
${O.pat ? 'attribute float aPat; attribute vec2 aSurf; varying vec2 vSurf; varying float vPat;' : ''}`);
    vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
vLY = transformed.y;
${O.pat ? 'vSurf = aSurf; vPat = aPat;' : ''}`);
    vs = vs.replace('#include <project_vertex>', `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 wpos4 = modelMatrix * mvPosition;
${O.wind ? `{ float hh = ${O.windFlip ? 'clamp(1.0 - transformed.y * uSwayInv, 0.0, 1.4)' : 'clamp(transformed.y * uSwayInv, 0.0, 1.4)'}; float ph = wpos4.x * 0.37 + wpos4.z * 0.23; wpos4.xyz += windOffset(wpos4.xyz, ${O.windFlip ? 'hh' : 'hh * hh'}, ph) * uSwayAmt; }` : ''}
vWPk = wpos4.xyz;
mvPosition = viewMatrix * wpos4;
gl_Position = projectionMatrix * mvPosition;`);
    fs = fs.replace('#include <common>', `#include <common>
varying vec3 vWPk; varying float vLY;
uniform float uAOK, uAOH, uDetail;
${WORLD_GLSL.frag}
${O.pat ? PAT_GLSL : ''}`);
    fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
${O.pat ? `{ vec4 sp = surfacePattern(vPat, vSurf, vWPk); diffuseColor.rgb *= sp.rgb; }` : ''}
${O.ao ? 'diffuseColor.rgb *= mix(uAOK, 1.0, smoothstep(0.0, uAOH, vLY));' : ''}
${O.detail > 0 ? 'diffuseColor.rgb *= 1.0 - uDetail + uDetail * 2.0 * texture2D(uNoise, vWPk.xz * 0.37 + vWPk.y * vec2(0.11, 0.17)).b;' : ''}`);
    if (O.cloud) fs = fs.replace('#include <opaque_fragment>', 'outgoingLight *= cloudShade(vWPk);\n#include <opaque_fragment>');
    shader.vertexShader = vs; shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => `wm|${O.fade ? 1 : 0}${O.wind ? 1 : 0}${O.windFlip ? 1 : 0}${O.pat ? 1 : 0}${O.ao ? 1 : 0}${O.detail > 0 ? 1 : 0}${O.cloud ? 1 : 0}`;
  return material;
}

const cache = new Map();
/** painted procedural surfaces: palette atlas (+ optional patterns) */
export function paintMaterial(o = {}) {
  const key = `paint|${o.pat === false ? 0 : 1}|${o.fade === false ? 0 : 1}|${o.rough ?? 0.84}|${o.side ?? 0}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: getPaletteAtlas(), roughness: o.rough ?? 0.84, metalness: 0, side: o.side ?? THREE.FrontSide });
    patchWorldMaterial(m, { pat: o.pat !== false, fade: o.fade !== false, ao: true, aoK: 0.7, aoH: 1.3, detail: 0.07 });
    m.userData.shared = true; cache.set(key, m);
  }
  return m;
}

/** KayKit atlas / vertex-coloured foliage. `wind` = sway height scale (1 / tallest point in metres) */
export function kitMaterial(o = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: o.map ?? null, vertexColors: !!o.vertexColors, roughness: o.rough ?? 0.78, metalness: 0, side: o.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: !!o.flat,
  });
  if (o.color) m.color.set(o.color);
  patchWorldMaterial(m, { fade: o.fade !== false, wind: !!o.wind, windFlip: !!o.windFlip, swayInv: o.wind ? 1 / (o.swayHeight ?? 6) : 0.2, swayAmt: o.swayAmt ?? 1, ao: o.ao !== false, aoK: o.aoK ?? 0.58, aoH: o.aoH ?? 1.6, detail: o.detail ?? 0.1, cloud: true });
  m.userData.shared = true;
  return m;
}

const glowMats = new Set();
/** emissive HDR material; `base` is its intensity at glow = 1 */
export function glowMaterial(color, base = 2.5, o = {}) {
  const key = `glow|${color}|${base}|${o.opacity ?? 1}|${o.fade === false ? 0 : 1}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: o.body ?? '#201a14', emissive: color, emissiveIntensity: base, roughness: 0.6, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
    if (o.fade !== false) applyOcclusionFade(m);
    m.userData.shared = true; m.userData.glowBase = base; m.userData.glowK = o.glowK ?? 1;
    cache.set(key, m); glowMats.add(m);
  }
  return m;
}
/** emissive version of the palette atlas: every swatch glows in its own colour (windows, flames, resonance glyphs) */
export function glowPaintMaterial(base = 2.2, o = {}) {
  const key = `glowpaint|${base}|${o.opacity ?? 1}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: '#2a2622', map: getPaletteAtlas(), emissive: '#ffffff', emissiveMap: getPaletteAtlas(), emissiveIntensity: base, roughness: 0.5, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
    m.userData.shared = true; m.userData.glowBase = base; m.userData.glowK = o.glowK ?? 1;
    cache.set(key, m); glowMats.add(m);
  }
  return m;
}
/** per-frame: emissive materials brighten with the atmosphere's glow (dusk/night) */
export function updateGlow(glow = WORLD.uGlow.value) { for (const m of glowMats) m.emissiveIntensity = m.userData.glowBase * (0.55 + 0.45 * glow * m.userData.glowK); }
export function disposeWorldMaterials() { /* shared by design: kept alive across zone reloads */ }
export { WORLD };
