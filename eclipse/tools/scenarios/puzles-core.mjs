// Puzles (D7): prueba de punta a punta del frente.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/puzles-core.mjs --size 960x540 --out /ruta
// Variables: POOL=40 (semillas por tipo y nivel en validateAll), FAST=1 (pool 6, para iterar).
// Comprueba: validateAll() = 0 fallos · cada generador se resuelve JUGANDO (colocación, aviso, USAR, bucle real) en los tres niveles ·
// botín/XP/estadísticas/eventos · guardado y repoblado a los 120 min · celdas sólidas en map.blk y su limpieza · una mazmorra real
// (escalera → subterráneo con acertijo → resolver → salir → volver) · cámara sellada clásica · pista, reiniciar, deshacer · teclado.
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });

  // ── 1. el universo entero de puzles es resoluble ──
  const pool = process.env.FAST ? 6 : Number(process.env.POOL || 40);
  const va = await ev((pool) => { const a = window.__puzzles.api.validateAll({ pool }); return { total: a.total, ok: a.ok, fails: a.fails, ms: a.ms, sum: a.sum, f: a.failures.slice(0, 4), kinds: Object.keys(a.byKind) }; }, pool);
  check(`validateAll(pool ${pool}): ${va.total} puzles, 0 fallos`, va.fails === 0 && va.total > 0, `${va.ok}/${va.total} · ${va.ms} ms · huella ${va.sum} · ${JSON.stringify(va.f)}`);
  check('hay 10 tipos registrados (8 nuevos + switch y sequence)', va.kinds.length >= 10, va.kinds.join(','));

  // ── 2. cada generador se resuelve jugando (bucle real del juego) ──
  await api.region('desierto');
  const kinds = ['mirrors', 'boxes', 'timed', 'runes', 'circuit', 'lasers', 'memory', 'valves'];
  const live = {};
  for (const k of kinds) {
    for (const tier of [1, 2, 3]) {
      const r = await ev(([k, tier]) => {
        const P = window.__puzzles, G = window.__G;
        G.S.puzzles = G.S.puzzles || {};
        const idx = (tier * 7 + k.length) % 40;
        // varios intentos de colocación en distintos sitios alrededor
        let rt = null;
        for (let a = 0; a < 6 && !rt; a++) { rt = P.spawn(k, tier, idx, { radius: 26, dx: (a % 3 - 1) * 10, dz: (Math.floor(a / 3) - 0.5) * 12, id: `pz_${k}${tier}` }); }
        if (!rt) return { ok: false, why: 'sin sitio' };
        const hp0 = G.player.hp, cr0 = G.S.credits, n0 = G.pickups.length, ev0 = P.PZ.events.length;
        const out = P.bot(rt);
        window.__step(6, 1 / 30);
        const last = P.PZ.events[P.PZ.events.length - 1];
        const res = { ...out, ev: P.PZ.events.length - ev0, kind: last && last.kind, perfect: last && last.perfect, pickups: last && last.drops, credits: G.S.credits - cr0 };
        P.remove(rt.e.id);
        return res;
      }, [k, tier]);
      live[`${k}${tier}`] = r;
      check(`${k} nivel ${tier}: lo resuelve el jugador de pruebas por el bucle real`, r.ok && r.ev === 1 && r.kind === k, JSON.stringify(r));
    }
  }

  // ── 3. botín, XP y estadísticas ──
  const st = await ev(() => ({ s: window.__G.S.puzzleStats, v: window.__G.S.puzzleV }));
  check('S.puzzleStats cuenta los 24 resueltos y S.puzzleV = 1', st.s.n === 24 && st.v === 1 && Object.keys(st.s.byKind).length === 8, JSON.stringify(st));
  check('cada acertijo soltó botín del sistema de ECONOMÍA y créditos', Object.values(live).every((r) => r.pickups > 0 && r.credits > 0), kinds.map((k) => `${k}:${live[k + '3'] && live[k + '3'].pickups}`).join(' '));

  // ── 4. celdas sólidas ↔ map.blk, y limpieza al desmontar ──
  const blk = await ev(() => {
    const P = window.__puzzles, G = window.__G, sum = () => { let n = 0; const b = G.map.blk; for (let i = 0; i < b.length; i++) n += b[i]; return n; };
    const b0 = sum(), g0 = P.mem();
    let rt = null;
    for (let a = 0; a < 6 && !rt; a++) rt = P.spawn('boxes', 2, 4, { radius: 26, dx: (a % 3 - 1) * 10, dz: (Math.floor(a / 3) - 0.5) * 12, id: 'pz_blk' });
    if (!rt) return { ok: false, why: 'sin sitio' };
    const b1 = sum(), z = rt.pz;
    let solid = 0; for (let cz = 0; cz < z.d.lh; cz++) for (let cx = 0; cx < z.d.lw; cx++) if (z.gen.solid(z.spec, z.st, cx, cz)) solid++;
    P.remove('pz_blk');
    const b2 = sum();
    return { ok: true, b0, b1, b2, solid, geo0: g0.geometries, geo1: P.mem().geometries };
  });
  check('las celdas sólidas del puzle suben map.blk al montarlo y lo devuelven al quitarlo', blk.ok && blk.b1 - blk.b0 === blk.solid && blk.solid > 0 && blk.b2 === blk.b0, JSON.stringify(blk));

  // ── 5. una mazmorra real: escalera → acertijo → resolver → salir → volver ──
  const dng = await ev(() => {
    const P = window.__puzzles, G = window.__G, S = G.S;
    const stairs = G.world.map.ents.filter((e) => e.k === 'stairs' && P.api.stairsHave(e));
    if (!stairs.length) return { ok: false, why: 'ninguna escalera con acertijo' };
    // se prueban escaleras hasta encontrar un subterráneo donde el puzle haya cabido
    for (const e of stairs.slice(0, 12)) {
      G.player.x = e.x + 1.5; G.player.z = e.z; G.world.enterSub(e);
      window.__step(30, 1 / 30);
      const ent = G.map.ents.find((q) => q.k === 'puzzle');
      if (!ent) { G.world.leaveSub(); window.__step(10, 1 / 30); continue; }
      const sid = 'sub:' + e.id;
      // acercarse (monta el puzle) y ver su tipo
      const d = ent.pz;
      G.player.x = ent.x; G.player.z = ent.z + d.H / 2 + 1.5; G.player.inv = 9999;
      window.__step(20, 1 / 30);
      const rt = G.world.rt.get(ent.id);
      const mounted = !!(rt && rt.pz);
      const kind = d.kind;
      const out = mounted ? P.bot(rt) : { ok: false, why: 'no montado' };
      window.__step(4, 1 / 30);
      const saved = S.puzzles[sid];
      return { ok: true, sid, kind, tier: d.tier, rot: d.rot, theme: d.theme, mounted, solved: out, saved, mode: G.mode, stairId: e.id };
    }
    return { ok: false, why: 'ningún subterráneo con sitio' };
  });
  console.log('mazmorra', JSON.stringify(dng));
  check('en una escalera con acertijo, el subterráneo lo trae montado y se resuelve', dng.ok && dng.mounted && dng.solved.ok, JSON.stringify(dng));
  check('el acertijo resuelto se guarda en S.puzzles (sub:<escalera>)', dng.saved && dng.saved.k === dng.kind && dng.saved.t > 0, JSON.stringify(dng.saved));
  await shot('mazmorra-resuelto');
  const again = await ev((sid) => {
    const P = window.__puzzles, G = window.__G, S = G.S;
    const e = G.world.map ? null : null;
    G.world.leaveSub(); window.__step(30, 1 / 30);
    const stairs = G.map.ents.find((q) => q.k === 'stairs' && 'sub:' + q.id === sid);
    G.player.x = stairs.x + 1.5; G.player.z = stairs.z;
    G.world.enterSub(stairs); window.__step(30, 1 / 30);
    const ent = G.map.ents.find((q) => q.k === 'puzzle');
    if (!ent) return { ok: false, why: 'sin acertijo al volver (puede ser otro mapa sin hueco)' };
    G.player.x = ent.x; G.player.z = ent.z + ent.pz.H / 2 + 1.5; window.__step(20, 1 / 30);
    const rt = G.world.rt.get(ent.id);
    const doneNow = !!(rt && rt.pzDone);
    // viaje en el tiempo: 121 min después vuelve a estar disponible
    S.puzzles[sid].t -= 121 * 60000;
    G.world.leaveSub(); window.__step(20, 1 / 30);
    G.player.x = stairs.x + 1.5; G.player.z = stairs.z; G.world.enterSub(stairs); window.__step(30, 1 / 30);
    const ent2 = G.map.ents.find((q) => q.k === 'puzzle');
    let again = false;
    if (ent2) { G.player.x = ent2.x; G.player.z = ent2.z + ent2.pz.H / 2 + 1.5; window.__step(20, 1 / 30); const rt2 = G.world.rt.get(ent2.id); again = !!(rt2 && rt2.pz && !rt2.pzDone); }
    G.world.leaveSub(); window.__step(10, 1 / 30);
    return { ok: true, doneNow, again, kind1: ent.pz.kind, kind2: ent2 && ent2.pz.kind };
  }, dng.sid);
  console.log('volver', JSON.stringify(again));
  check('al volver a la misma escalera el acertijo aparece resuelto y sin premio; a los 121 min se repuebla', again.ok && again.doneNow && again.again, JSON.stringify(again));
  check('el tipo de acertijo es estable por escalera aunque el mapa cambie', again.ok && again.kind1 === again.kind2 && again.kind1 === dng.kind, JSON.stringify(again));

  // ── 6. cámara sellada clásica (switch / sequence): cuenta como acertijo resuelto ──
  const leg = await ev(() => {
    const P = window.__puzzles, G = window.__G, S = G.S;
    const e = G.world.map.ents.find((q) => q.k === 'stairs' && q.enc === 'puzzle');
    if (!e) return { ok: false, why: 'sin escalera de cámara sellada' };
    G.player.x = e.x + 1.5; G.player.z = e.z; G.world.enterSub(e); window.__step(20, 1 / 30);
    const n0 = P.PZ.events.length, k0 = S.puzzleStats.n;
    const st = P.Ni.st; if (!st) return { ok: false, why: 'sin encuentro' };
    st.state = 'active'; P.Ni.finish(true); window.__step(4, 1 / 30);
    const ev = P.PZ.events[P.PZ.events.length - 1];
    const res = { ok: true, ev: P.PZ.events.length - n0, legacy: ev && ev.legacy, kind: ev && ev.kind, n: S.puzzleStats.n - k0, saved: Object.keys(S.puzzles).filter((i) => i.startsWith('leg:')).length };
    G.world.leaveSub(); window.__step(10, 1 / 30);
    return res;
  });
  check('la cámara sellada clásica emite puzzleSolved(legacy) y se anota', leg.ok && leg.ev === 1 && leg.legacy && /^(switch|sequence)$/.test(leg.kind) && leg.n === 1 && leg.saved === 1, JSON.stringify(leg));

  // ── 7. HUD, pista, reiniciar, deshacer y teclado (en el mundo, junto al jugador) ──
  await api.region('desierto');
  const ui = await ev(() => {
    const P = window.__puzzles, G = window.__G;
    let rt = null;
    for (let a = 0; a < 6 && !rt; a++) rt = P.spawn('boxes', 1, 2, { radius: 26, dx: (a % 3 - 1) * 10, dz: (Math.floor(a / 3) - 0.5) * 12, id: 'pz_ui' });
    if (!rt) return { ok: false, why: 'sin sitio' };
    const z = rt.pz; const [wx, wz] = P.transform ? [rt.e.x, rt.e.z] : [0, 0];
    G.player.x = rt.e.x; G.player.z = rt.e.z + z.d.H / 2 + 1.2; G.player.inv = 9999; window.__step(10, 1 / 30);
    return { ok: true, near: z.near, active: P.PZ.active === rt, id: rt.e.id, paused: G.paused, uiOpen: G.uiOpen, mode: G.mode, mounted: P.api.mounted().length, lx: z.lx, lz: z.lz, dims: [z.d.lw, z.d.lh], rot: z.d.rot, player: [G.player.x, G.player.z], ent: [rt.e.x, rt.e.z] };
  });
  check('junto al puzle se activa su tarjeta (activo + cerca)', ui.ok && ui.near && ui.active, JSON.stringify(ui));
  if (ui.ok) {
    await wait(3);
    const hud = await ev(() => { const h = document.getElementById('pzHud'); const r = h.getBoundingClientRect(); return { shown: getComputedStyle(h).display !== 'none', btn: [...h.querySelectorAll('button')].map((b) => b.dataset.pz + ':' + Math.round(b.getBoundingClientRect().height)), w: Math.round(r.width), h: Math.round(r.height), text: h.innerText.slice(0, 120) }; });
    console.log('hud', JSON.stringify(hud));
    check('la tarjeta muestra estado y botones Reiniciar / Deshacer / Pista de ≥ 40 px', hud.shown && hud.btn.length >= 3 && hud.btn.every((b) => Number(b.split(':')[1]) >= 40), JSON.stringify(hud));
    await shot('hud');
    // pista por el botón (clic real), deshacer y reiniciar
    const h0 = await ev(() => window.__puzzles.rt('pz_ui').pz.st.hints);
    await page.click('#pzHud button[data-pz="hint"]'); await wait(2);
    const h1 = await ev(() => window.__puzzles.rt('pz_ui').pz.st.hints);
    check('el botón Pista da una pista y la cuenta', h1 === h0 + 1, `${h0} → ${h1}`);
    // un empuje real por teclado: se coloca detrás de la primera caja que dice el bot y pulsa la tecla E de verdad
    const pushed = await ev(() => {
      const P = window.__puzzles, G = window.__G, rt = P.rt('pz_ui'), z = rt.pz;
      const plan = z.gen.bot(z.spec, z.st); const a = plan[0];
      const [fx, fz] = [0, 0];
      const T = z.T; const wx = T.tx + T.m00 * a.at[0] + T.m01 * a.at[1], wz = T.tz + T.m10 * a.at[0] + T.m11 * a.at[1];
      G.player.x = wx; G.player.z = wz;
      const gx = T.tx + T.m00 * (a.at[0] + a.face[0]) + T.m01 * (a.at[1] + a.face[1]), gz = T.tz + T.m10 * (a.at[0] + a.face[0]) + T.m11 * (a.at[1] + a.face[1]);
      G.player.face = Math.atan2(gx - wx, gz - wz);
      window.__step(2, 1 / 30);
      return { moves0: z.st.moves, prompt: G.prompt && G.prompt.text };
    });
    await page.keyboard.down('KeyE'); await ev(() => window.__step(2, 1 / 30)); await page.keyboard.up('KeyE'); await ev(() => window.__step(2, 1 / 30));
    const after = await ev(() => ({ moves: window.__puzzles.rt('pz_ui').pz.st.moves }));
    check('la tecla E real empuja la caja (USAR por teclado)', after.moves === pushed.moves0 + 1 && /Empujar/.test(pushed.prompt || ''), JSON.stringify({ pushed, after }));
    await page.click('#pzHud button[data-pz="undo"]'); await wait(2);
    const u = await ev(() => { const s = window.__puzzles.rt('pz_ui').pz.st; return { hist: s.hist.length, moves: s.moves }; });
    check('Deshacer devuelve la caja (historial vacío)', u.hist === 0, JSON.stringify(u));
    await page.click('#pzHud button[data-pz="reset"]'); await wait(2);
    const rs = await ev(() => { const z = window.__puzzles.rt('pz_ui').pz; return { same: JSON.stringify(z.st.boxes) === JSON.stringify(z.spec.boxes), resets: z.st.resets }; });
    check('Reiniciar vuelve a la posición inicial', rs.same && rs.resets === 1, JSON.stringify(rs));
    await ev(() => window.__puzzles.remove('pz_ui'));
  }

  // ── 8. el panel desaparece al alejarse y no deja nada colgado ──
  await ev(() => { window.__G.player.x += 40; window.__step(20, 1 / 30); });
  const gone = await ev(() => ({ shown: getComputedStyle(document.getElementById('pzHud')).display !== 'none', mounted: window.__puzzles.api.mounted().length }));
  check('lejos de cualquier puzle no hay tarjeta ni puzles montados', !gone.shown && gone.mounted === 0, JSON.stringify(gone));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const warns = logs.filter((l) => /\[warning\]/.test(l) && /puzles/.test(l));
  check('sin avisos de [puzles]', warns.length === 0, warns.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS de ${results.length}` : `\nTODO OK (${results.length} comprobaciones)`);
  if (bad.length) process.exitCode = 1;
}
