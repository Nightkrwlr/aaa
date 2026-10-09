// D8c · reliquias de jefe (31g-bosses.js): tabla válida, objetos bien formados, probabilidad y garantía, sin repetidos, recogida y conversión del plano, guardado
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/jefes-botin.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs, shot } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });

  // 1) la tabla
  const tab = await ev(() => {
    const L = window.__bossLoot, I = window.__items, G = window.__G;
    const rels = Object.values(L.byId), bad = [], bases = new Set(), names = new Set(), powers = I.POWERS;
    for (const r of rels) {
      const tbl = r.type === 'weapon' ? I.WEAPONS : I.GEAR;
      if (!tbl[r.base]) bad.push(r.id + ': base ' + r.base);
      if (bases.has(r.base)) bad.push(r.id + ': base repetida ' + r.base); bases.add(r.base);
      if (names.has(r.n)) bad.push(r.id + ': nombre repetido'); names.add(r.n);
      if (!powers[r.pow] || powers[r.pow].t !== r.type) bad.push(r.id + ': poder ' + r.pow + ' (' + (powers[r.pow] || {}).t + ') no es de ' + r.type);
      if (r.pow2 && (!powers[r.pow2] || powers[r.pow2].t !== 'weapon' || r.pow2 === r.pow)) bad.push(r.id + ': pow2 ' + r.pow2);
      if (r.r === 5 && r.type === 'weapon' && !r.pow2) bad.push(r.id + ': mítica sin pow2');
      if (![4, 5].includes(r.r)) bad.push(r.id + ': rango ' + r.r);
      if (!r.n || !r.lore || r.lore.length < 20) bad.push(r.id + ': sin nombre o lore');
      if (r.type === 'weapon' && I.WEAPONS[r.base] && I.WEAPONS[r.base].minRarity > r.r) bad.push(r.id + ': rango menor que el mínimo de la base');
    }
    const perBoss = Object.fromEntries(Object.entries(L.cfg.relics).map(([k, v]) => [k, v.length]));
    const bosses = Object.keys(L.cfg.relics).every((k) => !!G.cfg.bossSig.boss[k]);
    return { n: rels.length, bad, perBoss, bosses, myth: rels.filter((r) => r.r === 5).map((r) => r.n) };
  });
  console.log(JSON.stringify({ n: tab.n, perBoss: tab.perBoss, myth: tab.myth }));
  check('hay 30 reliquias en 14 jefes (9 de región, 5 secretos)', tab.n === 30 && Object.keys(tab.perBoss).length === 14, JSON.stringify(tab.perBoss));
  check('todas válidas: base existente y única, poder del tipo correcto, rango, nombre y lore', tab.bad.length === 0, tab.bad.join(' | '));
  check('cada jefe de la tabla es uno de los 14 con fases', tab.bosses);
  check('las Míticas (Eclipse, Fin de la Luz) llevan dos poderes', tab.myth.length === 2, tab.myth.join(','));

  // 2) los objetos se generan bien y se pueden equipar y calcular
  const objs = await ev(() => {
    const L = window.__bossLoot, I = window.__items, out = [];
    for (const r of Object.values(L.byId)) {
      const it = L.item(r, 30);
      let v = null;
      try { v = it.type === 'weapon' ? I.weaponStats(it) : I.gearImplicits(it); } catch (e) { v = 'ERR ' + e.message; }
      const nums = it.type === 'weapon' ? Object.values(v).filter((q) => typeof q === 'number') : v.map((q) => q.v);
      out.push({ id: r.id, name: it.name, uname: it.uname, relic: it.relic, pow: it.pow, pow2: it.pow2 || null, r: it.r, ilvl: it.ilvl, aff: it.aff.length, finite: nums.every(Number.isFinite), err: typeof v === 'string' ? v : null, eq: (window.__G.cfg && 1) });
    }
    return out;
  });
  check('todas se generan con nombre «único» + base, poder fijado, rango y nivel', objs.every((o) => o.name.startsWith('«' + o.uname + '»') && o.relic === o.id && o.pow && o.ilvl === 30 && o.aff >= 1), JSON.stringify(objs.filter((o) => !(o.name.startsWith('«' + o.uname + '»') && o.relic === o.id && o.pow)).map((o) => o.id)));
  check('sus estadísticas son números finitos (armas: daño, cadencia…; equipo: implícitos)', objs.every((o) => o.finite && !o.err), JSON.stringify(objs.filter((o) => !o.finite || o.err).map((o) => [o.id, o.err])));
  console.log('muestra', JSON.stringify(objs.slice(0, 3)));

  // 3) probabilidad y garantía (simulación con el generador de números del juego, sin mundo)
  const sim = await ev(() => {
    const L = window.__bossLoot, G = window.__G;
    window.__seedRng(12345);
    const res = {};
    for (const [id, tier] of [['reina', 'boss'], ['kharsa', 'boss'], ['carnicero', 'secret'], ['mente', 'final'], ['avatar', 'final']]) {
      const kills = []; const trials = 400;
      for (let t = 0; t < trials; t++) {
        G.S.relics = { v: 1, own: {}, pity: {} };
        const b = { id, def: { secret: ['carnicero', 'avatar'].includes(id) }, lvl: 30 };
        let n = 0, got = [];
        while (got.length < L.cfg.relics[id].length && n < 500) { n++; const r = L.roll(b); if (r) { got.push(r.id); G.S.relics.own[r.id] = 1; } }
        kills.push(n);
      }
      const mean = kills.reduce((a, c) => a + c, 0) / trials;
      // primera reliquia: muertes hasta la primera
      const first = []; let maxGap = 0;
      for (let t = 0; t < trials; t++) { G.S.relics = { v: 1, own: {}, pity: {} }; const b = { id, def: { secret: ['carnicero', 'avatar'].includes(id) }, lvl: 30 }; let n = 0; while (!L.roll(b) && n < 500) n++; first.push(n + 1); maxGap = Math.max(maxGap, n + 1); }
      res[id] = { tier, setMean: +mean.toFixed(1), firstMean: +(first.reduce((a, c) => a + c, 0) / trials).toFixed(1), firstMax: maxGap, pity: L.cfg.pity[tier] };
    }
    // sin reliquias pendientes no hay tirada
    G.S.relics = { v: 1, own: Object.fromEntries(L.cfg.relics.reina.map((r) => [r.id, 1])), pity: {} };
    res.sinPendientes = L.roll({ id: 'reina', def: {}, lvl: 30 });
    G.S.relics = { v: 1, own: {}, pity: {} };
    // guarida: el triple de probabilidad y la garantía llega antes
    const bl = { id: 'reina', def: {}, lvl: 30, lair: true }; let n = 0; while (!L.roll(bl) && n < 500) n++; res.lairMax = n + 1; res.lairPity = Math.ceil(L.cfg.pity.boss / L.cfg.lair);
    return res;
  });
  console.log('simulación', JSON.stringify(sim));
  check('la garantía anti-mala-suerte se cumple (nunca más muertes seguidas que `pity`)', ['reina', 'kharsa', 'carnicero', 'mente', 'avatar'].every((k) => sim[k].firstMax <= sim[k].pity), JSON.stringify(Object.fromEntries(Object.entries(sim).filter(([k, v]) => v && typeof v === 'object' && v.firstMax).map(([k, v]) => [k, v.firstMax + '/' + v.pity]))));
  check('la primera reliquia de un jefe de región llega de media en 15-35 muertes (muy rara, de acuerdo con ECONOMÍA)', sim.reina.firstMean > 15 && sim.reina.firstMean < 35, `reina ${sim.reina.firstMean} · kharsa ${sim.kharsa.firstMean}`);
  check('secretos y la Mente la sueltan antes que los jefes normales', sim.carnicero.firstMean < sim.reina.firstMean && sim.mente.firstMean < sim.carnicero.firstMean, `normal ${sim.reina.firstMean} > secreto ${sim.carnicero.firstMean} > final ${sim.mente.firstMean}`);
  check('con todas las reliquias de un jefe conseguidas no vuelve a haber tirada', sim.sinPendientes === null);
  check('en la guarida la garantía llega antes (÷3)', sim.lairMax <= sim.lairPity, `${sim.lairMax} ≤ ${sim.lairPity}`);

  // 4) caída real: se fuerza una reliquia, cae un plano con pilar de luz y hito; se recoge y queda anotada
  const drop = await ev(() => {
    const L = window.__bossLoot, G = window.__G, p = G.player; G.S.relics = { v: 1, own: {}, pity: {} };
    G.S.hitos = []; const n0 = G.pickups.length;
    const b = window.__spawn('reina', 7, p.x + 3, p.z, { boss: true, alerted: true });
    const it = L.drop(b, 'reina_a');
    const pk = G.pickups.slice(n0).find((q) => q.k === 'item' && q.item && q.item.relic === 'reina_a');
    return { ok: !!it, pickup: !!pk, mile: pk && pk.mile, hitos: G.S.hitos.length, last: G.S.hitos[G.S.hitos.length - 1] && G.S.hitos[G.S.hitos.length - 1].n, ownBefore: !!G.S.relics.own.reina_a };
  });
  console.log('caída', JSON.stringify(drop));
  check('la reliquia cae como plano en el suelo con hito (pilar de luz y registro)', drop.ok && drop.pickup && drop.mile >= 4 && drop.hitos >= 1, JSON.stringify(drop));
  check('hasta recogerla no cuenta como conseguida', !drop.ownBefore);
  await wait(4);
  const pick = await ev(() => {
    const G = window.__G, p = G.player;
    const pk = G.pickups.find((q) => q.k === 'item' && q.item && q.item.relic === 'reina_a');
    p.x = pk.x; p.z = pk.z; window.__step(20, 1 / 30);
    const piece = G.S.inv.find((q) => q.relic === 'reina_a') || null;
    return { gone: !G.pickups.includes(pk), own: !!G.S.relics.own.reina_a, inInv: !!piece, name: piece && piece.name, pow: piece && piece.pow, r: piece && piece.r };
  });
  console.log('recogida', JSON.stringify(pick));
  check('al recogerla queda anotada y entra en el inventario con su nombre y poder', pick.gone && pick.own && pick.inInv && /Aguijón de la Matriarca/.test(pick.name) && pick.pow === 'split' && pick.r === 4, JSON.stringify(pick));

  // 5) conversión: si ya tienes esa base, el plano pasa a ser la reliquia
  const conv = await ev(() => {
    const L = window.__bossLoot, G = window.__G, I = window.__items;
    G.S.relics = { v: 1, own: {}, pity: {} };
    const base = I.genWeapon(5, 1, 'rocket'); window.__dbg && 0;
    // plano común de esa base (lo recoge como cualquier plano)
    G.S.inv = G.S.inv.filter((q) => q.base !== 'rocket');
    const common = L.item({ ...L.byId.demoledor_a, id: 'tmp', pow: 'split', n: 'x', lore: 'x', r: 1 }, 5); common.relic = null; common.uname = null; common.pow = null; common.r = 1; common.name = 'Lanzacohetes';
    G.S.inv.push(common);
    const nInv = G.S.inv.length;
    const rel = L.item(L.byId.demoledor_a, 12);
    const kind = (window.__lastSs = (function () { return null; })());
    window.__G.pickups.push({ k: 'item', x: G.player.x, z: G.player.z, y: 0.35, vy: 0, vx: 0, vz: 0, t: 1, life: 100, item: rel, rest: 0 });
    window.__step(10, 1 / 30);
    const piece = G.S.inv.find((q) => q.base === 'rocket');
    return { nInv0: nInv, nInv: G.S.inv.length, name: piece.name, uname: piece.uname, relic: piece.relic, pow: piece.pow, r: piece.r, own: !!G.S.relics.own.demoledor_a };
  });
  console.log('conversión', JSON.stringify(conv));
  check('con la base ya en tu inventario el plano pasa a ser la reliquia (nombre, poder y rango) sin duplicarse', conv.nInv === conv.nInv0 && conv.uname === 'Martillo del Demoledor' && conv.relic === 'demoledor_a' && conv.pow === 'bigBullets' && conv.r === 4 && conv.own, JSON.stringify(conv));

  // 6) registro de reliquias en la pestaña de hitos (panel real) y guardado
  await ev(() => { const G = window.__G; G.S.relics = { v: 1, own: { reina_a: 12, mente_c: 40 }, pity: {} }; window.__dbg.openHitos && window.__dbg.openHitos(); });
  await wait(8);
  const ui = await ev(() => { const t = (document.querySelector('#panel') || {}).innerText || ''; return { open: window.__G.uiOpen, txt: t.slice(0, 900), has: /2 \/ 30 reliquias/.test(t), names: /Aguijón de la Matriarca/.test(t) && /Eclipse/.test(t), hidden: /\?\?\?/.test(t) }; });
  console.log('hitos', JSON.stringify({ open: ui.open, has: ui.has, names: ui.names, hidden: ui.hidden }));
  await shot('reliquias-hitos');
  check('el registro de hitos muestra «2 / 30 reliquias de jefe», las conseguidas por su nombre y el resto ocultas', ui.has && ui.names && ui.hidden, JSON.stringify({ open: ui.open, has: ui.has, names: ui.names, hidden: ui.hidden }));
  await ev(() => window.__dbg.UI.close());
  const sv = await ev(() => {
    const G = window.__G; G.S.relics = { v: 1, own: { reina_a: 5 }, pity: { reina: 7 } };
    const copy = JSON.parse(JSON.stringify(G.S)); delete copy.relics;
    G.migrations.forEach((f) => f(copy)); const a = JSON.stringify(copy.relics); G.migrations.forEach((f) => f(copy));
    return { creada: copy.relics && copy.relics.v === 1 && Object.keys(copy.relics.own).length === 0, idem: a === JSON.stringify(copy.relics), json: JSON.stringify(G.S.relics) };
  });
  check('un guardado sin reliquias se migra (S.relics v1, idempotente) y el estado es JSON puro', sv.creada && sv.idem, JSON.stringify(sv));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `FALLAN ${bad.length}/${results.length}` : `TODO OK ${results.length}/${results.length}`);
}
