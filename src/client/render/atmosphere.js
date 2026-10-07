/**
 * Atmosphere — the "look" of a scene as data: sky, sun, ambient, height-fog, tone/grade parameters, plus the
 * global shader plumbing every world material shares (fog with height falloff and sun scatter, wind, cloud shadows).
 *
 *  - installWorldFog(): replaces three's fog shader chunks ONCE so every fog-enabled material (terrain, instanced props,
 *    structures, characters, VFX meshes) gets exponential HEIGHT fog + warm in-scatter toward the sun, with no per-material work.
 *    The values travel in the stock fog uniforms: fogColor, fogNear (= base density) and fogFar (= height falloff).
 *  - WORLD: shared uniforms (time, wind, cloud shadow) injected into world materials by patchWorldMaterial().
 */
import * as THREE from 'three';
import { getNoiseTexture } from './noiseTex.js';

/** fog object understood by the patched chunks (three sees a plain linear Fog: isFog, color, near, far) */
export class WorldFog {
  constructor(color = '#b8c4cf', density = 0.02, falloff = 0.05) {
    this.isFog = true; this.name = 'WorldFog';
    this.color = new THREE.Color(color); this.near = density; this.far = falloff;
  }
  get density() { return this.near; } set density(v) { this.near = v; }
  get falloff() { return this.far; } set falloff(v) { this.far = v; }
  clone() { return new WorldFog(this.color, this.near, this.far); }
}

/** direction (towards the sun) used for the fog in-scatter tint; the camera yaw is fixed so a constant reads well */
export const FOG_SUN = new THREE.Vector3(-0.78, 0.30, -0.55).normalize();

let fogInstalled = false;
export function installWorldFog() {
  if (fogInstalled) return;
  fogInstalled = true;
  const S = THREE.ShaderChunk;
  S.fog_pars_vertex = `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogWP;
#endif`;
  S.fog_vertex = `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogWP = cameraPosition + transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
#endif`;
  S.fog_pars_fragment = `
#ifdef USE_FOG
	uniform vec3 fogColor;
	uniform float fogNear;
	uniform float fogFar;
	varying float vFogDepth;
	varying vec3 vFogWP;
	const vec3 FOG_SUN_DIR = vec3( ${FOG_SUN.x.toFixed(4)}, ${FOG_SUN.y.toFixed(4)}, ${FOG_SUN.z.toFixed(4)} );
#endif`;
  S.fog_fragment = `
#ifdef USE_FOG
	vec3 fogRay = vFogWP - cameraPosition;
	float fogLen = length( fogRay );
	float fogK = max( fogFar, 0.0 );
	float fogKdy = fogK * fogRay.y;
	float fogAvg = exp( - fogK * cameraPosition.y ) * ( abs( fogKdy ) < 0.001 ? 1.0 : ( 1.0 - exp( - fogKdy ) ) / fogKdy );
	float fogOD = fogNear * fogLen * min( fogAvg, 6.0 );
	float fogFactor = 1.0 - exp( - fogOD * fogOD );
	float fogSun = pow( clamp( dot( fogRay / max( fogLen, 1e-3 ), FOG_SUN_DIR ), 0.0, 1.0 ), 3.0 );
	vec3 fogCol = fogColor * ( 1.0 + fogSun * min( fogFar * 9.0, 1.0 ) * vec3( 0.50, 0.34, 0.14 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, clamp( fogFactor, 0.0, 1.0 ) );
#endif`;
}

/** shared uniforms for world materials (one object, updated once per frame by Scene3D) */
export const WORLD = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector4(0.8, 0.6, 1.0, 0.0) },   // dir.x, dir.z, strength, gust
  uCloud: { value: new THREE.Vector4(0.25, 0.0, 0.0, 0.0) }, // cloud shadow strength, scroll x, scroll z, scale
  uNoise: { value: null },
  uSunTint: { value: new THREE.Color('#ffd9a0') },
  uGlow: { value: 1.0 },       // lantern / window / resonance brightness multiplier (night = high)
  uWet: { value: 0.0 },        // rain wetness 0..1 (darkens the ground)
};

/**
 * GLSL snippets shared by world materials.
 * `worldNoise()` → texture lookups, `cloudShade()` → drifting soft cloud shadows, `windOffset()` → vertex wind.
 */
export const WORLD_GLSL = {
  frag: `
uniform float uTime; uniform vec4 uWind; uniform vec4 uCloud; uniform sampler2D uNoise; uniform vec3 uSunTint; uniform float uWet;
float cloudShade(vec3 wp){
  vec2 p = wp.xz * uCloud.w + vec2(uCloud.y, uCloud.z) * uTime;
  float n = texture2D(uNoise, p).r * 0.65 + texture2D(uNoise, p * 2.3 + 0.37).r * 0.35;
  return 1.0 - uCloud.x * smoothstep(0.38, 0.72, n);
}`,
  vert: `
uniform float uTime; uniform vec4 uWind;
vec3 windOffset(vec3 base, float h, float phase){
  float t = uTime * (1.4 + uWind.z * 0.5);
  float gust = 0.5 + 0.5 * sin(t * 0.37 + base.x * 0.045 + base.z * 0.035);
  float s = sin(t + phase + base.x * 0.31 + base.z * 0.23) * 0.7 + sin(t * 2.3 + phase * 1.7 + base.z * 0.6) * 0.3;
  float amp = (0.5 + 0.9 * gust) * uWind.z * (0.14 + uWind.w) * h;
  return vec3(uWind.x * s * amp, 0.0, uWind.y * s * amp) + vec3(uWind.x, 0.0, uWind.y) * (gust * 0.05 * h * uWind.z);
}`,
};

/** add the shared uniforms to a compiled shader (call inside onBeforeCompile) */
export function bindWorldUniforms(shader) {
  WORLD.uNoise.value ??= getNoiseTexture();
  shader.uniforms.uTime = WORLD.uTime; shader.uniforms.uWind = WORLD.uWind; shader.uniforms.uCloud = WORLD.uCloud;
  shader.uniforms.uNoise = WORLD.uNoise; shader.uniforms.uSunTint = WORLD.uSunTint; shader.uniforms.uWet = WORLD.uWet;
}

const H = (c) => new THREE.Color(c);

/**
 * Presets. Colours are sRGB hex (converted by THREE.Color). `sunDir` is the direction TOWARDS the sun.
 * The camera looks to -x/-z, so a sun at (-x, +z) is "upper-left of the screen": faces towards the camera are lit,
 * shadows fall down-right and the characters keep a readable lit front.
 */
export const PRESETS = {
  dawn: {
    sky: ['#3f5f93', '#a9b9c9', '#f0cfa0'], fog: '#a8b8c8', density: 0.024, falloff: 0.055,
    sun: '#ffd49c', sunIntensity: 2.9, sunDir: [-0.62, 0.52, 0.30], hemi: ['#9bb8e0', '#6e5a48'], hemiIntensity: 1.5,
    exposure: 1.0, bloom: [0.4, 0.7, 1.1], sat: 1.06, contrast: 1.06, vignette: 0.36,
    shadowTint: [0.84, 0.97, 1.16], highTint: [1.10, 1.02, 0.88], lift: 0.012, cloud: 0.3, stars: 0, glow: 0.8, shafts: 0.5,
  },
  noon: {
    sky: ['#3d78c4', '#8fb8e0', '#d6e4ee'], fog: '#b5c8d8', density: 0.016, falloff: 0.05,
    sun: '#fff1d6', sunIntensity: 3.6, sunDir: [-0.5, 0.78, 0.25], hemi: ['#a8c8f0', '#7a6a50'], hemiIntensity: 1.2,
    exposure: 0.95, bloom: [0.4, 0.6, 1.15], sat: 1.12, contrast: 1.08, vignette: 0.3,
    shadowTint: [0.9, 0.98, 1.1], highTint: [1.04, 1.0, 0.94], lift: 0.01, cloud: 0.35, stars: 0, glow: 0.45, shafts: 0.2,
  },
  dusk: {
    sky: ['#2a2f6a', '#9a5f8f', '#ff9a5c'], fog: '#8a6f94', density: 0.024, falloff: 0.05,
    sun: '#ff9a52', sunIntensity: 3.0, sunDir: [-0.82, 0.22, 0.30], hemi: ['#6f78c8', '#4a3040'], hemiIntensity: 0.95,
    exposure: 1.0, bloom: [0.7, 0.8, 0.95], sat: 1.18, contrast: 1.14, vignette: 0.42,
    shadowTint: [0.78, 0.88, 1.28], highTint: [1.18, 0.98, 0.78], lift: 0.016, cloud: 0.3, stars: 0.25, glow: 1.25, shafts: 0.7,
  },
  night: {
    sky: ['#04091c', '#101b3c', '#223a66'], fog: '#142040', density: 0.026, falloff: 0.05,
    sun: '#7fa6ff', sunIntensity: 1.1, sunDir: [-0.55, 0.62, 0.35], hemi: ['#4a68b8', '#1c2030'], hemiIntensity: 0.62,
    exposure: 1.05, bloom: [0.9, 0.9, 0.85], sat: 1.1, contrast: 1.16, vignette: 0.5,
    shadowTint: [0.8, 0.95, 1.3], highTint: [0.96, 1.02, 1.12], lift: 0.02, cloud: 0.12, stars: 1, glow: 1.9, shafts: 0.4,
  },
  overcast: {
    sky: ['#6d7a8a', '#98a3ae', '#b9c0c6'], fog: '#a4adb6', density: 0.03, falloff: 0.045,
    sun: '#e8ecf2', sunIntensity: 2.0, sunDir: [-0.4, 0.8, 0.2], hemi: ['#b6c2d0', '#6e6a60'], hemiIntensity: 1.55,
    exposure: 1.0, bloom: [0.4, 0.7, 1.1], sat: 0.98, contrast: 1.04, vignette: 0.4,
    shadowTint: [0.95, 1.0, 1.06], highTint: [1.0, 1.0, 1.0], lift: 0.015, cloud: 0.1, stars: 0, glow: 0.9, shafts: 0,
  },
};
PRESETS.mist = { ...PRESETS.dawn, fog: '#b8c6d2', density: 0.04, falloff: 0.07, sunIntensity: 2.6, hemiIntensity: 1.2, sat: 1.04, shafts: 0.9, cloud: 0.2 };
PRESETS.rain = { ...PRESETS.overcast, fog: '#8d9aa8', density: 0.034, sunIntensity: 1.5, hemiIntensity: 1.45, sat: 0.94, contrast: 1.06, glow: 1.1 };

/**
 * Build the atmosphere description for a zone. The zone's own `ambient` block (authored data) tints the preset a little so
 * different zones keep their identity while the grade stays coherent.
 */
export function resolveAtmosphere(variant = 'dawn', zoneAmbient = null) {
  const base = PRESETS[variant] ?? PRESETS.dawn;
  const a = {
    variant,
    sky: base.sky.map(H), fog: H(base.fog), density: base.density, falloff: base.falloff,
    sun: H(base.sun), sunIntensity: base.sunIntensity, sunDir: new THREE.Vector3(...base.sunDir).normalize(),
    hemiSky: H(base.hemi[0]), hemiGround: H(base.hemi[1]), hemiIntensity: base.hemiIntensity,
    exposure: base.exposure, bloom: base.bloom, sat: base.sat, contrast: base.contrast, vignette: base.vignette,
    shadowTint: new THREE.Vector3(...base.shadowTint), highTint: new THREE.Vector3(...base.highTint), lift: base.lift,
    cloud: base.cloud, stars: base.stars, glow: base.glow, shafts: base.shafts,
  };
  if (zoneAmbient && variant === 'dawn') {
    // identity from data: 25 % of the authored sky/fog/hemi colours, density from the authored value (scaled to the height-fog model)
    const mixc = (c, hex, k) => { if (hex) c.lerp(H(hex), k); };
    if (zoneAmbient.sky) zoneAmbient.sky.forEach((h, i) => mixc(a.sky[2 - i], h, 0.22));
    mixc(a.fog, zoneAmbient.fog, 0.18);
    mixc(a.hemiSky, zoneAmbient.hemi?.[0], 0.2); mixc(a.hemiGround, zoneAmbient.hemi?.[1], 0.35);
    mixc(a.sun, zoneAmbient.sun, 0.25);
  }
  return a;
}
