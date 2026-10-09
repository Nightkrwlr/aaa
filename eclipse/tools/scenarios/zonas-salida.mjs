// D12 · salida tranquila de las zonas (31e2-zonas.js): al salir de un sótano/operación no hay manadas junto a la salida durante la gracia,
// las manadas del lugar esperan, las despejadas no reaparecen y el spawner ambiental tarda
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/zonas-salida.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, teleport } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });

  // escalera de la región 0 con una manada de mundo a menos de 14 casillas (como los edificios)
  const site = await ev(() => {
    const G = window.__G, ents = G.map.ents, out = [];
    for (const s of ents) {
      if (s.k !== 'stairs' || s.reg !== 0) continue;
      const near = ents.filter((e) => e.k === 'spawnpack' && Math.hypot(e.x - s.x, e.z - s.z) < 14);
      if (near.length) out.push({ id: s.id, x: s.x, z: s.z, packs: near.map((e) => e.id), d: Math.min(...near.map((e) => Math.hypot(e.x - s.x, e.z - s.z))) });
    }
    out.sort((a, b) => a.d - b.d);
    return out[0] || null;
  });
  check('hay una escalera de la región 0 con una manada del mundo a menos de 14 casillas', !!site, JSON.stringify(site));
  if (!site) return results;

  // utilidades dentro de la página
  await ev(() => {
    window.__t = {
      near(r) { const G = window.__G, p = G.player; return G.enemies.filter((e) => !e.dead && e.id !== 'nido' && Math.hypot(e.x - p.x, e.z - p.z) < r).length; },
      stairs(id) { return window.__G.map.ents.find((e) => e.id === id); },
      pack(id) { const o = window.__G.world.rt.get(id); return o ? { spawned: !!o.spawned, held: !!o.held, n: o.pack ? o.pack.filter((e) => !e.dead).length : 0, cleared: !!o.clearedAt } : null; },
      go(site) { const G = window.__G, e = window.__t.stairs(site.id); G.player.x = e.x + 1.5; G.player.z = e.z; G.world.enterSub(e); window.__step(30, 1 / 30); },
      back() { window.__G.world.leaveSub(); },
    };
  });

  // A) CONTROL: sin gracia (graceS = 0) las manadas del lugar aparecen en cuanto se sale (el comportamiento antiguo)
  const ctrl = await ev((site) => {
    const G = window.__G, Z = window.__zonas, T = window.__t;
    Z.cfg.exit.graceS = 0;
    G.S.world.packs = {};
    G.player.x = G.map.ents.find((e) => e.id === site.id).x + 1.5; G.player.z = G.map.ents.find((e) => e.id === site.id).z;
    G.world.check(true); window.__step(10, 1 / 30);
    for (const e of G.enemies.slice()) { e.dead = true; e.deadT = 0; }
    window.__step(5, 1 / 30);
    T.go(site); T.back(); window.__step(15, 1 / 30);
    return { near: T.near(20), packs: site.packs.map((id) => T.pack(id)), grace: Z.grace() };
  }, site);
  check('control (gracia 0): al salir aparecen enemigos junto a la salida', ctrl.near >= 2, JSON.stringify(ctrl));

  // B) CON gracia: al salir no hay nadie cerca y las manadas del lugar quedan retenidas
  const A = await ev((site) => {
    const G = window.__G, Z = window.__zonas, T = window.__t;
    Z.cfg.exit.graceS = 30; Z.ZN.held = 0;
    for (const e of G.enemies.slice()) { e.dead = true; e.deadT = 0; }
    G.S.world.packs = {};
    G.world.rt.forEach((o) => { if (o.e.k === 'spawnpack') { o.spawned = false; o.pack = null; o.clearedAt = 0; o.held = false; } });
    window.__step(5, 1 / 30);
    T.go(site); T.back();
    const out = { t0: T.near(24), grace: Z.grace() };
    window.__step(30, 1 / 30); out.t1 = T.near(24);
    window.__step(30 * 8, 1 / 30); out.t9 = T.near(24);
    window.__step(30 * 15, 1 / 30); out.t24 = T.near(24); out.held = Z.ZN.held; out.packs = site.packs.map((id) => T.pack(id));
    out.packCd = window.__dbg.Spawner.packCd;
    return out;
  }, site);
  check('al salir hay calma: ningún enemigo a 24 casillas durante los primeros 24 s', A.t0 === 0 && A.t1 === 0 && A.t9 === 0 && A.t24 === 0, JSON.stringify(A));
  check('la gracia está activa y las manadas del lugar se quedan retenidas', A.grace && A.grace.t > 20 && A.held > 0 && A.packs.every((p) => p && !p.spawned), JSON.stringify({ g: A.grace, held: A.held, packs: A.packs }));

  // C) pasada la gracia: sin manadas ambientales de golpe, y las retenidas solo aparecen con el jugador a distancia
  const B = await ev((site) => {
    const G = window.__G, Z = window.__zonas, T = window.__t, e = T.stairs(site.id);
    const out = { graceBefore: !!Z.grace() };
    window.__step(30 * 8, 1 / 30); // 32 s desde la salida: acaba la gracia
    out.graceAfter = !!Z.grace(); out.nearAtEnd = T.near(11);
    // el jugador se queda junto a la manada retenida: no aparece (minSpawn)
    window.__step(30 * 6, 1 / 30);
    out.stillHeld = site.packs.map((id) => T.pack(id));
    // se aleja 16 casillas y vuelve a mirar: ahora sí aparece
    const p = G.player; const ox = p.x, oz = p.z;
    const f = G.map.findFree(e.x + 16, e.z, 6, 0.4); p.x = f[0]; p.z = f[1];
    G.world.check(true); window.__step(30 * 2, 1 / 30);
    out.later = site.packs.map((id) => T.pack(id));
    out.d = Math.hypot(p.x - e.x, p.z - e.z);
    return out;
  }, site);
  check('termina la gracia y sigue sin haber enemigos a menos de 11 casillas', !B.graceAfter && B.nearAtEnd === 0, JSON.stringify({ b: B.graceBefore, a: B.graceAfter, near: B.nearAtEnd }));
  check('una manada retenida no aparece sobre el jugador (minSpawn)', B.stillHeld.some((p) => p && !p.spawned), JSON.stringify(B.stillHeld));
  check('al alejarse, la manada del lugar aparece con normalidad', B.later.some((p) => p && p.spawned), JSON.stringify({ later: B.later, d: B.d.toFixed(1) }));

  // D) manadas despejadas: no reaparecen al volver de una zona ni al guardarse
  const C = await ev((site) => {
    const G = window.__G, Z = window.__zonas, T = window.__t, e = T.stairs(site.id);
    Z.cfg.exit.graceS = 0; // aquí se mide solo la persistencia
    G.S.world.packs = {};
    for (const en of G.enemies.slice()) { en.dead = true; en.deadT = 0; }
    G.world.rt.forEach((o) => { if (o.e.k === 'spawnpack') { o.spawned = false; o.pack = null; o.clearedAt = 0; o.held = false; } });
    G.player.x = e.x + 1.5; G.player.z = e.z; G.world.check(true); window.__step(10, 1 / 30);
    const id = site.packs[0], o = G.world.rt.get(id);
    const out = { spawned: !!o.spawned, n0: o.pack ? o.pack.length : 0 };
    for (const en of (o.pack || [])) { en.dead = true; en.deadT = 0; }
    window.__step(60, 1 / 30); // el check marca clearedAt y el tick lo guarda
    out.cleared = !!o.clearedAt; out.saved = G.S.world.packs[id] || 0; out.savedOk = G.S.world.packs[id] === o.clearedAt;
    T.go(site); T.back(); window.__step(60, 1 / 30);
    const o2 = G.world.rt.get(id);
    out.after = T.pack(id); out.alive = o2.pack ? o2.pack.filter((q) => !q.dead).length : 0;
    // una recarga completa (otro objeto rt) tampoco la regenera
    G.world.rt.clear(); G.world.check(true); window.__step(30, 1 / 30);
    out.reload = T.pack(id);
    return out;
  }, site);
  check('la manada del lugar aparece, se despeja y se anota en S.world.packs', C.spawned && C.n0 >= 3 && C.cleared && C.savedOk && C.saved > 0, JSON.stringify(C));
  check('despejada: no reaparece al volver de la zona', C.after && C.alive === 0, JSON.stringify(C.after));
  check('despejada: tampoco tras descartar el estado del mundo (como al recargar)', C.reload && C.reload.n === 0, JSON.stringify(C.reload));

  // E) el guardado sobrevive a una migración y a una partida antigua sin S.world.packs
  const M = await ev(() => {
    const G = window.__G; delete G.S.world.packs;
    G.migrations && G.migrations.forEach((f) => f(G.S));
    return { has: !!G.S.world.packs, type: typeof G.S.world.packs };
  });
  check('una partida antigua (sin S.world.packs) se migra', M.has, JSON.stringify(M));

  const f = results.filter((r) => !r.ok);
  console.log(f.length ? 'FALLOS: ' + f.map((q) => q.name).join(' | ') : `TODO OK ${results.length}/${results.length}`);
  return results;
}
