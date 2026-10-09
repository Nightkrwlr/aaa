// HACKEO · ciclo de vida y casos límite (revisión adversarial): otro panel encima (muerte), Esc y V con el cifrado abierto, reentrada,
// unidades controladas al cambiar de región, JSON puro y migración repetida, valores sucios en el guardado, límite de tiempo de la
// fuerza bruta en el peor caso y envoltorio de la IA enemiga (vale para la build minificada y la de desarrollo).
//   node tools/shot.mjs --html dist/eclipse.html --scenario tools/scenarios/hackeo-life.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  // D11: los enemigos ya no se hackean a mano por defecto (x.cfg.hack.enemy.manual = false; ahora se hackean máquinas, ver maquinas-core). Aquí se reactiva para seguir probando el motor de la sesión con enemigos.
  await ev(() => { window.__hack.cfg.enemy.manual = true; });
  await api.region('desierto');
  await ev(() => { const G = window.__G; G.world.packCd = 1e9; G.world.evT = 1e9; });

  // 1 · muerte (panel «death» encima) con la sesión abierta
  const a = await ev(() => {
    const G = window.__G, h = window.__hack, out = {};
    G.uiBlockDamage = true;
    let cbRes = null;
    const r = h.api.run({ title: 'Vida 1', kinds: ['fw'], layers: 1, diff: 1, noPre: true, risk: 1, seed: 5 }, (res) => (cbRes = res));
    out.opened = !!r && G.uiOpen === 'hack';
    window.__dbg.openDeath();
    out.afterDeath = { ui: G.uiOpen, hk: !!h.HK.s, raf: r.session.raf, ended: r.session.ended };
    return new Promise((res) => setTimeout(() => { out.cb = cbRes && { ok: cbRes.ok, abortado: cbRes.abortado }; G.uiOpen && document.querySelector('#panel [data-close]')?.click(); window.__G.player.dead = false; res(out); }, 80));
  });
  check('abrir otro panel encima (muerte) aborta la sesión, para el rAF y entrega el callback', a.opened && a.afterDeath.ui === 'death' && !a.afterDeath.hk && a.afterDeath.raf === 0 && a.cb && a.cb.abortado === true, JSON.stringify(a));

  // 2 · Esc durante el cifrado (teclado) no abre la pausa y desconecta; la V del teclado no abre nada
  const b = await ev(() => {
    const G = window.__G, h = window.__hack;
    h.api.run({ title: 'Vida 2', kinds: ['cipher'], layers: 1, diff: 2, noPre: true, risk: 1, seed: 9 }, null);
    const before = G.uiOpen;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'v' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
    return { before, after: G.uiOpen, hk: !!h.HK.s };
  });
  await wait(4);
  const b2 = await ev(() => ({ ui: window.__G.uiOpen, paused: window.__G.paused, hk: !!window.__hack.HK.s }));
  check('Esc desconecta (sin abrir la pausa) y la V del cifrado no abre nada', b.before === 'hack' && b.after === null && b2.ui === null && !b2.hk, JSON.stringify({ b, b2 }));

  // 3 · reentrada: segunda sesión con la primera abierta
  const c = await ev(() => {
    const h = window.__hack, G = window.__G;
    const r1 = h.api.run({ title: 'R1', kinds: ['tune'], layers: 1, diff: 1, noPre: true, seed: 3 }, null);
    const r2 = h.api.run({ title: 'R2', kinds: ['tune'], layers: 1, diff: 1, noPre: true, seed: 4 }, null);
    const out = { r1: !!r1, r2: r2 === null };
    r1.abort();
    out.after = { ui: G.uiOpen, hk: !!h.HK.s };
    return out;
  });
  check('una segunda sesión mientras hay una abierta devuelve null; abort() limpia', c.r1 && c.r2 && c.after.ui === null && !c.after.hk, JSON.stringify(c));

  // 4 · el envoltorio de la IA enemiga funciona también en la minificada: la torreta controlada daña y el mech apagado no se mueve
  const w = await ev(() => {
    const G = window.__G, h = window.__hack, p = G.player, out = {};
    G.uiBlockDamage = true; G.paused = false;
    const sp = (k, dx, dz, l = 5) => window.__spawn(k, l, p.x + dx, p.z + dz, {});
    const ft = sp('torreta', 20, -20), fm = sp('mech', 20, -26); fm.alerted = false;
    window.__step(2, 1 / 30);
    const hp0 = fm.hp; h.applyControl(ft, 6, false);
    window.__step(60 * 2, 1 / 30);
    out.ctl = { lost: Math.round(hp0 - fm.hp) };
    const m3 = sp('mech', 17, 17); m3.alerted = true;
    window.__step(2, 1 / 30);
    const m0 = { x: m3.x, z: m3.z };
    h.applyOff(m3, 4);
    window.__step(60, 1 / 30);
    out.off = { mode: m3.hk && m3.hk.mode, moved: +Math.hypot(m3.x - m0.x, m3.z - m0.z).toFixed(2) };
    return out;
  });
  check('la torreta controlada daña a otros y el mech apagado no se mueve', w.ctl.lost > 0 && w.off.mode === 'off' && w.off.moved < 0.5, JSON.stringify(w));

  // 5 · unidad controlada y cambio de región: se libera y el marcador se oculta
  const d = await ev(() => {
    const G = window.__G, h = window.__hack, p = G.player, out = {};
    G.uiBlockDamage = true; G.paused = false;
    const tur = window.__spawn('torreta', 5, p.x + 4, p.z + 1);
    window.__step(12, 1 / 30);
    out.cand = h.HK.cand && h.HK.cand.id;
    const m = document.querySelector('.hk-mark');
    out.mark = m && m.style.display;
    h.applyControl(tur, 20, false);
    out.ctl = h.HK.ctl.length;
    return out;
  });
  await api.region('ciudad');
  await ev(() => window.__step(30, 1 / 30));
  const d2 = await ev(() => { const h = window.__hack; const m = document.querySelector('.hk-mark'); return { ctl: h.HK.ctl.length, cand: h.HK.cand && h.HK.cand.id, mark: m && m.style.display }; });
  check('tras cambiar de región no quedan unidades controladas ni marcador visible', d.ctl >= 1 && d2.ctl === 0 && (!d2.mark || d2.mark === 'none'), JSON.stringify({ d, d2 }));

  // 6 · JSON del guardado tras una sesión y migración repetida sin cambios
  const e = await ev(() => {
    const G = window.__G, h = window.__hack, S = G.S;
    h.api.run({ title: 'J', kinds: ['fw'], layers: 1, diff: 1, noPre: true, seed: 8 }, null);
    h.autoplay(300);
    document.querySelector('#hkOk')?.click();
    const j1 = JSON.stringify(S);
    const copy = JSON.parse(j1);
    h.migrate(copy); h.migrate(copy);
    G.migrations.forEach((f) => f(copy)); // el resto de migraciones, dos veces, tampoco deben variar S.hack
    return { same: JSON.stringify(copy.hack) === JSON.stringify(S.hack), ver: copy.hackV, hasFn: /undefined|function/.test(JSON.stringify(S.hack)) };
  });
  check('S es JSON puro tras una sesión y la migración repetida no cambia S.hack', e.same && e.ver === 1 && !e.hasFn, JSON.stringify(e));

  // 7 · valores sucios en S.hack
  const f = await ev(() => {
    const h = window.__hack, S = window.__G.S;
    const bad = JSON.parse(JSON.stringify(S));
    bad.hack = { lvl: 'x', xp: -5, tools: { disipador: 99, fake: 3, oraculo: 'a' }, loadout: ['fantasma', 'fantasma', 'zz'], heat: 1e9, risk: 9, stats: [] };
    h.migrate(bad);
    return bad.hack;
  });
  check('valores sucios en S.hack se sanean (nivel, XP, programas, equipo, calor, riesgo acotado, estadísticas)', f.lvl === 1 && f.xp === 0 && f.tools.disipador === 9 && !f.tools.fake && f.tools.oraculo === 0 && f.loadout.length === 1 && f.heat <= 30 && f.risk >= 0 && f.risk <= 2 && typeof f.stats === 'object' && !Array.isArray(f.stats), JSON.stringify(f));

  // 8 · límite de tiempo de la fuerza bruta: ningún modificador (Agresivo, déficit de nivel) lo deja por debajo de la duración de la pista
  const g = await ev(() => {
    const S = window.__hack.sims, out = [];
    for (let diff = 1; diff <= 5; diff++) {
      let worst = 1e9;
      for (let seed = 1; seed <= 100; seed++) {
        const L = S.hkBruteGen(seed * 7919, diff);
        const s = { mods: { lvl: 3, speed: 1.04 }, risk: 2, spec: { need: 12 } }; // Agresivo con 5 niveles de déficit
        worst = Math.min(worst, S.hkLayerLimit(s, { kind: 'brute', diff, seed: seed * 7919 }, seed * 7919) - L.len);
      }
      out.push(+worst.toFixed(2));
    }
    return out;
  });
  check('fuerza bruta: el límite de tiempo en el peor caso deja al menos 1,5 s de margen sobre la pista (todas las dificultades)', g.every((m) => m >= 1.5), JSON.stringify(g));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}
