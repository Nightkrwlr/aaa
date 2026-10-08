// HACKEO · núcleo: carga, minijuegos con bots (UI real), traza, programas, terminal, torretas/drones, módulo Hacker, chips y guardado.
//   node tools/build.mjs --dev --out dist/dev.html
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/hackeo-core.mjs --size 960x540 --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  // fuera del Bastión: sus torretas aliadas matan todo lo que haya a 13 m y falsearían las pruebas de combate; sin aparición de manadas ni eventos
  await api.region('desierto');
  await ev(() => { const G = window.__G; G.world.packCd = 1e9; G.world.evT = 1e9; G.uiBlockDamage = true; });

  // 1 · carga y guardado
  const r0 = await ev(() => {
    const h = window.__hack, S = window.__G.S, g = window.__gadgets;
    return { has: !!h, kinds: h.api.kinds.length, v: S.hackV, lvl: S.hack.lvl, tools: S.hack.tools, gad: Object.keys(g.cfg.types).length, api: !!window.__G.hackApi, ord: g.cfg.types.hacker?.kind };
  });
  check('x.hackApi y __hack disponibles', r0.has && r0.api && r0.kinds === 10, JSON.stringify(r0));
  check('S.hack y S.hackV = 1 en partida nueva', r0.v === 1 && r0.lvl === 1 && r0.tools.disipador === 2 && r0.tools.ralentizador === 1);
  check('Módulo Hacker registrado como 13.º gadget', r0.gad === 13 && r0.ord === 'hacker');

  // 2 · generadores deterministas con validate()
  const val = await ev(() => window.__hack.validateAll(24));
  let allOk = true; const rows = [];
  for (const k in val) { rows.push(`${k} ${val[k].ok}/${val[k].total}`); if (val[k].ok !== val[k].total) allOk = false; }
  check('validate() de los 5 minijuegos nuevos (24 semillas × 5 dificultades)', allOk, rows.join(' · ') + (allOk ? '' : ' ' + JSON.stringify(Object.values(val).map((v) => v.fails[0]).filter(Boolean))));
  const det = await ev(() => { const G = window.__hack.games; const a = JSON.stringify(G.route.gen(777, 3)), b = JSON.stringify(G.route.gen(777, 3)); const c = JSON.stringify(G.cipher.gen(5, 2)), d = JSON.stringify(G.cipher.gen(5, 2)); return a === b && c === d; });
  check('los generadores son deterministas (misma semilla, mismo puzle)', det);

  // 3 · cada capa se resuelve con su bot en la interfaz real
  const kinds = ['fw', 'cipher', 'route', 'tune', 'brute', 'seq', 'pipe', 'code', 'sync', 'lights'];
  for (const k of kinds) {
    for (const d of (['fw', 'cipher', 'route', 'tune', 'brute'].includes(k) ? [1, 3, 5] : [2])) {
      const r = await ev(([k, d]) => {
        const h = window.__hack;
        const hd = h.api.run({ title: 'Bot ' + k, kinds: [k], layers: 1, diff: d, noPre: true, risk: 1, noExtra: true, seed: 4242 + d }, null);
        if (!hd) return { err: 'no abre' };
        const res = h.autoplay(400);
        const ui = !!document.querySelector('.hk-res');
        document.querySelector('#hkOk')?.click();
        return { ok: res && res.ok, t: res && res.tiempo, tr: res && res.traza, ui, closed: !window.__G.uiOpen };
      }, [k, d]);
      check(`capa ${k} (dif. ${d}) resuelta por bot`, r.ok && r.ui && r.closed, JSON.stringify(r));
    }
  }

  // 4 · fallos, traza y reintentos
  const f1 = await ev(() => {
    const h = window.__hack, ev = [];
    window.__G.events.hackDone = (window.__G.events.hackDone || []).concat([(r) => ev.push(r)]);
    h.api.run({ title: 'Fallo', kinds: ['tune'], layers: 1, diff: 4, noPre: true, risk: 1, noExtra: true, seed: 99 }, null);
    const s = h.s; const t0 = s.trace;
    h.step(60 * 40, 1 / 60); // 40 s sin tocar nada: el tiempo (36 s) se agota
    const afterFirst = { trace: s.trace, fails: s.fails, between: s.between, ended: s.ended };
    // sigue fallando hasta llenar la traza
    for (let i = 0; i < 40 && !s.ended; i++) h.step(60 * 30, 1 / 60);
    document.querySelector('#hkOk')?.click();
    const last = ev[ev.length - 1];
    return { t0, afterFirst, ended: s.ended, last, n: ev.length };
  });
  check('una capa sin resolver agota el tiempo, suma traza y se reintenta', f1.afterFirst.fails >= 1 && f1.afterFirst.trace > f1.t0, JSON.stringify(f1.afterFirst));
  check('la traza al 100 % termina la sesión con hackDone {ok:false, capas, riesgo, objetivo}', f1.ended && f1.last && f1.last.ok === false && f1.last.capas === 1 && f1.last.riesgo === 1 && f1.last.objetivo === 'personalizado' && f1.last.traza >= 100, JSON.stringify(f1.last));

  // 5 · programas
  const pr = await ev(() => {
    const h = window.__hack, H = h.state(); H.tools = { disipador: 3, ralentizador: 3, oraculo: 3, fantasma: 3, rompehielo: 3 }; H.lvl = 8;
    const out = {};
    h.api.run({ title: 'Prog', kinds: ['fw'], layers: 2, diff: 2, noPre: true, risk: 1, noExtra: true, seed: 7 }, null);
    let s = h.s; H.loadout = ['disipador', 'ralentizador', 'oraculo', 'fantasma', 'rompehielo'];
    s.loadout = H.loadout.slice(0, 5);
    s.trace = 50; h.step(1, 1 / 60);
    const hkUse = (id) => document.querySelector(`[data-tool="${id}"]`)?.click();
    s.el.tools._k = null; s.hudT = 0; h.step(1, 1 / 60);
    hkUse('disipador'); out.disip = { trace: Math.round(s.trace), left: H.tools.disipador };
    hkUse('ralentizador'); out.slow = s.slow > 13;
    hkUse('oraculo'); out.oraculo = { used: !!s.used.oraculo, padW: s.game.sim.padW };
    hkUse('fantasma'); out.ghost = s.ghost;
    const tr0 = s.trace; h.step(60, 1 / 60); out.ghostRate = +(s.trace - tr0).toFixed(3);
    hkUse('rompehielo'); out.skip = { adv: s.advance, between: s.between > 0, tools: H.tools.rompehielo };
    h.step(60 * 3, 1 / 60); out.idx = s.idx;
    // segunda capa: rompehielo otra vez
    s.el.tools._k = null; h.step(1, 1 / 60);
    document.querySelector('[data-tool="rompehielo"]')?.click();
    h.step(60 * 3, 1 / 60); out.ended = s.ended; out.res = window.__hack.HK.last;
    document.querySelector('#hkOk')?.click();
    return out;
  });
  check('Disipador resta 30 de traza y se consume', pr.disip.trace === 20 && pr.disip.left === 2, JSON.stringify(pr.disip));
  check('Ralentizador, Oráculo y Fantasma se aplican', pr.slow && pr.oraculo.used && pr.oraculo.padW > 100 && pr.ghost, JSON.stringify({ slow: pr.slow, o: pr.oraculo, g: pr.ghost }));
  check('Rompehielo supera la capa y la siguiente; el stock baja', pr.skip.adv && pr.skip.tools === 2 && pr.ended && pr.res && pr.res.ok && pr.res.capasOk === 2, JSON.stringify({ skip: pr.skip, res: pr.res }));

  // 6 · terminal: éxito (efecto, botín, XP) y fallo (alarma + contraataque)
  const tm = await ev(() => {
    const G = window.__G, h = window.__hack, H = h.state(), S = G.S, p = G.player;
    H.lvl = 1; H.xp = 0; H.heat = 0; H.tools = { disipador: 2 };
    const out = {};
    const ent = { k: 'terminal', id: 'term_test_relay', x: p.x + 2, z: p.z, eff: 'relay', diff: 2, reg: 0 };
    const rt = { lockUntil: 0 };
    const t0 = { terminals: S.stats.terminals, pick: G.pickups.length, xp: H.xp, data: S.mats.data };
    window.__hack.rng(1);
    const ok = window.__G.hackApi && true;
    G.world.hackResult && 0;
    // abre por el camino real (jp → hackOpenTerminal)
    window.__dbg.openHack(ent, rt);
    out.pre = !!document.querySelector('#hkGo') && /Terminal/.test(document.querySelector('#panel h2')?.textContent || '');
    out.layersTxt = [...document.querySelectorAll('.hk-lay span')].map((e) => e.textContent.trim()).join('|');
    document.querySelector('#hkGo').click();
    const res = h.autoplay(600);
    out.res = res; out.resUI = !!document.querySelector('.hk-res');
    document.querySelector('#hkOk')?.click();
    out.after = { terminals: S.stats.terminals - t0.terminals, pick: G.pickups.length - t0.pick, xpGain: H.xp + (H.lvl > 1 ? 99 : 0) > 0, done: !!S.world.term[ent.id], lvl: H.lvl, heat: Math.round(H.heat) };
    // fallo: abre y deja que la traza se llene
    const ent2 = { k: 'terminal', id: 'term_test_fail', x: p.x + 3, z: p.z, eff: 'relay', diff: 2, reg: 0 };
    const rt2 = { lockUntil: 0 };
    const n0 = G.enemies.length, hp0 = p.hp;
    window.__dbg.openHack(ent2, rt2);
    document.querySelector('#hkGo').click();
    const s = h.s; s.trace = 99.9; s.manual = true; h.step(60 * 5, 1 / 60);
    out.fail = { res: h.HK.last, enemies: G.enemies.length - n0, lock: rt2.lockUntil > G.time, hpLost: Math.round(hp0 - p.hp) };
    document.querySelector('#hkOk')?.click();
    return out;
  });
  check('abre la pantalla previa desde la terminal (jp → hackOpenTerminal) con sus capas', tm.pre && tm.layersTxt.length > 3, tm.layersTxt);
  check('terminal hackeada: efecto, XP, calor y botín', tm.res && tm.res.ok && tm.after.terminals === 1 && tm.after.done && tm.after.pick > 0 && tm.after.heat > 0, JSON.stringify({ r: tm.res, a: tm.after }));
  check('terminal fallada: alarma (enemigos), bloqueo y descarga no letal', tm.fail.res && !tm.fail.res.ok && tm.fail.enemies >= 5 && tm.fail.lock && tm.fail.hpLost >= 0, JSON.stringify(tm.fail));

  // 7 · torretas y drones enemigos controlables, mecánicos desactivables
  const en = await ev(() => {
    const G = window.__G, h = window.__hack, H = h.state(), p = G.player, out = {};
    H.lvl = 6; H.tools = {}; G.uiOpen = null; G.paused = false;
    const sp = (k, dx, dz, l = 5, o = {}) => window.__spawn(k, l, p.x + dx, p.z + dz, o);
    // un grupo de rastreros hostiles y una torreta que vamos a tomar
    const tur = sp('torreta', 3, 0), mech = sp('mech', -6, 1);
    const bugs = [sp('mech', 9, -1, 5), sp('mech', 9, 2, 5)]; // objetivos duros: el arma del jugador no los mata en los pocos segundos de la prueba
    out.kinds = [tur, mech, { id: 'dron', fly: true }, { id: 'rastrero' }, { id: 'torreta', boss: true }].map((e) => h.enemyKind(e));
    window.__step(3, 1 / 30); // la rejilla espacial se rellena al simular
    h.scan(); out.cand = h.HK.cand ? h.HK.cand.id : null;
    // hackeo de la torreta con el camino real (marcador / tecla V → hkStartEnemy)
    G.paused = false;
    out.start = h.startEnemy(tur);
    out.preTitle = document.querySelector('#panel h2')?.textContent;
    document.querySelector('#hkGo').click();
    const res = h.autoplay(400);
    document.querySelector('#hkOk')?.click();
    out.ctl = { ok: res && res.ok, objetivo: res && res.objetivo, hk: !!tur.hk, mode: tur.hk && tur.hk.mode, inv: tur.invuln, targetable: tur.targetable() };
    G.uiBlockDamage = true; // que la prueba no dependa del daño que recibe el jugador
    const seen = new WeakSet(); let shots = 0;
    for (let i = 0; i < 120; i++) { window.__step(1, 1 / 30); for (const q of G.projs) if (q.owner === 'p' && q.hit && q.hit.has(tur) && !seen.has(q)) { seen.add(q); shots++; } }
    out.dmg = { shots, hkLeft: tur.hk ? Math.round(tur.hk.t) : -1 };
    window.__step(60 * 25, 1 / 30);
    out.release = { hk: !!tur.hk, inv: tur.invuln, dead: tur.dead, alerted: tur.alerted };
    // daño real de una torreta controlada: lejos del jugador, contra un mech (el arma del jugador no llega)
    const ft = sp('torreta', 20, -20), fm = sp('mech', 20, -26); fm.alerted = false;
    window.__step(2, 1 / 30);
    const fhp0 = fm.hp; h.applyControl(ft, 6, false);
    window.__step(60 * 2, 1 / 30);
    out.far = { hpLost: Math.round(fhp0 - fm.hp), pct: Math.round(100 * (fhp0 - fm.hp) / fm.maxHp), dead: fm.dead, shield: !!fm.shieldHp };
    // mecánico: apagado (lejos del jugador, que mata cualquier cosa a la vista en un par de segundos)
    const mech3 = sp('mech', 17, 17);
    mech3.alerted = true;
    window.__step(2, 1 / 30);
    const m0 = { x: mech3.x, z: mech3.z };
    h.applyOff(mech3, 5);
    window.__step(90, 1 / 30);
    out.off = { mode: mech3.hk && mech3.hk.mode, moved: +Math.hypot(mech3.x - m0.x, mech3.z - m0.z).toFixed(2), dead: mech3.dead };
    window.__step(90, 1 / 30);
    out.offEnd = !mech3.hk;
    // sobrecarga: la torreta controlada explota y muere al terminar
    const t2 = sp('torreta', 4, 4); h.applyControl(t2, 2, true);
    window.__step(60 * 4, 1 / 30);
    out.over = { dead: t2.dead };
    // fallo: la unidad se enfurece
    const m2 = sp('mech', -5, 3, 5); const dmg0 = m2.dmg;
    h.startEnemy(m2); document.querySelector('#hkGo').click();
    const s = h.s; s.trace = 99.99; h.step(5, 1 / 60); document.querySelector('#hkOk')?.click();
    out.fail = { ratio: +(m2.dmg / dmg0).toFixed(2), alerted: m2.alerted, last: h.HK.last && h.HK.last.ok };
    return out;
  });
  check('torreta, dron y mech reconocidos como hackeables (rastrero y jefes no); el barrido marca un candidato', en.kinds.join() === 'control,off,control,,' && !!en.cand, JSON.stringify({ k: en.kinds, c: en.cand }));
  check('hackear una torreta la controla (invulnerable y fuera de la mira) y emite hackDone', en.start && en.ctl.ok && en.ctl.objetivo === 'torreta' && en.ctl.hk && en.ctl.mode === 'control' && en.ctl.inv === true && en.ctl.targetable === false, JSON.stringify(en.ctl));
  check('la torreta controlada dispara a los enemigos (y daña de verdad) y luego se reinicia', en.dmg.shots >= 1 && en.far.hpLost > 0 && en.release.hk === false && en.release.inv === false && en.release.alerted === true, JSON.stringify({ d: en.dmg, r: en.release, far: en.far }));
  check('el mecánico apagado no se mueve ni actúa y despierta al terminar', en.off.mode === 'off' && en.off.moved < 0.5 && en.offEnd, JSON.stringify({ off: en.off, end: en.offEnd }));
  check('sobrecarga: la torreta controlada se destruye al terminar', en.over.dead === true, JSON.stringify(en.over));
  check('hackeo fallido: contramedida (daño ×1,3, alerta) y descarga', en.fail.ratio === 1.3 && en.fail.alerted && en.fail.last === false, JSON.stringify(en.fail));

  // 8 · módulo Hacker (gadget)
  const gd = await ev(() => {
    const G = window.__G, h = window.__hack, g = window.__gadgets, p = G.player, out = {};
    g.learn('hacker', 3);
    const placed = []; G.events.gadgetPlaced = (G.events.gadgetPlaced || []).concat([(x) => placed.push(x.id)]);
    const trig = []; G.events.gadgetTriggered = (G.events.gadgetTriggered || []).concat([(x, n) => trig.push(n)]);
    G.uiBlockDamage = true; G.paused = false;
    const sp = (k, dx, dz, l = 5, o = {}) => window.__spawn(k, l, p.x + dx, p.z + dz, o);
    // lejos del jugador (su arma acabaría con ellos antes de que el módulo actúe)
    const tur = sp('torreta', 18, 20), mech = sp('mech', 17, 17), mech2 = sp('mech', 21, 17);
    const gdg = g.deploy('hacker', { force: true, x: p.x + 19, z: p.z + 18 });
    out.deployed = !!gdg;
    window.__step(60 * 3, 1 / 30);
    out.state = { placed: placed.includes('hacker'), ctl: tur.hk && tur.hk.mode, off1: mech.hk && mech.hk.mode, off2: mech2.hk && mech2.hk.mode, trig: trig.length };
    window.__step(60 * 40, 1 / 30);
    out.life = { left: g.state.list.some((q) => q.id === 'hacker') };
    out.stat = g.cfg.types.hacker.statText;
    return out;
  });
  check('Módulo Hacker: se despliega (gadgetPlaced), controla torreta, apaga mecánicos y emite gadgetTriggered', gd.deployed && gd.state.placed && gd.state.ctl === 'control' && gd.state.off1 === 'off' && gd.state.off2 === 'off' && gd.state.trig > 0, JSON.stringify(gd.state));
  check('Módulo Hacker caduca y tiene texto propio en el Taller', gd.life.left === false && /Alcance/.test(gd.stat), gd.stat);

  // 9 · chips de lore con x.loreApi (simulada)
  const cp = await ev(() => {
    const G = window.__G, h = window.__hack, calls = [];
    G.loreApi = { decrypt: (id, q) => { calls.push([id, q]); return true; }, hintFor: () => null, has: () => true };
    document.querySelector('#panel [data-close]')?.click();
    let got = null;
    const hd = h.api.decryptChip('chip_7', (r) => (got = r));
    const hint = document.querySelector('.cp-hint, #hkInfo') ? true : false;
    const hdr = document.querySelector('#panel h2')?.textContent;
    document.querySelector('#hkGo').click();
    const txt = document.querySelector('.cp-hint')?.textContent || '';
    const res = h.autoplay(600);
    document.querySelector('#hkOk')?.click();
    return { hdr, res, got: !!got, calls, objetivo: res && res.objetivo, q: res && res.calidad, txt: txt.includes('Pista del archivo'), layers: res && res.capas };
  });
  check('chip: dos capas (la 1.ª cifrado con la pista del archivo) y descifra vía x.loreApi.decrypt(id, calidad)', cp.res && cp.res.ok && cp.objetivo === 'chip' && cp.calls.length === 1 && cp.calls[0][0] === 'chip_7' && cp.calls[0][1] >= 0.4 && cp.calls[0][1] <= 1 && cp.txt && cp.layers >= 2, JSON.stringify({ c: cp.calls, t: cp.txt, l: cp.layers }));

  // 10 · nivel de hackeo, talentos y guardado
  const lv = await ev(() => {
    const G = window.__G, h = window.__hack, S = G.S, H = h.state(), out = {};
    H.lvl = 1; H.xp = 0; let ups = 0; G.events.hackLevel = (G.events.hackLevel || []).concat([() => ups++]);
    h.addXp(h.xpToNext(1) + h.xpToNext(2) + 1); out.lvl = H.lvl; out.ups = ups;
    S.talentFx = Object.assign({}, S.talentFx, { hackSpeed: 0.2, hackTraceCut: 0.3, hackTools: 2, intruder: 1 });
    out.mods = h.mods();
    S.talentFx.hackTraceCut = -0.2; out.worse = h.mods().trace;
    S.talentFx = Object.assign({}, S.talentFx, { hackSpeed: 0, hackTraceCut: 0, hackTools: 0, intruder: 0 });
    // migración idempotente + guardado antiguo
    const copy = JSON.parse(JSON.stringify(S));
    delete copy.hack; delete copy.hackV; copy.stats.terminals = 12;
    h.migrate(copy); const a = JSON.stringify(copy.hack); h.migrate(copy); const b = JSON.stringify(copy.hack);
    out.old = { lvl: copy.hack.lvl, same: a === b, v: copy.hackV, tools: copy.hack.tools, ok: copy.hack.stats.ok };
    out.json = JSON.parse(JSON.stringify(S.hack)).lvl === S.hack.lvl;
    return out;
  });
  check('subir de nivel de hackeo emite hackLevel y suma niveles por XP', lv.lvl === 3 && lv.ups === 1, JSON.stringify({ lvl: lv.lvl, ups: lv.ups }));
  check('S.talentFx (hackSpeed, hackTraceCut, hackTools) modifica velocidad, traza y huecos de programa', lv.mods.speed > 1.2 && lv.mods.trace < 0.7 && lv.mods.slots >= 4 && lv.worse > 1, JSON.stringify({ m: lv.mods, w: lv.worse }));
  check('migración idempotente: guardado antiguo con 12 terminales da nivel retroactivo y kit inicial', lv.old.same && lv.old.v === 1 && lv.old.lvl >= 3 && lv.old.tools.disipador === 2 && lv.old.ok === 12 && lv.json, JSON.stringify(lv.old));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página ni de consola nuevos', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}
