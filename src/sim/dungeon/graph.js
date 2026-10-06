/**
 * Mission graph — the *logic* of a dungeon before any geometry exists.
 * critical path (entrance → … → shrine → finale → exit), key/lock pairs, side branches, objective nodes,
 * secrets and one-way shortcut loops. A progress simulation proves the graph is solvable.
 *
 * node: {id,type,tags[],crit,idx?,keyOf?}   edge: {id,a,b,kind:'normal'|'lock'|'secret'|'shortcut', needs?:string[]}
 */
const NO_REPEAT = new Set(['combat', 'ambush', 'event', 'elite']);

export function buildGraph(registry, family, spec, rng) {
  const sz = family.sizes[spec.size ?? 'medium'];
  const obj = registry.require(spec.objective ?? 'obj.slay_boss', 'dungeonObjective');
  const nodes = [], edges = [];
  const add = (type, extra = {}) => { const n = { id: `n${nodes.length}`, type, tags: [], crit: false, ...extra }; nodes.push(n); return n; };
  const link = (a, b, kind = 'normal', extra = {}) => { const e = { id: `e${edges.length}`, a: a.id, b: b.id, kind, ...extra }; edges.push(e); return e; };

  // ── critical path
  const L = sz.crit + rng.int(0, 1);
  const crit = [add('entrance', { crit: true })];
  const midCount = L - 3;
  const mid = [];
  const pool = family.beats.mid.slice();
  let puzzleDone = !family.puzzles?.length, eliteDone = false;
  for (let i = 0; i < midCount; i++) {
    let t;
    for (let guard = 0; guard < 12; guard++) {
      t = rng.pick(pool);
      if (i === 0 && (t === 'puzzle' || t === 'elite')) continue;
      if (mid.length >= 2 && mid[mid.length - 1] === t && mid[mid.length - 2] === t && NO_REPEAT.has(t)) continue;
      if (t === 'puzzle' && puzzleDone) continue;
      break;
    }
    if (t === 'puzzle') puzzleDone = true;
    if (t === 'elite') eliteDone = true;
    mid.push(t);
  }
  if (!puzzleDone && mid.length > 2) mid[Math.min(mid.length - 1, Math.max(1, Math.floor(mid.length / 3)))] = 'puzzle';
  if (!eliteDone && mid.length > 3) mid[mid.length - 2] = rng.chance(0.5) ? 'miniboss' : 'elite';
  for (const t of mid) crit.push(add(t, { crit: true }));
  crit.push(add('shrine', { crit: true }));
  const finale = add(obj.finale, { crit: true, tags: [...(obj.tags ?? [])], big: true });
  crit.push(finale);
  const exit = add('exit', { crit: true });
  crit.push(exit);
  crit.forEach((n, i) => { n.idx = i; if (i > 0) link(crit[i - 1], n); });

  // ── objective nodes (keys held in side branches before the finale)
  const keyDefs = []; // {key, nodeId}
  const attachPoints = crit.slice(1, crit.length - 2);
  const degree = (id) => edges.filter((e) => e.kind !== 'shortcut' && (e.a === id || e.b === id)).length;
  // a lattice cell has 4 neighbours, so no node may exceed degree 4 (parent + 3 children)
  const roomy = (list) => { const ok = list.filter((n) => degree(n.id) < 4); return ok.length ? ok : list; };
  const pickAttach = (maxIdx) => rng.pick(roomy(crit.filter((n) => n.idx >= 1 && n.idx <= maxIdx)));
  for (const ex of obj.extraNodes ?? []) {
    for (let i = 1; i <= ex.count; i++) {
      const at = pickAttach(finale.idx - 1);
      const n = add(ex.type, { branch: true, tags: [`key:${ex.keyPrefix}${i}`] });
      const guard = rng.chance(0.55) ? add(rng.pick(['combat', 'ambush', 'elite']), { branch: true }) : null;
      if (guard) { link(at, guard); link(guard, n); } else link(at, n);
      keyDefs.push({ key: `${ex.keyPrefix}${i}`, node: n.id });
    }
  }
  if (obj.finaleLock) { const e = edges.find((x) => x.a === crit[finale.idx - 1].id && x.b === finale.id); e.kind = 'lock'; e.needs = obj.finaleLock.slice(); }
  if (obj.exitLock) { const e = edges.find((x) => x.a === finale.id && x.b === exit.id); e.kind = 'lock'; e.needs = obj.exitLock.slice(); }

  // ── puzzles on the critical path seal the way forward until solved (the solution is verified separately)
  for (const n of crit) if (n.type === 'puzzle' && n.idx < crit.length - 1) {
    const e = edges.find((x) => x.a === n.id && x.b === crit[n.idx + 1].id && x.kind === 'normal');
    if (e) { e.kind = 'lock'; e.needs = [`puz_${n.id}`]; n.tags.push(`key:puz_${n.id}`); keyDefs.push({ key: `puz_${n.id}`, node: n.id }); }
  }

  // ── key/lock pairs on the critical path
  for (let i = 0; i < sz.locks; i++) {
    const p = rng.int(2, Math.max(2, finale.idx - 2));
    const e = edges.find((x) => x.a === crit[p].id && x.b === crit[p + 1].id && x.kind === 'normal');
    if (!e) continue;
    const key = `key${i + 1}`;
    e.kind = 'lock'; e.needs = [key];
    const q = rng.int(1, p - 1 < 1 ? 1 : p - 1);
    const at = roomy(crit.filter((n) => n.idx === Math.min(q, p - 1)))[0] ?? crit[Math.min(q, p - 1)];
    const guardType = rng.pick(['miniboss', 'puzzle', 'ambush', 'elite']);
    const g = add(guardType === 'puzzle' && !family.puzzles?.length ? 'ambush' : guardType, { branch: true });
    const k = add('key', { branch: true, tags: [`key:${key}`] });
    link(at, g); link(g, k);
    keyDefs.push({ key, node: k.id });
  }

  // ── side branches
  for (let b = 0; b < sz.branches; b++) {
    const at = rng.pick(roomy(attachPoints));
    const len = rng.int(1, spec.size === 'large' ? 3 : 2);
    let prev = at;
    for (let i = 0; i < len; i++) {
      const t = i === len - 1 && rng.chance(0.7) ? 'treasure' : rng.pick(family.beats.branch.filter((x) => x !== 'puzzle' || family.puzzles?.length));
      const n = add(t, { branch: true });
      link(prev, n); prev = n;
    }
  }

  // ── secrets (hidden doors off existing rooms)
  const secretHosts = nodes.filter((n) => !['entrance', 'exit', 'boss', 'wave_arena', 'shrine', 'secret'].includes(n.type));
  for (let s = 0; s < sz.secrets; s++) {
    const at = rng.pick(roomy(secretHosts));
    const n = add('secret', { branch: true });
    link(at, n, 'secret');
  }

  // ── shortcuts (one-way loops: open from the LATER room)
  for (let l = 0; l < sz.loops; l++) {
    const j = rng.int(4, Math.max(4, finale.idx - 1)), i = rng.int(0, Math.max(0, j - 3));
    if (j >= crit.length || j - i < 3) continue;
    if (edges.some((e) => e.kind === 'shortcut' && (e.a === crit[i].id || e.b === crit[j].id))) continue;
    link(crit[j], crit[i], 'shortcut', { oneWay: true, openFrom: crit[j].id });
  }

  const graph = { nodes, edges, critical: crit.map((n) => n.id), keys: keyDefs, objective: obj.id, family: family.id, size: spec.size ?? 'medium', timer: obj.timer ?? 0, entrance: crit[0].id, exit: exit.id, finale: finale.id };
  return graph;
}

/** Simulates a player collecting keys and unlocking doors. Returns {reach:Set, keysHeld:Set, ok:boolean, errors:string[]} */
export function simulateProgress(graph, { useSecrets = true, useShortcuts = false } = {}) {
  const reach = new Set([graph.entrance]);
  const keys = new Set();
  const keyAt = new Map();
  for (const n of graph.nodes) for (const t of n.tags) if (t.startsWith('key:')) keyAt.set(n.id, t.slice(4));
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of reach) if (keyAt.has(n) && !keys.has(keyAt.get(n))) { keys.add(keyAt.get(n)); changed = true; }
    for (const e of graph.edges) {
      if (e.kind === 'shortcut' && !useShortcuts) continue;
      if (e.kind === 'secret' && !useSecrets) continue;
      if (e.kind === 'lock' && !e.needs.every((k) => keys.has(k))) continue;
      for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) if (reach.has(x) && !reach.has(y)) { reach.add(y); changed = true; }
    }
  }
  const errors = [];
  for (const n of graph.nodes) if (!reach.has(n.id)) errors.push(`unreachable node ${n.id} (${n.type})`);
  for (const k of graph.keys) if (!keys.has(k.key)) errors.push(`key ${k.key} never obtainable`);
  for (const e of graph.edges) if (e.kind === 'lock') for (const k of e.needs) { const holder = graph.keys.find((x) => x.key === k); if (!holder) errors.push(`lock ${e.id} needs unknown key ${k}`); }
  return { reach, keys, ok: errors.length === 0, errors };
}
