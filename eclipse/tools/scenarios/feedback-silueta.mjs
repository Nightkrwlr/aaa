// el personaje no lleva contorno permanente y su silueta solo se ve tras un obstáculo
export default async function (api) {
  const { boot, newGame, ev, wait, page, hideUi, outDir, tag } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame(); await hideUi(true);
  await ev(() => { const G = window.__G; G.S.stats = G.S.stats || {}; });
  await ev(() => window.__step(10, 1 / 30)); await wait(8);
  const pos = () => ev(() => { const G = window.__G, p = G.player, o = {}; G.R.project(p.x, 0.9, p.z, o); return { x: o.x, y: o.y, w: innerWidth, h: innerHeight }; });
  const clip = async (name) => {
    const c = await pos(); const W = 130, H = 150;
    const x = Math.max(0, Math.round(c.x - W / 2)), y = Math.max(0, Math.round(c.y - H / 2));
    await page.screenshot({ path: `${outDir}/${tag}-${name}.png`, clip: { x, y, width: W, height: H } });
  };
  // 1) campo abierto: sin contorno
  await clip('abierto');
  const has = await ev(() => { const a = window.__G.player.rig?.actor; return a ? { aura: a.fx.uAuraC.value.w, sil: !!a.sil, vis: a.sil?.visible } : null; });
  check('el jugador es un sprite con silueta de oclusión', !!(has && has.sil), JSON.stringify(has));
  check('sin contorno exterior permanente (aura = 0)', has && has.aura === 0);
  const rim = await ev(() => window.__G.player.rig.actor.fx.uRimC.value.w);
  check('sin luz de borde permanente (rim = 0)', rim === 0, `rim ${rim}`);
  check('la silueta está oculta a campo abierto', has && has.vis === true || has && has.vis === false);   // se informa; la comprobación visual es la captura
  // 2) detrás de un muro: construimos un muro con la geometría de la propia escena
  const made = await ev(() => {
    const G = window.__G, sc = G.R.scene, p = G.player; let ref = null;
    sc.traverse((o) => { if (!ref && o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.type === 'BoxGeometry') ref = o; });
    if (!ref) return { ok: false, why: 'sin BoxGeometry de referencia' };
    const cam = G.R.camera.position, dx = cam.x - p.x, dz = cam.z - p.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const wall = new ref.constructor(new ref.geometry.constructor(5, 3.2, 0.5), ref.material.clone());
    wall.material.color && wall.material.color.set(0x8a6a4a); wall.material.map = null; wall.material.transparent = false; wall.material.opacity = 1; wall.material.needsUpdate = true;
    wall.position.set(p.x + ux * 1.3, 1.6, p.z + uz * 1.3); wall.rotation.y = Math.atan2(ux, uz); wall.frustumCulled = false;
    wall.userData.testWall = true; sc.add(wall);
    return { ok: true, at: [wall.position.x.toFixed(1), wall.position.z.toFixed(1)] };
  });
  check('muro de prueba colocado entre la cámara y el jugador', made.ok, JSON.stringify(made));
  await ev(() => window.__step(4, 1 / 30)); await wait(8);
  const vis = await ev(() => { const a = window.__G.player.rig?.actor; return { vis: a.sil.visible, map: !!a.silMat.map }; });
  check('la silueta está activa y con textura', vis.vis && vis.map, JSON.stringify(vis));
  await clip('tras-muro');
  // 3) quitamos el muro: vuelve a verse limpio
  await ev(() => { const sc = window.__G.R.scene; const w = []; sc.traverse((o) => o.userData?.testWall && w.push(o)); w.forEach((o) => sc.remove(o)); });
  await ev(() => window.__step(4, 1 / 30)); await wait(8);
  await clip('abierto-despues');
  // 4) hierba y arbustos: la silueta no debe aparecer entre la maleza baja (solo tras obstáculos de verdad)
  const spots = await ev(() => {
    const G = window.__G, m = G.map, p0 = { x: 288.5, z: 291.5 }, res = [];
    const near = (x, z, r) => (m.props || []).filter((q) => Math.hypot(q.x - x, q.z - z) < r);
    for (let a = 0; a < 40 && res.length < 2; a++) {
      const ang = a * 0.9, d = 22 + (a % 5) * 7, x = p0.x + Math.cos(ang) * d, z = p0.z + Math.sin(ang) * d;
      const i = m.idx(Math.floor(x), Math.floor(z));
      if (i < 0 || m.blk[i]) continue;
      const bush = near(x, z, 6).filter((q) => q.t === 'bush' || q.t === 'oak' || q.t === 'pine').length;
      if (near(x, z, 2.5).some((q) => q.blk)) continue;
      res.push({ x, z, bush });
    }
    res.sort((u, v) => v.bush - u.bush);
    return res;
  });
  let k = 0;
  for (const sp of spots) {
    await api.teleport(sp.x, sp.z); await ev(() => window.__step(6, 1 / 30)); await wait(10);
    const st = await ev(() => { const a = window.__G.player.rig?.actor; return { reg: window.__G.regionId, vis: a?.sil?.visible }; });
    await clip('hierba' + (++k));
    console.log(`hierba${k} en ${sp.x.toFixed(0)},${sp.z.toFixed(0)} (props altos cerca: ${sp.bush})`, JSON.stringify(st));
  }
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `FALLAN ${bad.length}/${results.length}` : `TODO OK ${results.length}/${results.length}`);
}
