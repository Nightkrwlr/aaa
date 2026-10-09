// Puzles v2: placas de presión nuevas (duraciones propias, baldosas rojas, rejas) y los tres tipos nuevos (losas de un solo paso, bloques sobre hielo,
// cerradura de símbolos). Aquí no solo se comprueba que el bot los resuelve: el jugador CAMINA de verdad (joystick virtual + bucle del juego)
// por las placas y las losas, con colisiones, muros, rejas, baldosas rojas y losas que se cierran.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/puzles-v2.mjs --size 960x540 --quality low --out /ruta
// Variables: POOL=40 (semillas por tipo y nivel en validateAll), FAST=1 (pool 6).
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });

  // ── 1. todo el universo de los tipos nuevos es resoluble ──
  const pool = process.env.FAST ? 6 : Number(process.env.POOL || 40);
  const va = await ev((pool) => {
    const a = window.__puzzles.api.validateAll({ pool, kinds: ['timed', 'sink', 'ice', 'lock'] });
    const s = (k, f) => { const t = a.byKind[k].stat[f]; return t ? [+t.min.toFixed(2), +(t.sum / t.n).toFixed(2), +t.max.toFixed(2)] : null; };
    return { total: a.total, ok: a.ok, fails: a.fails, ms: a.ms, f: a.failures.slice(0, 4), timed: { nvalid: s('timed', 'nvalid'), span: s('timed', 'span'), margin: s('timed', 'margin') }, sink: { sols: s('sink', 'sols'), nodes: s('sink', 'nodes') }, ice: { pushes: s('ice', 'pushes') }, lock: { worst: s('lock', 'worst') } };
  }, pool);
  console.log('stats', JSON.stringify(va));
  check(`validateAll(pool ${pool}) de placas, losas, hielo y cerradura: 0 fallos`, va.fails === 0 && va.total === pool * 12, `${va.ok}/${va.total} · ${va.ms} ms · ${JSON.stringify(va.f)}`);

  // ── utilidades dentro de la página: colocar un puzle, caminar de verdad por él ──
  await api.region('desierto');
  await ev(() => {
    const P = window.__puzzles, G = window.__G, I = window.__Input, s = Math.SQRT1_2;
    const T = window.__t2 = {
      rt: null,
      spawn(kind, tier, idx, id) {
        let rt = null;
        for (let a = 0; a < 12 && !rt; a++) rt = P.spawn(kind, tier, idx, { radius: 30, dx: (a % 4 - 1.5) * 10, dz: (Math.floor(a / 4) - 1) * 12, id });
        T.rt = rt;
        if (rt) { G.player.inv = 1e9; G.player.hp = G.player.maxHp; G.player.ws = [null, null]; for (const e of G.enemies) { e.dead = true; e.deadT = 0; } }
        return !!rt;
      },
      toLocal(wx, wz) { const z = T.rt.pz.T, dx = wx - z.tx, dz = wz - z.tz; return [z.m00 * dx + z.m10 * dz, z.m01 * dx + z.m11 * dz]; },
      toWorld(lx, lz) { return P.toWorld(T.rt, lx, lz); },
      me() { return T.toLocal(G.player.x, G.player.z); },
      put(lx, lz) { const [wx, wz] = T.toWorld(lx, lz); G.player.x = wx; G.player.z = wz; G.player.vx = G.player.vz = 0; },
      stop() { I.joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }; },
      // el puzle se coloca junto al jugador y puede dejarlo dentro: tras sacarlo, se deja como nuevo
      clean() { const z = T.rt.pz; z.gen.reset(z.spec, z.st); z.st.errors = 0; z.st.moves = 0; z.st.hints = 0; z.st.t = 0; z.st.rev++; window.__step(2, 1 / 30); },
      // camina (en línea recta, con el bucle real) hasta el punto local; devuelve los fotogramas gastados o -1 si se atasca
      trace: [],
      walk(lx, lz, tol, max) {
        const p = G.player; let last = Infinity, still = 0;
        T.trace.length = 0;
        for (let i = 0; i < (max || 240); i++) {
          const m0 = T.me(); T.trace.push(m0[0].toFixed(2) + ',' + m0[1].toFixed(2) + (T.rt.pz.st.cur !== undefined ? '@' + T.rt.pz.st.cur : ''));
          const [wx, wz] = T.toWorld(lx, lz), dx = wx - p.x, dz = wz - p.z, d = Math.hypot(dx, dz);
          for (const e of G.enemies) if (!e.dead) { e.dead = true; e.deadT = 0; } // nadie empuja al jugador de pruebas
          if (d < (tol || 0.2)) { T.stop(); return i; }
          const ux = dx / d, uz = dz / d;
          I.joy = { active: true, id: 99, ox: 0, oy: 0, x: (ux - uz) * s, y: (ux + uz) * s };
          window.__step(1, 1 / 30);
          if (d > last - 0.01) still++; else still = 0;
          last = d;
          if (still > 40) { T.stop(); return -1; }
        }
        T.stop();
        return -1;
      },
      // camino de celdas (8 vecinos sin cortar esquinas) por el estado actual del puzle; las baldosas rojas no se pisan
      route(from, to) {
        const z = T.rt.pz, sp = z.spec, st = z.st, g = z.gen, w = sp.w, h = sp.h;
        const hot = new Set(sp.hot || []);
        const free = (cx, cz) => {
          if (cx < -1 || cz < -1 || cx > w || cz > h) return false;
          if (cx < 0 || cz < 0 || cx >= w || cz >= h) return true; // el anillo exterior
          return !g.solid(sp, st, cx, cz) && !hot.has(cz * w + cx);
        };
        const key = (cx, cz) => (cz + 1) * (w + 2) + cx + 1;
        const prev = new Map(), q = [[from[0], from[1]]]; prev.set(key(from[0], from[1]), null);
        for (let i = 0; i < q.length; i++) {
          const [cx, cz] = q[i];
          if (cx === to[0] && cz === to[1]) break;
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dz) continue;
            const nx = cx + dx, nz = cz + dz;
            if (!free(nx, nz) || prev.has(key(nx, nz))) continue;
            if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue;
            prev.set(key(nx, nz), [cx, cz]);
            q.push([nx, nz]);
          }
        }
        const out = []; let c = [to[0], to[1]];
        if (!prev.has(key(c[0], c[1]))) return null;
        while (c) { out.push(c); c = prev.get(key(c[0], c[1])); }
        return out.reverse();
      },
      // camina por el camino de celdas hasta el centro de la celda destino
      go(to, tol) {
        const z = T.rt.pz, me = T.me();
        const path = T.route([Math.floor(me[0]), Math.floor(me[1])], to);
        if (!path) return { ok: false, why: 'sin camino a ' + to };
        let frames = 0;
        for (let i = 1; i < path.length; i++) {
          const last = i === path.length - 1, f = T.walk(path[i][0] + 0.5, path[i][1] + 0.5, last ? (tol || 0.13) : 0.3, 160);
          if (f < 0) return { ok: false, why: 'atascado en ' + path[i], frames };
          frames += f;
        }
        return { ok: true, frames };
      },
    };
  });

  // ── 2. PLACAS DE PRESIÓN: el jugador camina el orden de la solución por el mapa real ──
  for (const tier of [1, 2, 3]) {
    const outs = [];
    for (const idx of [3, 11, 22]) {
      const r = await ev(([tier, idx]) => {
        const T = window.__t2, P = window.__puzzles, G = window.__G;
        if (!T.spawn('timed', tier, idx, 'pz_tm' + tier + '_' + idx)) return { ok: false, why: 'sin sitio' };
        const z = T.rt.pz, sp = z.spec, w = sp.w;
        window.__step(4, 1 / 30);
        // fuera de la entrada
        const gx = sp.gap % w, gz = Math.floor(sp.gap / w);
        const out = gx === 0 ? [-0.5, gz + 0.5] : gx === w - 1 ? [w + 0.5, gz + 0.5] : gz === 0 ? [gx + 0.5, -0.5] : [gx + 0.5, sp.h + 0.5];
        T.put(out[0], out[1]); window.__step(3, 1 / 30); T.clean();
        const t0 = z.st.t, ev0 = P.PZ.stats.solved;
        let why = '', total = 0;
        // entrada: a la celda de dentro
        const me = T.me();
        for (const pi of sp.sol) {
          const pl = sp.plates[pi], res = T.go([pl.x, pl.z], 0.14);
          if (!res.ok) { why = res.why + ' (placa ' + pi + ')'; break; }
          total += res.frames;
          if (T.rt.pzDone) break;
        }
        window.__step(3, 1 / 30);
        const res = { ok: T.rt.pzDone === true, why, frames: total, errors: z.st.errors, solved: P.PZ.stats.solved - ev0, plates: sp.plates.length, gates: sp.gates.length, hot: sp.hot.length, span: sp.span, nvalid: sp.nvalid, margin: sp.margin, sol: sp.sol.join('') };
        P.remove(T.rt.e.id);
        return res;
      }, [tier, idx]);
      outs.push(r);
      check(`placas nivel ${tier} (semilla ${idx}): el jugador la resuelve caminando (${r.plates || '?'} placas, ${r.gates || 0} rejas, ${r.hot || 0} rojas)`, r.ok && r.errors === 0, JSON.stringify(r));
    }
  }

  // ── 3. placas: rejas, baldosas rojas, duraciones y etiquetas ──
  const mech = await ev(() => {
    const T = window.__t2, P = window.__puzzles, G = window.__G;
    let rt = null, spec = null;
    // un nivel 2 con reja y baldosas rojas
    for (const idx of [3, 11, 22, 5, 8]) { const ok = T.spawn('timed', 2, idx, 'pz_mech'); if (!ok) continue; if (T.rt.pz.spec.gates.length && T.rt.pz.spec.hot.length) { rt = T.rt; spec = rt.pz.spec; break; } P.remove('pz_mech'); }
    if (!rt) return { ok: false, why: 'sin puzle con reja y rojas' };
    const z = rt.pz, st = z.st, w = spec.w, g = z.gen;
    const gate = spec.gates[0], gx = gate.c % w, gzc = Math.floor(gate.c / w);
    const out = { ok: true };
    // la reja está cerrada y es sólida en el mapa; abre al encender su placa; se cierra cuando se apaga
    window.__step(4, 1 / 30);
    const T0 = z.T, blkAt = () => { const [wx, wz] = T.toWorld(gx + 0.5, gzc + 0.5); return G.map.blk[Math.floor(wz) * G.map.w + Math.floor(wx)]; };
    out.cerrada = blkAt() === 1 && !st.gopen[0];
    // se enciende su placa (con el bucle real: se coloca encima)
    const pl = spec.plates[gate.by];
    T.put(pl.x + 0.5, pl.z + 0.5); window.__step(3, 1 / 30);
    out.abierta = blkAt() === 0 && st.gopen[0] === true && st.lit[gate.by] > 0;
    // fuera de la placa se apaga y la reja se cierra
    T.put(-2, -2);
    window.__step(Math.ceil((pl.d + 0.5) * 30), 1 / 30);
    out.cierra = blkAt() === 1 && st.gopen[0] === false && st.lit[gate.by] === 0;
    // baldosa roja: enciende una placa y pisa la roja → todo se apaga, un error, daño
    const hc = spec.hot[0], hp0 = G.player.hp;
    T.put(pl.x + 0.5, pl.z + 0.5); window.__step(3, 1 / 30);
    const lit0 = st.lit[gate.by] > 0;
    T.put((hc % w) + 0.5, Math.floor(hc / w) + 0.5); window.__step(3, 1 / 30);
    out.roja = { lit0, apagadas: st.lit.every((v) => v === 0), errors: st.errors, dano: hp0 - G.player.hp };
    // roce con el borde de la celda roja: se perdona (se prueba la regla sin física: un empujón de la pared movería al jugador)
    const st2 = z.gen.init(spec), fake = (px, pz) => ({ px, pz, inside: true, snd() {}, hurt() {}, toast() {} }), hx = hc % w, hz = Math.floor(hc / w);
    z.gen.step(spec, st2, 0.03, fake(hx + 0.05, hz + 0.5));
    z.gen.step(spec, st2, 0.03, fake(hx + 0.5, hz + 0.95));
    out.roce = st2.errors === 0;
    z.gen.step(spec, st2, 0.03, fake(hx + 0.5, hz + 0.5));
    out.pisada = st2.errors === 1;
    // etiquetas: una por placa con sus segundos
    G.player.x += 0; window.__step(3, 1 / 30);
    const labs = Array.from(document.querySelectorAll('#pzLab b')).map((b) => b.textContent.trim());
    out.labels = labs;
    out.labelsOk = labs.length === spec.plates.length && spec.plates.every((p) => labs.includes(p.d + ' s'));
    out.hud = document.querySelector('#pzHud .pzs') ? document.querySelector('#pzHud .pzs').textContent : '';
    P.remove('pz_mech');
    return out;
  });
  console.log('mecánicas placas', JSON.stringify(mech));
  check('placas: la reja está cerrada y es sólida hasta encender su placa; se abre; se cierra al apagarse', mech.ok && mech.cerrada && mech.abierta && mech.cierra, JSON.stringify({ c: mech.cerrada, a: mech.abierta, x: mech.cierra }));
  check('placas: pisar una baldosa roja apaga todo, cuenta un error y duele; rozar el borde se perdona', mech.ok && mech.roja && mech.roja.lit0 && mech.roja.apagadas && mech.roja.errors >= 1 && mech.roja.dano > 0 && mech.roce && mech.pisada, JSON.stringify(mech.roja) + ' roce=' + mech.roce + ' pisada=' + mech.pisada);
  check('placas: cada placa lleva su duración en una etiqueta', mech.ok && mech.labelsOk, JSON.stringify(mech.labels) + ' ' + mech.hud);

  // ── 4. LOSAS DE UN SOLO PASO: caminando de verdad ──
  for (const tier of [1, 2, 3]) {
    for (const idx of [2, 9, 17]) {
      const r = await ev(([tier, idx]) => {
        const T = window.__t2, P = window.__puzzles, G = window.__G;
        if (!T.spawn('sink', tier, idx, 'pz_sk' + tier + '_' + idx)) return { ok: false, why: 'sin sitio' };
        const z = T.rt.pz, sp = z.spec, w = sp.w, st = z.st;
        window.__step(4, 1 / 30);
        const gx = sp.entry % w, gz = Math.floor(sp.entry / w);
        const out = gx === 0 ? [-0.5, gz + 0.5] : gx === w - 1 ? [w + 0.5, gz + 0.5] : gz === 0 ? [gx + 0.5, -0.5] : [gx + 0.5, sp.h + 0.5];
        T.put(out[0], out[1]); window.__step(3, 1 / 30); T.clean();
        // entra por la puerta y recorre la solución losa a losa
        let why = '';
        const s0 = Array.from(st.state).join(''), p0 = T.me().map((v) => v.toFixed(2)).join(',');
        const ec = T.walk((sp.entry % w) + 0.5, Math.floor(sp.entry / w) + 0.5, 0.15, 120);
        const s1 = Array.from(st.state).join(''), tr1 = T.trace.filter((_, i) => i % 2 === 0).slice(0, 14).join(' ');
        if (ec < 0) why = 'no llega a la entrada';
        for (const c of sp.sol) {
          if (why) break;
          const f = T.walk((c % w) + 0.5, Math.floor(c / w) + 0.5, 0.14, 120);
          if (f < 0) {
            const me = T.me(), bl = [];
            for (let dz2 = -2; dz2 <= 2; dz2++) { let row = ''; for (let dx2 = -2; dx2 <= 2; dx2++) row += G.map.blk[Math.floor(G.player.z + dz2) * G.map.w + Math.floor(G.player.x + dx2)] ? '#' : '.'; bl.push(row); }
            why = 'atascado en la losa ' + c + ' (' + (c % w) + ',' + Math.floor(c / w) + ') me=' + me.map((v) => v.toFixed(2)) + ' rot=' + z.d.rot + ' blk=' + bl.join('/') + ' st=' + Array.from(st.state).join('') + ' cur=' + st.cur + ' s0=' + s0 + ' p0=' + p0 + ' s1=' + s1 + ' tr1=' + tr1 + ' trace=' + T.trace.filter((_, i) => i % 3 === 0).slice(0, 40).join(' ');
            break;
          }
        }
        let closed = 0; for (let i = 0; i < st.state.length; i++) closed += st.state[i] === 2 ? 1 : 0;
        const nlit = st.nlit, open = st.open;
        if (!why) { const f = T.walk((sp.exit % w) + 0.5, Math.floor(sp.exit / w) + 0.5, 0.2, 120); if (f < 0) why = 'no llega a la salida'; }
        window.__step(3, 1 / 30);
        const res = { ok: T.rt.pzDone === true, why, closed, nlit, keys: sp.keys.length, open, len: sp.sol.length, sols: sp.sols, errors: st.errors };
        P.remove(T.rt.e.id);
        return res;
      }, [tier, idx]);
      check(`losas nivel ${tier} (semilla ${idx}): el jugador la resuelve caminando (se cierran las que deja atrás)`, r.ok && r.nlit === r.keys && r.closed >= r.len - 2, JSON.stringify(r));
    }
  }

  // ── 5. losas: mecánica fina ──
  const sk = await ev(() => {
    const T = window.__t2, P = window.__puzzles, G = window.__G;
    if (!T.spawn('sink', 2, 4, 'pz_skm')) return { ok: false };
    const z = T.rt.pz, sp = z.spec, st = z.st, w = sp.w, g = z.gen;
    window.__step(4, 1 / 30);
    const out = { ok: true };
    const cell = (c) => [(c % w) + 0.5, Math.floor(c / w) + 0.5];
    const blk = (c) => { const [lx, lz] = cell(c), [wx, wz] = T.toWorld(lx, lz); return G.map.blk[Math.floor(wz) * G.map.w + Math.floor(wx)]; };
    // la salida está cerrada (sólida) hasta pisar todos los diamantes
    out.salidaCerrada = blk(sp.exit) === 1 && st.open === false;
    // pisar la primera losa y la segunda: la primera se cierra al alejarse 0,3 m del borde
    const [a, b] = [sp.sol[0], sp.sol[1]];
    T.put(...cell(a)); window.__step(3, 1 / 30);
    out.aPisada = st.state[a] === 1;
    T.put(...cell(b)); window.__step(3, 1 / 30);
    out.aCerrada = st.state[a] === 2 && blk(a) === 1;
    // volver a la losa cerrada es imposible (sólida): el jugador no puede ocuparla
    // reiniciar: todo intacto y el jugador vuelve a la entrada
    P.action(T.rt, 'reset'); window.__step(3, 1 / 30);
    const me = T.me();
    out.reset = st.state.every((v) => v === 0) && blk(a) === 0 && Math.hypot(me[0] - ((sp.entry % w) + 0.5), me[1] - (Math.floor(sp.entry / w) + 0.5)) < 0.8;
    // esquina en diagonal: pisar en diagonal cierra también las dos losas de los lados
    const free = []; for (let c = 0; c < w * sp.h; c++) if (g.solid(sp, st, c % w, Math.floor(c / w)) === false && c !== sp.entry && c !== sp.exit) free.push(c);
    let diag = null;
    for (const c of free) { const d = c + w + 1; if ((c % w) + 1 < w && free.includes(d) && free.includes(c + 1) && free.includes(c + w)) { diag = [c, d]; break; } }
    if (diag) {
      P.action(T.rt, 'reset'); window.__step(2, 1 / 30);
      T.put(...cell(diag[0])); window.__step(3, 1 / 30);
      T.put(...cell(diag[1])); window.__step(3, 1 / 30);
      out.diagonal = st.state[diag[0] + 1] >= 1 && st.state[diag[0] + w] >= 1;
    } else out.diagonal = true;
    // sin camino: encierra al jugador y debe avisar
    P.action(T.rt, 'reset'); window.__step(2, 1 / 30);
    const nb = [];
    T.put(...cell(sp.sol[1])); window.__step(3, 1 / 30);
    for (const d of [1, -1, w, -w]) { const c = sp.sol[1] + d; if (c >= 0 && c < w * sp.h && !g.solid(sp, st, c % w, Math.floor(c / w)) && c !== sp.entry) nb.push(c); }
    for (const c of nb) st.state[c] = 2;
    st.rev++; st.dirty = true; window.__step(3, 1 / 30);
    out.atrapado = st.stuck === true;
    out.hudStuck = (document.querySelector('#pzHud .pzs') || { textContent: '' }).textContent;
    P.action(T.rt, 'reset'); window.__step(2, 1 / 30);
    out.pista = (() => { const h = g.hint(sp, st); return h && h.text; })();
    P.remove('pz_skm');
    return out;
  });
  console.log('mecánica losas', JSON.stringify(sk));
  check('losas: la salida está cerrada hasta pisar los diamantes', sk.ok && sk.salidaCerrada, JSON.stringify(sk));
  check('losas: la losa que dejas se cierra (sólida en el mapa) y Reiniciar lo deja todo intacto y te devuelve a la entrada', sk.ok && sk.aPisada && sk.aCerrada && sk.reset, JSON.stringify({ p: sk.aPisada, c: sk.aCerrada, r: sk.reset }));
  check('losas: pasar en diagonal por una esquina cierra también las dos losas de los lados', sk.ok && sk.diagonal, JSON.stringify({ d: sk.diagonal }));
  check('losas: si te encierras, el panel avisa de que ya no hay camino', sk.ok && sk.atrapado && /Sin camino/.test(sk.hudStuck || ''), JSON.stringify({ a: sk.atrapado, t: sk.hudStuck }));

  // ── 6. BLOQUES SOBRE HIELO ──
  const ice = await ev(() => {
    const T = window.__t2, P = window.__puzzles, G = window.__G;
    const out = { ok: true, runs: [] };
    for (const [tier, idx] of [[1, 2], [2, 7], [3, 13]]) {
      if (!T.spawn('ice', tier, idx, 'pz_ice' + tier)) { out.ok = false; out.runs.push({ tier, why: 'sin sitio' }); continue; }
      const r = P.bot(T.rt);
      out.runs.push({ tier, ok: r.ok, acted: r.acted, errors: r.errors, solved: T.rt.pzDone === true });
      P.remove('pz_ice' + tier);
    }
    // deslizamiento: en un puzle concreto, el empujón mueve el bloque varias celdas de golpe y Deshacer lo trae
    T.spawn('ice', 2, 7, 'pz_icem');
    const z = T.rt.pz, sp = z.spec, st = z.st, g = z.gen;
    const first = sp.sol[0], [c, d] = first, bi = st.boxes.indexOf(c);
    const before = st.boxes.slice();
    g.act(sp, st, bi * 4 + d, { snd() {}, occupied: () => false });
    const moved = st.boxes[bi], cells = Math.abs((moved % sp.w) - (c % sp.w)) + Math.abs(Math.floor(moved / sp.w) - Math.floor(c / sp.w));
    out.slide = { cells, from: c, to: moved, tween: st.tween };
    out.undo = g.undo(sp, st) && st.boxes.join() === before.join();
    out.label = g.label(sp, st, bi * 4 + d);
    // una pista concreta
    out.hint = g.hint(sp, st, { cell: -1 }).text;
    P.remove('pz_icem');
    return out;
  });
  console.log('hielo', JSON.stringify(ice));
  check('hielo: el bot de pruebas resuelve los tres niveles por el bucle real', ice.ok && ice.runs.every((r) => r.ok && r.solved && r.errors === 0), JSON.stringify(ice.runs));
  check('hielo: un empujón desliza el bloque varias celdas de golpe y Deshacer lo devuelve', ice.slide.cells >= 1 && ice.undo, JSON.stringify(ice.slide) + ' ' + ice.undo);

  // ── 7. CERRADURA DE SÍMBOLOS ──
  const lk = await ev(() => {
    const T = window.__t2, P = window.__puzzles, G = window.__G;
    const out = { ok: true, runs: [] };
    for (const [tier, idx] of [[1, 3], [2, 5], [3, 8]]) {
      if (!T.spawn('lock', tier, idx, 'pz_lk' + tier)) { out.ok = false; out.runs.push({ tier, why: 'sin sitio' }); continue; }
      const r = P.bot(T.rt);
      out.runs.push({ tier, ok: r.ok, acted: r.acted, errors: r.errors, moves: r.moves, solved: T.rt.pzDone === true });
      P.remove('pz_lk' + tier);
    }
    // a mano: girar una ranura, probar, comprobar pistas ✔/◐, agotar intentos y que el código cambie
    T.spawn('lock', 2, 5, 'pz_lkm');
    const z = T.rt.pz, sp = z.spec, st = z.st, g = z.gen, L = sp.L;
    const ctx = { snd() {}, toast() {}, hurt() {}, occupied: () => false };
    window.__step(4, 1 / 30);
    const v0 = st.cur[0]; g.act(sp, st, 0, ctx);
    out.gira = st.cur[0] === (v0 + 1) % sp.K;
    // etiquetas dinámicas: el texto de la ranura 1 cambia con el símbolo
    T.put(sp.L ? Math.floor((sp.w - L) / 2) + 0.5 : 0.5, 1.5); window.__step(3, 1 / 30);
    const lab1 = Array.from(document.querySelectorAll('#pzLab b')).map((b) => b.textContent.trim());
    g.act(sp, st, 0, ctx); window.__step(3, 1 / 30);
    const lab2 = Array.from(document.querySelectorAll('#pzLab b')).map((b) => b.textContent.trim());
    out.labels = { n: lab1.length, cambia: lab1[0] !== lab2[0], lab1: lab1[0], lab2: lab2[0] };
    // fallar hasta agotar los intentos (combinaciones inventadas: si por casualidad aciertan, se cambian)
    const sec0 = Array.from({ length: L }, (_, i) => i);
    let exhausted = false, round0 = st.round;
    for (let n = 0; n < sp.tries + 2 && st.round === round0 && !st.open; n++) {
      // el código real no es 0..L-1 (la semilla lo evita); si por azar acierta, se gira una ranura
      g.act(sp, st, L, ctx);
      if (st.open) break;
    }
    out.agota = st.round > round0 && st.hist.length === 0 && st.fails >= 1 && st.errors >= 1;
    // el solucionador metódico abre el nuevo código
    out.hint = (g.hint(sp, st) || {}).text;
    P.remove('pz_lkm');
    return out;
  });
  console.log('cerradura', JSON.stringify(lk));
  check('cerradura: el bot de pruebas la resuelve en los tres niveles por el bucle real', lk.ok && lk.runs.every((r) => r.ok && r.solved && r.errors === 0), JSON.stringify(lk.runs));
  check('cerradura: girar la ranura cambia el símbolo y su etiqueta flotante', lk.gira && lk.labels.n === 4 && lk.labels.cambia, JSON.stringify(lk.labels));
  check('cerradura: al agotar los intentos el código cambia, se anota el fallo y el historial se vacía', lk.agota, JSON.stringify({ agota: lk.agota }));

  // ── 8. pistas, reiniciar y botones del HUD de cada tipo nuevo ──
  const hud = await ev(() => {
    const T = window.__t2, P = window.__puzzles, G = window.__G, out = {};
    for (const [kind, tier, idx] of [['timed', 2, 3], ['sink', 2, 4], ['ice', 2, 7], ['lock', 2, 5]]) {
      T.spawn(kind, tier, idx, 'pz_h_' + kind);
      const z = T.rt.pz;
      T.put(z.d.lw / 2, z.d.lh / 2 + 0.2); window.__step(6, 1 / 30);
      const bts = Array.from(document.querySelectorAll('#pzHud button')).map((b) => b.dataset.pz);
      const h0 = z.st.hints;
      P.action(T.rt, 'hint'); window.__step(2, 1 / 30);
      out[kind] = { bts, pista: z.st.hints === h0 + 1, msg: z.msg ? z.msg.text : '', status: (document.querySelector('#pzHud .pzs') || { textContent: '' }).textContent };
      P.remove('pz_h_' + kind);
    }
    return out;
  });
  console.log('hud', JSON.stringify(hud));
  check('cada tipo nuevo muestra Reiniciar y Pista (hielo y cerradura también Deshacer/hackeo) y da pista', ['timed', 'sink', 'ice', 'lock'].every((k) => hud[k].bts.includes('reset') && hud[k].bts.includes('hint') && hud[k].pista), JSON.stringify(Object.fromEntries(Object.entries(hud).map(([k, v]) => [k, v.bts.join('/')]))));

  // ── 9. gráficos: instancias por puzle y reparto de tipos en las mazmorras ──
  await api.region('desierto');
  const gfx = await ev(() => {
    const T = window.__t2, P = window.__puzzles, G = window.__G, out = {};
    const base = P.gfx();
    for (const [kind, tier, idx] of [['timed', 3, 3], ['sink', 3, 4], ['ice', 3, 7], ['lock', 3, 5]]) {
      if (!T.spawn(kind, tier, idx, 'pz_g_' + kind)) { out[kind] = { drawn: 99, instances: 0, fail: true }; continue; }
      const z = T.rt.pz; T.put(z.d.lw / 2, z.d.lh / 2); window.__step(6, 1 / 30);
      out[kind] = P.gfx();
      P.remove('pz_g_' + kind); window.__step(3, 1 / 30);
    }
    out.base = base; out.after = P.gfx(); out.mem = P.mem();
    out.hidden = Object.values(P.PZR.b).every((pair) => pair.every((b) => !b.mesh.visible));
    return out;
  });
  console.log('gfx', JSON.stringify(gfx));
  check('cada tipo nuevo se dibuja con ≤ 16 mallas instanciadas y al quitarlo no queda nada visible', ['timed', 'sink', 'ice', 'lock'].every((k) => gfx[k].drawn <= 16 && gfx[k].instances > 20) && gfx.hidden && gfx.mem.puzzleMeshes === 16, JSON.stringify({ t: gfx.timed, s: gfx.sink, i: gfx.ice, l: gfx.lock, hidden: gfx.hidden }));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const warn = logs.filter((l) => /\[puzles\]/.test(l));
  check('sin avisos de [puzles]', warn.length === 0, warn.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS de ${results.length}` : `\nTODO OK (${results.length} comprobaciones)`);
  if (bad.length) process.exitCode = 1;
}
