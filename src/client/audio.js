/**
 * AudioEngine — 100 % procedural WebAudio: synthesized SFX, adaptive layered music and weather/ambience beds.
 * No audio files exist in the project (so no licensing risk). Everything routes through buses:
 *   sfx / ui / music / ambient → master → compressor → out   (volumes come from settings)
 * Music is generated bar by bar from a mode per state; layers (pad, pluck arp, bass, percussion) fade with an
 * "intensity" value driven by combat/boss status, so the soundtrack reacts without hard cuts.
 */
const NOTE = (m) => 440 * 2 ** ((m - 69) / 12);
const MODES = {
  explore:  { root: 50, scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], bpm: 62, wave: 'sine' },
  town:     { root: 53, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]], bpm: 70, wave: 'triangle' },
  mystery:  { root: 47, scale: [0, 2, 3, 6, 7, 8, 11], prog: [[0, 3, 5], [1, 4, 6], [0, 3, 5], [6, 2, 4]], bpm: 54, wave: 'sine' },
  tense:    { root: 45, scale: [0, 1, 3, 5, 7, 8, 10], prog: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]], bpm: 78, wave: 'sawtooth' },
  crypt:    { root: 43, scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 2, 4], [0, 3, 5], [5, 0, 2], [4, 6, 1]], bpm: 58, wave: 'sine' },
  cavern:   { root: 46, scale: [0, 2, 4, 7, 9, 11, 12], prog: [[0, 2, 4], [1, 3, 5], [0, 3, 5], [2, 4, 6]], bpm: 56, wave: 'triangle' },
  facility: { root: 44, scale: [0, 2, 3, 5, 6, 8, 10], prog: [[0, 2, 4], [0, 2, 4], [3, 5, 0], [4, 6, 1]], bpm: 84, wave: 'square' },
  boss:     { root: 41, scale: [0, 1, 3, 5, 6, 8, 10], prog: [[0, 2, 4], [1, 3, 5], [0, 3, 6], [4, 6, 1]], bpm: 96, wave: 'sawtooth' },
};
const MUSIC_ALIAS = { explore: 'explore', town: 'town', mystery: 'mystery', tense: 'tense', 'mus.crypt': 'crypt', 'mus.cavern': 'cavern', 'mus.facility': 'facility', boss: 'boss' };
const BELL_RATIOS = [1, 2.76, 5.4, 8.93];

export class AudioEngine {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.buses = null; this.mode = 'explore'; this.intensity = 0; this.targetIntensity = 0;
    this.nextBar = 0; this.bar = 0; this.weatherType = 'calm'; this.disabled = typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined';
    this.noiseBuf = null; this.lastSfx = {}; this.stepAcc = 0; this.level_ = 0;
  }

  // ───────────────────────── setup
  #init() {
    if (this.ctx || this.disabled) return !this.disabled;
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { this.disabled = true; return false; }
    const c = this.ctx;
    this.master = c.createGain(); this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.ratio.value = 4;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 512;
    this.master.connect(this.comp); this.comp.connect(this.analyser); this.analyser.connect(c.destination);
    this.buses = Object.fromEntries(['sfx', 'ui', 'music', 'ambient'].map((k) => { const g = c.createGain(); g.connect(this.master); return [k, g]; }));
    // a short synthetic reverb (decaying noise) shared by bells/pads
    this.reverb = c.createConvolver(); this.reverb.buffer = this.#impulse(2.2, 2.4); const rg = c.createGain(); rg.gain.value = 0.38; this.reverb.connect(rg); rg.connect(this.master);
    this.noiseBuf = this.#noise(2);
    this.applySettings();
    this.#startAmbient();
    return true;
  }
  #impulse(seconds, decay) { const c = this.ctx, n = Math.floor(c.sampleRate * seconds), b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay; } return b; }
  #noise(seconds) { const c = this.ctx, n = Math.floor(c.sampleRate * seconds), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }

  resume() { if (!this.#init()) return; if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  applySettings() {
    if (!this.ctx) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.volMaster ?? 0.8, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(s.volSfx ?? 0.8, t, 0.05); this.buses.ui.gain.setTargetAtTime(s.volUi ?? 0.7, t, 0.05);
    this.buses.music.gain.setTargetAtTime((s.volMusic ?? 0.6) * 0.55, t, 0.05); this.buses.ambient.gain.setTargetAtTime(s.volAmbient ?? 0.7, t, 0.05);
  }
  /** RMS of the master output, 0..1 (QA hook) */
  level() { if (!this.analyser) return 0; const d = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(d); let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length); }

  // ───────────────────────── synthesis primitives
  #env(g, t, a, d, peak = 1, end = 0.0001) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  #osc(type, freq, t, dur, bus, { gain = 0.3, a = 0.005, slide = 0, rev = 0, pan = 0, detune = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur); o.detune.value = detune;
    this.#env(g, t, a, dur, gain);
    let node = g; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); node = p; }
    o.connect(g); node.connect(bus); if (rev) { const r = c.createGain(); r.gain.value = rev; node.connect(r); r.connect(this.reverb); }
    o.start(t); o.stop(t + dur + a + 0.05);
    return o;
  }
  #noiseBurst(t, dur, bus, { gain = 0.3, type = 'lowpass', f0 = 2000, f1 = 400, q = 1, pan = 0, a = 0.003 } = {}) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this.#env(g, t, a, dur, gain);
    s.connect(f); f.connect(g); let node = g; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(bus); s.start(t, Math.random()); s.stop(t + dur + a + 0.05);
  }
  #bell(freq, t, bus, { gain = 0.25, dur = 1.6, rev = 0.6, pan = 0 } = {}) { BELL_RATIOS.forEach((r, i) => this.#osc('sine', freq * r, t, dur / (1 + i * 0.7), bus, { gain: gain / (1 + i * 1.4), a: 0.002, rev: i === 0 ? rev : rev * 0.5, pan })); }

  // ───────────────────────── SFX
  /** @param {string} name @param {{pan?:number, gain?:number, pitch?:number}} [o] */
  sfx(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if ((this.lastSfx[name] ?? 0) > now - 0.03) return; this.lastSfx[name] = now;
    const b = this.buses.sfx, t = now + 0.005, pan = o.pan ?? 0, k = o.gain ?? 1, p = o.pitch ?? 1;
    switch (name) {
      case 'hit': this.#noiseBurst(t, 0.09, b, { gain: 0.28 * k, f0: 3200, f1: 500, pan }); this.#osc('sine', 150 * p, t, 0.12, b, { gain: 0.3 * k, slide: -70, pan }); break;
      case 'crit': this.#noiseBurst(t, 0.12, b, { gain: 0.34 * k, f0: 5200, f1: 800, pan }); this.#osc('triangle', 260 * p, t, 0.2, b, { gain: 0.3 * k, slide: -160, pan }); this.#bell(880 * p, t, b, { gain: 0.1 * k, dur: 0.7, rev: 0.3, pan }); break;
      case 'hurt': this.#osc('sawtooth', 120 * p, t, 0.22, b, { gain: 0.26 * k, slide: -60, pan }); this.#noiseBurst(t, 0.16, b, { gain: 0.2 * k, f0: 900, f1: 180, pan }); break;
      case 'swing': this.#noiseBurst(t, 0.18, b, { gain: 0.16 * k, type: 'bandpass', f0: 500, f1: 2400, q: 1.2, pan }); break;
      case 'heavy': this.#osc('sine', 70 * p, t, 0.5, b, { gain: 0.5 * k, slide: -40, rev: 0.2, pan }); this.#noiseBurst(t, 0.35, b, { gain: 0.3 * k, f0: 1500, f1: 120, pan }); break;
      case 'bell': this.#bell(330 * p, t, b, { gain: 0.3 * k, dur: 2, pan }); break;
      case 'toll': this.#bell(196 * p, t, b, { gain: 0.38 * k, dur: 2.6, pan }); this.#osc('sine', 98 * p, t, 1.8, b, { gain: 0.25 * k }); break;
      case 'note': this.#osc('sine', 660 * p, t, 0.4, b, { gain: 0.2 * k, slide: 80, rev: 0.5, pan }); this.#osc('sine', 990 * p, t, 0.3, b, { gain: 0.08 * k, rev: 0.5, pan }); break;
      case 'zap': this.#osc('sawtooth', 900 * p, t, 0.16, b, { gain: 0.14 * k, slide: -700, pan }); this.#noiseBurst(t, 0.14, b, { gain: 0.14 * k, type: 'highpass', f0: 3000, f1: 6000, pan }); break;
      case 'spit': this.#noiseBurst(t, 0.2, b, { gain: 0.2 * k, type: 'bandpass', f0: 600, f1: 250, q: 3, pan }); break;
      case 'wail': this.#osc('sawtooth', 280 * p, t, 0.9, b, { gain: 0.14 * k, slide: 120, rev: 0.6, pan, a: 0.1 }); this.#osc('sawtooth', 283 * p, t, 0.9, b, { gain: 0.1 * k, slide: 125, rev: 0.6, pan, a: 0.1 }); break;
      case 'quake': this.#osc('sine', 48, t, 0.9, b, { gain: 0.6 * k, slide: -18 }); this.#noiseBurst(t, 0.7, b, { gain: 0.35 * k, f0: 700, f1: 60 }); break;
      case 'charge': this.#noiseBurst(t, 0.6, b, { gain: 0.2 * k, type: 'bandpass', f0: 200, f1: 1600, q: 1.5, pan }); break;
      case 'ring': this.#bell(147 * p, t, b, { gain: 0.34 * k, dur: 2.2, rev: 0.9 }); this.#osc('sine', 73, t, 1.2, b, { gain: 0.3 * k, slide: -20 }); break;
      case 'death': this.#osc('sine', 200 * p, t, 0.5, b, { gain: 0.26 * k, slide: -150, pan }); this.#noiseBurst(t, 0.35, b, { gain: 0.18 * k, f0: 1400, f1: 120, pan }); break;
      case 'dash': this.#noiseBurst(t, 0.22, b, { gain: 0.22 * k, type: 'bandpass', f0: 1800, f1: 500, q: 1.1, pan }); break;
      case 'chord': [1, 1.25, 1.5].forEach((r, i) => this.#bell(392 * r * p, t + i * 0.045, b, { gain: 0.22 * k, dur: 1.8 })); break;
      case 'unison': this.#bell(330 * p, t, b, { gain: 0.3 * k, dur: 1.4 }); this.#bell(333 * p, t, b, { gain: 0.25 * k, dur: 1.4 }); break;
      case 'reprise': this.#bell(523 * p, t, b, { gain: 0.2 * k, dur: 1 }); this.#bell(523 * p, t + 0.12, b, { gain: 0.16 * k, dur: 1 }); break;
      case 'listen': this.#osc('sine', 220, t, 0.9, b, { gain: 0.2 * k, slide: 440, rev: 0.9, a: 0.05 }); break;
      case 'pulse': this.#osc('sine', 1760, t, 0.7, b, { gain: 0.06 * k, slide: -900, rev: 1 }); break;
      case 'voice': [0, 4, 7, 12].forEach((s, i) => this.#osc('triangle', NOTE(72 + s), t + i * 0.06, 0.5, b, { gain: 0.14 * k, rev: 0.7 })); break;
      case 'step': this.#noiseBurst(t, 0.06, b, { gain: 0.05 * k, type: 'lowpass', f0: 900, f1: 300, pan }); break;
      case 'potion': this.#osc('sine', 500, t, 0.18, b, { gain: 0.2 * k, slide: 260 }); this.#osc('sine', 760, t + 0.1, 0.18, b, { gain: 0.16 * k, slide: 200 }); break;
      case 'dodgeperfect': this.#bell(1046, t, b, { gain: 0.2 * k, dur: 0.9 }); break;
      // loot stingers: the better the drop, the longer and brighter the tell (you can hear a relic from across the room)
      case 'drop_common': this.#osc('triangle', 1250 * p, t, 0.05, b, { gain: 0.07 * k, slide: -300, pan }); break;
      case 'drop_fine': this.#bell(784 * p, t, b, { gain: 0.16 * k, dur: 0.9, pan }); this.#osc('sine', 1568, t + 0.05, 0.25, b, { gain: 0.05 * k, rev: 0.5, pan }); break;
      case 'drop_attuned': this.#bell(880 * p, t, b, { gain: 0.2 * k, dur: 1.3, pan }); this.#bell(1318 * p, t + 0.09, b, { gain: 0.15 * k, dur: 1.2, pan }); this.#noiseBurst(t, 0.5, b, { gain: 0.05 * k, type: 'highpass', f0: 4000, f1: 9000, pan }); break;
      case 'drop_relic': this.#bell(196 * p, t, b, { gain: 0.3 * k, dur: 2.4, rev: 0.8, pan }); [0, 4, 7, 12, 16].forEach((st, i) => this.#bell(NOTE(69 + st), t + 0.1 + i * 0.07, b, { gain: 0.13 * k, dur: 1.4, rev: 0.7, pan })); this.#noiseBurst(t, 0.9, b, { gain: 0.08 * k, type: 'bandpass', f0: 600, f1: 6000, q: 0.8, pan }); break;
      default: this.#noiseBurst(t, 0.08, b, { gain: 0.15 * k });
    }
  }

  /** UI & feedback sounds (separate bus: always audible at menus) */
  ui(name) {
    if (!this.#init()) return; this.resume();
    if (this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005, b = this.buses.ui;
    const arp = (notes, gap = 0.07, gain = 0.2, wave = 'triangle') => notes.forEach((n, i) => this.#osc(wave, NOTE(n), t + i * gap, 0.3, b, { gain, rev: 0.4 }));
    switch (name) {
      case 'click': this.#osc('triangle', 880, t, 0.05, b, { gain: 0.12 }); break;
      case 'open': this.#osc('sine', 520, t, 0.09, b, { gain: 0.1, slide: 180 }); break;
      case 'close': this.#osc('sine', 700, t, 0.08, b, { gain: 0.1, slide: -240 }); break;
      case 'interact': this.#bell(660, t, b, { gain: 0.14, dur: 0.6 }); break;
      case 'pickup': this.#osc('triangle', 740, t, 0.1, b, { gain: 0.14, slide: 300 }); break;
      case 'coin': this.#osc('sine', 1318, t, 0.12, b, { gain: 0.12 }); this.#osc('sine', 1760, t + 0.07, 0.2, b, { gain: 0.1, rev: 0.3 }); break;
      case 'quest': arp([67, 71, 74], 0.09, 0.18); break;
      case 'questDone': arp([60, 64, 67, 72, 76], 0.1, 0.2); break;
      case 'level': arp([57, 61, 64, 69, 73, 76], 0.08, 0.2, 'sine'); break;
      case 'secret': arp([88, 91, 95, 100], 0.07, 0.1, 'sine'); break;
      case 'voice': arp([72, 76, 79, 84], 0.06, 0.14, 'sine'); break;
      case 'death': this.#osc('sine', 110, t, 1.6, b, { gain: 0.3, slide: -50, rev: 0.8 }); this.#bell(98, t, b, { gain: 0.3, dur: 3 }); break;
      case 'travel': this.#osc('sine', 200, t, 0.8, b, { gain: 0.2, slide: 600, rev: 0.8, a: 0.2 }); break;
      case 'gate': this.#bell(110, t, b, { gain: 0.4, dur: 3.2, rev: 1 }); this.#bell(165, t + 0.2, b, { gain: 0.3, dur: 3, rev: 1 }); break;
      case 'door': this.#noiseBurst(t, 0.5, b, { gain: 0.25, f0: 500, f1: 90 }); this.#osc('sine', 60, t, 0.5, b, { gain: 0.3, slide: -20 }); break;
      case 'event': this.#bell(262, t, b, { gain: 0.25, dur: 1.2 }); this.#bell(247, t + 0.3, b, { gain: 0.2, dur: 1.2 }); break;
      default: break;
    }
  }

  puzzle(index, correct) {
    if (!this.#init() || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005, b = this.buses.sfx;
    if (correct) this.#bell(NOTE(60 + [0, 2, 4, 7, 9, 11, 12, 14][index % 8]), t, b, { gain: 0.3, dur: 2.2, rev: 0.9 });
    else { this.#osc('sawtooth', 110, t, 0.5, b, { gain: 0.2, slide: -30 }); this.#osc('sawtooth', 116, t, 0.5, b, { gain: 0.18, slide: -30 }); }
  }

  /** subscribe to a World's events (call again for each new world) */
  bind(world, player) {
    const ev = world.events;
    const pan = (e) => { const p = world.player; if (!p || !this.rigYaw) return 0; const dx = e.x - p.x, dz = e.z - p.z, c = Math.cos(this.rigYaw), s = Math.sin(this.rigYaw); return Math.max(-0.8, Math.min(0.8, (dx * c - dz * s) / 18)); };
    const near = (e) => { const p = world.player; return !p || Math.hypot(e.x - p.x, e.z - p.z) < 34; };
    ev.on('damage', (i) => { if (!near(i.target)) return; if (i.target.team === 'player') this.sfx('hurt', { pan: pan(i.target), gain: 0.8 }); else if (!i.dot) this.sfx(i.crit ? 'crit' : 'hit', { pan: pan(i.target), pitch: 0.9 + Math.random() * 0.25 }); });
    ev.on('cast:impact', (i) => {
      if (!near(i.entity)) return; const fx = i.ab.fx?.sfx, e = i.entity, pn = pan(e);
      const map = { heavy_hit: 'heavy', stomp: 'quake', quake: 'quake', charge: 'charge', rubble: 'heavy', wail: 'wail', howl: 'wail', note: 'note', chord_enemy: 'note', ring_big: 'ring', coda: 'ring', zap: 'zap', beam: 'zap', spit: 'spit', boss: 'heavy', swipe: 'swing', cast: 'note', deploy: 'zap', hum: 'zap' };
      if (e.team === 'player') { this.sfx(i.ab.tags?.includes('sonic') ? 'bell' : i.ab.tags?.includes('projectile') ? 'note' : 'swing', { pan: pn, gain: 0.8 }); if (i.ab.tags?.includes('ultimate') || i.ab.slotType === 'ultimate') this.sfx('toll'); }
      else this.sfx(map[fx] ?? 'swing', { pan: pn, gain: 0.7 });
    });
    ev.on('loot:drop', (i) => { if (near(i)) this.sfx(`drop_${i.item.rarity}`, { pan: pan(i) }); });
    ev.on('entity:died', (i) => { if (near(i.entity) && i.entity.team === 'enemy') this.sfx('death', { pan: pan(i.entity), pitch: i.entity.tier === 'boss' ? 0.5 : 1 }); });
    ev.on('cadence:chord', (i) => this.sfx(i.chord.type === 'triad' ? 'chord' : i.chord.type === 'unison' ? 'unison' : 'reprise'));
    ev.on('listen:start', () => this.sfx('listen')); ev.on('listen:pulse', () => this.sfx('pulse'));
    ev.on('dash:start', (i) => { if (i.entity.team === 'player') this.sfx('dash'); });
    ev.on('perfectDodge', () => this.sfx('dodgeperfect')); ev.on('potion:used', () => this.sfx('potion'));
    ev.on('voice:captured', () => this.sfx('voice'));
    ev.on('boss:shield_break', () => this.sfx('toll'));
    ev.on('boss:phase', () => this.sfx('ring'));
  }

  // ───────────────────────── music (generative, bar by bar)
  music(state) {
    const m = MUSIC_ALIAS[state] ?? 'explore';
    if (m === this.mode) return;
    if (m === 'boss') { this.preBoss = this.mode; }
    this.mode = m; this.nextBar = 0; // restart harmony at the next bar boundary
  }
  weather(type) { this.weatherType = type; }

  #startAmbient() {
    const c = this.ctx;
    this.wind = { src: c.createBufferSource(), f: c.createBiquadFilter(), g: c.createGain(), lfo: c.createOscillator(), lg: c.createGain() };
    this.wind.src.buffer = this.noiseBuf; this.wind.src.loop = true; this.wind.f.type = 'bandpass'; this.wind.f.frequency.value = 500; this.wind.f.Q.value = 0.7; this.wind.g.gain.value = 0;
    this.wind.lfo.frequency.value = 0.13; this.wind.lg.gain.value = 260; this.wind.lfo.connect(this.wind.lg); this.wind.lg.connect(this.wind.f.frequency);
    this.wind.src.connect(this.wind.f); this.wind.f.connect(this.wind.g); this.wind.g.connect(this.buses.ambient);
    this.wind.src.start(); this.wind.lfo.start();
  }

  #scheduleBar(t) {
    const m = MODES[this.mode] ?? MODES.explore, c = this.ctx, bus = this.buses.music, beat = 60 / m.bpm, barLen = beat * 4;
    const chord = m.prog[this.bar % m.prog.length], deg = (d) => m.root + 12 * Math.floor(d / m.scale.length) + m.scale[((d % m.scale.length) + m.scale.length) % m.scale.length];
    const I = this.intensity;
    // pad: three detuned voices, slow attack, always present
    chord.forEach((d, i) => { for (const dt of [-6, 6]) { const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = m.wave === 'square' ? 'sawtooth' : m.wave; o.frequency.value = NOTE(deg(d) + 12); o.detune.value = dt; f.type = 'lowpass'; f.frequency.value = 700 + I * 900; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + barLen * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + barLen * 1.05); o.connect(f); f.connect(g); g.connect(bus); const r = c.createGain(); r.gain.value = 0.5; g.connect(r); r.connect(this.reverb); o.start(t); o.stop(t + barLen * 1.1); } });
    // bass root every bar (and a second hit when tense)
    this.#osc('sine', NOTE(deg(chord[0]) - 12), t, barLen * 0.95, bus, { gain: 0.16, a: 0.04 });
    // bell-pluck arpeggio: density grows with intensity; deterministic from the bar counter
    const steps = I > 0.6 ? 8 : I > 0.25 ? 6 : 4;
    for (let i = 0; i < steps; i++) { const nd = chord[(i + this.bar) % 3] + (i % 4 === 3 ? 2 : 0); if ((i * 7 + this.bar * 3) % 5 === 4 && I < 0.5) continue; this.#bell(NOTE(deg(nd) + 24), t + (i / steps) * barLen, bus, { gain: 0.05 + I * 0.03, dur: 1.4, rev: 0.7 }); }
    // percussion layer only when fighting: soft kick on 1 & 3, hat noise on offbeats, boss adds snare
    if (I > 0.3) for (let b2 = 0; b2 < 4; b2++) { const tt = t + b2 * beat; if (b2 % 2 === 0) { this.#osc('sine', 90, tt, 0.22, bus, { gain: 0.2 * I, slide: -50 }); } this.#noiseBurst(tt + beat / 2, 0.05, bus, { gain: 0.05 * I, type: 'highpass', f0: 6000, f1: 8000 }); if (this.mode === 'boss' && b2 % 2 === 1) this.#noiseBurst(tt, 0.14, bus, { gain: 0.14, type: 'bandpass', f0: 1800, f1: 900, q: 1 }); }
    this.bar++;
    return barLen;
  }

  update(dt, ctx) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    // intensity follows combat/boss with a slow release
    this.targetIntensity = ctx.boss ? 1 : ctx.combat ? 0.65 : 0.1;
    this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * (this.targetIntensity > this.intensity ? 0.9 : 0.25));
    this.rigYaw = ctx.session?.world ? Math.PI / 4 : 0;
    if (ctx.boss && this.mode !== 'boss') this.music('boss'); else if (!ctx.boss && this.mode === 'boss') this.music(ctx.session.mode === 'dungeon' ? `mus.${ctx.session.dungeon.d.family.split('.')[1].replace('serrane_', '').replace('crystal_', '').replace('broken_', '')}` : 'explore');
    if (this.nextBar < t + 0.4) { if (this.nextBar < t) this.nextBar = t + 0.1; this.nextBar += this.#scheduleBar(this.nextBar); }
    // wind bed follows weather and dungeon depth
    const w = this.weatherType, inDungeon = ctx.session?.mode === 'dungeon';
    const wind = inDungeon ? 0.05 : w === 'windstorm' ? 0.55 : w === 'mist' ? 0.14 : 0.07;
    this.wind.g.gain.setTargetAtTime(wind, t, 0.8); this.wind.f.Q.value = w === 'windstorm' ? 1.6 : 0.7;
    // footsteps while moving
    const p = ctx.player; if (p && !p.dead) { const sp = Math.hypot(p.vx || 0, p.vz || 0); if (sp > 0.8) { this.stepAcc += dt * sp; if (this.stepAcc > 2.4) { this.stepAcc = 0; this.sfx('step', { gain: 0.8 + Math.random() * 0.4 }); } } }
  }
}
