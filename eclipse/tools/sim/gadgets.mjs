// Simulación de datos del frente GADGETS: cada gadget contra la misma manada, coste en minutos de farmeo, rendimiento con 100 desplegados.
// uso:  node tools/shot.mjs --scenario tools/sim/gadgets.mjs --out DIR --size 640x360 --quality low
// (shot.mjs arranca la build y entrega `api`; todo se mide con window.__step, sin dibujar: los números no dependen de la GPU)
// Variables: TRIALS (por defecto 3), SECS (segundos simulados por prueba, 22), ONLY=proximity,cluster (subconjunto), SKIP_PERF=1
export default async function (api) {
  const { boot, newGame, ev, perf, wait, god, region } = api;
  const TRIALS = Number(process.env.TRIALS || 3), SECS = Number(process.env.SECS || 22);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  await boot(); await newGame(); await god();
  await region('desierto'); // fuera del Bastión: allí las torretas aliadas dispararían a la manada
  await ev(() => { window.__G.player.addXp = () => {}; });
  // busca un carril despejado (22 m al este × 8 m de ancho) en espiral alrededor de la región y coloca allí al jugador
  const lane = await ev(() => {
    const G = window.__G, m = G.map, p = G.player, cx = p.x, cz = p.z;
    const free = (x, z) => { for (let dx = -2; dx <= 22; dx += 1.5) for (let dz = -4; dz <= 4; dz += 2) if (m.circleHits(x + dx, z + dz, 0.7)) return false; return true; };
    for (let r = 0; r <= 90; r += 6) for (let a = 0; a < 6.283; a += r ? 6 / r : 7) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (free(x, z)) return { x, z, r }; }
    return null;
  });
  if (!lane) throw new Error('sin carril despejado en la región de pruebas');
  await api.teleport(lane.x, lane.z);
  await ev(() => { const p = window.__G.player; window.__lane = { x: p.x, z: p.z }; });

  // ─── 1. combate: cada gadget contra la misma manada ───────────────────────────────────────────────
  const rows = [];
  const ids = await ev(() => Object.keys(window.__gadgets.cfg.types));
  const runs = [['ninguno', null, 'auto'], ...ids.filter((i) => !only || only.includes(i)).flatMap((i) => (['proximity', 'cluster', 'incendiary', 'cryo', 'emp', 'gravity'].includes(i) ? [[i, i, 'auto'], [i + '*', i, 'remote']] : [[i, i, 'auto']]))];
  for (const [label, id, mode] of runs) {
    const acc = { dmg: 0, kills: 0, seen: 0, trig: 0, hurt: 0, hp0: 0, firstHit: 0, n: 0, G: 0, blocked: 0, provoked: 0 };
    for (let tr = 0; tr < TRIALS; tr++) {
      const r = await ev(({ id, mode, tr, SECS, MECH }) => {
        const G = window.__G, gd = window.__gadgets, p = G.player, S = G.S;
        // escenario limpio: nada en el suelo, jugador quieto, arma muda (así solo cuenta el gadget)
        for (const e of G.enemies) e.remove?.(); G.enemies.length = 0; G.projs.length = 0; gd.clear();
        p.hp = p.maxHp; p.x = window.__lane.x; p.z = window.__lane.z; p.vx = 0; p.vz = 0; p.face = Math.PI / 2;
        p.reloadT[S.activeW] = 1e9; p.ammo[S.activeW] = 0; p.powers && p.powers.clear && p.powers.clear(); p.droneT = 1e9;
        gd.state.stats.triggered = 0; gd.state.stats.blocked = 0; gd.state.stats.provoked = 0; gd.seed(0x1234 + tr * 7919);
        S.gadgets.inv.proximity = 12; // solo para que el HUD no proteste
        const px = p.x, pz = p.z;
        // manada de 16: enjambre, infectados, mantis (evitan), corredores (evitan) y un mecánico (desarma)
        const kinds = MECH ? [['escudero', 5], ['mech', 1]] : [['rastrero', 6], ['infectado', 3], ['escupidor', 2], ['mantis', 2], ['corredor', 2], ['escudero', 1]];
        const pack = []; let k = 0; const pk = kinds.reduce((a, [, n]) => a + n, 0);
        for (const [kind, n] of kinds) for (let i = 0; i < n; i++, k++) {
          const a = (k / pk) * 6.283, rr = 1 + (k % 4) * 0.9;
          const e = window.__spawn(kind, 4, px + 17 + Math.cos(a) * rr, pz + Math.sin(a) * rr * 1.3, { alerted: true });
          if (e) pack.push(e);
        }
        const hp0 = pack.map((e) => e.hp);
        let g = null;
        if (id) {
          const d = gd.cfg.types[id];
          // minas y trampas: en el carril de la manada; dispositivos: delante del jugador
          if (d.kind === 'mine' || d.kind === 'trap' || d.kind === 'field') g = gd.deploy(id, { force: true, x: px + 8, z: pz, yaw: 1.57 });
          else g = gd.deploy(id, { force: true });
        }
        const maxHp = pack.map((e) => e.maxHp || e.hp);
        let firstHit = -1, t = 0, hurt0 = p.hp;
        for (let s = 0; s < SECS * 10; s++) {
          window.__step(3, 1 / 30); t += 0.1;
          if (mode === 'remote' && g && g.st === 'ready') {
            let near = 0;
            for (const e of pack) if (!e.dead && Math.hypot(e.x - g.x, e.z - g.z) < gd.cfg.types[id].r * 0.9) near++;
            if (near >= 3) gd.detonate();
          }
          if (firstHit < 0 && pack.some((e, i) => e.hp < hp0[i])) firstHit = t;
        }
        let dmg = 0, kills = 0, tot = 0, seen = 0;
        pack.forEach((e, i) => { const h = Math.max(0, e.dead ? 0 : e.hp); dmg += hp0[i] - h; tot += hp0[i]; if (e.dead) kills++; if (e._gSeen !== undefined && e._gOk) seen++; });
        const out = { dmg, tot, kills, seen, trig: gd.state.stats.triggered, blocked: gd.state.stats.blocked, provoked: gd.state.stats.provoked, hurt: hurt0 - p.hp, firstHit, G: gd.G(), n: pack.length };
        for (const e of G.enemies) e.remove?.(); G.enemies.length = 0; G.projs.length = 0; gd.clear();
        return out;
      }, { id, mode, tr, SECS, MECH: process.env.PACK === 'mech' });
      acc.dmg += r.dmg; acc.hp0 += r.tot; acc.kills += r.kills; acc.seen += r.seen; acc.trig += r.trig; acc.firstHit += Math.max(0, r.firstHit); acc.G = r.G; acc.n = r.n; acc.hurt += r.hurt; acc.blocked = (acc.blocked || 0) + r.blocked; acc.provoked = (acc.provoked || 0) + r.provoked;
    }
    rows.push({ label, dmg: acc.dmg / TRIALS, pct: acc.dmg / acc.hp0, kills: acc.kills / TRIALS, seen: acc.seen / TRIALS, trig: acc.trig / TRIALS, G: acc.G, n: acc.n, blocked: acc.blocked / TRIALS, provoked: acc.provoked / TRIALS });
  }
  const f1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  console.log(`\n=== 1. Cada gadget contra una manada (nivel 4; ${SECS} s; media de ${TRIALS} pruebas; * = detonación remota con ≥3 cerca) ===`);
  console.log('gadget        daño medio  % vida manada  bajas  esquivan  activaciones  proyectiles frenados / enemigos provocados');
  for (const r of rows) console.log(`${r.label.padEnd(13)} ${f1(r.dmg).padStart(9)}  ${(f1(r.pct * 100) + ' %').padStart(13)}  ${f1(r.kills).padStart(5)}  ${f1(r.seen).padStart(8)}  ${f1(r.trig).padStart(12)}  ${r.blocked || r.provoked ? f1(r.blocked) + ' / ' + f1(r.provoked) : ''}`);
  console.log(`(daño de referencia G = ${f1(rows[0].G)} = granada de fragmentación del jugador; manada ${process.env.PACK === 'mech' ? 'mecánica de 6' : 'mixta de 16'})`);

  // ─── 1b. detección: quién rodea o desarma una mina (un enemigo suelto que va hacia el jugador por encima de una mina) ─────────
  if ((!only || process.env.DETECT) && !process.env.SKIP_DETECT) {
    const kinds = ['rastrero', 'mantis', 'corredor', 'cazador', 'rabioso', 'escudero', 'mech', 'dron'];
    console.log('\n=== 1b. Detección de minas (20 minas de proximidad por tipo, un enemigo a la vez; 14 s) ===');
    console.log('enemigo       estalla  rodeada (sigue armada)  desarmada  mecánica');
    for (const kind of kinds) {
      const r = await ev(({ kind }) => {
        const G = window.__G, gd = window.__gadgets, p = G.player, S = G.S, out = { boom: 0, avoided: 0, disarmed: 0, N: 20 };
        for (let t = 0; t < out.N; t++) {
          for (const e of G.enemies) e.remove?.(); G.enemies.length = 0; G.projs.length = 0; gd.clear();
          p.reloadT[S.activeW] = 1e9; p.powers.clear(); p.droneT = 1e9; p.hp = p.maxHp; p.x = window.__lane.x; p.z = window.__lane.z; p.vx = 0; p.vz = 0; gd.seed(77 + t * 131);
          const e = window.__spawn(kind, 4, p.x + 14, p.z + (t % 5 - 2) * 0.4, { alerted: true }); if (!e) return null;
          if (e.fly) e.y = e.y;
          const g = gd.deploy('proximity', { force: true, x: p.x + 7, z: p.z, yaw: 0 });
          const t0 = gd.state.stats.triggered; let removedBy = '';
          for (let i = 0; i < 140; i++) { window.__step(3, 1 / 30); if (g.st === 'dead') break; }
          if (gd.state.stats.triggered > t0) out.boom++; else if (g.st === 'dead') out.disarmed++; else out.avoided++;
        }
        return out;
      }, { kind });
      if (!r) { console.log(kind.padEnd(13), '(no se pudo generar)'); continue; }
      console.log(`${kind.padEnd(13)} ${String(r.boom).padStart(5)}/${r.N}  ${String(r.avoided).padStart(14)}/${r.N}          ${String(r.disarmed).padStart(5)}/${r.N}`);
    }
  }

  // ─── 2. coste en minutos de farmeo ────────────────────────────────────────────────────────────────
  const costs = await ev(() => {
    const gd = window.__gadgets, out = [];
    for (const id of Object.keys(gd.cfg.types)) { const d = gd.cfg.types[id]; out.push({ id, n: d.n, mat: { ...d.cost }, trof: d.trof, tier: d.tier }); }
    return out;
  });
  // Ritmos de hoy (20-pickups: por muerte, mezcla de familias): chatarra 0,10 · biomasa 0,10 · batería 0,03 · trofeos ≈ 0,30 (objetivo §2.2),
  // créditos 0,4×(2-5)×mc(nivel) ≈ 1,4·mc; con 17 muertes/min. Con el objetivo de ECONOMÍA (§2.2: ≈ 15 materiales y 20 créditos por 100 muertes) los materiales bajan ≈ 45 %.
  const KPM = 17, rate = { scrap: 0.10 * KPM, bio: 0.10 * KPM, battery: 0.03 * KPM, credits: 1.4 * KPM, trof: 0.30 * KPM };
  console.log('\n=== 2. Coste por unidad en minutos de farmeo (el recurso más escaso manda; 17 muertes/min) ===');
  console.log('gadget                  chatarra bio batería créditos(×mc) trofeos | min hoy | min con ECONOMÍA(×1,8 mats)');
  for (const c of costs) {
    const t = (k, v) => (v || 0) / rate[k];
    const mats = Math.max(t('scrap', c.mat.scrap), t('bio', c.mat.bio), t('battery', c.mat.battery));
    const now = Math.max(mats, t('credits', c.mat.credits), t('trof', c.trof));
    const eco = Math.max(mats * 1.8, t('credits', c.mat.credits), t('trof', c.trof) * 1);
    console.log(`${c.n.padEnd(23)} ${String(c.mat.scrap || 0).padStart(8)} ${String(c.mat.bio || 0).padStart(3)} ${String(c.mat.battery || 0).padStart(7)} ${String(c.mat.credits || 0).padStart(12)} ${String(c.trof).padStart(7)} | ${f1(now).padStart(7)} | ${f1(eco).padStart(8)}`);
  }

  // ─── 3. rendimiento: 100 gadgets a la vez, sin fugas ──────────────────────────────────────────────
  if (!process.env.SKIP_PERF) {
    await ev(() => { const G = window.__G, gd = window.__gadgets; for (const e of G.enemies) e.remove?.(); G.enemies.length = 0; gd.clear(); G.player.reloadT[G.S.activeW] = 1e9; });
    const stepMs = (n) => ev((n) => { const t0 = performance.now(); window.__step(n, 1 / 30); return (performance.now() - t0) / n; }, n);
    const sceneObjs = () => ev(() => { let n = 0; window.__G.R.scene.traverse((o) => { if (/^gadget-/.test(o.name)) n++; }); return n; });
    const mem = () => ev(() => { const m = window.__G.R.r.info.memory; return m.geometries + '/' + m.textures; });
    await stepMs(30);
    const base = await stepMs(120), baseCalls = await perf(), baseObjs = await sceneObjs();
    await ev(() => {
      const gd = window.__gadgets, G = window.__G, p = G.player, ids = Object.keys(gd.cfg.types);
      for (let i = 0; i < 100; i++) {
        const a = i * 2.399, r = 2 + (i % 10) * 1.2;
        const g = gd.deploy(ids[i % ids.length], { force: true, x: p.x + Math.cos(a) * r * 1.5, z: p.z + Math.sin(a) * r * 1.5, yaw: a });
        // que ninguno caduque ni se active durante la medición
        if (g) g.life = 1e9;
      }
    });
    await wait(10);
    const n100 = await ev(() => window.__gadgets.state.list.length);
    const busy = await stepMs(120), busyCalls = await perf(), busyObjs = await sceneObjs();
    // ciclo despliegue-retirada repetido: el recuento de objetos de la escena debe volver al de antes
    const cyc = await ev(() => {
      const G = window.__G, gd = window.__gadgets, p = G.player, ids = Object.keys(gd.cfg.types);
      const cnt = () => { let n = 0; G.R.scene.traverse((o) => { if (/^gadget-/.test(o.name)) n++; }); const m = G.R.r.info.memory; return n + ' mallas · ' + m.geometries + ' geometrías/' + m.textures + ' texturas'; };
      const o0 = cnt();
      for (let c = 0; c < 6; c++) {
        gd.clear();
        for (let i = 0; i < 60; i++) { const g = gd.deploy(ids[i % ids.length], { force: true, x: p.x + 3 + (i % 8), z: p.z - 5 + Math.floor(i / 8) * 1.4 }); if (g) g.arm = 0; }
        window.__step(10, 1 / 30);
        gd.detonate(); window.__step(60, 1 / 30);
      }
      gd.clear(); window.__step(200, 1 / 30);
      const o1 = cnt();
      const st = gd.state;
      return { o0, o1, list: st.list.length, zones: st.zones.length, blasts: st.blasts.length, bars: st.bars.length };
    });
    console.log('\n=== 3. Rendimiento (sin enemigos; GL por software: lo que importa son las llamadas de dibujo y los milisegundos de simulación) ===');
    console.log(`desplegados: 0 → ${n100}`);
    console.log(`simulación por fotograma: ${f1(base)} ms → ${f1(busy)} ms  (+${f1(busy - base)} ms)`);
    console.log(`llamadas de dibujo: ${baseCalls.calls} → ${busyCalls.calls}  (+${busyCalls.calls - baseCalls.calls})   triángulos: ${baseCalls.triangles} → ${busyCalls.triangles}`);
    console.log(`mallas de gadget en la escena: ${baseObjs} → ${busyObjs} (instanciadas: una por forma, no una por gadget)`);
    console.log(`fugas tras 6 ciclos de 60 desplegar+detonar+limpiar: ${cyc.o0} → ${cyc.o1}; restos list=${cyc.list} zonas=${cyc.zones} diferidas=${cyc.blasts} barreras=${cyc.bars}`);
  }
}
