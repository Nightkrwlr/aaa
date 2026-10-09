// D8a · guaridas de jefe (31g-bosses.js): mapas de las 9 regiones, altar de la superficie, guardián, puerta, jefe de 3 fases, primera muerte y cooldown
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/jefes-guarida.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs, shot, teleport } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); window.__toastLog = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.textContent && window.__toastLog.push(n.textContent)))).observe(document.querySelector('#toasts'), { childList: true }); });

  // A) los mapas: 9 regiones × 6 semillas, sin renderizar
  const maps = await ev(() => {
    const L = window.__lair, bad = [], rows = [];
    for (let reg = 0; reg < 9; reg++) {
      let ok = 0;
      for (let seed = 1; seed <= 6; seed++) {
        try {
          const m = L.map(reg, seed * 7919 + reg);
          const enc = m.ents.find((q) => q.k === 'encounter'), ex = m.ents.find((q) => q.k === 'exit');
          const rooms = m.rooms || [], ei = rooms.indexOf(m.encRoom), mid = ei > 1 ? rooms[ei - 1] : rooms[ei + 1] || rooms[0];
          const pass = (K) => K === m.floorT;
          const d = L.bfs(m, [m.spawnBase[0], m.spawnBase[1]], pass);
          const reach = (c) => d[m.idx(Math.floor(c.cx), Math.floor(c.cz))] >= 0;
          const [gx, gz] = m.findFree(mid.cx, mid.cz, 5, 1.2);
          const problems = [];
          if (!enc || enc.enc !== 'lair') problems.push('sin encuentro lair');
          if (!ex) problems.push('sin salida');
          if (!enc || !enc.seal || !enc.seal.length) problems.push('sin puerta (seal)');
          if (!m.encRoom || m.encRoom.w < 12 || m.encRoom.h < 10) problems.push('arena pequeña ' + (m.encRoom && m.encRoom.w) + 'x' + (m.encRoom && m.encRoom.h));
          if (!reach(m.encRoom)) problems.push('arena inalcanzable');
          if (!reach(mid)) problems.push('sala media inalcanzable');
          if (m.ter[m.idx(Math.floor(gx), Math.floor(gz))] !== m.floorT) problems.push('guardián fuera del suelo');
          if (mid === m.encRoom) problems.push('sala media = arena');
          if (m.ents.filter((q) => q.k === 'spawnpack').length < 2) problems.push('pocas manadas');
          problems.length ? bad.push(`reg${reg}/s${seed}: ${problems.join(', ')}`) : ok++;
        } catch (e) { bad.push(`reg${reg}/s${seed}: EXCEPCIÓN ${e.message}`); }
      }
      rows.push(ok);
    }
    return { bad, rows };
  });
  console.log('mapas ok por región', JSON.stringify(maps.rows));
  check('54 guaridas (9 regiones × 6 semillas): encuentro, puerta, salida, arena grande, sala media y arena alcanzables, guardián en suelo', maps.bad.length === 0, maps.bad.slice(0, 4).join(' | '));

  const arenas = await ev(() => window.__G.map.ents.filter((e) => e.k === 'bossarena' && !e.secret && !e.op).map((e) => e.reg).sort());
  check('el mundo tiene la arena (y por tanto la entrada de la guarida) de las 9 regiones', JSON.stringify(arenas) === '[0,1,2,3,4,5,6,7,8]', JSON.stringify(arenas));

  // B) altar de la superficie
  const prep = await ev(() => {
    const G = window.__G, S = G.S, a = G.map.ents.find((e) => e.k === 'bossarena' && e.id === 'arena_0');
    return a ? { x: a.x, z: a.z, rad: a.rad } : null;
  });
  check('existe la arena de la región 0', !!prep, JSON.stringify(prep));
  await teleport(prep.x, prep.z + 4); await ev(() => window.__step(30, 1 / 30)); await wait(10);
  const sealed = await ev(() => { const G = window.__G, a = G.map.ents.find((e) => e.id === 'arena_0'); return { st: window.__lair.status(a), prompt: G.prompt ? G.prompt.text : null, boss: G.enemies.filter((e) => e.boss && !e.dead).length }; });
  check('sin requisitos: la guarida está sellada, sin aviso de descenso y no sale el jefe', sealed.st === 'sealed' && !sealed.prompt && sealed.boss === 0, JSON.stringify(sealed));
  await ev(() => {
    const G = window.__G, S = G.S;
    S.lvl = 8; for (const q of ['m1', 'm2', 'm3']) S.quests.done[q] = Date.now(); window.__dbg.Quests.accept('m4');
    for (const [f, n] of [['elite', 3], ['nido', 2]]) { const R = S.bossGate.r[0] || (S.bossGate.r[0] = { n: {}, ids: [] }); R.n[f] = n; }
  });
  await teleport(prep.x, prep.z); await ev(() => window.__step(40, 1 / 30)); await wait(12);
  const open = await ev(() => { const G = window.__G, a = G.map.ents.find((e) => e.id === 'arena_0'); return { st: window.__lair.status(a), prompt: G.prompt ? G.prompt.text : null, boss: G.enemies.filter((e) => e.boss && !e.dead).length, altar: [...G.R.scene.children].some((c) => c.userData && c.userData.k === 'lairAltar') }; });
  console.log('altar', JSON.stringify(open));
  check('con misión, nivel y sellos: el altar está activo y la primera vez NO sale el jefe en el claro', open.st === 'open' && open.boss === 0 && open.altar, JSON.stringify(open));
  check('el aviso es «Descender a la guarida · Nido de la Matriarca»', /Descender a la guarida/.test(open.prompt || '') && /Nido de la Matriarca/.test(open.prompt || ''), open.prompt);
  await shot('altar-abierto');

  // C) descenso: mazmorra de guarida con guardián y puerta
  const down = await ev(() => {
    const G = window.__G, N = window.__Enc; G.world.interact(); window.__step(10, 1 / 30);
    const st = N.st, m = G.map, gate = st ? st.e.seal.filter((i) => m.ter[i] === window.__lair.gateKind).length : -1;
    return { mode: G.mode, lair: !!(G.op && G.op.lair), enc: st && st.enc, lvl: st && st.lvl, state: st && st.state, guardian: !!(st && st.guardian && !st.guardian.dead), gAlerted: st && st.guardian && st.guardian.alerted, gMini: st && st.guardian && st.guardian.mini, gName: st && st.guardian && st.guardian.name, sealTiles: st && st.e.seal.length, barrier: !!(st && st.barrier), packs: m.ents.filter((q) => q.k === 'spawnpack').length, reg: G.regionId };
  });
  console.log('descenso', JSON.stringify(down));
  check('«USAR» en el altar baja a la guarida (op de guarida, nivel del jefe, región 0)', down.mode === 'op' && down.lair && down.enc === 'lair' && down.lvl === 7 && down.reg === 0, JSON.stringify(down));
  check('hay un guardián (versión reducida del jefe) sin alertar, y la puerta de la arena está cerrada', down.guardian && !down.gAlerted && down.gMini && /Guardián de Reina/.test(down.gName) && down.barrier && down.sealTiles > 0, JSON.stringify(down));
  check('la antesala tiene manadas de guardianes', down.packs >= 2, `${down.packs}`);
  await shot('guarida-entrada');

  // D) guardián → puerta
  const gate = await ev(() => {
    const G = window.__G, N = window.__Enc, st = N.st, g = st.guardian;
    st.state = 'idle';
    g.hp = 0; g.kill({}); window.__step(10, 1 / 30);
    return { down: st.guardianDown, barrier: !!st.barrier, status: N.status().lines[0].t, target: N.target() && N.target().n, toasts: window.__toastLog.slice(-4) };
  });
  console.log('puerta', JSON.stringify({ down: gate.down, barrier: gate.barrier, status: gate.status, target: gate.target }));
  check('al abatir al guardián la puerta se abre y el objetivo pasa a «arena del jefe»', gate.down && !gate.barrier && /arena/i.test(gate.status) && gate.target === 'Arena del jefe', JSON.stringify(gate));

  // E) arena: el jefe de verdad con sus fases
  const arena = await ev(() => {
    const G = window.__G, N = window.__Enc, st = N.st; G.player.inv = 1e9;
    G.player.x = st.e.x; G.player.z = st.e.z + 3; window.__step(10, 1 / 30);
    const out = { state: st.state, barrier: !!st.barrier };
    window.__step(60, 1 / 30);   // 1,4 s hasta que aparece
    const b = st.boss; out.boss = !!b; if (b) { out.id = b.id; out.lvl = b.lvl; out.lair = b.lair; out.mini = !!b.mini; out.phase = b.phase; b.hp = b.maxHp * 0.6; window.__step(5, 1 / 30); out.phase2 = b.phase; }
    return out;
  });
  console.log('arena', JSON.stringify(arena));
  check('al entrar en la arena se cierra la puerta y tras 1,4 s aparece el jefe real (no el guardián) con sus fases', arena.state === 'active' && arena.barrier && arena.boss && arena.id === 'reina' && arena.lvl === 7 && arena.lair && !arena.mini && arena.phase2 === 2, JSON.stringify(arena));

  // F) primera muerte: todo lo que debe ocurrir
  const fin = await ev(() => {
    const G = window.__G, N = window.__Enc, st = N.st, b = st.boss, S = G.S;
    S.sig = S.sig || {}; const sig0 = (S.sig.reina | 0);
    S.quests.active.m4 && (S.quests.active.m4.prog[0] = 0);
    b.sig && (b.sig.lock = 0); b.invuln = false; b.hp = 0; b.kill({}); window.__step(30, 1 / 30);
    const chest = G.map.ents.find((e) => e.k === 'chest' && e.id === 'enc_chest');
    return { done: st.done, state: st.state, bosses: !!S.world.bosses.reg0, boss_t: !!S.world.bosses.reg0_t, lair: !!(S.world.lair && S.world.lair[0]), chest: chest ? chest.tier : null, sig: (S.sig.reina | 0) - sig0, quest: S.quests.active.m4 ? S.quests.active.m4.prog[0] : 'sin misión', barrier: !!st.barrier, gate: !!(S.world.gates && Object.keys(S.world.gates).length) };
  });
  console.log('primera muerte', JSON.stringify(fin));
  check('primera muerte: cuenta como jefe abatido, marca el cooldown de la guarida y la puerta queda abierta', fin.done && fin.bosses && fin.boss_t && fin.lair && !fin.barrier, JSON.stringify(fin));
  check('recompensas: cofre de nivel 3, Sigilo del jefe y avance de la misión «Regicidio»', fin.chest === 3 && fin.sig === 1 && fin.quest === 1, JSON.stringify({ chest: fin.chest, sig: fin.sig, quest: fin.quest }));
  await shot('guarida-conquistada');

  // G) salir: la superficie vuelve a ser normal (con cooldown de 30 min), la guarida queda en calma 45 min
  const out = await ev(() => {
    const G = window.__G; G.world.leaveSub(); window.__step(30, 1 / 30);
    const a = G.map.ents.find((e) => e.id === 'arena_0'), r = { mode: G.mode, st: window.__lair.status(a) };
    window.__step(90, 1 / 30); r.boss1 = G.enemies.filter((e) => e.boss && !e.dead).length;
    G.S.world.bosses.reg0_t = Date.now() - window.__GN.lost - 31 * 6e4;     // pasan 31 min (el cooldown de la superficie de antes): el claro NO debe invocar al jefe
    G.time += 25;      // el aviso del claro se limita a uno cada 20 s de juego
    G.player.x = a.x; G.player.z = a.z + 2; window.__step(60, 1 / 30);
    return r;
  });
  await new Promise((r) => setTimeout(r, 1800));      // (antes el jefe aparecía 1,2 s de RELOJ después de pisar la arena)
  Object.assign(out, await ev(() => { const G = window.__G; window.__step(30, 1 / 30); return { boss2: G.enemies.filter((e) => e.boss && !e.dead).length, toast: window.__toastLog.slice(-6) }; }));
  console.log('salida', JSON.stringify(out));
  check('de vuelta en el mundo la guarida está «en calma» y no sale el jefe', out.mode === 'world' && out.st === 'calm' && out.boss1 === 0, JSON.stringify(out));
  check('la superficie ya no invoca al jefe ni pasado el cooldown de 30 min: la guarida es la única vía (y avisa de que está en calma)', out.boss2 === 0 && out.toast.some((t) => /en calma/.test(t)), JSON.stringify(out.toast));
  const again = await ev(() => { const G = window.__G, a = G.map.ents.find((e) => e.id === 'arena_0'); G.enemies.forEach((e) => { if (e.boss && !e.dead) { e.dead = true; e.deadT = 0; } }); G.S.world.lair[0] = Date.now() - window.__GN.lost - 46 * 6e4; return { ready: window.__lair.ready(0), st: window.__lair.status(a) }; });
  check('a los 45 min la guarida se puede repetir', again.ready && again.st === 'open', JSON.stringify(again));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `FALLAN ${bad.length}/${results.length}` : `TODO OK ${results.length}/${results.length}`);
}
