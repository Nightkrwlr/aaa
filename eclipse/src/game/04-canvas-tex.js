// 04-canvas-tex.js — Texturas generadas con canvas (glow, anillos, ruido)

// ════════ [317] FunctionDeclaration Ml (192 bytes) ════════
function Ml(n, e, t = !0) {
  let i = document.createElement("canvas");
  i.width = i.height = n;
  let s = i.getContext("2d");
  e(s, n);
  let a = new Xc(i);
  return (t && (a.wrapS = a.wrapT = ei), (a.colorSpace = Pt), (a.anisotropy = 4), a);
}


// ════════ [318] VariableDeclaration yd,_d,Md,_l,wd (19 bytes) ════════
var yd, _d, Md, _l, wd;


// ════════ [319] FunctionDeclaration yg (429 bytes) ════════
function yg() {
  if (yd) return yd;
  let n = Ii(42),
    e = Ii(43);
  return (
    (yd = Ml(256, (t, i) => {
      let s = t.createImageData(i, i);
      for (let a = 0; a < i; a++)
        for (let r = 0; r < i; r++) {
          let o = (r / i) * Math.PI * 2,
            l = (a / i) * Math.PI * 2,
            c =
              n.fbm(Math.cos(o) * 3 + 10, Math.sin(o) * 3 + Math.cos(l) * 3, 4) * 0.5 +
              e(Math.sin(l) * 9 + 3, Math.cos(o) * 9) * 0.35,
            d = Math.max(0, Math.min(255, 222 + c * 70 + (Math.random() - 0.5) * 18)),
            h = (a * i + r) * 4;
          ((s.data[h] = s.data[h + 1] = s.data[h + 2] = d), (s.data[h + 3] = 255));
        }
      t.putImageData(s, 0, 0);
    })),
    yd
  );
}


// ════════ [320] FunctionDeclaration _g (393 bytes) ════════
function _g() {
  if (_l) return _l;
  let n = Ii(77);
  return (
    (_l = Ml(128, (e, t) => {
      let i = e.createImageData(t, t);
      for (let s = 0; s < t; s++)
        for (let a = 0; a < t; a++) {
          let r = (a / t) * Math.PI * 2,
            o = (s / t) * Math.PI * 2,
            l = n.fbm(Math.cos(r) * 1.5 + 5, Math.sin(r) * 1.5 + Math.cos(o) * 1.5 + Math.sin(o), 4),
            c = Math.max(0, Math.min(255, 140 + l * 260)),
            d = (s * t + a) * 4;
          ((i.data[d] = i.data[d + 1] = i.data[d + 2] = c), (i.data[d + 3] = 255));
        }
      e.putImageData(i, 0, 0);
    })),
    (_l.colorSpace = vi),
    _l
  );
}


// ════════ [321] FunctionDeclaration cr (262 bytes) ════════
function cr() {
  return (
    _d ||
    ((_d = Ml(
      64,
      (n, e) => {
        let t = n.createRadialGradient(e / 2, e / 2, 0, e / 2, e / 2, e / 2);
        (t.addColorStop(0, "rgba(255,255,255,1)"),
          t.addColorStop(0.4, "rgba(255,255,255,0.55)"),
          t.addColorStop(1, "rgba(255,255,255,0)"),
          (n.fillStyle = t),
          n.fillRect(0, 0, e, e));
      },
      !1,
    )),
    _d)
  );
}


// ════════ [322] FunctionDeclaration Ys (331 bytes) ════════
function Ys() {
  return (
    Md ||
    ((Md = Ml(
      128,
      (n, e) => {
        ((n.strokeStyle = "rgba(255,255,255,1)"),
          (n.lineWidth = 6),
          n.beginPath(),
          n.arc(e / 2, e / 2, e / 2 - 6, 0, Math.PI * 2),
          n.stroke());
        let t = n.createRadialGradient(e / 2, e / 2, 0, e / 2, e / 2, e / 2);
        (t.addColorStop(0.6, "rgba(255,255,255,0)"),
          t.addColorStop(1, "rgba(255,255,255,0.35)"),
          (n.fillStyle = t),
          n.fillRect(0, 0, e, e));
      },
      !1,
    )),
    Md)
  );
}


// ════════ [323] FunctionDeclaration Ed (502 bytes) ════════
function Ed() {
  return (
    wd ||
    ((wd = Ml(
      256,
      (n, e) => {
        (n.translate(e / 2, e / 2), (n.strokeStyle = "#fff"), (n.lineWidth = 4));
        for (let t of [118, 100, 60]) (n.beginPath(), n.arc(0, 0, t, 0, Math.PI * 2), n.stroke());
        n.lineWidth = 3;
        for (let t = 0; t < 12; t++)
          (n.save(),
            n.rotate((t / 12) * Math.PI * 2),
            n.beginPath(),
            n.moveTo(0, -100),
            n.lineTo(8, -112),
            n.lineTo(-8, -112),
            n.closePath(),
            n.stroke(),
            n.fillRect(-2, -92, 4, 18),
            n.restore());
        for (let t = 0; t < 6; t++)
          (n.save(),
            n.rotate((t / 6) * Math.PI * 2),
            n.beginPath(),
            n.moveTo(0, -60),
            n.lineTo(0, -20),
            n.stroke(),
            n.restore());
      },
      !1,
    )),
    wd)
  );
}

