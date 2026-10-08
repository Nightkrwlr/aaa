// Simulación de datos del frente HACKEO: tiempos de los minijuegos con bots de tres niveles de habilidad, éxito / traza / duración de las
// intrusiones (Monte Carlo sobre el código REAL de la sesión: traza, tiempos, reintentos y penalizaciones), curva de nivel de hackeo a lo
// largo de la campaña, recompensas por riesgo y daño real de una torreta controlada.
// uso:  node tools/shot.mjs --scenario tools/sim/hackeo.mjs --out DIR --size 640x360
// (nada se dibuja: todo corre con window.__hack y window.__step; los números no dependen de la GPU)
// Variables: N (sesiones por celda de la tabla Monte Carlo, 100), CAMP (campañas simuladas, 60), SECTIONS=1,2,3,4,5 (subconjunto), SEED
// HONESTIDAD: fw, tune y brute usan el simulador real del juego con bots (error de puntería, retardo de seguimiento, σ de pulsación);
// cifrado, enrutado y los cinco juegos antiguos NO se pueden simular con un bot que dependa de la habilidad: ahí el tiempo y la tasa de
// éxito son un MODELO declarado en SKILL (ver abajo), marcado como «modelo» en la salida.
export default async function (api) {
  const { boot, newGame, ev, god } = api;
  const N = Number(process.env.N || 100), CAMP = Number(process.env.CAMP || 60);
  const only = process.env.SECTIONS ? process.env.SECTIONS.split(',').map(Number) : [1, 2, 3, 4, 5];
  await boot(); await newGame(); await god();
  await ev((seed) => { window.__hack.rng(seed); window.__G.player.addXp = () => {}; }, Number(process.env.SEED || 20260610));

  const fmt = (o) => JSON.stringify(o);
  // ─── 1. minijuegos: tiempo de resolución y fallos por habilidad ──────────────────────────────────────────
  if (only.includes(1)) {
    console.log('\n══ 1. MINIJUEGOS · bots de habilidad (fw/tune/brute = simulador real; cifrado/enrutado = modelo) ══');
    const tbl = await ev(() => {
      const H = window.__hack, S = H.sims, out = {};
      const stat = (a) => { if (!a.length) return null; a = a.slice().sort((x, y) => x - y); return { med: +a[Math.floor(a.length / 2)].toFixed(1), p90: +a[Math.floor(a.length * 0.9)].toFixed(1) }; };
      const FW = { novato: [0.5, true, 34], medio: [0.3, false, 18], experto: [0.12, false, 7] };
      const BR = { novato: 0.17, medio: 0.1, experto: 0.05 };
      const TU = { novato: 0.7, medio: 0.45, experto: 0.25 };
      for (const sk of ['novato', 'medio', 'experto']) {
        for (let d = 1; d <= 5; d++) {
          // cortafuegos
          let ok = 0, ts = [], lost = 0; const lim = H.cfg.games.fw.time[d - 1], n = 30;
          for (let i = 0; i < n; i++) {
            const L = S.hkFwGen(5000 + i * 31 + d, d), sim = new S.HkFwSim(L, 1);
            while (!sim.over && sim.t < 200) { sim.bot(FW[sk][0], FW[sk][1], FW[sk][2]); sim.step(1 / 120); }
            lost += L.lives - Math.max(0, sim.lives);
            if (sim.over === 1 && sim.t <= lim) { ok++; ts.push(sim.t); }
          }
          out[`fw|${d}|${sk}`] = { p: ok / n, t: stat(ts), err: +(lost / n * 4).toFixed(1), lim };
          // fuerza bruta
          ok = 0; ts = []; let miss = 0;
          for (let i = 0; i < n; i++) {
            const L = S.hkBruteGen(6000 + i * 17 + d, d), sim = new S.HkBruteSim(L, 1);
            let q = 777 + i; const rnd = () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; };
            const g = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
            const plan = L.notes.map((nn) => ({ t: nn.t + g() * BR[sk], lane: nn.lane })).sort((a, b) => a.t - b.t);
            let k = 0;
            while (!sim.over && sim.clock < L.len + 6) { sim.step(1 / 120); while (k < plan.length && plan[k].t <= sim.clock) sim.press(plan[k++].lane); }
            miss += sim.miss;
            if (sim.over === 1) { ok++; ts.push(sim.clock); }
          }
          out[`brute|${d}|${sk}`] = { p: ok / n, t: stat(ts), err: +(miss / n * 1.2).toFixed(1), lim: Math.ceil(S.hkBruteGen(6000 + d, d).len + 8) };
          // sintonía
          ok = 0; ts = [];
          const lim2 = H.cfg.games.tune.time[d - 1];
          for (let i = 0; i < n; i++) {
            const P = S.hkTuneGen(7000 + i * 13 + d, d), tg = {};
            let f = 3.5, a = 0.6, p = Math.PI, lock = 0, tl = Infinity;
            for (let t = 0; t < lim2; t += 1 / 60) {
              S.hkTuneTarget(P, t, tg);
              const k = 1 - Math.exp(-1 / 60 / TU[sk]);
              f += (tg.f - f) * k; a += (tg.a - a) * k; p += (tg.p - p) * k;
              if (S.hkTuneErr(P, tg, f, a, p) <= 1) { lock += 1 / 60; if (lock >= P.hold) { tl = t; break; } } else lock = Math.max(0, lock - 1 / 120);
            }
            if (tl < Infinity) { ok++; ts.push(tl); }
          }
          out[`tune|${d}|${sk}`] = { p: ok / n, t: stat(ts), err: 0, lim: lim2 };
        }
      }
      return out;
    });
    const line = (kind, sk) => [1, 2, 3, 4, 5].map((d) => { const r = tbl[`${kind}|${d}|${sk}`]; return r.t ? `${Math.round(r.p * 100)}% ${r.t.med}s` : `${Math.round(r.p * 100)}%`; }).join('  ');
    console.log('(éxito dentro del límite · tiempo mediano)  dif. 1 … 5');
    for (const k of ['fw', 'tune', 'brute']) for (const sk of ['novato', 'medio', 'experto']) console.log(`${k.padEnd(6)} ${sk.padEnd(8)} ${line(k, sk)}   límites ${[1, 2, 3, 4, 5].map((d) => tbl[`${k}|${d}|medio`].lim).join('/')} s`);
  }

  // ─── 2. intrusiones completas (Monte Carlo sobre la sesión real) ───────────────────────────────────────
  const TARGETS = [
    ['relé d1 (1 capa)', { eff: 'relay', diff: 1 }],
    ['relé d3 (2 capas)', { eff: 'relay', diff: 3 }],
    ['cámara d2 (2 capas)', { eff: 'cache', diff: 2 }],
    ['cámara oculta d4 (3 capas)', { eff: 'secret', diff: 4 }],
    ['baliza d3 (3 capas)', { eff: 'boss', diff: 3 }],
  ];
  if (only.includes(2) || only.includes(3)) {
    // tabla de jugador por tipo de capa. Los tres juegos simulables salen de la sección 1 (recalculada aquí en pequeño); el resto es modelo.
    await ev(() => {
      const H = window.__hack, S = H.sims;
      const FW = { novato: [0.5, true, 34], medio: [0.3, false, 18], experto: [0.12, false, 7] };
      const BR = { novato: 0.17, medio: 0.1, experto: 0.05 }, TU = { novato: 0.7, medio: 0.45, experto: 0.25 };
      const MODEL = { // [mediana en s a dificultad 1, +s por dificultad, éxito, fallos menores esperados (puntos de traza)]
        cipher: { novato: [75, 12, 0.8, 5], medio: [50, 9, 0.92, 2.5], experto: [32, 6, 0.98, 0.5] },
        route: { novato: [32, 7, 0.82, 4], medio: [17, 4, 0.94, 1.5], experto: [10, 2.5, 0.985, 0.2] },
        seq: { novato: [26, 2, 0.8, 0], medio: [18, 2, 0.93, 0], experto: [13, 1.5, 0.98, 0] },
        pipe: { novato: [46, 4, 0.8, 0], medio: [28, 3, 0.92, 0], experto: [17, 2, 0.98, 0] },
        code: { novato: [64, 6, 0.78, 0], medio: [40, 5, 0.9, 0], experto: [24, 3, 0.97, 0] },
        sync: { novato: [28, 2, 0.8, 0], medio: [18, 2, 0.93, 0], experto: [12, 1.5, 0.98, 0] },
        lights: { novato: [58, 5, 0.8, 0], medio: [38, 4, 0.92, 0], experto: [23, 3, 0.98, 0] },
      };
      const T = { fw: {}, tune: {}, brute: {} };
      for (const sk of ['novato', 'medio', 'experto']) for (let d = 1; d <= 5; d++) {
        const n = 20, rec = { fw: { ok: 0, ts: [], e: 0 }, tune: { ok: 0, ts: [], e: 0 }, brute: { ok: 0, ts: [], e: 0 } };
        for (let i = 0; i < n; i++) {
          const L = S.hkFwGen(9000 + i * 31 + d, d), sim = new S.HkFwSim(L, 1);
          while (!sim.over && sim.t < 200) { sim.bot(FW[sk][0], FW[sk][1], FW[sk][2]); sim.step(1 / 120); }
          rec.fw.e += (L.lives - Math.max(0, sim.lives)) * 4; if (sim.over === 1) { rec.fw.ok++; rec.fw.ts.push(sim.t); }
          const B = S.hkBruteGen(9100 + i * 17 + d, d), bs = new S.HkBruteSim(B, 1);
          let q = 99 + i; const rnd = () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; };
          const g = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
          const plan = B.notes.map((nn) => ({ t: nn.t + g() * BR[sk], lane: nn.lane })).sort((a, b) => a.t - b.t); let k = 0;
          while (!bs.over && bs.clock < B.len + 6) { bs.step(1 / 120); while (k < plan.length && plan[k].t <= bs.clock) bs.press(plan[k++].lane); }
          rec.brute.e += bs.miss * 1.2; if (bs.over === 1) { rec.brute.ok++; rec.brute.ts.push(bs.clock); }
          const P = S.hkTuneGen(9200 + i * 13 + d, d), tg = {}; let f = 3.5, a = 0.6, p = Math.PI, lock = 0, tl = Infinity;
          for (let t = 0; t < 60; t += 1 / 60) { S.hkTuneTarget(P, t, tg); const kk = 1 - Math.exp(-1 / 60 / TU[sk]); f += (tg.f - f) * kk; a += (tg.a - a) * kk; p += (tg.p - p) * kk; if (S.hkTuneErr(P, tg, f, a, p) <= 1) { lock += 1 / 60; if (lock >= P.hold) { tl = t; break; } } else lock = Math.max(0, lock - 1 / 120); }
          if (tl < Infinity) { rec.tune.ok++; rec.tune.ts.push(tl); }
        }
        for (const k of ['fw', 'tune', 'brute']) { const r = rec[k]; const med = r.ts.length ? r.ts.sort((x, y) => x - y)[Math.floor(r.ts.length / 2)] : 40; T[k][`${sk}|${d}`] = { med, sig: 0.22, p: Math.max(0.02, r.ok / n), e: r.e / n }; }
      }
      for (const k in MODEL) { T[k] = {}; for (const sk in MODEL[k]) for (let d = 1; d <= 5; d++) { const m = MODEL[k][sk]; T[k][`${sk}|${d}`] = { med: m[0] + m[1] * (d - 1), sig: 0.28, p: m[2], e: m[3] }; } }
      window.__simT = T;
      window.__simRng = (seed) => { let q = seed >>> 0 || 1; const r = () => { q = (Math.imul(q, 1664525) + 1013904223) >>> 0; return q / 4294967296; }; r.g = () => (r() + r() + r() + r() - 2) * 1.7; return r; };
      // sustituye el montaje de cada capa por un jugador estocástico (la sesión, la traza, los límites y los reintentos son los reales)
      window.__simReal = {};
      for (const kind of Object.keys(T)) {
        window.__simReal[kind] = H.games[kind].mount;
        H.games[kind].mount = (root, ctx) => {
          const sk = window.__simSkill, rng = window.__simR, t = T[kind][`${sk}|${Math.min(5, ctx.diff)}`] || T[kind][`${sk}|3`];
          const win = rng() < t.p, td = Math.max(1.5, t.med * Math.exp(t.sig * rng.g())) * (win ? 1 : 1.5);
          let el = 0; const nerr = Math.max(0, Math.round(t.e / 4 + rng.g() * 0.5)); const errs = Array.from({ length: nerr }, () => rng() * td).sort((a, b) => a - b); let ei = 0;
          return {
            step(dt) { el += dt; while (ei < errs.length && errs[ei] <= el) { ctx.err(t.e / Math.max(1, nerr), 'simulado'); ei++; } if (el >= td) win ? ctx.win() : ctx.fail('simulado'); },
            destroy() {}, assist: () => false,
          };
        };
      }
    });
  }
  // N sesiones de una celda dentro de la página (sin ir y venir por CDP): devuelve éxito, traza y duración medias
  const runCell = (spec, o, n) => ev(([spec, o, n]) => {
    const H = window.__hack, S = H.state(); window.__simSkill = o.skill;
    let ok = 0, tr = 0, tm = 0, xp = 0, k = 0;
    for (let i = 0; i < n; i++) {
      window.__simR = window.__simRng(o.seed + i * 7919);
      S.lvl = o.lvl; S.xp = 0; S.heat = o.heat || 0; S.tools = {}; S.loadout = [];
      const s0 = H.open(Object.assign({}, spec, { noPre: true, risk: o.risk, noRewards: true, seed: o.seed + i * 31 }), null);
      if (!s0) continue;
      s0.manual = true; let guard = 0;
      while (!s0.ended && guard++ < 40000) H.step(1, 0.25);
      const r = H.HK.last; document.querySelector('#panel [data-close]')?.click();
      if (r) { ok += r.ok ? 1 : 0; tr += r.traza; tm += r.tiempo; xp += r.xp; k++; }
    }
    return { ok: ok / k, tr: tr / k, t: tm / k, xp: xp / k };
  }, [spec, o, n]);

  if (only.includes(2)) {
    console.log('\n══ 2. INTRUSIONES · éxito % / traza final media / duración media (s)  [N=' + N + ' sesiones por celda] ══');
    console.log('(jugador estocástico sobre la sesión real; habilidad: novato / medio / experto; nivel de hackeo L; riesgo cauto · estándar · agresivo)');
    for (const [name, t] of TARGETS) {
      const need = await ev((d) => window.__hack.cfg.needByDiff[d], t.diff);
      const E = await ev((e) => window.__hack.cfg.eff[e], t.eff);
      const layers = Math.min(3, E.layers + (t.diff >= E.plusAt ? 1 : 0));
      console.log(`\n▸ ${name} · recomendado nv ${need}`);
      for (const skill of ['novato', 'medio', 'experto']) {
        const cells = [];
        for (const lvl of [1, 4, 8, 12, 20]) {
          const per = [];
          for (const risk of [0, 1, 2]) {
            const r = await runCell({ target: 'terminal', objetivo: 'terminal', title: 'sim', diff: t.diff, layers, need, xp: E.xp }, { skill, lvl, risk, seed: 1000 + lvl * 131 + risk * 17 }, N);
            per.push(`${String(Math.round(100 * r.ok)).padStart(3)}% ${String(Math.round(r.tr)).padStart(2)}% ${String(Math.round(r.t)).padStart(3)}s`);
          }
          cells.push(`L${String(lvl).padEnd(2)} ${per.join(' · ')}`);
        }
        console.log(`  ${skill.padEnd(8)} ${cells.join('   |   ')}`);
      }
    }
  }

  // ─── 3. curva de nivel de hackeo a lo largo de la campaña ───────────────────────────────────────────────
  if (only.includes(3)) {
    console.log('\n══ 3. NIVEL DE HACKEO EN LA CAMPAÑA (habilidad media, riesgo estándar; ' + CAMP + ' campañas) ══');
    console.log('Cada región: 3 relés + 1 cámara + 1 relé de estación + 1 cámara oculta + 1 baliza + 6 torretas/mechs hackeados; dificultad por región = min(3, 1 + región/3).');
    const camp = await ev(([CAMP]) => {
      const H = window.__hack, S = H.state(), out = { lvl: [], hacks: [], mins: [], ok: [] };
      const E = H.cfg.eff;
      for (let r = 0; r < 9; r++) { out.lvl.push(0); out.hacks.push(0); out.mins.push(0); out.ok.push(0); }
      const regions = (r) => { const d = Math.min(3, 1 + Math.floor(r / 3)), ds = Math.min(4, d + 1); return [
        ...[0, 1, 2].map(() => ['relay', d]), ['cache', d], ['relay', d], ['secret', ds], ['boss', d],
        ...[0, 1, 2, 3, 4, 5].map((i) => ['enemy', Math.min(4, 1 + Math.floor((r * 5 + 3) / 14))]),
      ]; };
      for (let c = 0; c < CAMP; c++) {
        S.lvl = 1; S.xp = 0; S.heat = 0; S.tools = {}; S.loadout = [];
        let hacks = 0, mins = 0;
        for (let r = 0; r < 9; r++) {
          out.lvl[r] += S.lvl; // nivel al ENTRAR en la región
          for (const [kind, d] of regions(r)) {
            const isE = kind === 'enemy', e = E[kind];
            const layers = isE ? 1 : Math.min(3, e.layers + (d >= e.plusAt ? 1 : 0)), need = isE ? H.cfg.enemy.needControl + 2 * (d - 1) : H.cfg.needByDiff[d];
            window.__simSkill = 'medio'; window.__simR = window.__simRng(c * 1013 + r * 71 + hacks);
            const spec = { target: isE ? 'enemy' : 'terminal', objetivo: 'terminal', title: 'sim', diff: d, layers, need, xp: isE ? 16 : e.xp, noPre: true, risk: 1, noRewards: true, seed: c * 99991 + hacks * 31 + r };
            const s0 = H.open(spec, null);
            if (!s0) continue; s0.manual = true; let g = 0; while (!s0.ended && g++ < 40000) H.step(1, 0.25);
            const res = H.HK.last; hacks++; mins += res.tiempo / 60 + 0.4; out.ok[r] += res.ok ? 1 : 0;
            document.querySelector('#panel [data-close]')?.click();
          }
        }
        out.hacks[8] += hacks; out.mins[8] += mins; out.lvl.push(S.lvl);
      }
      out.fin = out.lvl.splice(9, CAMP); // nivel final de cada campaña
      return out;
    }, [CAMP]);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    console.log('región →        ' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => `R${r}`.padStart(5)).join(' '));
    console.log('nivel al entrar ' + camp.lvl.slice(0, 9).map((v) => (v / CAMP).toFixed(1).padStart(5)).join(' '));
    const fin = camp.fin.slice().sort((a, b) => a - b);
    console.log(`nivel al terminar las 9 regiones: media ${mean(camp.fin).toFixed(1)} · mediana ${fin[Math.floor(fin.length / 2)]} · mín ${fin[0]} · máx ${fin[fin.length - 1]}`);
    console.log(`hackeos por campaña: ${(camp.hacks[8] / CAMP).toFixed(0)} · tiempo total hackeando: ${(camp.mins[8] / CAMP).toFixed(0)} min · éxito medio ${(100 * camp.ok.reduce((a, b) => a + b, 0) / camp.hacks[8] / CAMP * CAMP).toFixed(0)} %`);
    const xpTab = await ev(() => { const H = window.__hack, o = []; let cum = 0; for (let n = 1; n < H.cfg.maxLevel; n++) { cum += H.xpToNext(n); o.push([n + 1, H.xpToNext(n), cum]); } return o; });
    console.log('nivel · XP del nivel · XP acumulado: ' + xpTab.filter((r) => [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].includes(r[0])).map((r) => `L${r[0]} ${r[1]}/${r[2]}`).join(' · '));
  }

  // ─── 4. recompensas por riesgo (esperanza matemática de hkRewards) ──────────────────────────────────────
  if (only.includes(4)) {
    console.log('\n══ 4. RECOMPENSAS POR RIESGO (esperanza por intrusión con éxito, nivel de zona 10) ══');
    const rw = await ev(() => {
      const H = window.__hack, R = H.cfg.reward, out = [], lvl = 10, mc = 1 + 0.25 * (lvl - 1);
      for (const layers of [1, 2, 3]) for (const risk of [0, 1, 2]) {
        const k = H.cfg.risk[risk].rew, n = Math.min(3, layers + H.cfg.risk[risk].extra);
        let tier = n >= 3 ? 2 : n >= 2 ? 1 : 0; if (risk === 2 && tier > 0) tier++; tier = Math.min(3, tier);
        out.push({ layers, risk: H.cfg.risk[risk].n, capas: n, creditos: Math.round(R.credits * mc * n * k), datos: Math.max(1, Math.round((R.data[n] || 1) * k)), cofre: tier, programa: +(R.programChance[risk] * Math.min(1.5, n / 2)).toFixed(2), plano: (n >= 2 || risk === 2) ? 'tirada al 20 %' : '—', xp: Math.round(26 * H.cfg.layerXp[n] * H.cfg.risk[risk].xp) });
      }
      return out;
    });
    console.log('capas base · riesgo · capas reales · créditos · datos · cofre (tier) · prob. programa · plano de gadget · XP de hackeo (relé/cámara 26 base)');
    for (const r of rw) console.log(`  ${r.layers} · ${r.risk.padEnd(8)} · ${r.capas} · ${String(r.creditos).padStart(4)} ¤ · ${r.datos} datos · cofre ${r.cofre} · programa ${r.programa} · ${r.plano} · ${r.xp} XP`);
  }

  // ─── 5. torreta controlada: daño real frente al del jugador ──────────────────────────────────────────────
  if (only.includes(5)) {
    console.log('\n══ 5. TORRETA CONTROLADA (3 mechs inmóviles a 7 m de la torreta; daño medido con la simulación real durante 14 s) ══');
    console.log('Fuera del Bastión (sus torretas aliadas matan todo lo que haya cerca). control = torreta enemiga hackeada · jugador = tu arma sola contra el mismo grupo · gadget = torreta centinela');
    await api.region('desierto');
    await ev(() => { window.__G.player.addXp = () => {}; });
    // carril despejado de 24 m × 8 m (misma búsqueda que tools/sim/gadgets.mjs)
    const lane = await ev(() => {
      const G = window.__G, m = G.map, p = G.player, cx = p.x, cz = p.z;
      const free = (x, z) => { for (let dx = -2; dx <= 24; dx += 1.5) for (let dz = -4; dz <= 4; dz += 2) if (m.circleHits(x + dx, z + dz, 0.7)) return false; return true; };
      for (let r = 0; r <= 90; r += 6) for (let a = 0; a < 6.283; a += r ? 6 / r : 7) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (free(x, z)) return { x, z, r }; }
      return null;
    });
    if (!lane) throw new Error('sin carril despejado en la región de pruebas');
    await api.teleport(lane.x, lane.z);
    for (const lvl of [5, 15, 30]) {
      const r = await ev(([lvl, lane]) => {
        const G = window.__G, h = window.__hack, p = G.player, out = {};
        G.uiBlockDamage = true; G.paused = false; h.state().lvl = 10; h.state().tools = {};
        const clear = () => { for (const e of G.enemies) e.dead = true; G.enemies.length = 0; G.projs.length = 0; window.__gadgets.clear(); };
        const group = () => { const ms = [0, 1, 2].map((i) => window.__spawn('mech', lvl, lane.x + 7 + i * 1.6, lane.z + 1 - i)); ms.forEach((m) => { m.alerted = false; m.static = true; }); window.__step(3, 1 / 30); return ms; };
        const hpOf = (ms) => ms.reduce((a, m) => a + Math.max(0, m.hp), 0), maxOf = (ms) => ms.reduce((a, m) => a + m.maxHp, 0);
        const away = () => { p.x = lane.x - 26; p.z = lane.z; }, home = () => { p.x = lane.x; p.z = lane.z; };
        const secs = 14, n = Math.round(secs * 30);
        const pct = (hp0, ms) => Math.round(100 * (hp0 - hpOf(ms)) / maxOf(ms));
        out.dps = Math.round(0);
        clear(); away(); let tur = window.__spawn('torreta', lvl, lane.x, lane.z), ms = group(), hp0 = hpOf(ms);
        h.applyControl(tur, secs, false); window.__step(n, 1 / 30); out.ctl = pct(hp0, ms);
        clear(); away(); tur = window.__spawn('torreta', lvl, lane.x, lane.z); ms = group(); hp0 = hpOf(ms);
        h.applyControl(tur, secs, true); window.__step(n + 30, 1 / 30); out.over = pct(hp0, ms); out.overKills = ms.filter((m) => m.dead).length;
        clear(); home(); ms = group(); hp0 = hpOf(ms); window.__step(n, 1 / 30); out.player = pct(hp0, ms);
        clear(); away(); ms = group(); hp0 = hpOf(ms); window.__gadgets.learn('sentinel', 3); window.__gadgets.deploy('sentinel', { force: true, x: lane.x, z: lane.z }); window.__step(n, 1 / 30); out.gadget = pct(hp0, ms);
        clear(); home();
        return out;
      }, [lvl, lane]);
      console.log(`  enemigos nv ${String(lvl).padStart(2)}: vida de los 3 mechs quitada en 14 s → torreta controlada ${r.ctl} % · con sobrecarga ${r.over} % (${r.overKills} muertos) · jugador solo ${r.player} % · gadget centinela ${r.gadget} %`);
    }
  }
}
