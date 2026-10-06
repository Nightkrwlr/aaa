/**
 * PlayerController — turns high-level commands (from mouse/keyboard/gamepad/touch/bots) into sim actions.
 * Input layers only write `player.cmd`; this class owns the interpretation, so every scheme feels identical.
 *
 * cmd fields:
 *   moveDir {x,z}|null   direct movement (WASD/stick)
 *   moveTo {x,z}|null    click-to-move destination
 *   attackTarget uid|null  click-attack: approach until in range then use primary
 *   holdPrimary bool     keep attacking at aim point
 *   aim {x,z}            cursor world point
 *   queue [{slot,t}]     buffered skill requests (slot: 's1'..'s6','voice','dodge','primary')
 *   channel bool         held state for channelled skills
 *   listen bool          Listen held
 *   interact uid|null
 */
import { angleTo, turnToward } from '../core/math.js';

export class PlayerController {
  constructor(world) { this.w = world; }

  initCmd(e) {
    e.cmd = { moveDir: null, moveTo: null, attackTarget: null, holdPrimary: false, aim: { x: e.x, z: e.z + 5 }, queue: [], channel: false, listen: false, interact: null };
    e.path = null; e.pathT = 0;
  }

  update(dt) {
    const e = this.w.player;
    if (!e || e.dead) return;
    const c = e.cmd;
    e.aimPoint = c.aim;
    e.channelHeld = c.channel;
    e.intent = null;

    // listen
    const L = this.w.listen;
    if (c.listen && !e.listen.active && this.w.time >= e.listen.cooldownUntil) L.begin(e);
    else if (!c.listen && e.listen.active) L.end(e);
    L.update(e, dt);

    if (e.ctl.stunned || e.dead) return;

    // buffered skills (0.25 s buffer)
    while (c.queue.length && this.w.time - c.queue[0].t > 0.25) c.queue.shift();
    if (c.queue.length) {
      const req = c.queue[0];
      const id = this.slotAbility(e, req.slot);
      if (id) {
        const aim = req.slot === 'dodge' && c.moveDir ? { x: e.x + c.moveDir.x * 5, z: e.z + c.moveDir.z * 5 } : c.aim;
        if (this.w.abilities.tryCast(e, id, aim.x, aim.z, { target: c.attackTarget })) { c.queue.shift(); if (req.slot === 'dodge') { c.moveTo = null; e.path = null; } }
        else {
          const chk = this.w.abilities.canCast(e, id);
          if (!chk.ok && chk.reason !== 'busy') { this.w.events.emit('cast:denied', { entity: e, slot: req.slot, reason: chk.reason }); c.queue.shift(); }
        }
      } else c.queue.shift();
    }

    // direct movement
    if (c.moveDir && (c.moveDir.x || c.moveDir.z)) {
      c.moveTo = null; c.attackTarget = null; e.path = null;
      const l = Math.hypot(c.moveDir.x, c.moveDir.z);
      e.intent = { x: c.moveDir.x / l, z: c.moveDir.z / l, speedMult: Math.min(1, l) };
      if (!e.cast) e.yaw = turnToward(e.yaw, Math.atan2(c.moveDir.x, c.moveDir.z), 18 * dt);
    }

    // click-attack: approach target then use primary
    if (c.attackTarget) {
      const t = this.w.get(c.attackTarget);
      if (!t || t.dead) c.attackTarget = null;
      else {
        const prim = this.slotAbility(e, 'primary');
        const ab = prim && this.w.abilities.resolve(e, prim);
        const reach = (ab?.range ?? 3) + t.radius - 0.2;
        const d = Math.hypot(t.x - e.x, t.z - e.z);
        if (d <= reach) {
          e.path = null; c.moveTo = null;
          if (prim) this.w.abilities.tryCast(e, prim, t.x, t.z, { target: t.uid });
          if (!e.cast) e.yaw = turnToward(e.yaw, angleTo(e.x, e.z, t.x, t.z), 20 * dt);
        } else this.#goTo(e, t.x, t.z, dt, 0.5);
      }
    } else if (c.moveTo) {
      const d = this.#goTo(e, c.moveTo.x, c.moveTo.z, dt, 0.25);
      if (d < 0.3) { c.moveTo = null; e.path = null; }
    }

    // hold primary (attack in place toward cursor)
    if (c.holdPrimary && !c.attackTarget) {
      const prim = this.slotAbility(e, 'primary');
      if (prim) this.w.abilities.tryCast(e, prim, c.aim.x, c.aim.z);
    }
  }

  #goTo(e, x, z, dt, arrive) {
    const w = this.w;
    const d = Math.hypot(x - e.x, z - e.z);
    if (d < arrive) return d;
    if (!e.path || w.time - e.pathT > 0.5 || !e.pathGoal || Math.hypot(e.pathGoal.x - x, e.pathGoal.z - z) > 0.8) {
      e.path = w.nav.findPath(e.x, e.z, x, z, { radius: 0.35 });
      e.pathT = w.time; e.pathGoal = { x, z };
    }
    if (e.path?.length) {
      let wp = e.path[0];
      while (e.path.length > 1 && Math.hypot(wp.x - e.x, wp.z - e.z) < 0.5) { e.path.shift(); wp = e.path[0]; }
      const dx = wp.x - e.x, dz = wp.z - e.z, l = Math.hypot(dx, dz) || 1;
      e.intent = { x: dx / l, z: dz / l, speedMult: 1 };
      if (!e.cast) e.yaw = turnToward(e.yaw, Math.atan2(dx, dz), 18 * dt);
    } else { e.cmd.moveTo = null; }
    return d;
  }

  slotAbility(e, slot) { return e.loadout?.[slot] ?? null; }

  // convenience API for input layers & bots
  castSlot(e, slot) { e.cmd.queue.push({ slot, t: this.w.time }); }
}
