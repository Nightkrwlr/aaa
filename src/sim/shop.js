/**
 * ShopSystem — merchants with seeded, build-aware gear stock, consumables, materials and a short buy-back list.
 * Prices come from the central Balance curves (sell value ×4 to buy), with story-driven discounts (flags/reputation).
 * Stock is deterministic for (seed, shop, rest count, level band) so reloading never "rerolls" the merchant.
 */
import { Rng } from '../core/rng.js';

const BUY_MULT = 4;

export class ShopSystem {
  constructor(session) { this.s = session; this.buyback = []; this.nextUid = 1; this.cache = new Map(); }

  def(id) { return this.s.registry.require(id, 'shop'); }
  forNpc(npcId) { return this.s.registry.all('shop').find((x) => x.npc === npcId); }

  discount(d) {
    const st = this.s.state;
    let m = 1;
    for (const rule of d.discounts ?? []) if (st.flags[rule.flag]) m *= 1 - rule.pct;
    return Math.max(0.5, m);
  }

  stock(shopId) {
    const d = this.def(shopId), s = this.s, ch = s.character, st = s.state;
    const band = Math.floor(ch.level / 2);
    const key = `${shopId}:${st.restCount}:${band}`;
    let list = this.cache.get(key);
    if (!list) {
      list = [];
      const rng = new Rng(`${s.seed}:shop:${key}`);
      const g = d.gear;
      if (g) for (let i = 0; i < g.count; i++) {
        const slot = g.slots[i % g.slots.length];
        const item = s.factory.roll(rng.fork(`g${i}`), { ilvl: Math.max(1, ch.level + (i % 3 === 2 ? 1 : 0)), slot, bias: g.bias ?? 0.2, maxRarity: g.maxRarity ?? 'attuned', tags: ch.buildTags(), classId: ch.classId, noUnique: true });
        list.push({ sid: `g${i}`, type: 'item', item });
      }
      for (const c of d.consumables ?? []) list.push({ sid: `c:${c.id}`, type: 'consumable', id: c.id, amount: c.amount ?? 1 });
      for (const m of d.materials ?? []) list.push({ sid: `m:${m.id}`, type: 'material', id: m.id, amount: m.amount ?? 1, unit: m.unit });
      if (d.potions) list.push({ sid: 'potion', type: 'potion', amount: 1 });
      this.cache.set(key, list);
    }
    const sold = new Set(st.shop[shopId]?.sold ?? []);
    const disc = this.discount(d);
    return list.map((e) => ({ ...e, price: this.#price(e, disc), soldOut: e.type === 'item' && sold.has(e.sid) }));
  }

  #price(e, disc) {
    const s = this.s, u = s.balance.chimeUnit(s.character.level);
    switch (e.type) {
      case 'item': return Math.max(1, Math.round(s.factory.sellValue(e.item) * BUY_MULT * disc));
      case 'consumable': return Math.max(1, Math.round((s.registry.require(e.id, 'consumable').value ?? 4) * u * 0.45 * (e.amount ?? 1) * disc));
      case 'material': return Math.max(1, Math.round((e.unit ?? 0.6) * u * (e.amount ?? 1) * disc));
      case 'potion': return Math.max(1, Math.round(s.balance.d.economy.restPotionCost * u * disc));
      default: return 0;
    }
  }

  buy(shopId, sid) {
    const s = this.s, ch = s.character;
    const e = this.stock(shopId).find((x) => x.sid === sid);
    if (!e || e.soldOut) return { ok: false, reason: 'gone' };
    if (ch.inv.chimes < e.price) return { ok: false, reason: 'chimes', price: e.price };
    switch (e.type) {
      case 'item': if (ch.inv.add(e.item) < 0) return { ok: false, reason: 'full' }; (s.state.shop[shopId] ??= { sold: [] }).sold.push(sid); break;
      case 'consumable': if (!ch.inv.addConsumable(e.id, e.amount ?? 1)) return { ok: false, reason: 'full' }; break;
      case 'material': ch.inv.addMaterial(e.id, e.amount ?? 1); break;
      case 'potion': if (ch.potion.charges >= ch.potion.max) return { ok: false, reason: 'full' }; ch.potion.charges++; break;
      default: return { ok: false };
    }
    ch.inv.spendChimes(e.price);
    s.events.emit('shop:buy', { shop: shopId, entry: e });
    return { ok: true, price: e.price };
  }

  sell(iid) {
    const ch = this.s.character, item = ch.inv.find(iid);
    if (!item) return { ok: false, reason: 'notfound' };
    const r = this.s.crafting.sell(ch, iid);
    if (r.ok) { this.buyback.unshift({ uid: this.nextUid++, item, price: r.chimes }); this.buyback.length = Math.min(this.buyback.length, 10); this.s.events.emit('shop:sell', { item, chimes: r.chimes }); }
    return r;
  }

  rebuy(uid) {
    const ch = this.s.character, i = this.buyback.findIndex((b) => b.uid === uid);
    if (i < 0) return { ok: false, reason: 'gone' };
    const b = this.buyback[i];
    if (!ch.inv.spendChimes(b.price)) return { ok: false, reason: 'chimes' };
    if (ch.inv.add(b.item) < 0) { ch.inv.addChimes(b.price); return { ok: false, reason: 'full' }; }
    this.buyback.splice(i, 1);
    return { ok: true };
  }
}
