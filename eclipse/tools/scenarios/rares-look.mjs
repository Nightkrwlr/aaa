// D13 · capturas del aspecto de los raros y de sus mecánicas (anillo dorado, aviso de embestida, pilones y haces, pozo, enlace, copias, charcos, barra del raro)
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/rares-look.mjs --size 960x540 --quality high --out DIR
export default async function (api) {
  const { boot, newGame, ev, wait, shot } = api;
  await boot(); await newGame();
  await ev(() => {
    window.__silence && window.__silence(true); window.__dbg.Spawner.update = () => {};
    const G = window.__G, R = window.__rare, p = G.player;
    window.__t = {
      arena() {
        const rng = { int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) };
        const clear = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5); for (let i = 0; i <= n; i++) if (G.map.circleHits(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, 0.7)) return false; return true; };
        let s = null; for (let i = 0; i < 80 && !s; i++) { const c = R.spot(0, rng); if (c && clear(c.x - 4, c.z, c.x + 14, c.z)) s = c; }
        s = s || { x: G.map.pois.base.x + 45, z: G.map.pois.base.z + 45 };
        p.x = s.x; p.z = s.z; G.world.check(true); window.__step(20, 1 / 30); return s;
      },
      calm() { p.maxHp = 5e5; p.hp = 5e5; p.inv = 0; for (const e of G.enemies.slice()) if (!e.rq && !e.rqPylon && !e.rqDecoy) { e.dead = true; e.deadT = 0; } G.projs.length = 0; G.pickups.length = 0; },
      clear() { for (const e of G.enemies.slice()) { e.dead = true; e.deadT = 0; } R.RQ.live.clear(); const S = R.state(); for (const id of Object.keys(S.slots)) if (!window.__t.keep.has(id)) delete S.slots[id]; window.__step(2, 1 / 30); G.hazards.length = 0; },
      run(e, n) { for (let i = 0; i < n; i++) { e.atkCd = 1e9; window.__step(1, 1 / 30); } },
    };
  });
  await ev(() => { window.__t.keep = new Set(Object.keys(window.__rare.state().slots)); });
  const take = async (name, setup, frames = 0) => {
    // sin congelar el juego: en pausa los destellos de luz y los haces del motor se quedan a medias y las capturas salen quemadas.
    // Antes de crear al raro se coloca al jugador y se espera a que la cámara llegue (si no, la captura sale con la vista a medio camino)
    await ev(() => { const T = window.__t, G = window.__G; T.clear(); G.S.quests.active = {}; window.__arena = T.arena(); T.calm(); G.uiBlockDamage = true; });
    await wait(45);
    await ev(setup); await wait(frames || 1); await shot(name);
  };
  // 1) la Mudadora tranquila, con su anillo dorado (y el destello)
  await take('1-mudadora-quieta', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('mudadora', 0, s.x + 7, s.z - 1, { alert: false }); e.alerted = false; G.player.face = Math.PI / 2; window.__step(10, 1 / 30); });
  // 2) la Mudadora mudando (invulnerable, anillo de aviso y escudo)
  await take('2-mudadora-muda', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('mudadora', 0, s.x + 7, s.z - 1); T.calm(); e.hp = e.maxHp * 0.69; window.__step(12, 1 / 30); });
  // 3) la Embestidora apuntando (línea de aviso)
  await take('3-embestidora-aviso', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('estampida', 0, s.x + 9, s.z); T.calm(); G.player.x = s.x; for (let i = 0; i < 80; i++) { e.atkCd = 1e9; window.__step(1, 1 / 30); if (e.rq.act && e.rq.act.t > 0.6 && !e.rq.act.ph) break; } });
  // 4) el Pararrayos con sus pilones y los haces
  await take('4-pararrayos', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('pararrayos', 5, s.x + 8, s.z); T.calm(); window.__step(24, 1 / 30); });
  // 5) la Acorazada abierta (estado y barra)
  await take('5-acorazada-abierta', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('coraza', 5, s.x + 8, s.z); T.calm(); G.player.x = s.x; for (let i = 0; i < 400; i++) { window.__step(1, 1 / 30); if (e.rq.open > 1) break; } });
  // 6) el Atractor con el pozo cerrándose
  await take('6-atractor-pozo', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('pozo', 4, s.x + 5, s.z); T.calm(); e.spd = 0; G.player.x = s.x; for (let i = 0; i < 300; i++) { window.__step(1, 1 / 30); if (e.rq.act && e.rq.act.t > 1.9) break; } });
  // 7) el Chupasangre enlazado
  await take('7-chupasangre-enlace', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('chupasangre', 3, s.x + 7, s.z); T.calm(); G.player.x = s.x; for (let i = 0; i < 300; i++) { T.run(e, 1); if (e.rq.link && e.rq.link.t > 0.4) break; } });
  // 8) el Espejismo y sus copias
  await take('8-espejismo-copias', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('acechador', 2, s.x + 8, s.z); T.calm(); G.player.x = s.x; window.__step(70, 1 / 30); for (const d of G.enemies) if (d.rqDecoy) d.cloaked = false; });
  // 9) el Aura de fuego y de hielo con sus charcos
  await take('9-aura-fuego', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('aura', 2, s.x + 9, s.z); T.calm(); G.player.x = s.x; e.alerted = true; for (let i = 0; i < 400; i++) { window.__step(1, 1 / 30); if (G.hazards.filter((h) => h.rq).length >= 3) break; } window.__step(6, 1 / 30); });
  await take('10-aura-hielo', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('aura', 4, s.x + 9, s.z, { ice: 1 }); T.calm(); G.player.x = s.x; e.alerted = true; for (let i = 0; i < 400; i++) { window.__step(1, 1 / 30); if (G.hazards.filter((h) => h.rq).length >= 3) break; } window.__step(6, 1 / 30); });
  // 11) tras abatir a una única: el objeto especial y el botín
  await take('11-unica-botin', () => { const T = window.__t, R = window.__rare, G = window.__G; const s = window.__arena; T.calm(); const e = R.spawn('mudadora', 0, s.x + 5, s.z, { uniq: 'u_hueco', base: 'infectado', name: 'Sargento Hueco' }); T.calm(); G.player.x = s.x; e.hp = 0; e.kill({}); window.__step(20, 1 / 30); }, 6);
  console.log('listo');
}
