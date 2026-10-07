// props.js — pintura horneada, materiales y acentos de luz para props/vegetación (frente «props y decorado»).
//
// Portado/adaptado de SUNDERCHOIR (foliage.js, stylekit.js, worldMaterials.js, mergeStatic.js) a three r160:
//   · todo el carácter va en COLOR DE VÉRTICE (AO de base, degradado de copa, estratos de roca, musgo): sin texturas nuevas
//   · un atributo `aMat` por vértice (rugosidad, metalicidad, peso de «capa superior») deja mezclar metal, cristal y mate
//     en UNA sola malla fusionada: más material sin más llamadas de dibujo
//   · parches de shader mínimos y baratos: luz de borde (fresnel con el cielo), reflejo falso de entorno para metal/cristal,
//     capa superior por bioma (musgo, arena, nieve, ceniza) y ventanas que se encienden de noche
//   · acentos instanciados: sombra de contacto, charco de luz en el suelo y halo de las luces artificiales
import {
  AdditiveBlending, CanvasTexture, Color, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, Matrix4,
  MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3,
} from 'three';

// ───────────────────────────────────────────────────────────── utilidades numéricas
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = (v) => v - Math.floor(v);
export const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
/** ruido de valor suave 0..1 (sin tablas: barato y determinista) */
export function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), u), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), u), v);
}

// ───────────────────────────────────────────────────────────── estado compartido por fotograma
/** `source()` la define el juego: devuelve { night, dark, quality }. Las luces artificiales mandan con la noche o en interiores. */
export const propFx = {
  time: { value: 0 },      // se enlaza al uTime del viento del juego
  uGlow: { value: 0 },     // 0 día … 1 noche/interior
  quality: 'high',
  source: null,
  tick() {
    const s = this.source && this.source();
    if (!s) return;
    this.uGlow.value = clamp01(Math.max(s.night, s.dark));
    this.quality = s.quality;
  },
};

// ───────────────────────────────────────────────────────────── pintura de vértices
const _c = new Color(), _c2 = new Color(), _m = new Color();

/**
 * Hornea `color` (lineal) y `aMat` (rugosidad, metalicidad, peso de capa superior) en una geometría NO indexada con normales.
 * base: color hex (sRGB). Opciones (todas opcionales):
 *   grad [hex, y0, y1]  degradado absoluto hacia otro color entre dos alturas (espacio del prop)
 *   ao, aoH             oscurecimiento de base (0..1) y altura (espacio del prop) en que se disipa
 *   sky                 luz de cielo horneada: caras que miran abajo más oscuras (0..0.5)
 *   tg                  degradado propio de la pieza: base oscura → punta clara
 *   tgPow               curva del degradado (>1 concentra el brillo en la punta)
 *   vary, seed          variación de brillo por triángulo
 *   strata, strataF     estratos de roca (amplitud, frecuencia por unidad de y)
 *   moss [hex, amt]     musgo/tinte en caras que miran arriba, con ruido
 *   speck               moteado fino (suciedad/óxido)
 *   rough, metal        material de la pieza   ·   tc: peso de la capa superior (musgo/arena/nieve del bioma) en caras altas
 *   shade               multiplicador global
 */
export function paintVertices(geo, base, o = {}) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count;
  geo.computeBoundingBox();
  const bb = geo.boundingBox, y0 = bb.min.y, span = Math.max(1e-4, bb.max.y - bb.min.y);
  _c.setHex(base);
  const gradCol = o.grad ? _c2.setHex(o.grad[0]) : null;
  const mossCol = o.moss ? new Color(o.moss[0]) : null;
  const col = new Float32Array(n * 3), mat = new Float32Array(n * 3);
  const ao = o.ao ?? 0.4, aoH = Math.max(0.05, o.aoH ?? 0.5), sky = o.sky ?? 0.22, tg = o.tg ?? 0.14, tgPow = o.tgPow ?? 1;
  const seed = (o.seed || 1) * 12.9898;
  const rough = o.rough ?? 0.82, metal = o.metal ?? 0.04, tc = o.tc ?? 0, shade = o.shade ?? 1;
  let triK = 1;
  for (let v = 0; v < n; v++) {
    if (v % 3 === 0) triK = o.vary ? 1 + (hash2(v * 0.37 + seed, seed * 3.1) - 0.5) * o.vary : 1;
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), ny = nor ? nor.getY(v) : 0;
    let r = _c.r, g = _c.g, b = _c.b;
    if (gradCol) {
      const t = clamp01((y - o.grad[1]) / ((o.grad[2] - o.grad[1]) || 1));
      r = lerp(r, gradCol.r, t); g = lerp(g, gradCol.g, t); b = lerp(b, gradCol.b, t);
    }
    const wn = vnoise(x * 2.3 + seed, z * 2.3 + y * 1.7);
    if (mossCol) {
      const w = sstep(0.55, 0.9, ny) * clamp01((wn - 0.25) * 2.2) * o.moss[1];
      r = lerp(r, mossCol.r, w); g = lerp(g, mossCol.g, w); b = lerp(b, mossCol.b, w);
    }
    let f = shade * triK;
    f *= 1 - sky + sky * 2 * (ny * 0.5 + 0.5);                      // cielo: abajo más oscuro, arriba más claro (promedio 1)
    f *= 1 + tg * (Math.pow(clamp01((y - y0) / span), tgPow) - 0.5) * 2; // degradado de la pieza (base oscura, punta clara)
    if (ao > 0) f *= lerp(1 - ao, 1, sstep(0, aoH, y));              // AO de base: pie del prop contra el suelo
    if (o.strata) f *= 1 + o.strata * (Math.sin((y + wn * 0.35) * (o.strataF ?? 9)) * 0.5 + (wn - 0.5) * 0.6);
    if (o.speck) f *= 1 - o.speck * clamp01((vnoise(x * 9 + seed, z * 9 + y * 7) - 0.55) * 3);
    col[v * 3] = r * f; col[v * 3 + 1] = g * f; col[v * 3 + 2] = b * f;
    mat[v * 3] = rough; mat[v * 3 + 1] = metal;
    mat[v * 3 + 2] = tc ? sstep(0.45, 0.85, ny) * lerp(0.45, 1, wn) * tc : 0;
  }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.setAttribute('aMat', new Float32BufferAttribute(mat, 3));
  return geo;
}

/**
 * Pinta un modelo GLB (atlas de textura) para el mundo: multiplica el atlas por AO/degradados y fija el material.
 * `h` es la altura del modelo en sus unidades; los parámetros relativos a altura (aoH) se dan como fracción de h.
 */
export function paintModelGeo(geo, name, h, seed = 1) {
  const s = modelStyle(name);
  const o = { ...s, aoH: (s.aoH ?? 0.25) * h, seed: seed, strataF: (s.strataF ?? 9) / Math.max(0.5, h) * 2 };
  // el atlas ya trae el color: la base es blanca (neutra); sólo se modula
  paintVertices(geo, 0xffffff, o);
  return geo;
}

/** estilo de pintura por nombre de modelo (clave: expresión regular) */
const MODEL_STYLES = [
  [/^N_(Oak|Willow)/, { ao: 0.5, aoH: 0.45, sky: 0.3, tg: 0.34, tgPow: 0.9, rough: 0.9, metal: 0, speck: 0.12, kind: 'leaf' }],
  [/^N_Pine/, { ao: 0.55, aoH: 0.4, sky: 0.3, tg: 0.38, tgPow: 1, rough: 0.9, metal: 0, kind: 'leaf' }],
  [/^N_Bush/, { ao: 0.5, aoH: 0.5, sky: 0.3, tg: 0.36, rough: 0.9, metal: 0, kind: 'leaf' }],
  [/^N_Dead/, { ao: 0.5, aoH: 0.35, sky: 0.2, tg: 0.18, rough: 0.95, metal: 0, speck: 0.15, kind: 'wood' }],
  [/^N_(Rock|Cliff)/, { ao: 0.6, aoH: 0.4, sky: 0.28, tg: 0.2, rough: 0.96, metal: 0, strata: 0.2, strataF: 6, tc: 1, speck: 0.1, kind: 'rock' }],
  [/^N_(Grass|Fern|Reeds)/, { ao: 0.62, aoH: 0.6, sky: 0.15, tg: 0.62, tgPow: 0.8, rough: 0.85, metal: 0, kind: 'grass' }],
  [/^N_Flower/, { ao: 0.55, aoH: 0.5, sky: 0.15, tg: 0.3, rough: 0.8, metal: 0, kind: 'grass' }],
  [/^N_Shroom/, { ao: 0.5, aoH: 0.4, sky: 0.15, tg: 0.3, rough: 0.7, metal: 0, kind: 'grass' }],
  [/^N_Cactus/, { ao: 0.5, aoH: 0.3, sky: 0.25, tg: 0.3, rough: 0.8, metal: 0, speck: 0.1, kind: 'leaf' }],
  [/^Tree_/, { ao: 0.45, aoH: 0.3, sky: 0.25, tg: 0.3, rough: 0.7, metal: 0, kind: 'leaf' }],
  [/^Rover/, { ao: 0.45, aoH: 0.22, sky: 0.22, tg: 0.1, rough: 0.46, metal: 0.38, speck: 0.18, env: 1, kind: 'metal' }],
  [/^Spaceship/, { ao: 0.4, aoH: 0.15, sky: 0.2, tg: 0.1, rough: 0.4, metal: 0.45, env: 1, kind: 'metal' }],
  [/^SolarPanel/, { ao: 0.4, aoH: 0.15, sky: 0.15, tg: 0.1, rough: 0.28, metal: 0.55, env: 1, kind: 'metal' }],
  [/^Pickup_Crate/, { ao: 0.5, aoH: 0.22, sky: 0.22, tg: 0.18, rough: 0.78, metal: 0.05, speck: 0.15, kind: 'prop' }],
  [/^Pickup_/, { ao: 0.5, aoH: 0.22, sky: 0.22, tg: 0.18, rough: 0.5, metal: 0.25, env: 1, kind: 'metal' }],
  [/^Roof_|^MetalSupport|^Connector/, { ao: 0.35, aoH: 0.12, sky: 0.2, tg: 0.1, rough: 0.5, metal: 0.4, env: 1, kind: 'metal' }],
  [/^(House|Base_|Building|Geodesic)/, { ao: 0.55, aoH: 0.22, sky: 0.22, tg: 0.16, rough: 0.7, metal: 0.08, speck: 0.16, win: 1, kind: 'building' }],
];
const DEFAULT_STYLE = { ao: 0.45, aoH: 0.25, sky: 0.22, tg: 0.14, rough: 0.8, metal: 0.05, kind: 'prop' };
export function modelStyle(name) {
  for (const [re, s] of MODEL_STYLES) if (re.test(name)) return s;
  return DEFAULT_STYLE;
}

// ───────────────────────────────────────────────────────────── parche de shader de props
/**
 * Parche encadenable de MeshStandardMaterial (se puede aplicar después del viento Ep). Requiere el atributo `aMat` en TODA geometría
 * que dibuje este material. Opciones: rim (luz de borde), env (reflejo falso de entorno), top (color de capa superior) + topAmt, win (ventanas).
 */
export function patchProp(mat, o = {}) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.call(mat) : '';
  const U = {
    uRim: { value: o.rim ?? 0 }, uEnv: { value: o.env ?? 0 }, uTopAmt: { value: o.topAmt ?? 0 },
    uTopCol: { value: new Color(o.top ?? 0xffffff) }, uWin: { value: o.win ?? 0 }, uGlow: propFx.uGlow,
  };
  mat.userData.fx = U;
  mat.onBeforeCompile = function (s, r) {
    prev && prev.call(this, s, r);
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aMat; varying vec3 vMat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vMat; uniform float uRim, uEnv, uTopAmt, uWin, uGlow; uniform vec3 uTopCol;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{ // capa superior del bioma (musgo, arena, nieve…): pesa en las caras que miran arriba, conserva el AO horneado
  float tw = clamp(vMat.z * uTopAmt, 0.0, 1.0);
  float lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(diffuseColor.rgb, uTopCol * (0.5 + 1.1 * lu), tw);
}
float gWin = 0.0;
if (uWin > 0.0) { gWin = smoothstep(0.02, 0.10, diffuseColor.b - diffuseColor.r) * smoothstep(0.03, 0.12, diffuseColor.g - diffuseColor.r) * step(0.12, diffuseColor.g); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vMat.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMat.y;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#if NUM_HEMI_LIGHTS > 0
{ // luz de borde: el cielo se cuela por los cantos (follaje a contraluz, cantos de metal)
  float fr = pow(1.0 - saturate(dot(normal, isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition))), 2.6);
  totalEmissiveRadiance += hemisphereLights[0].skyColor * diffuseColor.rgb * fr * uRim;
}
#endif
// ventanas: de día reflejan el cielo, de noche se encienden (cálidas)
totalEmissiveRadiance += gWin * uWin * (vec3(1.0, 0.78, 0.42) * (0.25 + 2.4 * uGlow) + vec3(0.05, 0.1, 0.14));`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_HEMI_LIGHTS > 0
if (uEnv > 0.0) { // entorno falso: cielo arriba, suelo abajo; da brillo a metal y pintura sin mapas de entorno
  vec3 rv = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  vec3 envC = mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, smoothstep(-0.25, 0.85, rv.y));
  float fre = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 4.0);
  reflectedLight.indirectSpecular += envC * material.specularColor * (1.0 - material.roughness) * uEnv * (0.5 + 1.2 * fre);
}
#endif`);
  };
  mat.customProgramCacheKey = () => prevKey + '|pfx';
  mat.needsUpdate = true;
  return mat;
}

/**
 * Versión ligera para materiales sueltos (de() del juego: armas, vehículos, cristal, agua): sólo reflejo falso de entorno y luz de
 * borde, sin atributo aMat. Sirve para que metal, cristal y superficies lisas brillen sin mapas de entorno.
 */
export function patchGloss(mat, o = {}) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.call(mat) : '';
  const U = { uEnv: { value: o.env ?? 1 }, uRim: { value: o.rim ?? 0 } };
  mat.onBeforeCompile = function (s, r) {
    prev && prev.call(this, s, r);
    Object.assign(s.uniforms, U);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uEnv, uRim;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#if NUM_HEMI_LIGHTS > 0
if (uRim > 0.0) {
  float fr = pow(1.0 - saturate(dot(normal, isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition))), 2.6);
  totalEmissiveRadiance += hemisphereLights[0].skyColor * diffuseColor.rgb * fr * uRim;
}
#endif`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_HEMI_LIGHTS > 0
{
  vec3 rv = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  vec3 envC = mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, smoothstep(-0.25, 0.85, rv.y));
  float fre = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 4.0);
  reflectedLight.indirectSpecular += envC * material.specularColor * (1.0 - material.roughness) * uEnv * (0.5 + 1.2 * fre);
}
#endif`);
  };
  mat.customProgramCacheKey = () => prevKey + '|gloss';
  mat.needsUpdate = true;
  return mat;
}

/** material emisivo HDR por vértice (farolas, cristales, pantallas, ojos de nido): sube con la noche y late con una fase por instancia */
const glowCache = new Map();
export function glowPropMaterial(base = 1.6, pulse = 0.08) {
  const key = base.toFixed(2) + '|' + pulse.toFixed(2);
  let m = glowCache.get(key);
  if (m) return m;
  m = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const U = { uBase: { value: base }, uPulse: { value: pulse }, uTime: propFx.time, uGlow: propFx.uGlow };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vPh;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
vPh = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 1.37;
#else
vPh = 0.0;
#endif`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPh; uniform float uBase, uPulse, uTime, uGlow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= uBase * (0.85 + 0.75 * uGlow) * (1.0 + uPulse * sin(uTime * 2.3 + vPh));`);
  };
  m.customProgramCacheKey = () => 'glowprop';
  m.userData.shared = true;
  glowCache.set(key, m);
  return m;
}

// ───────────────────────────────────────────────────────────── acentos: sombra de contacto, charco de luz, halo
function radialTexture(stops, size = 64) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [t, c] of stops) r.addColorStop(t, c);
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
let accents = null;
function accentKit() {
  if (accents) return accents;
  const blobTex = radialTexture([[0, 'rgba(6,8,14,0.72)'], [0.35, 'rgba(6,8,14,0.5)'], [0.7, 'rgba(6,8,14,0.14)'], [1, 'rgba(6,8,14,0)']]);
  const poolTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(255,255,255,0.6)'], [0.55, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
  const haloTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.1, 'rgba(255,255,255,0.8)'], [0.3, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
  const mk = (map, extra) => new MeshBasicMaterial({ map, transparent: true, depthWrite: false, ...extra });
  const floor = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  accents = {
    floor, wall: new PlaneGeometry(1, 1),
    blob: mk(blobTex, { opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    pool: mk(poolTex, { blending: AdditiveBlending, toneMapped: false, opacity: 0.1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    halo: mk(haloTex, { blending: AdditiveBlending, toneMapped: false, opacity: 0.4 }),
  };
  return accents;
}

const _M = new Matrix4(), _P = new Vector3(), _S = new Vector3(), _Q = new Quaternion(), _Cc = new Color();
function accentMesh(geo, mat, n, setup, order, update) {
  const m = new InstancedMesh(geo, mat, n);
  for (let i = 0; i < n; i++) setup(i, m);
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.computeBoundingSphere();
  m.castShadow = false; m.receiveShadow = false; m.renderOrder = order;
  m.userData.accent = true;
  m.onBeforeRender = update;
  return m;
}

/**
 * Crea (como mucho) tres mallas instanciadas por chunk: sombras de contacto, charcos de luz (suelo) y halos (billboard).
 *   blobs: [x, z, radio, y?]      pools: [x, z, radio, hexColor, intensidad, y?]      halos: [x, y, z, tamaño, hexColor, intensidad]
 * `facing`: cuaternión que orienta el halo hacia la cámara isométrica.
 */
export function buildAccents(group, { blobs = [], pools = [], halos = [] }, facing) {
  const A = accentKit();
  // Se trocea en celdas de CELL unidades: la malla de un chunk entero abarca todo el mapa y nunca se descartaría por el frustum
  // (miles de quads fuera de pantalla en cada fotograma); por celdas sólo se dibuja lo que se ve.
  const CELL = 22;
  const split = (list, xi, zi) => {
    const cells = new Map();
    for (const it of list) {
      const k = Math.floor(it[xi] / CELL) * 4096 + Math.floor(it[zi] / CELL);
      let c = cells.get(k);
      c || cells.set(k, (c = []));
      c.push(it);
    }
    return cells.values();
  };
  for (const blobsC of split(blobs, 0, 1)) {
    group.add(accentMesh(A.floor, A.blob, blobsC.length, (i, m) => {
      const b = blobsC[i], r = b[2] * 2.3;
      _P.set(b[0] + b[2] * 0.12, (b[3] || 0) + 0.035, b[1] + b[2] * 0.08); _S.set(r, 1, r * 0.92); _Q.identity();
      m.setMatrixAt(i, _M.compose(_P, _Q, _S));
    }, 1, () => { propFx.tick(); A.blob.opacity = propFx.quality === 'low' ? 1 : 0.78; }));
  }
  for (const poolsC of split(pools, 0, 1)) {
    group.add(accentMesh(A.floor, A.pool, poolsC.length, (i, m) => {
      const b = poolsC[i], r = b[2] * 2;
      _P.set(b[0], (b[5] || 0) + 0.05, b[1]); _S.set(r, 1, r); _Q.identity();
      m.setMatrixAt(i, _M.compose(_P, _Q, _S));
      m.setColorAt(i, _Cc.setHex(b[3]).multiplyScalar(b[4]));
    }, 2, () => { propFx.tick(); A.pool.opacity = 0.05 + 0.95 * propFx.uGlow.value; }));
  }
  for (const halosC of split(halos, 0, 2)) {
    group.add(accentMesh(A.wall, A.halo, halosC.length, (i, m) => {
      const b = halosC[i];
      _P.set(b[0], b[1], b[2]); _S.set(b[3], b[3], 1);
      m.setMatrixAt(i, _M.compose(_P, facing, _S));
      m.setColorAt(i, _Cc.setHex(b[4]).multiplyScalar(b[5]));
    }, 3, () => { propFx.tick(); A.halo.opacity = 0.22 + 0.78 * propFx.uGlow.value; }));
  }
}

export { InstancedBufferAttribute, lerp, clamp01, sstep };
