/**
 * Cadence — Tonal Chains (differentiator #1).
 * Every ability can carry a tone (low/mid/high). The last 3 casts inside the window form a Phrase.
 *   Triad  (3 distinct)  → "Acorde Pleno": buff (st.tuned) + resource refund + voice charge
 *   Unison (3 same)      → the 3rd cast is Resonant: more area & damage, then that tone's unison is on cooldown
 *   Reprise (A‑B‑A)      → shortens cooldowns of tone A
 * All numbers come from balance.json (cadence) and are tunable by talents via stats `chord.*`.
 * Anti-abuse: internal cooldowns per chord; the damage bonus is its own capped `more` group ("cadence").
 */
export class Cadence {
  constructor(world) { this.w = world; }

  init(e) {
    e.cadenceEnabled = true;
    e.cadence = { phrase: [], icd: {}, unisonUntil: {} };
  }

  onCast(e, ab, cast) {
    const w = this.w, cfg = w.balance.cadence(), now = w.time;
    const cd = e.cadence;
    const window = cfg.windowSeconds + (e.stats.get('chord.window') || 0);
    cd.phrase = cd.phrase.filter((p) => now - p.t <= window);
    cd.phrase.push({ tone: ab.tone, t: now, id: ab.id });
    if (cd.phrase.length > 3) cd.phrase.shift();
    w.events.emit('cadence:phrase', { entity: e, phrase: cd.phrase.map((p) => p.tone) });
    if (cd.phrase.length < 3) return null;

    const tones = cd.phrase.map((p) => p.tone);
    let type = null;
    if (new Set(tones).size === 3) type = 'triad';
    else if (tones[0] === tones[1] && tones[1] === tones[2]) type = 'unison';
    else if (tones[0] === tones[2] && tones[1] !== tones[0]) type = 'reprise';
    if (!type) { cd.phrase.shift(); return null; }

    if (type === 'unison' && (cd.unisonUntil[ab.tone] ?? 0) > now) { cd.phrase.shift(); return null; }
    const icdKey = type;
    if ((cd.icd[icdKey] ?? 0) > now && type !== 'unison') { cd.phrase.shift(); return null; }

    cd.phrase = [];
    const chord = { type, tone: ab.tone, tones };
    switch (type) {
      case 'triad': {
        const c = cfg.triad;
        cd.icd.triad = now + c.internalCooldown;
        const dmg = c.dmg + (e.stats.get('chord.triadDmg') || 0);
        w.status.apply(e, 'st.tuned', { source: e, duration: c.duration + (e.stats.get('chord.triadDuration') || 0), potency: dmg / 0.25, silent: true });
        const refund = c.resourceRefund + (e.stats.get('chord.triadRefund') || 0);
        if (e.res) w.resources.gainFraction(e, refund);
        if (e.voices) e.voices.charges = Math.min(e.voices.max, e.voices.charges + c.voiceCharge);
        if (e.flags.has('triadMarks')) cast.markOnHit = true;
        if (e.flags.has('triadShield')) w.addShield(e, e.hpMax * 0.08, 5);
        break;
      }
      case 'unison': {
        const c = cfg.unison;
        cast.extraMore += c.dmg + (e.stats.get('chord.unisonDmg') || 0);
        cast.areaMult *= 1 + c.area + (e.stats.get('chord.unisonArea') || 0);
        break;
      }
      case 'reprise': {
        const c = cfg.reprise;
        cd.icd.reprise = now + c.internalCooldown;
        const secs = c.cooldownReduce + (e.stats.get('chord.repriseSeconds') || 0);
        for (const id of Object.keys(e.cd)) { const o = w.registry.get(id); if (o && o.tone === ab.tone && id !== ab.id) e.cd[id] -= secs; }
        break;
      }
      default: break;
    }
    w.events.emit('cadence:chord', { entity: e, chord });
    return chord;
  }

  afterUnison(e, cast) {
    const cfg = this.w.balance.cadence();
    e.cadence.unisonUntil[cast.chord.tone] = this.w.time + cfg.unison.cooldown;
  }
}
