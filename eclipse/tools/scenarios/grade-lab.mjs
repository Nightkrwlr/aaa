// laboratorio de grade: prueba variantes del look EN VIVO (sin recompilar) sobre las mismas escenas congeladas.
// uso: LAB='[{"name":"a","look":{"sat":1.05,"contrast":1.14},"tone":0.75}]' SCENES=valle,ciudad node tools/shot.mjs --scenario tools/scenarios/grade-lab.mjs --size 800x450 --out … --tag lab
//   look → campos de x.R.look/lookTgt (sat, contrast, exposure, lift, vig, density, falloff, shadow[3], high[3], bloom[3])
//   tone → uTone (0 = Neutral, 1 = ACES)      fog → { density, falloff }   (atajos para x.R.scene.fog)
export default async function ({ boot, newGame, god, region, setTime, still, wait, ev }) {
  const variants = JSON.parse(process.env.LAB || '[{"name":"actual"}]');
  const scenes = (process.env.SCENES || 'valle').split(',');
  await boot(); await newGame(); await god(); await setTime(0.3);
  for (const key of scenes) {
    if (key === 'base') { await ev(() => window.__G.world.loadWorld(null)); } else { await region(key); }
    await wait(25);
    for (const v of variants) {
      await ev((v) => {
        const R = window.__G.R;
        const set = (o) => { for (const [k, val] of Object.entries(v.look || {})) o[k] = Array.isArray(val) ? [...val] : val; };
        set(R.look); set(R.lookTgt);
        if (v.tone !== undefined) R.post.uniforms.uTone.value = v.tone;
        if (v.ca !== undefined) R.post.uniforms.uCA.value = v.ca;
        if (v.grain !== undefined) R.post.uniforms.uGrain.value = v.grain;
      }, v);
      await wait(6);
      await still(`${key}-${v.name}`, { settle: 4 });
    }
  }
}
