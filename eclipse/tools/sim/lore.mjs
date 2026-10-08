#!/usr/bin/env node
// Simulación del frente LORE: contenido, colocación en el mundo real (60 semillas), pistas de puzle, voz sintetizada (render fuera de
// línea), XP de descubrimiento y coste de CPU. Usa la build REAL dentro de Chromium: la colocación necesita el mapa generado.
//
//   node tools/build.mjs && node tools/sim/lore.mjs [--seeds 60] [--out /ruta] [--html dist/eclipse.html]
// Escribe lore-sim.json (y tres .wav de muestra) en --out y devuelve código ≠ 0 si falla alguna comprobación.
import fs from 'node:fs';
import path from 'node:path';
import { withPage } from './_page.mjs';
import { loreValidate, LORE_ENTRIES, LORE_COLLECTIONS } from '../../src/engine/lore-data.js';

const arg = (n, d) => (process.argv.includes('--' + n) ? process.argv[process.argv.indexOf('--' + n) + 1] : d);
const SEEDS = +arg('seeds', 60);
const OUT = arg('out', '/tmp/claude-0/eclipse-lore/sim');
fs.mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (name, ok, info = '') => { checks.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

// ── 1. Contenido (Node puro) ──
const problems = loreValidate();
check('contenido válido (ids únicos, voces, pistas, colecciones)', problems.length === 0, problems.slice(0, 3).join(' | '));
check('≈ 70 entradas nuevas', LORE_ENTRIES.length >= 68 && LORE_ENTRIES.length <= 74, String(LORE_ENTRIES.length));
const kinds = {}, words = {};
for (const e of LORE_ENTRIES) { kinds[e.k] = (kinds[e.k] || 0) + 1; words[e.k] = (words[e.k] || 0) + (e.lines ? e.lines.map((l) => l[1]).join(' ') : e.txt).split(/\s+/).length; }
console.log('\n══ Contenido ══');
console.log(`entradas: ${LORE_ENTRIES.length} (libros ${kinds.libro} · chips ${kinds.chip} · grabaciones ${kinds.grab}) · palabras: libros ${words.libro} · chips ${words.chip} · grabaciones ${words.grab}`);
const byReg = Array.from({ length: 9 }, (_, r) => LORE_ENTRIES.filter((e) => e.reg === r));
console.log('por región: ' + byReg.map((l, r) => `${r}:${l.length}`).join('  '));
const readMin = ((words.libro + words.chip) / 200);
console.log(`lectura de libros y chips a 200 palabras/min: ${readMin.toFixed(1)} min en total`);

// ── 2. En el juego real ──
const D = await withPage(async (page, errors) => {
  const r = await page.evaluate(async (SEEDS) => {
    // el juego carga modelos de forma asíncrona: esperar a que el mundo exista (loadWorld de arranque)
    await new Promise((res) => { const t = setInterval(() => window.__G && window.__G.map && window.__lore && window.__lore.plan() && (clearInterval(t), res()), 100); });
    const L = window.__lore, E = window.__eco, out = { errors: [] };
    const ents = L.api.entries;
    const m = window.__G.map;
    // — voz: render fuera de línea de las 22 grabaciones —
    out.voice = [];
    const wavs = {};
    for (const e of ents.filter((x) => x.k === 'grab')) {
      const v = await L.render(e.id, { wav: out.voice.length < 3 });
      if (v.pcm) { wavs[e.id] = { pcm: v.pcm, rate: v.rate }; delete v.pcm; }
      out.voice.push(v);
    }
    out.wavs = wavs;
    // — colocación: SEEDS semillas —
    const reach = m._loreReach, W = m.w;
    const world = ents.filter((e) => e.w !== 'op' && e.w !== 'boss');
    const base = m.pois.base;
    const pos = (rep) => Object.fromEntries(rep.placed.map((p) => [p.id, [p.x, p.z]]));
    const stats = [];
    let repA = null;
    for (let s = 1; s <= SEEDS; s++) {
      const rep = L.rebuild(s * 7919 + 13);
      const P = rep.placed;
      let minD = 1e9, nn = 0, nnN = 0, minBase = 1e9, unreachable = 0, off = 0;
      const perReg = {};
      for (const p of P) {
        (perReg[p.reg] || (perReg[p.reg] = [])).push(p);
        minBase = Math.min(minBase, Math.hypot(p.x - base.x, p.z - base.z));
        if (!reach[Math.floor(p.z) * W + Math.floor(p.x)] && p.w !== 'term') unreachable++;
        if (m.regAt(p.x, p.z) !== p.reg) off++;
      }
      for (const r in perReg) {
        const l = perReg[r];
        for (let i = 0; i < l.length; i++) {
          let d1 = 1e9;
          for (let j = 0; j < l.length; j++) if (i !== j) { const d = Math.hypot(l[i].x - l[j].x, l[i].z - l[j].z); d < d1 && (d1 = d); minD = Math.min(minD, d); }
          if (d1 < 1e9) { nn += d1; nnN++; }
        }
      }
      // ruta voraz por región desde el campamento de la región
      let route = 0;
      for (const r in perReg) {
        const camp = m.pois['camp_' + r] || m.pois.base;
        let cx = camp.x, cz = camp.z;
        const left = perReg[r].slice();
        while (left.length) {
          let bi = 0, bd = 1e9;
          left.forEach((p, i) => { const d = Math.hypot(p.x - cx, p.z - cz); d < bd && (bd = d, bi = i); });
          route += bd; cx = left[bi].x; cz = left[bi].z; left.splice(bi, 1);
        }
      }
      stats.push({ seed: s, placed: P.length, fallback: rep.fallback.length, byForm: rep.byForm, minD, nn: nn / Math.max(1, nnN), minBase, unreachable, off, route });
      if (s === 1) repA = pos(rep);
    }
    out.stats = stats;
    // determinismo: misma semilla dos veces → mismas posiciones; semillas distintas → distinto reparto
    const a = pos(L.rebuild(1 * 7919 + 13)), b = pos(L.rebuild(1 * 7919 + 13)), c = pos(L.rebuild(2 * 7919 + 13));
    out.deterministic = JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(repA);
    let diff = 0, tot = 0;
    for (const id in a) { tot++; if (Math.hypot(a[id][0] - c[id][0], a[id][1] - c[id][1]) > 6) diff++; }
    out.diffFrac = diff / tot;
    // el mapa no cambia (mismo hash que sin el frente: se compara en lore-demo con la build base; aquí, que no hay NaN ni entidades repetidas)
    const ids = m.ents.map((e) => e.id);
    out.dupIds = ids.length - new Set(ids).size;
    L.rebuild(null, true);
    // — pistas —
    const keys = Object.keys(L.api.entries.length ? { 'valle.bunker': 1, 'ciudad.metro': 1, 'desierto.runas': 1, 'marisma.coro': 1, 'tundra.estacion': 1, 'complejo.clave': 1, 'caldera.valvulas': 1, 'yermo.reactor': 1, 'colmena.canto': 1 } : {});
    out.hints = {};
    const S = window.__G.S, keep = S.lore.seed;
    for (const k of keys) {
      const vals = new Set(); let bad = 0, nondet = 0, h0 = null;
      for (let s = 1; s <= 200; s++) {
        S.lore.seed = s * 104729 + 7;
        const h = L.hint(k), h2 = L.hint(k);
        if (h.value !== h2.value || h.display !== h2.display) nondet++;
        vals.add(h.value);
        if (h.kind === 'digits' && (h.seq[0] === 0 || h.seq.length !== h.len)) bad++;
        if ((h.kind === 'runes' || h.kind === 'colors') && new Set(h.seq).size !== h.seq.length) bad++;
        if (h.kind === 'order' && [...h.seq].sort().join('') !== Array.from({ length: h.len }, (_, i) => i + 1).join('')) bad++;
        if (h.kind === 'freq' && !(h.seq[0] >= 875 && h.seq[0] <= 1079)) bad++;
        if (h.kind === 'dirs' && h.seq.some((q, i) => i && q === h.seq[i - 1])) bad++;
        h0 = h;
      }
      out.hints[k] = { kind: h0.kind, len: h0.len, distinct: vals.size, bad, nondet, sample: h0.display };
    }
    S.lore.seed = keep;
    // — XP de descubrimiento de lore (cada entrada nueva emite 'lore': ecoCfg.xp.lore de la barra) —
    const xp = E.cfg.xp;
    let all = 0;
    for (let l = 1; l < 60; l++) all += E.mt.xpToNext(l);
    let loreXp = 0, colXp = 0;
    for (const e of ents) { const lv = Math.round((E.De[e.reg].lvl[0] + E.De[e.reg].lvl[1]) / 2); loreXp += xp.lore * E.mt.xpToNext(lv); }
    for (const c of L.api.collections) {
      const reg = c.rule.reg != null ? c.rule.reg : c.rule.th ? 5 : 8;
      const lv = Math.round((E.De[reg].lvl[0] + E.De[reg].lvl[1]) / 2);
      colXp += (c.rew.xp || 0) * E.mt.xpToNext(lv);
    }
    let legacy = 0;
    for (const pad of E.na) { const lv = pad.reg != null ? E.De[pad.reg].lvl[0] + 2 : 20; legacy += xp.lore * E.mt.xpToNext(lv); }
    out.nLegacy = E.na.length;
    out.xp = { all, loreXp, colXp, legacy, share: (loreXp + colXp) / all, shareLegacy: legacy / all };
    // — coste de CPU —
    out.cost = L.cost(20);
    out.cols = L.api.collections.map((c) => ({ id: c.id, n: L.colProgress(c.id).total, rew: c.rew }));
    return out;
  }, SEEDS);
  const real = errors.filter((e) => !/ERR_FAILED|net::/.test(e));
  if (real.length) r.errors = real.slice(0, 5);
  return r;
});

console.log('\n══ Colocación en el mundo real (' + SEEDS + ' semillas) ══');
const S = D.stats, avg = (f) => S.reduce((a, s) => a + f(s), 0) / S.length, mx = (f) => Math.max(...S.map(f)), mn = (f) => Math.min(...S.map(f));
const forms = {};
for (const s of S) for (const k in s.byForm) forms[k] = (forms[k] || 0) + s.byForm[k] / S.length;
console.log(`entradas de mundo colocadas por semilla: ${mn((s) => s.placed)}–${mx((s) => s.placed)} (esperadas ${LORE_ENTRIES.filter((e) => e.w !== 'op' && e.w !== 'boss').length}) · respaldo aleatorio: media ${avg((s) => s.fallback).toFixed(2)}, máx ${mx((s) => s.fallback)}`);
console.log('reparto medio por forma: ' + Object.entries(forms).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · '));
console.log(`distancia mínima entre nodos de una región: peor ${mn((s) => s.minD).toFixed(1)} m · media del vecino más cercano ${avg((s) => s.nn).toFixed(1)} m`);
console.log(`distancia mínima a la base: ${mn((s) => s.minBase).toFixed(1)} m · inalcanzables: ${mx((s) => s.unreachable)} · fuera de su región: ${mx((s) => s.off)}`);
const rt = avg((s) => s.route);
console.log(`ruta voraz por las 9 regiones (camp → nodos): ${(rt / 1000).toFixed(2)} km ≈ ${(rt / 5.2 / 60).toFixed(1)} min andando a 5,2 m/s (sin combate)`);
console.log(`determinista con la misma semilla: ${D.deterministic} · cambia con otra semilla: ${(D.diffFrac * 100).toFixed(0)} % de las entradas se mueven > 6 m · ids de entidad repetidos: ${D.dupIds}`);
check('todas las entradas de mundo se colocan en cada semilla', mn((s) => s.placed) === LORE_ENTRIES.filter((e) => e.w !== 'op' && e.w !== 'boss').length);
check('ninguna cae al respaldo aleatorio', mx((s) => s.fallback) === 0, `máx ${mx((s) => s.fallback)}`);
check('todo alcanzable y dentro de su región', mx((s) => s.unreachable) === 0 && mx((s) => s.off) === 0);
check('separación mínima ≥ 6 m entre nodos de una región', mn((s) => s.minD) >= 6, mn((s) => s.minD).toFixed(1) + ' m');
check('lejos de la base (≥ 20 m)', mn((s) => s.minBase) >= 20, mn((s) => s.minBase).toFixed(1) + ' m');
check('colocación determinista por semilla', D.deterministic);
check('semillas distintas dan repartos distintos (> 50 % de las entradas)', D.diffFrac > 0.5, (D.diffFrac * 100).toFixed(0) + ' %');
check('sin ids de entidad repetidos', D.dupIds === 0);

console.log('\n══ Pistas de puzle (200 semillas por clave) ══');
const H = D.hints;
for (const [k, h] of Object.entries(H)) console.log(`${k.padEnd(18)} ${h.kind.padEnd(6)} len ${h.len} · ${String(h.distinct).padStart(3)}/200 valores distintos · ejemplo: ${h.sample}`);
check('pistas deterministas y bien formadas', Object.values(H).every((h) => h.bad === 0 && h.nondet === 0));
check('cada pista varía con la partida (≥ 5 valores distintos en 200)', Object.values(H).every((h) => h.distinct >= 5));

console.log('\n══ Voz sintetizada (render fuera de línea, 22 050 Hz) ══');
console.log('grabación'.padEnd(22) + 'dur(s)  unidades  rms     pico   mod(Hz)  activa  NaN');
let totalSec = 0;
for (const v of D.voice) { totalSec += v.layoutDur; console.log(`${v.id.padEnd(22)}${String(v.layoutDur).padStart(6)}  ${String(v.units).padStart(8)}  ${v.rms.toFixed(3)}  ${v.peak.toFixed(2)}  ${String(v.modHz).padStart(7)}  ${v.active.toFixed(2)}    ${v.nan}`); }
console.log(`escucha total de las 22 grabaciones: ${(totalSec / 60).toFixed(1)} min · media ${(totalSec / D.voice.length).toFixed(1)} s`);
check('voz: señal finita y sin silencios totales', D.voice.every((v) => v.nan === 0 && v.rms > 0.01 && v.active > 0.4));
check('voz: sin saturación (pico < 1,0) y nivel razonable (rms 0,03-0,2)', D.voice.every((v) => v.peak < 1.0 && v.rms >= 0.03 && v.rms <= 0.2), `pico máx ${Math.max(...D.voice.map((v) => v.peak)).toFixed(2)} · rms ${Math.min(...D.voice.map((v) => v.rms)).toFixed(3)}-${Math.max(...D.voice.map((v) => v.rms)).toFixed(3)}`);
check('voz: modulación silábica 3-9 Hz', D.voice.every((v) => v.modHz >= 3 && v.modHz <= 9), `${Math.min(...D.voice.map((v) => v.modHz))}-${Math.max(...D.voice.map((v) => v.modHz))} Hz`);
check('grabaciones de 15 a 60 s', D.voice.every((v) => v.layoutDur >= 15 && v.layoutDur <= 60));
for (const [id, w] of Object.entries(D.wavs)) {
  const pcm = Buffer.from(w.pcm, 'base64'), hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(w.rate, 24); hdr.writeUInt32LE(w.rate * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(OUT, `voz-${id}.wav`), Buffer.concat([hdr, pcm]));
}

console.log('\n══ XP de descubrimiento ══');
const X = D.xp;
console.log(`registros antiguos (${D.nLegacy}): ${(X.legacy / X.all * 100).toFixed(2)} % del XP total hasta el nivel 60 · entradas nuevas (70): ${((X.loreXp - 0) / X.all * 100).toFixed(2)} % · recompensas de colección: ${(X.colXp / X.all * 100).toFixed(2)} %`);
console.log(`el lore nuevo y sus colecciones suman ${(X.share * 100).toFixed(2)} % del XP de 1 a 60 (el contrato reserva ≈ 25-35 % a todo lo que no es matar)`);
check('XP de lore nuevo ≤ 5 % del total (no desequilibra la curva)', X.share <= 0.05, (X.share * 100).toFixed(2) + ' %');

console.log('\n══ Coste de CPU ══');
console.log(`colocación completa del mundo: ${D.cost.buildMs} ms (solo al cargar la partida o cambiar de semilla) · barrido por fotograma: ${D.cost.scanUs} µs · nodos del mapa actual: ${D.cost.nodes}`);
check('colocación < 80 ms y barrido < 20 µs', D.cost.buildMs < 80 && D.cost.scanUs < 20);

console.log('\n══ Colecciones ══');
const pts = D.cols.filter((c) => c.rew.tp).length;
console.log(D.cols.map((c) => `${c.id} (${c.n})`).join(' · '));
console.log(`puntos de talento por colecciones: ${pts} (TALENTOS esperaba ≈ 8) · planos: ${D.cols.filter((c) => c.rew.plan).length} · mapas revelados: ${D.cols.filter((c) => c.rew.map).length}`);
check('11 colecciones, 9 con punto de talento', D.cols.length === 11 && pts === 9);
check('sin errores de página', !(D.errors && D.errors.length), (D.errors || []).join(' | '));

fs.writeFileSync(path.join(OUT, 'lore-sim.json'), JSON.stringify({ stats: D.stats.slice(0, 5), voice: D.voice, hints: D.hints, xp: D.xp, cost: D.cost, checks }, null, 1));
const bad = checks.filter((c) => !c.ok);
console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
process.exit(bad.length ? 1 : 0);
