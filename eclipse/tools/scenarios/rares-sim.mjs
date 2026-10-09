// D13 · calibración de los raros (31k-rares.js): para el nivel medio de cada región compara la vida y el daño de un raro con los de un campeón corriente,
// y estima cuánto se tarda en abatirlo con el equipo de ese nivel (DPS real del motor con T.simGear). Imprime una línea SIM por región y un resumen.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/rares-sim.mjs --size 640x360 --quality low --out DIR
export default async function (api) {
  const { boot, newGame, ev } = api;
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); window.__dbg.Spawner.update = () => {}; });
  const rows = await ev(() => {
    const G = window.__G, R = window.__rare, p = G.player, S = G.S, h = window.__hack, T = window.__talents, De = window.__De, out = [];
    const rarFor = (L) => (L < 7 ? 1 : L < 19 ? 2 : L < 31 ? 3 : 4); // equipo esperado: Poco común → Raro → Épico → Legendario según avanza el mundo
    for (let reg = 0; reg < 9; reg++) {
      const L = Math.round((De[reg].lvl[0] + De[reg].lvl[1]) / 2);
      window.__seedRng && window.__seedRng(0x7a3 + L);
      if (T && T.simGear) Object.assign(S.eq, T.simGear(L, rarFor(L)));
      S.lvl = L; p.recalc(); p.hp = p.maxHp; const dps = h.playerDps();
      const row = { reg, name: De[reg].n, L, dps: Math.round(dps), hp: Math.round(p.maxHp + p.maxShield), archs: {} };
      const bx = G.map.pois.base.x + 40, bz = G.map.pois.base.z + 40;
      for (const a of Object.keys(R.RQA)) {
        const base = R.RQA[a].bases[reg]; if (!base) continue;
        const e = R.spawn(a, reg, bx, bz, { alert: false });
        const lvlR = e.lvl;
        const champ = window.__spawn(base, lvlR, bx + 3, bz, { mods: ['veloz'], champion: true });
        const mk = e.maxHp, mc = champ.maxHp;
        row.archs[a] = { base, lvl: lvlR, hpRare: Math.round(mk), hpChamp: Math.round(mc), ratio: +(mk / mc).toFixed(2), ttk: +(mk / dps).toFixed(1), ttkChamp: +(mc / dps).toFixed(1), dmg: Math.round(e.dmg), dmgPct: +((e.dmg / (p.maxHp + p.maxShield)) * 100).toFixed(1) };
        e.dead = true; e.deadT = 0; champ.dead = true; champ.deadT = 0; R.RQ.live.clear();
        const Sr = R.state(); for (const id of Object.keys(Sr.slots)) if (!Sr.slots[id].init0 && id.startsWith('rq_') && Number(id.slice(3)) > 18) delete Sr.slots[id];
      }
      out.push(row);
    }
    return out;
  });
  for (const r of rows) {
    console.log(`SIM región ${r.reg} ${r.name} (nv ${r.L}) · DPS ${r.dps} · vida del jugador ${r.hp}`);
    for (const [a, v] of Object.entries(r.archs)) console.log(`   ${a.padEnd(12)} ${v.base.padEnd(11)} nv ${String(v.lvl).padStart(2)} · vida ${String(v.hpRare).padStart(6)} (campeón ${String(v.hpChamp).padStart(6)}, ×${v.ratio}) · se abate en ${String(v.ttk).padStart(5)} s (campeón ${v.ttkChamp} s) · golpe base ${v.dmg} = ${v.dmgPct} % de tu vida`);
  }
  const ttks = rows.flatMap((r) => Object.values(r.archs).map((v) => v.ttk));
  console.log(`RESUMEN tiempo de abate: mín ${Math.min(...ttks)} s · mediana ${ttks.sort((a, b) => a - b)[Math.floor(ttks.length / 2)]} s · máx ${Math.max(...ttks)} s`);
}
