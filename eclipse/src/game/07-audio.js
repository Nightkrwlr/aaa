// 07-audio.js — Audio sintetizado

// ════════ [326] VariableDeclaration Ot,wl,dr,ds,hf,El,df,ae (892 bytes) ════════
var Ot = null,
  wl,
  dr,
  ds,
  hf,
  El,
  df = {},
  ae = {
    vol: { sfx: 0.7, music: 0.45 },
    init() {
      if (Ot) {
        Ot.state === "suspended" && Ot.resume();
        return;
      }
      try {
        Ot = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return;
      }
      ((El = Ot.createDynamicsCompressor()),
        (El.threshold.value = -14),
        (El.ratio.value = 6),
        El.connect(Ot.destination),
        (wl = Ot.createGain()),
        (wl.gain.value = 0.9),
        wl.connect(El),
        (dr = Ot.createGain()),
        (dr.gain.value = this.vol.sfx),
        dr.connect(wl),
        (ds = Ot.createGain()),
        (ds.gain.value = this.vol.music),
        ds.connect(wl),
        (hf = Ot.createBuffer(1, Ot.sampleRate * 1.5, Ot.sampleRate)));
      let n = hf.getChannelData(0);
      for (let e = 0; e < n.length; e++) n[e] = Math.random() * 2 - 1;
      bo.start();
    },
    setVol(n, e) {
      ((this.vol[n] = e), n === "sfx" && dr && (dr.gain.value = e), n === "music" && ds && (ds.gain.value = e));
    },
    play(n, e = {}) {
      if (!Ot || Ot.state !== "running") return;
      let t = Ot.currentTime,
        i = e.gap ?? 0.035;
      if (df[n] && t - df[n] < i) return;
      df[n] = t;
      let s = _w[n];
      if (s)
        try {
          s(t, e.v ?? 1, e.p ?? 1);
        } catch {}
    },
    get ctx() {
      return Ot;
    },
  };


// ════════ [327] FunctionDeclaration Eg (163 bytes) ════════
function Eg(n, e, t, i, s, a = 1e-4) {
  (n.gain.setValueAtTime(1e-4, e),
    n.gain.exponentialRampToValueAtTime(Math.max(2e-4, i), e + t),
    n.gain.exponentialRampToValueAtTime(a, e + t + s));
}


// ════════ [328] FunctionDeclaration Dt (374 bytes) ════════
function Dt(n, e, t, i = "lowpass", s = 2e3, a = 1, r = null, o = dr) {
  let l = Ot.createBufferSource();
  ((l.buffer = hf), (l.playbackRate.value = 1));
  let c = Ot.createBiquadFilter();
  ((c.type = i),
    c.frequency.setValueAtTime(s, n),
    r && c.frequency.exponentialRampToValueAtTime(r, n + e),
    (c.Q.value = a));
  let d = Ot.createGain();
  (Eg(d, n, 0.003, t, e),
    l.connect(c),
    c.connect(d),
    d.connect(o),
    l.start(n, Math.random() * 0.5),
    l.stop(n + e + 0.05));
}


// ════════ [329] FunctionDeclaration $e (248 bytes) ════════
function $e(n, e, t, i, s, a, r = dr, o = 0.004) {
  let l = Ot.createOscillator();
  ((l.type = e), l.frequency.setValueAtTime(t, n), i && l.frequency.exponentialRampToValueAtTime(i, n + s));
  let c = Ot.createGain();
  (Eg(c, n, o, a, s), l.connect(c), c.connect(r), l.start(n), l.stop(n + o + s + 0.05));
}


// ════════ [330] VariableDeclaration _w,Mg,wg,bo (6113 bytes) ════════
var _w = {
    pistol: (n, e, t) => {
      (Dt(n, 0.09, 0.5 * e, "bandpass", 1800 * t, 0.8, 500), $e(n, "square", 220 * t, 60, 0.06, 0.12 * e));
    },
    revolver: (n, e, t) => {
      (Dt(n, 0.22, 0.7 * e, "lowpass", 2600, 0.7, 300), $e(n, "sawtooth", 140, 40, 0.15, 0.2 * e));
    },
    smg: (n, e, t) => {
      (Dt(n, 0.06, 0.35 * e, "bandpass", 2400 * t, 1, 900), $e(n, "square", 300, 90, 0.04, 0.06 * e));
    },
    rifle: (n, e, t) => {
      (Dt(n, 0.1, 0.45 * e, "bandpass", 1500 * t, 0.9, 400), $e(n, "sawtooth", 180, 50, 0.07, 0.12 * e));
    },
    shotgun: (n, e, t) => {
      (Dt(n, 0.3, 0.8 * e, "lowpass", 3e3, 0.6, 200), $e(n, "sawtooth", 110, 35, 0.2, 0.25 * e));
    },
    sniper: (n, e, t) => {
      (Dt(n, 0.35, 0.8 * e, "lowpass", 5e3, 0.5, 300),
        $e(n, "square", 90, 30, 0.3, 0.3 * e),
        $e(n + 0.02, "sine", 2400, 600, 0.25, 0.05 * e));
    },
    laser: (n, e, t) => {
      $e(n, "sawtooth", 1400 * t, 900, 0.06, 0.06 * e);
    },
    rail: (n, e, t) => {
      ($e(n, "sawtooth", 200, 2400, 0.08, 0.15 * e),
        $e(n + 0.07, "square", 2e3, 80, 0.35, 0.2 * e),
        Dt(n + 0.07, 0.3, 0.5 * e, "highpass", 2e3, 0.6, 400));
    },
    zap: (n, e, t) => {
      for (let i = 0; i < 3; i++) $e(n + i * 0.02, "square", 800 + Math.random() * 1200, 200, 0.05, 0.07 * e);
      Dt(n, 0.12, 0.25 * e, "highpass", 3e3, 1);
    },
    flame: (n, e, t) => {
      Dt(n, 0.12, 0.18 * e, "bandpass", 700, 0.6, 500);
    },
    cryo: (n, e, t) => {
      Dt(n, 0.12, 0.15 * e, "highpass", 4e3, 0.6, 2500);
    },
    thump: (n, e, t) => {
      ($e(n, "sine", 160, 50, 0.15, 0.4 * e), Dt(n, 0.08, 0.3 * e, "lowpass", 900));
    },
    rocket: (n, e, t) => {
      (Dt(n, 0.5, 0.45 * e, "bandpass", 600, 0.7, 2500), $e(n, "sawtooth", 120, 60, 0.25, 0.15 * e));
    },
    plasma: (n, e, t) => {
      ($e(n, "sine", 600, 120, 0.25, 0.25 * e), $e(n, "triangle", 1200, 300, 0.2, 0.1 * e));
    },
    disc: (n, e, t) => {
      $e(n, "triangle", 900, 1800, 0.12, 0.12 * e);
    },
    swarm: (n, e, t) => {
      for (let i = 0; i < 3; i++) Dt(n + i * 0.05, 0.12, 0.2 * e, "bandpass", 1500, 2, 3e3);
    },
    spit: (n, e, t) => {
      (Dt(n, 0.12, 0.3 * e, "bandpass", 900, 3, 300), $e(n, "sine", 300, 120, 0.1, 0.15 * e));
    },
    bow: (n, e, t) => {
      ($e(n, "triangle", 220, 110, 0.1, 0.25 * e), Dt(n, 0.08, 0.2 * e, "highpass", 3e3));
    },
    void: (n, e, t) => {
      ($e(n, "sine", 80, 40, 0.6, 0.35 * e), $e(n, "sawtooth", 300, 60, 0.4, 0.06 * e));
    },
    hit: (n, e, t) => {
      Dt(n, 0.04, 0.2 * e, "bandpass", 2500 * t, 2);
    },
    crit: (n, e) => {
      ($e(n, "square", 1600, 900, 0.06, 0.08 * e), Dt(n, 0.05, 0.25 * e, "highpass", 3e3));
    },
    squish: (n, e, t) => {
      (Dt(n, 0.18, 0.35 * e, "lowpass", 900 * t, 3, 200), $e(n, "sine", 180 * t, 60, 0.15, 0.15 * e));
    },
    metal: (n, e, t) => {
      ($e(n, "square", 600 * t, 200, 0.1, 0.1 * e), Dt(n, 0.2, 0.3 * e, "bandpass", 3e3, 3, 800));
    },
    boom: (n, e, t) => {
      (Dt(n, 0.8, 1 * e, "lowpass", 1600, 0.7, 60), $e(n, "sine", 120, 30, 0.6, 0.6 * e));
    },
    pick: (n, e, t) => {
      $e(n, "sine", 900 * t, 1400 * t, 0.06, 0.08 * e);
    },
    coin: (n, e) => {
      ($e(n, "square", 1300, 1300, 0.05, 0.05 * e), $e(n + 0.05, "square", 1900, 1900, 0.08, 0.05 * e));
    },
    item: (n, e) => {
      ($e(n, "triangle", 600, 600, 0.08, 0.15 * e),
        $e(n + 0.08, "triangle", 900, 900, 0.08, 0.15 * e),
        $e(n + 0.16, "triangle", 1200, 1200, 0.15, 0.15 * e));
    },
    legend: (n, e) => {
      ([523, 659, 784, 1046, 1318].forEach((t, i) => $e(n + i * 0.07, "triangle", t, t, 0.4, 0.14 * e)),
        Dt(n, 1.2, 0.1 * e, "highpass", 6e3));
    },
    levelup: (n, e) => {
      ([392, 523, 659, 784, 1046].forEach((t, i) => $e(n + i * 0.08, "square", t, t, 0.25, 0.08 * e)),
        $e(n, "sine", 130, 260, 0.8, 0.2 * e));
    },
    ui: (n, e) => {
      $e(n, "sine", 1100, 1100, 0.04, 0.06 * e);
    },
    open: (n, e) => {
      $e(n, "triangle", 500, 900, 0.08, 0.08 * e);
    },
    close: (n, e) => {
      $e(n, "triangle", 900, 500, 0.08, 0.06 * e);
    },
    err: (n, e) => {
      ($e(n, "square", 200, 180, 0.12, 0.1 * e), $e(n + 0.13, "square", 160, 150, 0.15, 0.1 * e));
    },
    dash: (n, e) => {
      Dt(n, 0.2, 0.3 * e, "bandpass", 800, 1, 3e3);
    },
    reload: (n, e) => {
      ($e(n, "square", 400, 300, 0.03, 0.06 * e), $e(n + 0.12, "square", 700, 500, 0.03, 0.06 * e));
    },
    hurt: (n, e) => {
      ($e(n, "sawtooth", 220, 110, 0.15, 0.15 * e), Dt(n, 0.1, 0.2 * e, "lowpass", 1200));
    },
    shieldbreak: (n, e) => {
      ($e(n, "sawtooth", 1200, 200, 0.3, 0.12 * e), Dt(n, 0.3, 0.3 * e, "highpass", 2e3, 1, 500));
    },
    beep: (n, e, t) => {
      $e(n, "square", 880 * t, 880 * t, 0.08, 0.06 * e);
    },
    success: (n, e) => {
      [660, 880, 1320].forEach((t, i) => $e(n + i * 0.09, "sine", t, t, 0.2, 0.12 * e));
    },
    alarm: (n, e) => {
      for (let t = 0; t < 4; t++) $e(n + t * 0.25, "sawtooth", 700, 400, 0.22, 0.1 * e);
    },
    roar: (n, e) => {
      (Dt(n, 1.4, 0.7 * e, "lowpass", 500, 4, 120),
        $e(n, "sawtooth", 70, 40, 1.2, 0.3 * e),
        $e(n, "square", 110, 55, 1, 0.15 * e));
    },
    portal: (n, e) => {
      ($e(n, "sine", 200, 1200, 0.8, 0.2 * e),
        $e(n, "triangle", 300, 1600, 0.8, 0.08 * e),
        Dt(n, 0.9, 0.2 * e, "bandpass", 500, 2, 4e3));
    },
    heal: (n, e) => {
      [523, 784, 1046].forEach((t, i) => $e(n + i * 0.06, "sine", t, t * 1.01, 0.3, 0.09 * e));
    },
    buff: (n, e) => {
      ($e(n, "sawtooth", 300, 1200, 0.3, 0.1 * e), $e(n + 0.05, "sine", 600, 2400, 0.35, 0.1 * e));
    },
    enemyshot: (n, e) => {
      $e(n, "square", 500, 200, 0.07, 0.04 * e);
    },
    orbshot: (n, e) => {
      $e(n, "sine", 400, 900, 0.1, 0.05 * e);
    },
    step: (n, e) => {
      Dt(n, 0.04, 0.05 * e, "lowpass", 600);
    },
    door: (n, e) => {
      (Dt(n, 1, 0.4 * e, "lowpass", 300, 2, 120), $e(n, "sawtooth", 50, 45, 1, 0.15 * e));
    },
    chest: (n, e) => {
      ($e(n, "square", 200, 400, 0.1, 0.1 * e),
        Dt(n, 0.15, 0.2 * e, "bandpass", 1200, 2),
        [784, 988, 1318].forEach((t, i) => $e(n + 0.15 + i * 0.07, "triangle", t, t, 0.2, 0.1 * e)));
    },
  },
  Mg = {
    valle: [0, 2, 4, 7, 9],
    ciudad: [0, 3, 5, 7, 10],
    desierto: [0, 1, 4, 5, 7, 8, 10],
    marisma: [0, 3, 5, 6, 10],
    tundra: [0, 2, 3, 7, 9],
    complejo: [0, 3, 6, 7, 10],
    caldera: [0, 1, 5, 6, 8],
    yermo: [0, 3, 5, 6, 10],
    colmena: [0, 1, 4, 6, 8],
    op: [0, 3, 5, 6, 7, 10],
    base: [0, 2, 4, 7, 9],
  },
  wg = {
    valle: 57,
    ciudad: 52,
    desierto: 50,
    marisma: 48,
    tundra: 55,
    complejo: 45,
    caldera: 43,
    yermo: 47,
    colmena: 41,
    op: 45,
    base: 57,
  },
  bo = {
    key: "valle",
    intensity: 0,
    timer: 0,
    drones: [],
    beat: 0,
    started: !1,
    boss: !1,
    start() {
      ((this.started = !0), this.setKey("base"));
    },
    setKey(n) {
      if (!Ot) {
        this.key = n;
        return;
      }
      if (this.key === n && this.drones.length) return;
      this.key = n;
      let e = Ot.currentTime;
      for (let s of this.drones) (s.g.gain.setTargetAtTime(1e-4, e, 1.2), s.o.stop(e + 5));
      this.drones = [];
      let t = wg[n] ?? 50,
        i = (s, a, r, o = 0) => {
          let l = Ot.createOscillator();
          ((l.type = a), (l.frequency.value = 440 * Math.pow(2, (s - 69) / 12)), (l.detune.value = o));
          let c = Ot.createBiquadFilter();
          ((c.type = "lowpass"), (c.frequency.value = 600), (c.Q.value = 0.5));
          let d = Ot.createGain();
          ((d.gain.value = 1e-4), d.gain.setTargetAtTime(r, e, 2.5));
          let h = Ot.createOscillator();
          h.frequency.value = 0.05 + Math.random() * 0.1;
          let f = Ot.createGain();
          ((f.gain.value = 250),
            h.connect(f),
            f.connect(c.frequency),
            h.start(),
            l.connect(c),
            c.connect(d),
            d.connect(ds),
            l.start(),
            this.drones.push({ o: l, g: d, lfo: h }));
        };
      (i(t - 24, "sawtooth", 0.05, -6), i(t - 12, "triangle", 0.05, 5), i(t - 5, "sine", 0.03));
    },
    update(n, e, t) {
      if (
        !(!Ot || Ot.state !== "running") &&
        ((this.intensity += (e - this.intensity) * Math.min(1, n * 0.8)),
        (this.boss = t),
        (this.timer -= n),
        this.timer <= 0)
      ) {
        let i = Mg[this.key] || Mg.valle,
          s = wg[this.key] ?? 50,
          a = t ? 0.2 : this.intensity > 0.3 ? 0.25 : 0.6 + Math.random() * 1.4;
        ((this.timer = a), this.beat++);
        let r = Ot.currentTime;
        if (Math.random() < (this.intensity > 0.3 ? 0.55 : 0.4)) {
          let o = s + i[Math.floor(Math.random() * i.length)] + (Math.random() < 0.3 ? 12 : 0),
            l = 440 * Math.pow(2, (o - 69) / 12);
          $e(r, "triangle", l, l, 1.2 + Math.random(), 0.03 + 0.02 * Math.random(), ds, 0.02);
        }
        if (
          (this.intensity > 0.3 || t) &&
          (this.beat % 4 === 0 && $e(r, "sine", 110, 40, 0.25, 0.22 * Math.min(1, this.intensity + (t ? 0.5 : 0)), ds),
          this.beat % 4 === 2 && Dt(r, 0.12, 0.08 * this.intensity, "bandpass", 1800, 1, null, ds),
          t && this.beat % 2 === 1 && Dt(r, 0.05, 0.05, "highpass", 6e3, 1, null, ds),
          t && this.beat % 8 === 0)
        ) {
          let o = s - 12 + i[(this.beat / 8) % i.length],
            l = 440 * Math.pow(2, (o - 69) / 12);
          $e(r, "sawtooth", l, l, 0.9, 0.06, ds, 0.01);
        }
      }
    },
  };

