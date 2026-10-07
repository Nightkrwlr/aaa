/**
 * Terreno de Eclipse — suelo «pintado» con volumen, y agua / lava / ácido con vida.
 *
 * El juego construye el mundo como losetas de 1×1 con UNA capa del array de texturas procedurales (aLayer). Eso daba
 * escaleras entre bioma / camino / muro y un suelo plano. Este módulo (portado en espíritu de terrainMesh.js,
 * noiseTex.js y worldMaterials.js de SUNDERCHOIR a three r160) aporta:
 *
 *  · mezcla orgánica entre capas: cada loseta lleva su capa, la capa «vecina» dominante y qué vecinos (8) son de esa
 *    capa. El shader reconstruye un campo bilineal centrado en las losetas (continuo entre losetas = sin costuras) y lo
 *    rompe con ruido + mezcla por altura de textura, de modo que los senderos son caminos y los biomas se funden con grano.
 *  · volumen: AO de contacto crisp junto a muros/rocas, luz de borde en las crestas, bisel falso por normal,
 *    degradado vertical (base sucia, parte alta clara) y vetas en los laterales.
 *  · macroescala por bioma (musgo, óxido, escarcha, ceniza…), anti-repetición por 2.ª muestra rotada y ruido de gran escala.
 *  · líquidos con profundidad (orilla clara, centro oscuro), ondas, brillo falso, espuma, lava HDR y ácido con pulso.
 *
 * Sin binarios: el ruido se genera por código (una sola textura RGBA 256²). Coste por píxel acotado por `TQ`
 * (0 low, 1 medium, 2 high): como mucho 3 lecturas del array de texturas en high, 2 en low.
 */
import {
  DataTexture, RGBAFormat, UnsignedByteType, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter, NoColorSpace,
  Vector3, Vector4, MeshStandardMaterial,
} from 'three';

// ───────────────────────────────────────────────────────── ruido procedural (una textura para todo)
function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
// ruido de valor periódico sobre el cuadrado unidad (la textura repite sin costura)
function pnoise(u, v, f, seed) {
  const x = u * f, y = v * f, x0 = Math.floor(x), y0 = Math.floor(y), tx = fade(x - x0), ty = fade(y - y0);
  const xa = ((x0 % f) + f) % f, xb = (xa + 1) % f, ya = ((y0 % f) + f) % f, yb = (ya + 1) % f;
  const a = hash2(xa, ya, seed), b = hash2(xb, ya, seed), c = hash2(xa, yb, seed), d = hash2(xb, yb, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function fbm(u, v, f, oct, seed) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * pnoise(u, v, f << i, seed + i * 17); n += a; a *= 0.5; }
  return s / n;
}
// celular periódico (distancia al punto más cercano)
function worley(u, v, f, seed) {
  const x = u * f, y = v * f, xi = Math.floor(x), yi = Math.floor(y);
  let best = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % f) + f) % f, wy = ((cy % f) + f) % f;
    const px = cx + hash2(wx, wy, seed), py = cy + hash2(wx, wy, seed + 101);
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < best) best = d;
  }
  return Math.min(1, Math.sqrt(best));
}

let noiseTex = null;
/**
 * RGBA8 256² con repetición: R fbm suave (manchas), G celular (grietas / cáusticas / burbujas),
 * B grano fino, A segundo fbm independiente e isótropo (R,A hacen de campo vectorial: ondas, deformación).
 */
export function terrainNoise() {
  if (noiseTex) return noiseTex;
  const S = 256, data = new Uint8Array(S * S * 4);
  const st = (x) => Math.max(0, Math.min(1, (x - 0.5) * 1.9 + 0.5)); // estira el fbm (naturalmente gris medio) a 0..1
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S, k = (j * S + i) * 4;
    data[k] = st(fbm(u, v, 4, 5, 3)) * 255;
    data[k + 1] = (1 - worley(u, v, 9, 7)) * 255;
    data[k + 2] = st(fbm(u, v, 32, 3, 11)) * 255;
    data[k + 3] = st(fbm(u, v, 5, 4, 19)) * 255;
  }
  const t = new DataTexture(data, S, S, RGBAFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping; t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 2; t.colorSpace = NoColorSpace; t.needsUpdate = true;
  noiseTex = t;
  return t;
}

// ───────────────────────────────────────────────────────── mirada de cada bioma (macroescala del suelo)
/** orden = índice de bioma que viaja en el atributo de vértice (coincide con el orden de las regiones del juego) */
export const BIO_KEYS = ['valle', 'ciudad', 'desierto', 'marisma', 'tundra', 'complejo', 'caldera', 'yermo', 'colmena'];
/**
 * a, b  factores multiplicativos del albedo para dos tipos de mancha (a = principal; b = suciedad / desgaste)
 * cap   color de la «capa superior» (nieve, ceniza, polvo) sobre las tapas de muros y rocas
 * k     [mancha en suelo, mancha en muros/roca, capa superior, humedad]
 */
export const BIO_LOOK = {
  valle:    { a: [0.80, 1.14, 0.60], b: [1.10, 1.04, 0.74], cap: [0.60, 0.80, 0.34], k: [0.62, 0.80, 0.18, 0.15] }, // musgo / hierba seca
  ciudad:   { a: [0.72, 0.75, 0.78], b: [1.30, 0.90, 0.58], cap: [0.50, 0.52, 0.55], k: [0.55, 0.70, 0.00, 0.30] }, // mugre / óxido
  desierto: { a: [1.16, 1.06, 0.86], b: [0.76, 0.66, 0.56], cap: [0.95, 0.80, 0.55], k: [0.55, 0.60, 0.25, 0.00] }, // arena clara / roca oxidada
  marisma:  { a: [0.66, 0.92, 0.70], b: [0.62, 0.70, 0.62], cap: [0.40, 0.55, 0.38], k: [0.75, 0.90, 0.00, 0.60] }, // alga / barro
  tundra:   { a: [1.22, 1.32, 1.48], b: [0.84, 0.92, 1.10], cap: [0.92, 0.97, 1.05], k: [0.70, 0.90, 0.90, 0.10] }, // escarcha / hielo sucio
  complejo: { a: [1.34, 0.84, 0.52], b: [0.60, 0.64, 0.70], cap: [0.52, 0.55, 0.60], k: [0.50, 0.80, 0.00, 0.10] }, // óxido / aceite
  caldera:  { a: [0.60, 0.58, 0.58], b: [1.40, 0.74, 0.42], cap: [0.20, 0.19, 0.19], k: [0.62, 0.70, 0.55, 0.00] }, // ceniza / brasa
  yermo:    { a: [1.10, 0.98, 0.76], b: [0.72, 0.70, 0.66], cap: [0.62, 0.58, 0.50], k: [0.58, 0.72, 0.25, 0.00] }, // polvo / contaminación
  colmena:  { a: [0.92, 0.66, 1.24], b: [0.74, 0.96, 0.68], cap: [0.46, 0.30, 0.52], k: [0.62, 0.72, 0.00, 0.45] }, // limo violeta / veta verde
};

/** uniformes del suelo que dependen del bioma (se crean una vez y los comparten todos los chunks) */
export function bioUniforms() {
  const A = [], B = [], C = [], K = [];
  for (const key of BIO_KEYS) {
    const l = BIO_LOOK[key];
    A.push(new Vector3(...l.a)); B.push(new Vector3(...l.b)); C.push(new Vector3(...l.cap)); K.push(new Vector4(...l.k));
  }
  return { uStainA: { value: A }, uStainB: { value: B }, uCap: { value: C }, uBioK: { value: K } };
}

// ───────────────────────────────────────────────────────── shader del suelo
/** estados de borde (aEdge): 0 nada · 1 vecino de la capa «otra» (mezcla) · 2 caída sólida · 3 subida (muro) · 4 caída a líquido */
const GROUND_VERT_PARS = /* glsl */ `
attribute vec4 aLay;   // x capa propia, y capa vecina (-1 ninguna), z = lateral + 2*bits diagonales, w = clase*16 + bioma
attribute vec4 aEdge;  // cara superior: estado de los bordes W,E,N,S · lateral: (y alto, y base, hash, 0)
attribute vec3 aCol2;  // color de la capa vecina en esta esquina
varying vec4 vLay; varying vec4 vEdge; varying vec3 vCol2; varying vec3 vWP;`;
const GROUND_VERT_BODY = /* glsl */ `
vLay = aLay; vEdge = aEdge; vCol2 = aCol2; vWP = (modelMatrix * vec4(position, 1.0)).xyz;`;

const GROUND_FRAG_PARS = /* glsl */ `
precision highp sampler2DArray;
uniform sampler2DArray uArr; uniform sampler2D uTN;
uniform float uTime; uniform float uCloud; uniform float uTexK; uniform float uOrg[32];
uniform vec3 uStainA[9]; uniform vec3 uStainB[9]; uniform vec3 uCap[9]; uniform vec4 uBioK[9];
varying vec4 vLay; varying vec4 vEdge; varying vec3 vCol2; varying vec3 vWP;
vec3 gTilt; float gRoughMul;
float gHash(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
// capa del array. En capas orgánicas una 2.ª muestra rotada y a otra escala rompe la repetición (contraste compensado)
vec3 gTex(float L, vec2 uv, float org, float k){
  vec3 a = texture(uArr, vec3(uv, L)).rgb;
  #if TQ >= 2
  if (org > 0.5) {
    vec2 uv2 = vec2(uv.x * 0.8 - uv.y * 0.6, uv.x * 0.6 + uv.y * 0.8) * 0.57 + vec2(0.37, 0.11);
    vec3 b = texture(uArr, vec3(uv2, L)).rgb;
    float w = smoothstep(0.30, 0.70, k);
    a = mix(a, b, w);
    a = 0.85 + (a - 0.85) * (1.0 + 0.45 * w * (1.0 - w) * 4.0);
  }
  #endif
  return a;
}
// distancia mínima (por eje) a los bordes de estado s
float edgeD(vec2 st, vec2 u, float s){
  float d = 9.0;
  if (abs(st.x - s) < 0.5) d = min(d, u.x);
  if (abs(st.y - s) < 0.5) d = min(d, u.y);
  return d;
}`;

const GROUND_FRAG_COLOR = /* glsl */ `
{
  float zs = vLay.z; float dgf = floor(zs * 0.5 + 0.02); bool isSide = (zs - dgf * 2.0) > 0.5;
  float cls = floor(vLay.w / 16.0 + 0.02); int bi = int(vLay.w - cls * 16.0 + 0.5);
  vec2 wp = vWP.xz;
  vec4 nL = texture2D(uTN, wp * 0.0105 + vec2(0.17, 0.41));
  #if TQ >= 1
  vec4 nM = texture2D(uTN, wp * 0.041 + vec2(0.31, 0.57));
  #else
  vec4 nM = nL;
  #endif
  gTilt = vec3(0.0); gRoughMul = 1.0;
  vec3 alb = vColor;
  float ao = 1.0;
  float Lo = floor(vLay.x + 0.5);
  bool isWallish = (cls > 2.5 && cls < 3.5) || (cls > 6.5 && cls < 7.5) || (cls > 8.5 && cls < 9.5);
  vec4 K = uBioK[bi];
  float topness = 0.0;
  if (Lo > -0.5) {
    if (!isSide) {
      // ───── cara superior: mezcla de capas por campo bilineal centrado en las losetas
      vec2 tuv = wp * 0.42 + (nM.rg - 0.5) * 0.30;
      vec3 tA = gTex(Lo, tuv, uOrg[int(Lo)], nL.a);
      alb = tA * vColor;
      vec2 f = fract(wp); vec2 dq = abs(f - 0.5); vec2 u = 0.5 - dq;
      bool left = f.x < 0.5; bool up = f.y < 0.5;
      vec2 st = vec2(left ? vEdge.x : vEdge.y, up ? vEdge.z : vEdge.w);
      if (vLay.y > -0.5) {
        float cx = abs(st.x - 1.0) < 0.5 ? 0.0 : 1.0;
        float cz = abs(st.y - 1.0) < 0.5 ? 0.0 : 1.0;
        int bit = up ? (left ? 0 : 1) : (left ? 2 : 3);
        float cd = ((int(dgf + 0.5) >> bit) & 1) == 1 ? 0.0 : 1.0;
        float fld = (1.0 - dq.x) * (1.0 - dq.y) + dq.x * (1.0 - dq.y) * cx + (1.0 - dq.x) * dq.y * cz + dq.x * dq.y * cd;
        if (fld < 0.995) {
          float Lb = floor(vLay.y + 0.5);
          vec3 tB = gTex(Lb, tuv, uOrg[int(Lb)], nL.a);
          // borde irregular: el ruido desplaza la frontera (signo opuesto a cada lado → continuo entre losetas)
          float nB = texture2D(uTN, wp * 0.33 + vec2(0.7, 0.2)).r - 0.5;
          #if TQ >= 2
          nB += 0.65 * (texture2D(uTN, wp * 1.9 + vec2(0.2, 0.9)).b - 0.5);
          #endif
          float sgn = Lo < Lb ? 1.0 : -1.0;
          float hb = dot(tA - tB, vec3(0.3333)) * 1.5;      // mezcla por altura: gana la capa más clara en los relieves
          float t = (fld - 0.5 + sgn * nB * 0.5) / 0.115 + sgn * hb;
          float wOwn = smoothstep(-1.0, 1.0, t);
          alb = mix(tB * vCol2, alb, wOwn);
        }
      }
      alb *= uTexK;
      topness = 1.0;
      // ───── bordes: caída (luz de cresta + bisel), subida (AO de contacto), caída a líquido (húmedo)
      float dR = edgeD(st, u, 2.0);
      if (dR < 8.0) {
        float rn = nM.b - 0.5;
        float rim = 1.0 - smoothstep(0.0, 0.17, dR + rn * 0.10);
        alb *= 1.0 + 0.34 * rim;
        alb *= 1.0 - 0.14 * (1.0 - smoothstep(0.0, 0.04, dR)) ;           // arista: línea de sombra mínima
        #if TQ >= 1
        float bvx = abs(st.x - 2.0) < 0.5 ? 1.0 - smoothstep(0.0, 0.20, u.x) : 0.0;
        float bvz = abs(st.y - 2.0) < 0.5 ? 1.0 - smoothstep(0.0, 0.20, u.y) : 0.0;
        gTilt += vec3((left ? -1.0 : 1.0) * bvx, 0.0, (up ? -1.0 : 1.0) * bvz) * 0.85;
        #endif
      }
      float dU = edgeD(st, u, 3.0);
      if (dU < 8.0) ao *= 1.0 - 0.34 * (1.0 - smoothstep(0.0, 0.50, dU));
      float dW = edgeD(st, u, 4.0);
      if (dW < 8.0) {
        float wet = 1.0 - smoothstep(0.0, 0.34, dW + (nM.b - 0.5) * 0.16);
        alb *= 1.0 - 0.30 * wet; gRoughMul *= 1.0 - 0.55 * wet;
      }
      // variación por loseta en tapas de muro / roca
      if (isWallish) alb *= 0.91 + 0.18 * gHash(floor(wp.x) * 7.13 + floor(wp.y) * 13.71);
    } else {
      // ───── lateral: base sucia, parte alta clara, vetas verticales
      float topY = vEdge.x, baseY = vEdge.y, yy = vWP.y;
      float fromBase = max(yy - baseY, 0.0), fromTop = max(topY - yy, 0.0);
      vec2 suv = vec2((vWP.x - vWP.z) * 0.4, -yy * 0.4);
      vec3 tA = gTex(Lo, suv, uOrg[int(Lo)], nL.a);
      alb = tA * vColor * uTexK;
      float al = vWP.x + vWP.z;
      float seg = gHash(floor(al + 0.01) * 5.37 + vEdge.z * 31.0);
      float sk = texture2D(uTN, vec2(al * 0.62, yy * 0.075) + vec2(0.13, 0.27)).r;
      alb *= 0.90 + 0.20 * seg;
      alb *= 0.80 + 0.40 * sk;
      alb *= 1.0 - 0.42 * (1.0 - smoothstep(0.0, 0.55, fromBase));        // base sucia
      alb *= 1.0 + 0.32 * (1.0 - smoothstep(0.0, 0.12, fromTop));          // cresta iluminada
      gTilt = vec3(0.0);
      topness = 0.0;
    }
    // ───── macroescala: manchas de claro/oscuro y de bioma (sin repetición visible)
    float blot = nL.r * 0.6 + nM.r * 0.4;
    alb *= 0.78 + 0.44 * blot;
    alb *= mix(vec3(1.05, 1.0, 0.93), vec3(0.94, 1.0, 1.07), nL.a);
    float mA = smoothstep(0.50, 0.78, nL.a * 0.5 + nM.r * 0.3 + nM.g * 0.2);
    float mB = smoothstep(0.55, 0.82, nL.r * 0.45 + nM.a * 0.35 + nM.b * 0.2);
    float amt = isWallish || isSide ? K.y : K.x;
    if (isSide) { mA *= 0.35 + 0.65 * (1.0 - smoothstep(0.0, 1.1, max(vWP.y - vEdge.y, 0.0)) * 0.0); mB *= 0.5 + 0.5 * (1.0 - smoothstep(0.0, 1.0, max(vWP.y - vEdge.y, 0.0))); }
    alb *= mix(vec3(1.0), uStainA[bi], mA * amt);
    alb *= mix(vec3(1.0), uStainB[bi], mB * amt * 0.8);
    // capa superior sobre tapas de muros y rocas (nieve, ceniza, polvo): deja ver la piedra en el borde
    if (topness > 0.5 && isWallish && K.z > 0.01) {
      float cm = smoothstep(0.30, 0.62, nL.a * 0.6 + nM.g * 0.4) * K.z;
      alb = mix(alb, uCap[bi] * (0.8 + 0.4 * nM.r), clamp(cm, 0.0, 1.0));
    }
    #if TQ >= 1
    if (cls > 9.5 && cls < 10.5) {                  // hielo: brillo y facetas
      gRoughMul *= 0.55;
      gTilt += (vec3(nM.r, 0.0, nM.a) - 0.5) * 0.55;
    }
    #endif
    alb *= ao;
  }
  diffuseColor.rgb = alb;
  // sombras de nubes que pasan sobre el terreno (solo exteriores)
  if (uCloud > 0.5) {
    vec2 cp = vWP.xz * 0.018 + vec2(uTime * 0.012, uTime * 0.007);
    float cl = sin(cp.x * 2.1 + sin(cp.y * 1.7)) * sin(cp.y * 2.6 + sin(cp.x * 1.3 + 1.7)) + 0.35 * sin(cp.x * 5.3 - cp.y * 4.1);
    diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(0.15, 0.75, cl);
  }
}`;

/** parchea el shader del suelo (llamar desde onBeforeCompile del material; `o.uniforms` aporta los uniformes propios) */
export function patchGroundShader(shader, o) {
  Object.assign(shader.uniforms, o.uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${GROUND_VERT_PARS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GROUND_VERT_BODY}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#define TQ ${o.tq}\n#include <common>\n${GROUND_FRAG_PARS}`)
    .replace('#include <map_fragment>', '')
    .replace('#include <color_fragment>', GROUND_FRAG_COLOR)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= gRoughMul;')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#if TQ >= 1
normal = normalize(normal + (viewMatrix * vec4(gTilt, 0.0)).xyz);
#endif`);
}

// ───────────────────────────────────────────────────────── líquidos
const LIQ_VERT_PARS = /* glsl */ `attribute float aDepth; varying float vDepth; varying vec3 vWPl;`;
const LIQ_VERT_BODY = /* glsl */ `vDepth = aDepth; vWPl = (modelMatrix * vec4(position, 1.0)).xyz;`;
const LIQ_FRAG_PARS = /* glsl */ `
uniform sampler2D uTN; uniform float uTime;
varying float vDepth; varying vec3 vWPl;
vec3 gEmis; vec2 gRip; float gSpark;`;

const WATER_MAP = /* glsl */ `
{
  vec2 p = vWPl.xz; float tt = uTime;
  vec4 w1 = texture2D(uTN, p * 0.11 + vec2(tt * 0.012, tt * 0.008));
  vec4 w2 = texture2D(uTN, p * 0.23 + vec2(-tt * 0.010, tt * 0.015) + 0.37);
  #if TQ >= 1
  vec4 w3 = texture2D(uTN, p * 0.61 + vec2(tt * 0.030, -tt * 0.021) + 0.71);
  #else
  vec4 w3 = w2;
  #endif
  gRip = (vec2(w1.r, w1.a) - 0.5) * 0.9 + (vec2(w2.r, w2.a) - 0.5) * 0.6 + (vec2(w3.r, w3.a) - 0.5) * 0.4;
  float depth = clamp(vDepth, 0.0, 1.0);
  float dd = smoothstep(0.0, 0.85, depth + (w1.r - 0.5) * 0.22);
  vec3 shallow = vec3(0.10, 0.36, 0.38);
  vec3 deep = vec3(0.004, 0.045, 0.085);
  vec3 col = mix(shallow, deep, dd);
  col += vec3(0.20, 0.34, 0.32) * smoothstep(0.50, 0.95, w2.g * 0.55 + w3.g * 0.45) * (1.0 - dd) * 0.55;   // cáusticas en el bajío
  float sh = depth + (w3.b - 0.5) * 0.10 + (w1.g - 0.5) * 0.06 + sin(tt * 0.9 + depth * 26.0 + w2.r * 6.0) * 0.012;
  float foam = (1.0 - smoothstep(0.012, 0.075, sh)) * (0.62 + 0.38 * smoothstep(0.30, 0.70, w2.g));
  foam += (1.0 - smoothstep(0.08, 0.17, sh)) * smoothstep(0.60, 0.84, w3.g) * 0.55;
  foam = clamp(foam, 0.0, 1.0);
  diffuseColor.rgb = mix(col, vec3(0.80, 0.90, 0.92), foam);
  diffuseColor.a = max(mix(0.52, 0.94, dd), foam * 0.95);
  gSpark = 1.0 - foam;
}`;
const WATER_NORMAL = /* glsl */ `
normal = normalize(normal + (viewMatrix * vec4(gRip.x, 0.0, gRip.y, 0.0)).xyz * 0.30);`;
const WATER_OPAQUE = /* glsl */ `
{
  vec3 vd = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
  float fr = pow(1.0 - clamp(dot(vd, normal), 0.0, 1.0), 2.0);
  outgoingLight += fogColor * (0.10 + 0.55 * fr) * gSpark;           // cielo reflejado (velo de la niebla)
  #if NUM_DIR_LIGHTS > 0
  vec3 H = normalize(directionalLights[0].direction + vd);
  float sp = pow(max(dot(normal, H), 0.0), 150.0) + 0.5 * pow(max(dot(normal, H), 0.0), 40.0);
  outgoingLight += directionalLights[0].color * sp * 0.9 * gSpark;     // brillo especular falso (HDR: el bloom lo recoge)
  #endif
}
#include <opaque_fragment>`;

const LAVA_MAP = /* glsl */ `
{
  vec2 p = vWPl.xz; float tt = uTime;
  vec4 a1 = texture2D(uTN, p * 0.07 + vec2(tt * 0.006, tt * 0.004));
  vec2 warp = (vec2(a1.r, a1.a) - 0.5) * 0.30;
  vec4 b1 = texture2D(uTN, p * 0.16 + warp + vec2(tt * 0.012, -tt * 0.007) + 0.30);
  #if TQ >= 1
  vec4 b2 = texture2D(uTN, p * 0.34 + warp * 1.6 + vec2(-tt * 0.018, tt * 0.011) + 0.60);
  #else
  vec4 b2 = b1;
  #endif
  float v1 = 1.0 - abs(b1.r * 2.0 - 1.0);
  float v2 = 1.0 - abs(b2.a * 2.0 - 1.0);
  float vein = smoothstep(0.80, 1.0, v1) + 0.7 * smoothstep(0.84, 1.0, v2);
  float molten = smoothstep(0.30, 0.78, a1.r * 0.7 + b1.g * 0.3);
  float depth = clamp(vDepth, 0.0, 1.0);
  float heat = clamp(vein * 0.85 + molten * 0.55, 0.0, 1.0);
  heat *= 0.28 + 0.72 * smoothstep(0.0, 0.40, depth + (a1.g - 0.5) * 0.25);   // corteza fría junto a la orilla
  float pulse = 0.86 + 0.14 * sin(tt * 1.3 + a1.r * 9.0);
  vec3 ember = mix(vec3(0.30, 0.012, 0.0), vec3(1.0, 0.30, 0.025), smoothstep(0.0, 0.55, heat));
  ember = mix(ember, vec3(1.0, 0.80, 0.34), smoothstep(0.62, 1.0, heat));
  gEmis = ember * (0.35 + 4.2 * heat * heat) * pulse;
  diffuseColor.rgb = vec3(0.022, 0.016, 0.014) * (0.6 + 0.8 * b2.b);
  diffuseColor.a = 1.0;
}`;
const LAVA_EMIS = 'totalEmissiveRadiance = gEmis;';

const ACID_MAP = /* glsl */ `
{
  vec2 p = vWPl.xz; float tt = uTime;
  vec4 a1 = texture2D(uTN, p * 0.10 + vec2(tt * 0.010, -tt * 0.006));
  vec4 a2 = texture2D(uTN, p * 0.27 + vec2(-tt * 0.016, tt * 0.012) + 0.4);
  float depth = clamp(vDepth, 0.0, 1.0);
  float pulse = 0.5 + 0.5 * sin(tt * 1.7 + a1.r * 5.0);
  float bub = smoothstep(0.80, 0.90, a2.g) - smoothstep(0.90, 0.99, a2.g);   // anillos de burbuja que revientan
  float slick = smoothstep(0.45, 0.85, a1.r);
  vec3 base = mix(vec3(0.020, 0.075, 0.020), vec3(0.060, 0.20, 0.030), slick);
  diffuseColor.rgb = base;
  diffuseColor.a = mix(0.80, 0.95, smoothstep(0.0, 0.6, depth));
  float rim = 1.0 - smoothstep(0.0, 0.22, depth + (a2.b - 0.5) * 0.1);
  gEmis = vec3(0.30, 0.90, 0.10) * (0.30 + 0.55 * pulse) * (0.55 + 0.45 * slick) + vec3(0.55, 1.0, 0.25) * (bub * (0.5 + 0.5 * pulse) + rim * 0.55);
  gRip = (vec2(a1.r, a1.a) - 0.5) * 0.5;
}`;

/**
 * material de líquido. `o.kind` water | lava | acid; `o.time` uniforme compartido {value}; `o.hook(shader)` conecta la
 * máscara de oscuridad del juego; `o.quality()` devuelve low|medium|high en el momento de compilar.
 */
export function makeLiquidMaterial(o) {
  const kind = o.kind;
  const m = new MeshStandardMaterial(
    kind === 'water' ? { color: 0xffffff, roughness: 0.10, metalness: 0.0, transparent: true }
      : kind === 'lava' ? { color: 0xffffff, roughness: 0.55, metalness: 0.0 }
        : { color: 0xffffff, roughness: 0.25, metalness: 0.0, transparent: true });
  const tq = () => ({ low: 0, medium: 1, high: 2 }[o.quality()] ?? 1);
  m.onBeforeCompile = (shader) => {
    o.hook?.(shader);
    shader.uniforms.uTN = { value: terrainNoise() };
    shader.uniforms.uTime = o.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${LIQ_VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${LIQ_VERT_BODY}`);
    let fs = shader.fragmentShader
      .replace('#include <common>', `#define TQ ${tq()}\n#include <common>\n${LIQ_FRAG_PARS}`)
      .replace('#include <map_fragment>', kind === 'water' ? WATER_MAP : kind === 'lava' ? LAVA_MAP : ACID_MAP);
    if (kind !== 'lava') fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${kind === 'water' ? WATER_NORMAL : 'normal = normalize(normal + (viewMatrix * vec4(gRip.x, 0.0, gRip.y, 0.0)).xyz * 0.2);'}`);
    if (kind === 'water') fs = fs.replace('#include <opaque_fragment>', WATER_OPAQUE);
    else fs = fs.replace('#include <emissivemap_fragment>', LAVA_EMIS.replace('gEmis', 'gEmis'));
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `liq-${kind}-${tq()}`;
  m.userData.kind = kind;
  return m;
}
