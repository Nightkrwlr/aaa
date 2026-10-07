import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSession, tick } from './helpers/session.js';

const FAMILIES = ['dfm.serrane_crypt', 'dfm.crystal_cavern', 'dfm.broken_facility'];

/** the picture and the walkable map must agree: solid props block movement, and they never wall off anything that matters */
test('solid props are obstacles that never cut the way to anything important', () => {
  let blockedProps = 0, checked = 0;
  for (const family of FAMILIES) for (const seed of ['nav-a', 'nav-b', 'nav-c', 'nav-d']) {
    const s = makeSession({ seed: `nav:${family}:${seed}`, level: 8 });
    const r = s.openRift({ family, size: 'medium', seed });
    assert.ok(r.ok, `${family}/${seed}: ${JSON.stringify(r.errors)}`);
    const rt = s.dungeon, d = rt.d, c = d.content, nav = rt.nav;
    for (const p of c.props) if (p.block) { blockedProps++; assert.ok(!nav.isWalkable(p.x, p.z), `${p.kind} at ${p.x},${p.z} should block the walkable map`); }
    // open every door the way the player eventually would, then check every point of interest is reachable from the entrance
    for (const door of rt.doors) if (!door.open) rt.openDoor(door.id);
    const from = nav.nearestWalkable(c.entrance.x, c.entrance.z, 6);
    const targets = [c.boss, c.exit, ...c.chests, ...c.shrines, ...c.puzzles, ...c.lore, ...c.objects].filter((t) => t && Number.isFinite(t.x));
    for (const t of targets) {
      const to = nav.nearestWalkable(t.x, t.z, 6); if (!to) continue;
      const path = nav.findPath(from.x, from.z, to.x, to.z);
      assert.ok(path && path.length, `${family}/${seed}: nothing reaches (${t.x}, ${t.z})`); checked++;
    }
    tick(s, 0.2);                                                   // the world still steps with the new obstacles
  }
  assert.ok(blockedProps > 0, 'the sample should contain solid props');
  assert.ok(checked > 40, `only ${checked} destinations were checked`);
});
