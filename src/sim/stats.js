/**
 * StatBlock — modifier-based stat resolution.
 *
 *   value = clamp( (base + Σ flat) × (1 + Σ inc) × Π_g (1 + min(cap_g, Σ more_g)) )
 *
 * - `base`  : sets/adds to the starting value (class base, level curves)
 * - `flat`  : additive flat bonus
 * - `inc`   : "increased" — all inc modifiers sum into ONE pool (additive among themselves)
 * - `more`  : multiplicative, but grouped: modifiers inside a group are additive, groups multiply,
 *             and each group has a cap (moreGroupCaps). This stops multiplier stacking from exploding.
 * Tag conditions: a mod with `tags:['fire']` only applies when the query tags include all of them.
 * Flag conditions: `when:['lowLife']` requires the runtime flags to contain all of them.
 */
export class StatBlock {
  /**
   * @param {Record<string, any>} defs map key → {base,min,max}
   * @param {{moreGroupCaps?:Record<string,number>, moreGroupCap?:number, incCap?:number}} rules
   */
  constructor(defs = {}, rules = {}) {
    this.defs = defs;
    this.rules = rules;
    /** @type {Map<string, any[]>} */
    this.mods = new Map();
    this.bySource = new Map();
    this.cache = new Map();
    this.version = 0;
  }

  /** add modifier(s). `src` identifies the origin so everything from it can be removed at once */
  add(src, mods) {
    const list = Array.isArray(mods) ? mods : [mods];
    let arr = this.bySource.get(src);
    if (!arr) this.bySource.set(src, (arr = []));
    for (const m of list) {
      const mod = { src, op: 'flat', ...m };
      if (mod.op === 'more' && !mod.group) mod.group = 'misc';
      arr.push(mod);
      let bucket = this.mods.get(mod.stat);
      if (!bucket) this.mods.set(mod.stat, (bucket = []));
      bucket.push(mod);
    }
    this.dirty();
    return this;
  }

  remove(src) {
    const arr = this.bySource.get(src);
    if (!arr) return false;
    for (const m of arr) {
      const bucket = this.mods.get(m.stat);
      const i = bucket.indexOf(m);
      if (i >= 0) bucket.splice(i, 1);
    }
    this.bySource.delete(src);
    this.dirty();
    return true;
  }

  removePrefix(prefix) {
    for (const src of [...this.bySource.keys()]) if (src.startsWith(prefix)) this.remove(src);
  }

  clear() { this.mods.clear(); this.bySource.clear(); this.dirty(); }
  dirty() { this.cache.clear(); this.version++; }

  /** @param {string} stat @param {string[]} [tags] @param {Set<string>|string[]} [flags] */
  get(stat, tags = EMPTY, flags = EMPTY) {
    const ck = tags.length || flags.size || flags.length ? `${stat}|${tags.join(',')}|${[...flags].join(',')}` : stat;
    const hit = this.cache.get(ck);
    if (hit !== undefined) return hit;
    const v = this.compute(stat, tags, flags);
    this.cache.set(ck, v);
    return v;
  }

  compute(stat, tags, flags) {
    const def = this.defs[stat] ?? {};
    let base = def.base ?? 0, flat = 0, inc = 0;
    let setValue = null;
    const groups = new Map();
    for (const m of this.mods.get(stat) ?? EMPTY) {
      if (m.tags && !m.tags.every((t) => tags.includes(t))) continue;
      if (m.when && !m.when.every((f) => hasFlag(flags, f))) continue;
      if (m.unless && m.unless.some((f) => hasFlag(flags, f))) continue;
      switch (m.op) {
        case 'base': base += m.value; break;
        case 'set': setValue = m.value; break;
        case 'flat': flat += m.value; break;
        case 'inc': inc += m.value; break;
        case 'more': groups.set(m.group, (groups.get(m.group) ?? 0) + m.value); break;
        default: break;
      }
    }
    if (setValue !== null) return clampDef(setValue, def);
    if (def.incCap !== undefined) inc = Math.min(inc, def.incCap);
    else if (this.rules.incCap !== undefined && stat === 'damage') inc = Math.min(inc, this.rules.incCap);
    let mult = 1;
    for (const [g, sum] of groups) {
      const cap = this.rules.moreGroupCaps?.[g] ?? this.rules.moreGroupCap ?? 1.5;
      mult *= 1 + (sum >= 0 ? Math.min(cap, sum) : Math.max(-0.9, sum));
    }
    // 'damage' & friends: base is a multiplier seed (1) so inc stacks as (1+inc) on top of it
    const value = (base + flat) * (1 + inc) * mult;
    return clampDef(value, def);
  }

  /** debugging aid: explain a value */
  explain(stat, tags = EMPTY, flags = EMPTY) {
    const rows = [];
    for (const m of this.mods.get(stat) ?? EMPTY) {
      const applies = (!m.tags || m.tags.every((t) => tags.includes(t))) && (!m.when || m.when.every((f) => hasFlag(flags, f)));
      rows.push({ src: m.src, op: m.op, value: m.value, group: m.group, tags: m.tags, applies });
    }
    return { stat, value: this.get(stat, tags, flags), rows };
  }
}

const EMPTY = [];
function hasFlag(flags, f) { return flags.has ? flags.has(f) : flags.includes(f); }
function clampDef(v, def) {
  if (def.min !== undefined && v < def.min) v = def.min;
  if (def.max !== undefined && v > def.max) v = def.max;
  return v;
}

/** build defs map from registry statDef items */
export function statDefsFrom(registry) {
  const defs = {};
  for (const d of registry.all('statDef')) defs[d.key] = d;
  return defs;
}
