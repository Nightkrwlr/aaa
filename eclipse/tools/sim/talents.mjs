// Simulación del árbol de talentos (31b-talents.js): estructura, topes de seguridad y builds de 30 puntos contra una horda fija.
// Se ejecuta con el arnés de capturas (arranca la build real y evalúa en la página):
//   node tools/build.mjs && node tools/shot.mjs --scenario tools/sim/talents.mjs --size 640x360 --out /ruta [--seed 1]
// Variables de entorno: TRIALS (repeticiones por build, 3), SECS (duración, 60), LVL (nivel del jugador, 30), ELVL (nivel de los enemigos, = LVL), HORDE (enemigos vivos a la vez, 20).
// Imprime tablas; con --seed igual el resultado es reproducible salvo el ruido del RNG interno del juego (por eso se promedian TRIALS pruebas).
export default async function (api) {
  const { boot, newGame, ev } = api;
  const TRIALS = +(process.env.TRIALS || 3), SECS = +(process.env.SECS || 60), LVL = +(process.env.LVL || 30), ELVL = +(process.env.ELVL || LVL), HORDE = +(process.env.HORDE || 20);
  await boot(); await newGame();

  // ───────────────────────── 1 · estructura del árbol
  const st = await ev(() => {
    const C = window.__talents.cfg(), out = { problems: [] };
    out.total = C.nodes.length;
    out.perBranch = Object.fromEntries(C.branches.map((b) => [b.id, C.nodes.filter((n) => n.br === b.id).length]));
    out.keys = C.nodes.filter((n) => n.key).length; out.powers = C.nodes.filter((n) => n.pow && !n.key).length;
    out.maxPts = C.nodes.reduce((a, n) => a + n.max * n.cost, 0);
    out.ptsPerBranch = Object.fromEntries(C.branches.map((b) => [b.id, C.nodes.filter((n) => n.br === b.id).reduce((a, n) => a + n.max * n.cost, 0)]));
    const ids = new Set();
    for (const n of C.nodes) { if (ids.has(n.id)) out.problems.push('id repetido ' + n.id); ids.add(n.id); }
    for (const n of C.nodes) for (const q of n.req) if (!C.byId[q]) out.problems.push(`${n.id} requiere ${q}, que no existe`);
    // alcanzabilidad: desde las raíces (sin req) por adyacencia
    const reach = new Set(C.nodes.filter((n) => !n.req.length).map((n) => n.id));
    for (let ch = true; ch;) { ch = false; for (const n of C.nodes) if (!reach.has(n.id) && n.req.some((q) => reach.has(q))) { reach.add(n.id); ch = true; } }
    if (reach.size !== C.nodes.length) out.problems.push('nodos inalcanzables: ' + C.nodes.filter((n) => !reach.has(n.id)).map((n) => n.id).join(','));
    // solapes visuales: distancia mínima entre centros
    let minD = 1e9, pair = '';
    for (let i = 0; i < C.nodes.length; i++) for (let j = i + 1; j < C.nodes.length; j++) {
      const a = C.nodes[i], b = C.nodes[j], d = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]);
      if (d < minD) { minD = d; pair = a.id + ' / ' + b.id; }
    }
    out.minDist = Math.round(minD); out.minPair = pair;
    out.noStat = C.nodes.filter((n) => !Object.keys(n.st).length && !n.fx && !n.pow).map((n) => n.id);
    out.noCon = C.nodes.filter((n) => n.key && !n.con).map((n) => n.id);
    const R = Math.max(...C.nodes.map((n) => Math.hypot(n.at[0], n.at[1])));
    out.maxRadius = Math.round(R);
    return out;
  });
  console.log('\n== ESTRUCTURA ==');
  console.log(`nodos ${st.total} (${JSON.stringify(st.perBranch)}), claves ${st.keys}, poderes ${st.powers}`);
  console.log(`coste de comprar TODO: ${st.maxPts} puntos (${JSON.stringify(st.ptsPerBranch)}); puntos que da el juego ≈ 59 + 9 + ≈8 = 76`);
  console.log(`distancia mínima entre nodos: ${st.minDist}px (${st.minPair}); radio máximo ${st.maxRadius}px`);
  console.log(st.problems.length ? 'PROBLEMAS: ' + st.problems.join('; ') : 'sin problemas estructurales');
  if (st.noStat.length) console.log('nodos sin efecto:', st.noStat.join(','));
  if (st.noCon.length) console.log('claves sin contrapartida:', st.noCon.join(','));

  // ───────────────────────── 2 · topes de seguridad (ningún nodo ni el árbol completo rompe el juego)
  const caps = await ev((LVL) => {
    const G = window.__G, S = G.S, p = G.player, T = window.__talents, C = T.cfg();
    S.lvl = LVL; p.recalc();
    const read = () => {
      p.hp = p.maxHp;
      const w = p.ws[0] || {};
      const dps = (w.dmgBase || 0) * (w.rate || 0) * (1 + (w.multi || 0) * 0.6) * (1 + (w.critC || 0) * ((w.critM || 1.5) - 1));
      const ehp = (p.maxHp + p.maxShield) / (1 - p.dmgRed) / (1 - p.dodge);
      return { dps, ehp, spd: p.speed, hp: p.maxHp, dmgRed: p.dmgRed, dodge: p.dodge, crit: w.critC, fireRate: w.rate, powers: p.powers.size, fx: JSON.stringify(S.talentFx) };
    };
    const base = read();
    const worst = [];
    // cada nodo al máximo, sin tener en cuenta prerrequisitos (peor caso aislado)
    for (const n of C.nodes) {
      T.setBuild({ [n.id]: n.max }); const r = read();
      worst.push({ id: n.id, n: n.n, dps: r.dps / base.dps, ehp: r.ehp / base.ehp, spd: r.spd / base.spd, ok: [r.dps, r.ehp, r.spd, r.hp].every((v) => Number.isFinite(v) && v > 0) });
    }
    // árbol completo
    const all = {}; for (const n of C.nodes) all[n.id] = n.max;
    T.setBuild(all); const full = read(); const fullSt = JSON.parse(JSON.stringify(p.st));
    // perks antiguos al máximo (referencia del diseño: «el árbol completo ≈ los perks antiguos al máximo»)
    const old = T.oldPerksMax();
    T.setBuild({});
    return { base, worst, full, fullStats: fullSt, old };
  }, LVL);
  const top = (k, n = 4) => [...caps.worst].sort((a, b) => b[k] - a[k]).slice(0, n).map((w) => `${w.n} ×${w[k].toFixed(2)}`).join(', ');
  console.log('\n== TOPES (un solo nodo al máximo, nivel ' + LVL + ') ==');
  console.log('DPS efectivo, mayores:', top('dps'));
  console.log('Vida efectiva, mayores:', top('ehp'));
  console.log('Velocidad, mayores:', top('spd'));
  console.log('nodos que dan NaN/∞/≤0:', caps.worst.filter((w) => !w.ok).map((w) => w.id).join(',') || 'ninguno');
  console.log(`ÁRBOL COMPLETO: DPS ×${(caps.full.dps / caps.base.dps).toFixed(2)}, vida efectiva ×${(caps.full.ehp / caps.base.ehp).toFixed(2)}, velocidad ×${(caps.full.spd / caps.base.spd).toFixed(2)}, reducción ${(caps.full.dmgRed * 100).toFixed(0)}%, esquiva ${(caps.full.dodge * 100).toFixed(0)}%, crítico ${(caps.full.crit * 100).toFixed(0)}%`);
  const o = caps.old;
  console.log(`perks antiguos al máximo (referencia): daño +${(o.dmg * 100).toFixed(0)}%, cadencia +${(o.fireRate * 100).toFixed(0)}%, vida +${(o.maxHpPct * 100).toFixed(0)}%, crítico +${(o.critChance * 100).toFixed(0)}%, esquiva +${(o.dodge * 100).toFixed(0)}%`);
  const f = caps.fullStats;
  console.log('presupuesto de estadísticas, árbol completo / perks antiguos al máximo (1.00 = igual):');
  console.log('  ' + ['dmg', 'fireRate', 'maxHpPct', 'critChance', 'critDmg', 'dodge', 'moveSpeed', 'reload', 'magSize', 'luck', 'xpGain', 'credits', 'shieldPct', 'elemDmg', 'pickup'].map((k) => `${k} ${(f[k] || 0).toFixed(2)}/${(o[k] || 0).toFixed(2)}`).join(' · '));

  // ───────────────────────── 3 · builds de 30 puntos contra una horda fija
  // Cada build es una lista de prioridades [id, rangos]; se compra en orden respetando prerrequisitos y la regla de nodos clave.
  const B = (br, ...rows) => rows.map(([s, r]) => [`t_${br}_${s}`, r]);
  const builds = {
    'sin talentos': [],
    'tanque (Bastión)': B('bas', ['root', 3], ['b1', 5], ['b2', 4], ['b3', 4], ['b4', 1], ['b5', 1], ['b6', 1], ['kb', 1], ['b4', 5], ['b6', 3], ['c1', 5]),
    'cañón de cristal (Artillería)': B('art', ['root', 3], ['b1', 5], ['b2', 4], ['b3', 1], ['b4', 3], ['b5', 3], ['b6', 1], ['kb', 1], ['b3', 4], ['b6', 3], ['c1', 5], ['c2', 5]),
    'velocista (Espectro)': B('esp', ['root', 3], ['a1', 4], ['b1', 5], ['b2', 4], ['b3', 1], ['b4', 1], ['b5', 1], ['b6', 1], ['kb', 1], ['b3', 4], ['b6', 3], ['c1', 5]),
    'elemental (Elemental)': B('ele', ['root', 3], ['a1', 5], ['a2', 4], ['a3', 4], ['a4', 3], ['a5', 1], ['a6', 1], ['ka', 1], ['a6', 3], ['b1', 5], ['b2', 5]),
    'disperso (5 por rama)': [].concat(...['bas', 'art', 'esp', 'ing', 'ele', 'caz'].map((br) => B(br, ['root', 3], ['b1', 2]))),
    'disperso (15 en 3 ramas)': [].concat(...['bas', 'art', 'esp'].map((br) => B(br, ['root', 3], ['b1', 5], ['b2', 2]))),
  };
  const PTS = 30;
  console.log(`\n== BUILDS DE ${PTS} PUNTOS vs HORDA CONTINUA (jugador nivel ${LVL}, ${HORDE} enemigos vivos de nivel ${ELVL}, ${SECS} s, ${TRIALS} pruebas, equipo Raro) ==`);
  const rows = [];
  for (const [name, prio] of Object.entries(builds)) {
    const r = await ev(([prio, PTS, LVL, ELVL, HORDE, SECS, TRIALS]) => {
      const G = window.__G, S = G.S, p = G.player, T = window.__talents, C = T.cfg();
      // equipo fijo (se crea una vez) para que solo cambien los talentos
      if (!window.__simGear) {
        window.__simGear = T.simGear(LVL, 2);
      }
      p.addXp = () => {};
      Object.assign(S.eq, window.__simGear); S.lvl = LVL;
      // compra real (con la regla de prerrequisitos y claves)
      T.respec && (S.credits = 1e9);
      S.talentEarned = PTS; S.talentPts = PTS; for (const n of C.nodes) delete S.perks[n.id];
      let bought = 0;
      for (const [id, want] of prio) for (let i = 0; i < want; i++) { if (T.buy(id)) bought++; else break; }
      // los puntos sobrantes (por reglas) se quedan sin gastar: se informa
      const left = S.talentPts;
      p.recalc();
      const keys = C.nodes.filter((n) => n.key && S.perks[n.id]).map((n) => n.n);
      const stat = { hp: Math.round(p.maxHp + p.maxShield), dmgRed: +p.dmgRed.toFixed(2), dodge: +p.dodge.toFixed(2), spd: +p.speed.toFixed(2), dmg: +(p.ws[0].dmgBase).toFixed(1), rate: +p.ws[0].rate.toFixed(2), multi: p.ws[0].multi };
      const out = { left, keys, stat, trials: [] };
      const cycle = ['rastrero', 'rastrero', 'escupidor', 'rastrero', 'bruto', 'rastrero', 'escupidor', 'acorazado'];
      const key = (c, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: c }));
      for (let t = 0; t < TRIALS; t++) {
        // reinicio de la prueba
        for (const e of G.enemies) e.remove(); G.enemies.length = 0;
        for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']) key(k, false);
        G.uiOpen = null; G.paused = false; { const pn = document.querySelector('#panel'); pn && (pn.hidden = true, pn.innerHTML = ''); }
        G.uiBlockDamage = false; p.dead = false; p.inv = 0; p.buffs = {}; p.burnT = p.poisonT = p.slowT = 0;
        p.x = 292; p.z = 292; p.vx = p.vz = 0; p.hp = p.maxHp; p.shield = p.maxShield; p.phoenixCd = 0; p.dashCd = 0; p.dashT = 0; p.deadT = 0;
        const all = [];
        let spawned = 0;
        // horda continua: se mantienen HORDE enemigos vivos alrededor (como un asedio), nivel ELVL
        const topUp = () => {
          let alive = 0; for (const e of all) if (!e.dead) alive++;
          for (; alive < HORDE; alive++, spawned++) {
            const a = (spawned * 2.399) % (Math.PI * 2), r = 11 + (spawned % 4) * 1.5;
            const e = window.__spawn(cycle[spawned % cycle.length], ELVL, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, { alerted: true });
            if (e) { e.alerted = true; all.push(e); }
          }
        };
        let tEnd = SECS, dmgTaken = 0, lastHp = p.hp + p.shield, hpDealt = 0;
        const dt = 1 / 30, n = Math.round(SECS / dt);
        let held = new Set();
        for (let s = 0; s < n; s++) {
          if (s % 30 === 0) topUp();
          // política: huir de la masa de enemigos cercanos (kiting) cada 6 fotogramas y esprintar si hay alguno encima
          if (s % 6 === 0) {
            let cx = 0, cz = 0, c = 0, near = 1e9;
            for (const e of all) if (!e.dead) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < 14) { cx += e.x; cz += e.z; c++; } near = Math.min(near, d); }
            const want = new Set();
            if (c) { const dx = p.x - cx / c, dz = p.z - cz / c, m = Math.hypot(dx, dz) || 1; if (dx / m > 0.35) want.add('KeyD'); if (dx / m < -0.35) want.add('KeyA'); if (dz / m > 0.35) want.add('KeyS'); if (dz / m < -0.35) want.add('KeyW'); }
            if (near < 2.6 && p.dashCd <= 0) { key('Space', true); key('Space', false); }
            for (const k of held) if (!want.has(k)) key(k, false);
            for (const k of want) if (!held.has(k)) key(k, true);
            held = want;
          }
          if (G.uiOpen) { G.uiOpen = null; G.paused = false; const pn = document.querySelector('#panel'); pn && (pn.hidden = true, pn.innerHTML = ''); } // el panel de muerte (setTimeout) pausaría la simulación
          window.__step(1, dt);
          const cur = p.hp + p.shield; if (cur < lastHp) dmgTaken += lastHp - cur; lastHp = cur;
          if (p.dead || p.hp <= 0) { tEnd = s * dt; break; }
        }
        let kills = 0; for (const e of all) { if (e.dead) { kills++; hpDealt += e.maxHp; } else hpDealt += Math.max(0, e.maxHp - e.hp); }
        const elapsed = Math.max(1, Math.min(tEnd, SECS));
        out.trials.push({ kills, dps: hpDealt / elapsed, surv: tEnd, died: p.dead || p.hp <= 0, hpPct: Math.max(0, p.hp / p.maxHp), taken: dmgTaken });
        p.dead = false;
        for (const k of held) key(k, false);
      }
      for (const e of G.enemies) e.remove(); G.enemies.length = 0;
      return out;
    }, [prio, PTS, LVL, ELVL, HORDE, SECS, TRIALS]);
    const avg = (k) => r.trials.reduce((a, t) => a + (+t[k] || 0), 0) / r.trials.length;
    const row = { name, kills: avg('kills'), dps: avg('dps'), surv: avg('surv'), died: r.trials.filter((t) => t.died).length, hpPct: avg('hpPct'), taken: avg('taken'), keys: r.keys.join('+') || '—', left: r.left, stat: r.stat };
    rows.push(row);
    console.log(`${name.padEnd(30)} bajas ${row.kills.toFixed(1).padStart(5)}  DPS ${row.dps.toFixed(0).padStart(6)}  supervivencia ${row.surv.toFixed(1).padStart(5)}s  muertes ${row.died}/${TRIALS}  vida final ${(row.hpPct * 100).toFixed(0).padStart(3)}%  daño recibido ${row.taken.toFixed(0).padStart(6)}  claves: ${row.keys}  (sin gastar ${row.left})`);
    console.log(`${''.padEnd(30)} stats: vida+escudo ${r.stat.hp}, reducción ${r.stat.dmgRed}, esquiva ${r.stat.dodge}, vel ${r.stat.spd}, daño/disparo ${r.stat.dmg}, cadencia ${r.stat.rate}, extra proyectiles ${r.stat.multi}`);
  }
  // veredicto: cada build especializado se juzga en SU tarea y debe superar al mejor build disperso en esa misma métrica
  //   tanque → segundos vivo y daño absorbido; cañón → ritmo de bajas por segundo vivo (DPS efectivo); velocista → segundos vivo; elemental → bajas totales
  const rate = (r) => r.kills / Math.max(1, r.surv);
  const disp = rows.filter((r) => r.name.startsWith('disperso')), base = rows[0];
  const task = { tanque: ['segundos vivo', (r) => r.surv], 'cañón': ['bajas por segundo vivo', rate], velocista: ['segundos vivo', (r) => r.surv], elemental: ['bajas totales', (r) => r.kills] };
  console.log('\n== VEREDICTO ==');
  let allWin = true;
  for (const r of rows.filter((q) => !q.name.startsWith('disperso') && q !== base)) {
    const k = Object.keys(task).find((q) => r.name.startsWith(q)), [lbl, f] = task[k];
    const best = Math.max(...disp.map(f)), win = f(r) > best * 1.1;
    allWin = allWin && win;
    console.log(`${r.name.padEnd(30)} ${lbl}: ${f(r).toFixed(2)} vs mejor disperso ${best.toFixed(2)} (sin talentos ${f(base).toFixed(2)}) → ${win ? 'GANA (>10 %)' : 'NO GANA'}`);
  }
  console.log(allWin ? 'ESPECIALIZARSE GANA A DISPERSARSE en las cuatro tareas.' : 'ATENCIÓN: algún build especializado no supera claramente al disperso.');
  const errs = api.logs.filter((l) => /pageerror|\[error\]/.test(l));
  console.log(errs.length ? 'ERRORES DE CONSOLA:\n' + errs.slice(0, 5).join('\n') : 'sin errores de consola');
}
