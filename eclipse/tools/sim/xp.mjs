#!/usr/bin/env node
// Simulación de XP: tabla de muertes por nivel y tiempo acumulado a 20 muertes/min, contraste con los tiempos objetivo
// del contrato y reparto XP de muertes / XP de descubrimiento. Usa la curva REAL de la build (mt.xpToNext).
//
//   node tools/build.mjs && node tools/sim/xp.mjs [--kpm 20] [--html dist/eclipse.html]
import { withPage } from './_page.mjs';

const arg = (n, d) => (process.argv.includes('--' + n) ? Number(process.argv[process.argv.indexOf('--' + n) + 1]) : d);
const KPM = arg('kpm', 20);
// Contratos y encargos del tablón por hora de juego activo (el resto de XP no-muerte es de una sola vez)
const CONTRACTS_PER_HOUR = 1;

const data = await withPage(async (page, errors) => {
  const r = await page.evaluate(() => {
    const E = window.__eco, c = E.cfg;
    const L = [];
    for (let n = 1; n <= 60; n++) {
      const reg = E.ecoFarmRegion(n);
      L.push({ n, xp: E.mt.xpToNext(n), avg: E.ecoAvgKillXp(n), region: E.De[reg.r].n, eLvl: reg.eLvl });
    }
    // XP no-muerte de una sola vez, en «barras de nivel» y en XP absoluto (se calcula al nivel en que se obtiene)
    const quests = Object.values(E.gi).filter((q) => !q.repeat);
    const oneOff = [];
    for (const q of quests) oneOff.push({ what: q.main ? 'misión principal' : 'misión secundaria', L: q.lvl, xp: E.mt.xpToNext(Math.min(q.lvl, q.lvl + 2)) * (q.main ? 0.25 : 0.16) * (q.xpf || 1) });
    E.De.forEach((reg, i) => oneOff.push({ what: 'primera visita', L: reg.lvl[0], xp: c.xp.firstRegion * E.mt.xpToNext(reg.lvl[0]) }));
    Object.keys(E.gn).concat(Object.keys(E.En)).forEach((id, i, a) => oneOff.push({ what: 'bestiario', L: 4 + Math.round(i / a.length * 44), xp: c.xp.bestiary * E.mt.xpToNext(4 + Math.round(i / a.length * 44)) }));
    E.na.forEach((pad, i, a) => oneOff.push({ what: 'registro de lore', L: pad.reg != null ? E.De[pad.reg].lvl[0] + 2 : 20, xp: c.xp.lore * E.mt.xpToNext(pad.reg != null ? E.De[pad.reg].lvl[0] + 2 : 20) }));
    E.De.forEach((reg, i) => oneOff.push({ what: i === 8 ? 'jefe final' : 'jefe principal', L: reg.lvl[1] + 2, xp: c.xp.firstBoss * E.mt.xpToNext(reg.lvl[1] + 2) }));
    [16, 22, 28, 34, 40].forEach((l) => oneOff.push({ what: 'jefe secreto', L: l, xp: c.xp.firstSecretBoss * E.mt.xpToNext(l) }));
    // zonas interiores/encuentros (22-quests ~869): ≈ 0,09-0,12 de barra cada una; se supone una cada 12 min de juego
    return { L, oneOff, xpcfg: c.xp, anchors: c.xp.minutesTo, nQuests: quests.length, nLore: E.na.length };
  });
  if (errors.length) console.log('ERRORES DE PÁGINA:', errors.slice(0, 5));
  return r;
});

const { L, oneOff, xpcfg } = data;
const mm = (m) => (m >= 600 ? `${(m / 60).toFixed(1)} h` : m >= 100 ? `${(m / 60).toFixed(1)} h` : `${m.toFixed(1)} min`);

console.log(`\n══ Curva de XP (mt.xpToNext) · ritmo ${KPM} muertes/min · XP de muertes = ${(xpcfg.killShare * 100).toFixed(0)} % del total ══`);
console.log('nivel→siguiente   xp barra   xp/muerte   muertes   tiempo nivel   acumulado   región de combate (nivel enemigo)');
let acc = 0; const accAt = { 1: 0 };
const show = new Set([...Array(12).keys()].map((i) => i + 1).concat([15, 18, 20, 25, 30, 35, 40, 45, 48, 50, 55, 59]));
for (const r of L.slice(0, 59)) {
  const kills = (r.xp * xpcfg.killShare) / r.avg; // muertes necesarias (el resto de la barra llega por descubrimientos)
  const min = kills / KPM; // tiempo por nivel: el 30 % restante de la barra llega «gratis» por descubrimientos y misiones
  acc += min; accAt[r.n + 1] = acc;
  if (show.has(r.n)) console.log(`${String(r.n).padStart(3)} → ${String(r.n + 1).padEnd(3)}      ${String(r.xp).padStart(10)}  ${r.avg.toFixed(1).padStart(9)}  ${Math.round(kills).toString().padStart(8)}  ${mm(min).padStart(12)}  ${mm(acc).padStart(10)}   ${r.region} (${r.eLvl})`);
}

console.log('\n══ Tiempos acumulados frente a los objetivos del contrato (±30 %) ══');
let fails = 0;
for (const [lv, tgt] of Object.entries(data.anchors)) {
  const v = accAt[lv], ratio = v / tgt, ok = Math.abs(ratio - 1) <= 0.3;
  !ok && fails++;
  console.log(`nivel ${String(lv).padStart(2)}: objetivo ${mm(tgt).padStart(8)} · curva ${mm(v).padStart(8)} · ${(ratio * 100).toFixed(0)} %  ${ok ? 'OK' : 'FUERA'}`);
}

// Reparto de XP: muertes frente a descubrimiento
const totalBar = L.slice(0, 59).reduce((a, r) => a + r.xp, 0);
const oneOffXp = oneOff.reduce((a, o) => a + o.xp, 0);
const byKind = {};
for (const o of oneOff) byKind[o.what] = (byKind[o.what] || 0) + o.xp;
// contratos repetibles del tablón: 0,12 de barra × xpf 0,45-0,55 ≈ 0,06 barras cada uno, al nivel en que se hacen
const hoursTotal = accAt[60] / 60;
let contractsXp = 0;
for (let n = 1; n < 60; n++) contractsXp += (accAt[n + 1] - accAt[n]) / 60 * CONTRACTS_PER_HOUR * 0.06 * L[n - 1].xp;
console.log(`\n══ XP que no viene de matar (supuesto: ${CONTRACTS_PER_HOUR} contratos/h del tablón, resto de una sola vez) ══`);
console.log(`barra total niveles 1-59: ${(totalBar / 1e6).toFixed(2)} M XP · duración de la curva: ${hoursTotal.toFixed(0)} h`);
for (const [k, v] of Object.entries(byKind)) console.log(`  ${k.padEnd(20)} ${(v / 1e3).toFixed(0).padStart(7)} k XP  (${(v / totalBar * 100).toFixed(1)} %)`);
console.log(`  contratos del tablón ${(contractsXp / 1e3).toFixed(0).padStart(7)} k XP  (${(contractsXp / totalBar * 100).toFixed(1)} %)`);
const nonKill = oneOffXp + contractsXp;
console.log(`TOTAL no-muerte: ${(nonKill / totalBar * 100).toFixed(1)} % de la barra (objetivo del contrato 25-35 %); la curva supone ${(100 - xpcfg.killShare * 100).toFixed(0)} %`);
console.log(`\nRESUMEN: ${fails ? fails + ' anclas fuera de ±30 %' : 'todas las anclas dentro de ±30 %'}`);
