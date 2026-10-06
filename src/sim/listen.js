/**
 * Listen (Escucha) — differentiator #2. Holding it spends Breath, slows movement and emits resonance pulses
 * that reveal hidden things within `listenRange`: buried enemies, secret doors, hidden loot, puzzle echoes,
 * resource veins and the true telegraph of dangerous attacks. Anything that can be heard registers an
 * "echo" in world.echoes with a `kind` and an optional `needs` (weather/time/etc.).
 */
export class ListenSystem {
  constructor(world) { this.w = world; }

  init(e) {
    const cfg = this.w.balance.d.listen;
    e.listen = { active: false, breath: cfg.breathSeconds, pulseT: 0, cooldownUntil: 0, lastPulse: -99 };
  }

  maxBreath(e) { return e.stats.get('listenBreath'); }

  begin(e) {
    const l = e.listen, cfg = this.w.balance.d.listen;
    if (!l || l.active || e.dead || e.ctl.stunned) return false;
    if (l.breath < cfg.minBreathToStart) return false;
    l.active = true; l.pulseT = 0;
    this.w.events.emit('listen:start', { entity: e });
    return true;
  }

  end(e) {
    const l = e.listen;
    if (!l?.active) return;
    l.active = false;
    e.listenSlow = 1;
    this.w.events.emit('listen:end', { entity: e });
  }

  update(e, dt) {
    const l = e.listen;
    if (!l) return;
    const cfg = this.w.balance.d.listen, max = this.maxBreath(e);
    if (l.active) {
      l.breath -= dt;
      e.listenSlow = cfg.moveFactor;
      l.pulseT -= dt;
      if (l.pulseT <= 0) { l.pulseT = cfg.pulseInterval; this.pulse(e); }
      if (l.breath <= 0 || e.ctl.stunned || e.dead) { l.breath = Math.max(0, l.breath); this.end(e); l.cooldownUntil = this.w.time + 0.8; }
    } else {
      e.listenSlow = 1;
      l.breath = Math.min(max, l.breath + dt * (max / cfg.breathRegenSeconds));
    }
  }

  pulse(e) {
    const w = this.w;
    const range = e.stats.get('listenRange');
    e.listen.lastPulse = w.time;
    const revealed = [];
    for (const echo of w.echoes) {
      if (echo.dead || echo.found && echo.once) continue;
      if (echo.needs && !echo.needs(w)) continue;
      const d = Math.hypot(echo.x - e.x, echo.z - e.z);
      if (d <= range) {
        echo.revealedUntil = w.time + (echo.holdFor ?? 7);
        if (!echo.found) { echo.found = true; echo.onFirstHeard?.(echo, w); }
        revealed.push(echo);
      }
    }
    for (const o of w.entities) {
      if (o.dead || !o.hidden) continue;
      if (Math.hypot(o.x - e.x, o.z - e.z) <= range * 0.6) { o.revealedHit = true; o.revealedUntil = w.time + 4; revealed.push(o); }
    }
    w.loot?.captureVoices(e);
    w.events.emit('listen:pulse', { entity: e, range, revealed });
  }

  /** world-level maintenance: revealed flags expire */
  tick() {
    const w = this.w;
    for (const o of w.entities) if (o.revealedHit && w.time > o.revealedUntil) o.revealedHit = false;
  }

  isRevealed(echo) { return (echo.revealedUntil ?? 0) > this.w.time; }
}
