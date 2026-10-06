/**
 * Codex & Bestiary. Entries are revealed by *playing* (discoveries, kills, quests); details unlock progressively
 * and never gate progression. Bestiary tiers: seen → 5 kills (affinities) → 15 kills (behaviour & drops) → 30 (lore).
 */
export const BESTIARY_TIERS = [{ kills: 1, tier: 1 }, { kills: 5, tier: 2 }, { kills: 15, tier: 3 }, { kills: 30, tier: 4 }];

export class Codex {
  constructor(session) { this.s = session; }

  entries() {
    const reg = this.s.registry, st = this.s.state;
    const out = [];
    for (const c of reg.all('codex')) {
      const found = st.discovered.has(c.id) || (c.unlock?.quest && st.quests[c.unlock.quest]?.state === 'done') || (c.unlock?.flag && st.flags[c.unlock.flag]);
      out.push({ id: c.id, category: c.category, found: !!found, titleKey: found ? `${c.id}.title` : null, bodyKey: found ? `${c.id}.body` : null, hintKey: !found ? c.hintKey ?? null : null, region: c.region });
    }
    return out;
  }

  bestiary() {
    const st = this.s.state;
    return this.s.registry.all('enemy').filter((e) => e.family !== 'fam.test' && e.bestiary).map((e) => {
      const kills = st.kills[e.id] ?? 0;
      const seen = kills > 0 || st.discovered.has(`seen:${e.id}`);
      const tier = BESTIARY_TIERS.filter((t) => kills >= t.kills).length;
      return { id: e.id, family: e.family, seen, kills, tier, weak: tier >= 2 ? e.bestiary.weak : null, resist: tier >= 2 ? e.bestiary.resist : null, tip: tier >= 3 ? e.bestiary.tip : null, drops: tier >= 3 ? (e.drops?.materials ?? []).map((m) => m.id) : null, role: seen ? e.role : null, hasLore: tier >= 4 };
    });
  }

  progress() {
    const list = this.entries();
    const b = this.bestiary();
    return { codex: [list.filter((e) => e.found).length, list.length], bestiary: [b.filter((e) => e.seen).length, b.length] };
  }

  /** mark an enemy as seen (first sight) → returns true if new */
  see(enemyId) { const k = `seen:${enemyId}`; if (this.s.state.discovered.has(k)) return false; this.s.state.discovered.add(k); return true; }
}
