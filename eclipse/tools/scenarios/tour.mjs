// recorrido: la base y cada región de día (sin HUD, simulación congelada) + una noche en el valle
export default async function ({ boot, newGame, god, region, setTime, still, wait, ev }) {
  await boot(); await newGame(); await god();
  await setTime(0.3);
  await still('base-day', { ui: true });
  const keys = await ev(() => window.__De.map((r) => r.key));
  console.log('regions:', keys.join(','));
  for (const key of keys) { await region(key); await wait(20); await still(`reg-${key}`); }
  await region('valle'); await setTime(0.8); await wait(30); await still('valle-night');
}
