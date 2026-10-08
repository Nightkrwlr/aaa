// Lore (D5): capturas de cerca de cada forma de nodo (estantería, libro suelto, equipo de radio, caído) de día y de noche, para
// juzgar el aspecto con ojos críticos. Pocas capturas (8) con el zoom de cámara acercado.
//   node tools/shot.mjs --scenario tools/scenarios/lore-escenas.mjs --size 800x450 --out DIR --tag esc
export default async function (api) {
  const { boot, newGame, ev, wait, shot, setTime } = api;
  await boot(); await newGame(); await api.god(true);
  await ev(() => { window.__G.R.setZoom(13); });
  const forms = await ev(() => {
    const L = window.__lore, out = {};
    for (const n of L.nodes()) if (!out[n.form]) out[n.form] = n.lid;
    // un libro suelto a mano si el reparto no ha dado ninguno: se reubica una estantería como libro
    return out;
  });
  console.log('formas', JSON.stringify(forms));
  const go = async (id) => {
    await ev((id) => {
      const G = window.__G, n = window.__lore.nodes().find((e) => e.lid === id), m = G.map;
      let at = [n.x + 2, n.z + 2];
      outer: for (const r of [2.2, 2.8, 3.4]) for (let k = 0; k < 16; k++) { const a = n.ang + k * 0.393, px = n.x + Math.sin(a) * r, pz = n.z + Math.cos(a) * r; if (!m.circleHits(px, pz, G.player.r) && m.los(px, pz, n.x, n.z)) { at = [px, pz]; break outer; } }
      G.world.loadWorld({ x: at[0], z: at[1] });
      for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - G.player.x, e.z - G.player.z) < 25) { e.dead = true; e.deadT = 0; }
      window.__step(20, 1 / 30);
    }, id);
    await wait(14);
  };
  for (const [form, id] of Object.entries(forms)) {
    await go(id);
    await setTime(0.35); await shot(`${form}-dia`);
    await setTime(0.8); await wait(10); await shot(`${form}-noche`);
  }
}
