// Las misiones PRINCIPALES, una vez entregadas, no vuelven a ofrecerse ni a activarse con el paso del tiempo (22-quests.js)
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/misiones-principales.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });

  // utilidades: entregar una misión (se acepta, se rellena el progreso y se entrega) y adelantar el reloj de pared
  await ev(() => {
    const G = window.__G, Q = window.__dbg.Quests;
    window.__q = {
      realNow: Date.now.bind(Date), skew: 0,
      finish(id) {
        const S = G.S; S.lvl = Math.max(S.lvl, 60);
        if (!S.quests.active[id]) Q.accept(id);
        const a = S.quests.active[id]; if (!a) return false;
        const def = a.def || window.__q.def(id);
        def.obj.forEach((o, i) => { a.prog[i] = o.n; });
        if (def.obj.some((o) => o.t === 'gather')) def.obj.forEach((o) => o.t === 'gather' && (S.mats[o.mat] = Math.max(S.mats[o.mat] || 0, o.n)));
        return Q.turnIn(id);
      },
      def(id) { return window.__De && null; },
      adv(ms) { window.__q.skew += ms; Date.now = () => window.__q.realNow() + window.__q.skew; },
      main() { return window.__q.ids; },
    };
  });
  // los ids de misión principal salen de la propia tabla del juego a través de las NPC (reyes ofrece m1, chispas m2, …)
  const ids = await ev(() => {
    const G = window.__G, Q = window.__dbg.Quests, S = G.S, out = [];
    // se recorre la cadena preguntando a cada PNJ qué principal ofrece
    S.lvl = 60;
    const givers = ['reyes', 'chispas', 'lucia', 'zahra', 'ignacio', 'nadia', 'argos', 'rocco', 'viktor', 'eco'];
    for (let round = 0; round < 40; round++) {
      let any = false;
      for (const g of givers) {
        const av = Q.available(g).filter((q) => q.def.main && !q.locked);
        for (const q of av) {
          // m5 pide hablar con una NPC: se completa a mano
          if (!S.quests.active[q.id]) Q.accept(q.id);
          const a = S.quests.active[q.id]; if (!a) continue;
          q.def.obj.forEach((o, i) => { a.prog[i] = o.n; });
          q.def.obj.forEach((o) => { if (o.t === 'gather') S.mats[o.mat] = Math.max(S.mats[o.mat] || 0, o.n); });
          if (Q.turnIn(q.id)) { out.push(q.id); any = true; }
        }
      }
      if (!any) break;
    }
    return out;
  });
  console.log('principales entregadas:', ids.join(' '));
  check('la cadena de misiones principales se puede completar entera (22 misiones)', ids.length === 22, `${ids.length}: ${ids.join(',')}`);

  const snap = async (tag) => ev(() => {
    const G = window.__G, Q = window.__dbg.Quests, S = G.S;
    const givers = ['reyes', 'chispas', 'lucia', 'zahra', 'ignacio', 'nadia', 'argos', 'rocco', 'viktor', 'eco', 'morales'];
    const offers = {}, repeat = {};
    for (const g of givers) {
      offers[g] = Q.available(g).filter((q) => q.def.main).map((q) => q.id);
      const r = Q.repeatOffer(g); repeat[g] = r && r.def ? r.def.n : (r && r.cooldown ? 'enfriando' : null);
    }
    const board = Q.board();
    return {
      active: Object.keys(S.quests.active), done: Object.keys(S.quests.done).length,
      mainOffers: Object.entries(offers).filter(([, v]) => v.length).map(([k, v]) => k + ':' + v.join('+')),
      repeatBy: Object.entries(repeat).filter(([, v]) => v).map(([k, v]) => k + '=' + v),
      boardMain: board.list.filter((q) => q.main).length, boardN: board.list.length,
    };
  });
  const t0 = await snap('t0');
  console.log('t0', JSON.stringify(t0));
  check('recién entregadas: ninguna principal activa ni ofrecida', t0.active.length === 0 && t0.mainOffers.length === 0 && t0.boardMain === 0, JSON.stringify(t0));

  for (const [label, ms] of [['+13 min', 13 * 60e3], ['+31 min', 31 * 60e3], ['+3 h', 3 * 3600e3], ['+2 días', 2 * 86400e3]]) {
    await ev((ms) => { window.__q.adv(ms); window.__step(300, 1 / 30); }, ms);
    const s = await snap(label);
    console.log(label, JSON.stringify(s));
    check(`${label}: ninguna misión principal vuelve a estar activa, ofrecida ni en el Tablón`, s.active.every((id) => !/^m\d+$/.test(id)) && s.mainOffers.length === 0 && s.boardMain === 0 && s.done >= 22, JSON.stringify(s));
  }

  // guardar y recargar el estado (JSON) no devuelve ninguna principal
  const rt = await ev(() => {
    const G = window.__G, S = G.S, copy = JSON.parse(JSON.stringify(S));
    G.migrations.forEach((f) => f(copy));
    const doneMain = Object.keys(copy.quests.done).filter((k) => /^m\d+$/.test(k)).length;
    return { doneMain, active: Object.keys(copy.quests.active) };
  });
  check('tras serializar y migrar el guardado siguen las 22 principales entregadas', rt.doneMain === 22 && rt.active.length === 0, JSON.stringify(rt));

  // el diálogo de cada PNJ (lo que ve el jugador) y el marcador «!» sobre su cabeza
  const dlg = await ev(() => {
    const Q = window.__dbg.Quests, out = {};
    for (const g of ['reyes', 'chispas', 'lucia', 'zahra', 'ignacio', 'nadia', 'argos', 'rocco', 'viktor', 'eco']) {
      const mark = Q.available(g).some((h) => !h.locked) || !!(Q.repeatOffer(g) && Q.repeatOffer(g).def);
      out[g] = mark;
    }
    return out;
  });
  console.log('«!» sobre las NPC tras 2 días:', JSON.stringify(dlg));

  const f = results.filter((r) => !r.ok);
  console.log(f.length ? 'FALLOS: ' + f.map((q) => q.name).join(' | ') : `TODO OK ${results.length}/${results.length}`);
  return results;
}
