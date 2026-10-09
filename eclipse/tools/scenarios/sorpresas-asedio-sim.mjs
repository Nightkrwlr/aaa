// D10d · calibración del asedio (31i-surprises.js): asedios completos con el motor real en varias condiciones y semillas; imprime una línea SIM por ejecución y un resumen
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/sorpresas-asedio-sim.mjs --size 640x360 --quality low --out DIR
// Variables: LVL (por defecto 12), SEEDS (por defecto 3), COND (lista separada por comas: idle, armed, armed5, upg, upg_armed5; por defecto todas)
export default async function (api) {
  const { boot, newGame, ev, wait, page } = api;
  const LVL = Number(process.env.LVL || 12), SEEDS = Number(process.env.SEEDS || 3);
  const COND = (process.env.COND || 'idle,armed,armed5,upg,upg_armed5').split(',');
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });
  const base = await ev(() => { const b = window.__G.map.pois.base; return { x: b.x, z: b.z }; });
  await api.teleport(base.x + 9, base.z + 9);
  const rows = [];
  // SIMCFG='{"coreLives":20,"turret":{"range":17.5,"cd":0.4}}' sustituye ajustes de x.cfg.siege (fusión superficial) antes de empezar
  if (process.env.SIMCFG) await ev((c) => { Object.assign(window.__G.cfg.siege, c); }, JSON.parse(process.env.SIMCFG));
  for (const cond of COND) for (let seed = 1; seed <= SEEDS; seed++) {
    const r = await ev(([cond, seed, LVL]) => {
      const G = window.__G, S = G.S, q = S.sx.siege, R = window.__sx.R.sg, p = G.player, b = G.map.pois.base, X = window.__sx;
      window.__seedRng(1000 + seed);
      for (const e of G.enemies) { e.dead = true; e.deadT = 0; } X.siege.end('debug'); q.st = 'idle';
      S.lvl = LVL; S.sx.base.lv = /^upg/.test(cond) ? { turret: 3, wall: 3 } : {}; p.recalc(); p.hp = p.maxHp; p.inv = 1e9;
      if (!p._ws) p._ws = p.ws;
      const armed = /armed/.test(cond);
      if (armed) { p.ws = p._ws; if (/armed5/.test(cond) && p.ws[0]) p.ws[0].dmgBase = p.ws[0].dmgBase * 5; p.x = b.x + 3; p.z = b.z + 3; }
      else { p.ws = [null, null]; p.x = b.x + 9; p.z = b.z + 9; }
      const won0 = q.won, lost0 = q.lost; q.next = S.playTime - 1; window.__step(2, 1 / 30); q.t = 0; window.__step(2, 1 / 30);
      const out = { cond, seed, lvl: LVL, W: R.W };
      let t = 0, minCore = 1, minTur = 4, maxAlive = 0, coreFall = null;
      while (q.st === 'on' && t < 540) {
        window.__step(30, 1 / 30); t++;
        if (R.T) { const core = R.T[0]; minCore = Math.min(minCore, core.hp / core.maxHp); minTur = Math.min(minTur, R.T.filter((x) => x.kind === 'turret' && x.hp > 0).length); }
        maxAlive = Math.max(maxAlive, R.live.size);
        if (armed) { p.hp = p.maxHp; }
        // jugador activo: se coloca junto al enemigo más cercano a la puerta (muy simple), siempre cerca del núcleo
      }
      out.sec = t; out.result = q.won > won0 ? 'win' : q.lost > lost0 ? 'lose' : q.st; out.minCore = +minCore.toFixed(2); out.minTur = minTur; out.maxAlive = maxAlive; out.killed = R.stats ? R.stats.killed : 0;
      for (const e of G.enemies) { e.dead = true; e.deadT = 0; }
      for (const r of G.pickups) r.mesh && G.R.scene.remove(r.mesh); G.pickups.length = 0;
      p.ws = p._ws; S.sx.base.lv = {};
      return out;
    }, [cond, seed, LVL]);
    rows.push(r); console.log('SIM', JSON.stringify(r));
  }
  // resumen por condición
  const by = {};
  for (const r of rows) (by[r.cond] = by[r.cond] || []).push(r);
  for (const c in by) { const a = by[c]; console.log('RESUMEN', c, JSON.stringify({ win: a.filter((r) => r.result === 'win').length, lose: a.filter((r) => r.result === 'lose').length, n: a.length, secMed: a.map((r) => r.sec).sort((x, y) => x - y)[a.length >> 1], minCore: +(a.reduce((s, r) => s + r.minCore, 0) / a.length).toFixed(2), minTur: +(a.reduce((s, r) => s + r.minTur, 0) / a.length).toFixed(1), killed: Math.round(a.reduce((s, r) => s + r.killed, 0) / a.length) })); }
  console.log('TODO OK');
}
