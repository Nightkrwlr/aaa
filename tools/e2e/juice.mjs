// Game-feel QA inside the real game: merged damage numbers, level-up pillar, loot drops of every rarity (beam + burst + toss), kill pop.
//   node tools/shot.mjs out.png --script tools/e2e/juice.mjs --wait 2500 --query "e2e=1&autostart=belfry&seed=juice&fixed=1&quality=high"
const OUT = process.env.SHOT_DIR ?? 'artifacts/shots';
export default async function ({ page, wait: _w, shot, logs }) {
  let wait = _w;
  const results = [];
  const check = (name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // frame-based waits: ?fixed=1 advances the game 1/30 s per frame, so sim time = frames / 30 however slow software GL is
  wait = async (ms) => { const n = Math.max(1, Math.round(ms / 33)); const f0 = await page.evaluate(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 120000, polling: 50 }); };

  await ev(() => {
    const g = window.__game, w = g.world, p = g.player;
    p.x = -24; p.z = 14; g.rig.initialised = false; g.rig.setZoom(20);
    p.stats.add('godmode', [{ stat: 'life', op: 'flat', value: 99999 }]); w.refreshLife(p, true);
    for (const e of w.entities) if (e.team === 'enemy') { e.dead = true; e.removed = true; }
    const e = w.spawnEnemy('enm.hollow_chorister', p.x + 3, p.z - 2, { level: 3 }); window.__target = e.uid; e.hp = e.hpMax = 5000;
  });
  await wait(600);

  // ── 1. six quick hits on one target → one growing number, not six
  const merged = await ev(() => {
    const g = window.__game, w = g.world, p = g.player, e = w.entities.find((x) => x.uid === window.__target);
    for (let i = 0; i < 6; i++) w.dealDirect(p, e, 40 + i, 'physical', {});
    const mine = g.vfx.numbers.filter((n) => n.kind === 'hit' && n.sum > 0);
    return { count: mine.length, text: mine[0]?.text, sum: mine[0]?.sum };
  });
  check('six rapid hits merge into one floating number', merged.count === 1 && merged.sum > 150, JSON.stringify(merged));
  // a crit never merges
  const crit = await ev(() => { const g = window.__game, w = g.world, p = g.player, e = w.entities.find((x) => x.uid === window.__target); w.events.emit('damage', { source: p, target: e, amount: 300, life: 300, absorbed: 0, type: 'physical', crit: true, dot: false, killed: false }); return g.vfx.numbers.filter((n) => n.crit).length; });
  check('a crit gets its own bigger number', crit === 1, `${crit} crit number(s)`);
  await wait(120); await shot(`${OUT}/juice_1_numbers.png`);

  // ── 2. cap: a hundred hits across many targets never exceed the number cap
  const capped = await ev(() => { const g = window.__game, w = g.world, p = g.player; for (let i = 0; i < 80; i++) { const e = w.spawnEnemy('enm.hollow_chorister', p.x + 8 + (i % 9), p.z + (i % 7) - 3, { level: 1 }); w.dealDirect(p, e, 5 + i, 'physical', {}); } return g.vfx.numbers.length; });
  check('floating numbers are capped', capped <= 28, `${capped}`);

  // ── 3. loot of every rarity on the ground, side by side
  await ev(() => {
    const g = window.__game, s = g.session, p = g.player;
    for (const e of g.world.entities) if (e.team === 'enemy') { e.dead = true; e.removed = true; }
    const rar = ['common', 'fine', 'attuned', 'relic'];
    rar.forEach((r, i) => { const it = s.factory.roll(s.rng.fork(`j${i}`), { ilvl: 3, rarity: r, slot: ['weapon', 'chest', 'neck', 'head'][i], classId: s.character.classId, noUnique: true }); s.loot.spawn(p.x + 1.5 + i * 2.2, p.z - 1, [{ type: 'item', item: it }]); });
    s.loot.spawn(p.x - 1.5, p.z - 1, [{ type: 'chimes', amount: 40 }, { type: 'material', id: s.registry.all('material')[0]?.id ?? 'mat.bronze_shard', amount: 2 }]);
  });
  await wait(200); await shot(`${OUT}/juice_2_loot_toss.png`);
  await wait(800); await shot(`${OUT}/juice_3_loot_settled.png`);
  const rars = await ev(() => window.__game.session.loot.ground.filter((g) => g.kind === 'item').map((g) => g.item.rarity));
  check('Fine, Attuned and Relic drops are on the ground (commons are hidden by the default loot filter)', ['fine', 'attuned', 'relic'].every((r) => rars.includes(r)), rars.join(','));

  // ── 4. level up: pillar + rings
  const lv = await ev(() => { const g = window.__game, s = g.session; s.character.grantXp(g.world, g.player, 999999); return { pillars: g.vfx.pillars.length, level: s.character.level }; });
  check('level-up spawns the light pillar', lv.pillars >= 1 && lv.level > 1, JSON.stringify(lv));
  await wait(300); await shot(`${OUT}/juice_4_levelup.png`);
  await wait(1800);
  check('the pillar cleans itself up', await ev(() => window.__game.vfx.pillars.length === 0));

  const bad = logs.filter((l) => /pageerror|frame failed/.test(l));
  check('no page errors', bad.length === 0, bad.slice(0, 2).join(' | '));
  const failed = results.filter((x) => !x).length;
  console.log(failed ? `JUICE E2E FAILED: ${failed}` : `JUICE E2E OK: ${results.length} checks`);
}
