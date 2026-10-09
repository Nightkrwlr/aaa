// D13 · raros del mundo (31k-rares.js y 31k2-rares-loot.js): reparto, montaje, ocho mecánicas exclusivas, botín, trofeos, objetos especiales con misión,
//        reaparición, guardado, HUD y minimapa
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/rares-core.mjs --size 960x540 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, shot } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => {
    window.__silence && window.__silence(true); window.__seedRng && window.__seedRng(1313);
    window.__toastLog = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.textContent && window.__toastLog.push(n.textContent)))).observe(document.querySelector('#toasts'), { childList: true });
    const G = window.__G, R = window.__rare;
    G.uiBlockDamage = false;
    // sin manadas del Spawner durante la prueba
    window.__dbg.Spawner.update = () => {};
    // espía de daño al jugador
    window.__hits = [];
    const p = G.player, _h = p.hurt;
    p.hurt = function (d, o) { const r = _h.apply(this, arguments); window.__hits.push([+d.toFixed(2), o && o.src ? (o.src.rq ? 'rq' : o.src.rqPylon ? 'pylon' : o.src.id) : o && o.dot ? 'dot' : '?', +(r || 0).toFixed(2)]); return r; };
    window.__t = {
      // un claro del mundo con sitio de sobra (el mismo criterio con el que se colocan los raros)
      arena(reg = 0, dx = 0, dz = 0) {
        const rng = { int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) };
        // un claro con una línea recta libre de 20 m hacia +x (las pruebas colocan al raro a ese lado y no deben depender de un árbol en medio)
        const clear = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5); for (let i = 0; i <= n; i++) if (G.map.circleHits(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, 0.7)) return false; return true; };
        let s = null; for (let i = 0; i < 60 && !s; i++) { const c = R.spot(reg, rng); if (c && clear(c.x - 2, c.z, c.x + 20, c.z)) s = c; }
        if (!s) { const bs = G.map.pois.base; s = { x: bs.x + 45, z: bs.z + 45 }; }
        G.player.x = s.x + dx; G.player.z = s.z + dz; G.world.check(true); window.__step(20, 1 / 30);
        return s;
      },
      calm() { // sin enemigos ajenos y jugador entero
        const p = G.player; p.inv = 0; p.maxHp = 5e5; p.hp = 5e5; p.dead = false; p.vx = p.vz = 0;
        for (const e of G.enemies.slice()) if (!e.rq && !e.rqPylon && !e.rqDecoy) { e.dead = true; e.deadT = 0; }
        G.projs.length = 0; G.pickups.length = 0; window.__hits.length = 0;
      },
      step(n) { window.__step(n, 1 / 30); },
      // avanza con la IA base sin atacar (aísla la mecánica del raro del cuerpo a cuerpo normal)
      run(e, n) { for (let i = 0; i < n; i++) { e.atkCd = 1e9; window.__step(1, 1 / 30); } },
      // quita todo enemigo y las casillas temporales que crean las pruebas (las 18 del reparto se conservan)
      clear() {
        for (const e of G.enemies.slice()) { e.dead = true; e.deadT = 0; } window.__rare.RQ.live.clear();
        const S = window.__rare.state(); for (const id of Object.keys(S.slots)) if (!window.__t.keep.has(id)) delete S.slots[id];
        window.__step(2, 1 / 30);
      },
    };
  });

  // ── 1) reparto ──
  const A = await ev(() => {
    const G = window.__G, R = window.__rare, S = R.state();
    const out = { init: S.init, n: R.slots().length, regs: {}, bad: [], kinds: {}, ready: 0, wait: 0 };
    const base = G.map.pois.base;
    for (const s of R.slots()) {
      out.regs[s.reg] = (out.regs[s.reg] || 0) + 1; out.kinds[s.arch] = (out.kinds[s.arch] || 0) + 1; s.st === 'ready' ? out.ready++ : out.wait++;
      const Rg = window.__De[s.reg], inside = s.x >= Rg.gx * 192 && s.x < (Rg.gx + 1) * 192 && s.z >= Rg.gz * 192 && s.z < (Rg.gz + 1) * 192;
      if (!inside) out.bad.push(s.id + ' fuera de su región');
      const t = G.map.t(Math.floor(s.x), Math.floor(s.z)); if (t !== 0 && t !== 1) out.bad.push(s.id + ' tile ' + t);
      if (G.map.blk[G.map.idx(Math.floor(s.x), Math.floor(s.z))]) out.bad.push(s.id + ' bloqueado');
      if (Math.hypot(s.x - base.x, s.z - base.z) < R.cfg.minFromBase) out.bad.push(s.id + ' junto al Bastión');
      if (!R.RQA[s.arch].bases[s.reg] || R.RQA[s.arch].bases[s.reg] !== s.base && !s.uniq) out.bad.push(s.id + ' criatura ' + s.base + ' no es la de ' + s.arch + ' en ' + s.reg);
    }
    let minD = 1e9; const L = R.slots();
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (L[i].reg === L[j].reg) minD = Math.min(minD, Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z));
    out.minD = +minD.toFixed(1);
    const f = L.find((s) => s.reg === 0 && s.st === 'ready'); out.near0 = f && +Math.hypot(f.x - base.x, f.z - base.z).toFixed(1);
    out.json = (() => { try { JSON.parse(JSON.stringify(S)); return true; } catch (e) { return false; } })();
    // determinismo: misma semilla, mismo reparto
    const before = JSON.stringify(L.map((s) => [s.reg, s.x, s.z, s.arch, s.base, s.st])); const saved = S.slots; S.slots = {}; S.n = 0; S.init = false; R.init();
    out.same = before === JSON.stringify(R.slots().map((s) => [s.reg, s.x, s.z, s.arch, s.base, s.st]));
    return out;
  });
  console.log('reparto', JSON.stringify({ n: A.n, regs: A.regs, kinds: A.kinds, ready: A.ready, wait: A.wait, minD: A.minD, near0: A.near0 }));
  check('al empezar hay 2 casillas de raro por región (18) sin errores de colocación; el estado es JSON puro', A.init && A.n === 18 && Object.values(A.regs).every((n) => n === 2) && A.bad.length === 0 && A.json, JSON.stringify({ n: A.n, bad: A.bad.slice(0, 4) }));
  check('separación ≥ 60 casillas dentro de la región, la primera de la región 0 a 62-104 del Bastión y ≥ 10 ocupadas al empezar', A.minD >= 59.9 && A.near0 >= 62 && A.near0 <= 104 && A.ready >= 10, `minD ${A.minD} · primera ${A.near0} · ocupadas ${A.ready}/${A.n}`);
  check('el reparto es determinista con la semilla de la partida', A.same, JSON.stringify({ same: A.same }));

  await ev(() => { window.__t.keep = new Set(Object.keys(window.__rare.state().slots)); });

  // ── 2) tiradas: cada región da criaturas válidas y las únicas nacen una sola vez ──
  const B = await ev(() => {
    const R = window.__rare, S = R.state(), seeds = [];
    const rng = (() => { let a = 12345; const f = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); f.int = (x, y) => x + Math.floor(f() * (y - x + 1)); f.pick = (arr) => arr[Math.floor(f() * arr.length)]; return f; })();
    const out = { bad: [], uniq: {}, archs: new Set(), regsNoUniq: [] };
    const slots0 = S.slots; S.slots = {};   // sin casillas: las únicas ya asignadas a una no se vuelven a ofrecer
    for (let reg = 0; reg < 9; reg++) {
      for (let i = 0; i < 200; i++) {
        const d = R.roll(reg, rng);
        if (!window.__eco.gn[d.base]) out.bad.push('base inexistente ' + d.base);
        if (!R.RQA[d.arch] || (!d.uniq && R.RQA[d.arch].bases[reg] !== d.base)) out.bad.push(`reg ${reg} ${d.arch}/${d.base}`);
        out.archs.add(d.arch);
        if (d.uniq) out.uniq[d.uniq] = (out.uniq[d.uniq] || 0) + 1;
      }
    }
    // las que ya estén asignadas a una casilla no se repiten; una vez abatida no vuelve
    const u0 = R.RQU.find((u) => u.reg === 0);
    S.uniq[u0.id] = 1; let again = 0; for (let i = 0; i < 300; i++) if (R.roll(0, rng).uniq === u0.id) again++;
    delete S.uniq[u0.id];
    S.slots = slots0; out.again = again; out.nArch = out.archs.size; out.nUniq = Object.keys(out.uniq).length; out.perReg = R.RQU.map((u) => u.reg).sort().join('');
    return out;
  });
  check('las tiradas de cada región dan criaturas válidas, salen los 8 arquetipos y las 9 únicas (una por región)', B.bad.length === 0 && B.nArch === 8 && B.nUniq === 9 && B.perReg === '012345678', JSON.stringify({ bad: B.bad.slice(0, 3), nArch: B.nArch, nUniq: B.nUniq }));
  check('una única ya abatida no vuelve a salir', B.again === 0, JSON.stringify({ again: B.again }));

  // ── 3) montaje por cercanía, aspecto y nivel ──
  const C = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t;
    T.clear();
    const s = R.slots().find((q) => q.reg === 0 && q.st === 'ready' && !q.uniq) || R.slots().find((q) => q.st === 'ready' && !q.uniq);
    G.player.x = s.x + 130; G.player.z = s.z; R.sweep(); const far = !!R.live().find((e) => e.rq && e.rq.slot === s.id);
    G.player.x = s.x + 30; G.player.z = s.z; G.world.check(true); T.step(3); R.sweep(); T.step(3);
    const e = R.live().find((q) => q.rq && q.rq.slot === s.id);
    const out = { id: s.id, arch: s.arch, base: s.base, far, mounted: !!e };
    if (e) {
      const normal = window.__spawn(s.base, e.lvl, s.x + 60, s.z + 60, {}); out.hpRatio = +(e.maxHp / normal.maxHp).toFixed(2); normal.dead = true; normal.deadT = 0;
      // referencia: un campeón corriente de la mediana de la región (la vida y el daño del raro no dependen de su criatura base)
      const ref = R.ref(s.reg), mid = Object.keys(window.__eco.gn).find((k) => window.__eco.gn[k].hp === ref.hp && window.__De[s.reg].enemies.some((q) => q[0] === k));
      if (mid) { const c = window.__spawn(mid, e.lvl, s.x + 62, s.z + 60, { champion: true, mods: ['veloz'] }); out.vsChampion = +(e.maxHp / c.maxHp).toFixed(2); c.dead = true; c.deadT = 0; out.mid = mid; }
      Object.assign(out, { elite: !!e.elite, champion: e.champion, persist: e.persist, name: e.name, nameOk: e.name === s.name, lvl: e.lvl, lvlExp: R.lvl(s), lvlWorld: Math.round(G.world.lvlAt(s.x, s.z)), ring: !!(e.rig && e.rig.ring), mods: e.mods.join(','), scale: +e.scale.toFixed(2), alerted: e.alerted, n: R.live().length });
      // no se duplica al barrer otra vez
      R.sweep(); R.sweep(); out.noDup = R.live().filter((q) => q.rq.slot === s.id).length === 1;
    }
    return out;
  });
  console.log('montaje', JSON.stringify(C));
  check('el raro no existe como cuerpo lejos (130 m) y se monta al acercarse (30 m), sin duplicarse', !C.far && C.mounted && C.noDup, JSON.stringify({ far: C.far, mounted: C.mounted, noDup: C.noDup }));
  check('lleva el anillo dorado de élite, es campeón, persistente, con su nombre y nivel de la región + 1 (estable); vida ≈ 1,5× la de un campeón de la mediana de su región', C.elite && C.champion && C.persist && C.nameOk && C.ring && C.mods.startsWith('raro') && C.lvl === C.lvlExp && Math.abs(C.vsChampion - 1.5) < 0.2, JSON.stringify({ elite: C.elite, ring: C.ring, mods: C.mods, lvl: C.lvl, lvlExp: C.lvlExp, vsChampion: C.vsChampion, mid: C.mid }));
  await wait(10); await shot('raro-montado');

  // ── 4) descubrimiento, desmontaje y reinicio al huir ──
  const D = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, S = R.state();
    const e = R.live()[0], s = S.slots[e.rq.slot], out = { seen0: s.seen };
    R.RQ.log.length = 0;
    G.player.x = e.x + 6; G.player.z = e.z; T.step(2); R.sweep();
    out.seen1 = s.seen; out.log = R.RQ.log.map((l) => l[0]).join(',');
    R.sweep(); out.once = R.RQ.log.filter((l) => l[0] === 'seen').length === 1;
    // lejos y sin alertar: se desmonta
    e.alerted = false; G.player.x = e.x + 100; R.sweep(); T.step(2);
    out.gone = e.dead && !R.live().includes(e); out.stillReady = s.st === 'ready';
    // vuelve a montarse nuevo (reinicio)
    G.player.x = s.x + 30; G.player.z = s.z; G.world.check(true); T.step(2); R.sweep(); T.step(2);
    const e2 = R.live()[0]; out.back = !!e2 && e2 !== e;
    // alertado: huir lo reinicia solo pasados 1,35× el radio de desmontaje
    e2.alerted = true; G.player.x = e2.x + R.cfg.unloadR + 10; G.player.z = e2.z; R.sweep(); out.keeps = R.live().includes(e2);
    G.player.x = e2.x + R.cfg.unloadR * 1.35 + 5; R.sweep(); T.step(2); out.resets = !R.live().includes(e2) && e2.dead;
    return out;
  });
  check('a menos de 30 m con línea de vista (o 9 m) se descubre: marca, aviso y evento una sola vez', D.seen0 === 0 && D.seen1 === 1 && D.once && D.log.includes('seen'), JSON.stringify({ seen0: D.seen0, seen1: D.seen1, log: D.log }));
  check('lejos y sin alertar se desmonta sin botín (la casilla sigue lista) y al volver se monta de nuevo; alertado solo se reinicia al huir muy lejos', D.gone && D.stillReady && D.back && D.keeps && D.resets, JSON.stringify(D));

  // ── 5) MUDADORA ──
  const M = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('mudadora', 0, s0.x + 9, s0.z); T.calm(); T.step(3);
    out.molts0 = e.rq.molts | 0; const spd0 = e.spd, dmg0 = e.dmg;
    e.hp = e.maxHp * 0.69; T.step(2);
    out.molts1 = e.rq.molts; out.inv = e.invuln; out.act = !!e.rq.act; out.status = e.rq.status;
    // invulnerable: el daño no entra
    const hp1 = e.hp; out.hsInv = R.hs(e, 100); out.hpSame = e.hp === hp1;
    T.step(40); out.kids = e.children; out.kidsAlive = G.enemies.filter((q) => !q.dead && q.parent === e).length; out.stillInv = e.invuln;
    T.step(60); out.inv2 = e.invuln; out.spdUp = +(e.spd / spd0).toFixed(2); out.dmgUp = +(e.dmg / dmg0).toFixed(2);
    e.hp = e.maxHp * 0.39; T.step(2); out.molts2 = e.rq.molts; T.step(110);
    e.hp = e.maxHp * 0.14; T.step(2); out.molts3 = e.rq.molts; T.step(110);
    e.hp = e.maxHp * 0.1; T.step(10); out.molts4 = e.rq.molts; out.statusEnd = e.rq.status;
    return out;
  });
  console.log('mudadora', JSON.stringify(M));
  check('Mudadora: a 70/40/15 % de vida muda (3 veces, ni una más), queda invulnerable un momento (el daño no entra) y suelta crías', M.molts0 === 0 && M.molts1 === 1 && M.inv && M.act && M.hsInv === 0 && M.hpSame && M.molts2 === 2 && M.molts3 === 3 && M.molts4 === 3 && M.kids >= 2, JSON.stringify({ m: [M.molts0, M.molts1, M.molts2, M.molts3, M.molts4], inv: M.inv, kids: M.kids, alive: M.kidsAlive }));
  check('Mudadora: tras la muda deja de ser invulnerable y queda más rápida y más fuerte', M.inv2 === false && M.spdUp >= 1.09 && M.dmgUp >= 1.05, JSON.stringify({ inv2: M.inv2, spdUp: M.spdUp, dmgUp: M.dmgUp }));

  // ── 6) EMBESTIDORA ──
  const E = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    // 6a) embiste y golpea al que se queda quieto
    let e = R.spawn('estampida', 0, s0.x + 10, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; window.__hits.length = 0;
    let wind = false, dashed = false, minD = 99;
    for (let i = 0; i < 260; i++) { T.run(e, 1); const a = e.rq.act; if (a && !a.ph) wind = true; if (a && a.ph === 1) dashed = true; minD = Math.min(minD, Math.hypot(e.x - G.player.x, e.z - G.player.z)); if (window.__hits.some((h) => h[1] === 'rq')) break; }
    out.wind = wind; out.dashed = dashed; out.hit = window.__hits.filter((h) => h[1] === 'rq').length; out.push = Math.hypot(G.player.vx, G.player.vz) > 4;
    out.dmgHit = window.__hits.find((h) => h[1] === 'rq');
    // 6b) si se estrella (muro: el movimiento se bloquea) queda aturdida y vulnerable
    T.clear(); T.arena(0, 0, 0); T.calm();
    e = R.spawn('estampida', 0, s0.x + 10, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; // misma línea que en 6a (la línea de vista ya está comprobada); no la golpea porque el movimiento se bloquea desde el primer paso de la embestida
    const mv = G.map.move; window.__blk = 0; G.map.move = function (px, pz, r, dx, dz, fly) { if (window.__blk && Math.abs(r - e.rad * 0.8) < 1e-6) return [px, pz]; return mv.apply(this, arguments); };
    let stunned = false; for (let i = 0; i < 260; i++) { T.run(e, 1); const a = e.rq.act; if (a && a.ph === 1) window.__blk = 1; if (e.rq.stun > 0) { stunned = true; break; } }
    window.__blk = 0; G.map.move = mv;
    out.stunned = stunned; out.stun = +e.rq.stun.toFixed(2); out.vuln = +e.rq.vuln.toFixed(2); out.state = e.state; out.status = e.rq.status;
    const mulStun = e.dmgTakenMul(); T.step(120); const mulFree = e.dmgTakenMul();
    out.mulStun = +mulStun.toFixed(3); out.mulFree = +mulFree.toFixed(3); out.vulnRatio = +(mulStun / mulFree).toFixed(2);
    out.free = e.rq.stun <= 0; out.cdAfter = +e.rq.cd.toFixed(1);
    return out;
  });
  console.log('estampida', JSON.stringify(E));
  check('Embestidora: avisa con una línea (1 s), embiste hacia ti y te golpea y empuja si no te mueves', E.wind && E.dashed && E.hit >= 1 && E.push, JSON.stringify({ wind: E.wind, dashed: E.dashed, hit: E.hit, push: E.push, dmg: E.dmgHit }));
  check('Embestidora: si se estrella queda aturdida ~3,2 s y recibe ×1,35 de daño; luego se recupera', E.stunned && E.stun > 2.5 && E.vuln > 2.5 && E.vulnRatio >= 1.3 && E.free, JSON.stringify({ stun: E.stun, vuln: E.vuln, ratio: E.vulnRatio, free: E.free, status: E.status }));

  // ── 7) PARARRAYOS ──
  const P = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('pararrayos', 5, s0.x + 10, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; T.step(3);
    const py = () => G.enemies.filter((q) => q.rqPylon === e && !q.dead);
    out.pylons = py().length; out.armor = +e.rq.armor.toFixed(2); out.shielded = e.shielded > 0; out.status = e.rq.status; out.children = e.children;
    out.dist = py().map((p) => +Math.hypot(p.x - e.x, p.z - e.z).toFixed(1));
    const mulWith = e.dmgTakenMul(); out.mulWith = +mulWith.toFixed(3);
    // descargas sobre el jugador
    window.__hits.length = 0; let bolts = 0, warn = 0; const bp = R.RQ.bolts.push; R.RQ.bolts.push = function (...a) { bolts++; warn = a[0].t; return bp.apply(this, a); };
    for (let i = 0; i < 500 && bolts < 2; i++) T.step(1);
    R.RQ.bolts.push = bp; out.bolts = bolts; out.warn = warn; const h0 = window.__hits.length; T.step(40); out.hitByBolt = window.__hits.length > 0;
    // destruye los pilones: queda expuesta
    const win = window.__hits.length; for (const p of py()) { p.hp = 0; p.kill({}); } T.step(3);
    out.armor2 = e.rq.armor; out.stun = +e.rq.stun.toFixed(2); out.vuln = +e.rq.vuln.toFixed(2); out.status2 = e.rq.status; out.kidsLeft = py().length;
    out.mulWithout = +e.dmgTakenMul().toFixed(3); out.ratio = +(mulWith / e.dmgTakenMul()).toFixed(3);
    return out;
  });
  console.log('pararrayos', JSON.stringify(P));
  check('Pararrayos: aparecen 2 pilones tesla (3 a partir del nivel 26) a 5-8 m que la protegen (daño total ×0,28) y el estado «PROTEGIDA»', (P.pylons === 2 || P.pylons === 3) && P.armor > 0 && P.armor <= 0.3 && /PROTEGIDA/.test(P.status || '') && P.mulWith <= 0.3 && P.dist.every((d) => d >= 3 && d <= 10) && P.children === P.pylons, JSON.stringify({ pylons: P.pylons, armor: P.armor, mulWith: P.mulWith, dist: P.dist, status: P.status, children: P.children }));
  check('Pararrayos: lanza rayos con aviso sobre tu posición y al caer los pilones queda expuesta (aturdida, ×1,3, sin protección)', P.bolts >= 2 && P.warn >= 0.8 && P.hitByBolt && P.armor2 === 1 && P.stun > 3 && P.vuln > 3 && P.kidsLeft === 0 && P.ratio < 0.3, JSON.stringify({ bolts: P.bolts, warn: P.warn, armor2: P.armor2, stun: P.stun, ratio: P.ratio, status2: P.status2 }));

  // ── 8) ACORAZADA ──
  const Z = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('coraza', 5, s0.x + 8, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; T.step(3);
    out.closed = +e.dmgTakenMul().toFixed(3); out.armor = e.rq.armor; out.status0 = e.rq.status;
    let opened = false, windup = false, maxOpen = 0, openMul = 0; window.__hits.length = 0;
    for (let i = 0; i < 400; i++) { T.step(1); if (e.rq.act) windup = true; if (e.rq.open > 0) { opened = true; maxOpen = Math.max(maxOpen, e.rq.open); openMul = e.dmgTakenMul(); } if (opened && e.rq.open <= 0) break; }
    out.windup = windup; out.opened = opened; out.maxOpen = +maxOpen.toFixed(2); out.openMul = +openMul.toFixed(3); out.status1 = e.rq.status;
    T.step(3); out.closedAfter = e.rq.armor; out.ratio = +(openMul / out.closed).toFixed(2);
    out.novaHit = window.__hits.length > 0;
    return out;
  });
  console.log('coraza', JSON.stringify(Z));
  check('Acorazada: cerrada recibe una fracción del daño (×0,2); hace una descarga con aviso, se abre ~3 s y queda ×1,5 expuesta (5-8 veces más daño); luego se cierra', Z.armor === 0.2 && Z.windup && Z.opened && Z.maxOpen > 2.5 && Z.ratio >= 5 && Z.closedAfter === 0.2 && Z.novaHit, JSON.stringify({ armor: Z.armor, windup: Z.windup, maxOpen: Z.maxOpen, ratio: Z.ratio, closedAfter: Z.closedAfter, hit: Z.novaHit }));

  // ── 9) ATRACTOR ──
  const W = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('pozo', 4, s0.x + 5, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; e.alerted = true; window.__hits.length = 0;
    e.spd = 0; const d0 = Math.hypot(e.x - G.player.x, e.z - G.player.z); let maxPull = 0, started = false, rooted = true, minD = d0, boom = false, at = null;
    const ex = e.x, ez = e.z;
    for (let i = 0; i < 400; i++) {
      T.step(1);
      const a = e.rq.act; if (a) started = true; if (a && Math.hypot(e.x - ex, e.z - ez) > 0.05) rooted = false;
      const d = Math.hypot(e.x - G.player.x, e.z - G.player.z); minD = Math.min(minD, d); maxPull = Math.max(maxPull, d0 - d);
      if (started && !e.rq.act) { boom = true; at = d; break; }
    }
    out.d0 = +d0.toFixed(1); out.minD = +minD.toFixed(1); out.pull = +maxPull.toFixed(1); out.started = started; out.rooted = rooted; out.boom = boom; out.hit = window.__hits.length > 0; out.hitDmg = window.__hits[0];
    // quien se queda fuera del radio no se mueve
    T.clear(); T.arena(0, 0, 0); T.calm();
    const e2 = R.spawn('pozo', 4, s0.x + 14, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; e2.alerted = true; e2.spd = 0; window.__hits.length = 0; const dd0 = Math.hypot(e2.x - G.player.x, e2.z - G.player.z);
    for (let i = 0; i < 400; i++) { T.step(1); if (e2.rq.act) break; } T.step(80);
    out.outside = +(dd0 - Math.hypot(e2.x - G.player.x, e2.z - G.player.z)).toFixed(2); out.outHit = window.__hits.length;
    return out;
  });
  console.log('pozo', JSON.stringify(W));
  check('Atractor: crea un pozo con aviso, con el jugador dentro del radio lo arrastra hacia él (≥ 2,5 m) y estalla al final haciéndole daño; la criatura no se mueve', W.started && W.rooted && W.pull >= 2.5 && W.boom && W.hit, JSON.stringify({ d0: W.d0, minD: W.minD, pull: W.pull, rooted: W.rooted, hit: W.hit }));
  check('Atractor: quien está fuera del radio (14 m) no es arrastrado ni herido', Math.abs(W.outside) < 0.6 && W.outHit === 0, JSON.stringify({ outside: W.outside, hits: W.outHit }));

  // ── 10) CHUPASANGRE ──
  const H = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('chupasangre', 3, s0.x + 7, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; e.hp = e.maxHp * 0.5; e.alerted = true; window.__hits.length = 0;
    let linked = false, wind = false; for (let i = 0; i < 300; i++) { T.run(e, 1); if (e.rq.act) wind = true; if (e.rq.link) { linked = true; break; } }
    out.wind = wind; out.linked = linked; const hp0 = e.hp, ph0 = G.player.hp;
    T.run(e, 45); out.drained = +(ph0 - G.player.hp).toFixed(1); out.healed = +(e.hp - hp0).toFixed(1); out.dots = window.__hits.filter((h) => h[1] === 'rq').length; out.status = e.rq.status; out.stillLinked = !!e.rq.link;
    // rompe la línea de visión: se suelta y queda expuesta
    const los = G.map.los; G.map.los = () => false; T.run(e, 14); G.map.los = los;
    out.broke = !e.rq.link; out.recoil = +e.rq.stun.toFixed(2); out.vuln = +e.rq.vuln.toFixed(2);
    // la distancia también la rompe
    T.run(e, 80); let relink = false; for (let i = 0; i < 400; i++) { T.run(e, 1); if (e.rq.link) { relink = true; break; } }
    G.player.x = e.x + 16; G.player.z = e.z; T.run(e, 4); out.relink = relink; out.farBroke = !e.rq.link;
    return out;
  });
  console.log('chupasangre', JSON.stringify(H));
  check('Chupasangre: avisa, se engancha, te drena con un rayo y se cura con lo drenado', H.wind && H.linked && H.drained > 0 && H.healed > 0 && H.dots >= 3, JSON.stringify({ wind: H.wind, linked: H.linked, drained: H.drained, healed: H.healed, dots: H.dots }));
  check('Chupasangre: sin línea de vista (o a más de 13 m) el enlace se rompe y queda aturdida y vulnerable', H.broke && H.recoil > 0.8 && H.vuln > 0.8 && H.relink && H.farBroke, JSON.stringify({ broke: H.broke, recoil: H.recoil, relink: H.relink, farBroke: H.farBroke }));

  // ── 11) ESPEJISMO ──
  const X = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('acechador', 2, s0.x + 8, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; T.step(3);
    const dec = () => G.enemies.filter((q) => q.rqDecoy === e && !q.dead);
    out.n = dec().length; out.dmg = dec().map((d) => d.dmg); out.hpRatio = dec().length ? +(dec()[0].maxHp / e.maxHp).toFixed(3) : null; out.noRing = dec().every((d) => !d.elite); out.sameScale = dec().every((d) => Math.abs(d.scale - e.scale) < 0.01); out.realRing = !!e.elite;
    out.near = dec().map((d) => +Math.hypot(d.x - G.player.x, d.z - G.player.z).toFixed(1));
    // una copia caída no da botín ni cuenta como muerte para las misiones
    const Q = window.__dbg.Quests; Q.accept('t_kill', { id: 't_kill', giver: 'reyes', n: 'prueba', lvl: 1, xpf: 1, intro: '', done: '', obj: [{ t: 'kill', any: true, n: 3 }], rew: { credits: 1 }, repeat: true }); const pk0 = G.pickups.length, g0 = window.__eco.ground.length;
    const d1 = dec()[0]; d1.hp = 0; d1.kill({}); T.step(3);
    out.prog1 = G.S.quests.active.t_kill && G.S.quests.active.t_kill.prog[0]; out.loot = (G.pickups.length - pk0) + (window.__eco.ground.length - g0);
    const normal = window.__spawn('rastrero', 1, G.player.x + 3, G.player.z, { alerted: true }); normal.hp = 0; normal.kill({}); T.step(2);
    out.prog2 = G.S.quests.active.t_kill && G.S.quests.active.t_kill.prog[0];
    delete G.S.quests.active.t_kill;
    // se reponen y desaparecen con la real
    T.step(320); out.again = dec().length; e.hp = 0; e.kill({}); T.step(3); out.gone = dec().length;
    return out;
  });
  console.log('espejismo', JSON.stringify(X));
  check('Espejismo: la rodean 2 copias del mismo tamaño que no hacen daño, con una fracción de su vida y sin el anillo dorado (la real sí lo lleva)', X.n === 2 && X.dmg.every((d) => d === 0) && X.hpRatio < 0.2 && X.noRing && X.sameScale && X.realRing && X.near.every((d) => d >= 2 && d <= 12), JSON.stringify({ n: X.n, hpRatio: X.hpRatio, noRing: X.noRing, sameScale: X.sameScale, near: X.near }));
  check('Espejismo: abatir una copia no da botín ni cuenta para las misiones de abatir; se reponen y desaparecen al caer la real', X.loot === 0 && X.prog1 === 0 && X.prog2 === 1 && X.again === 2 && X.gone === 0, JSON.stringify({ loot: X.loot, prog1: X.prog1, prog2: X.prog2, again: X.again, gone: X.gone }));

  // ── 12) AURA (fuego y hielo) ──
  const U = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    let e = R.spawn('aura', 2, s0.x + 9, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; e.alerted = true; window.__hits.length = 0; G.hazards.length = 0;
    out.fireMods = e.mods.join(','); let maxPools = 0; for (let i = 0; i < 400; i++) { T.step(1); maxPools = Math.max(maxPools, G.hazards.filter((h) => h.rq).length); if (maxPools >= 3 && i > 150) break; }
    out.pools = maxPools; out.hurt = window.__hits.filter((h) => h[1] === 'dot' || h[1] === '?').length; out.fireStatus = e.rq.status; out.iceFlag = e.rq.ice;
    T.clear(); T.arena(0, 0, 0); T.calm();
    e = R.spawn('aura', 4, s0.x + 9, s0.z, { ice: 1 }); T.calm(); G.player.x = s0.x; G.player.z = s0.z; e.alerted = true; G.hazards.length = 0; G.player.slowT = 0;
    out.iceMods = e.mods.join(','); let slowed = false; for (let i = 0; i < 500; i++) { T.step(1); if (G.hazards.some((h) => h.rq && h.ice) && G.player.slowT > 0) { slowed = true; break; } }
    out.slowed = slowed; out.iceStatus = e.rq.status; out.iceFlag2 = e.rq.ice;
    return out;
  });
  console.log('aura', JSON.stringify(U));
  check('Aura de fuego: planta ≥ 3 charcos escalonados (con aviso) bajo tus pies que queman, y lleva el modificador «ígneo»', U.pools >= 3 && U.hurt >= 1 && U.fireMods === 'raro,igneo', JSON.stringify({ pools: U.pools, hurt: U.hurt, mods: U.fireMods }));
  check('Aura de hielo (región 4): los charcos ralentizan al jugador y la criatura es «gélida»', U.slowed && U.iceMods === 'raro,gelido' && U.iceFlag2 === 1, JSON.stringify({ slowed: U.slowed, mods: U.iceMods }));

  // ── 13) furia ──
  const F = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('estampida', 0, s0.x + 12, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; T.step(3);
    const spd0 = e.spd; e.hp = e.maxHp * 0.25; T.step(3);
    out.rage = e.rq.rage; out.spdUp = +(e.spd / spd0).toFixed(2); out.cdMul = e.rq.cdMul;
    return out;
  });
  check('Furia: por debajo del 30 % de vida se enfurece (+12 % de velocidad, mecánicas más seguidas)', F.rage && F.spdUp >= 1.1 && F.cdMul < 0.8, JSON.stringify(F));

  // ── 14) botín: pieza garantizada ≥ Raro, trofeo vendible, núcleos, estadísticas y enfriamiento largo ──
  const L = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, eco = window.__eco, S = R.state(), out = {};
    T.clear(); const s0 = T.arena(1, 0, 0); T.calm();
    const e = R.spawn('estampida', 1, s0.x + 8, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z;
    const slot = S.slots[e.rq.slot], kills0 = S.stats.kills, g0 = eco.ground.length; G.pickups.length = 0; const t0 = G.S.playTime;
    e.hp = 0; e.kill({}); T.step(3);
    const items = G.pickups.filter((p) => p.k === 'item'), mats = G.pickups.filter((p) => p.k === 'mat');
    out.items = items.map((p) => p.item.r); out.mats = mats.map((p) => p.mat + ':' + p.val); out.trophy = eco.ground.slice(g0).map((p) => p.id);
    out.kills = S.stats.kills - kills0; out.byArch = S.stats.byArch.estampida; out.st = slot.st; out.cd = +(slot.cd - t0).toFixed(0); out.live = R.live().length;
    out.log = R.RQ.log.map((l) => l[0]).join(',');
    // distribución de la pieza garantizada
    const N = 20000, c = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < N; i++) c[eco.ecoRoll('rareGear', 1)]++;
    out.dist = c.map((v) => +((100 * v) / N).toFixed(1));
    // trofeo: su valor frente al mejor trofeo corriente de la región y a un jefe
    const tbl = eco.ecoTroTable(), reg1 = Object.values(tbl).filter((t) => t.reg === 1 && !t.boss), best = Math.max(...reg1.map((t) => t.v)), tr = tbl['rq_estampida_1'], un = tbl['rq_u_locutora'], boss = tbl['demoledor'];
    out.vBest = best; out.vRare = tr && tr.v; out.vUniq = un && un.v; out.vBoss = boss && boss.v; out.trInfo = tr && { boss: tr.boss, reg: tr.reg, fam: tr.fam, n: tr.n };
    // vender: el trofeo sube los créditos
    G.S.junk = {}; const cr0 = G.S.credits; G.S.junk['rq_estampida_1'] = 1; const sold = eco.ecoSellAllJunk(); out.sold = sold; out.crDelta = G.S.credits - cr0; out.junkLeft = Object.keys(G.S.junk).length;
    out.html = /Jefes y raros/.test((function () { G.S.junk['rq_estampida_1'] = 1; try { return R.junkHtml(); } finally { delete G.S.junk['rq_estampida_1']; } })());
    return out;
  });
  console.log('botín', JSON.stringify(L));
  check('Al abatirlo suelta una pieza de equipo ≥ Raro, el trofeo del arquetipo y núcleos; cuenta en las estadísticas y llega el evento «slain»', L.items.length >= 1 && Math.max(...L.items) >= 2 && L.trophy.includes('rq_estampida_1') && L.mats.some((m) => m.startsWith('core')) && L.kills === 1 && L.byArch >= 1 && L.log.includes('slain'), JSON.stringify({ items: L.items, trophy: L.trophy, mats: L.mats, kills: L.kills, log: L.log }));
  check('La casilla entra en enfriamiento largo (25-40 min de juego) y el cuerpo desaparece de la lista de montados', L.st === 'wait' && L.cd >= 1490 && L.cd <= 2410 && L.live === 0, JSON.stringify({ st: L.st, cd: L.cd, live: L.live }));
  check('Los ajustes por defecto: objeto genérico 12 % y como mucho 2 pendientes', await ev(() => window.__rare.cfg.itemP === 0.12 && window.__rare.cfg.itemMaxHeld === 2), '');
  check('Pieza garantizada: nunca por debajo de Raro (Raro ~89 %, Épico ~10 %, Legendario o más ~1 %)', L.dist[0] === 0 && L.dist[1] === 0 && L.dist[2] > 84 && L.dist[3] > 7 && L.dist[3] < 14 && L.dist[4] + L.dist[5] < 3, JSON.stringify(L.dist));
  check('El trofeo vale ~2,4× el mejor corriente de su región (única ~4,2×) y menos que el de un jefe; es vendible y aparece en «Jefes y raros»', L.vRare / L.vBest > 1.8 && L.vRare / L.vBest < 3.2 && L.vUniq / L.vBest > 3.4 && L.vUniq / L.vBest < 5.2 && L.vUniq < L.vBoss && L.crDelta === L.sold && L.sold === L.vRare && L.html, JSON.stringify({ best: L.vBest, rare: L.vRare, uniq: L.vUniq, boss: L.vBoss, sold: L.sold, delta: L.crDelta, html: L.html }));

  // ── 15) reaparición ──
  const Rb = await ev(() => {
    const G = window.__G, R = window.__rare, S = R.state(), T = window.__t, out = {};
    const s = R.slots().find((q) => q.st === 'wait'); const pos0 = [s.x, s.z, s.arch, s.name];
    G.player.x = s.x + 150; G.player.z = s.z; // lejos
    s.cd = G.S.playTime - 1; R.sweep(); out.ready = s.st === 'ready'; out.moved = Math.hypot(s.x - pos0[0], s.z - pos0[1]); out.inReg = (() => { const Rg = window.__De[s.reg]; return s.x >= Rg.gx * 192 && s.x < (Rg.gx + 1) * 192 && s.z >= Rg.gz * 192 && s.z < (Rg.gz + 1) * 192; })();
    out.fresh = s.seen === 0;
    // con la probabilidad de única al máximo, la región ofrece su única; abatida, no vuelve
    for (const q of R.slots()) q.uniq = null; delete S.uniq.u_colmillo;
    R.cfg.uniqueP = 1; const s2 = R.slots().find((q) => q.reg === 4 && q.st !== 'wait') || R.slots().find((q) => q.reg === 4); s2.st = 'wait'; s2.cd = 0; s2.uniq = null; G.player.x = s2.x + 150; G.player.z = s2.z; R.sweep();
    out.uniq = s2.uniq; out.uniqName = s2.name; R.cfg.uniqueP = 0.24;
    return out;
  });
  check('Terminado el enfriamiento reaparece lista en OTRO sitio de su región (lejos del jugador), con otra criatura al azar y sin marcar como vista', Rb.ready && Rb.moved > 10 && Rb.inReg && Rb.fresh, JSON.stringify({ moved: Rb.moved && +Rb.moved.toFixed(1), inReg: Rb.inReg }));
  check('Con la probabilidad al máximo, la criatura que reaparece es la única de la región (Colmillo Blanco en la tundra)', Rb.uniq === 'u_colmillo' && Rb.uniqName === 'Colmillo Blanco', JSON.stringify({ uniq: Rb.uniq, name: Rb.uniqName }));

  // ── 16) objetos especiales: única con misión de entrega ──
  const Q = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, S = R.state(), Qs = window.__dbg.Quests, out = {};
    T.clear(); G.S.quests.active = {}; const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('mudadora', 0, s0.x + 8, s0.z, { uniq: 'u_hueco', base: 'infectado', name: 'Sargento Hueco' }); T.calm(); G.player.x = s0.x; G.player.z = s0.z;
    const inv0 = G.S.inv.length, cr0 = G.S.credits; R.RQ.log.length = 0;
    e.hp = 0; e.kill({}); T.step(3);
    const it = S.items.find((i) => i.uniq === 'u_hueco'); out.item = it && it.n; out.q = it && it.q; const st = it && G.S.quests.active[it.q]; out.active = !!st; const def = st && (st.def || null);
    out.rq = def && def.rq; out.obj = def && JSON.stringify(def.obj); out.uniqSlain = S.uniq.u_hueco; out.log = R.RQ.log.map((l) => l[0]).join(',');
    out.toasts = window.__toastLog.filter((t) => /OBJETO|Objeto especial/i.test(t)).length;
    // no se puede abandonar
    const sc0 = Qs.sideCount(); Qs.abandon(it.q); out.abandonBlocked = !!G.S.quests.active[it.q] && Qs.sideCount() === sc0;
    // hablar con Reyes entrega el objeto y paga
    const qid = it.q, ok = Qs.onTalk('reyes'); T.step(2);
    out.turned = ok && !G.S.quests.active[qid] && !!G.S.quests.done[qid]; out.qNull = it.q === null; out.crDelta = G.S.credits - cr0; out.invDelta = G.S.inv.length - inv0; out.gearR = G.S.inv.slice(inv0).map((p) => p.r); out.itemDone = !!(S.items.find((i) => i.id === it.id) || {}).done;
    out.xpf = def && def.xpf; out.reward = def && JSON.stringify(def.rew);
    return out;
  });
  console.log('única', JSON.stringify(Q));
  check('La única siempre suelta su objeto especial ★, inicia su misión «Nombre y apellido» (llevarla a Reyes) y queda registrada como abatida', Q.item === 'Placa de identificación calcinada' && Q.active && Q.rq && Q.obj.includes('reyes') && Q.uniqSlain === 1 && Q.log.includes('item') && Q.toasts >= 1, JSON.stringify({ item: Q.item, active: Q.active, obj: Q.obj, uniq: Q.uniqSlain, toasts: Q.toasts }));
  check('El encargo del objeto no se puede abandonar; al hablar con Reyes se entrega, paga créditos y una pieza de equipo Rara', Q.abandonBlocked && Q.turned && Q.crDelta > 0 && Q.itemDone && Q.qNull && Q.gearR.some((r) => r === 2), JSON.stringify({ blocked: Q.abandonBlocked, turned: Q.turned, cr: Q.crDelta, gear: Q.gearR, done: Q.itemDone }));

  // ── 17) objetos especiales: hallazgo (ir al lugar marcado y desenterrar el alijo) y rastro (ir y contárselo) ──
  const Hz = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, S = R.state(), Qs = window.__dbg.Quests, eco = window.__eco, out = {};
    T.clear(); G.S.quests.active = {}; const reg2 = window.__regionCenter('desierto'); G.player.x = reg2.x; G.player.z = reg2.z; G.world.check(true); T.step(20); T.calm();
    const e = R.spawn('acechador', 2, reg2.x + 8, reg2.z, { uniq: 'u_espejismo', base: 'acechador', name: 'Espejismo Dorado' }); T.calm(); G.player.x = reg2.x; G.player.z = reg2.z;
    const cr0 = G.S.credits; e.hp = 0; e.kill({}); T.step(3);
    const it = S.items.find((i) => i.uniq === 'u_espejismo'), qid1 = it && it.q, st = it && G.S.quests.active[it.q], def = st && st.def;
    const o = def && def.obj[0]; out.hasObj = !!o && o.t === 'rq' && o.k === 'reach'; out.auto = def && def.auto;
    out.inReg = o && (() => { const Rg = window.__De[2]; return o.x >= Rg.gx * 192 && o.x < (Rg.gx + 1) * 192 && o.z >= Rg.gz * 192 && o.z < (Rg.gz + 1) * 192; })();
    out.dist = o && +Math.hypot(o.x - G.player.x, o.z - G.player.z).toFixed(0);
    const tg = Qs.target(it.q, st); out.target = tg && Math.abs(tg.x - o.x) < 0.01; out.text = Qs.objText(o, 0);
    // llega al lugar: abre el alijo y entrega la misión sola
    G.pickups.length = 0; G.player.x = o.x; G.player.z = o.z; T.step(4);
    out.done = !G.S.quests.active[qid1] && !!G.S.quests.done[qid1]; out.chest = G.pickups.length; out.crDelta = G.S.credits - cr0;
    // rastro: Eco Mudo (yermo) → ir al lugar y luego hablar con Viktor
    G.S.quests.active = {}; const reg7 = window.__regionCenter('yermo'); G.player.x = reg7.x; G.player.z = reg7.z; G.world.check(true); T.step(20); T.calm();
    const e2 = R.spawn('pararrayos', 7, reg7.x + 8, reg7.z, { uniq: 'u_eco', base: 'mortero', name: 'Eco Mudo' }); T.calm(); G.player.x = reg7.x; G.player.z = reg7.z;
    e2.hp = 0; e2.kill({}); T.step(3);
    const it2 = S.items.find((i) => i.uniq === 'u_eco'), qid2 = it2 && it2.q, st2 = it2 && G.S.quests.active[it2.q], d2 = st2 && st2.def, o2 = d2 && d2.obj[0];
    out.rastro = !!o2 && o2.t === 'rq' && d2.giver === 'viktor' && !d2.auto;
    G.player.x = o2.x; G.player.z = o2.z; T.step(4);
    out.reached = (st2.prog[0] || 0) >= 1; out.stillActive = !!G.S.quests.active[qid2]; out.ready = Qs.readyAt('viktor').includes(qid2);
    const cr1 = G.S.credits; Qs.turnIn(qid2); T.step(2); out.turned = !!G.S.quests.done[qid2] && G.S.credits > cr1;
    return out;
  });
  console.log('hallazgo/rastro', JSON.stringify(Hz));
  check('Hallazgo (Espejismo Dorado): la misión marca un lugar de su región a 70-150 m, aparece en el objetivo y en el mapa; al llegar se abre el alijo y se entrega sola', Hz.hasObj && Hz.auto && Hz.inReg && Hz.dist >= 60 && Hz.dist <= 160 && Hz.target && /^Ve al alijo \(a \d+ m\)$/.test(Hz.text) && Hz.done && Hz.chest >= 3 && Hz.crDelta > 0, JSON.stringify({ hasObj: Hz.hasObj, inReg: Hz.inReg, dist: Hz.dist, target: Hz.target, done: Hz.done, chest: Hz.chest, text: Hz.text, ok: /^Ve al alijo/.test(Hz.text) }));
  check('Rastro (Eco Mudo): ir al lugar completa el objetivo pero no entrega; Viktor la tiene lista y al hablar con él se paga', Hz.rastro && Hz.reached && Hz.stillActive && Hz.ready && Hz.turned, JSON.stringify({ rastro: Hz.rastro, reached: Hz.reached, ready: Hz.ready, turned: Hz.turned }));

  // ── 18) objeto genérico, límite de encargos y reintento ──
  const Gn = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, S = R.state(), Qs = window.__dbg.Quests, out = {};
    T.clear(); G.S.quests.active = {}; S.items = S.items.filter((i) => i.uniq); const s0 = T.arena(0, 0, 0); T.calm();
    R.cfg.itemP = 1;
    // llena los encargos secundarios (límite 4)
    for (let i = 0; i < 4; i++) Qs.accept('d' + i, { id: 'd' + i, giver: 'reyes', n: 'relleno ' + i, lvl: 1, xpf: 1, intro: '', done: '', obj: [{ t: 'kill', any: true, n: 99 }], rew: { credits: 1 }, repeat: true });
    out.side = Qs.sideCount(); const tl0 = window.__toastLog.length;
    let e = R.spawn('mudadora', 0, s0.x + 8, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; e.hp = 0; e.kill({}); T.step(3);
    const it = S.items.find((i) => !i.uniq && !i.done); out.item = it && it.n; out.pend = !!(it && it.pend); out.noQuest = it && !G.S.quests.active[it.q];
    T.step(200); out.toastsLimit = window.__toastLog.slice(tl0).filter((t) => /secundarios/.test(t)).length; // sin spam de avisos en cada reintento
    // libera un hueco: se asigna sola
    delete G.S.quests.active.d0; T.step(120);
    out.started = !!(it && G.S.quests.active[it.q]); const def = it && G.S.quests.active[it.q] && G.S.quests.active[it.q].def; out.npc = def && def.obj[0].npc; out.npcOk = def && R.RQN[0].includes(def.obj[0].npc); out.title = def && def.n;
    // el límite de objetos pendientes (2): con 2 sin entregar no cae un tercero
    R.cfg.itemP = 1; const have = S.items.filter((i) => !i.uniq && !i.done).length;
    e = R.spawn('mudadora', 0, s0.x + 8, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; e.hp = 0; e.kill({}); T.step(3);
    e = R.spawn('mudadora', 0, s0.x + 8, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; e.hp = 0; e.kill({}); T.step(3);
    out.open = S.items.filter((i) => !i.uniq && !i.done).length; out.have = have; out.items = S.items.map((i) => [i.n, !!i.uniq, !!i.done, !!i.q, !!i.pend]); R.cfg.itemP = 0.12;
    for (const k of Object.keys(G.S.quests.active)) delete G.S.quests.active[k];
    return out;
  });
  console.log('genérico', JSON.stringify(Gn));
  check('Un raro corriente puede soltar un objeto especial genérico por familia ★; con los encargos secundarios llenos queda pendiente y se avisa una sola vez', Gn.side === 4 && Gn.item && Gn.pend && Gn.noQuest && Gn.toastsLimit <= 1, JSON.stringify({ side: Gn.side, item: Gn.item, pend: Gn.pend, toasts: Gn.toastsLimit }));
  check('Al liberar un hueco la misión se asigna sola («Encargo especial», llevar el objeto al superviviente de la región); como mucho 2 objetos genéricos pendientes', Gn.started && Gn.npcOk && /Encargo especial/.test(Gn.title) && Gn.open <= 2, JSON.stringify({ started: Gn.started, npc: Gn.npc, title: Gn.title, open: Gn.open, items: Gn.items }));

  // ── 19) guardado y migración ──
  const Sv = await ev(() => {
    const G = window.__G, R = window.__rare, S = R.state(), out = {};
    const snap = JSON.parse(JSON.stringify(S));
    const dirty = JSON.parse(JSON.stringify(S)); dirty.slots.bad1 = { id: 'bad1', arch: 'noexiste', x: 1, z: 1 }; dirty.slots.bad2 = { id: 'bad2', arch: 'mudadora', base: 'rastrero', x: NaN, z: 1 }; dirty.uniq.fantasma = 1; dirty.items.push({ id: 'zz_1', n: 'x' }, { id: 'zz_1', n: 'dup' }, null, { n: 'sin id' });
    const first = Object.values(dirty.slots)[0]; first.st = 'raro'; first.uniq = 'noexiste'; first.cd = 'abc';
    const mig = R.migrate({ rare: dirty }) || dirty.rare;
    const S2 = { rare: dirty }; R.migrate(S2); const once = JSON.stringify(S2.rare); R.migrate(S2); const twice = JSON.stringify(S2.rare);
    out.badOut = !S2.rare.slots.bad1 && !S2.rare.slots.bad2; out.uniqOut = !S2.rare.uniq.fantasma; out.itemsOk = S2.rare.items.length === (snap.items.length + 1); out.stSane = Object.values(S2.rare.slots).every((s) => s.st === 'ready' || s.st === 'wait') && Object.values(S2.rare.slots).every((s) => Number.isFinite(s.cd)); out.idem = once === twice;
    // una partida sin S.rare crea todo en blanco
    const S3 = {}; R.migrate(S3); out.fresh = !!S3.rare && S3.rare.v === 1 && Object.keys(S3.rare.slots).length === 0 && !S3.rare.init;
    out.json = (() => { try { JSON.parse(JSON.stringify(S)); return true; } catch (e) { return false; } })();
    return out;
  });
  check('S.rare es JSON puro; la migración saca huecos inválidos, únicas fantasma y objetos duplicados, sanea estados sucios y es idempotente; una partida sin S.rare empieza en blanco', Sv.badOut && Sv.uniqOut && Sv.itemsOk && Sv.stSane && Sv.idem && Sv.fresh && Sv.json, JSON.stringify(Sv));

  // ── 20) HUD, minimapa y diario ──
  const Hd = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, S = R.state(), out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('coraza', 5, s0.x + 8, s0.z, { name: 'Casco Duro' }); T.calm(); G.player.x = s0.x; G.player.z = s0.z; T.step(15);
    const bar = document.getElementById('rqBar'); out.focus = R.hud.focus() && R.hud.focus().rq.name; out.live = R.live().map((q) => q.rq.name + ':' + q.alerted + ':' + !q.dead); out.on = !!bar && bar.classList.contains('on'); out.name = bar && bar.querySelector('.nm').textContent; out.pct0 = bar && bar.querySelector('.hp i').style.width; out.stt = bar && bar.querySelector('.stt').textContent; out.inv = bar && bar.querySelector('.hp').classList.contains('inv');
    e.hp = e.maxHp * 0.5; T.step(8); out.pct1 = bar.querySelector('.hp i').style.width;
    out.inParent = bar && bar.parentNode && bar.parentNode.id;
    // minimapa: dibuja marcas sin errores
    const calls = { arc: 0, fill: 0, stroke: 0 }; const ctx = new Proxy({}, { get: (t, k) => (k in calls ? () => { calls[k]++; } : typeof k === 'string' ? (typeof t[k] === 'undefined' ? () => {} : t[k]) : undefined), set: (t, k, v) => { t[k] = v; return true; } });
    let err = null; try { R.pings(ctx, 160, 1.6); } catch (e2) { err = String(e2); } out.pingErr = err; out.arcs = calls.arc; out.fills = calls.fill;
    const slot = S.slots[e.rq.slot]; slot.seen = 1; calls.arc = 0; calls.fill = 0; R.pings(ctx, 160, 1.6); out.arcsSeen = calls.arc; out.fillsSeen = calls.fill;
    // diario: contadores
    out.hitos = R.hitos(); T.clear(); T.step(15); out.off = !bar.classList.contains('on');
    return out;
  });
  console.log('hud', JSON.stringify(Hd));
  check('Barra del raro: aparece junto al reloj con su nombre y arquetipo, el % de vida sigue al combate y el estado de la mecánica; se oculta al desaparecer', Hd.on && /Casco Duro/.test(Hd.name) && /Acorazada/.test(Hd.name) && Hd.pct0 === '100%' && Hd.pct1 === '50%' && Hd.stt.length > 3 && Hd.inv && Hd.off && Hd.inParent === 'hTC', JSON.stringify({ on: Hd.on, name: Hd.name, pct: [Hd.pct0, Hd.pct1], stt: Hd.stt, inv: Hd.inv, off: Hd.off, focus: Hd.focus, live: Hd.live }));
  check('Minimapa: marca los raros (estrella dorada) sin errores, más intensa cuando ya se han visto', !Hd.pingErr && Hd.fillsSeen >= 1 && Hd.arcsSeen >= 1, JSON.stringify({ err: Hd.pingErr, arcs: Hd.arcs, arcsSeen: Hd.arcsSeen, fillsSeen: Hd.fillsSeen }));
  check('Archivo → Hitos resume raros abatidos, únicas y objetos especiales con su estado', /raros abatidos/.test(Hd.hitos) && /Objetos especiales/.test(Hd.hitos) && /Placa de identificación|Encargo especial|Entregado/.test(Hd.hitos), JSON.stringify({ len: Hd.hitos.length }));

  // ── 21) integración: Némesis, sombras y robustez ──
  const I = await ev(() => {
    const G = window.__G, R = window.__rare, T = window.__t, out = {};
    T.clear(); const s0 = T.arena(0, 0, 0); T.calm();
    const e = R.spawn('estampida', 0, s0.x + 3, s0.z); T.calm(); G.player.x = s0.x; G.player.z = s0.z; e.alerted = true;
    out.nem = R.nemKiller(); out.nemOther = null;
    const o = window.__spawn('rastrero', 1, s0.x + 2, s0.z, { alerted: true }); e.alerted = false; out.nemOther = R.nemKiller() === o; o.dead = true; o.deadT = 0;
    // un subterráneo: los raros del mundo se descartan y no rompen nada
    const stairs = G.map.ents.find((q) => q.k === 'stairs'); let sub = null;
    if (stairs) { G.player.x = stairs.x + 1.5; G.player.z = stairs.z; try { G.world.enterSub(stairs); window.__step(20, 1 / 30); sub = { mode: G.mode, live: R.live().length }; G.world.leaveSub(); window.__step(20, 1 / 30); } catch (err) { sub = { err: String(err) }; } }
    out.sub = sub; out.back = G.mode;
    return out;
  });
  check('Un raro no se convierte en Némesis cuando mata al jugador (se ignora como asesino); otro enemigo corriente sí cuenta', I.nem === null && I.nemOther === true, JSON.stringify({ nem: I.nem, other: I.nemOther }));
  check('Entrar y salir de un subterráneo no rompe nada (los raros del mundo se descartan al cambiar de mapa)', !I.sub || (!I.sub.err && I.back === 'world'), JSON.stringify(I));

  await shot('fin');
  const logs = api.logs.filter((l) => /\[error\]|pageerror|raros\]/i.test(l) && !/Failed to load resource/.test(l));
  check('Sin errores nuevos en la consola', logs.length === 0, logs.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `${bad.length} FALLOS de ${results.length}` : `TODO OK (${results.length} comprobaciones)`);
}
