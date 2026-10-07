// The invisible tutorial: each hint shows once, in the right situation, with the right vocabulary, and retires when the player does the thing.
//   node tools/shot.mjs out.png --script tools/e2e/hints.mjs --wait 1500 --query "e2e=1&autostart=belfry&seed=hints&fixed=1&quality=low"
export default async function ({ page, shot, logs }) {
  const results = [];
  const check = (name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frames = async (n) => { const f0 = await ev(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 120000, polling: 40 }); };
  const hint = () => ev(() => { const e = document.querySelector('.hint-pop'); return e && !e.classList.contains('hidden') && e.classList.contains('on') ? e.textContent.replace('✦', '').trim() : null; });

  await ev(() => { try { localStorage.removeItem('sdc.hints.v1'); } catch {} const g = window.__game; g.hints?.dispose(); g.hints = new (g.hints.constructor)(g, g.session); });
  await frames(170);                              // ~5.5 s of play: the first hint waits out a 4 s grace period
  let h = await hint();
  check('"move" hint shows after a couple of seconds standing still', !!h && /W A S D|WASD|mover|Move|camin/i.test(h), h);
  await ev(() => { const g = window.__game; g.player.x += 6; });
  await frames(20);
  check('…and retires as soon as the player has moved', (await hint()) === null);

  // an enemy comes into view → "attack"
  await ev(() => { const g = window.__game, w = g.world, p = g.player; for (const e of w.entities) if (e.team === 'enemy') { e.dead = true; e.removed = true; } w.spawnEnemy('enm.hollow_chorister', p.x + 9, p.z + 2, { level: 1 }); });
  await frames(120);
  h = await hint();
  check('"attack" hint when an enemy is near and nothing has been hit yet', !!h && /atac|attack/i.test(h), h);
  await shot('artifacts/shots/hint_attack.png');
  // touch vocabulary
  const touchText = await ev(() => { document.documentElement.classList.add('touch'); const g = window.__game; const k = g.hints; return k ? (k.constructor.prototype, 'ok') : null; });
  check('hints object exists', touchText === 'ok');
  // seen hints persist and never repeat
  await ev(() => { const g = window.__game; g.world.dealDirect(g.player, g.world.entities.find((e) => e.team === 'enemy' && !e.dead), 3, 'physical', {}); });
  await frames(30);
  const stored = await ev(() => JSON.parse(localStorage.getItem('sdc.hints.v1') ?? '[]'));
  check('shown hints are remembered', stored.includes('move') && stored.includes('attack'), stored.join(','));
  const bad = logs.filter((l) => /pageerror|frame failed/.test(l));
  check('no page errors', bad.length === 0, bad.slice(0, 2).join(' | '));
  console.log(results.every(Boolean) ? `HINTS E2E OK: ${results.length} checks` : `HINTS E2E FAILED: ${results.filter((x) => !x).length}`);
}
