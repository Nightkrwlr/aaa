/**
 * Talent trees: graph allocation with connectivity rules, exclusive transformer groups, safe de-allocation
 * (a node can only be removed if every other allocated node stays connected to the hub) and respec costs.
 * Node kinds: minor · notable · transformer (changes how a skill works) · keystone (rule-breaking trade-off).
 */
export class TalentTree {
  constructor(def) {
    this.def = def;
    this.nodes = new Map(def.nodes.map((n) => [n.id, n]));
    this.start = def.nodes.find((n) => n.kind === 'start').id;
  }

  node(id) { return this.nodes.get(id); }
  neighbours(id) { return this.nodes.get(id)?.links ?? []; }

  spent(alloc) { let s = 0; for (const id of alloc) if (id !== this.start) s += this.nodes.get(id)?.cost ?? 1; return s; }

  canAllocate(alloc, id, { points, level }) {
    const n = this.nodes.get(id);
    if (!n) return { ok: false, reason: 'missing' };
    if (alloc.has(id)) return { ok: false, reason: 'already' };
    if (n.kind === 'start') return { ok: false, reason: 'start' };
    if (points < (n.cost ?? 1)) return { ok: false, reason: 'points' };
    if (n.req?.level && level < n.req.level) return { ok: false, reason: 'level' };
    if (!n.links.some((l) => alloc.has(l))) return { ok: false, reason: 'unreachable' };
    if (n.excl) for (const a of alloc) if (this.nodes.get(a)?.excl === n.excl) return { ok: false, reason: 'exclusive', with: a };
    return { ok: true };
  }

  /** deallocation keeps the allocated subgraph connected to the start */
  canDeallocate(alloc, id) {
    if (!alloc.has(id) || id === this.start) return { ok: false, reason: 'start' };
    const rest = new Set(alloc); rest.delete(id);
    const seen = new Set([this.start]);
    const q = [this.start];
    while (q.length) {
      const c = q.pop();
      for (const l of this.neighbours(c)) if (rest.has(l) && !seen.has(l)) { seen.add(l); q.push(l); }
    }
    return seen.size === rest.size ? { ok: true } : { ok: false, reason: 'orphans' };
  }

  /** nodes that become orphaned if `id` is removed (UI can warn) */
  orphans(alloc, id) {
    const rest = new Set(alloc); rest.delete(id);
    const seen = new Set([this.start]); const q = [this.start];
    while (q.length) { const c = q.pop(); for (const l of this.neighbours(c)) if (rest.has(l) && !seen.has(l)) { seen.add(l); q.push(l); } }
    return [...rest].filter((n) => !seen.has(n));
  }

  /** aggregate everything the allocated set grants */
  effects(alloc) {
    const out = { mods: [], patches: [], flags: [], triggers: [] };
    for (const id of alloc) {
      const n = this.nodes.get(id); if (!n) continue;
      for (const m of n.mods ?? []) out.mods.push({ ...m, src: id, group: m.op === 'more' ? (m.group ?? 'talent') : m.group });
      for (const p of n.patches ?? []) out.patches.push({ ...p, id });
      out.flags.push(...(n.flags ?? []));
      for (const t of n.triggers ?? []) out.triggers.push({ ...t, id });
    }
    return out;
  }
}
