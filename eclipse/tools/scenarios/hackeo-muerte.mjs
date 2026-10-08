// HACKEO · morir de verdad (daño real, sin invulnerabilidad) con unidades controladas, una apagada y un Módulo Hacker desplegado, y reaparecer:
// no deben quedar enemigos con e.hk, ni invulnerables, ni listas de control, ni marcador «HACKEAR», ni sesión; el módulo deja de pulsar.
// Después, volver al menú con el marcador a la vista: el marcador debe desaparecer.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/hackeo-muerte.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs, page } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await api.region('desierto');
  await ev(() => { const G = window.__G; G.world.packCd = 1e9; G.world.evT = 1e9; G.uiBlockDamage = false; });

  const a = await ev(() => {
    const G = window.__G, h = window.__hack, g = window.__gadgets, p = G.player, out = {};
    G.paused = false;
    // unidades hackeadas: una torreta controlada con sobrecarga y un mech apagado
    const tur = window.__spawn('torreta', 5, p.x + 6, p.z + 3, {}), mech = window.__spawn('mech', 5, p.x - 7, p.z + 4, {});
    window.__step(4, 1 / 30);
    h.applyControl(tur, 60, true); h.applyOff(mech, 60);
    g.learn('hacker', 3);
    out.gad = !!g.deploy('hacker', { force: true, x: p.x + 2, z: p.z - 6 });
    out.ctl = h.HK.ctl.length;
    // el verdugo: un mech de nivel alto pegado al jugador; vida mínima y sin escudo
    const k = window.__spawn('mech', 40, p.x + 1.2, p.z + 0.2, {}); k.alerted = true;
    p.hp = 3; p.shield = 0; p.inv = 0;
    return out;
  });
  let died = false;
  for (let i = 0; i < 40 && !died; i++) { await ev(() => window.__step(15, 1 / 30)); died = await ev(() => window.__G.player.dead || window.__G.uiOpen === 'death'); }
  await wait(4);
  const d = await ev(() => { const G = window.__G, h = window.__hack, m = document.querySelector('.hk-mark'); return { dead: G.player.dead, ui: G.uiOpen, hk: !!h.HK.s, mark: m ? m.style.display : null }; });
  check('el jugador muere de verdad con unidades hackeadas y un módulo desplegado', a.gad && a.ctl === 2 && died && d.ui === 'death' && !d.hk, JSON.stringify({ a, died, d }));

  // reaparecer con el botón real
  await ev(() => document.querySelector('#dRes').click());
  await wait(10);
  await ev(() => window.__step(40, 1 / 30));
  await wait(4);
  const r = await ev(() => {
    const G = window.__G, h = window.__hack, g = window.__gadgets, m = document.querySelector('.hk-mark');
    return {
      dead: G.player.dead, ui: G.uiOpen, hk: !!h.HK.s, ctl: h.HK.ctl.length,
      hackeados: G.enemies.filter((e) => e.hk).length, invulnerables: G.enemies.filter((e) => e.invuln && !e.burrowed).length,
      modulo: g.state.list.filter((q) => q.id === 'hacker').length, mark: m ? m.style.display : null,
    };
  });
  check('tras reaparecer no quedan unidades hackeadas, invulnerables, listas de control, sesión ni módulo', !r.dead && r.ui === null && !r.hk && r.ctl === 0 && r.hackeados === 0 && r.invulnerables === 0 && r.modulo === 0, JSON.stringify(r));

  // marcador a la vista y vuelta al menú principal
  const m = await ev(() => {
    const G = window.__G, h = window.__hack, p = G.player;
    G.uiBlockDamage = true;
    const t = window.__spawn('torreta', 5, p.x + 4, p.z + 1, {});
    window.__step(14, 1 / 30);
    const mk = document.querySelector('.hk-mark');
    return { cand: !!h.HK.cand, shown: mk && mk.style.display };
  });
  await wait(3);
  check('con una torreta enemiga cerca se ve el marcador HACKEAR', m.cand && m.shown === 'block', JSON.stringify(m));
  // camino real: pausa (el marcador se tapa con CSS pero su display en línea sigue en «block») → «Menú»
  await ev(() => { window.__dbg.openPause(); document.querySelector('#pMenu').click(); });
  await wait(6);
  const mn = await ev(() => { const G = window.__G, mk = document.querySelector('.hk-mark'); return { started: G.started, mark: mk ? mk.style.display : null, cand: !!window.__hack.HK.cand }; });
  check('al volver al menú principal el marcador HACKEAR desaparece', !mn.started && mn.mark === 'none' && !mn.cand, JSON.stringify(mn));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página ni de consola nuevos', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((q) => !q.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}
