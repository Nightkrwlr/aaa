// frente «clima»: operaciones (interiores) con la «mirada» y el clima de su tema. Abre el panel de despliegue de la base y entra en las
// operaciones propuestas (los temas salen de la semilla: usa --seed 1 para repetir). Imprime el tema de cada una.
// uso: node tools/shot.mjs --scenario tools/scenarios/clima-ops.mjs --tag ops --seed 1 --size 960x540   (N=3 operaciones; SETTLE fotogramas)
export default async function ({ boot, newGame, god, region, setTime, still, wait, ev, hideUi }) {
  const n = +(process.env.N || 3), settle = +(process.env.SETTLE || 30);
  await boot(); await newGame(); await god();
  await setTime(0.3); await region('valle');
  for (let i = 0; i < n; i++) {
    await ev((k) => {
      const G = window.__G;
      if (G.mode === 'op') { G.world.returnPos && G.world.loadWorld(G.world.returnPos); }
      window.__dbg.openDeploy({ reroll: k === 0 });
      document.querySelectorAll('[data-go]')[k % 3]?.click();
    }, i);
    await wait(settle);
    const info = await ev(() => { const G = window.__G; return { mode: G.mode, theme: G.map && G.map.theme, outdoor: !!(G.map && G.map.themeObj && G.map.themeObj.outdoor), wx: G.R.wx && G.R.wx.tgt }; });
    console.log('op', i, JSON.stringify(info));
    await still('op' + i);
  }
}
