// D8b · combates de jefe en tres fases (31g-bosses.js): transiciones, mecánica propia de cada jefe, generadores, vacío, escudo de crías y furia
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/jefes-fases.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs, shot } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); window.__toastLog = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.textContent && window.__toastLog.push(n.textContent)))).observe(document.querySelector('#toasts'), { childList: true }); });
  await api.region('valle');
  // lejos del Bastión (sus torretas aliadas disparan a los jefes: 12 % de su vida por tiro) y de las guaridas, en una región sin peligro ambiental
  // (en el desierto el calor mata al jugador parado durante las pruebas)
  const spot = await ev(() => { const G = window.__G; const [sx, sz] = G.map.findFree(216, 150, 10, 0.8); return { x: sx, z: sz }; });
  await api.teleport(spot.x, spot.z);
  await ev(() => { const G = window.__G; G.S.lvl = 30; G.player.recalc(); });

  // utilidades dentro de la página
  await ev(() => {
    window.__t = {
      boss(id, lvl, dx = 14) { const G = window.__G, p = G.player; const b = window.__spawn(id, lvl, p.x + dx, p.z, { boss: true, alerted: true }); b.alerted = true; return b; },
      clear() { const G = window.__G, p = G.player; for (const e of G.enemies) if (!e.dead) { e.dead = true; e.deadT = 0; } if (p.dead) { p.dead = false; p.rig.root.rotation.z = 0; p.rig.root.position.y = 0; } p.hp = p.maxHp; if (G.uiOpen) window.__dbg.UI.close(); G.paused = false; G.projs.length = 0; },
      step(n) { window.__step(n, 1 / 30); },
      // el mundo genera manadas alrededor del jugador (y el jefe invoca crías al cambiar de fase) y sus ataques falsearían las mediciones: se barren (los jefes y sus generadores no)
      sweep(adds) { for (const e of window.__G.enemies) if (!e.dead && !e.boss && (adds || !e.parent) && !e.pylonOf) { e.dead = true; e.deadT = 0; } },
      god(on) { const p = window.__G.player; p.inv = on ? 1e9 : 0; if (on) { if (!p._ws) p._ws = p.ws; p.ws = [null, null]; } else if (p._ws) { p.ws = p._ws; p._ws = null; } },
    };
  });
  const IDS = ['reina', 'demoledor', 'kharsa', 'madre', 'wendigo', 'omega', 'ifrit', 'horror', 'mente', 'carnicero', 'antiguo', 'leviatan', 'titan', 'avatar'];

  // 1) los 14 jefes: fase 1 → 2 → 3 con su aviso, bloqueo breve y mecánica propia sin errores
  const rows = [];
  for (const id of IDS) {
    const r = await ev((id) => {
      const T = window.__t, G = window.__G, C = G.cfg.bossSig;
      T.clear(); T.god(true);
      const b = T.boss(id, 30); const out = { id, p0: b.phase };
      T.step(4); out.init = !!b.sig;
      const dmg0 = b.dmg, moves0 = b.moves.length;
      b.hp = b.maxHp * 0.6; T.step(2);
      out.p1 = b.phase; out.lock = b.sig.lock > 0; out.invulnLock = b.invuln; out.dmgUp = +(b.dmg / dmg0).toFixed(2);
      T.step(80);            // 2,7 s: acaba el bloqueo (1,6 s)
      out.pylons2 = b.sig.pylons.length;
      // si hay generadores la fase 3 no empieza hasta destruirlos: se destruyen para seguir
      for (const e of b.sig.pylons) { e.hp = 0; e.dead = true; e.deadT = 0; } T.step(3);
      b.hp = b.maxHp * 0.3; T.step(3);
      out.p2 = b.phase; out.moves = b.moves.length - moves0;
      T.step(80);
      out.pylons3 = b.sig.pylons.length;
      for (const e of b.sig.pylons) { e.hp = 0; e.dead = true; e.deadT = 0; } T.step(3);
      out.stunAfter = b.sig.stun > 0;
      out.zones = b.sig.zones.length; out.spec = Object.keys((C.boss[id].p3 || {}).mech || {});
      out.tag = window.bossHudTagTest ? 0 : 0;
      T.god(false); T.clear();
      return out;
    }, id);
    rows.push(r);
  }
  console.log(JSON.stringify(rows.map((r) => ({ id: r.id, p: [r.p0, r.p1, r.p2], lock: r.lock, dmgUp: r.dmgUp, ext: r.moves, mech3: r.spec, pil: [r.pylons2, r.pylons3] }))));
  check('los 14 jefes arrancan en fase 1 con estado de fases', rows.every((r) => r.p0 === 1 && r.init));
  check('al bajar del 66 % de vida entran en la fase 2 con un bloqueo breve de invulnerabilidad', rows.every((r) => r.p1 === 2 && r.lock && r.invulnLock), JSON.stringify(rows.filter((r) => !(r.p1 === 2 && r.lock && r.invulnLock)).map((r) => r.id)));
  check('al bajar del 33 % entran en la fase 3', rows.every((r) => r.p2 === 3), JSON.stringify(rows.map((r) => r.p2)));
  check('cada fase sube el daño un 10 %', rows.every((r) => r.dmgUp === 1.1), JSON.stringify(rows.map((r) => r.dmgUp)));
  check('cada jefe suma movimientos nuevos en sus fases (o mecánica propia)', rows.every((r) => r.moves > 0 || r.spec.length > 0), JSON.stringify(rows.map((r) => [r.id, r.moves])));
  check('cada jefe tiene mecánica propia en la fase 3', rows.every((r) => r.spec.length > 0));

  // 2) generadores (omega): invulnerable hasta destruirlos; después aturdido con +50 % de daño
  const gen = await ev(() => {
    const T = window.__t, G = window.__G, C = G.cfg.bossSig; T.clear(); T.god(true);
    const p = G.player; // T.god(true) ya lo desarma: el autofuego no destruye los generadores por su cuenta
    const b = T.boss('omega', 30); T.step(4); b.hp = b.maxHp * 0.6; T.step(3);
    const out = { phase: b.phase, pyl: b.sig.pylons.length, invuln: b.invuln, targetable: b.targetable(), kinds: b.sig.pylons.map((e) => e.id) };
    T.step(60);
    out.pylStill = b.sig.pylons.length; out.pylDetail = G.enemies.filter((e) => e.pylonOf === b).map((e) => [Math.round(e.hp), e.dead]);
    for (const e of b.sig.pylons) { e.hp = 0; e.dead = true; e.deadT = 0; } T.step(3);
    out.after = { pyl: b.sig.pylons.length, invuln: b.invuln, stun: +b.sig.stun.toFixed(2), mul: +b.dmgTakenMul().toFixed(3) };
    T.step(100);          // 3,3 s: pasa el aturdimiento de 3 s
    out.later = { stun: +b.sig.stun.toFixed(2), mul: +b.dmgTakenMul().toFixed(3), phase: b.phase, pyl: b.sig.pylons.length };
    // fase 3 con el jefe aturdido: la fase cambia igualmente y corta el aturdimiento
    b.sig.stun = 2; b.hp = b.maxHp * 0.3; T.step(3);
    out.p3 = { phase: b.phase, stun: b.sig.stun, pyl: b.sig.pylons.length, invuln: b.invuln };
    T.god(false); T.clear(); return out;
  });
  console.log('generadores', JSON.stringify(gen));
  check('omega fase 2: aparecen 2 generadores y el jefe es invulnerable e intargetable', gen.phase === 2 && gen.pyl === 2 && gen.pylStill === 2 && gen.invuln && !gen.targetable, JSON.stringify(gen));
  check('destruidos los generadores: el jefe queda aturdido y recibe +50 % de daño', gen.after.pyl === 0 && !gen.after.invuln && gen.after.stun > 2.5 && gen.after.mul === 1.5, JSON.stringify(gen.after));
  check('pasado el aturdimiento vuelve al daño normal', gen.later.stun === 0 && gen.later.mul === 1 && gen.later.phase === 2 && gen.later.pyl === 0, JSON.stringify(gen.later));
  check('la fase 3 empieza aunque esté aturdido, corta el aturdimiento y trae 3 generadores', gen.p3.phase === 3 && gen.p3.stun === 0 && gen.p3.pyl === 3 && gen.p3.invuln, JSON.stringify(gen.p3));

  // 3) escudo de crías (reina): -65 % de daño mientras vivan crías
  const esc = await ev(() => {
    const T = window.__t, G = window.__G, C = G.cfg.bossSig; T.clear(); T.god(true);
    const b = T.boss('reina', 30, 12); T.step(4); b.hp = b.maxHp * 0.6; T.step(90);
    const adds = G.enemies.filter((e) => e.parent === b && !e.dead).length;
    const out = { adds, on: b.sig.shieldOn, mulOn: +b.dmgTakenMul().toFixed(3) };
    for (const e of G.enemies) if (e.parent === b) { e.dead = true; e.deadT = 0; }
    b.sig.adsT2 = 0; T.step(10);
    out.on2 = b.sig.shieldOn; out.mulOff = +b.dmgTakenMul().toFixed(3);
    T.god(false); T.clear(); return out;
  });
  console.log('escudo', JSON.stringify(esc));
  check('reina fase 2: con crías vivas hay escudo y el daño recibido baja al 35 %', esc.adds > 0 && esc.on && Math.abs(esc.mulOn / esc.mulOff - 0.35) < 0.02, JSON.stringify(esc));
  check('sin crías el escudo se rompe', !esc.on2 && esc.mulOff > esc.mulOn);

  // 4) zonas (demoledor, fase 2): el jugador parado recibe el golpe; lejos del círculo no
  const zon = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player; T.clear(); T.god(true);   // desarmado (si no, su autofuego mata al jefe antes de las zonas) pero vulnerable
    p.inv = 0; p.hp = p.maxHp; p.shield = 0;
    const b = T.boss('demoledor', 12, 14); T.step(4); b.hp = b.maxHp * 0.6; T.step(60);
    b.dmg = 20; b.sig.zT = 0.1; b.moveT = 1e9; p.hp = p.maxHp; p.shield = 0; p.inv = 0;   // el jefe solo hace sus zonas: el golpe se nota pero no mata
    let created = 0, minHp = p.hp;
    for (let i = 0; i < 400; i++) { T.sweep(true); T.step(1); created = Math.max(created, b.sig.zones.length); minHp = Math.min(minHp, p.hp); }
    T.god(false); T.clear(); return { created, hp: +minHp.toFixed(1), max: +p.maxHp.toFixed(1) };
  });
  console.log('zonas', JSON.stringify(zon));
  check('demoledor fase 2: se crean zonas telegrafiadas y el jugador parado recibe el golpe (sin matarlo)', zon.created >= 1 && zon.hp < zon.max && zon.hp > 0, JSON.stringify(zon));

  // 5) vacío (horror, fase 2): atrae al jugador quieto hacia el jefe
  const vac = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player; T.clear(); T.god(true);
    // sitio con el camino libre de verdad (colisiones, no solo línea de visión): un obstáculo frena el arrastre y eso es lo que debe pasar
    const clear = (qx, qz) => { let cx = p.x, cz = p.z; for (let i = 0; i < 120; i++) { const dx = qx - cx, dz = qz - cz, d = Math.hypot(dx, dz); if (d < 4) return true; const [nx, nz] = G.map.slideMove(cx, cz, p.r, (dx / d) * 0.15, (dz / d) * 0.15); if (Math.hypot(nx - cx, nz - cz) < 0.05) return false; cx = nx; cz = nz; } return false; };
    let b = null;
    for (const dx of [16, -16, 12, -12]) for (const dz of [0, 8, -8, 14, -14]) { if (b) break; const qx = p.x + dx, qz = p.z + dz; if (clear(qx, qz)) b = window.__spawn('horror', 30, qx, qz, { boss: true, alerted: true }); }
    if (!b) b = T.boss('horror', 30, 16);
    T.step(4); b.hp = b.maxHp * 0.6; T.step(60);
    b.sig.vT = 0.05; b.static = true; T.sweep(true);
    const d0 = Math.hypot(b.x - p.x, b.z - p.z); let started = false, dMin = d0;
    for (let i = 0; i < 90; i++) { T.sweep(true); T.step(1); if (b.sig.vac) started = true; dMin = Math.min(dMin, Math.hypot(b.x - p.x, b.z - p.z)); }
    T.god(false); T.clear(); return { started, d0: +d0.toFixed(2), dMin: +dMin.toFixed(2) };
  });
  console.log('vacío', JSON.stringify(vac));
  check('horror fase 2: el vacío arranca y acerca al jugador al jefe', vac.started && vac.dMin < vac.d0 - 1.5, JSON.stringify(vac));

  // 6) ventisca (wendigo, fase 2): ralentiza lejos del jefe
  const ven = await ev(() => {
    const T = window.__t, G = window.__G, p = G.player; T.clear(); T.god(true);
    const b = T.boss('wendigo', 30, 22); T.step(4); b.hp = b.maxHp * 0.6; b.static = true; T.step(60);
    p.slowT = 0; T.step(3); return { slow: p.slowT > 0, dist: +Math.hypot(b.x - p.x, b.z - p.z).toFixed(1) };
  });
  check('wendigo fase 2: la ventisca ralentiza al jugador lejos del jefe', ven.slow, JSON.stringify(ven));

  // 7) furia: el temporizador acaba y el jefe se enfurece; no corre con el jefe invulnerable
  const fur = await ev(() => {
    const T = window.__t, G = window.__G; T.clear(); T.god(true);
    const b = T.boss('ifrit', 30, 20); T.step(4);
    const d0 = b.dmg, s0 = b.spd, f0 = b.sig.fury;
    T.step(30); const f1 = b.sig.fury;
    b.sig.fury = 0.2; T.step(15);
    const out = { f0: +f0.toFixed(1), f1: +f1.toFixed(1), enr: b.sig.enraged, dmg: +(b.dmg / d0).toFixed(2), spd: +(b.spd / s0).toFixed(2), gap: +G.cfg.bossSig.gap[0], tagEnr: null };
    out.run = f0 - f1 > 0.5;
    // invulnerable: el reloj se detiene
    const c = T.boss('omega', 30, 20); T.step(4); c.hp = c.maxHp * 0.6; T.step(90);
    const g0 = c.sig.fury; T.step(60); out.paused = Math.abs(c.sig.fury - g0) < 0.01 && c.invuln;
    T.god(false); T.clear(); return out;
  });
  console.log('furia', JSON.stringify(fur));
  check('el temporizador de furia corre en combate (210 s + 14 s por región)', fur.run && fur.f0 > 200 && fur.f0 < 400, JSON.stringify(fur));
  check('al agotarse: furia (daño ×1,35, velocidad ×1,15)', fur.enr && fur.dmg === 1.35 && fur.spd === 1.15, JSON.stringify(fur));
  check('con el jefe invulnerable (generadores) el reloj de furia se detiene', fur.paused);

  // 8) la barra de jefe enseña fase, mecánica y furia; marcas de fase en la barra
  await ev(() => { const T = window.__t, G = window.__G; T.clear(); T.god(true); const b = T.boss('reina', 30, 12); T.step(4); b.hp = b.maxHp * 0.6; T.step(90); window.__hudBoss = b; });
  await wait(10);
  const hud = await ev(() => {
    const el = document.querySelector('#bTitle'); const mark = getComputedStyle(document.querySelector('#bossbar .bar'), '::after').backgroundImage;
    return { title: el && el.textContent, mark, shown: getComputedStyle(document.querySelector('#bossbar')).display };
  });
  console.log('hud', JSON.stringify(hud));
  check('la barra de jefe muestra la fase y su mecánica', /FASE II/.test(hud.title || '') && /Cría protectora/.test(hud.title || ''), hud.title);
  check('la barra tiene marcas de fase', /linear-gradient/.test(hud.mark || ''), (hud.mark || '').slice(0, 80));
  await shot('barra-jefe');
  await ev(() => { window.__t.god(false); window.__t.clear(); });

  // 9) «Vástago»: conservan la transición única al 50 %
  const mini = await ev(() => {
    const T = window.__t; T.clear(); T.god(true);
    const b = window.__spawn('demoledor', 12, window.__G.player.x + 12, window.__G.player.z, { boss: true, mini: true, alerted: true, hpMul: 0.22 });
    T.step(30); b.hp = b.maxHp * 0.6; T.step(30); const a = b.phase; b.hp = b.maxHp * 0.4; T.step(30);
    const r = { at60: a, at40: b.phase, sig: !!b.sig }; T.god(false); T.clear(); return r;
  });
  check('los jefes «Vástago» siguen con la transición única al 50 % (sin fases nuevas)', mini.at60 === 1 && mini.at40 === 2 && !mini.sig, JSON.stringify(mini));

  // 10) limpieza: al morir el jefe no quedan generadores
  const lim = await ev(() => {
    const T = window.__t, G = window.__G; T.clear(); T.god(true);
    const b = T.boss('titan', 30); T.step(4); b.hp = b.maxHp * 0.6; T.step(90);
    const n = b.sig.pylons.length; b.invuln = false; b.hp = 0; b.kill && b.kill({}); T.step(10);
    const left = G.enemies.filter((e) => e.pylonOf === b && !e.dead).length;
    T.god(false); T.clear(); return { n, left, dead: b.dead };
  });
  check('si el jefe muere se retiran sus generadores', lim.n === 3 || lim.n === 2 ? lim.left === 0 && lim.dead : false, JSON.stringify(lim));

  const toasts = await ev(() => window.__toastLog.slice());
  check('hay avisos con consejos (escudo, generadores, gravedad)', toasts.some((t) => /generadores/i.test(t)) && toasts.some((t) => /protegido por sus crías/i.test(t)), toasts.filter((t) => /escudo|generador|gravedad|crías|ventisca/i.test(t)).slice(0, 4).join(' | '));
  await shot('fase-escudo');
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `FALLAN ${bad.length}/${results.length}` : `TODO OK ${results.length}/${results.length}`);
}
