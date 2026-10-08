// LORE · las 13 combinaciones región/tema (9 documentos) de operación con documento de lore (D5): entra en cada una de verdad (loadOp), comprueba que el nodo
// existe, está dentro del mapa, sobre suelo sin bloqueo y alcanzable desde la entrada, que no hay más de uno, que recogerlo lo da por hallado
// y que al volver al mundo no queda nada colgado. (La revisión integrada las recorre todas: antes solo se probaban 2 de las 13.)
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/lore-ops.mjs --size 480x270 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, logs } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame(); await api.god(true);
  const combos = await ev(() => window.__lore.api.entries.filter((e) => e.w === 'op').flatMap((e) => e.themes.map((t) => ({ id: e.id, reg: e.reg, theme: t }))));
  console.log('combinaciones', combos.length);
  for (const c of combos) {
    const r = await ev((c) => {
      const L = window.__lore, G = window.__G, out = { ...c };
      try {
        delete G.S.lore.f[c.id]; delete G.S.lore.r[c.id]; // un documento con dos temas se vuelve a «sin hallar» para probar cada tema
        const ids = L.enterOp(c.reg, c.theme);
        out.mode = G.mode; out.ids = ids;
        const m = G.map, n = m.ents.filter((e) => e.k === 'lore');
        out.n = n.length;
        const e = n[0];
        if (e) {
          out.inside = e.x > 0 && e.z > 0 && e.x < m.w && e.z < m.h;
          out.free = !m.circleHits(e.x, e.z, 0.5);
          // alcanzable: BFS sobre el mapa desde la entrada (misma regla de suelo que la colocación)
          const w = m.w, h = m.h, seen = new Uint8Array(w * h), q = [Math.floor(m.spawnBase[1]) * w + Math.floor(m.spawnBase[0])];
          seen[q[0]] = 1;
          const goal = Math.floor(e.z) * w + Math.floor(e.x);
          let ok = false;
          for (let i = 0; i < q.length && !ok; i++) {
            const k = q[i];
            if (k === goal) ok = true;
            for (const j of [k - 1, k + 1, k - w, k + w]) {
              if (j < 0 || j >= w * h || seen[j] || m.blk[j] === 1) continue;
              seen[j] = 1; q.push(j);
            }
          }
          out.reach = ok;
          // lo recoge de verdad
          window.__lore.grant(c.id, { quiet: true });
          out.after = m.ents.filter((q2) => q2.k === 'lore').length;
          out.found = window.__G.loreApi.has(c.id);
        }
        L.leave();
        out.back = G.mode;
      } catch (err) { out.err = String(err && err.message || err); }
      return out;
    }, c);
    check(`${c.reg}/${c.theme}: un nodo (${c.id}) dentro del mapa, libre, alcanzable, se recoge y se vuelve al mundo`, !r.err && r.mode === 'op' && r.ids && r.ids.includes(c.id) && r.n === 1 && r.inside && r.free && r.reach && r.found && r.after === 0 && r.back === 'world', JSON.stringify(r));
    // el siguiente combo con el mismo documento ya hallado no repite nodo
    await ev(() => { window.__G.paused = false; });
  }
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página ni de consola nuevos', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}
