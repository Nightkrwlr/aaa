/**
 * NavGrid — walkability grid with A* (8-way, no corner cutting), line-of-sight smoothing,
 * circle-vs-cell collision resolution and nearest-walkable lookup.
 * Coordinates are world metres: x → columns, z → rows.
 */
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const topV = v[0];
    const lastK = k.pop(), lastV = v.pop();
    const n = k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lastK) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lastK; v[i] = lastV;
    }
    return topV;
  }
}

export class NavGrid {
  constructor(cols, rows, cell = 1, ox = 0, oz = 0) {
    this.cols = cols; this.rows = rows; this.cell = cell; this.ox = ox; this.oz = oz;
    this.blocked = new Uint8Array(cols * rows);
    this.extraCost = new Float32Array(cols * rows); // additive path cost (hazards, slopes)
    this.version = 0;
    // scratch for A*
    this._g = new Float32Array(cols * rows);
    this._from = new Int32Array(cols * rows);
    this._stamp = new Uint32Array(cols * rows);
    this._stampN = 0;
    this._closed = new Uint32Array(cols * rows);
  }

  idx(cx, cz) { return cz * this.cols + cx; }
  cx(x) { return Math.floor((x - this.ox) / this.cell); }
  cz(z) { return Math.floor((z - this.oz) / this.cell); }
  wx(cx) { return this.ox + (cx + 0.5) * this.cell; }
  wz(cz) { return this.oz + (cz + 0.5) * this.cell; }
  inBounds(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows; }
  isBlockedCell(cx, cz) { return !this.inBounds(cx, cz) || this.blocked[cz * this.cols + cx] !== 0; }
  isWalkable(x, z) { return !this.isBlockedCell(this.cx(x), this.cz(z)); }
  setCell(cx, cz, v) { if (this.inBounds(cx, cz)) { this.blocked[cz * this.cols + cx] = v; this.version++; } }
  setBlockedWorld(x, z, v = 1) { this.setCell(this.cx(x), this.cz(z), v); }
  /** block a world-space circle */
  blockCircle(x, z, r, v = 1) {
    const c0 = this.cx(x - r), c1 = this.cx(x + r), r0 = this.cz(z - r), r1 = this.cz(z + r);
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
      if (!this.inBounds(i, j)) continue;
      const px = Math.max(this.ox + i * this.cell, Math.min(x, this.ox + (i + 1) * this.cell));
      const pz = Math.max(this.oz + j * this.cell, Math.min(z, this.oz + (j + 1) * this.cell));
      if ((px - x) ** 2 + (pz - z) ** 2 <= r * r) this.blocked[j * this.cols + i] = v;
    }
    this.version++;
  }
  blockRect(x0, z0, x1, z1, v = 1) {
    for (let j = this.cz(z0); j <= this.cz(z1); j++) for (let i = this.cx(x0); i <= this.cx(x1); i++) if (this.inBounds(i, j)) this.blocked[j * this.cols + i] = v;
    this.version++;
  }

  /** nearest walkable cell center to (x,z), ring search. returns {x,z}|null */
  nearestWalkable(x, z, maxRing = 12) {
    const c0 = this.cx(x), r0 = this.cz(z);
    if (!this.isBlockedCell(c0, r0)) return { x, z };
    for (let ring = 1; ring <= maxRing; ring++) {
      let best = null, bd = Infinity;
      for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        if (this.isBlockedCell(c0 + dx, r0 + dz)) continue;
        const wx = this.wx(c0 + dx), wz = this.wz(r0 + dz);
        const d = (wx - x) ** 2 + (wz - z) ** 2;
        if (d < bd) { bd = d; best = { x: wx, z: wz }; }
      }
      if (best) return best;
    }
    return null;
  }

  /** clearance-aware LOS (supercover Bresenham on cells with radius check on a few samples) */
  los(x0, z0, x1, z1, radius = 0) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    const step = this.cell * 0.4;
    const n = Math.ceil(len / step);
    const nx = -dz / len, nz = dx / len;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + dx * t, z = z0 + dz * t;
      if (this.isBlockedCell(this.cx(x), this.cz(z))) return false;
      if (radius > 0.01) {
        const r = Math.min(radius, this.cell * 0.49);
        if (this.isBlockedCell(this.cx(x + nx * r), this.cz(z + nz * r)) || this.isBlockedCell(this.cx(x - nx * r), this.cz(z - nz * r))) return false;
      }
    }
    return true;
  }

  /** projectile LOS ignores soft obstacles (blocked===2 are "low" cover that projectiles pass) */
  losProjectile(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const cx = this.cx(x0 + (x1 - x0) * t), cz = this.cz(z0 + (z1 - z0) * t);
      if (!this.inBounds(cx, cz) || this.blocked[cz * this.cols + cx] === 1) return false;
    }
    return true;
  }

  /**
   * A* path. Returns array of waypoints [{x,z}] (excluding start) or null.
   * If the goal is blocked, routes to the nearest walkable cell.
   */
  findPath(sx, sz, gx, gz, opts = {}) {
    const { radius = 0.4, maxNodes = 12000, snapGoal = true } = opts;
    let s = { x: sx, z: sz };
    if (this.isBlockedCell(this.cx(sx), this.cz(sz))) { s = this.nearestWalkable(sx, sz, 6); if (!s) return null; }
    let g = { x: gx, z: gz };
    if (this.isBlockedCell(this.cx(gx), this.cz(gz))) {
      if (!snapGoal) return null;
      g = this.nearestWalkable(gx, gz, 14);
      if (!g) return null;
    }
    const scx = this.cx(s.x), scz = this.cz(s.z), gcx = this.cx(g.x), gcz = this.cz(g.z);
    if (scx === gcx && scz === gcz) return [{ x: g.x, z: g.z }];
    if (this.los(s.x, s.z, g.x, g.z, radius)) return [{ x: g.x, z: g.z }];

    const cols = this.cols;
    const stamp = ++this._stampN;
    const G = this._g, FROM = this._from, ST = this._stamp, CL = this._closed;
    const open = new MinHeap();
    const si = scz * cols + scx, gi = gcz * cols + gcx;
    G[si] = 0; FROM[si] = -1; ST[si] = stamp;
    open.push(this.#h(scx, scz, gcx, gcz), si);
    const SQ2 = Math.SQRT2;
    let expanded = 0, found = false;
    const needClear = radius > this.cell * 0.55;
    while (open.size) {
      const cur = open.pop();
      if (CL[cur] === stamp) continue;
      CL[cur] = stamp;
      if (cur === gi) { found = true; break; }
      if (++expanded > maxNodes) break;
      const cx = cur % cols, cz = (cur / cols) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (this.isBlockedCell(nx, nz)) continue;
        if (dx && dz && (this.isBlockedCell(cx + dx, cz) || this.isBlockedCell(cx, cz + dz))) continue;
        if (needClear && this.#tight(nx, nz)) continue;
        const ni = nz * cols + nx;
        if (CL[ni] === stamp) continue;
        const ng = G[cur] + (dx && dz ? SQ2 : 1) + this.extraCost[ni];
        if (ST[ni] !== stamp || ng < G[ni]) {
          ST[ni] = stamp; G[ni] = ng; FROM[ni] = cur;
          open.push(ng + this.#h(nx, nz, gcx, gcz), ni);
        }
      }
    }
    if (!found) return null;
    const raw = [];
    for (let i = gi; i !== -1; i = FROM[i]) raw.push({ x: this.wx(i % cols), z: this.wz((i / cols) | 0) });
    raw.reverse();
    raw[0] = { x: s.x, z: s.z };
    raw[raw.length - 1] = { x: g.x, z: g.z };
    return this.#smooth(raw, radius);
  }

  #tight(cx, cz) {
    return this.isBlockedCell(cx - 1, cz) && this.isBlockedCell(cx + 1, cz) ? true : this.isBlockedCell(cx, cz - 1) && this.isBlockedCell(cx, cz + 1);
  }
  #h(ax, az, bx, bz) {
    const dx = Math.abs(ax - bx), dz = Math.abs(az - bz);
    return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
  }
  #smooth(pts, radius) {
    const out = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.los(pts[i].x, pts[i].z, pts[j].x, pts[j].z, radius)) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  /**
   * Move a circle by (dx,dz) with sliding collision. Mutates e.x/e.z. Returns true if blocked.
   */
  moveCircle(e, dx, dz, radius = e.radius ?? 0.4) {
    let hit = false;
    // substeps keep fast movers (dashes) from tunnelling through thin walls
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / (this.cell * 0.45)));
    const sx = dx / steps, sz = dz / steps;
    for (let s = 0; s < steps; s++) {
      e.x += sx; e.z += sz;
      if (this.resolve(e, radius)) hit = true;
    }
    return hit;
  }

  /** push the circle out of any blocked cell. returns true if corrected */
  resolve(e, radius) {
    let corrected = false;
    for (let pass = 0; pass < 3; pass++) {
      const c0 = this.cx(e.x - radius), c1 = this.cx(e.x + radius), r0 = this.cz(e.z - radius), r1 = this.cz(e.z + radius);
      let any = false;
      for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
        if (!this.isBlockedCell(i, j)) continue;
        const minX = this.ox + i * this.cell, minZ = this.oz + j * this.cell;
        const px = Math.max(minX, Math.min(e.x, minX + this.cell));
        const pz = Math.max(minZ, Math.min(e.z, minZ + this.cell));
        let nx = e.x - px, nz = e.z - pz;
        const d2 = nx * nx + nz * nz;
        if (d2 >= radius * radius) continue;
        any = corrected = true;
        if (d2 < 1e-8) { // centre inside the cell: push to nearest free side
          const cxm = minX + this.cell / 2, czm = minZ + this.cell / 2;
          nx = e.x - cxm; nz = e.z - czm;
          const l = Math.hypot(nx, nz) || 1;
          e.x += (nx / l) * (radius + this.cell * 0.5); e.z += (nz / l) * (radius + this.cell * 0.5);
        } else {
          const d = Math.sqrt(d2);
          e.x += (nx / d) * (radius - d); e.z += (nz / d) * (radius - d);
        }
      }
      if (!any) break;
    }
    return corrected;
  }

  /** flood fill reachable cell count from a world point (for validation) */
  reachable(x, z) {
    const start = this.nearestWalkable(x, z, 4);
    if (!start) return new Set();
    const seen = new Set();
    const q = [[this.cx(start.x), this.cz(start.z)]];
    seen.add(q[0][1] * this.cols + q[0][0]);
    while (q.length) {
      const [cx, cz] = q.pop();
      for (const [dx, dz] of DIRS4) {
        const nx = cx + dx, nz = cz + dz;
        if (this.isBlockedCell(nx, nz)) continue;
        const k = nz * this.cols + nx;
        if (seen.has(k)) continue;
        seen.add(k); q.push([nx, nz]);
      }
    }
    return seen;
  }
  cellKey(x, z) { return this.cz(z) * this.cols + this.cx(x); }
}
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
