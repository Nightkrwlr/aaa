// D10d · Asedio del Bastión y mejoras de la base (31i-surprises.js): aviso, oleadas, objetivos, victoria/derrota, defensa automática, mejoras con trofeos
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/sorpresas-asedio.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs, shot, page } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); window.__seedRng && window.__seedRng(21); window.__toastLog = []; window.__tl = () => window.__toastLog.concat([...document.querySelectorAll('#toasts .toast')].map((n) => n.textContent)); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.textContent && window.__toastLog.push(n.textContent)))).observe(document.querySelector('#toasts'), { childList: true }); });
  const base = await ev(() => { const b = window.__G.map.pois.base; return { x: b.x, z: b.z }; });
  await api.teleport(base.x + 9, base.z + 9);
  await ev(() => {
    const G = window.__G; G.S.lvl = 12; G.player.recalc();
    window.__t = {
      step(n) { window.__step(n, 1 / 30); },
      sweep() { for (const e of window.__G.enemies) if (!e.dead) { e.dead = true; e.deadT = 0; } },
      god(on) { const p = window.__G.player; p.inv = on ? 1e9 : 0; },
      disarm(on) { const p = window.__G.player; if (on) { if (!p._ws) p._ws = p.ws; p.ws = [null, null]; } else if (p._ws) { p.ws = p._ws; p._ws = null; } },
      Q() { return window.__G.S.sx.siege; },
      clearPk() { const G = window.__G; for (const r of G.pickups) r.mesh && G.R.scene.remove(r.mesh); G.pickups.length = 0; },
      reset() { const q = window.__G.S.sx.siege; window.__sx.siege.end('debug'); q.st = 'idle'; q.next = window.__G.S.playTime + 1e6; window.__sx.R.sg.T = null; },
      // fuerza el inicio del asedio con el jugador presente
      start(skipWarn = true) { const G = window.__G, q = G.S.sx.siege; q.next = G.S.playTime - 1; window.__t.step(2); if (skipWarn) { q.t = 0; window.__t.step(2); } return q.st; },
    };
  });

  // 1) programación y condiciones de inicio
  const s0 = await ev(() => { const G = window.__G, q = G.S.sx.siege; return { st: q.st, next: Math.round(q.next - G.S.playTime), first: G.cfg.siege.firstS }; });
  check('el primer asedio queda programado a los 40 min de juego', s0.st === 'idle' && Math.abs(s0.next - s0.first) < 10, JSON.stringify(s0));
  const lowLvl = await ev(() => { const T = window.__t, G = window.__G, q = T.Q(); G.S.lvl = 5; q.next = G.S.playTime - 1; T.step(3); const r = { st: q.st, retry: Math.round(q.next - G.S.playTime) }; G.S.lvl = 12; return r; });
  check('con nivel < 8 no empieza: se reprograma unos segundos después', lowLvl.st === 'idle' && lowLvl.retry > 0 && lowLvl.retry <= 21, JSON.stringify(lowLvl));

  // 2) aviso: banner, etiqueta, existencias del Taller de minas y marca en el minimapa
  const w = await ev(() => {
    const T = window.__t, G = window.__G, q = T.Q(); G.S.sx.base.lv.mines = 2; const inv = G.S.gadgets.inv; const p0 = inv.proximity | 0, c0 = inv.cluster | 0;
    q.next = G.S.playTime - 1; T.step(3); T.step(10);
    return { st: q.st, t: Math.round(q.t), banner: /BASTIÓN BAJO ATAQUE/.test(document.querySelector('#banner').textContent), pill: (document.querySelector('#sxBar .sg') || {}).textContent, prox: (inv.proximity | 0) - p0, clu: (inv.cluster | 0) - c0, toast: window.__tl().some((t) => /Taller de minas/.test(t)) };
  });
  check('con el asedio en camino: aviso de 75 s con banner y etiqueta de cuenta atrás', w.st === 'warn' && w.t <= 75 && w.t >= 60 && w.banner && /Asedio del Bastión en/.test(w.pill || ''), JSON.stringify(w));
  check('el Taller de minas reparte minas de proximidad (2 por nivel) y de racimo (1 por nivel)', w.prox === 4 && w.clu === 2 && w.toast, JSON.stringify({ prox: w.prox, clu: w.clu }));
  await shot('asedio-aviso');

  // 3) empieza con el jugador presente: objetivos, oleadas y aparición escalonada
  const b = await ev(() => {
    const T = window.__t, G = window.__G, q = T.Q(), R = window.__sx.R.sg; T.sweep(); q.t = 0; T.step(3); const out = { st: q.st, wave: q.wave, W: R.W, queued: R.queue.length + R.live.size };
    out.targets = R.T.map((t) => [t.kind, Math.round(t.hp), Math.round(t.maxHp)]); out.life = Math.round(window.__eco.mt.playerHp(12));
    T.step(60); out.live = R.live.size; const e = [...R.live][0];
    out.enemy = e && { siege: !!e.siege, sameT: !!e.siege && (e.siege.targets === R.core || e.siege.targets === R.T), coreFirst: !!e.siege && e.siege.targets === R.core, persist: e.persist, siegeE: e.siegeE, alerted: e.alerted };
    out.dists = [...R.live].map((e) => Math.round(Math.hypot(e.x - G.map.pois.base.x, e.z - G.map.pois.base.z)));
    return out;
  });
  check('empieza el asedio: 4 torretas y el núcleo como objetivos, 3 oleadas a nivel 12', b.st === 'on' && b.wave === 1 && b.W === 3 && b.targets.length === 5 && b.targets.filter((t) => t[0] === 'turret').length === 4 && b.targets.filter((t) => t[0] === 'core').length === 1, JSON.stringify(b.targets));
  check('la vida de los objetivos escala con la del jugador (torreta 4×, núcleo 12×)', b.targets.every((t) => t[0] === 'turret' ? Math.abs(t[2] - b.life * 4) < 4 : Math.abs(t[2] - b.life * 12) < 6), `vida jugador ${b.life}`);
  check('los asaltantes aparecen escalonados, a 26-32 m del centro sobre el eje de una puerta, apuntan primero al núcleo y persisten', b.live > 0 && b.dists.every((d) => d >= 24 && d <= 34) && b.enemy && b.enemy.sameT && b.enemy.coreFirst && b.enemy.persist && b.enemy.siegeE && b.enemy.alerted, JSON.stringify({ live: b.live, dists: b.dists, enemy: b.enemy }));
  const hud = await ev(() => (document.querySelector('#sxBar .sg') || {}).textContent);
  check('la etiqueta muestra oleada, núcleo, torretas y enemigos', /Asedio 1\/3/.test(hud || '') && /núcleo 100%/.test(hud) && /torretas 4\/4/.test(hud), hud);
  await ev(() => { window.__t.step(150); });
  await shot('asedio-oleada');

  // 4) un asedio entero, con el jugador quieto y armado (autofuego) en un rincón del Bastión: resultado y números
  const full = (label, setup) => ev(([label, setup]) => {
    const T = window.__t, G = window.__G, q = T.Q(), R = window.__sx.R.sg, sx = G.S.sx; T.sweep(); window.__sx.siege.end('debug'); q.st = 'idle';
    sx.base.lv = setup.lv || {}; G.S.lvl = setup.lvl || 12; G.player.recalc(); G.player.hp = G.player.maxHp; T.god(true); T.disarm(!!setup.unarmed);
    const won0 = q.won, lost0 = q.lost; q.next = G.S.playTime - 1; T.step(2); q.t = 0; T.step(2);
    const out = { label, W: R.W }; let t = 0, kills = 0, minCore = 1, minTur = 4, maxAlive = 0;
    const killed0 = R.stats ? R.stats.killed : 0;
    while (q.st === 'on' && t < 520) { T.step(30); t++; const core = R.T && R.T.find((x) => x.kind === 'core'); if (core) minCore = Math.min(minCore, core.hp / core.maxHp); if (R.T) minTur = Math.min(minTur, R.T.filter((x) => x.kind === 'turret' && x.hp > 0).length); maxAlive = Math.max(maxAlive, R.live.size); }
    out.sec = t; out.result = q.won > won0 ? 'win' : q.lost > lost0 ? 'lose' : q.st; out.minCore = +minCore.toFixed(2); out.minTur = minTur; out.maxAlive = maxAlive; out.killed = R.stats ? R.stats.killed : 0;
    out.pickups = G.pickups.length; T.sweep(); T.disarm(false); sx.base.lv = {};
    return out;
  }, [label, setup]);
  const f1 = await full('sin mejoras, jugador quieto y desarmado', { unarmed: true });
  console.log('SIM', JSON.stringify(f1));
  const f2 = await full('sin mejoras, jugador quieto y armado', { unarmed: false });
  console.log('SIM', JSON.stringify(f2));
  const f3 = await full('mejoras al máximo, jugador desarmado', { unarmed: true, lv: { turret: 3, wall: 3 } });
  console.log('SIM', JSON.stringify(f3));
  check('el asedio termina siempre (victoria o derrota) en menos de 9 min', [f1, f2, f3].every((f) => f.result === 'win' || f.result === 'lose'), JSON.stringify([f1.result, f2.result, f3.result]));
  check('las mejoras no empeoran el resultado (más vida en el núcleo o más torretas en pie)', f3.minCore >= f1.minCore - 0.05 && f3.minTur >= f1.minTur, JSON.stringify({ sin: [f1.minCore, f1.minTur], con: [f3.minCore, f3.minTur] }));

  // 5) victoria: premio (cofre, créditos, trofeos, XP), contrato y reprogramación
  const win = await ev(() => {
    const T = window.__t, G = window.__G, q = T.Q(), R = window.__sx.R.sg; T.sweep(); T.god(true); T.disarm(false); G.S.sx.base.lv = {};
    const Qd = window.__dbg.Quests; const b = Qd.board(); const c = b.list.find((x) => x.sx && /^sx_sg/.test(x.id));
    window.__sx.siege.end('debug'); q.st = 'idle'; q.next = G.S.playTime - 1; T.step(2); q.t = 0; T.step(2);
    const hadContract = !!(Qd.board().list.find((x) => x.sx && /^sx_sg/.test(x.id))); const cc = Qd.board().list.find((x) => x.sx && /^sx_sg/.test(x.id)); cc && Qd.accept(cc.id, cc);
    const pk0 = G.pickups.length, won0 = q.won, xp0 = G.S.xp; R.queue.length = 0; for (const e of R.live) { e.dead = true; e.deadT = 0; } R.live.clear(); q.wave = R.W; T.step(3);
    const out = { st: q.st, won: q.won - won0, pickups: G.pickups.length - pk0, kinds: [...new Set(G.pickups.slice(pk0).map((x) => x.k))], nextIn: Math.round(q.next - G.S.playTime), banner: /BASTIÓN A SALVO/.test(document.querySelector('#banner').textContent), turretsUp: G.map.ents.filter((e) => e.k === 'allyturret').every((e) => !e._sxDown), hadContract };
    out.contractDone = cc ? Qd.complete(cc.id, G.S.quests.active[cc.id]) : null;
    return out;
  });
  check('al vencer: aviso, cofre, créditos y trofeos en el suelo, próximo asedio en 55-85 min', win.st === 'end' && win.won === 1 && win.pickups >= 8 && win.kinds.includes('cr') && win.nextIn >= 3290 && win.nextIn <= 5110 && win.banner, JSON.stringify(win));
  check('el Tablón ofrecía «Defensa del Bastión» y su contrato se cumple al resistir', win.hadContract && win.contractDone === true, JSON.stringify({ had: win.hadContract, done: win.contractDone }));

  // 6) derrota: si cae el núcleo se pierde un 5 % de créditos y las torretas se reparan solas
  const lose = await ev(() => {
    const T = window.__t, G = window.__G, q = T.Q(), R = window.__sx.R.sg; T.sweep(); T.clearPk(); G.S.credits = 4320; q.st = 'idle'; q.next = G.S.playTime - 1; T.step(2); q.t = 0; T.step(2); T.step(6);
    const c0 = G.S.credits; const tur = R.T.find((t) => t.kind === 'turret'); tur.hp = 0; T.step(5); const down = tur.ent._sxDown; const lost0 = q.lost;
    const core = R.T.find((t) => t.kind === 'core'); core.hp = 0; T.step(5);
    return { st: q.st, lost: q.lost - lost0, loss: c0 - G.S.credits, expect: Math.floor(c0 * 0.05), down, repaired: G.map.ents.filter((e) => e.k === 'allyturret').every((e) => !e._sxDown), live: R.live.size, banner: /BASTIÓN HA CAÍDO/.test(document.querySelector('#banner').textContent) };
  });
  check('una torreta derribada deja de disparar; si cae el núcleo el asedio se pierde (−5 % de créditos)', lose.down && lose.st === 'end' && lose.lost === 1 && lose.loss === lose.expect && lose.banner, JSON.stringify(lose));
  check('tras el asedio las torretas se reparan solas y los asaltantes huyen', lose.repaired && lose.live === 0, JSON.stringify({ rep: lose.repaired, live: lose.live }));

  // 7) el jugador no está cerca: margen para volver, y si no vuelve el Bastión se defiende solo
  const away = await ev(() => {
    const T = window.__t, G = window.__G, q = T.Q(), p = G.player; T.reset(); T.sweep(); q.st = 'idle'; q.next = G.S.playTime - 1; T.step(2);
    return { st: q.st };
  });
  await api.teleport(base.x + 140, base.z);
  const aw2 = await ev(() => {
    const T = window.__t, G = window.__G, q = T.Q(); const out = { warn: q.st }; q.t = 0; T.step(3); out.st1 = q.st; out.t1 = Math.round(q.t); T.step(12); out.toast = window.__tl().some((t) => /El Bastión resiste/.test(t)); out.pill = (document.querySelector('#sxBar .sg') || {}).textContent;
    return out;
  });
  check('si no estás cerca cuando acaba el aviso, tienes 150 s para volver (el Bastión resiste)', aw2.warn === 'warn' && aw2.st1 === 'grace' && aw2.t1 >= 140 && aw2.toast && /vuelve/.test(aw2.pill || ''), JSON.stringify(aw2));
  await api.teleport(base.x + 9, base.z + 9);
  const back = await ev(() => { const T = window.__t, G = window.__G, q = T.Q(); T.step(5); return { st: q.st, wave: q.wave }; });
  check('si vuelves durante el margen, el asedio empieza', back.st === 'on' && back.wave === 1, JSON.stringify(back));
  await api.teleport(base.x + 140, base.z);
  const auto = await ev(() => {
    const T = window.__t, G = window.__G, q = T.Q(); window.__sx.siege.end('debug'); q.st = 'idle'; T.sweep(); const res = { win: 0, lose: 0, credits: [] };
    for (let i = 0; i < 40; i++) { q.st = 'grace'; q.t = 0.01; const c0 = G.S.credits, w0 = q.won, l0 = q.lost; T.step(2); res[q.won > w0 ? 'win' : 'lose']++; res.credits.push(G.S.credits - c0); G.S.credits = c0; q.st = 'idle'; }
    G.S.sx.base.lv = { turret: 3, wall: 3 }; let wins = 0; for (let i = 0; i < 40; i++) { q.st = 'grace'; q.t = 0.01; const w0 = q.won; T.step(2); if (q.won > w0) wins++; q.st = 'idle'; } G.S.sx.base.lv = {};
    res.winsUpgraded = wins; res.pickups = G.pickups.length; return res;
  });
  console.log('AUTO', JSON.stringify({ win: auto.win, lose: auto.lose, winsUpgraded: auto.winsUpgraded }));
  check('sin ti el Bastión se defiende solo: ~35 % de victorias sin mejoras y casi siempre con ellas', auto.win >= 6 && auto.win <= 24 && auto.winsUpgraded >= 28 && auto.win + auto.lose === 40, JSON.stringify({ win: auto.win, up: auto.winsUpgraded }));
  await api.teleport(base.x + 9, base.z + 9);
  await ev(() => { const T = window.__t; T.reset(); T.sweep(); });

  // 8) mejoras con trofeos
  const up = await ev(() => {
    const G = window.__G, A = window.__sx.base, S = G.S; S.sx.base.lv = {}; S.junk = {}; const out = {};
    out.cost0 = A.cost('turret'); out.noMoney = A.buy('turret'); out.lv0 = A.lv('turret');
    // trofeos: de dos tipos, uno de ellos ingrediente reservado, y un ejemplar perfecto
    const tbl = window.__eco.ecoTroTable(); const normal = Object.values(tbl).filter((t) => !t.ing && !t.boss).slice(0, 3); const ing = Object.values(tbl).find((t) => t.ing);
    S.junk[normal[0].id] = 40; S.junk[normal[1].id] = 20; S.junk[ing.id] = 50; S.junk[normal[2].id + ':p'] = 3;
    out.power0 = Math.round(A.power()); out.ingPower = Math.round(A.power() - (40 * window.__eco.ecoTroValue(normal[0].id) + 20 * window.__eco.ecoTroValue(normal[1].id) + 3 * window.__eco.ecoTroValue(normal[2].id + ':p')) * G.cfg.baseUp.payMul);
    return Object.assign(out, { normal: normal.map((t) => t.id), ing: ing.id });
  });
  check('sin trofeos suficientes no se puede mejorar (aviso y nada se gasta)', up.noMoney === false && up.lv0 === 0 && up.cost0 > 0, JSON.stringify({ cost0: up.cost0, power0: up.power0 }));
  check('los ingredientes reservados no cuentan como moneda', Math.abs(up.ingPower) <= 1, `diferencia ${up.ingPower}`);
  const buy = await ev(() => {
    const G = window.__G, A = window.__sx.base, S = G.S; const ids = S.junk; const keys0 = JSON.stringify(Object.keys(ids).sort());
    // subimos el valor hasta cubrir el nivel 1: añadimos trofeos baratos
    const tbl = window.__eco.ecoTroTable(); const normal = Object.values(tbl).filter((t) => !t.ing && !t.boss)[0];
    while (A.power() < A.cost('turret') + 5) S.junk[normal.id] = (S.junk[normal.id] || 0) + 20;
    const p0 = A.power(), c0 = A.cost('turret'), cr0 = S.credits, perf0 = Object.keys(S.junk).filter((k) => k.endsWith(':p')).map((k) => S.junk[k]);
    const ok = A.buy('turret'); const out = { ok, lv: A.lv('turret'), spent: Math.round(p0 - A.power()), cost: c0, perf: perf0, perfAfter: Object.keys(S.junk).filter((k) => k.endsWith(':p')).map((k) => S.junk[k]), refund: S.credits - cr0 };
    out.ingLeft = Object.keys(S.junk).filter((k) => window.__eco.ecoTroTable()[k] && window.__eco.ecoTroTable()[k].ing).map((k) => S.junk[k]);
    return out;
  });
  check('mejorar gasta trofeos (los perfectos los últimos, los ingredientes nunca) y sube el nivel', buy.ok && buy.lv === 1 && buy.spent >= buy.cost - 2 && buy.spent <= buy.cost + 80 && JSON.stringify(buy.perf) === JSON.stringify(buy.perfAfter) && buy.ingLeft[0] === 50, JSON.stringify(buy));
  const eff = await ev(() => {
    const G = window.__G, A = window.__sx.base, p = G.player; const out = {}; G.S.sx.base.lv = {};
    // medbay: +1 botiquín máximo por nivel
    const m0 = p.medkitMax; G.S.sx.base.lv.medbay = 2; p.recalc(); out.medkit = p.medkitMax - m0; G.S.sx.base.lv.medbay = 0; p.recalc();
    // medbay: curación en el refugio
    G.S.sx.base.lv.medbay = 0; p.hp = 10; p.inv = 1e9; window.__t.step(30); const h0 = p.hp - 10; G.S.sx.base.lv.medbay = 3; p.hp = 10; window.__t.step(30); const h3 = p.hp - 10; out.heal = [Math.round(h0), Math.round(h3)]; out.inSafe = G.inSafe; G.S.sx.base.lv = {}; p.recalc();
    return out;
  });
  check('la enfermería da +1 botiquín máximo por nivel', eff.medkit === 2, JSON.stringify(eff));
  check('y cura más deprisa dentro del refugio (+30 % por nivel)', eff.inSafe && eff.heal[1] > eff.heal[0] * 1.6, JSON.stringify(eff.heal));
  const tu = await ev(() => {
    const G = window.__G, p = G.player, T = window.__t; T.sweep(); T.disarm(true); T.god(true);
    const ent = G.map.ents.find((e) => e.k === 'allyturret'); const shoot = (lv) => {
      G.S.sx.base.lv = { turret: lv }; G.projs.length = 0; const tg = window.__spawn('rastrero', 10, ent.x + 7, ent.z + 1, { alerted: false }); tg.static = true; tg.hp = tg.maxHp = 1e6; let d = 0, n = 0; for (let i = 0; i < 60 && !d; i++) { T.step(1); const pr = G.projs.find((q) => q.owner === 'p' && q.kind === 'bullet'); if (pr) d = pr.dmg; }
      tg.dead = true; tg.deadT = 0; return d; };
    const base = shoot(0), l3 = shoot(3); const rng = (lv) => { G.S.sx.base.lv = { turret: lv }; G.projs.length = 0; const tg = window.__spawn('rastrero', 10, ent.x + 14.2, ent.z, { alerted: false }); tg.static = true; tg.hp = tg.maxHp = 1e6; let fired = false; for (let i = 0; i < 40; i++) { T.step(1); if (G.projs.some((q) => q.owner === 'p' && q.kind === 'bullet' && Math.hypot(q.x - ent.x, q.z - ent.z) < 3)) fired = true; } tg.dead = true; tg.deadT = 0; return fired; };
    const out = { base: Math.round(base), l3: Math.round(l3), ratio: +(l3 / base).toFixed(2), rng0: rng(0), rng3: rng(3) }; G.S.sx.base.lv = {}; T.disarm(false); return out;
  });
  check('las torretas reforzadas disparan un 60 % más fuerte (3 niveles) y alcanzan 4,5 m más lejos', tu.ratio >= 1.55 && tu.ratio <= 1.65 && !tu.rng0 && tu.rng3, JSON.stringify(tu));

  // 9) panel del Tablón con las mejoras
  const pn = await ev(() => {
    const G = window.__G, A = window.__sx.base; G.S.sx.base.lv = {}; window.__dbg.openBoard();
    const out = { ui: G.uiOpen, cards: document.querySelectorAll('#panel [data-sxup]').length, txt: (document.querySelector('#panel .wbody') || {}).textContent.includes('Mejoras del Bastión') };
    const btns = [...document.querySelectorAll('#panel [data-sxup]')]; out.disabled = btns.map((b) => b.disabled); return out;
  });
  check('el Tablón muestra «Mejoras del Bastión» con sus cuatro mejoras', pn.ui === 'board' && pn.txt && pn.cards === 4, JSON.stringify(pn));
  await shot('tablon-mejoras');
  const pn2 = await ev(() => {
    const G = window.__G, S = G.S, A = window.__sx.base; const tbl = window.__eco.ecoTroTable(); const normal = Object.values(tbl).filter((t) => !t.ing && !t.boss)[0];
    S.junk = {}; S.junk[normal.id] = Math.ceil(A.cost('wall') / G.cfg.baseUp.payMul / window.__eco.ecoTroValue(normal.id)) + 2; window.__dbg.openBoard();
    const body = document.querySelector('#panel .win .wbody'); const btn = document.querySelector('#panel [data-sxup="wall"]'); const enabled = !btn.disabled; btn.click();
    return { enabled, lv: A.lv('wall'), ui: G.uiOpen, again: document.querySelectorAll('#panel [data-sxup]').length, pips: (document.querySelector('#panel [data-sxup="wall"]') || {}).closest && document.querySelector('#panel [data-sxup="wall"]').closest('.card').textContent.includes('●') };
  });
  check('pulsar «Mejorar» en el panel compra el nivel y redibuja el Tablón', pn2.enabled && pn2.lv === 1 && pn2.ui === 'board' && pn2.again === 4 && pn2.pips, JSON.stringify(pn2));
  await ev(() => { window.__dbg.UI.close(); window.__G.S.sx.base.lv = {}; });

  // 10) un guardado cargado en mitad de un asedio no se queda atascado
  const sv = await ev(() => {
    const T = window.__t, G = window.__G, q = T.Q(); T.reset(); q.st = 'on'; window.__sx.R.sg.T = null; T.step(1); const r1 = q.st; T.step(4); return { r1, st: q.st };
  });
  check('un asedio «en curso» sin estado de ejecución (guardado cargado) pasa a margen de regreso y se retoma al estar el jugador presente', sv.r1 === 'grace' && sv.st === 'on', JSON.stringify(sv));
  await ev(() => { window.__t.reset(); });

  const bad = results.filter((r) => !r.ok);
  console.log(`\nRESULTADO sorpresas-asedio: ${results.length - bad.length}/${results.length}`);
  if (bad.length) console.log('FALLOS: ' + bad.map((r) => r.name).join(' | '));
  else console.log('TODO OK ' + results.length + '/' + results.length);
}
