import { inSector, segDist } from '../core/math.js';
const DEG = Math.PI / 180;

/**
 * Hit-test of an ability shape against a circle (ex,ez,er).
 * shape: {kind:'circle'|'arc'|'line'|'ring', radius, angle, length, width, inner}
 */
export function shapeContains(s, ox, oz, yaw, ex, ez, er = 0) {
  switch (s.kind) {
    case 'circle': { const rr = s.radius + er; return (ex - ox) ** 2 + (ez - oz) ** 2 <= rr * rr; }
    case 'arc': return inSector(ox, oz, yaw, (s.angle ?? 120) * DEG / 2, s.radius, ex, ez, er);
    case 'line': {
      const l = s.length ?? s.radius;
      const bx = ox + Math.sin(yaw) * l, bz = oz + Math.cos(yaw) * l;
      return segDist(ex, ez, ox, oz, bx, bz).d <= (s.width ?? 1) / 2 + er;
    }
    case 'ring': {
      const d = Math.hypot(ex - ox, ez - oz);
      return d + er >= (s.inner ?? 0) && d - er <= s.radius;
    }
    case 'ringarc': { // ring segment: everything in the ring EXCEPT a gap centred behind `yaw`
      const d = Math.hypot(ex - ox, ez - oz);
      if (!(d + er >= (s.inner ?? 0) && d - er <= s.radius)) return false;
      const a = Math.atan2(ex - ox, ez - oz);
      let diff = Math.abs(((a - yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); // 0 = in front, PI = behind
      return diff <= (s.angle ?? 300) * DEG / 2;
    }
    default: return false;
  }
}

/** bounding radius for broad-phase queries */
export function shapeReach(s) {
  switch (s.kind) {
    case 'line': return (s.length ?? s.radius) + (s.width ?? 1);
    default: return s.radius;
  }
}
