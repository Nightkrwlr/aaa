// D12 · interiores orgánicos con cuatro tamaños (31e3-interiores.js): entra de verdad por las escaleras del mundo (enterSub), camina con colisiones
// reales desde la entrada hasta la arena (pasillos curvos incluidos), comprueba el encuentro, las manadas, la salida y una operación (yx) con salas redondeadas.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/interiores-core.mjs --size 640x360 --quality low --out /ruta
// Variables: SHOTS=1 (capturas del minimapa/pantalla de cada tamaño), KINDS=basement,cave (tipos de escalera a probar)
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, perf } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame(); await api.god(true);
  await ev(() => { window.__silence && window.__silence(true); const L = window.__G.S.lore; if (L && L.o) L.o.auto = false; });   // sin lector automático del Archivo: un libro recogido por el camino abriría el panel y pausaría el juego
  const SHOTS = process.env.SHOTS === '1';

  // ── utilidades en la página: camino con holgura para el jugador y caminata real con el joystick virtual ──
  await ev(() => {
    const G = window.__G, I = window.__Input, s = Math.SQRT1_2;
    const T = window.__zt = {
      // A* sobre el centro de las casillas con holgura r; devuelve la ruta suavizada (tirando de la cuerda) en coordenadas del mundo
      path(m, from, to, r) {
        // retícula de 0,5 m (el jugador se mueve de forma continua: una por casilla es demasiado estricta en pasillos curvos)
        const SS = 2, w = m.w * SS, h = m.h * SS, N = w * h, ok = new Uint8Array(N).fill(2);
        const cx = (i) => ((i % w) + 0.5) / SS, cz = (i) => (Math.floor(i / w) + 0.5) / SS;
        const clear = (i) => { if (ok[i] !== 2) return ok[i] === 1; return (ok[i] = m.circleHits(cx(i), cz(i), r) ? 0 : 1) === 1; };
        const seg = (ax, az, bx, bz) => { const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 0.25)); for (let k = 0; k <= n; k++) if (m.circleHits(ax + (bx - ax) * k / n, az + (bz - az) * k / n, r)) return false; return true; };
        const near = (x, z) => { let bi = -1, bd = 1e9; const x0 = Math.floor(x * SS), z0 = Math.floor(z * SS); for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const X = x0 + dx, Z = z0 + dz; if (X < 0 || Z < 0 || X >= w || Z >= h) continue; const i = Z * w + X; if (!clear(i)) continue; const d = Math.hypot(cx(i) - x, cz(i) - z); if (d < bd) { bd = d; bi = i; } } return bi; };
        const s0 = near(from[0], from[1]), g0 = near(to[0], to[1]);
        if (s0 < 0 || g0 < 0) return null;
        // búsqueda en anchura sobre la retícula (8 vecinos; las diagonales exigen que el punto medio también quepa)
        const prev = new Int32Array(N).fill(-1), q = [s0]; prev[s0] = s0;
        for (let a = 0; a < q.length && prev[g0] < 0; a++) {
          const i = q[a], x = i % w, z = Math.floor(i / w);
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dz) continue;
            const nx = x + dx, nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
            const j = nz * w + nx;
            if (prev[j] >= 0 || !clear(j) || (dx && dz && m.circleHits((cx(i) + cx(j)) / 2, (cz(i) + cz(j)) / 2, r))) continue;
            prev[j] = i; q.push(j);
          }
        }
        if (prev[g0] < 0) return null;
        prev[s0] = -1;
        const cells = []; for (let i = g0; i >= 0; i = prev[i]) cells.push([cx(i), cz(i)]);
        cells.reverse();
        // tirar de la cuerda
        const out = [[from[0], from[1]]]; let a = 0;
        while (a < cells.length - 1) { let b = cells.length - 1; while (b > a + 1 && !seg(cells[a][0], cells[a][1], cells[b][0], cells[b][1])) b--; out.push(cells[b]); a = b; }
        return out;
      },
      stop() { I.joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }; },
      // camina hacia (wx, wz) con el bucle real; devuelve los fotogramas o -1 si se atasca
      walk(wx, wz, tol, max) {
        const p = G.player; let last = 1e9, still = 0;
        for (let i = 0; i < (max || 400); i++) {
          const dx = wx - p.x, dz = wz - p.z, d = Math.hypot(dx, dz);
          if (d < (tol || 0.3)) { T.stop(); return i; }
          if (G.uiOpen) { window.__dbg.UI.close && window.__dbg.UI.close(); window.__step(1, 1 / 30); }   // por si algún panel (aviso, lector) se abre por el camino
          // las manadas del subterráneo salen al paso y su cuerpo estorba (el jugador es invulnerable en la prueba): se retiran las que quedan a < 4 casillas
          if (!(window.__Enc && window.__Enc.roomHas && window.__Enc.roomHas(p.x, p.z))) for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 4) { e.dead = true; e.deadT = 0; }
          const ux = dx / d, uz = dz / d;
          I.joy = { active: true, id: 99, ox: 0, oy: 0, x: (ux - uz) * s, y: (ux + uz) * s };
          window.__step(1, 1 / 30);
          if (d > last - 0.01) still++; else still = 0;
          last = d;
          if (still > 45) { T.stop(); return -1; }
        }
        T.stop();
        return -1;
      },
      // ruta completa a un punto: devuelve {ok, frames, segs}
      go(to, tol) {
        const m = G.map, p = G.player, pth = T.path(m, [p.x, p.z], to, p.r + 0.06);
        if (!pth) return { ok: false, why: 'sin ruta' };
        let frames = 0;
        for (let k = 1; k < pth.length; k++) { const f = T.walk(pth[k][0], pth[k][1], k === pth.length - 1 ? (tol || 0.4) : 0.45, 900); if (f < 0 && k === pth.length - 1 && window.__Enc && window.__Enc.roomHas && window.__Enc.roomHas(p.x, p.z)) return { ok: true, frames, segs: pth.length - 1, note: 'parado dentro de la arena' };
        if (f < 0) { const en = G.enemies.filter((e) => !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 3); return { ok: false, why: 'atascado hacia ' + pth[k].map((v) => v.toFixed(1)) + ' en ' + p.x.toFixed(1) + ',' + p.z.toFixed(1) + ' · enemigos a <3: ' + en.length + (en[0] ? ' (' + en[0].id + ')' : '') + ' · tramo ' + k + '/' + (pth.length - 1), frames }; } frames += f; }
        return { ok: true, frames, segs: pth.length - 1 };
      },
      calm() { G.player.inv = 1e9; G.player.hp = G.player.maxHp; },
    };
  });

  // ── 1. cada tamaño, con varios tipos de escalera ──
  const kinds = (process.env.KINDS || 'basement,cave,sewer').split(',');
  const odds0 = await ev(() => JSON.parse(JSON.stringify(window.__zg.cfg.odds)));   // las probabilidades reales (la sección 1 las fuerza)
  const sizes = (process.env.SIZES || 'small,medium,large,huge').split(',');
  const names = { small: 'pequeña', medium: 'mediana', large: 'grande', huge: 'enorme' };
  const Ds = { small: 48, medium: 64, large: 88, huge: 116 };
  const seen = {};
  for (const cls of sizes) {
    for (const kind of kinds) {
      const r = await ev(([cls, kind, Ds]) => {
        const G = window.__G, Z = window.__zg, T = window.__zt, out = { cls, kind };
        // fuerza el tamaño en todos los tipos
        const names = ['small', 'medium', 'large', 'huge'];
        Z.cfg.puzzleMedium = false;   // la regla «escalera con acertijo ≥ mediana» se comprueba aparte
        for (const k of Object.keys(Z.cfg.odds)) Z.cfg.odds[k] = names.map((n) => (n === cls ? 1 : 0));
        const stairs = G.world.map.ents.filter((e) => e.k === 'stairs' && e.kind === kind);
        if (!stairs.length) return { ...out, skip: true };
        const st = stairs[0];
        T.calm();
        G.player.x = st.x + 1.5; G.player.z = st.z; G.world.enterSub(st);
        window.__step(40, 1 / 30);
        const m = G.map;
        out.mode = G.mode; out.zg = m.zg; out.w = m.w; out.op = !!(G.op && G.op.sub);
        out.rooms = m.rooms.length; out.packs = m.totalPacks; out.ents = m.ents.length;
        const sb = m.spawnBase;
        out.spawnFree = !m.circleHits(sb[0], sb[1], G.player.r);
        out.atSpawn = Math.hypot(G.player.x - sb[0], G.player.z - sb[1]) < 1.5;
        // el encuentro
        const enc = m.ents.find((e) => e.k === 'encounter');
        out.enc = enc.enc; out.seals = enc.seal.length; out.arenaTiles = enc.tiles.length;
        const N = window.__Enc;
        out.encState0 = N.st && N.st.state;
        // camina hasta la arena (centro) con colisiones reales
        T.calm();
        const walk = T.go([enc.x, enc.z], 0.6);
        out.walk = walk;
        window.__step(10, 1 / 30);
        out.encState1 = N.st && N.st.state;
        out.inArena = N.roomHas(G.player.x, G.player.z);
        // la salida (de vuelta): coloca al jugador junto a ella y sale por la interacción real
        const ex = m.ents.find((e) => e.k === 'exit');
        out.exit = { x: ex.x, z: ex.z };
        return out;
      }, [cls, kind, Ds]);
      const key = `${cls}/${kind}`;
      seen[key] = r;
      if (r.skip) { console.log('sin escalera de tipo', kind); continue; }
      console.log(key, JSON.stringify({ zg: r.zg && { n: r.zg.name, rooms: r.zg.rooms, edges: r.zg.edges }, enc: r.enc, seals: r.seals, walk: r.walk && { ok: r.walk.ok, f: r.walk.frames, why: r.walk.why }, st: [r.encState0, r.encState1] }));
      check(`${names[cls]} · ${kind}: la zona se genera con el tamaño pedido (${Ds[cls]}×${Ds[cls]}) y el jugador aparece sobre suelo libre`, r.mode === 'op' && r.w === Ds[cls] && r.zg && r.zg.cls === cls && r.spawnFree && r.atSpawn, JSON.stringify({ m: r.mode, w: r.w, zg: r.zg && r.zg.cls }));
      check(`${names[cls]} · ${kind}: caminando de verdad se llega desde la entrada hasta la arena`, r.walk && r.walk.ok && r.inArena, JSON.stringify(r.walk));
      check(`${names[cls]} · ${kind}: hay manadas, sellos de encuentro y el encuentro (${r.enc}) arranca al entrar en la arena (salvo acertijo y defensa del equipo)`, r.packs >= 1 && r.seals >= 1 && (['puzzle', 'defend_eq'].includes(r.enc) || r.encState1 === 'active'), JSON.stringify({ packs: r.packs, seals: r.seals, e0: r.encState0, e1: r.encState1, enc: r.enc }));
      if (SHOTS) { await wait(30); await shot(`zona-${cls}-${kind}`); }
      // sale y comprueba que se vuelve al mundo sin nada colgado
      const back = await ev(() => {
        const G = window.__G, N = window.__Enc, ex = G.map.ents.find((e) => e.k === 'exit');
        G.player.x = ex.x; G.player.z = ex.z + 0.6; window.__step(3, 1 / 30);
        G.world.leaveSub(); window.__step(30, 1 / 30);
        return { mode: G.mode, enc: !!(N.st), mapKind: G.map && G.map.kind };
      });
      check(`${names[cls]} · ${kind}: al salir se vuelve al mundo`, back.mode === 'world' && !back.enc, JSON.stringify(back));
    }
  }

  // ── 2. el tamaño depende del tipo de escalera y de la semilla (sin forzar) ──
  const dist = await ev((odds0) => {
    const Z = window.__zg, G = window.__G, out = {};
    for (const k of Object.keys(odds0)) Z.cfg.odds[k] = odds0[k];
    Z.cfg.puzzleMedium = true;
    for (const kind of ['basement', 'upper', 'cave', 'hive', 'hatch', 'sewer']) {
      const c = { small: 0, medium: 0, large: 0, huge: 0 }, N = 300;
      for (let i = 0; i < N; i++) { const rng = window.__zg.hash ? null : null; const n = { seed: (i * 2654435761) >>> 0, ent: { kind } }; c[Z.pickClass(n)]++; }
      out[kind] = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, +(v / N).toFixed(2)]));
    }
    return out;
  }, odds0);
  console.log('reparto de tamaños', JSON.stringify(dist));
  check('el reparto de tamaños sale de las probabilidades por tipo de escalera (el sótano suele ser pequeño y las colmenas, grandes)', dist.basement.small > dist.hive.small && dist.hive.large + dist.hive.huge > dist.basement.large + dist.basement.huge && dist.upper.huge === 0, JSON.stringify(dist));

  // ── 2b. el tamaño es fijo por escalera (el trazado no) y las escaleras con acertijo nunca salen pequeñas ──
  const fix = await ev(() => {
    const Z = window.__zg, G = window.__G, out = { stairs: 0, varied: 0, puz: 0, puzSmall: 0, sameLayout: 0, tot: 0 };
    const stairs = G.map.ents.filter((e) => e.k === 'stairs');
    out.stairs = stairs.length;
    for (const st of stairs.slice(0, 40)) {
      const cs = new Set();
      for (let i = 0; i < 6; i++) cs.add(Z.pickClass({ seed: (i * 7919 + 13) >>> 0, ent: st, sub: true }));
      if (cs.size > 1) out.varied++;
    }
    // con el tamaño pequeño forzado en todos los tipos: las escaleras con acertijo suben a mediana; las demás se quedan pequeñas
    const save = JSON.parse(JSON.stringify(Z.cfg.odds)); for (const k of Object.keys(Z.cfg.odds)) Z.cfg.odds[k] = [1, 0, 0, 0];
    Z.cfg.puzzleMedium = true;
    let small = 0, noPuz = 0;
    for (const st of stairs.slice(0, 40)) {
      const n = { seed: 123456, ent: st, sub: true, lvl: 5, reg: st.reg, mods: [], theme: null, obj: 'sub', pool: window.__De[st.reg || 0], enc: st.enc };
      const w = Z.wants(n);   // (la cámara sellada, enc «puzzle», ya es un acertijo: no lleva otro)
      const m = Z.generate(n);
      if (!m) continue;
      out.tot++;
      if (w) { out.puz++; if (m.zg.cls === 'small') out.puzSmall++; } else { noPuz++; if (m.zg.cls === 'small') small++; }
    }
    out.noPuz = noPuz; out.smallNoPuz = small;
    for (const k of Object.keys(save)) Z.cfg.odds[k] = save[k];
    return out;
  });
  console.log('tamaño fijo', JSON.stringify(fix));
  check('el tamaño de una escalera no cambia entre visitas (sale de su identificador) y las escaleras con acertijo nunca salen pequeñas', fix.stairs > 20 && fix.varied === 0 && fix.puz >= 1 && fix.puzSmall === 0 && fix.smallNoPuz === fix.noPuz, JSON.stringify(fix));

  // ── 2c. rendimiento: llamadas de dibujo de un fotograma en la entrada de una zona (antigua / mediana / enorme) ──
  const pf = {};
  for (const [name, enabled, cls] of [['antigua', false, 'medium'], ['mediana', true, 'medium'], ['enorme', true, 'huge']]) {
    await ev(([enabled, cls]) => {
      const G = window.__G, Z = window.__zg, T = window.__zt, names = ['small', 'medium', 'large', 'huge'];
      Z.cfg.enabled = enabled; Z.cfg.puzzleMedium = false;
      for (const k of Object.keys(Z.cfg.odds)) Z.cfg.odds[k] = names.map((n) => (n === cls ? 1 : 0));
      const st = G.world.map.ents.find((e) => e.k === 'stairs' && e.kind === 'basement');
      T.calm(); G.player.x = st.x + 1.5; G.player.z = st.z; G.world.enterSub(st); window.__step(40, 1 / 30); T.calm();
    }, [enabled, cls]);
    await wait(25);
    pf[name] = await perf();
    await ev(() => { window.__G.world.leaveSub(); window.__step(20, 1 / 30); });
  }
  await ev((odds0) => { const Z = window.__zg; Z.cfg.enabled = true; Z.cfg.puzzleMedium = true; for (const k of Object.keys(odds0)) Z.cfg.odds[k] = odds0[k]; }, odds0);
  console.log('rendimiento', JSON.stringify(pf));
  check('rendimiento: la entrada de una zona enorme no pide más llamadas de dibujo que la de una antigua (+ 25 %)', pf.enorme.calls <= pf.antigua.calls * 1.25 + 20 && pf.mediana.calls <= pf.antigua.calls * 1.25 + 20, JSON.stringify(pf));

  // ── 3. operaciones (yx): salas redondeadas y todo alcanzable ──
  const ops = await ev(() => {
    const L = window.__lore, G = window.__G, Z = window.__zg, out = [];
    const one = (reg, theme, enabled) => {
      Z.cfg.enabled = enabled;
      L.enterOp(reg, theme);
      window.__step(10, 1 / 30);
      const m = G.map, w = m.w;
      // sala rectangular perfecta = todas las casillas de su caja son suelo (con más de 8×8)
      let rect = 0, rooms = 0;
      for (const r of m.rooms) { if (!r.tiles || r.w < 9 || r.h < 9) continue; rooms++; let full = true; for (let z = r.z0; z <= r.z1 && full; z++) for (let x0 = r.x0; x0 <= r.x1; x0++) if (!r.tiles.has(z * w + x0)) { full = false; break; } if (full) rect++; }
      const reach = new Uint8Array(w * m.h), q = [Math.floor(m.spawnBase[1]) * w + Math.floor(m.spawnBase[0])]; reach[q[0]] = 1;
      for (let i = 0; i < q.length; i++) { const k = q[i]; for (const j of [k - 1, k + 1, k - w, k + w]) if (j >= 0 && j < w * m.h && !reach[j] && (!m.solidAt(j % w, Math.floor(j / w)) || m.ter[j] === 9)) { reach[j] = 1; q.push(j); } }   // 9 = F.SECRET: la puerta secreta de la cámara del tesoro cuenta como paso (el generador antiguo también las hace)
      // una entidad (cofre, caja, santuario…) ocupa su propia casilla, que cuenta como sólida: se alcanza si hay suelo alcanzable a ≤ 2 casillas
      const near = (e) => { const X = Math.floor(e.x), Z = Math.floor(e.z); for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const i = (Z + dz) * w + X + dx; if (i >= 0 && i < w * m.h && reach[i]) return true; } return false; };
      const lostKinds = {}; let lost = 0; for (const e of m.ents) if (e.k !== 'light' && !near(e)) { lost++; lostKinds[e.k] = (lostKinds[e.k] || 0) + 1; }
      const ncorr = m.rooms.length, floor = reach.reduce((a, b) => a + b, 0);
      window.__G.world.abortOp && window.__G.world.abortOp();
      return { rooms: m.rooms.length, big: rooms, rect, lost, lostKinds, floor, w };
    };
    for (const [reg, theme] of [[0, 'ruinas'], [1, 'laboratorio'], [2, 'caverna'], [3, 'bunker']]) {
      try { const nuevo = one(reg, theme, true); window.__step(10, 1 / 30); const viejo = one(reg, theme, false); out.push({ reg, theme, nuevo, viejo }); }
      catch (e) { out.push({ reg, theme, err: String(e.message).slice(0, 120) }); }
      window.__step(10, 1 / 30);
    }
    Z.cfg.enabled = true;
    return out;
  });
  console.log('operaciones', JSON.stringify(ops));
  check('operaciones: salas grandes redondeadas (ninguna perfectamente rectangular) y todas las entidades alcanzables (a ≤ 2 casillas de suelo alcanzable desde la entrada)', ops.every((o) => !o.err && o.nuevo.rect === 0 && o.nuevo.lost === 0), JSON.stringify(ops));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const warn = logs.filter((l) => /\[interiores\]/.test(l));
  check('sin avisos de [interiores] (nunca se volvió al generador antiguo por una excepción)', warn.length === 0, warn.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS de ${results.length}` : `\nTODO OK (${results.length} comprobaciones)`);
  if (bad.length) process.exitCode = 1;
  return results;
}
