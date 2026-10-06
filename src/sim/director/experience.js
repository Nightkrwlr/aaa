/**
 * Experience Director — gentle pacing assistant (used sparingly, never visible as a "system").
 *  • too long in combat → offers a breather: reveals a nearby echo/cache (invites exploration)
 *  • too long without combat → a dynamic event approaches
 *  • right after a boss → protected quiet period (no random events/ambient aggression)
 *  • hard cap of nudges per hour, all logged for QA.
 */
import { logger } from '../../core/logger.js';
const log = logger('director');

export class ExperienceDirector {
  constructor(session) {
    this.s = session; this.cfg = session.balance.d.director;
    this.combatT = 0; this.quietT = 0; this.sinceBoss = 1e9; this.nudges = []; this.log = [];
    session.events.on('boss', () => { this.sinceBoss = 0; });
  }

  inCombat() {
    const w = this.s.world, p = this.s.player;
    if (!w || !p) return false;
    return w.time - Math.max(p.lastHitTime, p.lastHurtTime) < 6;
  }

  quietPeriod() { return this.sinceBoss < this.cfg.postBossQuietSeconds; }

  update(dt) {
    const s = this.s;
    if (s.mode !== 'overworld' || !s.player || s.player.dead) return;
    this.sinceBoss += dt;
    if (this.inCombat()) { this.combatT += dt; this.quietT = 0; } else { this.quietT += dt; this.combatT = Math.max(0, this.combatT - dt * 0.5); }
    const now = s.state.clock.seconds;
    this.nudges = this.nudges.filter((t) => now - t < 3600);
    if (this.nudges.length >= this.cfg.maxNudgesPerHour || this.quietPeriod()) return;
    if (s.zone?.safeAt(s.player.x, s.player.z)) return;
    if (this.combatT > this.cfg.combatFatigueSeconds) { this.combatT = 0; this.#nudge('breather'); }
    else if (this.quietT > this.cfg.quietFatigueSeconds) { this.quietT = 0; this.#nudge('event'); }
  }

  #nudge(kind) {
    const s = this.s, now = s.state.clock.seconds;
    this.nudges.push(now);
    this.log.push({ t: now, kind });
    log.debug(`director nudge: ${kind}`);
    if (kind === 'breather') s.events.emit('director:breather', { x: s.player.x, z: s.player.z });
    else s.events.emit('director:event_request', {});
  }
}
