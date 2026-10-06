import * as THREE from 'three';

/**
 * CharAnimator — animation state machine for KayKit-rigged characters (all 9 characters share one skeleton and one
 * 72-clip library, see docs/ASSET_CATALOG.md). It is driven every frame by the simulation state that EntityViews
 * assembles (`st`), never by timers of its own, so what you see is what the sim is doing:
 *
 *   dead  → death clip (clamped on its last frame; the view then sinks the corpse)
 *   spawn → awaken / rise clip (summons, ambushers)
 *   dash  → directional dodge clip scrubbed by dash progress (player roll) | fast run + lean (charges, rushes)
 *   cast  → attack / cast clip SCRUBBED by the sim cast phase: the clip's own impact frame is mapped onto the sim's
 *           windup→impact moment, and its follow-through onto the recover phase, so the swing visually lands exactly
 *           when the damage does (also under hit-stop, haste and slows).
 *   hit   → Hit_A/B (or Block_Hit for a frontal shield block) unless a cast is in progress (super-armour)
 *   emote → cheer / interact / pick-up / taunt / idle variations (triggered by gameplay events)
 *   loco  → idle / combat idle / walk / run, clip chosen by real ground speed and playback rate = speed / stride
 *           speed so feet do not slide
 *
 * Clip numbers below were measured from the shipped Rig_Medium library (tools: artifacts clip-metrics script):
 * d = duration (s), i = impact time (s) (peak hand speed / release frame), stride = planted-foot speed at scale 1 (m/s).
 */

export const CLIP_INFO = {
  '1H_Melee_Attack_Chop': { d: 1.067, i: 0.6 },
  '1H_Melee_Attack_Jump_Chop': { d: 1.333, i: 0.73 },
  '1H_Melee_Attack_Slice_Diagonal': { d: 1.0, i: 0.4 },
  '1H_Melee_Attack_Slice_Horizontal': { d: 1.067, i: 0.34 },
  '1H_Melee_Attack_Stab': { d: 1.6, i: 0.4 },
  '2H_Melee_Attack_Chop': { d: 1.633, i: 0.78 },
  '2H_Melee_Attack_Slice': { d: 1.1, i: 0.4 },
  '2H_Melee_Attack_Spin': { d: 2.4, i: 0.7 },
  '2H_Melee_Attack_Spinning': { d: 0.667, i: 0.43 },
  '2H_Melee_Attack_Stab': { d: 1.6, i: 0.4 },
  Dualwield_Melee_Attack_Chop: { d: 1.267, i: 0.57 },
  Dualwield_Melee_Attack_Slice: { d: 1.167, i: 0.57 },
  Dualwield_Melee_Attack_Stab: { d: 1.6, i: 0.4 },
  Unarmed_Melee_Attack_Kick: { d: 0.933, i: 0.33 },
  Unarmed_Melee_Attack_Punch_A: { d: 1.467, i: 0.43 },
  Unarmed_Melee_Attack_Punch_B: { d: 1.667, i: 0.5 },
  Block_Attack: { d: 1.067, i: 0.37 },
  Throw: { d: 1.367, i: 0.73 },
  '1H_Ranged_Shoot': { d: 1.067, i: 0.3 },
  '2H_Ranged_Shoot': { d: 1.067, i: 0.3 },
  Spellcast_Shoot: { d: 0.933, i: 0.3 },
  Spellcast_Raise: { d: 2.1, i: 0.85 },
  Spellcast_Long: { d: 2.533, i: 1.0 },
  Spellcast_Summon: { d: 4.3, i: 2.9 },
  Spellcasting: { d: 0.667, i: 0.35 },
  Taunt: { d: 1.033, i: 0.67 },
  Taunt_Longer: { d: 3.0, i: 1.4 },
  Use_Item: { d: 1.6, i: 0.45 },
  Interact: { d: 1.3, i: 0.5 },
  PickUp: { d: 1.3, i: 0.55 },
  Cheer: { d: 1.667, i: 0.5 },
  Hit_A: { d: 0.667, i: 0.1 },
  Hit_B: { d: 0.867, i: 0.1 },
  Block_Hit: { d: 1.067, i: 0.1 },
  Dodge_Forward: { d: 0.4, i: 0.2 },
  Dodge_Backward: { d: 0.4, i: 0.2 },
  Dodge_Left: { d: 0.4, i: 0.2 },
  Dodge_Right: { d: 0.4, i: 0.2 },
  Death_A: { d: 0.8, i: 0.5 },
  Death_B: { d: 2.633, i: 1.2 },
  Death_C_Skeletons: { d: 2.0, i: 1.0 },
  Skeletons_Awaken_Standing: { d: 1.0, i: 0.5 },
  Skeletons_Awaken_Floor: { d: 2.3, i: 1.2 },
  Spawn_Ground_Skeletons: { d: 3.567, i: 1.5 },
  Spawn_Ground: { d: 1.3, i: 0.8 },
  Spawn_Air: { d: 1.3, i: 0.8 },
};
/** planted-foot speed of the loop clips at character scale 1 (m/s) */
export const STRIDE = { Walking_A: 0.73, Walking_B: 0.72, Walking_C: 0.49, Walking_D_Skeletons: 0.49, Running_A: 3.49, Running_B: 2.18, Running_C: 3.42 };

// ───────────────────────── ability hint → clip tables
// styles: 2h (two-handed melee) · 1h (one-hand + optional shield) · dual · unarmed · staff (caster) · beast fallback = unarmed
const MELEE = {
  swing_h: { '2h': ['2H_Melee_Attack_Slice', '2H_Melee_Attack_Chop'], '1h': ['1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Slice_Diagonal'], dual: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop'], unarmed: ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B'], staff: ['2H_Melee_Attack_Slice'] },
  swing: { '2h': ['2H_Melee_Attack_Slice'], '1h': ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop'], dual: ['Dualwield_Melee_Attack_Slice'], unarmed: ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B'], staff: ['2H_Melee_Attack_Slice'] },
  slam: { '2h': ['2H_Melee_Attack_Chop'], '1h': ['1H_Melee_Attack_Chop'], dual: ['Dualwield_Melee_Attack_Chop'], unarmed: ['Unarmed_Melee_Attack_Punch_B'], staff: ['2H_Melee_Attack_Chop'] },
  stab: { '2h': ['2H_Melee_Attack_Stab'], '1h': ['1H_Melee_Attack_Stab'], dual: ['Dualwield_Melee_Attack_Stab'], unarmed: ['Unarmed_Melee_Attack_Punch_A'], staff: ['2H_Melee_Attack_Stab'] },
  spin: { '2h': ['2H_Melee_Attack_Spin'], '1h': ['2H_Melee_Attack_Spin'], dual: ['Dualwield_Melee_Attack_Chop'], unarmed: ['Unarmed_Melee_Attack_Kick'], staff: ['2H_Melee_Attack_Spin'] },
  leap: { '2h': ['1H_Melee_Attack_Jump_Chop'], '1h': ['1H_Melee_Attack_Jump_Chop'], dual: ['1H_Melee_Attack_Jump_Chop'], unarmed: ['1H_Melee_Attack_Jump_Chop'], staff: ['1H_Melee_Attack_Jump_Chop'] },
  bash: { '2h': ['Block_Attack'], '1h': ['Block_Attack'], dual: ['Unarmed_Melee_Attack_Kick'], unarmed: ['Unarmed_Melee_Attack_Kick'], staff: ['Unarmed_Melee_Attack_Kick'] },
  knell: { '2h': ['2H_Melee_Attack_Spin'], '1h': ['1H_Melee_Attack_Jump_Chop'], dual: ['Dualwield_Melee_Attack_Chop'], unarmed: ['1H_Melee_Attack_Jump_Chop'], staff: ['Spellcast_Raise'] },
};
const ALIAS = { smash: 'slam', stomp: 'leap', gore: 'stab', bite: 'stab', sting: 'stab', erupt: 'slam' };
/** non-melee hints: same clip for every style (some depend on whether the wielder is a caster) */
const OTHER = {
  cast: { any: ['Spellcast_Shoot'] },
  throw: { any: ['Throw'] },
  lob: { any: ['Throw'] },
  fire: { any: ['Spellcast_Shoot'] },
  summon: { any: ['Spellcast_Summon'] },
  wail: { any: ['Spellcast_Long'] },
  howl: { any: ['Taunt'] },
  pray: { any: ['Spellcast_Raise'] },
  pulse: { any: ['Spellcast_Raise'] },
  fuse: { any: ['Spellcast_Long'] },
  drink: { any: ['Use_Item'] },
  brace: { any: ['Spellcast_Raise'], '2h': ['Blocking'], '1h': ['Blocking'], dual: ['Throw'] },
  toll: { any: ['Spellcast_Raise'], '2h': ['2H_Melee_Attack_Chop'], '1h': ['2H_Melee_Attack_Chop'] },
  charge: { any: ['Running_B'] },
};
const FALLBACK = ['Spellcast_Shoot'];

export function clipsForHint(style, hint) {
  const key = ALIAS[hint] ?? hint;
  const m = MELEE[key];
  if (m) return m[style] ?? m['1h'];
  const o = OTHER[key];
  if (o) return o[style] ?? o.any;
  return FALLBACK;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => t * t * (3 - 2 * t);
const rnd = () => Math.random();

// alt copies of clips so two consecutive uses of the SAME clip can cross-fade (shared across all rigs; clips are immutable data)
const altClips = new WeakMap();
function altOf(clip) { let a = altClips.get(clip); if (!a) { a = clip.clone(); a.name = `${clip.name}#alt`; altClips.set(clip, a); } return a; }

export class CharAnimator {
  /**
   * @param {import('./assets.js').CharacterRig} rig
   * @param {{style?:string, scale?:number, walk?:string, run?:string, idle?:string[], combatIdle?:string, hover?:number, death?:string, spawn?:string, idleVariants?:string[], noBlock?:boolean, runRef?:number, walkRef?:number}} prof
   */
  constructor(rig, prof = {}) {
    this.rig = rig;
    this.mixer = rig.mixer;
    this.prof = { style: '1h', scale: 1, walk: 'Walking_A', run: 'Running_B', idle: ['Idle'], combatIdle: 'Idle_Combat', ...prof };
    this.cur = null;            // currently driving action
    this.curKey = '';           // descriptor of the current state (to detect changes)
    this.faders = new Set();    // actions fading out
    this.t = 0;
    this.castRef = null; this.plan = null; this.attackN = 0;
    this.overrideUntil = 0; this.override = null;
    this.hitUntil = 0;
    this.dead = false; this.deadAction = null;
    this.nextVariant = 3 + rnd() * 8;
    this.wasMoving = false;
    this.locoState = 'idle'; this.locoSince = 0;
    this.pendingSpawn = null;
    this.lastLoopName = null;
    this.timeScale = 1;
  }

  // ───────────────────────── low-level action control
  #action(name, alt = false) {
    const rig = this.rig;
    const n = rig.resolve(name); if (!n) return null;
    if (!alt) return rig.action(n);
    const key = `${n}#alt`;
    let a = rig.actions.get(key);
    if (!a) { const lib = rig.clips.get(n); const c = altOf(lib); rig.clips.set(key, c); a = this.mixer.clipAction(c); rig.actions.set(key, a); }
    return a;
  }

  /** switch the driving action with a cross-fade; returns it. mode: 'loop' | 'once' | 'scrub' */
  #switch(a, { mode = 'loop', fade = 0.15, ts = 1, time = 0, clamp = false } = {}) {
    if (!a) return null;
    const prev = this.cur;
    if (prev === a) { // same action: just retime (loops) or restart (one-shots)
      if (mode === 'loop') { a.timeScale = ts; return a; }
    }
    a.reset(); a.setEffectiveWeight(1);
    if (mode === 'loop') { a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.timeScale = ts; }
    else { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = mode === 'scrub' ? 0 : ts; }
    a.time = time;
    a.paused = mode === 'scrub';
    a.play();
    if (prev && prev !== a) {
      if (fade > 0) { a.fadeIn(fade); prev.fadeOut(fade); this.faders.add(prev); } else { prev.stop(); }
    } else if (fade > 0) a.fadeIn(fade);
    this.cur = a;
    return a;
  }

  clipDur(name) { const n = this.rig.resolve(name); return n ? this.rig.clips.get(n).duration : 0; }
  has(name) { return this.rig.has(name); }
  #first(list) { for (const n of list) if (n && this.rig.has(n)) return n; return null; }

  // ───────────────────────── public triggers (gameplay events)
  /** brief override: cheer / interact / pickup / taunt / use / idleB ... (cancelled by movement or casting) */
  emote(name, { speed = 1, hold = 0, interrupt = false } = {}) {
    if (this.dead) return false;
    if (!interrupt && (this.castRef || this.t < this.hitUntil)) return false;
    const clip = this.#first(Array.isArray(name) ? name : [name]); if (!clip) return false;
    const dur = this.clipDur(clip) / speed;
    this.override = { clip, ts: speed, until: this.t + dur + hold, start: this.t, loopHold: hold };
    this.overrideUntil = this.t + dur + hold;
    this.curKey = '';
    return true;
  }

  /** hit reaction. power 0..1; ignored (visual flash/recoil only) while a cast is in progress */
  hit(power = 0.5, block = false) {
    if (this.dead || this.castRef || this.cur === null) return;
    if (this.t < this.hitUntil - 0.25) return;           // do not re-trigger while the previous reaction is mid-way
    const clip = block && this.has('Block_Hit') ? 'Block_Hit' : (this.attackN & 1 ? 'Hit_B' : 'Hit_A');
    this.attackN++;
    const ts = 1.15 + power * 0.5;
    this.override = { clip, ts, until: this.t + this.clipDur(clip) / ts * 0.8, start: this.t, hit: true };
    this.overrideUntil = this.override.until; this.hitUntil = this.overrideUntil;
    this.curKey = '';
  }

  /** spawn / awaken (summons, ambushers) */
  spawn(kind = 'ground', speed = 1.5) {
    const clip = this.#first(kind === 'skeleton' ? ['Skeletons_Awaken_Standing', 'Spawn_Ground_Skeletons', 'Spawn_Ground'] : ['Spawn_Ground', 'Spawn_Air']);
    if (!clip) return;
    const dur = this.clipDur(clip) / speed;
    this.override = { clip, ts: speed, until: this.t + dur, start: this.t, spawn: true };
    this.overrideUntil = this.override.until; this.curKey = '';
  }

  // ───────────────────────── per-frame update
  /**
   * @param {object} st sim-derived state (see EntityViews.#state): dead, deadT, mps, cast{ref,phase,t,windup,recover,hint,chanT}, dash{t,dur,dx,dz,iframes,hint,yaw},
   *                    aggro, stunned, listening, spawnT, idleVariants
   * @param {number} dt seconds (accumulated when LOD skips frames)
   */
  update(st, dt) {
    this.t += dt;
    const rig = this.rig;
    if (st.dead) this.#dead(st);
    else if (this.override && this.t < this.overrideUntil && !st.cast && !st.dash && (st.mps < 1.2 || this.override.spawn || this.override.hit)) this.#playOverride();
    else {
      if (this.override) { this.override = null; this.curKey = ''; }
      if (st.dash) this.#dash(st);
      else if (st.cast) this.#cast(st);
      else this.#loco(st);
    }
    if (st.cast == null && this.castRef) { this.castRef = null; this.plan = null; }
    // finished fades
    if (this.faders.size) for (const a of this.faders) if (!a.enabled || a.getEffectiveWeight() <= 0.001) { a.stop(); this.faders.delete(a); }
    rig.update(dt * this.timeScale);
  }

  // ───────────────────────── states
  #playOverride() {
    const o = this.override;
    const key = `ov:${o.clip}:${o.start}`;
    if (this.curKey === key) return;
    this.curKey = key;
    const a = this.#action(o.clip);
    this.#switch(a, { mode: 'once', fade: o.hit ? 0.04 : o.spawn ? 0.05 : 0.12, ts: o.ts, time: o.hit ? 0 : 0 });
    if (a && !o.spawn && !o.hit) a.clampWhenFinished = true;
  }

  #dead(st) {
    if (!this.dead) {
      this.dead = true; this.curKey = 'dead';
      const p = this.prof;
      const clip = this.#first(p.death ? [p.death] : (p.skeleton ? ['Death_C_Skeletons'] : ((st.uid & 1) ? ['Death_B'] : ['Death_A'])).concat(['Death_A']));
      const dur = this.clipDur(clip);
      const speed = dur > 1.5 ? dur / 1.3 : 1.15;
      const a = this.#action(clip);
      this.#switch(a, { mode: 'once', fade: 0.06, ts: speed, time: 0 });
      this.deadClip = clip;
      // views that appear when the corpse already exists: jump to the last frame
      if (st.deadT > dur / speed) a.time = dur * 0.999;
    }
  }

  #dash(st) {
    const d = st.dash;
    const dodge = d.iframes || d.hint === 'roll';
    if (dodge) {
      // direction relative to facing: rotate world dash vector into the entity frame
      const yaw = st.yaw, sx = Math.sin(yaw), cz = Math.cos(yaw);
      const fwd = d.dx * sx + d.dz * cz, side = d.dx * cz - d.dz * sx; // side>0 → +x of rotated frame (character's left in three.js handedness)
      let name = 'Dodge_Forward';
      if (fwd < -0.6) name = 'Dodge_Backward'; else if (Math.abs(side) > 0.6) name = side > 0 ? 'Dodge_Left' : 'Dodge_Right';
      const key = `dash:${name}:${d.uid}`;
      const a = this.#action(name);
      if (!a) return this.#loco(st);
      if (this.curKey !== key) { this.curKey = key; this.#switch(a, { mode: 'scrub', fade: 0.04 }); }
      const dur = this.clipDur(name);
      this.cur.time = Math.min(dur * 0.999, dur * clamp01(d.t / Math.max(0.05, d.dur)));
      return;
    }
    // rush / charge / leap: fast run with the rig leaning (view adds the lean), leaps use the jump chop
    if (d.hint === 'leap') {
      const clip = 'Spellcast_Shoot';
      const key = `leap:${d.uid}`;
      if (this.curKey !== key) { this.curKey = key; const c = this.#first(['1H_Melee_Attack_Jump_Chop']); this.#switch(this.#action(c), { mode: 'scrub', fade: 0.05, time: 0.2 }); this.leapClip = c; }
      const dur = this.clipDur(this.leapClip);
      this.cur.time = Math.min(dur * 0.97, 0.2 + (dur * 0.7) * clamp01(d.t / Math.max(0.1, d.dur)));
      return;
    }
    const run = this.#first([this.prof.run, 'Running_B', 'Running_A']);
    const key = `rush:${run}`;
    const ref = (STRIDE[run] ?? 3) * this.prof.scale;
    const ts = Math.min(1.9, Math.max(0.9, (st.mps || d.speed || 8) / ref));
    if (this.curKey !== key) { this.curKey = key; this.#switch(this.#action(run), { mode: 'loop', fade: 0.08, ts }); } else this.cur.timeScale = ts;
  }

  #cast(st) {
    const c = st.cast;
    if (c.ref !== this.castRef) { this.castRef = c.ref; this.plan = this.#plan(c); this.curKey = ''; }
    const p = this.plan;
    if (!p) return this.#loco(st);
    if (p.kind === 'hold') { // guard stance: hold the clip's pose
      const key = `hold:${p.clip}`;
      if (this.curKey !== key) { this.curKey = key; this.#switch(this.#action(p.clip), { mode: 'loop', fade: 0.1, ts: 0.6 }); }
      return;
    }
    if (p.kind === 'charge') { // wind-up of a rush: paw the ground (fast run in place)
      const key = `charge:${p.clip}`;
      if (this.curKey !== key) { this.curKey = key; this.#switch(this.#action(p.clip), { mode: 'loop', fade: 0.08, ts: 1.6 }); }
      return;
    }
    // scrubbed attack/cast clip
    const key = `cast:${p.clip}:${c.ref ? 1 : 0}:${this.attackN}`;
    if (this.curKey !== key) { this.curKey = key; this.#switch(this.#action(p.clip, p.alt), { mode: 'scrub', fade: p.fade, time: p.t0 }); }
    let time;
    if (c.phase === 'windup') {
      const u = c.windup > 0.001 ? clamp01(c.t / c.windup) : 1;
      time = p.t0 + (p.ti - p.t0) * u;
    } else if (c.phase === 'channel') {
      // hold the apex pose with a gentle pulse so channels look "alive"
      time = Math.min(p.d * 0.98, p.ti + 0.06 + Math.sin(this.t * 9) * 0.05);
    } else {
      const u = clamp01(c.t / Math.max(0.03, c.recover));
      time = p.ti + (p.t1 - p.ti) * u;
    }
    this.cur.time = Math.max(0, Math.min(p.d * 0.995, time));
  }

  /** choose clip + timing for a cast */
  #plan(c) {
    const style = this.prof.style;
    const hint = c.hint ?? 'cast';
    const list = clipsForHint(style, hint).filter((n) => this.rig.has(n));
    if (hint === 'charge') { const run = this.#first([this.prof.run, 'Running_B']); return { kind: 'charge', clip: run }; }
    if (hint === 'brace' && (style === '1h' || style === '2h') && this.rig.has('Blocking') && !this.prof.noBlock) return { kind: 'hold', clip: 'Blocking' };
    if (!list.length) return null;
    const clip = list[this.attackN++ % list.length];
    const alt = (this.lastPlanClip === clip);   // same clip twice in a row → use the alt copy so the cross-fade is smooth
    this.lastPlanClip = clip;
    const info = CLIP_INFO[clip] ?? { d: this.clipDur(clip), i: this.clipDur(clip) * 0.4 };
    const d = this.clipDur(clip) || info.d;
    const ti = Math.min(info.i, d * 0.9);
    const lead = Math.max(0.05, (c.windup || 0.0) * 3.4);        // never play the lead-in faster than 3.4×
    const follow = Math.max(0.1, (c.recover || 0.2) * 3.0);
    const t0 = Math.max(0, ti - Math.min(ti, c.windup > 0.001 ? lead : ti * 0.35));
    const t1 = Math.min(d * 0.97, ti + follow);
    return { kind: 'scrub', clip, alt, d, ti, t0, t1, fade: c.windup < 0.1 ? 0.03 : 0.07 };
  }

  #loco(st) {
    const p = this.prof, rig = this.rig;
    const mps = st.mps ?? 0;
    // idle / walk / run with hysteresis
    const runT = (p.runAt ?? 2.9), walkT = 0.28;
    let want = this.locoState;
    if (want === 'idle') { if (mps > walkT + 0.1) want = mps > runT ? 'run' : 'walk'; }
    else if (want === 'walk') { if (mps < walkT - 0.08) want = 'idle'; else if (mps > runT + 0.2) want = 'run'; }
    else if (want === 'run') { if (mps < runT - 0.5) want = mps < walkT - 0.08 ? 'idle' : 'walk'; }
    if (want !== this.locoState) { this.locoState = want; this.locoSince = this.t; }
    if (want === 'idle') {
      const wantsCombat = st.aggro && !p.noCombatIdle;
      const base = wantsCombat ? p.combatIdle : (p.idle[0] ?? 'Idle');
      // occasional idle variation for variety (only when calm)
      if (!wantsCombat && st.mps < 0.1 && this.t > this.nextVariant && p.variants?.length && !st.listening) {
        this.nextVariant = this.t + 7 + rnd() * 10;
        const v = p.variants[(rnd() * p.variants.length) | 0];
        if (this.emote(v, { speed: 1 })) return this.#playOverride();
      }
      const clip = this.#first([base, 'Idle', 'Unarmed_Idle']);
      const key = `idle:${clip}`;
      if (this.curKey !== key) {
        this.curKey = key;
        const a = this.#action(clip);
        const fresh = this.cur === null;
        this.#switch(a, { mode: 'loop', fade: fresh ? 0 : 0.2, ts: 1 });
        if (fresh && a) a.time = rnd() * a.getClip().duration;   // desync idle phases so a pack never breathes in unison
      }
    } else {
      const name = want === 'run' ? p.run : p.walk;
      const clip = this.#first([name, want === 'run' ? 'Running_B' : 'Walking_A']);
      const ref = (STRIDE[clip] ?? 1) * p.scale;
      const lo = want === 'run' ? 0.7 : 0.55, hi = want === 'run' ? 1.55 : 2.2;
      const ts = Math.min(hi, Math.max(lo, mps / ref));
      const key = `${want}:${clip}`;
      if (this.curKey !== key) {
        this.curKey = key;
        const phase = this.cur && this.locoState !== 'idle' ? null : undefined;
        const a = this.#action(clip);
        this.#switch(a, { mode: 'loop', fade: 0.18, ts, time: rnd() * 0.5 });
      } else if (this.cur) this.cur.timeScale = ts;
    }
  }

  dispose() { this.mixer.stopAllAction(); }
}
