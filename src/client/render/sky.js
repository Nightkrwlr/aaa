/**
 * Sky dome: gradient + sun bloom + drifting clouds + stars, rendered at the far plane around the camera.
 * The horizon colour is the fog colour so distant terrain dissolves into it seamlessly.
 */
import * as THREE from 'three';
import { WORLD, bindWorldUniforms } from './atmosphere.js';
import { getNoiseTexture } from './noiseTex.js';

const VERT = `varying vec3 vDir;
void main(){ vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }`;

const FRAG = `varying vec3 vDir;
uniform vec3 uZenith, uMid, uHorizon, uSunCol, uSun, uCloudCol;
uniform float uTime, uCloud, uStars, uSunPow;
uniform sampler2D uNoise;
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(uHorizon, uMid, smoothstep(-0.02, 0.22, h));
  c = mix(c, uZenith, smoothstep(0.18, 0.75, h));
  c = mix(c, uHorizon * 0.8, smoothstep(0.0, -0.35, h));
  float s = max(dot(d, normalize(uSun)), 0.0);
  c += uSunCol * (pow(s, 6.0) * 0.18 + pow(s, 48.0) * 0.5 + pow(s, uSunPow) * 6.0);
  // clouds: projected onto a plane overhead, two drifting layers
  if (h > 0.01) {
    vec2 p = d.xz / (h + 0.22) * 0.5;
    float n1 = texture2D(uNoise, p * 0.35 + vec2(uTime * 0.004, 0.0)).r;
    float n2 = texture2D(uNoise, p * 0.9 + vec2(-uTime * 0.007, 0.13)).r;
    float cl = smoothstep(0.42 - uCloud * 0.2, 0.78, n1 * 0.65 + n2 * 0.35) * smoothstep(0.0, 0.22, h);
    vec3 cc = mix(uCloudCol * 0.62, uCloudCol * 1.25, smoothstep(0.35, 0.8, n2)) + uSunCol * pow(s, 3.0) * 0.5;
    c = mix(c, cc, cl * (0.55 + uCloud));
  }
  if (uStars > 0.01 && h > 0.0) {
    vec3 g = floor(d * 160.0); float st = step(0.9975, hash13(g)) * (0.5 + 0.5 * hash13(g + 7.0));
    c += vec3(0.8, 0.9, 1.0) * st * uStars * smoothstep(0.02, 0.3, h);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

export function buildSky(atm) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uCloudCol: { value: new THREE.Color('#ffffff') },
      uTime: WORLD.uTime, uCloud: { value: 0.3 }, uStars: { value: 0 }, uSunPow: { value: 900 }, uNoise: { value: getNoiseTexture() },
    },
    vertexShader: VERT, fragmentShader: FRAG,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m);
  mesh.renderOrder = -100; mesh.frustumCulled = false; mesh.name = 'sky';
  mesh.userData.apply = (a) => {
    const u = m.uniforms;
    u.uZenith.value.copy(a.sky[0]); u.uMid.value.copy(a.sky[1]); u.uHorizon.value.copy(a.fog).lerp(a.sky[2], 0.55);
    u.uSunCol.value.copy(a.sun); u.uSun.value.copy(a.sunDir); u.uCloud.value = a.cloud; u.uStars.value = a.stars;
    u.uCloudCol.value.copy(a.sky[1]).lerp(new THREE.Color('#ffffff'), 0.55).lerp(a.sun, 0.12);
  };
  mesh.userData.apply(atm);
  return mesh;
}

/** distant haze layers: low "mist banks" that hug the base of the cliffs (soft, drifting, fogged like everything else) */
export function buildBackdrop(zone) {
  const g = new THREE.Group();
  g.name = 'backdrop';
  g.userData.update = () => {};
  return g;
}
