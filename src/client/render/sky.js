import * as THREE from 'three';
import { Rng } from '../../core/rng.js';
import { mat, cone, box, group } from './kit.js';

export function buildSky(ambient) {
  const [top, mid, low] = ambient.sky.map((c) => new THREE.Color(c));
  const g = new THREE.SphereGeometry(900, 24, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: top }, uMid: { value: mid }, uLow: { value: low }, uSun: { value: new THREE.Vector3(...ambient.sunDir).normalize() }, uSunCol: { value: new THREE.Color(ambient.sun) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 uTop,uMid,uLow,uSunCol,uSun;
      void main(){ float h = clamp(vD.y,-0.2,1.0);
        vec3 c = mix(uMid, uTop, smoothstep(0.0,0.65,h)); c = mix(uLow, c, smoothstep(-0.2,0.08,h));
        float s = max(dot(normalize(vD), uSun),0.0); c += uSunCol * (pow(s,24.0)*0.55 + pow(s,400.0)*1.4);
        gl_FragColor = vec4(c,1.0); }`,
  });
  const sky = new THREE.Mesh(g, m);
  sky.renderOrder = -10;
  return sky;
}

/** distant mountain ring + drifting cloud banks give depth beyond the playable terrace */
export function buildBackdrop(zone) {
  const g = new THREE.Group();
  g.name = 'backdrop';
  const r = new Rng('backdrop');
  const cx = zone.def.origin[0] + zone.def.size[0] / 2, cz = zone.def.origin[1] + zone.def.size[1] / 2;
  const rock = mat('#8e95a8', { fade: false, flat: true }), rockFar = mat('#a7aec0', { fade: false });
  for (let i = 0; i < 38; i++) {
    const a = (i / 38) * Math.PI * 2 + r.range(-0.05, 0.05), d = r.range(150, 230), h = r.range(35, 110), w = r.range(24, 52);
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), i % 3 ? rock : rockFar);
    m.position.set(cx + Math.sin(a) * d, h / 2 - 10, cz + Math.cos(a) * d);
    m.rotation.y = r.range(0, 6.28);
    m.scale.set(1, 1, r.range(0.8, 1.4));
    g.add(m);
  }
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, fog: true });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(r.range(60, 120), r.range(14, 26)), cloudMat);
    c.rotation.x = -Math.PI / 2;
    c.position.set(cx + r.range(-220, 220), r.range(52, 85), cz + r.range(-220, 220));
    c.userData.speed = r.range(0.4, 1.2);
    g.add(c); clouds.push(c);
  }
  g.userData.update = (t) => { for (const c of clouds) { c.position.x += c.userData.speed * 0.016; if (c.position.x > cx + 260) c.position.x = cx - 260; } };
  return g;
}
