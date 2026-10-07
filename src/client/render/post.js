/**
 * PostFx — the frame pipeline: scene → (MSAA, half-float HDR target) → [SSAO] → [bloom] → final pass
 * (filmic tone mapping, split-tone grade, vignette, grain/dither, Listen / hurt / flash / colour-blind filters).
 *
 * Why custom instead of EffectComposer: tone mapping must happen once, at the very end, so every ShaderMaterial in the game
 * (particles, ground decals, beams, gate curtain) is tone-mapped consistently without knowing about it, and the depth texture of the
 * beauty pass (what is REALLY drawn, dither-faded walls included) can feed the AO pass.
 */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tAO;
uniform vec2 uRes;
uniform float uHasAO, uAOStrength;
uniform float uExposure, uSat, uContrast, uVig, uLift, uTime, uListen, uFlash, uHurt, uCB, uGrain, uTone;
uniform vec3 uShadowTint, uHighTint;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Narkowicz ACES fit (filmic shoulder, rich shadows)
vec3 tAces(vec3 x){ const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
// Khronos PBR Neutral (keeps authored albedo colours, compresses only the highlights)
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

void main(){
  vec2 uv = vUv;
  vec2 q = uv - 0.5;
  // Listen: slow lens ripple
  if (uListen > 0.001) uv += normalize(q + 1e-4) * sin(length(q) * 40.0 - uTime * 4.0) * 0.0015 * uListen;
  vec3 hdr = texture2D(tScene, uv).rgb;
  if (uHasAO > 0.5) { float ao = texture2D(tAO, uv).r; hdr *= mix(1.0, ao, uAOStrength); }
  hdr *= uExposure;
  vec3 lin = mix(tNeutral(hdr), tAces(hdr), uTone);
  vec3 c = oetf(lin);
  // lift blacks a hair so deep shadows keep colour instead of crushing
  c = c * (1.0 - uLift) + uLift;
  // split tone: cool shadows, warm highlights
  float l = luma(c);
  c *= mix(uShadowTint, uHighTint, smoothstep(0.12, 0.8, l));
  c = mix(vec3(luma(c)), c, uSat);
  c = mix(c, c * c * (3.0 - 2.0 * c), clamp((uContrast - 1.0) * 3.0, 0.0, 1.0));
  c = (c - 0.5) * (1.0 + max(uContrast - 1.35, 0.0)) + 0.5;
  // Listen: desaturate, cool tint
  if (uListen > 0.001) {
    float ll = luma(c); vec3 cool = vec3(ll * 0.82, ll * 1.04, ll * 1.3);
    c = mix(c, cool, uListen * 0.55);
    c *= 1.0 - uListen * 0.10 * (0.5 + 0.5 * sin(length(q) * 28.0 - uTime * 3.0));
  }
  // vignette (aspect corrected, slightly cool/dark)
  vec2 qa = q * vec2(uRes.x / uRes.y, 1.0);
  float vg = smoothstep(0.30, 1.02, length(qa) * 1.15);
  c *= 1.0 - uVig * vg;
  c = mix(c, c * vec3(0.9, 0.96, 1.08), vg * 0.5);
  c += vec3(uFlash * 0.35);
  c = mix(c, c * vec3(1.25, 0.7, 0.7), uHurt * smoothstep(0.2, 0.9, length(q) * 1.6));
  if (uCB > 0.5 && uCB < 1.5) { c = vec3(c.r * 0.567 + c.g * 0.433, c.r * 0.558 + c.g * 0.442, c.g * 0.242 + c.b * 0.758); }
  else if (uCB > 1.5 && uCB < 2.5) { c = vec3(c.r * 0.625 + c.g * 0.375, c.r * 0.7 + c.g * 0.3, c.g * 0.3 + c.b * 0.7); }
  else if (uCB > 2.5) { c = vec3(c.r * 0.95 + c.g * 0.05, c.g * 0.433 + c.b * 0.567, c.g * 0.475 + c.b * 0.525); }
  // triangular dither (kills banding in fog / sky gradients) + a breath of film grain
  float n = hash12(gl_FragCoord.xy + fract(uTime) * 61.0) + hash12(gl_FragCoord.xy * 1.7 + 17.0) - 1.0;
  c += n * (1.0 / 255.0) * (1.0 + uGrain * 3.0);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class PostFx {
  constructor(renderer, scene, camera) {
    this.r = renderer; this.scene = scene; this.camera = camera;
    this.rt = null; this.w = 2; this.h = 2; this.samples = 4; this.bloomOn = false; this.aoOn = false;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tAO: { value: null }, uRes: { value: new THREE.Vector2(2, 2) }, uHasAO: { value: 0 }, uAOStrength: { value: 1 },
        uExposure: { value: 1 }, uSat: { value: 1.1 }, uContrast: { value: 1.08 }, uVig: { value: 0.35 }, uLift: { value: 0.01 }, uTime: { value: 0 },
        uListen: { value: 0 }, uFlash: { value: 0 }, uHurt: { value: 0 }, uCB: { value: 0 }, uGrain: { value: 0.35 }, uTone: { value: 0.55 },
        uShadowTint: { value: new THREE.Vector3(0.88, 0.98, 1.12) }, uHighTint: { value: new THREE.Vector3(1.08, 1.02, 0.9) },
      },
    });
    this.u = this.material.uniforms;
    this.quad = new FullScreenQuad(this.material);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.55, 0.7, 1.05);
    this.bloom.enabled = true;
  }

  /** @param {{samples:number, bloom:boolean, ao?:boolean}} o */
  configure(o) {
    const samples = o.samples ?? 4, wasBloom = this.bloomOn;
    this.bloomOn = !!o.bloom; this.aoOn = !!o.ao;
    if (samples !== this.samples || !this.rt) { this.samples = samples; this.#makeTarget(); }
    if (this.bloomOn && !wasBloom) this.bloom.setSize(this.w, this.h);       // the bloom mip chain is only allocated while bloom is on (phones: ~10 MB saved)
  }

  /**
   * The HDR scene target. Phones are the reason this is defensive: a half-float colour attachment needs EXT_color_buffer_float or
   * EXT_color_buffer_half_float, and a multisampled half-float renderbuffer needs the former. Without them the framebuffer is
   * incomplete and the whole screen is black, so the target is probed once and falls back to plain 8-bit (and no MSAA) when needed.
   */
  #makeTarget() {
    this.rt?.dispose();
    const ext = this.r.extensions, floatOk = ext.has('EXT_color_buffer_float'), halfOk = floatOk || ext.has('EXT_color_buffer_half_float');
    let type = halfOk && !this.forceLDR ? THREE.HalfFloatType : THREE.UnsignedByteType;
    let samples = type === THREE.HalfFloatType && !floatOk ? 0 : this.samples;
    samples = Math.min(samples, this.r.capabilities.maxSamples ?? samples);
    const make = () => new THREE.WebGLRenderTarget(this.w, this.h, { type, samples, depthBuffer: true, stencilBuffer: false });
    this.rt = make();
    if (!this.#complete()) { this.rt.dispose(); type = THREE.UnsignedByteType; samples = 0; this.rt = make(); this.forceLDR = true; console.warn('[post] HDR target unsupported on this GPU: using an 8-bit scene target'); }
    this.rt.texture.name = 'PostFx.scene';
    this.hdr = type === THREE.HalfFloatType; this.msaa = samples;
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

  /** @param {number} w css width @param {number} h css height — drawing-buffer size is derived from the renderer's pixel ratio */
  setSize(w, h) {
    const pr = this.r.getPixelRatio();
    this.w = Math.max(2, Math.floor(w * pr)); this.h = Math.max(2, Math.floor(h * pr));
    if (!this.rt) this.#makeTarget(); else this.rt.setSize(this.w, this.h);
    if (this.bloomOn) this.bloom.setSize(this.w, this.h);
    this.u.uRes.value.set(this.w, this.h);
  }

  render(time) {
    const r = this.r;
    r.info.reset();
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(this.scene, this.camera);
    if (this.bloomOn && this.bloom.strength > 0.001) this.bloom.render(r, null, this.rt, 0, false);
    this.u.tScene.value = this.rt.texture;
    this.u.uTime.value = time;
    r.setRenderTarget(null);
    this.quad.render(r);
  }

  dispose() { this.rt?.dispose(); this.bloom.dispose(); this.material.dispose(); this.quad.dispose(); }
}
