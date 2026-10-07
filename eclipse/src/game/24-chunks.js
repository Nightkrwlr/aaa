// 24-chunks.js — Parche de balanceo del viento y clase de chunk de mundo (Ul)

// ════════ [607] FunctionDeclaration Hx (162 bytes) ════════
function Hx(n, e, t) {
  let i = n + "|" + t;
  if (_p.has(i)) return _p.get(i);
  let a = (Ie[n] || Ie.rock)(e, 5),
    r = { g: eh(a.g || []), e: a.e ? eh(a.e) : null, dim: a.dim ?? 1 };
  return (_p.set(i, r), r);
}


// ════════ [608] VariableDeclaration zo,wp (204 bytes) ════════
var zo = { uTime: { value: 0 } },
  wp = new Set([
    "oak",
    "pine",
    "bush",
    "dead_tree",
    "swamp_tree",
    "pine_snow",
    "tendril",
    "reeds",
    "cactus",
    "grass",
    "dry_grass",
    "flower",
    "reed_small",
    "shroom_small",
    "mushroom",
    "xeno_spire",
  ]);


// ════════ [609] FunctionDeclaration Ep (951 bytes) ════════
function Ep(n, e = 1, t = 0.06) {
  let i = n.onBeforeCompile,
    s = n.customProgramCacheKey ? n.customProgramCacheKey.call(n) : "";
  return (
    (n.onBeforeCompile = function (a, r) {
      (i && i.call(this, a, r),
        (a.uniforms.uTime = zo.uTime),
        (a.uniforms.uSwH = { value: Math.max(0.05, e) }),
        (a.uniforms.uSwA = { value: t }),
        (a.vertexShader = a.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
uniform float uTime; uniform float uSwH; uniform float uSwA;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
        { vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
          #endif
          float hn = clamp(position.y / uSwH, 0.0, 1.0); hn *= hn;
          float w = sin(uTime * 1.6 + ip.x * 0.37 + ip.z * 0.53) * 0.6 + sin(uTime * 2.7 + ip.x * 0.9) * 0.3 + sin(uTime * 0.7 + ip.z * 0.21) * 0.4;
          transformed.x += w * uSwA * uSwH * hn; transformed.z += w * uSwA * uSwH * hn * 0.55; }`,
          )));
    }),
    (n.customProgramCacheKey = () => s + "|sway"),
    (n.needsUpdate = !0),
    n
  );
}


// ════════ [610] VariableDeclaration Nl,nn,Va,Sp (663 bytes) ════════
var Nl = [
    { f: 6974564, w: 8225140 },
    { f: 6972508, w: 9077880 },
    { f: 11569754, w: 13148272 },
    { f: 5916208, w: 6967352 },
    { f: 8018490, w: 5914672 },
    { f: 4870232, w: 8028296 },
    { f: 2761766, w: 3813428 },
    { f: 4857920, w: 6957674 },
    { f: 3817026, w: 5922920 },
    { f: 3814964, w: 4867136 },
    { f: 8027252, w: 5922896 },
    { f: 12633288, w: 14541285 },
    { f: 10137792, w: 6982304 },
    { f: 2761762, w: 3813424 },
    { f: 6967368, w: 9062968 },
    { f: 9077368, w: 13156528 },
    { f: 4866104, w: 8014378 },
    { f: 10519648, w: 12096618 },
    { f: 6976640, w: 9085112 },
    { f: 5921886, w: 7237746 },
    { f: 7371392, w: 5929626 },
    { f: 5917252, w: 10107434 },
    { f: 13159624, w: 14870242 },
    { f: 5922378, w: 5925434 },
    { f: 5591626, w: 12097066 },
    { f: 3422268, w: 4474958 },
    { f: 10119754, w: 12084282 },
    { f: 6967352, w: 9055780 },
  ],
  nn = new Ee(),
  Va = 32,
  Sp = null;


// ════════ [611] FunctionDeclaration NE (205 bytes) ════════
// Buffers de trabajo compartidos por los chunks. Los atributos de mezcla del terreno van en Uint8 (capa propia/vecina,
// estados de borde, color de la capa vecina) para no engordar la geometría del mapa entero.
function NE() {
  if (!Sp) {
    let n = Va * Va * 5 * 6;
    Sp = {
      pos: new Float32Array(n * 3),
      nor: new Float32Array(n * 3),
      col: new Float32Array(n * 3),
      uv: new Float32Array(n * 2),
      lay: new Uint8Array(n * 4),
      edge: new Uint8Array(n * 4),
      col2: new Uint8Array(n * 4),
    };
  }
  return Sp;
}


// ════════ [612] FunctionDeclaration UE (402 bytes) ════════
function UE(n) {
  let e = {
      valle: 3103274,
      ciudad: 3824170,
      desierto: 6978106,
      marisma: 3820074,
      tundra: 2771514,
      complejo: 3820074,
      caldera: 2763296,
      yermo: 5921322,
      colmena: 4856394,
    }[n.key],
    t = {
      valle: 4880946,
      ciudad: 4876850,
      desierto: 8030786,
      marisma: 4872746,
      tundra: 3824202,
      complejo: 4872754,
      caldera: 3815978,
      yermo: 6974010,
      colmena: 6957674,
    }[n.key];
  return { rock: n.rock, wall: n.wall, leaf: e, leaf2: t, grass: tt(n.ground[2], 16777215, 0.1) };
}


// ════════ terreno: tablas estáticas del frente «Terreno, muros y agua» ════════
// capa de muro / suelo de interior según la variante de la casilla (map.var)
const TER_WALL_BY_VAR = ["wall_military", "wall_ruin", "wall_adobe", "wall_wood", "wall_log", "wall_metal", "wall_obsidian", "wall_organic", "wall_military", null, "wall_military", "wall_military", "cliff_tundra", "wall_obsidian", "wall_ruin", "wall_adobe", "wall_metal", "wall_adobe", "wall_metal", "wall_military", "wall_metal", "wall_ruin", "wall_adobe", "wall_military", "wall_metal", "wall_metal", "wall_adobe", "wall_wood"];
const TER_FLOOR_BY_VAR = ["floor_concrete", "floor_tiles", "floor_adobe", "floor_wood", "floor_wood", "floor_metal", "cave_floor", "floor_organic", "floor_concrete", "cave_floor", "base_floor", "floor_tiles", "ice", "cave_floor", "floor_wood", "floor_tiles", "floor_metal", "floor_adobe", "floor_metal", "floor_concrete", "floor_tiles", "floor_wood", "floor_tiles", "floor_concrete", "floor_metal", "floor_metal", "floor_adobe", "floor_wood"];
// tema de mazmorra → bioma cuya paleta usa
const TER_THEME_REG = { ruinas: "ciudad", bunker: "complejo", laboratorio: "complejo", fabrica: "complejo", caverna: "tundra", magma: "caldera", colmena: "colmena" };
const TER_BIO_IDX = {}; BIO_KEYS.forEach((k, n) => (TER_BIO_IDX[k] = n));
const TER_N8 = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]; // W E N S + NW NE SW SE (orden que espera el shader)
const TER_VOTES = new Int16Array(64), TER_NBI = new Int32Array(64), TER_CAND = new Int16Array(8), TER_ZERO4 = [0, 0, 0, 0];
const TER_HSTEP = 0.2; // desnivel mínimo para que un vecino cuente como subida / caída (y no como «mismo nivel»)
const TER_LIQUID = (t) => t === F.WATER || t === F.LAVA || t === F.ACID;
const TER_DEPTH_R = 2; // alcance (casillas) del campo de profundidad de los líquidos
// capas que reciben la 2.ª muestra anti-repetición (las orgánicas; las de patrón regular, baldosa o metal, no)
function terOrgFlags() {
  let u = new Float32Array(32);
  for (let k in Et.layer || {}) {
    let n = Et.layer[k];
    if (n < 32 && /^(ground_|cliff_|cave_floor|floor_organic|wall_organic|road_dirt|wall_log|ice)/.test(k)) u[n] = 1;
  }
  return Array.from(u);
}


// ════════ [613] VariableDeclaration Ul (16541 bytes) ════════
var Ul = class {
  constructor(e, t) {
    ((this.map = e),
      (this.R = t),
      (this.group = new Ve()),
      (this.liquidMats = []),
      (this.secretMeshes = new Map()),
      (this.gateMeshes = new Map()));
    let i = e.kind === "op";
    if (
      ((this.theme = i ? e.themeObj || Zi[e.theme] : null),
      (this.noise = Ii(e.seed || 11)),
      (this.noise2 = Ii((e.seed || 11) + 5)),
      (this.heights = new Float32Array(e.w * e.h)),
      this.computeHeights(),
      (this.groundMat = new Xt({ vertexColors: !0, map: yg(), roughness: 0.92, metalness: 0.02 })),
      (this.useArr = !!Et.groundArray),
      this.useArr)
    ) {
      // suelo pintado (src/engine/terrain.js): mezcla de capas por fragmento, AO/bisel, macroescala por bioma
      let s = Et.groundArray,
        uni = {
          uArr: { value: s },
          uTime: zo.uTime,
          uCloud: { value: i ? 0 : 1 },
          uTexK: { value: Et.procTex ? 1.17 : 1 },
          uTN: { value: terrainNoise() },
          uOrg: { value: terOrgFlags() },
          ...bioUniforms(),
        };
      this.groundMat.map = null;
      this._tq = this.terQuality();
      this.groundMat.onBeforeCompile = (a) => {
        xo(a);
        patchGroundShader(a, { uniforms: uni, tq: this._tq });
      };
      this.groundMat.customProgramCacheKey = () => "ground-" + this._tq;
    }
    this.cliffMat = this.groundMat;
    for (let s = 0; s < e.h; s += Va) for (let a = 0; a < e.w; a += Va) this.buildChunk(a, s);
    (this.buildSecrets(), this.buildProps());
  }
  computeHeights() {
    let e = this.map,
      t = this.heights;
    for (let i = 0; i < e.h; i++)
      for (let s = 0; s < e.w; s++) {
        let a = i * e.w + s,
          r = e.ter[a],
          o = 0;
        if (r === F.WALL) o = e.wh && e.wh[a] ? e.wh[a] / 10 : 1.3;
        else if (r === F.ROCK) {
          let l = this.noise.fbm(s * 0.15, i * 0.15, 2);
          o = (e.border && e.border[a] ? 2.4 : 1.5) + l * 1.6 + ((s * 7 + i * 13) % 5) * 0.06;
        } else r === F.WATER || r === F.LAVA || r === F.ACID ? (o = -0.32) : r === F.VOID && (o = -0.01);
        t[a] = o;
      }
  }
  regionOf(e) {
    return this.map.kind === "op" ? null : De[this.map.reg[e]];
  }
  tileColor(e, t, i, s, a) {
    let r = this.map,
      o = r.ter[i],
      l = this.regionOf(i),
      c = this.theme,
      d,
      h,
      f = r.w + 1;
    if (s >= 0 && a >= 0 && s <= r.w && a <= r.h && (s | 0) === s && (a | 0) === a) {
      let p = a * f + s;
      (this._nvG ||
        ((this._nvG = new Float32Array(f * (r.h + 1)).fill(NaN)), (this._ndG = new Float32Array(f * (r.h + 1)))),
        (d = this._nvG[p]),
        d !== d &&
          ((d = this._nvG[p] = this.noise.fbm(s * 0.07, a * 0.07, 3)), (this._ndG[p] = this.noise2(s * 0.6, a * 0.6))),
        (h = this._ndG[p]));
    } else ((d = this.noise.fbm(s * 0.07, a * 0.07, 3)), (h = this.noise2(s * 0.6, a * 0.6)));
    let u = Nl[r.var[i]] || Nl[0];
    if (o === F.GROUND) {
      let p = l ? l.ground : c.floor,
        m = Math.max(0, Math.min(2.999, (d + 0.5) * 3)),
        g = p[Math.floor(m)],
        b = p[Math.min(p.length - 1, Math.floor(m) + 1)],
        y = tt(g, b, m % 1);
      return tt(y, p[3] ?? y, Math.max(0, h) * 0.4);
    }
    if (o === F.ROAD) {
      let p = l ? l.road : c.floor[2];
      return tt(p, 0, 0.05 + h * 0.08);
    }
    if (o === F.FLOOR || o === F.DOOR) {
      let p = c && r.var[i] === 0 ? c.floor[0] : u.f;
      return tt(p, (e + t) & 1 ? 0 : 16777215, 0.035 + h * 0.03);
    }
    if (o === F.BASE) return tt(8290424, ((e >> 1) + (t >> 1)) & 1 ? 0 : 16777215, 0.04 + h * 0.04);
    if (o === F.ARENA) {
      let p = this.arenaAt(s, a),
        m = p ? Math.hypot(s - p.x, a - p.z) : 0,
        g = Math.abs(Math.sin(m * 1.6)) < 0.12 ? 0.25 : 0;
      return tt(tt(l ? l.rock : 5592405, 1710618, 0.45), 16777215, g * 0.25 + h * 0.05);
    }
    if (o === F.ICE) return tt(12115184, 16777215, 0.2 + h * 0.2);
    if (o === F.CAVE) {
      let p = l ? l.rock : c.floor[1];
      return tt(p, 0, 0.45 - h * 0.1);
    }
    if (o === F.WATER || o === F.LAVA || o === F.ACID) return o === F.LAVA ? 2757128 : o === F.ACID ? 1714704 : 1714736;
    if (o === F.WALL || o === F.SECRET) {
      let p = c ? c.wall : u.w;
      return tt(p, 16777215, 0.12 + h * 0.04);
    }
    if (o === F.ROCK) {
      let p = l ? l.rock : c ? c.wall : 5592405;
      return tt(p, d > 0 ? 16777215 : 0, Math.abs(d) * 0.35 + h * 0.05);
    }
    return o === F.VOID ? 329224 : 5592405;
  }
  // clave de bioma de una casilla (región del mundo abierto o tema de la mazmorra)
  bioKey(i) {
    let a = this.map,
      o = this.regionOf(i);
    return o ? o.key : a.rk || TER_THEME_REG[a.theme] || "valle";
  }
  terQuality() {
    let q = this.R && this.R.quality;
    return q === "low" ? 0 : q === "medium" ? 1 : 2;
  }
  // capa del array de texturas de la casilla. La cara superior (s = false) se cachea: buildChunk la consulta 9 veces por casilla.
  layerFor(e, t, i, s) {
    let a = this.map;
    if (!s) {
      let q = this._lt || (this._lt = new Int16Array(a.w * a.h).fill(-2));
      return q[i] !== -2 ? q[i] : (q[i] = this.layerCalc(e, t, i, !1));
    }
    return this.layerCalc(e, t, i, !0);
  }
  layerCalc(e, t, i, s) {
    let a = this.map,
      r = a.ter[i],
      c = this.bioKey(i),
      d = (...m) => {
        for (let g of m) {
          let b = Et.layerOf(g);
          if (b >= 0) return b;
        }
        return -1;
      },
      h = ((e * 73856093) ^ (t * 19349663)) >>> 0,
      f = a.var[i],
      u = (f === 9 ? "cliff_" + c : TER_WALL_BY_VAR[f]) || "wall_military",
      p = TER_FLOOR_BY_VAR[f] || "floor_concrete";
    switch (r) {
      case F.GROUND: {
        let m = (h >> 3) & 1 ? "b" : "a";
        return c === "valle" && a.var[i] === 0
          ? d("ground_valle_dirt_" + m, "ground_valle_dirt_a", "ground_valle_" + m, "ground_valle_a")
          : d(`ground_${c}_${m}`, `ground_${c}_a`, `ground_${c}_b`);
      }
      case F.ROAD:
        return ["ciudad", "complejo", "yermo"].includes(c)
          ? d("road_asphalt", "road_dirt")
          : d("road_dirt", "road_asphalt");
      case F.FLOOR:
      case F.DOOR:
      case F.SECRET:
        return d(p, "floor_concrete");
      case F.BASE:
        return d("base_floor", "floor_concrete");
      case F.ARENA:
        return d("arena_floor");
      case F.CAVE:
        return d("cave_floor", "cliff_" + c);
      case F.ICE:
        return d("ice");
      case F.WALL:
        return d(u, "wall_military");
      case F.ROCK:
        return d("cliff_" + c, "cliff_valle");
      case F.WATER:
      case F.LAVA:
      case F.ACID:
        return s ? d("cliff_" + c, "cliff_valle") : -1;
    }
    return -1;
  }
  arenaAt(e, t) {
    this._arenas || (this._arenas = this.map.ents.filter((a) => a.k === "bossarena"));
    let i = null,
      s = 1e9;
    for (let a of this._arenas) {
      let r = Math.hypot(a.x - e, a.z - t);
      r < s && ((s = r), (i = a));
    }
    return i;
  }
  // Mezcla de capas de una casilla: capa «vecina» dominante (B), qué vecinos de borde (W,E,N,S) y diagonales son de esa capa,
  // y el estado de cada borde (2 caída sólida · 3 subida · 4 caída a líquido) para el AO de contacto y la luz de cresta.
  blendInfo(g, m, L, v) {
    let i = this.map,
      s = this.heights,
      R = this._bi || (this._bi = { st: [0, 0, 0, 0], bits: 0, B: 255, nbi: -1 }),
      votes = TER_VOTES,
      nbi = TER_NBI;
    votes.fill(0);
    nbi.fill(-1);
    R.st[0] = R.st[1] = R.st[2] = R.st[3] = 0;
    R.bits = 0;
    R.B = 255;
    R.nbi = -1;
    for (let k = 0; k < 8; k++) {
      let x = g + TER_N8[k][0],
        z = m + TER_N8[k][1],
        st = 0,
        cand = -1;
      if (i.inb(x, z)) {
        let j = z * i.w + x,
          tj = i.ter[j],
          hj = s[j];
        if (tj !== F.VOID && tj !== F.SECRET) {
          if (hj > v + TER_HSTEP) st = 3;
          else if (hj < v - TER_HSTEP) st = TER_LIQUID(tj) ? 4 : 2;
          else if (!TER_LIQUID(tj)) {
            let lj = this.layerFor(x, z, j, !1);
            if (lj >= 0 && lj !== L) {
              cand = lj;
              votes[lj] += k < 4 ? 2 : 1;
              if (nbi[lj] < 0 || k < 4) nbi[lj] = j;
            }
          }
        }
      }
      TER_CAND[k] = cand;
      k < 4 && (R.st[k] = st);
    }
    let best = 0;
    for (let k = 0; k < 64; k++) if (votes[k] > best) ((best = votes[k]), (R.B = k));
    if (best > 0) {
      R.nbi = nbi[R.B];
      for (let k = 0; k < 8; k++)
        if (TER_CAND[k] === R.B) k < 4 ? (R.st[k] = 1) : (R.bits |= 1 << (k - 4));
    }
    return R;
  }
  // distancia (en casillas, tope TER_DEPTH_R) de la esquina (X,Z) a la orilla más cercana del líquido de tipo k → 0..1
  liquidDepth(k, X, Z) {
    let i = this.map,
      best = TER_DEPTH_R,
      r = TER_DEPTH_R;
    for (let tz = Z - r; tz < Z + r; tz++)
      for (let tx = X - r; tx < X + r; tx++) {
        if (!i.inb(tx, tz) || i.ter[tz * i.w + tx] === k) continue;
        let dx = Math.max(tx - X, 0, X - tx - 1),
          dz = Math.max(tz - Z, 0, Z - tz - 1),
          dd = Math.hypot(dx, dz);
        dd < best && (best = dd);
      }
    return best / TER_DEPTH_R;
  }
  buildChunk(e, t) {
    var p;
    let i = this.map,
      s = this.heights,
      a = NE(),
      arr = this.useArr,
      r = 0,
      o = { water: [], lava: [], acid: [] },
      // estado del lote en curso (los lee h() para cada vértice)
      LA = 255, LB = 255, LZ = 0, LW = 0, ED = TER_ZERO4, ev = null, c2 = null,
      d = [0, 1, 2, 0, 2, 3],
      h = (m, g, b = 0, y = 1, v = 0) => {
        for (let _ = 0; _ < 6; _++) {
          let A = d[_],
            T = r++,
            S = m[A],
            k = g[A];
          a.pos[T * 3] = S[0];
          a.pos[T * 3 + 1] = S[1];
          a.pos[T * 3 + 2] = S[2];
          a.nor[T * 3] = b;
          a.nor[T * 3 + 1] = y;
          a.nor[T * 3 + 2] = v;
          a.col[T * 3] = k[0];
          a.col[T * 3 + 1] = k[1];
          a.col[T * 3 + 2] = k[2];
          if (arr) {
            let q = T * 4,
              E = ev ? ev[A] : ED,
              C = c2 ? c2[A] : null;
            a.lay[q] = LA;
            a.lay[q + 1] = LB;
            a.lay[q + 2] = LZ;
            a.lay[q + 3] = LW;
            a.edge[q] = E[0];
            a.edge[q + 1] = E[1];
            a.edge[q + 2] = E[2];
            a.edge[q + 3] = E[3];
            // color de la capa vecina codificado en raíz cuadrada (el 8 bits lineal se come los oscuros)
            a.col2[q] = C ? Math.sqrt(Math.min(C[0], 1)) * 255 : 0;
            a.col2[q + 1] = C ? Math.sqrt(Math.min(C[1], 1)) * 255 : 0;
            a.col2[q + 2] = C ? Math.sqrt(Math.min(C[2], 1)) * 255 : 0;
          } else {
            a.uv[T * 2] = S[0] * 0.32 + S[1] * 0.2;
            a.uv[T * 2 + 1] = S[2] * 0.32 + S[1] * 0.2;
          }
        }
      },
      f = (m, g = 1) => (nn.setHex(m), [nn.r * g, nn.g * g, nn.b * g]),
      u = (m, g) => (i.inb(m, g) ? s[g * i.w + m] : 2.5),
      mapBio = TER_BIO_IDX[this.bioKey(0)] ?? 0,
      grey = !Et.procTex;
    for (let m = t; m < Math.min(t + Va, i.h); m++)
      for (let g = e; g < Math.min(e + Va, i.w); g++) {
        let b = m * i.w + g,
          y = i.ter[b],
          v = s[b];
        if (y === F.VOID) continue;
        let L = arr ? this.layerFor(g, m, b, !1) : -1,
          bio = i.kind === "op" ? mapBio : (TER_BIO_IDX[this.bioKey(b)] ?? 0);
        LA = L >= 0 ? L : 255;
        LB = 255;
        LZ = 0;
        LW = y * 16 + bio;
        ED = TER_ZERO4;
        ev = null;
        c2 = null;
        if (y === F.SECRET) {
          let S = f(Nl[i.var[b]]?.f ?? 5592405);
          h(
            [
              [g, 0, m],
              [g, 0, m + 1],
              [g + 1, 0, m + 1],
              [g + 1, 0, m],
            ],
            [S, S, S, S],
          );
          continue;
        }
        let _ = [
            [g, m],
            [g, m + 1],
            [g + 1, m + 1],
            [g + 1, m],
          ],
          liq = TER_LIQUID(y),
          W = _.map(([S, k]) => {
            // oclusión suave de la esquina: cuántas de las 4 casillas que la rodean son altas
            let w = 1;
            if (v < 0.5 && !liq) {
              let E = 0;
              for (let [H, Z] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) u(S + H, k + Z) > 0.6 && E++;
              w = 1 - E * 0.13;
            }
            return w;
          }),
          colorAt = (S, k, w, tb, tx, tz) => {
            if (L >= 0 && grey) {
              let E = 0.94 + this.noise2(S * 0.3, k * 0.3) * 0.12;
              return [w * E, w * E, w * E];
            }
            return f(this.tileColor(tx, tz, tb, S, k), w);
          },
          A = _.map(([S, k], n) => colorAt(S, k, W[n], b, g, m));
        if (y === F.ROCK) for (let S of A) ((S[0] *= 1.08), (S[1] *= 1.08), (S[2] *= 1.08));
        if (arr && L >= 0) {
          let R = this.blendInfo(g, m, L, v);
          ED = R.st;
          if (R.B !== 255) {
            LB = R.B;
            LZ = R.bits * 2;
            let nj = R.nbi,
              nx = nj % i.w,
              nz = (nj / i.w) | 0;
            c2 = _.map(([S, k], n) => colorAt(S, k, W[n], nj, nx, nz));
          }
        }
        h(
          _.map(([S, k]) => [S, v, k]),
          A,
        );
        let T = [
          [0, -1, [g + 1, m], [g, m]],
          [0, 1, [g, m + 1], [g + 1, m + 1]],
          [-1, 0, [g, m], [g, m + 1]],
          [1, 0, [g + 1, m + 1], [g + 1, m]],
        ];
        for (let [S, k, w, E] of T) {
          let H = g + S,
            Z = m + k,
            me = i.inb(H, Z) ? s[Z * i.w + H] : -0.5,
            G = i.inb(H, Z) ? i.ter[Z * i.w + H] : F.VOID;
          if (me >= v - 0.001) continue;
          let L2 = arr ? this.layerFor(g, m, b, !0) : -1;
          LA = L2 >= 0 ? L2 : 255;
          LB = 255;
          LZ = 1; // lateral
          c2 = null;
          let B = G === F.VOID ? -0.01 : me,
            hq = Math.max(1, Math.min(255, Math.round((v - B) * 32))),
            hs = (g * 7 + m * 13 + (S + 2) * 5 + (k + 2) * 11) & 255,
            I,
            M;
          // (t, alto del lateral, hash por casilla): el shader reconstruye base/cresta a partir de ellos
          ev = [[255, hq, hs, 0], [0, hq, hs, 0], [0, hq, hs, 0], [255, hq, hs, 0]];
          if (y === F.WALL) {
            nn.setHex(this.tileColor(g, m, b, g, m));
            I = [nn.r * 0.95, nn.g * 0.95, nn.b * 0.95];
            M = [nn.r * 0.62, nn.g * 0.62, nn.b * 0.62];
          } else if (y === F.ROCK) {
            nn.setHex(this.tileColor(g, m, b, g + S, m + k));
            I = [nn.r * 0.95, nn.g * 0.95, nn.b * 0.95];
            M = [nn.r * 0.55, nn.g * 0.55, nn.b * 0.55];
          } else {
            nn.setHex(this.tileColor(g, m, b, g, m));
            I = [nn.r * 0.7, nn.g * 0.7, nn.b * 0.7];
            M = [nn.r * 0.4, nn.g * 0.4, nn.b * 0.4];
          }
          L2 >= 0 && grey && ((I = [0.95, 0.95, 0.95]), (M = [0.45, 0.45, 0.45]));
          h(
            [
              [w[0], v, w[1]],
              [w[0], B, w[1]],
              [E[0], B, E[1]],
              [E[0], v, E[1]],
            ],
            [I, M, M, I],
            S,
            0,
            k,
          );
        }
        liq && (y === F.WATER ? o.water : y === F.LAVA ? o.lava : o.acid).push(g, m);
      }
    if (r) {
      let m = new $t();
      m.setAttribute("position", new St(a.pos.slice(0, r * 3), 3));
      m.setAttribute("normal", new St(a.nor.slice(0, r * 3), 3));
      m.setAttribute("color", new St(a.col.slice(0, r * 3), 3));
      if (arr) {
        m.setAttribute("aLay", new St(a.lay.slice(0, r * 4), 4));
        m.setAttribute("aEdge", new St(a.edge.slice(0, r * 4), 4));
        m.setAttribute("aCol2", new St(a.col2.slice(0, r * 4), 4));
      } else m.setAttribute("uv", new St(a.uv.slice(0, r * 2), 2));
      m.computeBoundingSphere();
      let g = new Ge(m, this.groundMat);
      ((g.receiveShadow = !0), (g.castShadow = !0), this.group.add(g));
    }
    for (let m of ["water", "lava", "acid"]) {
      let g = o[m];
      if (!g.length) continue;
      let kt = { water: F.WATER, lava: F.LAVA, acid: F.ACID }[m],
        b = [],
        dp = [],
        memo = new Map(),
        depthAt = (X, Z) => {
          let q = Z * (i.w + 1) + X,
            c = memo.get(q);
          return (c === undefined && memo.set(q, (c = this.liquidDepth(kt, X, Z))), c);
        };
      for (let A = 0; A < g.length; A += 2) {
        let T = g[A],
          S = g[A + 1],
          k = -0.1;
        for (let [E, H] of [
          [T, S],
          [T, S + 1],
          [T + 1, S + 1],
          [T, S],
          [T + 1, S + 1],
          [T + 1, S],
        ])
          (b.push(E, k, H), dp.push(depthAt(E, H)));
      }
      {
        let A = [],
          T = [],
          S = { water: [0.85, 0.95, 1], lava: [1, 0.75, 0.3], acid: [0.85, 1, 0.45] }[m],
          k = kt,
          w = (E, H) => !i.inb(E, H) || i.ter[H * i.w + E] === k;
        for (let E = 0; E < g.length; E += 2) {
          let H = g[E],
            Z = g[E + 1],
            me = -0.08,
            G = 0.32,
            L = [];
          (w(H, Z - 1) ||
            L.push([
              [H, Z],
              [H + 1, Z],
              [H + 1, Z + G],
              [H, Z + G],
            ]),
            w(H, Z + 1) ||
              L.push([
                [H + 1, Z + 1],
                [H, Z + 1],
                [H, Z + 1 - G],
                [H + 1, Z + 1 - G],
              ]),
            w(H - 1, Z) ||
              L.push([
                [H, Z + 1],
                [H, Z],
                [H + G, Z],
                [H + G, Z + 1],
              ]),
            w(H + 1, Z) ||
              L.push([
                [H + 1, Z],
                [H + 1, Z + 1],
                [H + 1 - G, Z + 1],
                [H + 1 - G, Z],
              ]));
          for (let B of L)
            for (let I of [0, 1, 2, 0, 2, 3])
              (A.push(B[I][0], me, B[I][1]), T.push(S[0], S[1], S[2], I < 2 ? 0.75 : 0));
        }
        if (A.length) {
          let E = new $t();
          (E.setAttribute("position", new ft(A, 3)),
            E.setAttribute("color", new ft(T, 4)),
            this._foamM || (this._foamM = {}));
          let H =
            (p = this._foamM)[m] ||
            (p[m] = new vt({
              vertexColors: !0,
              transparent: !0,
              depthWrite: !1,
              opacity: 0.6,
              toneMapped: m !== "water",
              blending: m === "water" ? Wi : en,
            }));
          ((H.userData.foam = !0), this.liquidMats.includes(H) || this.liquidMats.push(H));
          let Z = new Ge(E, H);
          ((Z.renderOrder = 2), this.group.add(Z));
        }
      }
      let v = new $t();
      (v.setAttribute("position", new ft(b, 3)), v.setAttribute("aDepth", new ft(dp, 1)), v.computeVertexNormals());
      let _ = new Ge(v, this.liquidMat(m));
      ((_.receiveShadow = m === "water"), this.group.add(_));
    }
  }
  // líquidos con shader propio (src/engine/terrain.js): profundidad, ondas, espuma, lava HDR, ácido con pulso
  liquidMat(e) {
    if ((this._lm || (this._lm = {}), this._lm[e])) return this._lm[e];
    let s = makeLiquidMaterial({
      kind: e,
      time: zo.uTime,
      hook: xo,
      quality: () => (this.R && this.R.quality) || "high",
    });
    return ((this._lm[e] = s), this.liquidMats.push(s), s);
  }
  buildSecrets() {
    let e = this.map,
      t = new kn(1, 1.3, 1);
    t.translate(0, 0.65, 0);
    for (let i of e.ents) {
      if (!((i.k === "terminal" && i.eff === "secret") || i.k === "vault") || !i.tiles) continue;
      let s = new Ve();
      for (let a of i.tiles) {
        let r = a % e.w,
          o = Math.floor(a / e.w),
          l = Nl[e.var[a]] || Nl[0],
          c = this.theme ? this.theme.wall : l.w,
          d = new Xt({ color: tt(c, 0, 0.06), roughness: 0.9 }),
          h = new Ge(t, d);
        (h.position.set(r + 0.5, 0, o + 0.5), (h.castShadow = !0), (h.receiveShadow = !0), s.add(h));
      }
      (this.group.add(s), this.secretMeshes.set(i.id, s));
    }
  }
  openSecret(e) {
    let t = this.secretMeshes.get(e);
    t && (t.userData.sink = 1);
  }
  setSecretOpen(e) {
    let t = this.secretMeshes.get(e);
    t && (this.group.remove(t), this.secretMeshes.delete(e));
  }
  buildProps() {
    var c;
    let e = this.map,
      t = new Map(),
      i = (d) => {
        if (e.kind === "op") {
          let f = this.theme;
          return {
            pal: { rock: f.wall, wall: f.wall, leaf: 3820074, leaf2: 4872754, grass: tt(f.floor[0], 16777215, 0.1) },
            key: "op_" + e.theme,
          };
        }
        let h = De[d ?? 0];
        return { pal: UE(h), key: h.key };
      },
      s = (d, h) => {
        for (let f of d) {
          let u = f.reg ?? (e.kind === "op" ? 0 : e.regAt(f.x, f.z)),
            { pal: p, key: m } = i(u),
            g =
              f.t + "|" + m + "|" + (e.kind === "op" ? 0 : u) + "|" + Math.floor(f.x / Va) + "," + Math.floor(f.z / Va),
            b = t.get(g);
          (b || ((b = { t: f.t, pal: p, key: m, list: [], decor: h || Bx.has(f.t) }), t.set(g, b)), b.list.push(f));
        }
      };
    (s(e.props, !1), s(e.decor, !0));
    let a = [],
      r = pi(99);
    for (let d = 1; d < e.h - 1; d++)
      for (let h = 1; h < e.w - 1; h++) {
        let f = d * e.w + h;
        if (e.ter[f] !== F.ROCK) continue;
        let u = !1;
        for (let [p, m] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          let g = e.ter[(d + m) * e.w + h + p];
          if (g !== F.ROCK && g !== F.VOID) {
            u = !0;
            break;
          }
        }
        u &&
          r() < 0.55 &&
          a.push({
            t: "cliffrock",
            x: h + 0.5 + (r() - 0.5) * 0.4,
            z: d + 0.5 + (r() - 0.5) * 0.4,
            s: 0.9 + r() * 0.6,
            r: r() * 6.28,
            y: this.heights[f] * 0.35,
            reg: e.reg[f],
          });
      }
    s(a, !1);
    let o = new tn(),
      l = jg();
    for (let d of t.values()) {
      let h = Yg(d.t);
      if (h.length) {
        this.spriteProps(d, h, l, o);
        continue;
      }
      let f = rx[d.t];
      if (f && f[0].some((g) => Ln.has(g))) {
        this.modelProps(d, f, o);
        continue;
      }
      let u;
      d.t === "cliffrock"
        ? (u = {
            g: eh([
              J(Yn(0.75), d.pal.rock, { y: 0.4, sy: 1.3, jit: 0.35, seed: 3, vary: 0.15 }),
              J(Yn(0.45), tt(d.pal.rock, 16777215, 0.1), { x: 0.4, y: 0.2, jit: 0.2, seed: 4 }),
            ]),
            e: null,
            dim: 1,
          })
        : (u = Hx(d.t, d.pal, d.key));
      let p = d.list.length,
        m = (g, b, y) => {
          let v = new ys(g, b, p);
          (d.list.forEach((_, A) => {
            (o.position.set(_.x, _.y || 0, _.z),
              o.rotation.set(0, _.r || 0, 0),
              o.scale.setScalar(_.s || 1),
              o.updateMatrix(),
              v.setMatrixAt(A, o.matrix));
          }),
            (v.instanceMatrix.needsUpdate = !0),
            v.computeBoundingSphere(),
            (v.castShadow = y),
            (v.receiveShadow = !d.decor),
            this.group.add(v));
        };
      if (u.g) {
        let g = this.propMat();
        if (wp.has(d.t)) {
          u.g.boundingBox || u.g.computeBoundingBox();
          let b = u.g.boundingBox.max.y;
          this._vm || (this._vm = {});
          let y = b.toFixed(1);
          g = (c = this._vm)[y] || (c[y] = Ep(this.propMat().clone(), b, d.decor ? 0.12 : 0.05));
        }
        m(u.g, g, !d.decor);
      }
      u.e && m(u.e, this.glowMat(u.dim), !1);
    }
  }
  modelProps(e, t, i) {
    let s = t[0].filter((c) => Ln.has(c)),
      a = s.map(() => []);
    e.list.forEach((c) => a[((Math.floor(c.x * 7) + Math.floor(c.z * 13)) >>> 0) % s.length].push(c));
    let r =
        this.map.kind === "op"
          ? this.map.rk ||
            {
              ruinas: "ciudad",
              bunker: "complejo",
              laboratorio: "complejo",
              fabrica: "complejo",
              caverna: "tundra",
              magma: "caldera",
              colmena: "colmena",
            }[this.map.theme] ||
            "valle"
          : De[e.list[0].reg ?? this.map.regAt(e.list[0].x, e.list[0].z)].key,
      o = lx[e.t],
      l = o ? ox[r]?.[o] : null;
    (this._mmc || (this._mmc = new Map()),
      s.forEach((c, d) => {
        let h = a[d];
        if (!h.length) return;
        let f = Ln.staticGeo(c);
        if (!f) return;
        let u = t[3] ?? Math.min(t[1] / Math.max(0.05, f.h), (t[2] ?? 1.7) / Math.max(0.05, f.w));
        for (let p of f.parts) {
          let m = wp.has(e.t),
            g = c + "|" + p.mat.uuid + "|" + (l ?? "") + (m ? "|v" : ""),
            b = this._mmc.get(g);
          b ||
            ((b = p.mat.clone()),
            l != null && Jf(b, To(c, l, 1)),
            m && Ep(b, f.h, e.t === "cactus" ? 0.015 : 0.045),
            this._mmc.set(g, b));
          let y = new ys(p.geo, b, h.length);
          (h.forEach((v, _) => {
            (i.position.set(v.x, v.y ? v.y * 0.4 : 0, v.z),
              i.rotation.set(0, v.r || 0, 0),
              i.scale.setScalar(u * (v.s || 1)),
              i.updateMatrix(),
              y.setMatrixAt(_, i.matrix));
          }),
            (y.instanceMatrix.needsUpdate = !0),
            y.computeBoundingSphere(),
            (y.castShadow = !e.decor),
            (y.receiveShadow = !0),
            this.group.add(y));
        }
      }));
  }
  spriteProps(e, t, i, s) {
    let a = t.map(() => []);
    e.list.forEach((c, d) => a[((Math.floor(c.x * 7) + Math.floor(c.z * 13)) >>> 0) % t.length].push(c));
    let r = new at(),
      o = new U(),
      l = new U();
    t.forEach((c, d) => {
      let h = a[d];
      if (!h.length) return;
      let f = Et.sprite(c),
        u = new Xt({ map: Et.tex(f.f), alphaTest: 0.45, roughness: 0.9, side: pn }),
        p = new ys($g, u, h.length),
        m = (Xg[e.t] || 1) * (f.hs || 1);
      (h.forEach((g, b) => {
        let y = m * (0.85 + ((g.s || 1) - 0.8) * 0.5);
        (o.set(g.x, g.y ? g.y * 0.5 : -0.05, g.z),
          l.set((y * f.w) / f.h, y, 1),
          r.compose(o, i, l),
          p.setMatrixAt(b, r));
      }),
        (p.instanceMatrix.needsUpdate = !0),
        p.computeBoundingSphere(),
        (p.castShadow = !e.decor),
        (p.receiveShadow = !1),
        e.decor || (p.customDepthMaterial = new sl({ depthPacking: Qu, map: u.map, alphaTest: 0.45 })),
        this.group.add(p));
    });
  }
  propMat() {
    return (
      this._pm || (this._pm = new Xt({ vertexColors: !0, roughness: 0.85, metalness: 0.05, flatShading: !0 })),
      this._pm
    );
  }
  glowMat(e) {
    this._gm || (this._gm = {});
    let t = e.toFixed(2);
    return (
      this._gm[t] ||
        (this._gm[t] = new vt({ vertexColors: !0, toneMapped: !1, color: new Ee(e, e, e).multiplyScalar(1.6) })),
      this._gm[t]
    );
  }
  update(e, t) {
    for (let i of this.liquidMats) i.userData.foam && (i.opacity = 0.45 + Math.sin(t * 1.6) * 0.15);
    // si cambia el preset de calidad hay que recompilar el suelo y los líquidos (el shader depende de TQ)
    let q = this.terQuality();
    if (q !== this._tq) {
      this._tq = q;
      this.groundMat.needsUpdate = !0;
      for (let i of this.liquidMats) i.userData.kind && (i.needsUpdate = !0);
    }
    for (let [i, s] of this.secretMeshes)
      s.userData.sink &&
        ((s.position.y -= e * 0.8), s.position.y < -1.35 && (this.group.remove(s), this.secretMeshes.delete(i)));
  }
  dispose() {
    this.group.traverse((e) => {
      e.isInstancedMesh ? e.dispose() : e.geometry && e.geometry.dispose();
    });
  }
};

