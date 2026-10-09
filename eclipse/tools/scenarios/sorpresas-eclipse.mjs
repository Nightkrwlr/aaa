// D10a · Eclipses (31i-surprises.js): planificación, presagio, élites eclipsadas, Heraldo, Fragmentos, cielo y limpieza
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/sorpresas-eclipse.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs, shot } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); window.__seedRng && window.__seedRng(77); window.__toastLog = []; window.__tl = () => window.__toastLog.concat([...document.querySelectorAll('#toasts .toast')].map((n) => n.textContent)); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.textContent && window.__toastLog.push(n.textContent)))).observe(document.querySelector('#toasts'), { childList: true }); });
  await api.region('valle');
  // lejos del Bastión y de las guaridas
  const spot = await ev(() => { const G = window.__G; const [sx, sz] = G.map.findFree(216, 150, 10, 0.8); return { x: sx, z: sz }; });
  await api.teleport(spot.x, spot.z);
  await ev(() => {
    const G = window.__G; G.S.lvl = 12; G.player.recalc();
    window.__t = {
      step(n) { window.__step(n, 1 / 30); },
      // el mundo genera manadas normales alrededor: se barren las que no son del Eclipse para medir limpio
      sweep() { for (const e of window.__G.enemies) if (!e.dead && !e.eclE) { e.dead = true; e.deadT = 0; } },
      god(on) { const p = window.__G.player; p.inv = on ? 1e9 : 0; if (on) { if (!p._ws) p._ws = p.ws; p.ws = [null, null]; } else if (p._ws) { p.ws = p._ws; p._ws = null; } },
      E() { return window.__G.S.sx.ecl; },
    };
  });

  // 1) estado guardado y programación
  const s0 = await ev(() => { const G = window.__G, q = G.S.sx; return { v: q.v, keys: Object.keys(q), st: q.ecl.st, next: q.ecl.next, play: G.S.playTime, first: G.cfg.eclipse.firstS }; });
  check('S.sx existe al empezar la partida con todas las secciones', s0.v === 1 && ['ecl', 'nem', 'pact', 'siege', 'base', 'con'].every((k) => s0.keys.includes(k)), JSON.stringify(s0.keys));
  check('el primer Eclipse queda programado a firstS segundos de juego', s0.st === 'idle' && Math.abs(s0.next - s0.play - s0.first) < 5, `next ${Math.round(s0.next)} play ${Math.round(s0.play)}`);
  const mig = await ev(() => { const G = window.__G; const S = { playTime: 100, lvl: 3 }; G.migrations.forEach((m) => m(S)); const a = JSON.stringify(S.sx); G.migrations.forEach((m) => m(S)); return { same: JSON.stringify(S.sx) === a, next: S.sx.ecl.next }; });
  check('la migración es idempotente y programa el primer Eclipse desde el tiempo de juego', mig.same && mig.next === 100 + 1500);

  // 2) en el Bastión no empieza (se reintenta); fuera, sí
  const base = await ev(() => { const G = window.__G; const b = G.map.pois.base; return { x: b.x, z: b.z + 3 }; });
  await api.teleport(base.x, base.z);
  const inBase = await ev(() => {
    const T = window.__t, G = window.__G; T.god(true); G.S.sx.ecl.next = G.S.playTime - 1; T.step(40);
    const E = T.E(); return { st: E.st, inBase: G.world.inBase(), next: E.next - G.S.playTime, safe: G.inSafe };
  });
  check('en el Bastión el Eclipse no empieza y se reprograma unos segundos después', inBase.st === 'idle' && inBase.next > 0 && inBase.next <= 13, JSON.stringify(inBase));
  await api.teleport(spot.x, spot.z);
  await ev(() => { window.__t.sweep(); });

  // 3) presagio
  const om = await ev(() => {
    const T = window.__t, G = window.__G; T.god(true); G.S.sx.ecl.next = G.S.playTime - 1; T.step(30);
    const E = T.E(); const r0 = { st: E.st, t: +E.t.toFixed(1), kills: E.kills };
    T.step(600);   // 20 s
    r0.k20 = +window.__sx.R.k.toFixed(2); r0.night = +G.night.toFixed(2); r0.left = +E.t.toFixed(1);
    return r0;
  });
  check('con el Eclipse programado y el jugador fuera de refugio empieza el presagio', om.st === 'omen' && om.t > 38 && om.t <= 40, JSON.stringify(om));
  check('durante el presagio el cielo se oscurece sin llegar a ser noche cerrada', om.k20 > 0.04 && om.k20 < 0.4 && om.night < 0.5, `k ${om.k20} noche ${om.night}`);
  check('avisa con un banner y un mensaje de ARGOS', await ev(() => window.__tl().some((t) => /ARGOS/.test(t)) && /CIELO SE APAGA/i.test(document.querySelector('#banner').textContent)));
  await shot('presagio');

  // 4) el Eclipse
  const on = await ev(() => {
    const T = window.__t, G = window.__G; T.step(21 * 30);
    const E = T.E(); T.step(10 * 30);
    return { st: E.st, hera: E.hera, k: +window.__sx.R.k.toFixed(2), night: +G.night.toFixed(2), sunEl: +G.sunEl.toFixed(2), bossMul: window.__sx.ecl.bossMul(), left: +E.t.toFixed(1), veil: document.getElementById('sxVeil') && document.getElementById('sxVeil').style.opacity, pill: document.querySelector('#sxBar .ecl') && document.querySelector('#sxBar .ecl').textContent };
  });
  check('pasados 40 s del presagio empieza el Eclipse', on.st === 'on', JSON.stringify(on));
  check('en el Eclipse el cielo se apaga (noche, sol bajo el horizonte, velo de pantalla)', on.k > 0.5 && on.night > 0.6 && on.sunEl < 0.4 && +on.veil >= 0.25, JSON.stringify(on));
  check('las reliquias de jefe se multiplican mientras dura', on.bossMul === 1.5);
  check('la etiqueta del HUD muestra la cuenta atrás', /ECLIPSE/.test(on.pill || ''), on.pill);

  // 5) criaturas eclipsadas y Heraldo
  const cr = await ev(() => {
    const T = window.__t, G = window.__G, R = window.__sx.R.ecl; const out = { maxPulses: 0, maxAlive: 0 };
    for (let i = 0; i < 12; i++) { T.step(150); out.maxPulses = Math.max(out.maxPulses, R.pulses.length); let a = 0; for (const e of R.live) e.dead || e.eclHera || a++; out.maxAlive = Math.max(out.maxAlive, a); }
    const live = [...R.live].filter((e) => !e.dead);
    out.n = live.length; out.hera = T.E().hera; out.heraldo = !!(R.heraldo && !R.heraldo.dead) && { champion: R.heraldo.champion, mods: R.heraldo.mods, name: R.heraldo.name, lvl: R.heraldo.lvl, boss: R.heraldo.boss };
    out.allMod = live.every((e) => e.mods[0] === 'eclipsado' && e.eclE && e.persist);
    out.region = live.every((e) => G.map.regAt(e.x, e.z) === G.regionId);
    out.safe = live.some((e) => G.world.safeAt(e.x, e.z));
    out.src = live.filter((e) => !e.eclHera).map((e) => window.__sx.srcOf(e));
    out.srcH = live.filter((e) => e.eclHera).map((e) => window.__sx.srcOf(e));
    out.names = live.filter((e) => !e.eclHera).slice(0, 4).map((e) => e.displayName);
    out.elite = live.every((e) => e.elite === 0xb86cff);
    out.hp = live.slice(0, 3).map((e) => Math.round(e.maxHp));
    return out;
  });
  check('aparecen élites eclipsadas (hasta el máximo) en la región del jugador, nunca en refugios', cr.n > 0 && cr.maxAlive <= 6 && cr.maxAlive >= 3 && cr.region && !cr.safe, JSON.stringify(cr));
  check('llevan el modificador «eclipsado» (violeta), persisten y su botín es el de la fuente «eclipse»', cr.allMod && cr.elite && cr.src.every((s) => s === 'eclipse'), JSON.stringify(cr.src) + ' ' + cr.names);
  check('el Heraldo del Eclipse sale a los pocos segundos: campeón gigante eclipsado', cr.hera === 1 && cr.heraldo && cr.heraldo.champion && cr.heraldo.mods[0] === 'eclipsado' && cr.heraldo.mods.includes('gigante') && !cr.heraldo.boss, JSON.stringify(cr.heraldo));
  check('el Heraldo usa la tabla de botín de campeón', cr.srcH.every((s) => s === 'champion'));
  check('lanzan pulsos de sombra telegrafiados sobre el jugador', cr.maxPulses > 0, `máx ${cr.maxPulses}`);
  await shot('eclipse-criaturas');

  // 7) Fragmentos: las élites corrientes sueltan uno con poca probabilidad (tope por Eclipse)
  const fr = await ev(() => {
    const T = window.__t, G = window.__G, R = window.__sx.R.ecl, E = T.E(), C = G.cfg.eclipse;
    const f0 = G.S.eclipseFrag | 0; C.fragP = 1;
    const live = [...R.live].filter((e) => !e.dead && !e.eclHera);
    while (live.length < 3) { const e = window.__sx.ecl.spawn(false); if (!e) break; live.push(e); }
    live[0].kill({}); const f1 = G.S.eclipseFrag | 0; live[1].kill({}); const f2 = G.S.eclipseFrag | 0;
    C.fragP = 0.05;
    return { f0, f1, f2, kills: E.kills, ef: E.frag, cap: C.fragCap };
  });
  check('una élite eclipsada puede soltar un Fragmento de Eclipse y el tope por Eclipse se respeta', fr.f1 === fr.f0 + 1 && fr.f2 === fr.f1 && fr.ef === 1 && fr.kills >= 2, JSON.stringify(fr));

  // 8) matar al Heraldo rompe el Eclipse: Fragmento seguro, fin y limpieza
  const he = await ev(() => {
    const T = window.__t, G = window.__G, R = window.__sx.R.ecl, E = T.E();
    const f0 = G.S.eclipseFrag | 0, pk0 = G.pickups.length, h = R.heraldo; const alive0 = [...R.live].filter((e) => !e.dead).length;
    h.kill({}); T.step(3);
    const out = { st: E.st, hera: E.hera, fragGot: (G.S.eclipseFrag | 0) - f0, pickups: G.pickups.length - pk0, alive0, liveAfter: [...R.live].filter((e) => !e.dead).length, set: R.live.size, nextIn: Math.round(E.next - G.S.playTime), heraldoNull: R.heraldo === null, bannerOk: /HERALDO ABATIDO/.test(document.querySelector('#banner').textContent) || window.__tl().some((t) => /Fragmento de Eclipse/.test(t)) };
    out.dead = G.enemies.filter((e) => e.eclE && !e.dead).length;
    T.step(10 * 30); out.k = +window.__sx.R.k.toFixed(2); out.st2 = E.st; out.night = +G.night.toFixed(2); out.bossMul = window.__sx.ecl.bossMul();
    return out;
  });
  check('abatir al Heraldo da un Fragmento seguro y fin del Eclipse (fase «end»)', he.st === 'end' && he.hera === 2 && he.fragGot === 1, JSON.stringify(he));
  check('al terminar, las criaturas que quedan se desvanecen sin botín', he.liveAfter === 0 && he.dead === 0 && he.set === 0, JSON.stringify(he));
  check('el siguiente Eclipse queda programado dentro del intervalo (50-80 min)', he.nextIn >= 2990 && he.nextIn <= 4810, `en ${he.nextIn} s`);
  check('el cielo vuelve, el estado pasa a reposo y el multiplicador de jefes se anula', he.k < 0.4 && he.st2 === 'idle' && he.bossMul === 1, `k ${he.k} noche ${he.night}`);

  // 9) se acaba el tiempo con el Heraldo vivo: se escapa, sin Fragmento
  const ti = await ev(() => {
    const T = window.__t, G = window.__G, E = T.E(), R = window.__sx.R.ecl;
    T.sweep(); E.next = G.S.playTime - 1; T.step(30); window.__sx.ecl.begin(); T.step(15 * 30);
    const f0 = G.S.eclipseFrag | 0, hera = E.hera; const n0 = [...R.live].filter((e) => !e.dead).length;
    E.t = 2; T.step(3 * 30);
    return { hera, n0, st: E.st, fragGot: (G.S.eclipseFrag | 0) - f0, liveAfter: [...R.live].filter((e) => !e.dead).length, msg: window.__tl().some((t) => /el Heraldo escapa/.test(t)) };
  });
  check('si acaba el tiempo el Heraldo escapa: sin Fragmento y todo se desvanece', ti.hera === 1 && ti.n0 > 0 && ti.st === 'end' && ti.fragGot === 0 && ti.liveAfter === 0 && ti.msg, JSON.stringify(ti));

  // 10) morir durante el Eclipse lo termina; los jefes sueltan botín extra mientras dura
  const de = await ev(() => {
    const T = window.__t, G = window.__G, E = T.E(); T.sweep(); T.step(10 * 30); E.next = G.S.playTime - 1; T.step(30); window.__sx.ecl.begin(); T.step(60);
    const on = E.st; const p = G.player; T.god(false); p.inv = 0; p.shield = 0; p.hp = 1; p.hurt(9999, {}); T.step(2);
    const out = { on, st: E.st, dead: p.dead };
    G.dispatchRespawn && G.dispatchRespawn();
    return out;
  });
  check('si el jugador cae en pleno Eclipse este termina', de.on === 'on' && de.dead && de.st === 'end', JSON.stringify(de));
  await ev(() => { const G = window.__G, p = G.player; if (G.uiOpen) window.__dbg.UI.close(); p.dead = false; p.rig.root.rotation.z = 0; p.rig.root.position.y = 0; p.hp = p.maxHp; window.__t.god(true); });

  const bo = await ev(() => {
    const T = window.__t, G = window.__G, E = T.E(), p = G.player; T.sweep(); T.step(10 * 30);
    const q = []; const it = window.__G.pickups; const n0 = it.length;
    const mk = () => window.__spawn('reina', 20, p.x + 10, p.z, { boss: true, alerted: false });
    window.__sx.ecl.begin(); const a = mk(); const i0 = G.pickups.length; a.kill({}); const withEclipse = G.pickups.length - i0;
    window.__sx.ecl.end('debug'); T.step(5 * 30);
    const b = mk(); const i1 = G.pickups.length; b.kill({}); const without = G.pickups.length - i1;
    return { withEclipse, without, toast: window.__tl().some((t) => /botín extra/.test(t)) };
  });
  check('un jefe abatido en pleno Eclipse suelta botín extra (más pickups y aviso)', bo.toast && bo.withEclipse > bo.without, JSON.stringify(bo));

  // 11) un pulso de sombra aislado: estalla bajo el jugador, le hace daño si no se ha movido y no si se aparta
  const pu = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player, R = window.__sx.R.ecl, E = T.E(); T.sweep(); E.next = G.S.playTime - 1; T.step(30);
    if (E.st !== 'idle') window.__sx.ecl.end('debug'); T.step(10 * 30); window.__sx.ecl.begin(); const out = {};
    p.shield = 0; p.hp = p.maxHp; p.inv = 0; p.ws = [null, null];
    R.pulses.push({ x: p.x, z: p.z, t: 0.05, r: 3, dmg: 60 }); const a = p.hp; T.step(4); out.hit = Math.round(a - p.hp);
    p.inv = 0; p.hp = p.maxHp; R.pulses.push({ x: p.x + 8, z: p.z, t: 0.05, r: 3, dmg: 60 }); const b = p.hp; T.step(4); out.miss = Math.round(b - p.hp);
    out.left = R.pulses.length; window.__sx.ecl.end('debug'); T.god(true); return out;
  });
  check('un pulso de sombra hace daño bajo el jugador y no si este se aparta', pu.hit > 20 && pu.miss === 0 && pu.left === 0, JSON.stringify(pu));

  const bad = results.filter((r) => !r.ok);
  console.log(`\nRESULTADO sorpresas-eclipse: ${results.length - bad.length}/${results.length}`);
  if (bad.length) console.log('FALLOS: ' + bad.map((r) => r.name).join(' | '));
  else console.log('TODO OK ' + results.length + '/' + results.length);
}
