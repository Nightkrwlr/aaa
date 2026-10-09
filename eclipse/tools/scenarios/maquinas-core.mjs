// D11 · máquinas hackeables (31j-machines.js): reparto, hackeo, aliadas (torreta, dron, robot, médico), batería y relevo, únicas (dron explorador, baliza, ascensor), guardado
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/maquinas-core.mjs --size 960x540 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, shot, teleport } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); window.__toastLog = []; });

  await ev(() => {
    const G = window.__G, M = window.__mach, H = window.__hack;
    window.__t = {
      slots: () => M.slots(),
      slot(k, reg) { return M.slots().find((s) => s.k === k && (reg == null || s.reg === reg) && s.st === 'dormant'); },
      near(s, d = 4) { const f = G.map.findFree(s.x + d, s.z, 5, 0.5); G.player.x = f[0]; G.player.z = f[1]; window.__t.calm(); G.world.check(true); window.__step(30, 1 / 30); return M.body(s.id); },
      hack(b) { // abre la sesión y la juega con los bots
        const ok = H.startEnemy(b); if (!ok) return { opened: false };
        const res = H.autoplay(300);
        G.uiOpen && window.__dbg.UI.close && window.__dbg.UI.close();
        return { opened: true, res: res && { ok: res.ok, id: res.id, capas: res.capas, riesgo: res.riesgo } };
      },
      step(n) { window.__step(n, 1 / 30); },
      // el jugador no muere durante la prueba (otros sistemas del mundo siguen vivos)
      calm() { const p = G.player; p.inv = 1e9; p.hp = p.maxHp; for (const e of G.enemies.slice()) { e.dead = true; e.deadT = 0; } G.projs.length = 0; },
    };
    window.__t.calm();
  });

  // 1) reparto de máquinas
  const A = await ev(() => {
    const G = window.__G, M = window.__mach, S = M.state();
    const out = { init: S.init, n: M.slots().length, byKind: {}, bad: [], regs: {} };
    for (const s of M.slots()) {
      out.byKind[s.k] = (out.byKind[s.k] || 0) + 1; out.regs[s.reg] = (out.regs[s.reg] || 0) + 1;
      const R = window.__De[s.reg], inside = s.x >= R.gx * 192 && s.x < (R.gx + 1) * 192 && s.z >= R.gz * 192 && s.z < (R.gz + 1) * 192;
      if (!inside) out.bad.push(s.id + ' fuera de su región');
      const t = G.map.t(Math.floor(s.x), Math.floor(s.z));
      if (t !== 0 && t !== 1) out.bad.push(s.id + ' tile ' + t);
      if (G.map.blk[G.map.idx(Math.floor(s.x), Math.floor(s.z))]) out.bad.push(s.id + ' en tile bloqueado');
      const base = G.map.pois.base; if (Math.hypot(s.x - base.x, s.z - base.z) < M.cfg.minFromBase) out.bad.push(s.id + ' junto al Bastión');
    }
    const re = M.slots().filter((s) => !s.u);
    let minD = 1e9; for (let i = 0; i < re.length; i++) for (let j = i + 1; j < re.length; j++) minD = Math.min(minD, Math.hypot(re[i].x - re[j].x, re[i].z - re[j].z));
    out.minD = +minD.toFixed(1);
    const s0 = re.find((s) => s.reg === 0); out.nearBase = null;
    const base = G.map.pois.base; const r0 = M.slots().filter((s) => s.reg === 0 && !s.u)[0]; out.nearBase = r0 && +Math.hypot(r0.x - base.x, r0.z - base.z).toFixed(1);
    out.json = (() => { try { JSON.parse(JSON.stringify(S)); return true; } catch (e) { return false; } })();
    return out;
  });
  console.log('reparto', JSON.stringify({ n: A.n, byKind: A.byKind, regs: A.regs, minD: A.minD, nearBase: A.nearBase }));
  check('al empezar se reparten 4 máquinas reutilizables + 3 únicas por región (63) sin errores de colocación', A.init && A.n === 63 && A.bad.length === 0 && Object.values(A.regs).every((n) => n === 7), JSON.stringify({ n: A.n, bad: A.bad.slice(0, 4), regs: A.regs }));
  check('las reutilizables están a ≥ 28 casillas unas de otras y la primera de la región 0 sale a 58-95 del Bastión', A.minD >= 27.9 && A.nearBase >= 58 && A.nearBase <= 95, `minD ${A.minD} · primera ${A.nearBase}`);
  check('hay de los cuatro tipos reutilizables y de los tres únicos; el estado es JSON puro', ['ametralladora', 'dron', 'robot', 'medico', 'guia', 'baliza', 'ascensor'].every((k) => A.byKind[k] > 0) && A.json, JSON.stringify(A.byKind));

  // 2) determinismo: la misma semilla de partida da el mismo reparto
  const D = await ev(() => {
    const G = window.__G, M = window.__mach, S = M.state(), before = JSON.stringify(M.slots().map((s) => [s.k, s.reg, s.x, s.z]));
    const saved = JSON.parse(JSON.stringify(S));
    S.slots = {}; S.n = 0; S.init = false; M.init();
    const again = JSON.stringify(M.slots().map((s) => [s.k, s.reg, s.x, s.z]));
    return { same: before === again, n: M.slots().length };
  });
  check('el reparto es determinista con la semilla de la partida', D.same && D.n === 63, JSON.stringify(D));

  // 3) montaje por cercanía y marcador
  const B = await ev(() => {
    const G = window.__G, M = window.__mach, T = window.__t, H = window.__hack;
    const s = T.slot('ametralladora') || T.slot('dron');
    const far = M.body(s.id);
    G.player.x = s.x + 120; G.player.z = s.z; // lejos
    const b = T.near(s, 4);
    const out = { id: s.id, kind: s.k, far: !!far, mounted: !!b, mode: b && b.mode, vis: b && b.root.visible, bodies: M.bodies().length };
    H.scan(); out.cand = H.HK.cand === b; out.kind2 = H.enemyKind(b);
    return out;
  });
  check('la máquina dormida se monta al acercarse (no antes) y es el candidato del marcador HACKEAR (kind «machine»)', !B.far && B.mounted && B.mode === 'dormant' && B.vis && B.cand && B.kind2 === 'machine', JSON.stringify(B));
  await shot('maquina-dormida');

  // 4) los enemigos ya no se hackean a mano, pero el módulo Hacker sí los controla
  const E = await ev(() => {
    const G = window.__G, H = window.__hack, p = G.player;
    const e = window.__spawn('torreta', 10, p.x + 3, p.z + 3, {});
    G.world.check(true); window.__step(10, 1 / 30);
    const d = { manual: H.cfg.enemy.manual, kind: H.enemyKind(e), gadget: H.gadgetKind(e) };
    H.scan(); d.candEnemy = H.HK.cand === e;
    e.dead = true; e.deadT = 0;
    return d;
  });
  check('los enemigos mecánicos ya no son hackeables a mano (manual = false) pero siguen siendo objetivo del módulo Hacker', E.manual === false && E.kind === null && E.gadget === 'control' && !E.candEnemy, JSON.stringify(E));

  // 5) hackeo con los bots → aliada activa
  const C = await ev(() => {
    const G = window.__G, M = window.__mach, T = window.__t, H = window.__hack;
    const s = M.slots().find((q) => q.st === 'dormant' && M.body(q.id) && M.body(q.id).mode === 'dormant'), b = M.body(s.id);
    const spec = M.spec(b);
    const out = { spec: { target: spec.target, diff: spec.diff, layers: spec.layers, need: spec.need }, title: spec.title };
    const r = T.hack(b);
    out.hack = r; out.mode = b.mode; out.st = s.st; out.act = M.MX.act.length; out.tMax = Math.round(b.tMax);
    out.expected = Math.round(Math.min(b.def.max, b.def.battery + b.def.perLvl * (H.state().lvl - 1)) * (1 + 0) * (r.res && r.res.riesgo === 2 ? 1.2 : 1));
    window.__step(3, 1 / 30);
    out.tag = !!document.querySelector('.mx-tag');
    out.kind = s.k; out.id = s.id;
    return out;
  });
  check('hackear la máquina (bots) abre la sesión «machine» y la deja ACTIVA con la batería esperada y su etiqueta en pantalla', C.hack.opened && C.hack.res && C.hack.res.ok && C.mode === 'active' && C.st === 'active' && C.act === 1 && Math.abs(C.tMax - C.expected) <= 2 && C.tag, JSON.stringify(C));
  await shot('maquina-activa');

  // 6) la aliada dispara y hiere a los enemigos; el cuerpo es invulnerable y no cuenta como enemigo
  const F = await ev(() => {
    const G = window.__G, M = window.__mach, b = M.MX.act[0], p = G.player;
    const def = b.def, out = { kind: def.ai };
    const before = G.enemies.length;
    // un enemigo quieto a 7 m del jugador y de la aliada
    const f = G.map.findFree(b.x + 6, b.z, 4, 0.4);
    const e = window.__spawn('rastrero', 3, f[0], f[1], { alerted: false }); e.hp = e.maxHp = 400; e.static = true;
    window.__step(90, 1 / 30);
    out.dmgAbs = Math.round(e.maxHp - e.hp); out.expected = Math.round(b.dps * def.dpsMul * 3); out.dead = e.dead; out.enemies = G.enemies.length - before;
    out.inEnemies = G.enemies.includes(b); out.t = Math.round(b.t);
    e.dead = true; e.deadT = 0;
    return out;
  });
  if (F.kind === 'medic') check('el dron médico no ataca: cura (lo comprueba la parte 7)', true);
  else check('la aliada dispara a un enemigo cercano y lo hiere (≥ 35 % del daño teórico en 3 s); no es un enemigo ni se puede dañar', (F.dmgAbs >= F.expected * 0.35 || F.dead) && !F.inEnemies, JSON.stringify(F));

  // 7) cada tipo: dron te sigue, robot te sigue a pie, médico cura
  const K = await ev(() => {
    const G = window.__G, M = window.__mach, T = window.__t, p = G.player, out = {};
    for (const b of [...M.MX.act]) M.shutdown(b, 'prueba');
    for (const k of ['dron', 'robot', 'medico', 'ametralladora']) {
      const s = T.slot(k) || M.slots().find((q) => q.k === k && q.st === 'dormant');
      if (!s) { out[k] = 'sin hueco'; continue; }
      const b = T.near(s, 3);
      if (!b) { out[k] = 'sin cuerpo'; continue; }
      const lines = M.activate(b, { riesgo: 1, traza: 0 });
      // alejarse 14 m
      p.hp = p.maxHp * 0.5; const f = G.map.findFree(p.x + 14, p.z, 6, 0.5); const px = p.x, pz = p.z; p.x = f[0]; p.z = f[1];
      const trace = [b.mode + ':' + Math.round(b.t)];
      for (let i = 0; i < 5; i++) { window.__step(30, 1 / 30); trace.push(b.mode + ':' + Math.round(b.t) + (p.dead ? ':MUERTO' : '')); }
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      out[k] = { mode: b.mode, dist: +d.toFixed(1), hp: Math.round((p.hp / p.maxHp) * 100), lines: lines.length, trace: trace.join(' ') };
      M.shutdown(b, 'prueba');
    }
    return out;
  });
  console.log('tipos', JSON.stringify(K));
  check('el dron y el robot te siguen (a < 6 m tras alejarte 14 m); la torreta se queda donde está', K.dron.dist < 6 && K.robot.dist < 6 && (K.ametralladora === 'sin hueco' || K.ametralladora.dist > 8), JSON.stringify({ dron: K.dron.dist, robot: K.robot.dist, torreta: K.ametralladora.dist }));
  check('el dron médico te cura mientras vas por debajo del 95 % de vida (de 50 % a más)', K.medico && K.medico.hp >= 54, JSON.stringify(K.medico));

  // 8) batería, apagado y relevo
  const R = await ev(() => {
    const G = window.__G, M = window.__mach, T = window.__t, S = G.S;
    const s = T.slot('ametralladora') || T.slot('dron');
    const b = T.near(s, 3);
    M.activate(b, { riesgo: 1, traza: 0 });
    const out = { before: b.mode, tags: document.querySelectorAll('.mx-tag').length };
    b.t = 0.05; window.__step(10, 1 / 30);
    out.mode = b.mode; out.st = s.st; out.cdIn = Math.round(s.cd - S.playTime); out.act = M.MX.act.length; out.tags = document.querySelectorAll('.mx-tag').length;
    window.__step(30 * 24, 1 / 30);
    out.disposed = !!b.dead && !M.body(s.id);
    const x0 = s.x, z0 = s.z, k0 = s.k;
    S.playTime += 1300; window.__step(60, 1 / 30);
    out.reborn = s.st === 'dormant'; out.moved = +Math.hypot(s.x - x0, s.z - z0).toFixed(1); out.k = [k0, s.k];
    const reg = G.map.regAt(s.x, s.z); out.sameReg = reg === s.reg;
    out.free = G.map.t(Math.floor(s.x), Math.floor(s.z)) <= 1;
    return out;
  });
  check('se acaba la batería: se apaga, queda en enfriamiento (11-18 min), la etiqueta desaparece y la carcasa se disuelve', R.mode === 'husk' && R.st === 'cool' && R.cdIn >= 600 && R.cdIn <= 1100 && R.act === 0 && R.tags === 0 && R.disposed, JSON.stringify(R));
  check('pasado el enfriamiento reaparece dormida en OTRO sitio de su región, sobre suelo libre', R.reborn && R.moved > 10 && R.sameReg && R.free, JSON.stringify({ moved: R.moved, sameReg: R.sameReg, free: R.free, k: R.k }));

  // 9) fallo del hackeo: bloqueo temporal
  const L = await ev(() => {
    const G = window.__G, M = window.__mach, T = window.__t, H = window.__hack;
    const s = M.slots().find((q) => q.st === 'dormant' && !q.u);
    const b = T.near(s, 3);
    const hp0 = G.player.hp;
    const lines = M.hackDone(b, { ok: false, traza: 100, riesgo: 1 });
    const out = { locked: s.lock > G.time, kind: H.enemyKind(b), lines: lines.length, still: b.mode, hurt: G.player.hp < hp0 };
    G.time += 30; out.after = H.enemyKind(b);
    return out;
  });
  check('un hackeo fallido bloquea la máquina 25 s (no hackeable) y vuelve a estarlo después; hay descarga', L.locked && L.kind === null && L.after === 'machine' && L.still === 'dormant', JSON.stringify(L));

  // 10) límite de aliadas a la vez
  const X = await ev(() => {
    const G = window.__G, M = window.__mach, T = window.__t;
    for (const b of [...M.MX.act]) M.shutdown(b, 'prueba');
    const ks = ['dron', 'medico', 'robot', 'ametralladora'], got = [];
    for (const k of ks) { const s = M.slots().find((q) => q.k === k && q.st === 'dormant'); if (!s) continue; const b = T.near(s, 3); if (b) { M.activate(b, { riesgo: 1, traza: 0 }); got.push(k); } }
    const out = { got, act: M.MX.act.length, max: M.cfg.maxActive };
    for (const b of [...M.MX.act]) M.shutdown(b, 'prueba');
    return out;
  });
  check('como máximo 3 aliadas activas a la vez (al activar la cuarta se apaga la de menos batería)', X.act === 3 && X.act === X.max, JSON.stringify(X));

  // 11) dron explorador: te guía hasta una pista sin descubrir
  const GD = await ev(() => {
    const G = window.__G, M = window.__mach, T = window.__t, S = M.state();
    const s = M.slots().find((q) => q.k === 'guia' && q.reg === 0 && q.st === 'dormant');
    const b = T.near(s, 3);
    const tgt = M.guideTarget(b);
    const out = { hasTarget: !!tgt, what: tgt && tgt.what, d0: tgt && Math.round(Math.hypot(tgt.x - b.x, tgt.z - b.z)) };
    const lines = M.hackDone(b, { ok: true, traza: 0, riesgo: 1 });
    out.mode = b.mode; out.st = s.st; out.lines = lines.length; out.path = b.guide && b.guide.path.length;
    const last = b.guide.path[b.guide.path.length - 1]; out.endNear = b.guide.tgt && Math.hypot(last[0] - b.guide.tgt.x, last[1] - b.guide.tgt.z) < 3;
    // el jugador va detrás del dron: cada 15 fotogramas se coloca a 3 m de él
    let it = 0;
    for (; it < 500 && !b.guide.arrived && b.mode === 'guide'; it++) {
      const f = G.map.findFree(b.x - 2, b.z - 2, 5, 0.5); G.player.x = f[0]; G.player.z = f[1]; G.player.inv = 1e9;
      window.__step(15, 1 / 30);
    }
    out.arrived = b.guide && b.guide.arrived; out.iters = it;
    const tg = b.guide.tgt; const f2 = G.map.findFree(tg.x, tg.z + 2.5, 4, 0.5); G.player.x = f2[0]; G.player.z = f2[1];
    window.__step(45, 1 / 30);
    out.rev = !!(S.rev && S.rev[tg.id]); out.shown = b.guide.shown;
    window.__step(30 * 11, 1 / 30);
    out.mode2 = b.mode; out.gone = !!b.dead; out.stats = S.stats.guia;
    return out;
  });
  console.log('guía', JSON.stringify(GD));
  check('el dron explorador elige una pista de su región, calcula un camino que acaba en ella, te espera y la revela (marca en el minimapa)', GD.hasTarget && GD.mode === 'guide' && GD.st === 'used' && GD.path >= 2 && GD.endNear && GD.arrived && GD.rev && GD.shown, JSON.stringify(GD));
  check('al terminar el dron se retira y la máquina queda gastada para siempre', GD.mode2 === 'gone' && GD.gone && GD.stats === 1, JSON.stringify({ m: GD.mode2, g: GD.gone, s: GD.stats }));

  // 12) baliza de suministros
  const BL = await ev(() => {
    const G = window.__G, M = window.__mach, T = window.__t, S = M.state();
    const s = M.slots().find((q) => q.k === 'baliza' && q.reg === 0 && q.st === 'dormant');
    const b = T.near(s, 3);
    const A = G.loreApi, loreN = () => A.entries.filter((e) => A.has(e.id)).length; const matSum = () => Object.values(G.S.mats).reduce((a, b) => a + b, 0) + G.S.credits; const pk0 = G.pickups.length, inv0 = G.S.inv.length, lore0 = loreN(), chips0 = (G.S.chips || []).length, m0 = matSum();
    const lines = M.hackDone(b, { ok: true, traza: 0, riesgo: 1 });
    const out = { mode: b.mode, st: s.st, lines: lines.length };
    window.__step(30 * 5, 1 / 30); out.pods = M.MX.fxs.filter((f) => f.k === 'pod').length; out.podSt = M.MX.fxs[0] && M.MX.fxs[0].st;
    window.__step(30 * 4, 1 / 30);
    out.podSt2 = M.MX.fxs[0] && M.MX.fxs[0].st;
    window.__step(30 * 2, 1 / 30);
    out.items = G.pickups.filter((q) => q.k === 'item').length; out.mats = G.pickups.filter((q) => q.k === 'mat' || q.k === 'cr').length;
    out.rar = G.pickups.filter((q) => q.k === 'item').map((q) => q.item.r);
    out.gain = loreN() - lore0; out.chips = (G.S.chips || []).length - chips0;
    out.stats = S.stats.baliza; out.spent = b.mode; out.gainMats = matSum() - m0;
    return out;
  });
  console.log('baliza', JSON.stringify(BL));
  check('la baliza de suministros llama a una cápsula que cae, se abre y deja equipo (rareza ≥ Raro) o lore, más materiales', BL.mode === 'beacon' && BL.st === 'used' && BL.pods === 1 && BL.podSt2 !== 'fall' && (BL.items >= 1 || BL.gain >= 1) && BL.rar.every((r) => r >= 2) && BL.gainMats > 0 && BL.stats === 1, JSON.stringify(BL));

  // 13) ascensor de carga
  const LF = await ev(() => {
    const G = window.__G, M = window.__mach, T = window.__t, S = M.state();
    const s = M.slots().find((q) => q.k === 'ascensor' && q.reg === 0 && q.st === 'dormant');
    const b = T.near(s, 4);
    if (!b) return { err: 'sin cuerpo', s: { ...s }, tile: G.map.t(Math.floor(s.x), Math.floor(s.z)), blk: G.map.blk[G.map.idx(Math.floor(s.x), Math.floor(s.z))], d: Math.hypot(G.player.x - s.x, G.player.z - s.z), bodies: M.bodies().length, mode: G.mode };
    for (const q of G.pickups.slice()) q.life = 0; window.__step(2, 1 / 30);
    const matSum = () => Object.values(G.S.mats).reduce((a, c) => a + c, 0) + G.S.credits, m0 = matSum();
    const lines = M.hackDone(b, { ok: true, traza: 0, riesgo: 1 });
    const out = { mode: b.mode, st: s.st };
    window.__step(30 * 2, 1 / 30); out.mid = +b.mesh.userData.car.position.y.toFixed(2); out.carVis = b.mesh.userData.car.visible;
    window.__step(30 * 4, 1 / 30);
    out.top = +b.mesh.userData.car.position.y.toFixed(2);
    out.items = G.pickups.filter((q) => q.k === 'item').length; out.mats = G.pickups.filter((q) => q.k === 'mat' || q.k === 'cr').length;
    out.rar = G.pickups.filter((q) => q.k === 'item').map((q) => q.item.r);
    out.stats = S.stats.ascensor; out.after = b.mode; out.gainMats = matSum() - m0;
    return out;
  });
  console.log('ascensor', JSON.stringify(LF));
  check('el ascensor de carga abre la escotilla, sube el palé (de −2,8 a +0,15) y deja 2-3 objetos de rareza ≥ Raro y materiales', LF.mode === 'lift' && LF.st === 'used' && LF.carVis && LF.mid > -2.8 && LF.top > 0 && LF.items >= 2 && LF.rar.every((r) => r >= 2) && LF.gainMats > 0 && LF.after === 'spent', JSON.stringify(LF));

  // 14) guardado: JSON puro, migración idempotente y estado sucio saneado
  const P = await ev(() => {
    const G = window.__G, M = window.__mach, S = G.S;
    const copy = JSON.parse(JSON.stringify(S));
    M.migrate(copy); const j = JSON.stringify(copy.mach); M.migrate(copy);
    const same = JSON.stringify(copy.mach) === j && Object.keys(copy.mach.slots).length === Object.keys(S.mach.slots).length;
    const dirty = { mach: { slots: { a: { k: 'zzz', x: 1, z: 1 }, b: { k: 'dron', x: 'x', z: 2 }, c: { k: 'robot', x: 10, z: 12, st: 'active', reg: 3 }, d: { k: 'guia', x: 5, z: 6, st: 'weird' } }, seed: -4, stats: [] } };
    M.migrate(dirty);
    return { same, ids: Object.keys(dirty.mach.slots), c: dirty.mach.slots.c && dirty.mach.slots.c.st, d: dirty.mach.slots.d && dirty.mach.slots.d.st, u: dirty.mach.slots.d && dirty.mach.slots.d.u, seedOk: dirty.mach.seed > 0, stats: typeof dirty.mach.stats };
  });
  check('S.mach es JSON puro, la migración es idempotente y el estado sucio se sanea (huecos inválidos fuera, aliadas dormidas, tipos únicos marcados)', P.same && JSON.stringify(P.ids) === '["c","d"]' && P.c === 'dormant' && P.d === 'dormant' && P.u === 1 && P.seedOk && P.stats === 'object', JSON.stringify(P));

  const f = results.filter((r) => !r.ok);
  console.log(f.length ? 'FALLOS: ' + f.map((q) => q.name).join(' | ') : `TODO OK ${results.length}/${results.length}`);
  return results;
}
