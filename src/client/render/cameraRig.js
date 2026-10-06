import * as THREE from 'three';
import { clamp, damp } from '../../core/math.js';

/**
 * Isometric 3/4 camera: fixed yaw (45°), pitch ~46°, zoomable, with look-ahead toward aim/movement,
 * smooth follow, ground-height damping, shake (reducible) and cinematic override for key moments.
 */
export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = Math.PI / 4;
    this.pitch = THREE.MathUtils.degToRad(46);
    this.zoom = 32; this.zoomTarget = 32; this.zoomMin = 15; this.zoomMax = 38;
    this.target = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.ahead = new THREE.Vector2();
    this.shake = 0; this.shakeScale = 1;
    this.cine = null;
    this.initialised = false;
    this.offset = new THREE.Vector3();
  }

  addShake(a) { this.shake = Math.min(1.2, this.shake + a * this.shakeScale); }
  setZoom(z) { this.zoomTarget = clamp(z, this.zoomMin, this.zoomMax); }
  wheel(dy) { this.setZoom(this.zoomTarget + dy * 0.012); }

  /** @param {{x:number,y:number,z:number}} focus ground-position of the player @param {{x:number,z:number}} aimDir */
  update(dt, focus, aimDir, t) {
    const k = damp(7, dt);
    this.zoom += (this.zoomTarget - this.zoom) * damp(6, dt);
    // look-ahead
    this.ahead.x += ((aimDir?.x ?? 0) * 2.4 - this.ahead.x) * damp(2.5, dt);
    this.ahead.y += ((aimDir?.z ?? 0) * 2.4 - this.ahead.y) * damp(2.5, dt);
    let fx = focus.x + this.ahead.x, fy = focus.y + 1.0, fz = focus.z + this.ahead.y;
    if (this.cine) { fx = this.cine.x; fy = this.cine.y; fz = this.cine.z; }
    if (!this.initialised) { this.target.set(fx, fy, fz); this.initialised = true; }
    this.target.x += (fx - this.target.x) * k;
    this.target.z += (fz - this.target.z) * k;
    this.target.y += (fy - this.target.y) * damp(3.5, dt);
    const d = this.cine?.zoom ?? this.zoom;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.offset.set(Math.sin(this.yaw) * cp * d, sp * d, Math.cos(this.yaw) * cp * d);
    this.cam.position.copy(this.target).add(this.offset);
    // shake
    if (this.shake > 0.001) {
      this.cam.position.x += (Math.sin(t * 61) + Math.sin(t * 37)) * 0.12 * this.shake;
      this.cam.position.y += Math.sin(t * 53) * 0.1 * this.shake;
      this.cam.position.z += (Math.cos(t * 47) + Math.sin(t * 29)) * 0.12 * this.shake;
      this.shake *= Math.exp(-7 * dt);
    }
    this.cam.lookAt(this.target);
  }

  /** screen-up on the ground plane (world direction for "W") */
  forwardDir() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  rightDir() { return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) }; }
}
