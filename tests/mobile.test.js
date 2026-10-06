import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterLayout, overlaps, metrics } from '../src/client/mobile/layout.js';

const SCREENS = [
  ['iPhone SE landscape', 667, 375], ['iPhone 14 landscape', 844, 390], ['Pixel 7 landscape', 915, 412], ['tiny Android landscape', 640, 300],
  ['browser-chrome landscape', 740, 340], ['iPad landscape', 1080, 810], ['iPhone 14 portrait', 390, 844], ['Pixel 7 portrait', 412, 915], ['iPhone SE portrait', 375, 667],
];
const ALL = ['dodge', 's1', 's2', 's3', 's4', 's5', 's6', 'potion', 'listen', 'voice'];

for (const [name, W, H] of SCREENS) {
  test(`touch cluster layout: ${name} (${W}×${H}) — no overlaps, inside the screen, thumb reachable`, () => {
    for (const leftHanded of [false, true]) {
      const insets = { top: 0, right: 20, bottom: 12, left: 20 };
      const L = clusterLayout({ W, H, insets, ids: ALL, leftHanded });
      assert.deepEqual(overlaps(L.buttons, 2), [], `overlapping buttons: ${JSON.stringify(overlaps(L.buttons, 2))}`);
      for (const [id, b] of Object.entries(L.buttons)) {
        assert.ok(b.x - b.r >= -0.5 && b.x + b.r <= W + 0.5 && b.y - b.r >= -0.5 && b.y + b.r <= H + 0.5, `${id} leaves the screen`);
      }
      // attack sits in the right (or left) bottom corner
      const a = L.buttons.attack;
      assert.ok(leftHanded ? a.x < W / 2 : a.x > W / 2, 'attack button on the thumb side');
      assert.ok(a.y > H / 2, 'attack button in the lower half');
      // every button within a thumb's reach of the attack button
      const reach = L.m.attack + L.m.skill * 5;
      for (const [id, b] of Object.entries(L.buttons)) assert.ok(Math.hypot(b.x - a.x, b.y - a.y) <= reach, `${id} out of reach`);
      // touch targets: primary actions never below 40 css px
      for (const id of ['attack', 'dodge', 's1', 's2', 's3']) assert.ok(L.buttons[id].r * 2 >= 40, `${id} too small (${L.buttons[id].r * 2}px)`);
    }
  });
}

test('metrics scale with the short side and the user setting', () => {
  const a = metrics(844, 390, 1), b = metrics(844, 390, 1.2), c = metrics(640, 300, 1);
  assert.ok(b.attack > a.attack && c.attack < a.attack);
  assert.ok(c.skill >= 40, 'small screens keep skill buttons tappable');
});

test('fewer unlocked skills still produce a clean layout', () => {
  const L = clusterLayout({ W: 844, H: 390, ids: ['dodge', 's1', 's2'] });
  assert.deepEqual(overlaps(L.buttons, 2), []);
  assert.equal(Object.keys(L.buttons).length, 4);
});
