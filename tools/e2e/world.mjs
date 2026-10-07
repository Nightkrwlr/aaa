// Art-director tour of the overworld: teleports the (invulnerable) hero to every landmark and shoots it, with
// close-up / far zoom, time-of-day (dawn, dusk, night) and weather (mist, rain) variants, plus a clean "hero shot".
//
// usage (software GL is slow: always ?fixed=1, frame-based waits):
//   node tools/shot.mjs artifacts/shots/world_last.png --script tools/e2e/world.mjs --wait 2500 \
//        --query "e2e=1&autostart=belfry&seed=world&fixed=1&quality=high"
// env:  SHOT_DIR=artifacts/shots   SHOTS=settlement,quarry (subset, comma separated)   HUD=1 (keep the HUD)   ENEMIES=1 (keep enemies)
const OUT = process.env.SHOT_DIR ?? 'artifacts/shots';
const ONLY = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
const HUD = process.env.HUD === '1', ENEMIES = process.env.ENEMIES === '1';
const FRAMES = Number(process.env.FRAMES ?? 3);

// name, hero position, zoom, atmosphere, weather, camera yaw/pitch overrides (deg), settle frames
const SHOTS = [
  { name: 'start', x: -58, z: 48, zoom: 32 },
  { name: 'settlement', x: 0, z: -24, zoom: 30 },
  { name: 'settlement_close', x: -3, z: -33, zoom: 16 },
  { name: 'settlement_far', x: 0, z: -30, zoom: 38 },
  { name: 'forge', x: -8, z: -31, zoom: 20 },
  { name: 'quarry', x: 40, z: -2, zoom: 30 },
  { name: 'quarry_pit', x: 48, z: 10, zoom: 28 },
  { name: 'windharps', x: -42, z: -34, zoom: 30 },
  { name: 'overlook', x: 40, z: -56, zoom: 30 },
  { name: 'choir', x: 3, z: 46, zoom: 30 },
  { name: 'choir_gate', x: 1, z: 36, zoom: 26 },
  { name: 'forest_edge', x: -40, z: 26, zoom: 30 },
  { name: 'path', x: -26, z: 14, zoom: 30 },
  { name: 'dusk_settlement', x: 0, z: -26, zoom: 28, tod: 'dusk' },
  { name: 'night_settlement', x: 0, z: -26, zoom: 28, tod: 'night' },
  { name: 'mist_choir', x: 3, z: 46, zoom: 30, tod: 'mist', weather: 'mist' },
  { name: 'rain_path', x: -28, z: 16, zoom: 30, tod: 'rain', weather: 'rain' },
  { name: 'hero', x: -6, z: -29, zoom: 24, tod: 'dawn', yaw: 38, pitch: 33, hideHero: false, hud: false },
];

export default async function ({ page, wait: wallWait, shot, logs }) {
  page.setDefaultTimeout(240000);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frames = async (n) => { const f0 = await ev(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 240000, polling: 100 }); };
  await ev(() => window.__THREE && 0);
  // wait for the world's async assets (kit models) if the build exposes them
  await page.waitForFunction(() => { const s = window.__game?.scene3d; return !s?.worldReady || s.worldReady === true || s.worldReady?.done; }, null, { timeout: 120000, polling: 250 }).catch(() => {});
  await ev(([hud, enemies]) => {
    const g = window.__game;
    g.player.stats.add('godmode', [{ stat: 'life', op: 'flat', value: 99999 }]); g.world.refreshLife(g.player, true);
    if (!hud) { document.getElementById('ui').style.display = 'none'; document.getElementById('overlay').style.display = 'none'; }
    if (!enemies) for (const e of g.world.entities) if (e.team === 'enemy') { e.x += 4000; e.hidden = true; }
  }, [HUD, ENEMIES]);
  const base = await ev(() => ({ yaw: window.__game.rig.yaw, pitch: window.__game.rig.pitch }));
  for (const s of SHOTS) {
    if (ONLY && !ONLY.includes(s.name)) continue;
    await ev(([s, base]) => {
      const g = window.__game, p = g.player;
      p.x = s.x; p.z = s.z; p.invuln = 99999; p.cmd.moveTo = null; p.cmd.moveDir = null;
      g.rig.yaw = s.yaw !== undefined ? s.yaw * Math.PI / 180 : base.yaw; g.rig.pitch = s.pitch !== undefined ? s.pitch * Math.PI / 180 : base.pitch;
      g.rig.zoomMin = 8; g.rig.zoomTarget = g.rig.zoom = s.zoom; g.rig.initialised = false;
      g.scene3d.setAtmosphere(s.tod ?? 'dawn');
      if (g.weatherFx) g.weatherFx.force = s.weather ?? null;
    }, [s, base]);
    await frames(FRAMES);
    const file = `${OUT}/world_${s.name}.png`;
    await shot(file);
    const info = await ev(() => { const g = window.__game, i = g.scene3d.renderer.info; return { fps: +g.fps.toFixed(1), calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, progs: i.programs?.length }; });
    console.log(`SHOT ${s.name.padEnd(18)} calls=${info.calls} tris=${info.tris} geos=${info.geos} tex=${info.tex} programs=${info.progs}`);
  }
}
