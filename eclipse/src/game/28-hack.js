// 28-hack.js — Mini-juegos de hackeo

// ════════ [657] VariableDeclaration ob,QE (205 bytes) ════════
var ob = ["seq", "pipe", "code", "sync", "lights"],
  QE = {
    seq: "Secuencia de memoria",
    pipe: "Enrutado de energ\xEDa",
    code: "Descifrado de c\xF3digo",
    sync: "Sincronizaci\xF3n de pulso",
    lights: "Matriz de interruptores",
  };


// ════════ [658] FunctionDeclaration lb (88 bytes) ════════
function lb(n) {
  let e = 0;
  for (let t of n) e = (e * 31 + t.charCodeAt(0)) >>> 0;
  return ob[e % ob.length];
}


// ════════ [659] VariableDeclaration cb (10 bytes) ════════
var cb = QE;


// ════════ [660] FunctionDeclaration db (7123 bytes) ════════
function db(n, e, t, i) {
  let s = !1,
    a = [],
    r = (h) => {
      s ||
        ((s = !0),
        a.forEach(clearInterval),
        a.forEach(clearTimeout),
        ae.play(h ? "success" : "err"),
        setTimeout(() => i(h), h ? 400 : 250));
    },
    o = pi((Math.random() * 1e9) | 0),
    l = { seq: 0, pipe: 50 - t * 4, code: 0, sync: 0, lights: 60 - t * 5 }[e];
  n.innerHTML = `<div class="pz"><div class="info" id="pzInfo"></div><div id="pzBody"></div>${l ? '<div class="timer" id="pzT"></div>' : ""}</div>`;
  let c = n.querySelector("#pzInfo"),
    d = n.querySelector("#pzBody");
  if (l) {
    let h = l,
      f = n.querySelector("#pzT");
    ((f.textContent = h + " s"),
      a.push(
        setInterval(() => {
          (h--, (f.textContent = h + " s"), h <= 5 && ae.play("beep", { p: 1.6 }), h <= 0 && r(!1));
        }, 1e3),
      ));
  }
  if (e === "seq") {
    let f = 3 + t,
      u = Array.from({ length: f }, () => Math.floor(o() * 9)),
      p = t <= 2 ? 2 : 1,
      m = 0,
      g = !0;
    d.innerHTML = `<div class="pgrid" style="grid-template-columns:repeat(3,auto)">${Array.from({ length: 9 }, (v, _) => `<button class="pc" data-i="${_}" aria-label="Celda ${_ + 1}"></button>`).join("")}</div>`;
    let b = [...d.querySelectorAll(".pc")],
      y = () => {
        ((g = !0), (c.textContent = "MEMORIZA LA SECUENCIA"));
        let v = 0,
          _ = setInterval(
            () => {
              if ((b.forEach((T) => T.classList.remove("lit")), v >= u.length)) {
                (clearInterval(_),
                  (g = !1),
                  (c.textContent = `REPITE LA SECUENCIA \xB7 ${p} intento${p > 1 ? "s" : ""}`));
                return;
              }
              let A = b[u[v]];
              (setTimeout(() => {
                (A.classList.add("lit"), ae.play("beep", { p: 0.8 + u[v] * 0.08 }));
              }, 120),
                v++);
            },
            650 - t * 50,
          );
        a.push(_);
      };
    (b.forEach((v) =>
      v.addEventListener("click", () => {
        if (g || s) return;
        let _ = +v.dataset.i;
        (v.classList.add("lit"),
          setTimeout(() => v.classList.remove("lit"), 180),
          _ === u[m]
            ? (ae.play("beep", { p: 0.8 + _ * 0.08 }), m++, m >= u.length && r(!0))
            : (p--, p <= 0 ? r(!1) : ((m = 0), ae.play("err"), setTimeout(y, 500))));
      }),
    ),
      a.push(setTimeout(y, 500)));
  } else if (e === "pipe") {
    let h = 4 + Math.min(2, t),
      f = Array.from({ length: h * h }, () => 0),
      u = 0,
      p = Math.floor(o() * h),
      m = p;
    f[p * h + u] |= 8;
    let g = new Set([p * h + u]);
    for (; u < h - 1;) {
      let S = [];
      (p > 0 && !g.has((p - 1) * h + u) && S.push([0, -1, 1, 4]),
        p < h - 1 && !g.has((p + 1) * h + u) && S.push([0, 1, 4, 1]),
        S.push([1, 0, 2, 8]),
        S.push([1, 0, 2, 8]));
      let [k, w, E, H] = S[Math.floor(o() * S.length)];
      ((f[p * h + u] |= E), (u += k), (p += w), (f[p * h + u] |= H), g.add(p * h + u));
    }
    f[p * h + u] |= 2;
    let b = p;
    for (let S = 0; S < h * h; S++) f[S] || (f[S] = [3, 5, 6, 7, 10, 11, 12][Math.floor(o() * 7)]);
    let y = (S, k) => {
        for (let w = 0; w < k; w++) S = ((S << 1) | (S >> 3)) & 15;
        return S;
      },
      v = f.map((S) => y(S, Math.floor(o() * 4)));
    c.textContent = "GIRA LOS CONDUCTOS PARA LLEVAR LA ENERG\xCDA DE IZQUIERDA A DERECHA";
    let _ = (S, k) => {
        let w = k ? "#46e4ff" : "#4a5a60",
          E = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="4" fill="${w}"/>`;
        return (
          S & 1 && (E += `<rect x="17" y="0" width="6" height="20" fill="${w}"/>`),
          S & 2 && (E += `<rect x="20" y="17" width="20" height="6" fill="${w}"/>`),
          S & 4 && (E += `<rect x="17" y="20" width="6" height="20" fill="${w}"/>`),
          S & 8 && (E += `<rect x="0" y="17" width="20" height="6" fill="${w}"/>`),
          E + "</svg>"
        );
      },
      A = () => {
        let S = new Set(),
          k = [],
          w = m * h;
        for (v[w] & 8 && (S.add(w), k.push(w)); k.length;) {
          let E = k.pop(),
            H = E % h,
            Z = (E / h) | 0,
            me = v[E],
            G = [
              [1, 0, -1, 4],
              [2, 1, 0, 8],
              [4, 0, 1, 1],
              [8, -1, 0, 2],
            ];
          for (let [L, B, I, M] of G) {
            if (!(me & L)) continue;
            let z = H + B,
              O = Z + I;
            if (z < 0 || O < 0 || z >= h || O >= h) continue;
            let N = O * h + z;
            S.has(N) || !(v[N] & M) || (S.add(N), k.push(N));
          }
        }
        return S;
      },
      T = () => {
        let S = A();
        ((d.innerHTML = `<div style="display:flex;align-items:center;gap:6px"><div style="display:grid;grid-template-rows:repeat(${h},auto);gap:5px">${Array.from({ length: h }, (k, w) => `<div style="height:min(64px,15vw);width:10px;background:${w === m ? "#46e4ff" : "transparent"}"></div>`).join("")}</div><div class="pgrid" style="grid-template-columns:repeat(${h},auto)">${v.map((k, w) => `<button class="pc" data-i="${w}" aria-label="Conducto">${_(k, S.has(w))}</button>`).join("")}</div><div style="display:grid;grid-template-rows:repeat(${h},auto);gap:5px">${Array.from({ length: h }, (k, w) => `<div style="height:min(64px,15vw);width:10px;background:${w === b ? (S.has(b * h + h - 1) && v[b * h + h - 1] & 2 ? "#5fd35a" : "#ffb340") : "transparent"}"></div>`).join("")}</div></div>`),
          d.querySelectorAll(".pc").forEach((k) =>
            k.addEventListener("click", () => {
              if (s) return;
              let w = +k.dataset.i;
              ((v[w] = y(v[w], 1)), ae.play("beep", { p: 1.2 }), T());
            }),
          ),
          S.has(b * h + h - 1) && v[b * h + h - 1] & 2 && r(!0));
      };
    T();
  } else if (e === "code") {
    let h = 3 + Math.min(2, Math.floor(t / 2)),
      f = 6,
      u = 7 - Math.min(2, t - 1),
      p = Array.from({ length: h }, () => Math.floor(o() * f)),
      m = Array(h).fill(0),
      g = [],
      b = () => {
        ((c.textContent = `ADIVINA EL C\xD3DIGO (${h} cifras, 0\u2013${f - 1}) \xB7 INTENTOS: ${u}`),
          (d.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:10px"><div class="code">${m.map((y, v) => `<button class="dig" data-i="${v}">${y}</button>`).join("")}</div><button class="btn pri" id="pzGo">PROBAR</button><div class="hist">${g.map((y) => `<div>${y.g.join(" ")} &nbsp; <span style="color:#5fd35a">\u25CF ${y.a}</span> <span style="color:#ffb340">\u25CB ${y.b}</span></div>`).join("")}</div><div class="info" style="font-size:12px">\u25CF cifra correcta en su sitio \xB7 \u25CB cifra correcta en otro sitio</div></div>`),
          d.querySelectorAll(".dig").forEach((y) => {
            (y.addEventListener("click", () => {
              ((m[+y.dataset.i] = (m[+y.dataset.i] + 1) % f), ae.play("beep"), b());
            }),
              y.addEventListener("contextmenu", (v) => {
                (v.preventDefault(), (m[+y.dataset.i] = (m[+y.dataset.i] + f - 1) % f), b());
              }));
          }),
          d.querySelector("#pzGo").addEventListener("click", () => {
            if (s) return;
            let y = 0,
              v = 0,
              _ = {},
              A = {};
            for (let T = 0; T < h; T++)
              m[T] === p[T] ? y++ : ((_[p[T]] = (_[p[T]] || 0) + 1), (A[m[T]] = (A[m[T]] || 0) + 1));
            for (let T in A) v += Math.min(A[T], _[T] || 0);
            if ((g.unshift({ g: m.slice(), a: y, b: v }), u--, y === h)) return r(!0);
            if (u <= 0) return r(!1);
            b();
          }));
      };
    b();
  } else if (e === "sync") {
    let h = 2 + t,
      f = 0,
      u = 2,
      p = 0,
      m = 1,
      g = 0.3 - t * 0.03,
      b = 0.35,
      y = 0.9 + t * 0.25;
    d.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;gap:12px"><div class="syncbar"><div class="zone"></div><div class="cur"></div></div><button class="btn pri" id="pzHit" style="min-width:160px">SINCRONIZAR</button></div>';
    let v = d.querySelector(".zone"),
      _ = d.querySelector(".cur"),
      A = () => {
        ((b = 0.05 + o() * (0.9 - g)), (v.style.left = b * 100 + "%"), (v.style.width = g * 100 + "%"));
      },
      T = () => (c.textContent = `DET\xC9N EL PULSO EN LA ZONA VERDE \xB7 ${f}/${h} \xB7 FALLOS RESTANTES: ${u}`);
    (A(), T());
    let S = performance.now(),
      k = setInterval(() => {
        let Z = performance.now(),
          me = (Z - S) / 1e3;
        ((S = Z),
          (p += m * y * me),
          p > 1 && ((p = 1), (m = -1)),
          p < 0 && ((p = 0), (m = 1)),
          (_.style.left = `calc(${p * 100}% - 2px)`));
      }, 16);
    a.push(k);
    let w = () => {
      s ||
        (p >= b && p <= b + g
          ? (f++, ae.play("beep", { p: 1.4 }), (g = Math.max(0.1, g * 0.85)), (y *= 1.12), A(), f >= h && r(!0))
          : (u--, ae.play("err"), u <= 0 && r(!1)),
        T());
    };
    d.querySelector("#pzHit").addEventListener("click", w);
    let E = (Z) => {
      (Z.code === "Space" || Z.code === "KeyE") && (Z.preventDefault(), w());
    };
    (addEventListener("keydown", E), a.push(setTimeout(() => {}, 0)));
    let H = r;
    n._cleanup = () => removeEventListener("keydown", E);
  } else if (e === "lights") {
    let h = t >= 3 ? 5 : 4,
      f = Array(h * h).fill(!1),
      u = (b) => {
        let y = b % h,
          v = (b / h) | 0;
        for (let [_, A] of [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          let T = y + _,
            S = v + A;
          T >= 0 && S >= 0 && T < h && S < h && (f[S * h + T] = !f[S * h + T]);
        }
      },
      p = 3 + t;
    for (let b = 0; b < p; b++) u(Math.floor(o() * h * h));
    f.some((b) => b) || u(0);
    let m = p + 6,
      g = () => {
        ((c.textContent = `APAGA TODOS LOS NODOS \xB7 MOVIMIENTOS: ${m}`),
          (d.innerHTML = `<div class="pgrid" style="grid-template-columns:repeat(${h},auto)">${f.map((b, y) => `<button class="pc ${b ? "on" : ""}" data-i="${y}" aria-label="Nodo"></button>`).join("")}</div>`),
          d.querySelectorAll(".pc").forEach((b) =>
            b.addEventListener("click", () => {
              if (!s) {
                if ((u(+b.dataset.i), m--, ae.play("beep", { p: 1.1 }), !f.some((y) => y))) return (g(), r(!0));
                if (m <= 0) return (g(), r(!1));
                g();
              }
            }),
          ));
      };
    g();
  }
  return () => {
    ((s = !0), a.forEach(clearInterval), a.forEach(clearTimeout), n._cleanup && n._cleanup());
  };
}

