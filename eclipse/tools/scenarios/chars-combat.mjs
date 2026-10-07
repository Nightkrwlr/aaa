// frente «personajes, enemigos, botín y efectos de combate»: escenas comparables (misma semilla).
// uso: SCENES=base,combate-dia,combate-noche,elite,botin,fx-rifle,fx-escopeta,fx-sniper,fx-granada,fx-cohete,fx-explosion,fx-zap \
//      node tools/shot.mjs --html dist/pre.html --scenario tools/scenarios/chars-combat.mjs --out DIR --tag antes --seed 1 --size 960x540 --quality medium
// ZOOM (por defecto 12) acerca la cámara para juzgar personajes. Todas las tomas son estáticas: se simula con __step y se congela
// en la misma llamada, así antes y después miran exactamente el mismo fotograma.
export default async function ({ boot, newGame, god, region, setTime, hideUi, wait, ev, shot, perf, teleport }) {
  const scenes = (process.env.SCENES || 'base,combate-dia,combate-noche,elite,botin,fx-rifle,fx-escopeta,fx-sniper,fx-granada,fx-cohete,fx-explosion,fx-zap').split(',');
  const zoom = Number(process.env.ZOOM || 12);
  const out = {};
  await boot(); await newGame(); await god();
  await ev((z) => { window.__G.S.settings.zoom = z; window.__G.R.setZoom(z); }, zoom);

  /** simula n pasos y congela en la misma evaluación; luego captura */
  const frame = async (name, steps, dt = 1 / 30) => {
    await hideUi(true);
    await ev(([n, dt]) => { const G = window.__G; G.paused = false; window.__step(n, dt); G.paused = true; }, [steps, dt]);
    await wait(4);
    await shot(name);
    out[name] = await perf();
    await ev(() => { window.__G.paused = false; });
    await hideUi(false);
  };
  /** congela la ventana de dibujo SIN pausar la simulación (las pausas borran trazadores y estelas, que se redibujan cada fotograma):
   *  tras `frames` fotogramas reales se retiene requestAnimationFrame; el último fotograma ya programado se dibuja y se captura. */
  const hold = async (name, frames) => {
    await hideUi(true);
    await wait(frames);
    await ev(() => { const raf = window.requestAnimationFrame.bind(window); window.__raf0 = raf; window.__rq = []; window.requestAnimationFrame = (f) => { window.__rq.push(f); return 0; }; });
    for (let i = 0; i < 80; i++) { if (await ev(() => window.__rq.length > 0)) break; await new Promise((r) => setTimeout(r, 100)); }
    await shot(name);
    await ev(() => { window.requestAnimationFrame = window.__raf0; for (const f of window.__rq.splice(0)) window.__raf0(f); });
    await hideUi(false);
  };
  const clear = () => ev(() => { const G = window.__G; for (const e of G.enemies) { e.hp = 0; e.dead = true; e.deadT = 0; } G.projs.length = 0; G.pickups.length = 0; G.fx.clear?.(); });
  const ring = (kinds, r0 = 4.5, opts = {}) => ev(([kinds, r0, opts]) => {
    const p = window.__G.player;
    kinds.forEach((k, i) => { const a = -0.6 + (i / Math.max(1, kinds.length - 1)) * 3.4 + 0.4, r = r0 + (i % 3) * 1.2; window.__spawn(k, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 3, { alerted: true, ...opts }); });
  }, [kinds, r0, opts]);
  const MIX = ['rastrero', 'acorazado', 'avispa', 'mantis', 'escupidor', 'bruto', 'dron', 'golem'];

  for (const sc of scenes) {
    await clear();
    if (sc === 'base') {
      await setTime(0.3);
      await ev(() => window.__G.world.loadWorld(null)); await wait(25);
      await ev(() => window.__step(30, 1 / 30));
      await frame('base', 6);
    } else if (sc === 'combate-dia' || sc === 'combate-noche') {
      await setTime(sc === 'combate-dia' ? 0.3 : 0.8);
      await region('valle'); await god(); await wait(10);
      await ring(MIX);
      await frame(sc, 55);
    } else if (sc === 'elite') {
      await setTime(0.3);
      await region('valle'); await god(); await wait(10);
      await ev(() => { const p = window.__G.player; window.__spawn('bruto', p.x + 4, p.z - 1.5, 6, { alerted: true, mods: ['igneo'] }); window.__spawn('mantis', p.x + 3, p.z + 2.5, 6, { alerted: true, mods: ['gelido'] }); window.__spawn('acorazado', p.x - 4, p.z + 3, 6, { alerted: true, mods: ['escudado'] }); window.__spawn('rastrero', p.x + 6, p.z + 0.5, 4, { alerted: true, mods: ['veloz', 'explosivo'] }); });
      await frame('elite', 25);
    } else if (sc === 'botin') {
      await setTime(0.3);
      await region('valle'); await god(); await wait(10);
      await ev(() => {
        const G = window.__G, p = G.player, L = window.__loot;
        for (let r = 0; r < 6; r++) {
          const it = L.us(10, { minR: r, maxR: r, luck: 0 });
          L.Nt('item', p.x - 5 + r * 1.7, p.z + 2.2, { item: it, life: 300, spd: 0.01 });
        }
        for (let t = 1; t <= 4; t++) L.Nt('chip', p.x - 4 + t * 1.7, p.z - 1.5, { chip: L.xi(10, { minT: t }), life: 300, spd: 0.01 });
        for (const m of ['scrap', 'bio', 'crystal', 'core']) L.Nt('mat', p.x - 3 + Math.random() * 6, p.z + 4.5, { mat: m, val: 2, spd: 0.01 });
        for (let i = 0; i < 4; i++) L.Nt('xp', p.x - 2 + i, p.z + 5.5, { val: 5 + i * 20, spd: 0.01 });
      });
      await frame('botin', 40);
    } else if (sc.startsWith('fx-')) {
      await setTime(sc === 'fx-explosion' ? 0.8 : 0.3);
      await region('valle'); await god(); await wait(10);
      await ev(() => { window.__G.player.hp = window.__G.player.maxHp; });
      await ring(['rastrero', 'rastrero', 'acorazado', 'mantis', 'bruto'], 7.5);
      const kind = sc.slice(3);
      await ev((kind) => {
        const G = window.__G, p = G.player, a = p.face, sx = p.x + Math.sin(a) * 0.3, sz = p.z + Math.cos(a) * 0.3;
        const bullet = (ang, col, w, len, speed, life) => G.projs.push({ owner: 'p', kind: 'bullet', x: sx, y: 1.05, z: sz, vx: Math.sin(ang) * speed, vz: Math.cos(ang) * speed, dmg: 1, life, pierce: 0, rico: 0, hit: new Set(), color: col, w, len });
        if (kind === 'rifle') { for (let i = 0; i < 4; i++) bullet(a + (i - 1.5) * 0.015, 16771496, 0.055, 0.9, 40, 0.5); G.fx.muzzle(sx, 1.05, sz, a, 16771496, 1); }
        else if (kind === 'escopeta') { for (let i = 0; i < 8; i++) bullet(a + (i - 3.5) * 0.07, 16764000, 0.05, 0.7, 34, 0.35 + (i % 3) * 0.05); G.fx.muzzle(sx, 1.05, sz, a, 16764000, 1.6); }
        else if (kind === 'sniper') { bullet(a, 11856895, 0.08, 1.6, 70, 0.6); G.fx.muzzle(sx, 1.05, sz, a, 11856895, 2); G.R.addShake(0.15); }
        else if (kind === 'granada') { G.projs.push({ owner: 'p', kind: 'grenade', x: sx, y: 1.05, z: sz, sx, sz, tx: sx + Math.sin(a) * 6, tz: sz + Math.cos(a) * 6, t: 0, dur: 0.6, dmg: 20, aoe: 2.5, color: 3820084, life: 3 }); G.fx.muzzle(sx, 1.05, sz, a, 16760944, 1.2); }
        else if (kind === 'cohete') { G.projs.push({ owner: 'p', kind: 'rocket', x: sx, y: 1.05, z: sz, vx: Math.sin(a) * 17, vz: Math.cos(a) * 17, dmg: 30, life: 0.9, pierce: 0, hit: new Set(), aoe: 2.6, color: 16755028, homing: false, turn: 1.5, t: 0, size: 0.12 }); G.fx.muzzle(sx, 1.05, sz, a, 16755028, 1.3); }
        else if (kind === 'explosion') { G.fx.explosion(sx + Math.sin(a) * 5, sz + Math.cos(a) * 5, 2.6, 16747040); }
        else if (kind === 'zap') { G.fx.zap(sx, sz, sx + Math.sin(a) * 4.5, sz + Math.cos(a) * 4.5, 9426175, 1.2); G.fx.zap(sx + Math.sin(a) * 4.5, sz + Math.cos(a) * 4.5, sx + Math.sin(a + 0.5) * 7, sz + Math.cos(a + 0.5) * 7, 9426175, 1.2); }
      }, kind);
      const framesBy = { rifle: 2, escopeta: 2, sniper: 2, granada: 5, cohete: 7, explosion: 2, zap: 1 };
      await hold(sc, framesBy[kind] ?? 2);
      if (kind === 'cohete' || kind === 'granada') { await wait(kind === 'cohete' ? 12 : 6); await hold(sc + '-boom', 1); }
    }
  }
  console.log('PERF ' + JSON.stringify(out));
}
