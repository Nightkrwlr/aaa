// D10c · Santuarios de pacto (31i-surprises.js): ofertas deterministas, panel, estadísticas, maldiciones de sistema, caducidad y límites
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/sorpresas-pacto.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs, shot, page } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); window.__seedRng && window.__seedRng(9); window.__toastLog = []; window.__tl = () => window.__toastLog.concat([...document.querySelectorAll('#toasts .toast')].map((n) => n.textContent)); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.textContent && window.__toastLog.push(n.textContent)))).observe(document.querySelector('#toasts'), { childList: true }); });
  await ev(() => {
    const G = window.__G; G.S.lvl = 14; G.player.recalc();
    window.__t = {
      step(n) { window.__step(n, 1 / 30); },
      sweep() { for (const e of window.__G.enemies) if (!e.dead) { e.dead = true; e.deadT = 0; } },
      god(on) { const p = window.__G.player; p.inv = on ? 1e9 : 0; },
      shrines() { return window.__G.map.ents.filter((e) => e.k === 'shrine'); },
      P() { return window.__G.S.sx.pact; },
    };
  });
  await api.region('valle');

  // 1) un santuario de pacto por región (el tercero), los otros dos siguen siendo reliquias xeno
  const sh = await ev(() => {
    const T = window.__t, G = window.__G, all = T.shrines(); const byReg = {};
    for (const e of all) (byReg[e.reg] = byReg[e.reg] || []).push({ id: e.id, pact: window.__sx.pact.isShrine(e) });
    return { total: all.length, byReg, pacts: all.filter((e) => window.__sx.pact.isShrine(e)).length, regs: Object.keys(byReg).length };
  });
  check('hay un santuario de pacto por región (shrine_<región>_2) y el resto sigue como reliquia xeno', sh.pacts >= 8 && sh.pacts <= sh.regs && Object.values(sh.byReg).every((l) => l.filter((q) => q.pact).every((q) => /_2$/.test(q.id)) && l.some((q) => !q.pact)), JSON.stringify({ pacts: sh.pacts, regs: sh.regs, total: sh.total }));

  // 2) ofertas deterministas: mismas por santuario y ciclo, distintas entre ciclos y santuarios, coherentes
  const of = await ev(() => {
    const A = window.__sx.pact, ids = window.__t.shrines().filter((e) => A.isShrine(e)).map((e) => e.id);
    const a1 = A.offers(ids[0], 5), a2 = A.offers(ids[0], 5), b = A.offers(ids[0], 6), c = A.offers(ids[1], 5);
    const ok = (o) => o.length === 3 && new Set(o.map((q) => q.b)).size === 3 && o.every((q) => A.byB[q.b] && A.byC[q.c] && A.byB[q.b].fam !== A.byC[q.c].fam);
    // exploración: 300 ofertas, ninguna pareja incoherente
    let bad = 0; for (let i = 0; i < 100; i++) for (const id of ids) if (!ok(A.offers(id, i))) bad++;
    return { same: JSON.stringify(a1) === JSON.stringify(a2), diffCycle: JSON.stringify(a1) !== JSON.stringify(b), diffShrine: JSON.stringify(a1) !== JSON.stringify(c), valid: ok(a1), bad, sample: a1 };
  });
  check('las ofertas salen de un hash del santuario y el ciclo: estables, distintas entre ciclos y santuarios', of.same && of.diffCycle && of.diffShrine, JSON.stringify(of.sample));
  check('cada oferta tiene tres poderes distintos y ninguna maldición anula su poder (900 combinaciones revisadas)', of.valid && of.bad === 0, `incoherentes ${of.bad}`);

  // 3) delante de un santuario: aviso, panel, tres tratos
  const spot = await ev(() => { const G = window.__G, e = G.map.ents.find((q) => q.id === 'shrine_0_2'); return e ? { x: e.x, z: e.z, id: e.id } : null; });
  check('el mapa tiene el santuario de pacto de la primera región', !!spot);
  await api.teleport(spot.x + 1.8, spot.z);
  await ev(() => { window.__t.sweep(); window.__t.god(true); window.__t.step(20); });
  const pr = await ev(() => { const G = window.__G; G.world.updatePrompt(); return { prompt: G.prompt && G.prompt.text, hasR: !!(G.prompt && G.prompt.r) }; });
  check('al acercarse aparece «Hacer un pacto»', /Hacer un pacto/.test(pr.prompt || ''), pr.prompt);
  const op = await ev(() => { const G = window.__G; G.world.interact(); return { ui: G.uiOpen, cards: document.querySelectorAll('#panel [data-seal]').length, paused: G.paused, txt: (document.querySelector('#panel .wbody') || {}).textContent.slice(0, 300) }; });
  check('USAR abre el panel «Santuario de pacto» con tres tratos', op.ui === 'pact' && op.cards === 3 && op.paused, op.txt);
  await shot('pacto-panel');

  // 4) sellar el primero: estadísticas del poder y de la maldición aplicadas, aviso, etiqueta del HUD
  const sl = await ev(() => {
    const G = window.__G, A = window.__sx.pact, p = G.player, offers = A.offers('shrine_0_2', A.cycle()); const o = offers[0], b = A.byB[o.b], c = A.byC[o.c];
    const keys = [...new Set([...Object.keys(b.st || {}), ...Object.keys(c.st || {})])]; const before = {}; for (const k of keys) before[k] = p.st[k] || 0;
    document.querySelector('#panel [data-seal="0"]').click();
    const after = {}; for (const k of keys) after[k] = p.st[k] || 0;
    const exp = {}; for (const k of keys) exp[k] = (b.st && b.st[k] || 0) + (c.st && c.st[k] || 0);
    const P = G.S.sx.pact; window.__t.step(10);
    return { o, ui: G.uiOpen, n: P.act.length, until: Math.round(P.act[0].until - G.S.playTime), deltas: Object.fromEntries(keys.map((k) => [k, +(after[k] - before[k]).toFixed(3)])), exp, toast: window.__tl().some((t) => /Pacto sellado/.test(t)), pill: (document.querySelector('#sxBar .pact0') || {}).textContent };
  });
  check('sellar un pacto cierra el panel y aplica poder y maldición a las estadísticas', sl.ui === null && sl.n === 1 && Object.keys(sl.exp).every((k) => Math.abs(sl.deltas[k] - sl.exp[k]) < 1e-6) || (sl.n === 1 && !sl.ui && Object.keys(sl.exp).length === 0), JSON.stringify({ o: sl.o, deltas: sl.deltas, exp: sl.exp }));
  check('dura 20 min de juego, avisa y deja una etiqueta en el HUD', sl.until >= 1195 && sl.until <= 1200 && sl.toast && /⇄/.test(sl.pill || ''), `${sl.until} s · ${sl.pill}`);

  // 5) el santuario no vuelve a hablar en este ciclo; con el ciclo siguiente sí
  const used = await ev(() => {
    const G = window.__G, A = window.__sx.pact, e = G.map.ents.find((q) => q.id === 'shrine_0_2'); const ready1 = A.ready(e);
    G.world.updatePrompt(); const txt = G.prompt && G.prompt.text;
    const again = A.seal(e, A.offers(e.id, A.cycle())[1]);
    G.S.playTime = (A.cycle() + 1) * G.cfg.pact.cycleS + 1; window.__t.step(5);
    return { ready1, txt, again, ready2: A.ready(e), n: G.S.sx.pact.act.length };
  });
  check('un santuario se usa una vez por ciclo (30 min): después guarda silencio', !used.ready1 && /guarda silencio/.test(used.txt || '') && used.again === false && used.ready2, JSON.stringify(used));

  // 6) límite de dos pactos activos (el tercero rompe el más antiguo) y caducidad
  const lim = await ev(() => {
    const G = window.__G, A = window.__sx.pact, ents = window.__t.shrines().filter((e) => A.isShrine(e)); const P = G.S.sx.pact; const out = {};
    P.act.length = 0; P.used = {};
    const mk = (e) => A.seal(e, A.offers(e.id, A.cycle())[0]);
    mk(ents[0]); mk(ents[1]); out.two = P.act.length; const first = P.act[0].from;
    mk(ents[2]); out.three = P.act.length; out.brokeOldest = !P.act.some((a) => a.from === first) && P.act.length === 2;
    // caducidad
    const t0 = G.S.playTime; P.act[0].until = t0 + 1; window.__t.step(60); out.afterExpire = P.act.length; out.toast = window.__tl().some((t) => /se acaba/.test(t));
    P.act.length = 0; G.player.recalc();
    return out;
  });
  check('como mucho dos pactos a la vez: el tercero rompe el más antiguo', lim.two === 2 && lim.three === 2 && lim.brokeOldest, JSON.stringify(lim));
  check('un pacto caduca a su hora, avisa y desaparece con su maldición', lim.afterExpire === 1 && lim.toast, JSON.stringify(lim));

  // 7) maldiciones de sistema: enemigos con más vida/daño y élites el doble de veces
  const sys = await ev(() => {
    const G = window.__G, A = window.__sx.pact, p = G.player, T = window.__t; const e0 = G.map.ents.find((q) => q.id === 'shrine_0_2'); const P = G.S.sx.pact; P.act.length = 0; P.used = {}; const seal = (o) => { P.used = {}; return A.seal(e0, o); };
    T.sweep(); p.x = e0.x + 3; const mk = () => window.__spawn('rastrero', 10, p.x + 5, p.z, { alerted: false });
    const base = mk(); const bHp = base.maxHp, bDmg = base.dmg; base.dead = true; base.deadT = 0;
    seal({ b: 'furia', c: 'manada' }); const a = mk(); const hpUp = +(a.maxHp / bHp).toFixed(3); a.dead = true; a.deadT = 0;
    A.brk(0, 'manual'); seal({ b: 'furia', c: 'contagio' }); const b = mk(); const dmgUp = +(b.dmg / bDmg).toFixed(3); const hpSame = +(b.maxHp / bHp).toFixed(3); b.dead = true; b.deadT = 0;
    A.brk(0, 'manual');
    const boss = window.__spawn('reina', 10, p.x + 8, p.z, { boss: true }); const bossHp0 = boss.maxHp; boss.dead = true; boss.deadT = 0;
    seal({ b: 'furia', c: 'manada' }); const boss2 = window.__spawn('reina', 10, p.x + 8, p.z, { boss: true }); const bossSame = boss2.maxHp === bossHp0; boss2.dead = true; boss2.deadT = 0;
    A.brk(0, 'manual');
    // élites: 400 manadas de evento sin y con «Marcado»
    const count = () => { let n = 0; for (let i = 0; i < 400; i++) { const l = G.map.regAt(p.x, p.z); const pk = window.__Spawner.spawnPack(l, null, { event: true, alerted: false }); if (pk.some((q) => q.elite)) n++; for (const q of pk) { q.dead = true; q.deadT = 0; } } return n; };
    window.__seedRng(31); const e1 = count(); seal({ b: 'furia', c: 'marcado' }); window.__seedRng(31); const e2 = count(); A.brk(0, 'manual');
    return { hpUp, dmgUp, hpSame, bossSame, elites: [e1, e2], mul: A.sys('eliteMul') };
  });
  check('«Rastro de sangre»: los enemigos nuevos tienen +20 % de vida (los jefes no)', sys.hpUp === 1.2 && sys.bossSame, JSON.stringify(sys));
  check('«Furia contagiosa»: +15 % de daño de los enemigos nuevos', sys.dmgUp === 1.15 && sys.hpSame === 1, JSON.stringify(sys));
  check('«Marcado»: las manadas llevan élites el doble de veces', sys.elites[1] > sys.elites[0] * 1.5, `sin ${sys.elites[0]} · con ${sys.elites[1]} de 400`);

  // 8) romper un pacto desde el panel
  const br = await ev(() => {
    const G = window.__G, A = window.__sx.pact, e0 = G.map.ents.find((q) => q.id === 'shrine_0_2'); const P = G.S.sx.pact; P.act.length = 0; P.used = {};
    A.seal(e0, A.offers(e0.id, A.cycle())[2]); G.world.interact && 0; A.open(e0); const brk = document.querySelector('#panel [data-brk]'); const had = !!brk; brk && brk.click();
    return { had, n: P.act.length, ui: G.uiOpen };
  });
  check('el panel permite romper un pacto activo', br.had && br.n === 0 && br.ui === 'pact', JSON.stringify(br));
  await ev(() => { window.__dbg.UI.close(); });

  // 9) el contrato «Un trato con la oscuridad» del Tablón se cumple al sellar un pacto
  const ct = await ev(() => {
    const G = window.__G, A = window.__sx.pact, Q = window.__dbg.Quests; const P = G.S.sx.pact; P.act.length = 0; P.used = {};
    const b = Q.board(); const c = b.list.find((q) => q.sx && /^sx_pact/.test(q.id)); if (!c) return { found: false, ids: b.list.map((q) => q.id) };
    Q.accept(c.id, c); const e0 = G.map.ents.find((q) => q.id === 'shrine_0_2'); A.seal(e0, A.offers(e0.id, A.cycle())[0]);
    const done = Q.complete(c.id, G.S.quests.active[c.id]); const txt = Q.objText(c.obj[0], 1);
    const cr0 = G.S.credits; Q.turnIn(c.id); const paid = G.S.credits - cr0;
    P.act.length = 0; G.player.recalc();
    return { found: true, done, txt, paid, reward: c.rew.credits };
  });
  check('el contrato del Tablón avanza al sellar un pacto y paga al cobrarlo', ct.found && ct.done && /Pactos sellados: 1\/1/.test(ct.txt) && ct.paid >= ct.reward, JSON.stringify(ct));

  const bad = results.filter((r) => !r.ok);
  console.log(`\nRESULTADO sorpresas-pacto: ${results.length - bad.length}/${results.length}`);
  if (bad.length) console.log('FALLOS: ' + bad.map((r) => r.name).join(' | '));
  else console.log('TODO OK ' + results.length + '/' + results.length);
}
