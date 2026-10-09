// D10 · aspecto del Eclipse (31i-surprises.js): día, noche normal (referencia), presagio, Eclipse con élites eclipsadas y Heraldo, Némesis (capturas limpias, sin HUD)
//   node tools/shot.mjs --scenario tools/scenarios/sorpresas-look.mjs --size 960x540 --quality medium --out DIR
// Variable LOOK='{"fog":0.6,"sun":0.4,"hemi":0.3,"sat":0.2,"veil":0.5}' sustituye x.cfg.eclipse.look (para comparar variantes)
export default async function (api) {
  const { boot, newGame, ev, wait, shot } = api;
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); window.__seedRng && window.__seedRng(3); });
  // LOOK='{"look":{...},"sky":{"hemi":6965914}}' sustituye x.cfg.eclipse.look / .sky (y recarga los colores); ONLY='noche,eclipse' limita las capturas
  if (process.env.LOOK) await ev((l) => { const c = window.__G.cfg.eclipse; Object.assign(c.look, l.look || {}); Object.assign(c.sky, l.sky || {}); window.__sx.skyInit(); }, JSON.parse(process.env.LOOK));
  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = (n) => !ONLY || ONLY.includes(n);
  await api.region('valle');
  const spot = await ev(() => { const G = window.__G; const [sx, sz] = G.map.findFree(216, 150, 10, 0.8); return { x: sx, z: sz }; });
  await api.teleport(spot.x, spot.z);
  await ev(() => { const G = window.__G; G.S.lvl = 12; G.S.time = 0.28; G.player.recalc(); G.player.inv = 1e9; G.player.ws = [null, null]; for (const e of G.enemies) { e.dead = true; e.deadT = 0; } window.__step(30, 1 / 30); });
  await api.setTime(0.28);
  want('dia') && await api.still('look-dia');
  // noche normal (referencia de cuánto se ve)
  await ev(() => { window.__G.S.time = 0.8; for (let i = 0; i < 20; i++) window.__step(60, 1 / 30); window.__G.S.time = 0.8; });
  await api.setTime(0.8);
  await wait(60);
  want('noche') && await api.still('look-noche');
  await ev(() => { window.__G.S.time = 0.28; });
  await api.setTime(0.28);
  // presagio (a media cuenta)
  await ev(() => { const G = window.__G; window.__sx.ecl.omen(); for (let i = 0; i < 14; i++) window.__step(60, 1 / 30); });
  await wait(30);
  want('presagio') && await api.still('look-presagio');
  // Eclipse con criaturas
  await ev(() => { const G = window.__G, X = window.__sx; X.ecl.begin(); for (let i = 0; i < 6; i++) window.__step(60, 1 / 30); const p = G.player; const live = [...X.R.ecl.live]; live.slice(0, 5).forEach((e, i) => { const a = i * 1.2; e.x = p.x + Math.cos(a) * 6; e.z = p.z + Math.sin(a) * 6; e.alerted = false; e.state = 'idle'; }); const h = X.R.ecl.heraldo; if (h) { h.x = p.x + 9; h.z = p.z - 3; h.alerted = false; } for (const e of live) e.atkCd = 99; window.__step(10, 1 / 30); });
  await wait(30);
  want('eclipse') && await api.still('look-eclipse');
  // Némesis
  await ev(() => { const G = window.__G, X = window.__sx; X.ecl.end('debug'); for (let i = 0; i < 10; i++) window.__step(60, 1 / 30); for (const e of G.enemies) { e.dead = true; e.deadT = 0; } G.S.time = 0.28; const p = G.player; const k = window.__spawn('rastrero', 12, p.x + 2, p.z, { alerted: true }); X.N.born = -999; X.N.riseT = -99999; const n = X.nem.rise(k); k.dead = true; k.deadT = 0; n.due = 0; p.dead = false; const e = X.nem.spawn(n); e.x = p.x + 5; e.z = p.z + 1; e.alerted = false; e.atkCd = 99; window.__step(10, 1 / 30); });
  await api.setTime(0.28);
  want('nemesis') && await api.still('look-nemesis');
  console.log('TODO OK');
}
