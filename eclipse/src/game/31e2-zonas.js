// 31e2-zonas.js — Zonas de entrada (D12): salidas tranquilas e interiores orgánicos de tamaños variados
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 31f-puzzles.js y 31g-bosses.js a propósito: los
// generadores de interiores de este fragmento sustituyen a `_x` (sótanos, cuevas, alcantarillas…) y `yx` (operaciones) y los envoltorios de los
// puzles (31f) y de las guaridas (31g) se apilan encima de ellos, sin tocar su código.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// Contenido:
//   1. SALIDA TRANQUILA — antes, al salir de un sótano o una operación se regeneraba todo el exterior de golpe: las manadas del edificio (su estado se
//      perdía al descargar el mundo) y las del spawner ambiental aparecían junto a la salida. Ahora:
//        · durante `graceS` segundos no hay manadas nuevas cerca de la salida (las del lugar esperan: `held`) ni spawner ambiental;
//        · pasada la gracia, una manada retenida solo aparece si el jugador está al menos a `minSpawn` casillas de ella;
//        · las manadas despejadas se guardan en S.world.packs (marca del reloj del mundo, gnow()): no reaparecen al volver de una zona ni al recargar;
//        · tope de seguridad: con `cap` enemigos vivos no se suelta ninguna manada del mundo más (una horda sin fin es imposible aunque falle otra cosa).

x.cfg.zonas = {
  v: 1,
  exit: {
    graceS: 30, // segundos de calma tras salir de una zona
    holdR: 24, // las manadas del mundo a menos de esto de la salida esperan
    minSpawn: 11, // una manada retenida solo aparece con el jugador a esta distancia o más
    ambientCd: 9, // espera extra del spawner ambiental cuando termina la gracia
    cap: 40, // enemigos vivos (sin torretas ni nidos) a partir de los cuales no se suelta ninguna manada del mundo más
  },
};

const ZN = { grace: null, held: 0, saved: 0, t: 0, calm: 0 };

// ═══ 1. SALIDA TRANQUILA ═══════════════════════════════════════════════════════════════════════════
function znGrace(pos) {
  const C = x.cfg.zonas.exit;
  ZN.grace = { t: C.graceS, x: pos ? pos.x : x.player.x, z: pos ? pos.z : x.player.z };
  ZN.calm++;
}
// las tres salidas hacia el mundo (escalera, extracción de operación, abandonar operación): la gracia empieza ANTES de recargar el mundo,
// porque loadWorld ya hace una comprobación inmediata de manadas
for (const k of ["leaveSub", "extract", "abortOp"]) {
  const _f = ih.prototype[k];
  ih.prototype[k] = function () {
    if (this.returnPos) znGrace(this.returnPos);
    return _f.apply(this, arguments);
  };
}
{
  const _sp = ih.prototype.spawnPack;
  ih.prototype.spawnPack = function (e) {
    const t = e && e.e, p = x.player;
    if (t && p && x.mode === "world" && !t.op && x.S && x.S.world) {
      const C = x.cfg.zonas.exit, d = Le(t.x, t.z, p.x, p.z), rec = x.S.world.packs && x.S.world.packs[t.id];
      // despejada hace poco (también en otra sesión): sigue despejada hasta que pase el enfriamiento
      if (rec && gnow() - rec < Fi.pack) {
        e.spawned = true;
        e.pack = [];
        e.clearedAt = rec;
        return;
      }
      if (rec) {
        // enfriamiento cumplido: la manada vuelve UNA vez (se borra la marca; antes quedaba y cada pasada del barrido soltaba otra)
        delete x.S.world.packs[t.id];
        e.clearedAt = null;
      }
      // tope de seguridad: con tantos enemigos vivos no se suelta ninguna manada más (esperan a que baje la cuenta); pase lo que pase, nunca una horda sin fin
      let live = 0;
      for (const q of x.enemies) q.dead || q.static || live++;
      if (live >= C.cap) {
        e.held = true;
        return;
      }
      const g = ZN.grace;
      if ((g && g.t > 0 && d < C.holdR) || (e.held && d < C.minSpawn)) {
        e.held = true;
        ZN.held++;
        return;
      }
      e.held = false;
    }
    return _sp.apply(this, arguments);
  };
}
function znSavePacks(W) {
  const S = x.S;
  if (!S || !S.world || !W || !W.rt) return;
  const packs = S.world.packs || (S.world.packs = {}), now = gnow();
  for (const o of W.rt.values()) {
    const e = o.e;
    if (!o.clearedAt || !e || e.k !== "spawnpack" || e.op) continue;
    if (packs[e.id] !== o.clearedAt) {
      packs[e.id] = o.clearedAt;
      ZN.saved++;
    }
  }
  for (const k in packs) if (now - packs[k] > Fi.pack * 2) delete packs[k];
}
x.migrations.push((S) => {
  S.world && !S.world.packs && (S.world.packs = {});
});
x.tick.push((dt) => {
  if (!x.started || !x.S || !x.player) return;
  const g = ZN.grace;
  if (g && x.mode === "world") {
    g.t -= dt;
    xn.packCd = Math.max(xn.packCd || 0, 3); // sin manadas ambientales mientras dura la calma
    if (g.t <= 0) {
      ZN.grace = null;
      xn.packCd = Math.max(xn.packCd || 0, x.cfg.zonas.exit.ambientCd);
    }
  }
  ZN.t -= dt;
  if (ZN.t <= 0) {
    ZN.t = 1;
    x.mode === "world" && znSavePacks(x.world);
  }
});
It("toMenu", () => {
  ZN.grace = null;
});

// pruebas
window.__zonas = {
  cfg: x.cfg.zonas,
  ZN,
  grace: () => (ZN.grace ? { ...ZN.grace } : null),
  start: (pos) => znGrace(pos),
  save: () => znSavePacks(x.world),
};
