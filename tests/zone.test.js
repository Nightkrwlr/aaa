import test from 'node:test';
import assert from 'node:assert/strict';
import { reg } from './helpers/sim.js';
import { buildZone, validateZone } from '../src/sim/world/zone.js';

test('Terraza Baja builds deterministically and every POI/NPC/spawn is reachable', () => {
  const a = buildZone(reg, 'zone.calvarre_lower');
  const b = buildZone(reg, 'zone.calvarre_lower');
  assert.equal(a.props.length, b.props.length);
  assert.deepEqual(a.props.slice(0, 20).map((p) => [p.kind, Math.round(p.x * 100)]), b.props.slice(0, 20).map((p) => [p.kind, Math.round(p.x * 100)]));
  const errs = validateZone(a);
  assert.deepEqual(errs, []);
  assert.ok(a.props.length > 500, `props ${a.props.length}`);
});

test('plateau heights match the design (settlement raised, quarry sunken)', () => {
  const z = buildZone(reg, 'zone.calvarre_lower');
  assert.ok(z.heightAt(0, -30) > 4.5, `orrel h=${z.heightAt(0, -30)}`);
  assert.ok(z.heightAt(50, 4) < -2, `quarry h=${z.heightAt(50, 4)}`);
  assert.ok(z.heightAt(45, -58) > 11, `overlook h=${z.heightAt(45, -58)}`);
});

test('cliffs are blocked, ramps are walkable', () => {
  const z = buildZone(reg, 'zone.calvarre_lower');
  const path = z.nav.findPath(z.spawnPoint.x, z.spawnPoint.z, 2, -22);
  assert.ok(path, 'start → settlement path exists');
  const path2 = z.nav.findPath(2, -22, 36, -8);
  assert.ok(path2, 'settlement → quarry exists');
  // direct lines from the settlement plateau straight over the cliff into the quarry must not all be clear: the drop is a wall, not a slope
  // (which props happen to stand on a given line changes whenever spawns move, so the check is "some line is blocked", not one fixed line)
  const lines = [[30, -20, 50, 4], [24, -30, 40, -14], [20, -24, 44, 2], [28, -34, 52, -10]];
  assert.ok(lines.some(([a, b, c, d]) => z.nav.los(a, b, c, d, 0.3) === false), 'at least one straight line over the cliff is blocked');
  assert.ok(z.heightAt(20, -24) - z.heightAt(44, 2) > 6, 'and the plateau really is much higher than the quarry floor');
});
