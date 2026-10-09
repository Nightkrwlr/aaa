// el jefe de región ya no aparece al pisar su arena: exige misión, nivel y sellos (31g-bosses.js)
export default async function (api) {
  const { boot, newGame, ev, wait, shot, page, logs, teleport, god } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame(); await god();
  // los avisos duran 3,8 s y el GL por software es lento: se registran todos los que aparecen
  await ev(() => { window.__toastLog = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.textContent && window.__toastLog.push(n.textContent)))).observe(document.querySelector('#toasts'), { childList: true }); });
  const B = () => ev(() => ({ boss: window.__G.enemies.filter((e) => e.boss && !e.dead).length, toasts: window.__toastLog.slice() }));
  const real = (ms) => new Promise((r) => setTimeout(r, ms));

  // 0) estado inicial
  const st0 = await ev(() => window.__bossGate.status(0));
  check('partida nueva: guarda S.bossGate v1', await ev(() => window.__G.S.bossGate?.v === 1));
  check('región 0: faltan misión, nivel y sellos', !st0.ok && !st0.questOk && !st0.lvlOk && !st0.sealOk, JSON.stringify({ q: st0.quest, min: st0.minLvl, have: st0.have, need: st0.need }));
  check('la misión del jefe de la región 0 es m4 (Regicidio)', st0.quest === 'm4');
  const quests = await ev(() => Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => [r, window.__bossGate.status(r).quest])));
  check('cada región tiene su misión de jefe', Object.values(quests).every(Boolean), JSON.stringify(quests));

  // 1) pisar la arena sellada: NO sale el jefe y avisa
  const arena = await ev(() => { const a = window.__G.map.ents.find((e) => e.k === 'bossarena' && e.id === 'arena_0'); return a ? { x: a.x, z: a.z, rad: a.rad } : null; });
  check('existe la arena de la región 0', !!arena, JSON.stringify(arena));
  await teleport(arena.x, arena.z); await ev(() => window.__step(60, 1 / 30)); await wait(6); await real(1800); await ev(() => window.__step(30, 1 / 30));
  let b = await B();
  check('arena sellada: el jefe NO aparece al pisarla', b.boss === 0, `jefes vivos ${b.boss}`);
  check('avisa de que la guarida está sellada y de lo que falta', b.toasts.some((t) => /sellada/.test(t) && /misión|nivel|sellos/.test(t)), b.toasts.join(' | ').slice(0, 200));
  const txt = await ev(() => window.__bossGate.text('reina'));
  check('la línea de la misión del jefe enseña los requisitos', /guarida sellada/.test(txt), txt);
  await shot('arena-sellada');

  // 2) cumplir requisitos de uno en uno
  await ev(() => { window.__G.S.lvl = 4; });
  let s = await ev(() => window.__bossGate.status(0));
  check('con el nivel pero sin misión ni sellos: sigue sellada', !s.ok && s.lvlOk && !s.questOk);
  await ev(() => { const S = window.__G.S; for (const q of ['m1', 'm2', 'm3']) S.quests.done[q] = Date.now(); window.__dbg.Quests.accept('m4'); });
  s = await ev(() => window.__bossGate.status(0));
  check('con nivel y misión pero sin sellos: sigue sellada', !s.ok && s.lvlOk && s.questOk && !s.sealOk, `sellos ${s.have}/${s.need}`);
  await ev(() => window.__step(60, 1 / 30)); await real(1800); await ev(() => window.__step(30, 1 / 30));
  b = await B(); check('sin sellos tampoco aparece el jefe', b.boss === 0);

  // 3) las fuentes de sellos (eventos reales del juego)
  await ev(() => { window.__G.S.bossGate = { v: 1, r: {} }; });
  const src = await ev(() => {
    const G = window.__G, E = window.__bossGate.emit, out = {};
    const here = (fn) => { const before = window.__bossGate.seals(0); fn(); return window.__bossGate.seals(0) - before; };
    const p = G.player;
    out.elite = here(() => E('kill', { elite: true, x: p.x, z: p.z }));
    out.nido = here(() => E('kill', { ent: { k: 'nest', id: 'nest_test' }, x: p.x, z: p.z }));
    out.jefe_no_cuenta = here(() => E('kill', { boss: true, elite: true, x: p.x, z: p.z }));
    out.lore = here(() => E('lore', { lid: 'lib_test', reg: 0 }));
    out.lore_repetido = here(() => E('lore', { lid: 'lib_test', reg: 0 }));
    out.encargo = here(() => E('questDone', { n: 'Plaga en los cultivos', giver: 'tomas', main: false }, { xp: 0, credits: 0, items: [] }));
    out.principal_no_cuenta = here(() => E('questDone', { n: 'Primer contacto', giver: 'reyes', main: true }, { xp: 0, credits: 0, items: [] }));
    out.puzle = here(() => E('puzzleSolved', { id: 'pz_test', reg: 0 }));
    out.terminal = here(() => window.__dbg.Quests.onHack({ reg: 0, id: 'term_0_test' }));
    out.otra_region = (() => { const before = window.__bossGate.seals(1); E('lore', { lid: 'lib_otra', reg: 1 }); return window.__bossGate.seals(1) - before; })();
    return out;
  });
  console.log(JSON.stringify(src));
  check('élite abatida suma 1', src.elite === 1);
  check('nido destruido suma 1', src.nido === 1);
  check('un jefe abatido no suma sellos', src.jefe_no_cuenta === 0);
  check('registro del Archivo suma 1 y no se cuenta dos veces', src.lore === 1 && src.lore_repetido === 0);
  check('encargo secundario suma 1; la misión principal no', src.encargo === 1 && src.principal_no_cuenta === 0);
  check('puzle resuelto suma 1', src.puzle === 1);
  check('terminal hackeada suma 1', src.terminal === 1);
  check('cada región lleva su cuenta', src.otra_region === 1);
  const cap = await ev(() => { const E = window.__bossGate.emit, p = window.__G.player; for (let i = 0; i < 9; i++) E('kill', { elite: true, x: p.x, z: p.z }); return window.__G.S.bossGate.r[0].n.elite; });
  check('cada fuente tiene tope (élites ≤ 3)', cap === 3, `élites ${cap}`);

  // 4) con todo cumplido el jefe aparece
  s = await ev(() => window.__bossGate.status(0));
  check('misión + nivel + sellos: la guarida se abre', s.ok, JSON.stringify({ have: s.have, need: s.need }));
  await teleport(arena.x + 20, arena.z); await ev(() => window.__step(30, 1 / 30)); await wait(4);
  await teleport(arena.x, arena.z); await ev(() => window.__step(60, 1 / 30)); await wait(6); await real(1800); await ev(() => window.__step(30, 1 / 30));
  b = await B(); const lairSt = await ev(() => window.__lair.status(window.__G.map.ents.find((e) => e.id === 'arena_0')));
  check('con los requisitos cumplidos NO sale el jefe en el claro: lo sustituye la guarida con su altar (ver jefes-guarida.mjs)', b.boss === 0 && lairSt === 'open', `jefes vivos ${b.boss} · guarida ${lairSt}`);
  await shot('altar-activo');

  // 5) tras la primera muerte la arena vuelve a ser libre
  await ev(() => { const S = window.__G.S; S.world.bosses.reg0 = Date.now(); S.bossGate = { v: 1, r: {} }; });
  s = await ev(() => window.__bossGate.status(0));
  check('con el jefe ya abatido la guarida no exige nada', s.ok && s.killed);
  check('la línea de la misión ya no muestra requisitos', (await ev(() => window.__bossGate.text('reina'))) === '');

  // 6) migración de guardados anteriores
  const mig = await ev(() => { const S = JSON.parse(JSON.stringify(window.__G.S)); delete S.bossGate; S.world.bosses = {}; S.world.term = { term_0_st1: 1, term_0_st2: 2, term_0_cache: 3, term_1_st1: 4, otra_cosa: 5 }; window.__G.migrations.forEach((f) => f(S)); window.__G.migrations.forEach((f) => f(S)); return { v: S.bossGate.v, r0: S.bossGate.r[0] && S.bossGate.r[0].n, r1: S.bossGate.r[1] && S.bossGate.r[1].n }; });
  check('migración: crea S.bossGate y cuenta las terminales ya hackeadas (con tope, idempotente)', mig.v === 1 && mig.r0.terminal === 2 && mig.r1.terminal === 1, JSON.stringify(mig));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `FALLAN ${bad.length}/${results.length}` : `TODO OK ${results.length}/${results.length}`);
}
