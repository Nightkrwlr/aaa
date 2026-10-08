#!/usr/bin/env node
// Simulación de botín: esperanza de muertes/horas hasta la primera pieza Rara/Épica/Legendaria/Mítica por fuente,
// y recogidas por cada 100 muertes. Ejecuta rollLoot() de la propia build dentro de la página (sin renderizar nada).
//
//   node tools/build.mjs && node tools/sim/loot.mjs [--n 400000] [--html dist/eclipse.html] [--json]
//
// Modelo de actividad (supuestos, ajustables abajo): 17,5 muertes/min de juego activo, élites ≈ 2,6 % de las muertes,
// eventos de emboscada cada ~3,5 min (un 70 % se completan), cofres y jefes según la cadencia típica de exploración.
import { withPage } from './_page.mjs';

const N = Number(process.argv.includes('--n') ? process.argv[process.argv.indexOf('--n') + 1] : 400000);
const JSON_OUT = process.argv.includes('--json');

// Eventos por hora de juego activo, por fuente repetible (supuestos del modelo; ver docs/DEPTH_DESIGN.md, sección Economía)
const PER_HOUR = {
  normal: 17.5 * 60 * 0.974,
  elite: 17.5 * 60 * 0.026,
  champion: 8 * 0.25 * 0.6, // «Objetivo prioritario»: 1 de cada 4 emboscadas (≈ 8 por hora), se completa el 60 % (gigante, 3 mods)
  miniboss: 0.3,
  chest1: 3,
  chest2: 1.5 + 8 * 0.5 * 0.6, // cofres tier 2 + recompensa de hordas/cazas completadas (Co tier 2)
  chest3: 0.3,
};
const REPEATABLE = new Set(Object.keys(PER_HOUR));
// Jefes: una sola muerte cada uno, cuando alcanzas su nivel máximo recomendado +2 según la curva de XP (se calcula en la página);
// los 5 secretos se reparten entre las horas 8 y 36; la Mente es el jefe final de la región 9.
const SECRET_H = [8, 14, 20, 28, 36];

const out = await withPage(async (page, errors) => {
  const res = await page.evaluate((N) => {
    const E = window.__eco;
    let s = 20260507;
    E.ecoRnd.fn = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const rnd = E.ecoRnd.fn;
    // enemigo aleatorio de la tabla de aparición de una región aleatoria
    const pickEnemy = () => {
      const reg = E.De[Math.floor(rnd() * E.De.length)];
      const pool = reg.enemies; const w = pool.reduce((a, q) => a + q[1], 0); let t = rnd() * w; let q = pool[0];
      for (const p of pool) { t -= p[1]; if (t <= 0) { q = p; break; } }
      const lvl = Math.round(reg.lvl[0] + rnd() * (reg.lvl[1] - reg.lvl[0]));
      return { id: q[0], fam: E.gn[q[0]].fam, def: E.gn[q[0]], lvl };
    };
    const BOSSES = { boss: ['reina', 'demoledor', 'kharsa'], bossSecret: ['carnicero', 'antiguo'], bossFinal: ['mente'], miniboss: ['bruto'] };
    const stats = {};
    const srcs = ['normal', 'elite', 'champion', 'miniboss', 'chest1', 'chest2', 'chest3', 'boss', 'bossSecret', 'bossFinal'];
    for (const src of srcs) {
      const n = ['normal'].includes(src) ? N : Math.max(50000, N / 4);
      const st = { n, kinds: {}, items: 0, plan: 0, mod: 0, best: [0, 0, 0, 0, 0, 0], rar: [0, 0, 0, 0, 0, 0] };
      for (let i = 0; i < n; i++) {
        let e = null;
        if (src === 'normal' || src === 'elite' || src === 'champion') e = pickEnemy();
        else if (BOSSES[src]) { const id = BOSSES[src][i % BOSSES[src].length]; const def = E.En[id] || E.gn[id]; e = { id, fam: def.fam, def, lvl: 30, boss: true }; }
        else e = pickEnemy();
        const lvl = e ? e.lvl : 20;
        const drops = E.rollLoot(src, lvl, { e, luck: 1, cred: 1, tier: src === 'chest1' ? 1 : src === 'chest2' ? 2 : src === 'chest3' ? 3 : undefined });
        let top = -1;
        for (const d of drops) {
          st.kinds[d.k] = (st.kinds[d.k] || 0) + 1;
          if (d.k === 'plan' || d.k === 'mod') { st[d.k]++; st.items++; st.rar[d.r]++; top = Math.max(top, d.r); }
        }
        for (let r = 0; r <= top; r++) st.best[r]++;
      }
      stats[src] = st;
    }
    // recogidas por cada 100 muertes normales (mezcla de todas las regiones), sin contar la XP
    const per100 = {};
    const M = 200000;
    for (let i = 0; i < M; i++) {
      const e = pickEnemy();
      for (const d of E.rollLoot('normal', e.lvl, { e, luck: 1, cred: 1 })) {
        const k = d.k === 'hp' || d.k === 'cons' || d.k === 'cap' ? 'consumibles' : d.k;
        per100[k] = (per100[k] || 0) + 1;
      }
    }
    for (const k in per100) per100[k] = +(per100[k] / M * 100).toFixed(2);
    // ingresos por hora en cada región (nivel medio): créditos directos frente a venta de trofeos
    const info = E.ecoTroTable();
    const income = E.De.map((reg, ri) => {
      const L = Math.round((reg.lvl[0] + reg.lvl[1]) / 2);
      const pool = reg.enemies.filter((q) => (q[2] || 0) <= L); const w = pool.reduce((a, q) => a + q[1], 0);
      const enemy = () => { let t = rnd() * w; let q = pool[0]; for (const p of pool) { t -= p[1]; if (t <= 0) { q = p; break; } } return { id: q[0], fam: E.gn[q[0]].fam, def: E.gn[q[0]], lvl: L }; };
      let cr = 0, tr = 0; const K = 40000;
      const run = (src, perHour, usesEnemy, tier) => {
        const n = Math.max(2000, Math.round(K * Math.min(1, perHour / 1000)));
        let c = 0, t = 0;
        for (let i = 0; i < n; i++) for (const d of E.rollLoot(src, L, { e: usesEnemy ? enemy() : null, luck: 1, cred: 1, tier })) {
          if (d.k === 'cr') c += d.val; else if (d.k === 'trophy') t += info[d.id].v * (d.perfect ? E.cfg.trophy.perfectMult : 1);
        }
        cr += c / n * perHour; tr += t / n * perHour;
      };
      run('normal', 17.5 * 60 * 0.974, true); run('elite', 17.5 * 60 * 0.026, true); run('champion', 1.2, true); run('miniboss', 0.3, true);
      run('chest1', 3, false, 1); run('chest2', 3.9, false, 2); run('chest3', 0.3, false, 3);
      return { n: reg.n, L, cr: Math.round(cr), tr: Math.round(tr) };
    });
    const bossHours = E.De.map((reg, i) => ({ src: i === 8 ? 'bossFinal' : 'boss', h: E.ecoMinutesTo(reg.lvl[1] + 2) / 60 }));
    return { stats, per100, bossHours, income };
  }, N);
  if (errors.length) console.log('ERRORES DE PÁGINA:', errors.slice(0, 5));
  return res;
});

const pct = (x) => (x * 100).toFixed(x < 0.001 ? 4 : x < 0.01 ? 3 : 2) + ' %';
const NAMES = ['Común', 'Poco común', 'Raro', 'Épico', 'Legendario', 'Mítico'];
const fmtH = (h) => (!isFinite(h) ? '∞' : h < 1 ? `${(h * 60).toFixed(0)} min` : h < 100 ? `${h.toFixed(1)} h` : `${h.toFixed(0)} h`);

console.log('\n══ 1. Por evento: piezas (planos+módulos) y probabilidad de que el evento suelte al menos una de rareza ≥ R ══');
console.log('fuente       piezas/ev   P(≥Raro)   P(≥Épico)  P(≥Legend.) P(≥Mítico)  | muertes/eventos hasta el primero: Raro · Épico · Legendario');
for (const [src, st] of Object.entries(out.stats)) {
  const p = (r) => st.best[r] / st.n;
  const inv = (r) => (p(r) > 0 ? (1 / p(r)).toFixed(p(r) > 0.01 ? 0 : 0) : '—');
  console.log(`${src.padEnd(12)} ${(st.items / st.n).toFixed(3).padStart(8)}   ${pct(p(2)).padStart(9)}  ${pct(p(3)).padStart(9)}  ${pct(p(4)).padStart(9)}  ${pct(p(5)).padStart(9)}  | ${String(inv(2)).padStart(7)} · ${String(inv(3)).padStart(8)} · ${String(inv(4)).padStart(9)}`);
}

console.log('\n══ 2. Recogidas por cada 100 muertes normales (mezcla de las 9 regiones) ══');
console.log(JSON.stringify(out.per100));
const pk = out.per100;
console.log(`objetivo: créditos ≈ 20 · materiales ≈ 15 · trofeos ≈ 30 · consumibles ≤ 5 · módulos ≈ 0,5 · planos ≈ 0,15   (XP: 1 orbe fundida por ráfaga)`);

console.log('\n══ 2b. Ingresos por hora: créditos directos frente a venta de trofeos (excluye misiones y operaciones) ══');
console.log('región                     nivel   créditos/h   trofeos/h   trofeos sobre el total   (objetivo 25-35 %, nunca más que los créditos directos)');
for (const r of out.income) console.log(`${r.n.padEnd(26)} ${String(r.L).padStart(4)}   ${String(r.cr).padStart(9)}   ${String(r.tr).padStart(9)}   ${pct(r.tr / (r.cr + r.tr)).padStart(10)}`);
const tot = out.income.reduce((a, r) => ({ cr: a.cr + r.cr, tr: a.tr + r.tr }), { cr: 0, tr: 0 });
console.log(`media de las 9 regiones: trofeos = ${pct(tot.tr / (tot.cr + tot.tr))} del total`);

// ── 3. Línea de tiempo (Monte Carlo): repetibles como proceso de Poisson + jefes en sus horas
let seed = 99; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const bossTimes = out.bossHours; // [{src, h}]
for (const h of SECRET_H) bossTimes.push({ src: 'bossSecret', h });
const lamRepR = {}; for (const r of [2, 3, 4, 5]) lamRepR[r] = Object.keys(PER_HOUR).reduce((a, k) => a + PER_HOUR[k] * out.stats[k].best[r] / out.stats[k].n, 0);
const RUNS = 20000, HOR = 400;
const first = (r) => {
  const v = [];
  for (let i = 0; i < RUNS; i++) {
    let t = lamRepR[r] > 0 ? -Math.log(1 - rnd()) / lamRepR[r] : Infinity;
    for (const b of bossTimes) if (b.h < t && rnd() < out.stats[b.src].best[r] / out.stats[b.src].n) t = b.h;
    v.push(t);
  }
  v.sort((a, b) => a - b);
  const ok = v.filter((t) => t < HOR);
  return { mean: ok.reduce((a, b) => a + b, 0) / Math.max(1, ok.length), med: v[Math.floor(v.length / 2)], p: ok.length / v.length, p30: v.filter((t) => t < 30).length / v.length };
};
console.log('\n══ 3. Primera pieza de cada rareza (media de ' + RUNS + ' partidas simuladas; jefes en sus horas: ' + bossTimes.map((b) => b.h.toFixed(1) + 'h').join(' ') + ') ══');
console.log('rareza        λ repetibles/h   media (si llega <400h)   mediana   P(llega)  P(<30 h)   objetivo del contrato (±30 %)');
const target = { 2: '25-40 min', 3: '3-4 h', 4: '20-30 h', 5: '100 h +' };
const rows = {};
for (const r of [2, 3, 4, 5]) {
  const f = first(r); rows[r] = f;
  console.log(`${NAMES[r].padEnd(12)} ${lamRepR[r].toFixed(4).padStart(10)}   ${fmtH(f.mean).padStart(18)}   ${fmtH(f.med).padStart(9)}   ${pct(f.p).padStart(8)}  ${pct(f.p30).padStart(8)}   ${target[r]}`);
}
console.log('\naporte por fuente repetible (eventos/h con alguna pieza ≥ rareza):');
for (const r of [2, 3, 4, 5]) console.log(`  ${NAMES[r].padEnd(11)} ` + Object.keys(PER_HOUR).map((k) => `${k} ${(PER_HOUR[k] * out.stats[k].best[r] / out.stats[k].n).toFixed(4)}`).join(' · '));

// ── 4. Jefes (una sola muerte cada uno)
const pOnce = (src, r, n) => 1 - Math.pow(1 - out.stats[src].best[r] / out.stats[src].n, n);
console.log('\n══ 4. Jefes (una sola muerte cada uno) ══');
console.log(`P(≥1 Épico en los 9 principales) = ${pct(pOnce('boss', 3, 8) * 0 + 1 - Math.pow(1 - out.stats.boss.best[3] / out.stats.boss.n, 8) * (1 - out.stats.bossFinal.best[3] / out.stats.bossFinal.n))}`);
console.log(`P(≥1 Legendario en los 8 principales) = ${pct(pOnce('boss', 4, 8))} · en los 5 secretos = ${pct(pOnce('bossSecret', 4, 5))} · en la Mente = ${pct(pOnce('bossFinal', 4, 1))}`);
console.log(`P(≥1 Mítico en 5 secretos + la Mente) = ${pct(1 - (1 - pOnce('bossSecret', 5, 5)) * (1 - pOnce('bossFinal', 5, 1)))}  (los Míticos solo caen de jefes secretos y de la Mente)`);

if (JSON_OUT) console.log('\n' + JSON.stringify({ lamRepR, rows, per100: out.per100 }));
