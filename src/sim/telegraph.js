import { shapeContains } from './shapes.js';

/**
 * Derives the danger shape of a casting ability so that the client can draw the red telegraph and the
 * bot/QA can verify attacks are avoidable. The same data drives the real hit, so what you see is what hits.
 * returns {shape:{kind,...}, x, z, yaw, benign, hush}|null
 */
export function telegraphOf(ab, caster, cast) {
  const t = ab.telegraph;
  const eff = (ab.effects ?? []).find((e) => ['area', 'dash', 'projectile', 'zone'].includes(e.op));
  let shape = null, at = 'self', benign = false;
  if (t) {
    at = t.at ?? 'self'; benign = !!t.benign;
    const kind = t.shape;
    shape = kind === 'line' ? { kind: 'line', radius: t.length, length: t.length, width: t.width ?? 1 } : { kind, radius: t.radius, angle: t.angle, inner: t.inner };
  } else if (eff) {
    if (eff.op === 'dash') shape = { kind: 'line', radius: eff.distance, length: eff.distance, width: (eff.radius ?? 1) * 2 };
    else if (eff.op === 'projectile') shape = eff.arc ? { kind: 'circle', radius: 2.2 } : { kind: 'line', radius: eff.range ?? 12, length: eff.range ?? 12, width: (eff.radius ?? 0.35) * 2 };
    else shape = { kind: eff.shape ?? 'circle', radius: eff.radius ?? 3, angle: eff.angle, inner: eff.inner, length: eff.length, width: eff.width };
    if (eff.origin === 'aim' || eff.arc) at = 'aim';
  }
  if (!shape) return null;
  const x = at === 'aim' ? cast.aimX : caster.x, z = at === 'aim' ? cast.aimZ : caster.z;
  return { shape, x, z, yaw: cast.yaw, benign, hush: !!t?.hush };
}

/** would the telegraphed shape hit this entity right now? */
export function wouldHit(tel, e) {
  return !!tel && !tel.benign && shapeContains(tel.shape, tel.x, tel.z, tel.yaw, e.x, e.z, e.radius);
}
