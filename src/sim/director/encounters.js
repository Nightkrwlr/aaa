/**
 * Encounter Director — composes groups with tactical synergy instead of random spawns.
 * A template lists *slots* (enemy or role+family) with positions in the formation (front / mid / back):
 * tanks screen artillery, supports sit behind the line, flankers ring the group. Budget scales with
 * difficulty, and the result is deterministic for a seed.
 */
const COST = { minion: 0.4, standard: 1, tough: 1.8, elite: 4, miniboss: 8, boss: 20 };

export function composeEncounter(registry, templateId, rng, { level = 1, difficulty = 'seeker', rare } = {}) {
  const tpl = registry.require(templateId, 'encounter');
  const diffBudget = { wanderer: 0.8, seeker: 1, chorister: 1.2, maestro: 1.45 }[difficulty] ?? 1;
  let budget = tpl.budget * diffBudget * (0.9 + rng.next() * 0.25);
  const picks = [];
  const costOf = (id) => COST[registry.require(id, 'enemy').tier] ?? 1;
  // mandatory minimums first
  for (const slot of tpl.slots) {
    const id = slot.enemy ?? pickByRole(registry, slot, rng);
    if (!id) continue;
    for (let i = 0; i < (slot.min ?? 1); i++) { picks.push({ id, pos: slot.pos ?? 'mid' }); budget -= costOf(id); }
  }
  // optional extras while budget remains
  const extras = tpl.slots.filter((s) => (s.max ?? 1) > (s.min ?? 1));
  let guard = 12;
  while (budget > 0.8 && extras.length && guard-- > 0) {
    const slot = rng.pick(extras);
    const id = slot.enemy ?? pickByRole(registry, slot, rng);
    const have = picks.filter((p) => p.id === id).length;
    if (!id || have >= slot.max) continue;
    picks.push({ id, pos: slot.pos ?? 'mid' }); budget -= costOf(id);
  }
  return layout(picks, tpl.formation ?? 'cluster', rng, tpl);
}

function pickByRole(registry, slot, rng) {
  const pool = registry.all('enemy').filter((e) => (!slot.role || e.role?.includes(slot.role)) && (!slot.family || e.family === slot.family));
  return pool.length ? rng.pick(pool).id : null;
}

/** places picks in local space: +z = front (toward the expected approach) */
function layout(picks, formation, rng, tpl) {
  const byPos = { front: [], mid: [], back: [] };
  for (const p of picks) byPos[p.pos].push(p);
  const out = [];
  const place = (list, z, spread) => {
    list.forEach((p, i) => {
      const n = list.length;
      let x = (i - (n - 1) / 2) * spread + rng.range(-0.4, 0.4);
      let zz = z + rng.range(-0.5, 0.5);
      if (formation === 'ring') { const a = (i / Math.max(1, n)) * Math.PI * 2 + rng.range(-0.3, 0.3); x = Math.sin(a) * (z + 2.5); zz = Math.cos(a) * (z + 2.5); }
      if (formation === 'cluster') { x = rng.range(-2.4, 2.4); zz = rng.range(-2.4, 2.4); }
      out.push({ id: p.id, dx: x, dz: zz });
    });
  };
  place(byPos.front, 2.2, 2.2);
  place(byPos.mid, 0, 2.4);
  place(byPos.back, -3.0, 2.6);
  return out;
}
