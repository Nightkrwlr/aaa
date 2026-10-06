import { NavGrid } from '../nav.js';

export const T = { WALL: 0, FLOOR: 1, DOOR: 2, LOCK: 3, SECRET: 4, ONEWAY: 5, PIT: 6 };
export const TILE = 2; // metres per tile

export class Tilemap {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.region = new Int16Array(w * h).fill(-1);
    this.doors = []; // {x,y,kind,edge,lockNeeds,openFrom}
    this.rooms = [];
  }
  idx(x, y) { return y * this.w + x; }
  inB(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inB(x, y) ? this.tiles[y * this.w + x] : T.WALL; }
  set(x, y, v) { if (this.inB(x, y)) this.tiles[y * this.w + x] = v; }
  isOpen(x, y) { const v = this.get(x, y); return v === T.FLOOR || v === T.DOOR; }
  isWalkableType(v) { return v === T.FLOOR || v === T.DOOR || v === T.PIT; }
  wx(x) { return x * TILE + TILE / 2; }
  wz(y) { return y * TILE + TILE / 2; }
  tileOf(wx, wz) { return [Math.floor(wx / TILE), Math.floor(wz / TILE)]; }

  /** nav grid at 1 m resolution. Locked / secret / one-way doors are blocked until opened by the runtime. */
  toNav() {
    const nav = new NavGrid(this.w * TILE, this.h * TILE, 1, 0, 0);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const t = this.tiles[y * this.w + x];
      const open = t === T.FLOOR || t === T.DOOR || t === T.PIT;
      for (let dy = 0; dy < TILE; dy++) for (let dx = 0; dx < TILE; dx++) nav.blocked[(y * TILE + dy) * nav.cols + (x * TILE + dx)] = open ? 0 : 1;
    }
    nav.version++;
    return nav;
  }

  /** flood fill over tiles that are passable under `passable(tileType)` from (x,y) */
  flood(x, y, passable = (t) => t === T.FLOOR || t === T.DOOR || t === T.PIT) {
    const seen = new Uint8Array(this.w * this.h);
    const stack = [[x, y]];
    seen[this.idx(x, y)] = 1;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      for (const [dx, dy] of D4) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inB(nx, ny) || seen[this.idx(nx, ny)]) continue;
        if (!passable(this.get(nx, ny))) continue;
        seen[this.idx(nx, ny)] = 1; stack.push([nx, ny]);
      }
    }
    return seen;
  }

  ascii() {
    const ch = { [T.WALL]: '#', [T.FLOOR]: '.', [T.DOOR]: 'd', [T.LOCK]: 'L', [T.SECRET]: 's', [T.ONEWAY]: 'o', [T.PIT]: '~' };
    let s = '';
    for (let y = 0; y < this.h; y++) { for (let x = 0; x < this.w; x++) s += ch[this.tiles[this.idx(x, y)]] ?? '?'; s += '\n'; }
    return s;
  }
}
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
