/** Inventory — grid of items + materials pouch + consumables + chimes. Pure data, fully serialisable. */
export class Inventory {
  constructor(capacity = 60) {
    this.capacity = capacity;
    /** @type {(any|null)[]} */ this.slots = new Array(capacity).fill(null);
    this.materials = {};
    this.consumables = {};
    this.keyItems = new Set();
    this.chimes = 0;
  }

  get used() { return this.slots.filter(Boolean).length; }
  get free() { return this.capacity - this.used; }
  items() { return this.slots.filter(Boolean); }
  find(iid) { return this.slots.find((i) => i && i.iid === iid) ?? null; }
  indexOf(iid) { return this.slots.findIndex((i) => i && i.iid === iid); }

  add(item) {
    const i = this.slots.indexOf(null);
    if (i < 0) return -1;
    this.slots[i] = item;
    return i;
  }
  removeAt(i) { const it = this.slots[i]; this.slots[i] = null; return it; }
  remove(iid) { const i = this.indexOf(iid); return i < 0 ? null : this.removeAt(i); }
  swap(a, b) { [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]]; }

  addMaterial(id, n = 1) { this.materials[id] = Math.min(999, (this.materials[id] ?? 0) + n); }
  materialCount(id) { return this.materials[id] ?? 0; }
  hasMaterials(map) { return Object.entries(map).every(([id, n]) => (this.materials[id] ?? 0) >= n); }
  spendMaterials(map) {
    if (!this.hasMaterials(map)) return false;
    for (const [id, n] of Object.entries(map)) { this.materials[id] -= n; if (this.materials[id] <= 0) delete this.materials[id]; }
    return true;
  }
  addConsumable(id, n = 1, max = 20) { const before = this.consumables[id] ?? 0; this.consumables[id] = Math.min(max, before + n); return this.consumables[id] - before; }
  useConsumable(id) { if ((this.consumables[id] ?? 0) <= 0) return false; this.consumables[id]--; if (this.consumables[id] <= 0) delete this.consumables[id]; return true; }

  addChimes(n) { this.chimes = Math.max(0, this.chimes + Math.round(n)); }
  spendChimes(n) { if (this.chimes < n) return false; this.chimes -= Math.round(n); return true; }

  /** sort by mode; locked/favourite items stay at the top. Returns nothing (mutates). */
  sort(mode, factory, registry) {
    const items = this.slots.filter(Boolean);
    const RAR = { relic: 3, attuned: 2, fine: 1, common: 0 };
    const key = {
      rarity: (i) => -(RAR[i.rarity] * 1000 + i.ilvl),
      ilvl: (i) => -i.ilvl,
      slot: (i) => registry.get(i.base).slot + String(100 - i.ilvl),
      value: (i) => -factory.sellValue(i),
      power: (i) => -factory.power(i),
    }[mode] ?? ((i) => 0);
    items.sort((a, b) => (Number(b.fav) - Number(a.fav)) || (() => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; })());
    this.slots.fill(null);
    items.forEach((it, i) => { this.slots[i] = it; });
  }

  toJSON() { return { capacity: this.capacity, slots: this.slots, materials: this.materials, consumables: this.consumables, keyItems: [...this.keyItems], chimes: this.chimes }; }
  static fromJSON(d) {
    const inv = new Inventory(d?.capacity ?? 60);
    if (!d) return inv;
    inv.slots = (d.slots ?? []).concat(new Array(Math.max(0, inv.capacity - (d.slots?.length ?? 0))).fill(null)).slice(0, inv.capacity).map((x) => x ?? null);
    inv.materials = { ...(d.materials ?? {}) }; inv.consumables = { ...(d.consumables ?? {}) };
    inv.keyItems = new Set(d.keyItems ?? []); inv.chimes = d.chimes ?? 0;
    return inv;
  }
}
