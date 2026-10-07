// 06-input.js — Mapa de teclas y entrada

// ════════ [325] VariableDeclaration yw,Tt (2501 bytes) ════════
var yw = {
    Space: "dash",
    ShiftLeft: "dash",
    KeyE: "interact",
    KeyG: "grenade",
    KeyQ: "swap",
    KeyF: "flash",
    Digit1: "medkit",
    Digit2: "stim",
    KeyI: "inv",
    Tab: "inv",
    KeyM: "map",
    KeyJ: "quests",
    KeyC: "char",
    Escape: "pause",
    KeyR: "reload",
    KeyH: "help",
    KeyP: "pause",
    KeyL: "archive",
  },
  Tt = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: !1, moved: !1 },
    wheel: 0,
    joy: { active: !1, id: null, ox: 0, oy: 0, x: 0, y: 0 },
    touchMode: !1,
    enabled: !0,
    init(n) {
      (addEventListener("keydown", (i) => {
        if (!(i.target && (i.target.tagName === "INPUT" || i.target.tagName === "TEXTAREA"))) {
          if ((i.code === "Tab" && i.preventDefault(), !this.keys.has(i.code))) {
            let s = yw[i.code];
            s && this.pressed.add(s);
          }
          this.keys.add(i.code);
        }
      }),
        addEventListener("keyup", (i) => this.keys.delete(i.code)));
      let e = () => {
        (this.keys.clear(), (this.mouse.down = !1), (this.joy = { active: !1, id: null, ox: 0, oy: 0, x: 0, y: 0 }));
      };
      (addEventListener("blur", e),
        document.addEventListener("visibilitychange", e),
        addEventListener("orientationchange", e),
        n.addEventListener("mousemove", (i) => {
          ((this.mouse.x = i.clientX), (this.mouse.y = i.clientY), (this.mouse.moved = !0));
        }),
        n.addEventListener("mousedown", (i) => {
          i.button === 0 && (this.mouse.down = !0);
        }),
        addEventListener("mouseup", (i) => {
          i.button === 0 && (this.mouse.down = !1);
        }),
        n.addEventListener(
          "wheel",
          (i) => {
            ((this.wheel += Math.sign(i.deltaY)), i.preventDefault());
          },
          { passive: !1 },
        ),
        n.addEventListener("contextmenu", (i) => i.preventDefault()),
        n.addEventListener(
          "touchstart",
          (i) => {
            this.touchMode = !0;
            for (let s of i.changedTouches)
              this.joy.active ||
                (this.joy = { active: !0, id: s.identifier, ox: s.clientX, oy: s.clientY, x: 0, y: 0 });
            i.preventDefault();
          },
          { passive: !1 },
        ),
        n.addEventListener(
          "touchmove",
          (i) => {
            for (let s of i.changedTouches)
              if (s.identifier === this.joy.id) {
                let a = s.clientX - this.joy.ox,
                  r = s.clientY - this.joy.oy,
                  o = Math.hypot(a, r),
                  l = 55;
                (o > l &&
                  ((this.joy.ox += a * (1 - l / o)), (this.joy.oy += r * (1 - l / o)), (a *= l / o), (r *= l / o)),
                  (this.joy.x = a / l),
                  (this.joy.y = r / l));
              }
            i.preventDefault();
          },
          { passive: !1 },
        ));
      let t = (i) => {
        for (let s of i.changedTouches)
          s.identifier === this.joy.id && (this.joy = { active: !1, id: null, ox: 0, oy: 0, x: 0, y: 0 });
      };
      (n.addEventListener("touchend", t), n.addEventListener("touchcancel", t));
    },
    press(n) {
      this.pressed.add(n);
    },
    hit(n) {
      return this.pressed.has(n) ? (this.pressed.delete(n), !0) : !1;
    },
    endFrame() {
      (this.pressed.clear(), (this.wheel = 0));
    },
    moveVec() {
      let n = 0,
        e = 0,
        t = this.keys;
      ((t.has("KeyW") || t.has("ArrowUp")) && (e += 1),
        (t.has("KeyS") || t.has("ArrowDown")) && (e -= 1),
        (t.has("KeyD") || t.has("ArrowRight")) && (n += 1),
        (t.has("KeyA") || t.has("ArrowLeft")) && (n -= 1),
        this.joy.active && ((n = this.joy.x), (e = -this.joy.y)));
      let i = Math.hypot(n, e);
      if (i < 0.15) return [0, 0];
      i > 1 && ((n /= i), (e /= i), (i = 1));
      let s = Math.SQRT1_2;
      return [(n - e) * s, (-n - e) * s];
    },
  };

