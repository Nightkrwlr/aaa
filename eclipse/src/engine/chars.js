// ───────────────────────────────────────────────────────────────────────────────────────────────
// Personajes: luz de borde (fresnel), estados visuales (impacto, congelado, quemado, veneno, escudo),
// disolución de muerte, ojos HDR y sombra de contacto. Adaptado de charFactory.js de SUNDERCHOIR a three r160.
//
// Diseño para hordas: TODO el aspecto va en el shader del material (capas extra, no mallas) y cada
// personaje comparte un solo programa. El estado por personaje vive en un `CharFx` cuyos uniformes
// son los mismos objetos en todos los materiales del modelo → actualizarlo no asigna memoria.
// ───────────────────────────────────────────────────────────────────────────────────────────────
import { Color, Vector4, Mesh, MeshBasicMaterial, PlaneGeometry, CanvasTexture, SRGBColorSpace } from 'three';

/** reloj compartido (uniforme) para pulsos de aura y brasas; lo avanza el sistema de FX cada fotograma */
export const charClock = { value: 0 };

const _c = new Color();

/** estado visual de UN personaje (uniformes compartidos por todos los materiales de su modelo) */
export class CharFx {
  constructor() {
    this.uCfA = { value: new Vector4(0, 0, 0, 0) };      // x impacto · y congelado · z quemado · w veneno
    this.uCfB = { value: new Vector4(0, 0, 1, 0) };      // x escudo · y disolución · z ganancia de ojos · w (libre)
    this.uRimC = { value: new Vector4(0.55, 0.78, 1, 0.55) }; // rgb luz de borde · a intensidad
    this.uAuraC = { value: new Vector4(0, 0, 0, 0) };    // rgb aura de élite/familia · a intensidad
    this.uDisC = { value: new Color(1, 0.5, 0.12) };     // color del borde de la disolución
  }
  /** luz de borde (hex, intensidad) */
  setRim(hex, k) { _c.setHex(hex); this.uRimC.value.set(_c.r, _c.g, _c.b, k); return this; }
  /** aura de élite/familia: borde ancho y pulsante */
  setAura(hex, k) { _c.setHex(hex); this.uAuraC.value.set(_c.r, _c.g, _c.b, k); return this; }
  /** estados: sin asignaciones, se llama cada fotograma */
  setStatus(flash, frozen, burn, poison, shield) {
    this.uCfA.value.set(flash, frozen, burn, poison); this.uCfB.value.x = shield; return this;
  }
  /** disolución de muerte 0..1 con borde incandescente */
  setDissolve(p, hex) { this.uCfB.value.y = p; if (hex !== undefined) this.uDisC.value.setHex(hex); return this; }
  setEyes(g) { this.uCfB.value.z = g; return this; }
  reset() { this.uCfA.value.set(0, 0, 0, 0); this.uCfB.value.x = 0; this.uCfB.value.y = 0; return this; }
}

// ─── GLSL ─────────────────────────────────────────────────────────────────────────────────────
const GLSL_DECL = /* glsl */`
uniform vec4 uCfA; uniform vec4 uCfB; uniform vec4 uRimC; uniform vec4 uAuraC; uniform vec3 uDisC; uniform float uCharT;
varying vec3 vOP;
float chHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float chNoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(chHash(i), chHash(i + vec3(1,0,0)), f.x), mix(chHash(i + vec3(0,1,0)), chHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(chHash(i + vec3(0,0,1)), chHash(i + vec3(1,0,1)), f.x), mix(chHash(i + vec3(0,1,1)), chHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

// disolución: descarta por ruido (se puede hacer antes de la iluminación)
const GLSL_DISSOLVE = /* glsl */`
float chDis = 1.0;
if (uCfB.y > 0.0) { chDis = chNoise(vOP * 7.0) * 0.75 + chNoise(vOP * 19.0) * 0.25 - uCfB.y * 1.15 + 0.12; if (chDis < 0.0) discard; }
// puntos de acento (ojos, cristales): colores saturados y claros del atlas de paleta, antes de teñir
float chMx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), chMn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
float chSat = chMx > 0.001 ? (chMx - chMn) / chMx : 0.0;
float chEye = uCfB.z > 0.0 ? smoothstep(0.55, 0.8, chSat) * smoothstep(0.32, 0.5, chMx) : 0.0;
vec3 chEyeCol = diffuseColor.rgb;`;

const GLSL_FINAL = /* glsl */`
{
  vec3 chV = normalize(vViewPosition);
  float chNV = clamp(dot(chV, normal), 0.0, 1.0);
  float chFr = pow(1.0 - chNV, 2.2);
  float chUp = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
  // luz de borde: cielo frío, más fuerte arriba y en el contorno (silueta legible sobre cualquier bioma)
  outgoingLight += uRimC.rgb * (uRimC.a * chFr * (0.4 + 0.9 * chUp));
  // aura de élite/familia: borde más ancho con latido suave
  outgoingLight += uAuraC.rgb * (uAuraC.a * pow(1.0 - chNV, 1.5) * (0.78 + 0.22 * sin(uCharT * 3.2 + vOP.y * 5.0)));
  // ojos y puntos débiles en HDR (alimentan el bloom)
  outgoingLight += chEyeCol * (chEye * uCfB.z);
  float chLum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  // congelado: desatura hacia azul hielo y filo claro
  outgoingLight = mix(outgoingLight, vec3(chLum) * vec3(0.62, 0.92, 1.3) + vec3(0.03, 0.09, 0.2), uCfA.y * 0.72);
  outgoingLight += vec3(0.3, 0.65, 1.0) * (uCfA.y * chFr * 1.1);
  // quemado: brasas naranjas que laten y más calor en el contorno
  outgoingLight += vec3(1.0, 0.36, 0.05) * (uCfA.z * (0.14 + chFr * 1.0) * (0.78 + 0.22 * sin(uCharT * 17.0 + vOP.y * 9.0)));
  // veneno: verdoso y viscoso
  outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.55, 1.12, 0.42) + vec3(0.0, 0.07, 0.0), uCfA.w * 0.6);
  outgoingLight += vec3(0.22, 0.9, 0.1) * (uCfA.w * chFr * 0.7);
  // escudo: casco cian que respira
  outgoingLight += vec3(0.12, 0.78, 1.15) * (uCfB.x * (0.1 + chFr * 1.4) * (0.82 + 0.18 * sin(uCharT * 6.0)));
  // impacto: blanco HDR (1–2 fotogramas) → el bloom lo realza sin quemar el color de la familia
  outgoingLight = mix(outgoingLight, vec3(2.5, 2.4, 2.2), uCfA.x * 0.88);
  // borde incandescente de la disolución de muerte
  if (chDis < 0.1) outgoingLight += uDisC * ((1.0 - chDis / 0.1) * 3.2);
}`;

// teñido por matiz/traje del juego (idéntico al de Jf original)
const TINT = /* glsl */`{ vec3 c = diffuseColor.rgb;
          float Y = dot(c, vec3(0.299, 0.587, 0.114)); float I = dot(c, vec3(0.596, -0.274, -0.322)); float Q = dot(c, vec3(0.211, -0.523, 0.312));
          float h = atan(Q, I) + uHue; float ch = sqrt(I * I + Q * Q) * uSat; Y *= uVal; I = ch * cos(h); Q = ch * sin(h);
          diffuseColor.rgb = max(vec3(0.0), vec3(Y + 0.956 * I + 0.621 * Q, Y - 0.272 * I - 0.647 * Q, Y - 1.106 * I + 1.703 * Q));
          vec3 d = diffuseColor.rgb; vec3 g = sqrt(d); float mx = max(g.r, max(g.g, g.b)), mn = min(g.r, min(g.g, g.b)); float sa = mx > 0.001 ? (mx - mn) / mx : 0.0; float lu = dot(g, vec3(0.299, 0.587, 0.114));
          float k = (1.0 - smoothstep(0.10, 0.20, sa)) * smoothstep(0.40, 0.52, lu) * uSuitOn;
          diffuseColor.rgb = mix(d, uSuit * (lu / 0.6) * (lu / 0.6) * 1.15, k); }`;

/**
 * Parche de material de personaje. `recolor` es el teñido por matiz/traje del juego (se conserva tal cual: lo usan
 * también los props del mundo vía Jf sin `fx`). Con `fx` añade las capas de legibilidad y estados.
 */
export function patchCharMaterial(mat, recolor, fx) {
  const e = recolor || {};
  const prev = mat.onBeforeCompile;
  mat.userData.rc = recolor || null;
  mat.onBeforeCompile = function (t, r) {
    prev && prev.call(this, t, r);
    if (recolor) {
      t.uniforms.uHue = { value: e.hue || 0 };
      t.uniforms.uSat = { value: e.sat ?? 1 };
      t.uniforms.uVal = { value: e.val ?? 1 };
      t.uniforms.uSuit = { value: new Color(e.suit ?? 0xffffff) };
      t.uniforms.uSuitOn = { value: e.suit != null ? 1 : 0 };
    }
    if (fx) {
      t.uniforms.uCfA = fx.uCfA; t.uniforms.uCfB = fx.uCfB; t.uniforms.uRimC = fx.uRimC;
      t.uniforms.uAuraC = fx.uAuraC; t.uniforms.uDisC = fx.uDisC; t.uniforms.uCharT = charClock;
      t.vertexShader = t.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    }
    let f = t.fragmentShader
      .replace('#include <common>', `#include <common>
${recolor ? 'uniform float uHue; uniform float uSat; uniform float uVal; uniform vec3 uSuit; uniform float uSuitOn;' : ''}${fx ? GLSL_DECL : ''}`);
    // el teñido del juego, intacto (solo si hay recoloreo)
    f = f.replace('#include <map_fragment>', `#include <map_fragment>${fx ? GLSL_DISSOLVE : ''}
        ${recolor ? TINT : ''}`);
    if (fx) f = f.replace('#include <opaque_fragment>', `${GLSL_FINAL}\n#include <opaque_fragment>`);
    t.fragmentShader = f;
  };
  const key = (fx ? 'rc3ch' : 'rc2') + (recolor ? 't' : 'n');
  mat.customProgramCacheKey = () => key;
  mat.needsUpdate = true;
  return mat;
}

// ─── materiales procedurales (jugador, enemigos de mallas simples) ────────────────────────────
const _rimMats = new Map();
const _rimFx = new Map();

/** `CharFx` estático (solo luz de borde y aura) compartido por color: sin estados por personaje */
function staticFx(rimHex, rimK, auraHex, auraK) {
  const key = `${rimHex}|${rimK}|${auraHex}|${auraK}`;
  let fx = _rimFx.get(key);
  if (!fx) { fx = new CharFx().setRim(rimHex, rimK); if (auraK) fx.setAura(auraHex, auraK); fx.setEyes(0); _rimFx.set(key, fx); }
  return fx;
}

/**
 * Devuelve un clon del material con luz de borde (cacheado por material + color de borde): las mallas de personajes
 * procedurales comparten materiales (`de()`), así que un clon por combinación basta y no hay uno por enemigo.
 */
export function rimMaterial(src, rimHex = 0x9fd8ff, rimK = 0.5, auraHex = 0, auraK = 0) {
  if (!src || !src.isMeshStandardMaterial) return src;
  const key = `${src.uuid}|${rimHex}|${rimK}|${auraHex}|${auraK}`;
  let m = _rimMats.get(key);
  if (m) return m;
  m = src.clone();
  m.onBeforeCompile = src.onBeforeCompile;           // clone() no copia los parches previos (brillo especular de props.js)
  const prevKey = src.customProgramCacheKey ? src.customProgramCacheKey.call(src) : '';
  patchCharMaterial(m, null, staticFx(rimHex, rimK, auraHex, auraK));
  // el parche previo (si lo hay) forma parte de la clave del programa
  m.customProgramCacheKey = () => 'rc3chn|' + prevKey;
  _rimMats.set(key, m);
  return m;
}

/** aplica luz de borde a todas las mallas de un rig procedural (una vez, al construirlo) */
export function rimRig(root, rimHex, rimK, auraHex = 0, auraK = 0, skip = null) {
  root.traverse((o) => {
    if (!o.isMesh || o === skip || o.userData.noRim) return;
    const m = o.material;
    if (m && m.isMeshStandardMaterial && !m.transparent) o.material = rimMaterial(m, rimHex, rimK, auraHex, auraK);
  });
}

const _hdr = new Map();
/** material básico HDR (ojos, visores, gemas): el color se multiplica y el bloom lo realza */
export function hdrMaterial(color, gain = 2.4) {
  const key = color + '|' + gain;
  let m = _hdr.get(key);
  if (!m) { m = new MeshBasicMaterial({ toneMapped: false }); m.color.setHex(color).multiplyScalar(gain); _hdr.set(key, m); }
  return m;
}

// ─── sombra de contacto ───────────────────────────────────────────────────────────────────────
let _shTex = null, _shGeo = null;
const _shMat = new Map();
function shadowTex() {
  if (_shTex) return _shTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  // núcleo oscuro y penumbra suave: el personaje «pesa» sobre el suelo
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gr.addColorStop(0.62, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _shTex = new CanvasTexture(c); _shTex.colorSpace = SRGBColorSpace;
  return _shTex;
}
/** sombra blanda bajo un personaje (r ≈ radio; op = opacidad). Geometría y material compartidos */
export function charShadow(r = 0.5, op = 0.5) {
  if (!_shGeo) { _shGeo = new PlaneGeometry(1, 1); _shGeo.rotateX(-Math.PI / 2); }
  let mat = _shMat.get(op);
  if (!mat) {
    mat = new MeshBasicMaterial({ map: shadowTex(), color: 0x04060a, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
    _shMat.set(op, mat);
  }
  const m = new Mesh(_shGeo, mat);
  m.position.y = 0.03; m.scale.set(r * 2.7, 1, r * 2.3); m.renderOrder = 1; m.castShadow = false; m.receiveShadow = false;
  m.userData.noRim = true;
  return m;
}

