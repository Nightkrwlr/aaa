/**
 * Deterministic RNG (sfc32) with string/number seeding.
 * Every procedural system must receive an Rng — never Math.random() in sim code.
 */

/** @param {string|number} seed @returns {number[]} four 32-bit state words */
function seedWords(seed) {
  let h = 1779033703 ^ String(seed).length;
  const s = String(seed);
  const words = [];
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    words.push((h ^= h >>> 16) >>> 0);
    h = (h + 0x9e3779b9 + k) | 0;
  }
  return words;
}

export class Rng {
  /** @param {string|number} seed */
  constructor(seed = 1) {
    this.seed = seed;
    [this.a, this.b, this.c, this.d] = seedWords(seed);
    for (let i = 0; i < 12; i++) this.next();
  }

  /** @returns {number} float in [0,1) */
  next() {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** float in [min,max) */
  range(min, max) { return min + (max - min) * this.next(); }
  /** integer in [min,max] inclusive */
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  /** gaussian-ish (sum of 3 uniforms) in [-1,1] */
  bell() { return (this.next() + this.next() + this.next()) / 1.5 - 1; }

  pick(arr) {
    if (!arr.length) throw new Error('Rng.pick on empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** weighted pick; items need a numeric weight via fn (default item.weight) */
  weighted(items, fn = (i) => i.weight ?? 1) {
    let total = 0;
    for (const it of items) total += Math.max(0, fn(it));
    if (total <= 0) return items.length ? items[Math.floor(this.next() * items.length)] : undefined;
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, fn(it));
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** derive an independent, reproducible child RNG */
  fork(label) { return new Rng(`${this.seed}/${label}`); }

  /** serialisable state (for saves of ongoing generators) */
  state() { return [this.a, this.b, this.c, this.d]; }
  setState(s) { [this.a, this.b, this.c, this.d] = s; }
}

/** stable 32-bit string hash (FNV-1a) */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** seed → short human-friendly code (for sharing dungeon seeds) */
export function seedToCode(n) {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let s = '';
  n = n >>> 0;
  for (let i = 0; i < 7; i++) { s = alphabet[n & 31] + s; n = Math.floor(n / 32); }
  return s;
}
