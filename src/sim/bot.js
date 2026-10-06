/**
 * Bot — a scripted player for QA, balance simulation and E2E. Uses only the public command API
 * (player.cmd + controller) exactly like input devices do, so what it can do a human can do.
 * Skills: cooldown skills rotate by tone to chase chords, dodge reads real telegraphs.
 */
import { telegraphOf, wouldHit } from './telegraph.js';

export class Bot {
  constructor(world, opts = {}) {
    this.w = world;
    this.skill = opts.skill ?? 0.9;        // 0..1: probability of reacting to a telegraph
    this.reaction = opts.reaction ?? 0.18; // seconds before impact at which it dodges
    this.kite = opts.kite ?? false;
    this.slots = opts.slots ?? ['s1', 's2', 's3', 's4'];
    this.lastTone = null;
    this.dodges = 0; this.dodgedHits = 0;
    this.idle = opts.idle ?? false;
    this.range = opts.range ?? null;
  }

  update(dt) {
    const w = this.w, p = w.player;
    if (!p || p.dead) return;
    const c = p.cmd;
    if (this.idle) return;
    // ── dodge incoming telegraphs
    if (p.invuln === 0 && !p.dash) {
      for (const e of w.entities) {
        if (e.dead || !e.cast || e.team === p.team || e.cast.phase !== 'windup') continue;
        const left = e.cast.windup - e.cast.t;
        if (left > this.reaction || left < 0) continue;
        const tel = telegraphOf(e.cast.ab, e, e.cast);
        if (tel && wouldHit(tel, p) && w.rng.next() < this.skill * 0.35) { // per-frame chance over the window
          const away = this.dodgeDir(p, e);
          c.moveDir = null;
          c.queue.length = 0;
          p.cmd.aim = { x: p.x + away.x * 5, z: p.z + away.z * 5 };
          w.abilities.tryCast(p, p.loadout.dodge, p.cmd.aim.x, p.cmd.aim.z);
          this.dodges++;
          return;
        }
      }
    }
    // ── pick target
    const tgt = this.pickTarget(p);
    if (!tgt) { c.attackTarget = null; c.holdPrimary = false; c.moveDir = null; return; }
    c.aim = { x: tgt.x, z: tgt.z };
    const d = Math.hypot(tgt.x - p.x, tgt.z - p.z);
    // ── skills
    if (!p.cast || p.cast.phase === 'recover') {
      for (const slot of this.slots) {
        const id = p.loadout[slot];
        if (!id) continue;
        const chk = w.abilities.canCast(p, id);
        if (!chk.ok) continue;
        const ab = chk.ab;
        if (ab.range && d > ab.range + tgt.radius + 0.5 && ab.aim !== 'self') continue;
        if (ab.aim === 'self' && ab.range && d > ab.range + 1) continue;
        if (ab.tags.includes('buff') && !ab.tags.includes('attack') && p.hp / p.hpMax > 0.8 && w.status.has(p, ab.effects[0]?.status)) continue;
        if (ab.tone && ab.tone === this.lastTone && this.chaseChords) continue;
        if (w.abilities.tryCast(p, id, tgt.x, tgt.z, { target: tgt.uid })) { if (ab.tone) this.lastTone = ab.tone; return; }
      }
    }
    c.attackTarget = tgt.uid;
    c.holdPrimary = false;
    if (this.kite && d < 5) c.moveDir = { x: p.x - tgt.x, z: p.z - tgt.z }; else c.moveDir = null;
    if (this.range !== null && d > this.range) c.attackTarget = tgt.uid;
  }

  pickTarget(p) {
    let best = null, bd = 28 * 28;
    for (const e of this.w.entities) {
      if (e.dead || e.team !== 'enemy' || e.untargetable || e.hidden) continue;
      let d = (e.x - p.x) ** 2 + (e.z - p.z) ** 2;
      if (e.role?.includes('support') || e.role?.includes('summoner')) d *= 0.6;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  dodgeDir(p, e) {
    // perpendicular to the attacker direction, toward the side with more room
    const dx = p.x - e.x, dz = p.z - e.z, l = Math.hypot(dx, dz) || 1;
    const px = -dz / l, pz = dx / l;
    const s = this.w.nav.isWalkable(p.x + px * 3, p.z + pz * 3) ? 1 : -1;
    return { x: px * s * 0.9 + dx / l * 0.2, z: pz * s * 0.9 + dz / l * 0.2 };
  }
}
