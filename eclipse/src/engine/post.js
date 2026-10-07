/**
 * PostFx — la tubería de fotograma de Eclipse (portada del motor de SUNDERCHOIR, adaptada a Three r160 y a los
 * uniformes que el juego ya conocía):
 *
 *   escena → (MSAA, destino HDR half-float) → [bloom] → pasada final
 *   pasada final: [FXAA] → mapeo tonal filmic (Neutral/ACES) UNA sola vez, grade partido (sombras frías / luces cálidas),
 *   viñeta, aberración cromática suave, daño (viñeta roja), grano y tramado triangular contra el banding.
 *
 * Antialiasing: con MSAA (escritorio, calidad alta/media) los bordes salen limpios del propio destino. En táctil el MSAA va a 0 (un destino
 * half-float multimuestreado a la resolución de un móvil come demasiado ancho de banda), así que la pasada final aplica un FXAA ligero
 * (Lottes, 5 muestras en píxeles sin borde y 9 en bordes) sobre el color HDR, decidiendo los bordes con una luma comprimida que se parece
 * a la que verá el ojo tras el mapeo tonal.
 *
 * Por qué no EffectComposer: el mapeo tonal debe hacerse una vez, al final, para que todo ShaderMaterial del juego
 * (partículas, decals, rayos) quede mapeado igual sin saberlo, y el MSAA de la escena sale gratis en el destino.
 *
 * Compatibilidad con el juego original: `uniforms` conserva uVig, uHurt, uTint, uTintA, uTime y uGrain.
 */
import {
  ShaderMaterial, WebGLRenderTarget, HalfFloatType, UnsignedByteType, Vector2, Vector3, Color,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uExposure, uSat, uContrast, uVig, uLift, uTime, uHurt, uGrain, uTone, uCA, uTintA, uFxaa;
uniform vec3 uShadowTint, uHighTint, uTint;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Narkowicz ACES (hombro filmic, sombras ricas)
vec3 tAces(vec3 x){ const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
// Khronos PBR Neutral (respeta el albedo autorizado y comprime solo las luces)
vec3 tNeutral(vec3 color){
  const float startCompression = 0.8 - 0.04; const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
vec3 oetf(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

// FXAA ligero sobre HDR. La luma se comprime (c/(1+c) y raíz) para que un borde luz/sombra pese como lo hará en pantalla tras el tonemap.
float lumC(vec3 c){ c *= uExposure; return sqrt(dot(c / (1.0 + c), vec3(0.299, 0.587, 0.114))); }
vec3 fxaa(vec2 uv){
  vec2 px = 1.0 / uRes;
  vec3 rgbM = texture2D(tScene, uv).rgb;
  vec3 rgbNW = texture2D(tScene, uv + vec2(-1.0, -1.0) * px).rgb;
  vec3 rgbNE = texture2D(tScene, uv + vec2( 1.0, -1.0) * px).rgb;
  vec3 rgbSW = texture2D(tScene, uv + vec2(-1.0,  1.0) * px).rgb;
  vec3 rgbSE = texture2D(tScene, uv + vec2( 1.0,  1.0) * px).rgb;
  float lM = lumC(rgbM), lNW = lumC(rgbNW), lNE = lumC(rgbNE), lSW = lumC(rgbSW), lSE = lumC(rgbSE);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.04, lMax * 0.125)) return rgbM;   // sin borde: una sola lectura útil, sin desenfoque
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float dirReduce = max((lNW + lNE + lSW + lSE) * (0.25 * 0.125), 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + dirReduce), vec2(-8.0), vec2(8.0)) * px;
  vec3 a = 0.5 * (texture2D(tScene, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tScene, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, uv + dir * -0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
  float lB = lumC(b);
  return (lB < lMin || lB > lMax) ? a : b;
}

void main(){
  vec2 uv = vUv;
  vec2 q = uv - 0.5;
  vec3 hdr;
  if (uFxaa > 0.5) {
    hdr = fxaa(uv);
    // con FXAA la aberración cromática de reposo (menos de un píxel) se omite; solo se pinta al recibir daño
    if (uHurt > 0.02) { float ab = uCA + uHurt * 0.006; hdr.r = texture2D(tScene, uv + q * ab).r; hdr.b = texture2D(tScene, uv - q * ab).b; }
  } else {
    // aberración cromática radial (crece con el daño)
    float ab = uCA + uHurt * 0.006;
    hdr.r = texture2D(tScene, uv + q * ab).r;
    hdr.g = texture2D(tScene, uv).g;
    hdr.b = texture2D(tScene, uv - q * ab).b;
  }
  hdr *= uExposure;
  // tinte de estado (visión nocturna, etc.) aplicado en lineal
  hdr = mix(hdr, hdr * uTint * 1.6 + uTint * 0.05, uTintA);
  vec3 lin = mix(tNeutral(hdr), tAces(hdr), uTone);
  vec3 c = oetf(lin);
  // levanta un pelo los negros para que la sombra profunda conserve color
  c = c * (1.0 - uLift) + uLift;
  // grade partido
  float l = luma(c);
  c *= mix(uShadowTint, uHighTint, smoothstep(0.12, 0.8, l));
  c = mix(vec3(luma(c)), c, uSat);
  c = mix(c, c * c * (3.0 - 2.0 * c), clamp((uContrast - 1.0) * 3.0, 0.0, 1.0));
  c = (c - 0.5) * (1.0 + max(uContrast - 1.35, 0.0)) + 0.5;
  // viñeta (corregida de aspecto, algo fría y oscura)
  vec2 qa = q * vec2(uRes.x / uRes.y, 1.0);
  float vg = smoothstep(0.30, 1.02, length(qa) * 1.15);
  c *= 1.0 - uVig * vg;
  c = mix(c, c * vec3(0.9, 0.96, 1.08), vg * 0.5);
  // daño: tinte rojo y bordes sangrando
  c = mix(c, c * vec3(1.45, 0.55, 0.5), uHurt * 0.4);
  c = mix(c, vec3(0.55, 0.0, 0.02), uHurt * smoothstep(0.25, 0.75, length(q)));
  // tramado triangular (mata el banding en nieblas y degradados) + un soplo de grano
  float n = hash12(gl_FragCoord.xy + fract(uTime) * 61.0) + hash12(gl_FragCoord.xy * 1.7 + 17.0) - 1.0;
  c += n * (1.0 / 255.0) * (1.0 + uGrain * 30.0);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class PostFx {
  /**
   * @param {import('three').WebGLRenderer} renderer
   * @param {import('three').Scene} scene
   * @param {import('three').Camera} camera
   */
  constructor(renderer, scene, camera) {
    this.r = renderer; this.scene = scene; this.camera = camera;
    this.rt = null; this.w = 2; this.h = 2; this.samples = 4; this.bloomOn = true; this.hdr = false; this.msaa = 0; this.forceLDR = false; this.fxaa = 'auto';
    this.material = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, uRes: { value: new Vector2(2, 2) },
        uExposure: { value: 1 }, uSat: { value: 1.1 }, uContrast: { value: 1.08 }, uLift: { value: 0.01 }, uTone: { value: 0.55 },
        uVig: { value: 0.35 }, uHurt: { value: 0 }, uTime: { value: 0 }, uGrain: { value: 0.035 }, uCA: { value: 0.0012 },
        uTint: { value: new Color(0, 0, 0) }, uTintA: { value: 0 }, uFxaa: { value: 0 },
        uShadowTint: { value: new Vector3(0.9, 0.98, 1.1) }, uHighTint: { value: new Vector3(1.06, 1.02, 0.92) },
      },
    });
    this.uniforms = this.material.uniforms;
    this.quad = new FullScreenQuad(this.material);
    // bloom de Three (mismos parámetros que el juego original: fuerza, radio, umbral)
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.75, 0.55, 0.82);
    this.bloom.enabled = true;
  }

  /** @param {{samples?:number, bloom?:boolean, fxaa?:'auto'|boolean}} o — fxaa 'auto' (por defecto): activo si el destino no tiene MSAA y el bloom está encendido (táctil en calidad media/alta) */
  configure(o = {}) {
    if (o.fxaa !== undefined) this.fxaa = o.fxaa;
    const samples = o.samples ?? this.samples;
    if (o.bloom !== undefined) this.bloom.enabled = this.bloomOn = !!o.bloom;
    if (samples !== this.samples || !this.rt) { this.samples = samples; this.#makeTarget(); }
  }

  /**
   * Destino HDR de la escena. Defensivo (los móviles son la razón): un adjunto half-float necesita
   * EXT_color_buffer_float o EXT_color_buffer_half_float, y un renderbuffer multimuestreado half-float necesita el primero.
   * Sin ellos el framebuffer queda incompleto y la pantalla en negro, así que se sondea una vez y se cae a 8 bits (sin MSAA) si hace falta.
   */
  #makeTarget() {
    this.rt?.dispose();
    const ext = this.r.extensions, floatOk = ext.has('EXT_color_buffer_float'), halfOk = floatOk || ext.has('EXT_color_buffer_half_float');
    let type = halfOk && !this.forceLDR ? HalfFloatType : UnsignedByteType;
    let samples = type === HalfFloatType && !floatOk ? 0 : this.samples;
    samples = Math.min(samples, this.r.capabilities.maxSamples ?? samples);
    const make = () => new WebGLRenderTarget(this.w, this.h, { type, samples, depthBuffer: true, stencilBuffer: false });
    this.rt = make();
    if (!this.#complete()) { this.rt.dispose(); type = UnsignedByteType; samples = 0; this.rt = make(); this.forceLDR = true; console.warn('[post] destino HDR no soportado: se usa uno de 8 bits'); }
    this.rt.texture.name = 'PostFx.scene';
    this.hdr = type === HalfFloatType; this.msaa = samples;
  }

  #complete() {
    try {
      const gl = this.r.getContext();
      this.r.setRenderTarget(this.rt);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      this.r.setRenderTarget(null);
      return ok;
    } catch { this.r.setRenderTarget(null); return false; }
  }

  /** @param {number} w ancho CSS @param {number} h alto CSS — el tamaño del buffer sale del pixelRatio del renderer */
  setSize(w, h) {
    const pr = this.r.getPixelRatio();
    this.w = Math.max(2, Math.floor(w * pr)); this.h = Math.max(2, Math.floor(h * pr));
    if (!this.rt) this.#makeTarget(); else this.rt.setSize(this.w, this.h);
    this.bloom.setSize(this.w, this.h); // la cadena de mips parte de la mitad de esta resolución
    this.uniforms.uRes.value.set(this.w, this.h);
  }

  render() {
    const r = this.r;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(this.scene, this.camera);
    if (this.bloom.enabled && this.bloom.strength > 0.001) this.bloom.render(r, null, this.rt, 0, false);
    this.uniforms.tScene.value = this.rt.texture;
    this.uniforms.uFxaa.value = (this.fxaa === 'auto' ? this.msaa === 0 && this.bloomOn : !!this.fxaa) ? 1 : 0;
    r.setRenderTarget(null);
    this.quad.render(r);
  }

  dispose() { this.rt?.dispose(); this.bloom.dispose(); this.material.dispose(); this.quad.dispose(); }
}
