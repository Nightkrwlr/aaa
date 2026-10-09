// D10b · Némesis (31i-surprises.js): el asesino asciende, se queda con tu botín, te caza, sube de rango y se abate
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/sorpresas-nemesis.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs, shot, page } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); window.__seedRng && window.__seedRng(5); window.__toastLog = []; window.__tl = () => window.__toastLog.concat([...document.querySelectorAll('#toasts .toast')].map((n) => n.textContent)); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.textContent && window.__toastLog.push(n.textContent)))).observe(document.querySelector('#toasts'), { childList: true }); });
  await api.region('valle');
  const spot = await ev(() => { const G = window.__G; const [sx, sz] = G.map.findFree(216, 150, 10, 0.8); return { x: sx, z: sz }; });
  await api.teleport(spot.x, spot.z);
  await ev(() => {
    const G = window.__G; G.S.lvl = 12; G.S.credits = 5000; G.S.mats.scrap = 100; G.S.mats.bio = 40; G.S.mats.crystal = 4; G.player.recalc();
    window.__t = {
      step(n) { window.__step(n, 1 / 30); },
      sweep() { for (const e of window.__G.enemies) if (!e.dead && !e.nemUid) { e.dead = true; e.deadT = 0; } },
      god(on) { const p = window.__G.player; p.inv = on ? 1e9 : 0; if (on) { if (!p._ws) p._ws = p.ws; p.ws = [null, null]; } else if (p._ws) { p.ws = p._ws; p._ws = null; } },
      // el jugador "muere" a manos de un enemigo concreto: el golpe mortal lleva su src, como el cuerpo a cuerpo real
      killBy(e) { const G = window.__G, p = G.player; window.__sx.N.born = -999; window.__sx.N.riseT = -99999; p.inv = 0; p.shield = 0; p.hp = 1; p.hurt(99999, { src: e, melee: true }); },
      revive() { const G = window.__G, p = G.player; if (G.uiOpen) window.__dbg.UI.close(); p.dead = false; p.rig.root.rotation.z = 0; p.rig.root.position.y = 0; p.hp = p.maxHp; G.paused = false; },
      N() { return window.__G.S.sx.nem; },
    };
  });
  const REG0 = await ev(() => { const G = window.__G; return G.regionId; });

  // 1) un rastrero te mata → asciende
  const r1 = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player; T.sweep(); T.god(false);
    const killer = window.__spawn('rastrero', 10, p.x + 1.2, p.z, { alerted: true });
    const c0 = G.S.credits; T.killBy(killer);
    const n = T.N().list[0];
    return { n: T.N().list.length, rank: n && n.rank, name: n && n.name, nameOk: n && G.cfg.nemesis.names.includes(n.name), mods: n && n.mods, id: n && n.id, loot: n && n.loot.cr, expect: Math.floor(c0 * 0.1), state: n && n.state, due: n && Math.round(n.due - G.S.playTime), dead: p.dead, deaths: T.N().deaths, lvl: n && n.lvl };
  });
  check('el enemigo que mata al jugador asciende a Némesis de rango 1 con nombre propio y aura roja', r1.n === 1 && r1.rank === 1 && r1.nameOk && r1.mods[0] === 'nemesis' && r1.id === 'rastrero', JSON.stringify(r1));
  check('se queda con los créditos que se pierden en el traslado (10 %)', r1.loot === r1.expect && r1.loot > 0, `${r1.loot} / ${r1.expect}`);
  check('tarda entre 2,5 y 4 min en encontrarte', r1.due >= 150 && r1.due <= 245 && r1.state === 'wait', JSON.stringify({ due: r1.due, state: r1.state }));

  // 2) el panel de muerte lo cuenta y reaparecer paga el tributo de materiales
  await page.waitForTimeout(2300);
  const pn = await ev(() => ({ open: window.__G.uiOpen, html: (document.querySelector('#panel .wbody') || {}).textContent || '' }));
  check('el panel de muerte dice quién te ha derrotado y que asciende', pn.open === 'death' && /te ha derrotado/.test(pn.html) && /rango 1/.test(pn.html) && /Abátelo para recuperarlo/.test(pn.html), pn.html.slice(0, 200));
  const rs = await ev(() => { const G = window.__G, S = G.S; const c0 = S.credits, m0 = { scrap: S.mats.scrap, bio: S.mats.bio, crystal: S.mats.crystal }; document.querySelector('#dRes').click(); return { c0, m0 }; });
  await page.waitForTimeout(600);
  const rs2 = await ev(() => { const G = window.__G, S = G.S, n = window.__t.N().list[0]; return { c1: S.credits, m1: { scrap: S.mats.scrap, bio: S.mats.bio, crystal: S.mats.crystal }, matsLoot: n.loot.mats, dead: G.player.dead, mode: G.mode }; });
  check('al reaparecer: −10 % de créditos y −6 % de cada material (tope 30), todo anotado en el botín del Némesis', rs2.c1 === rs.c0 - Math.floor(rs.c0 * 0.1) && rs2.m1.scrap === 94 && rs2.m1.bio === 38 && rs2.m1.crystal === 4 && rs2.matsLoot.scrap === 6 && rs2.matsLoot.bio === 2 && !rs2.dead, JSON.stringify({ rs, rs2 }));

  // 3) la caza: aparece cuando le toca, cerca del jugador, con sus modificadores
  await api.teleport(spot.x, spot.z);
  const h1 = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player; T.sweep(); T.god(true); const n = T.N().list[0]; n.due = G.S.playTime - 1; T.step(30);
    const e = window.__sx.N.live.get(n.uid);
    return e && { has: true, name: e.name, nemUid: e.nemUid === n.uid, mods: e.mods, elite: e.elite, d: Math.round(Math.hypot(e.x - p.x, e.z - p.z)), hpx: +(e.maxHp / (e.def.hp * window.__eco.mt.enemyHp(e.lvl) * window.__eco.Di[G.S.diff].hp * 3.2)).toFixed(2), persist: e.persist, state: n.state, lvl: e.lvl, banner: /NÉMESIS/.test(document.querySelector('#banner').textContent) };
  });
  check('cuando le toca, el Némesis aparece cerca del jugador con nombre, aura roja y vida reforzada', h1 && h1.has && h1.nemUid && h1.mods[0] === 'nemesis' && h1.elite === 0xff3050 && h1.d >= 15 && h1.d <= 40 && h1.hpx >= 1.55 && h1.persist && h1.state === 'hunt', JSON.stringify(h1));
  check('avisa con un banner y un mensaje', h1 && h1.banner && await ev(() => window.__tl().some((t) => /te ha encontrado/.test(t))));
  await shot('nemesis-caza');

  // 4) si el jugador se aleja demasiado se queda atrás y vuelve a buscarlo más tarde
  const lf = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player, n = T.N().list[0]; const e = window.__sx.N.live.get(n.uid);
    e.x = p.x + 130; e.z = p.z; T.step(30);
    return { live: window.__sx.N.live.size, state: n.state, dueIn: Math.round(n.due - G.S.playTime), dead: e.dead };
  });
  check('si se queda a más de 100 m desaparece y vuelve a buscarte pasado un tiempo', lf.live === 0 && lf.state === 'wait' && lf.dueIn > 60 && lf.dead, JSON.stringify(lf));

  // 5) sube de rango si te mata otra vez
  const rk = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player, n = T.N().list[0]; T.sweep(); n.due = G.S.playTime - 1; T.step(30);
    const e = window.__sx.N.live.get(n.uid); const lvl0 = n.lvl, mods0 = n.mods.length, loot0 = n.loot.cr; const c0 = G.S.credits;
    e.x = p.x + 1; e.z = p.z; T.god(false); T.killBy(e);
    return { rank: n.rank, lvl: n.lvl, lvl0, mods: n.mods.length, mods0, loot0, loot: n.loot.cr, expected: loot0 + Math.floor(c0 * 0.1), deaths: n.deaths, same: T.N().list.length };
  });
  check('si el Némesis te mata otra vez sube a rango 2 (nivel +1, más modificadores) y suma el nuevo tributo', rk.rank === 2 && rk.lvl === rk.lvl0 + 1 && rk.mods >= rk.mods0 && rk.loot === rk.expected && rk.deaths === 2 && rk.same === 1, JSON.stringify(rk));
  await page.waitForTimeout(2300);
  await ev(() => { document.querySelector('#dRes') && document.querySelector('#dRes').click(); });
  await page.waitForTimeout(600);
  await api.teleport(spot.x, spot.z);

  // 6) abatirlo devuelve lo robado con intereses
  const sl = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player, n = T.N().list[0]; T.revive(); T.sweep(); T.god(true); n.due = G.S.playTime - 1; T.step(30);
    const e = window.__sx.N.live.get(n.uid); const lootCr = n.loot.cr, lootMats = { ...n.loot.mats }; const pk0 = G.pickups.length; const xp0 = G.S.xp;
    e.x = p.x + 6; e.z = p.z;
    e.kill({});
    const crPk = G.pickups.slice(pk0).filter((q) => q.k === 'cr'); const crSum = crPk.reduce((a, q) => a + q.val, 0);
    const matPk = G.pickups.slice(pk0).filter((q) => q.k === 'mat');
    return { crSum: Math.round(crSum), expect: Math.round(lootCr * 1.25), nCr: crPk.length, mats: matPk.map((q) => [q.mat, q.val]), lootMats, left: T.N().list.length, slain: T.N().slain, live: window.__sx.N.live.size, extra: G.pickups.length - pk0, banner: /NÉMESIS ABATIDO/.test(document.querySelector('#banner').textContent) };
  });
  check('abatir al Némesis suelta los créditos robados ×1,25 (más lo que traiga la tabla de botín) y los materiales', sl.crSum >= sl.expect - 2 && sl.crSum <= sl.expect + 600 && sl.nCr >= 4 && sl.mats.length >= 2, JSON.stringify(sl));
  check('y lo saca de la lista, cuenta la victoria y lo anuncia', sl.left === 0 && sl.slain === 1 && sl.live === 0 && sl.banner, JSON.stringify({ left: sl.left, slain: sl.slain }));

  // 7) reglas: sin farmeo, jefes y torretas no ascienden, tope de tres
  const rl = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player, out = {}; T.sweep(); T.revive(); T.god(false);
    const n0 = T.N().list.length;
    // a) muerte demasiado pronto tras reaparecer
    window.__sx.N.born = G.time; window.__sx.N.riseT = -99999; let k = window.__spawn('rastrero', 10, p.x + 1, p.z, { alerted: true }); p.inv = 0; p.shield = 0; p.hp = 1; p.hurt(99999, { src: k }); out.tooSoon = T.N().list.length - n0; T.revive(); T.sweep();
    // b) un jefe no asciende
    window.__sx.N.born = -999; k = window.__spawn('reina', 10, p.x + 1, p.z, { boss: true, alerted: true }); p.inv = 0; p.shield = 0; p.hp = 1; p.hurt(99999, { src: k }); out.boss = T.N().list.length - n0; T.revive(); T.sweep();
    // c) una torreta (estática) tampoco
    k = window.__spawn('torreta', 10, p.x + 3, p.z, { alerted: true }); p.inv = 0; p.shield = 0; p.hp = 1; p.hurt(99999, { src: k }); out.turret = T.N().list.length - n0; T.revive(); T.sweep();
    // d) ascensos encadenados: el segundo, sin esperar el enfriamiento, no cuenta
    window.__sx.N.born = -999; window.__sx.N.riseT = -99999; k = window.__spawn('rastrero', 10, p.x + 1, p.z, { alerted: true }); p.inv = 0; p.shield = 0; p.hp = 1; p.hurt(99999, { src: k }); const a = T.N().list.length - n0; T.revive(); T.sweep();
    window.__sx.N.born = -999; k = window.__spawn('mantis', 10, p.x + 1, p.z, { alerted: true }); p.inv = 0; p.shield = 0; p.hp = 1; p.hurt(99999, { src: k }); out.chained = [a, T.N().list.length - n0]; T.revive(); T.sweep();
    return out;
  });
  check('sin farmeo: morir justo tras reaparecer, o dos ascensos seguidos, no crea otro Némesis', rl.tooSoon === 0 && rl.chained[0] === 1 && rl.chained[1] === 1, JSON.stringify(rl));
  check('los jefes y las torretas no ascienden', rl.boss === 0 && rl.turret === 0, JSON.stringify(rl));
  const cap = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player; T.sweep(); T.revive();
    for (const id of ['saltador', 'avispa', 'escupidor', 'larva']) { window.__sx.N.born = -999; window.__sx.N.riseT = -99999; const k = window.__spawn(id, 10, p.x + 1, p.z, { alerted: true }); p.inv = 0; p.shield = 0; p.hp = 1; p.hurt(99999, { src: k }); T.revive(); T.sweep(); }
    return { n: T.N().list.length, max: G.cfg.nemesis.listMax, ranks: T.N().list.map((q) => q.rank), ids: T.N().list.map((q) => q.id) };
  });
  check('como mucho tres Némesis a la vez (cede el más flojo)', cap.n === cap.max, JSON.stringify(cap));

  // 8) el Tablón ofrece un contrato por cada Némesis vivo y se completa al abatirlo
  const ct = await ev(() => {
    const T = window.__t, G = window.__G, q = G.S.sx; const b = window.__dbg.Quests.board(); const ids = b.list.filter((c) => c.sx && /^sx_nem/.test(c.id)).map((c) => c.id);
    const n = T.N().list[0]; const c = b.list.find((c) => c.id === 'sx_nem' + n.uid); if (!c) return { ids, n: T.N().list.length };
    window.__dbg.Quests.accept(c.id, c);
    const a = G.S.quests.active[c.id]; const txt = window.__dbg.Quests.objText(c.obj[0], 0);
    T.sweep(); T.god(true); n.due = G.S.playTime - 1; T.step(30);
    const e = window.__sx.N.live.get(n.uid); e.x = G.player.x + 6; e.z = G.player.z; e.kill({});
    const done = window.__dbg.Quests.complete(c.id, G.S.quests.active[c.id]);
    const b2 = window.__dbg.Quests.board();
    return { ids, accepted: !!a, txt, done, gone: !b2.list.some((q) => q.id === c.id), prog: G.S.quests.active[c.id] && G.S.quests.active[c.id].prog[0] };
  });
  check('el Tablón ofrece un contrato «Cazar a …» por Némesis, se acepta, avanza al abatirlo y se retira', ct.ids && ct.ids.length === 3 && ct.accepted && /Némesis abatido/.test(ct.txt) && ct.done && ct.gone, JSON.stringify(ct));

  // 9) persistencia: el estado sobrevive a un viaje de ida y vuelta por JSON y la caza se retoma
  const ps = await ev(() => {
    const G = window.__G, T = window.__t; const snap = JSON.parse(JSON.stringify(G.S.sx.nem)); const n = snap.list[0];
    return { n: snap.list.length, keys: Object.keys(n), okKeys: ['uid', 'id', 'name', 'lvl', 'rank', 'mods', 'loot', 'due', 'state'].every((k) => k in n) };
  });
  check('el estado del Némesis es serializable y completo (se guarda con la partida)', ps.n >= 1 && ps.okKeys, JSON.stringify(ps));

  const bad = results.filter((r) => !r.ok);
  console.log(`\nRESULTADO sorpresas-nemesis: ${results.length - bad.length}/${results.length}`);
  if (bad.length) console.log('FALLOS: ' + bad.map((r) => r.name).join(' | '));
  else console.log('TODO OK ' + results.length + '/' + results.length);
}
