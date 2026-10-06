export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const angleTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az); // yaw: 0 = +Z, clockwise toward +X
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function turnToward(cur, target, maxStep) {
  const d = angleDiff(cur, target);
  return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep;
}
export const fwd = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
export function approach(v, target, step) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}
/** exponential smoothing factor independent of frame rate */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
/** diminishing returns: value → value / (value + k) scaled to max */
export function diminish(value, k, max = 1) { return value <= 0 ? 0 : max * (value / (value + k)); }
export function round(v, d = 2) { const m = 10 ** d; return Math.round(v * m) / m; }
/** point-in-sector test (yaw convention above). halfAngle in radians */
export function inSector(ox, oz, yaw, halfAngle, range, px, pz, pad = 0) {
  const dx = px - ox, dz = pz - oz;
  const d = Math.hypot(dx, dz);
  if (d > range + pad) return false;
  if (d < 0.001 || halfAngle >= Math.PI) return true;
  const a = Math.atan2(dx, dz);
  const slack = pad > 0 ? Math.asin(Math.min(1, pad / Math.max(d, 0.001))) : 0;
  return Math.abs(angleDiff(yaw, a)) <= halfAngle + slack;
}
/** distance from point to segment, plus param t */
export function segDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const l2 = abx * abx + abz * abz;
  let t = l2 === 0 ? 0 : ((px - ax) * abx + (pz - az) * abz) / l2;
  t = clamp(t, 0, 1);
  return { d: Math.hypot(px - (ax + abx * t), pz - (az + abz * t)), t };
}
/** deep clone for plain JSON-like data */
export function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
export function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}
/** get/set by dotted path */
export function getPath(obj, path) {
  let cur = obj;
  for (const k of path.split('.')) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}
export function setPath(obj, path, value) {
  const ks = path.split('.');
  let cur = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    if (cur[ks[i]] == null || typeof cur[ks[i]] !== 'object') cur[ks[i]] = {};
    cur = cur[ks[i]];
  }
  cur[ks[ks.length - 1]] = value;
}
