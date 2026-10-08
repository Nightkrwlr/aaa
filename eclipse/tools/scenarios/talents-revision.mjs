// Reparos de revisión del árbol de talentos: enfriamiento de Último aliento persistente y cierre del panel al morir.
//   node tools/build.mjs && node tools/shot.mjs --scenario tools/scenarios/talents-revision.mjs --size 640x360 --out DIR
export default async function (api) {
  const { boot, newGame, ev } = api;
  await boot(); await newGame();
  const r = await ev(() => {
    const G = window.__G, S = G.S, p = G.player, T = window.__talents, out = {};
    S.lvl = 30; p.recalc();
    T.setBuild({ t_bas_kc: 1 }); p.recalc();
    out.hasPower = p.powers.has('lastBreath');
    S.playTime = 1000;
    p.hp = 1; p.die(); // primera muerte: Último aliento la evita
    out.survived1 = !p.dead; out.lbSet = S.talentLb;
    // el enfriamiento viaja en el guardado: se serializa y se lee de vuelta
    const copy = JSON.parse(JSON.stringify(S));
    out.persisted = copy.talentLb === S.talentLb;
    // «recargar»: el estado en memoria ya no existe, solo S (con playTime guardado) -> sigue en enfriamiento
    S.playTime += 60; p.hp = 1; p.die();
    out.deadDuringCd = !!p.dead;
    // pasado el enfriamiento vuelve a funcionar
    p.dead = false; p.hp = 1; S.playTime = out.lbSet + 1; p.die();
    out.survivedAfterCd = !p.dead;
    // muerte real con el panel abierto: se cierra
    p.dead = false; p.hp = 1; T.setBuild({}); p.recalc();
    T.open(); out.openBefore = G.uiOpen;
    p.hp = 0; p.die();
    out.dead = !!p.dead; out.uiAfter = G.uiOpen;
    p.dead = false; p.hp = p.maxHp; G.uiOpen = null; G.paused = false;
    return out;
  });
  console.log(JSON.stringify(r));
  const ok = r.hasPower && r.survived1 && r.persisted && r.deadDuringCd && r.survivedAfterCd && r.openBefore === 'talents' && r.dead && r.uiAfter !== 'talents';
  console.log(ok ? 'TODO OK' : 'FALLO');
  const errs = api.logs.filter((l) => /pageerror/.test(l));
  console.log(errs.length ? 'ERRORES: ' + errs.join('\n') : 'sin errores de página');
}
