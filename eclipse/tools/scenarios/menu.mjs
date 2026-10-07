// menú principal y pantalla de nueva partida (comprueba el emblema, el título y que los botones caben)
export default async function ({ boot, shot, page, wait }) {
  await boot(); await wait(30);
  await shot('menu');
  await page.click('text=Nueva partida'); await wait(8);
  await shot('nueva');
}
