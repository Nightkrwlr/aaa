/** GameState — everything that is "story / world progress" (separate from Character gear & stats). Serialisable. */
export class GameState {
  constructor() {
    this.flags = {};            // free-form booleans/numbers set by quests, dialogue, secrets
    this.quests = {};           // id → {state:'active'|'done'|'failed', stage:'s1', progress:{objIndex:n}, startedAt}
    this.waypoints = new Set(); // unlocked fast-travel points
    this.discovered = new Set();// codex ids / poi ids seen
    this.secrets = {};          // id → 'found' | 'solved'
    this.kills = {};            // enemy id → count (bestiary)
    this.bosses = new Set();    // defeated bosses (first-kill rules)
    this.npcMemory = {};        // npc id → {met:true, ...}
    this.dungeons = { done: 0, bySeed: {}, specs: {} };
    this.gates = {};            // gate id → 'open'
    this.rep = {};              // faction → number
    this.visitedAreas = new Set();
    this.clock = { seconds: 0, day: 0 };
    this.markers = [];          // custom map markers [{x,z,label}]
    this.hintsSeen = new Set(); // tutorial hints shown
    this.stats = { deaths: 0, listens: 0, chords: 0, perfectDodges: 0, voicesCaptured: 0, secretsFound: 0, dungeons: 0, quests: 0, kills: 0 };
    this.cleared = new Set();   // spawn groups killed since the last rest (so reloading does not re-spawn them)
    this.depleted = {};         // resource node id → clock.seconds when gathered
    this.checkpoint = null;     // {zone, wp, x, z}
    this.shop = {};             // shop id → {sold:[sid…]}
    this.restCount = 0;
    this.puzzlesRead = {};      // world puzzle id → [clue indexes read]
    this.fog = {};              // zone id → string of '0'/'1' per 8 m cell (explored)
  }

  /** mark cells within r metres of (x,z) as explored; returns true if anything new was revealed */
  explore(zone, x, z, r = 18) {
    const [W, H] = zone.def.size, [ox, oz] = zone.def.origin, C = 8, cols = Math.ceil(W / C), rows = Math.ceil(H / C);
    let f = this.fog[zone.id];
    if (!f || f.length !== cols * rows) f = this.fog[zone.id] = '0'.repeat(cols * rows);
    const arr = this._fogArr?.[zone.id] ?? ((this._fogArr ??= {})[zone.id] = Uint8Array.from(f, (c) => (c === '1' ? 1 : 0)));
    let changed = false;
    const i0 = Math.max(0, Math.floor((x - r - ox) / C)), i1 = Math.min(cols - 1, Math.floor((x + r - ox) / C)), j0 = Math.max(0, Math.floor((z - r - oz) / C)), j1 = Math.min(rows - 1, Math.floor((z + r - oz) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = ox + (i + 0.5) * C, cz = oz + (j + 0.5) * C;
      if ((cx - x) ** 2 + (cz - z) ** 2 <= (r + C * 0.5) ** 2 && !arr[j * cols + i]) { arr[j * cols + i] = 1; changed = true; }
    }
    if (changed) this.fog[zone.id] = Array.from(arr, (v) => (v ? '1' : '0')).join('');
    return changed;
  }
  fogGrid(zone) { const [W, H] = zone.def.size, C = 8; const cols = Math.ceil(W / C), rows = Math.ceil(H / C); const f = this.fog[zone.id]; return { cols, rows, C, known: (i, j) => f?.[j * cols + i] === '1' }; }
  flag(k) { return this.flags[k]; }
  setFlag(k, v = true) { this.flags[k] = v; }
  clearFlag(k) { delete this.flags[k]; }

  toJSON() {
    return { flags: this.flags, quests: this.quests, waypoints: [...this.waypoints], discovered: [...this.discovered], secrets: this.secrets, kills: this.kills, bosses: [...this.bosses],
      npcMemory: this.npcMemory, dungeons: this.dungeons, gates: this.gates, rep: this.rep, visitedAreas: [...this.visitedAreas], clock: this.clock, markers: this.markers, hintsSeen: [...this.hintsSeen], stats: this.stats, cleared: [...this.cleared], depleted: this.depleted, checkpoint: this.checkpoint, shop: this.shop, restCount: this.restCount, puzzlesRead: this.puzzlesRead, fog: this.fog };
  }
  static fromJSON(d) {
    const s = new GameState();
    if (!d) return s;
    Object.assign(s.flags, d.flags ?? {}); Object.assign(s.quests, d.quests ?? {});
    s.waypoints = new Set(d.waypoints ?? []); s.discovered = new Set(d.discovered ?? []); Object.assign(s.secrets, d.secrets ?? {}); Object.assign(s.kills, d.kills ?? {});
    s.bosses = new Set(d.bosses ?? []); Object.assign(s.npcMemory, d.npcMemory ?? {}); s.dungeons = { done: 0, bySeed: {}, specs: {}, ...(d.dungeons ?? {}) }; Object.assign(s.gates, d.gates ?? {});
    Object.assign(s.rep, d.rep ?? {}); s.visitedAreas = new Set(d.visitedAreas ?? []); s.clock = { seconds: 0, day: 0, ...(d.clock ?? {}) }; s.markers = d.markers ?? []; s.hintsSeen = new Set(d.hintsSeen ?? []);
    s.stats = { ...s.stats, ...(d.stats ?? {}) };
    s.cleared = new Set(d.cleared ?? []); s.depleted = { ...(d.depleted ?? {}) }; s.checkpoint = d.checkpoint ?? null; s.shop = { ...(d.shop ?? {}) }; s.restCount = d.restCount ?? 0; s.puzzlesRead = { ...(d.puzzlesRead ?? {}) }; s.fog = { ...(d.fog ?? {}) };
    return s;
  }
}

/** condition evaluator shared by quests, dialogue, gates, secrets, events */
export function checkCond(session, c) {
  if (!c) return true;
  const st = session.state;
  if (Array.isArray(c)) return c.every((x) => checkCond(session, x));
  if (c.all) return c.all.every((x) => checkCond(session, x));
  if (c.any) return c.any.some((x) => checkCond(session, x));
  if (c.not) return !checkCond(session, c.not);
  if (c.flag !== undefined) return !!st.flags[c.flag];
  if (c.noFlag !== undefined) return !st.flags[c.noFlag];
  if (c.flagEq) return st.flags[c.flagEq[0]] === c.flagEq[1];
  if (c.quest) {
    const q = st.quests[c.quest];
    switch (c.state) { case 'none': return !q; case 'active': return q?.state === 'active'; case 'done': return q?.state === 'done'; case 'started': return !!q; default: if (c.state?.startsWith('stage:')) return q?.state === 'active' && q.stage === c.state.slice(6); return false; }
  }
  if (c.level !== undefined) return (session.character?.level ?? 1) >= c.level;
  if (c.item) return !!session.character?.inv.keyItems.has(c.item) || (session.character?.inv.consumables[c.item] ?? 0) > 0 || (session.character?.inv.materials[c.item] ?? 0) > 0;
  if (c.killed) return st.bosses.has(c.killed) || (st.kills[c.killed] ?? 0) >= (c.count ?? 1);
  if (c.waypoint) return st.waypoints.has(c.waypoint);
  if (c.discovered) return st.discovered.has(c.discovered);
  if (c.secret) return !!st.secrets[c.secret];
  if (c.rep) return (st.rep[c.rep.faction] ?? 0) >= c.rep.min;
  if (c.mode) return session.mode === c.mode;
  if (c.met) return !!st.npcMemory[c.met]?.met;
  if (c.notMet) return !st.npcMemory[c.notMet]?.met;
  if (c.memory) return !!st.npcMemory[c.memory.npc]?.[c.memory.key];
  if (c.weather) return session.weather?.current === c.weather;
  return true;
}
