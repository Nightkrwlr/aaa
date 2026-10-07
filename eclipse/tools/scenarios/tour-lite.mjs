// recorrido corto para iterar: base (con HUD), valle, ciudad, desierto de día y el valle de noche
export default async function ({ boot, newGame, god, region, setTime, still, wait }) {
  await boot(); await newGame(); await god();
  await setTime(0.3);
  await still('base-day', { ui: true });
  for (const key of ['valle', 'ciudad', 'desierto']) { await region(key); await wait(20); await still(`reg-${key}`); }
  await region('valle'); await setTime(0.8); await wait(30); await still('valle-night');
}
