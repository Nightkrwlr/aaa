// frente «props, vegetación y decorado»: escenas de prueba comparables (misma semilla) + presupuesto de render.
// uso: SCENES=base,valle,ciudad,desierto,tundra,colmena ZOOM=20 NIGHT=1 \
//      node tools/shot.mjs --scenario tools/scenarios/props-scenes.mjs --out DIR --tag antes --seed 1 --size 960x540 --quality medium
// Cada escena se centra automáticamente en la zona de la región con más props «de carácter» (árboles, coches, cactus…):
// la mapa es determinista, así que antes y después miran exactamente el mismo rincón.
//   NIGHT=1 añade tomas nocturnas (farolas, charcos de luz, ventanas) de base y ciudad.
const FOCUS = {
  valle: { w: { oak: 3, pine: 3, bush: 1.5, rock: 1.5, rock_big: 3, grass: 0.15, flower: 0.3, log: 1, stump: 1 } },
  ciudad: { w: { car: 4, container: 4, lamp: 3, rubble: 2, hydrant: 2, tire: 1, barrel: 2, crate: 2, tank_wreck: 4, barrel_toxic: 2 } },
  desierto: { w: { cactus: 3, mesa: 4, rock_desert: 2.5, bones: 2, skull: 2, dry_grass: 0.15, dead_tree: 2 } },
  tundra: { w: { pine_snow: 3, boulder_snow: 3, ice_spike: 2, crystal_ice: 3, snow_tuft: 0.2 } },
  colmena: { w: { egg: 3, pod: 3, tendril: 3, xeno_spire: 4, mushroom: 3, vein: 0.5 } },
};

export default async function ({ boot, newGame, god, setTime, still, wait, ev, perf, teleport }) {
  const scenes = (process.env.SCENES || 'base,valle,ciudad,desierto,tundra,colmena').split(',');
  const zoom = Number(process.env.ZOOM || 20);
  const night = process.env.NIGHT === '1';
  await boot(); await newGame(); await god();
  await ev((z) => { window.__G.S.settings.zoom = z; window.__G.R.setZoom(z); }, zoom);
  const out = {};
  const go = async (key) => {
    if (key === 'base') { await ev(() => window.__G.world.loadWorld(null)); await wait(25); return; }
    const spot = await ev(([key, w]) => {
      const G = window.__G, m = G.map, De = window.__De, C = 5;
      const cells = new Map();
      for (const p of [...m.props, ...m.decor]) {
        const wt = w[p.t]; if (!wt) continue;
        if (De[m.regAt(p.x, p.z)]?.key !== key) continue;
        const k = Math.floor(p.x / C) + ',' + Math.floor(p.z / C);
        cells.set(k, (cells.get(k) || 0) + wt);
      }
      let best = null, bs = -1;
      for (const [k] of cells) {
        const [cx, cz] = k.split(',').map(Number); let s = 0;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) s += cells.get((cx + dx) + ',' + (cz + dz)) || 0;
        if (s > bs) { bs = s; best = { x: (cx + 0.5) * C, z: (cz + 0.5) * C, score: s }; }
      }
      return best;
    }, [key, FOCUS[key].w]);
    console.log('foco', key, JSON.stringify(spot));
    await teleport(spot.x, spot.z);
    await wait(20);
  };
  await setTime(0.3);
  for (const key of scenes) {
    await go(key);
    await still(`${key}`);
    out[key] = await perf();
  }
  if (night) {
    await setTime(0.82);
    for (const key of ['base', 'ciudad'].filter((k) => scenes.includes(k))) { await go(key); await wait(20); await still(`${key}-noche`); out[key + '-noche'] = await perf(); }
  }
  console.log('PERF ' + JSON.stringify(out));
}
