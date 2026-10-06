import { angleTo, turnToward, clamp, TAU } from '../../core/math.js';

export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function faceTarget(e, t, dt, rate = 9) {
  if (!t || e.cast) return;
  e.yaw = turnToward(e.yaw, angleTo(e.x, e.z, t.x, t.z), rate * dt);
}

/** set intent to head straight to a point. returns remaining distance */
export function stepToward(e, x, z, speedMult = 1) {
  const dx = x - e.x, dz = z - e.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return d;
  e.intent = { x: dx / d, z: dz / d, speedMult };
  if (!e.cast) e.yaw = turnToward(e.yaw, Math.atan2(dx, dz), 12 * (e.ai?.dt ?? 0.016));
  return d;
}

export function moveAway(e, x, z, speedMult = 1) {
  const dx = e.x - x, dz = e.z - z;
  const d = Math.hypot(dx, dz) || 1;
  e.intent = { x: dx / d, z: dz / d, speedMult };
  if (!e.cast) e.yaw = turnToward(e.yaw, Math.atan2(dx, dz), 10 * (e.ai?.dt ?? 0.016));
}

/** orbit/strafe around target at current distance. dir = ±1 */
export function strafe(e, t, dir = 1, speedMult = 0.7, pull = 0) {
  const dx = e.x - t.x, dz = e.z - t.z;
  const d = Math.hypot(dx, dz) || 1;
  const tx = -dz / d * dir, tz = dx / d * dir;
  const rx = -dx / d * pull, rz = -dz / d * pull;
  const l = Math.hypot(tx + rx, tz + rz) || 1;
  e.intent = { x: (tx + rx) / l, z: (tz + rz) / l, speedMult };
  if (!e.cast) e.yaw = turnToward(e.yaw, angleTo(e.x, e.z, t.x, t.z), 8 * (e.ai?.dt ?? 0.016));
}

/**
 * Path-following move toward (x,z). Uses LOS shortcut, A* otherwise (budgeted, cached).
 * returns distance to goal.
 */
export function followTo(sys, e, x, z, speedMult = 1, dt = 0.016) {
  const w = sys.w, ai = e.ai;
  e.ai.dt = dt;
  const d = Math.hypot(x - e.x, z - e.z);
  if (d < 0.5) return d;
  if (!ai.losGoalAt || w.time - ai.losGoalAt > 0.2) {
    ai.losGoalAt = w.time;
    ai.losGoal = w.nav.los(e.x, e.z, x, z, e.radius * 0.8);
  }
  if (ai.losGoal) { ai.path = null; stepToward(e, x, z, speedMult); return d; }
  const goalMoved = !ai.pathGoal || Math.hypot(ai.pathGoal.x - x, ai.pathGoal.z - z) > 2.5;
  if ((!ai.path || goalMoved || w.time - (ai.pathT ?? 0) > 1.5 || ai.pathVer !== w.nav.version) && sys.pathBudget > 0) {
    sys.pathBudget--; sys.stats.paths++;
    ai.path = w.nav.findPath(e.x, e.z, x, z, { radius: e.radius * 0.9 });
    ai.pathGoal = { x, z }; ai.pathT = w.time; ai.pathVer = w.nav.version;
  }
  if (ai.path && ai.path.length) {
    let wp = ai.path[0];
    while (ai.path.length > 1 && Math.hypot(wp.x - e.x, wp.z - e.z) < 0.7) { ai.path.shift(); wp = ai.path[0]; }
    stepToward(e, wp.x, wp.z, speedMult);
  } else stepToward(e, x, z, speedMult * 0.6);
  return d;
}

export function tryAbility(e, w, id, t, extra = {}) {
  return w.abilities.tryCast(e, id, t.x, t.z, { target: t.uid, ...extra });
}

/** choose a castable ability for current distance. returns id|null */
export function pickAbility(e, w, t, d, filter) {
  const cands = [];
  const hpf = e.hp / e.hpMax;
  for (const id of e.abilityIds) {
    const ab = w.abilities.resolve(e, id);
    if (!ab) continue;
    const a = ab.ai ?? {};
    const max = (a.maxRange ?? ab.range ?? 2) + t.radius;
    const min = a.minRange ?? 0;
    if (d > max || d < min) continue;
    if (a.hpBelow !== undefined && hpf > a.hpBelow) continue;
    if (a.hpAbove !== undefined && hpf < a.hpAbove) continue;
    if (a.phase !== undefined && (e.phase ?? 1) !== a.phase) continue;
    if (a.minPhase !== undefined && (e.phase ?? 1) < a.minPhase) continue;
    if (filter && !filter(ab)) continue;
    if (!w.abilities.canCast(e, id).ok) continue;
    cands.push({ id, weight: a.weight ?? 1 });
  }
  if (!cands.length) return null;
  return w.rng.weighted(cands).id;
}

export function alliesNear(w, e, r, pred) {
  return w.queryCircle(e.x, e.z, r, (o) => o !== e && o.team === e.team && !o.dead && (!pred || pred(o)));
}

export function hasLos(w, e, t) { return w.nav.los(e.x, e.z, t.x, t.z, 0.15); }

/** melee attack tokens: at most N melee enemies press the player at once, others orbit */
export function requestToken(w, e, max) {
  const tk = (w.tokens ??= { holders: new Map(), t: 0 });
  if (w.time - tk.t > 0.25) {
    tk.t = w.time;
    for (const [uid, until] of tk.holders) { const o = w.get(uid); if (!o || o.dead || until < w.time) tk.holders.delete(uid); }
  }
  if (tk.holders.has(e.uid)) { tk.holders.set(e.uid, w.time + 1.2); return true; }
  if (tk.holders.size < max) { tk.holders.set(e.uid, w.time + 1.2); return true; }
  return false;
}
export function releaseToken(w, e) { w.tokens?.holders.delete(e.uid); }

/** position on a circle around target at angle offset from the target→self direction */
export function ringPoint(t, from, radius, angleOffset) {
  const base = Math.atan2(from.x - t.x, from.z - t.z) + angleOffset;
  return { x: t.x + Math.sin(base) * radius, z: t.z + Math.cos(base) * radius };
}
export { TAU, clamp };
