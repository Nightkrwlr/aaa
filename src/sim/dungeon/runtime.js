/**
 * DungeonRuntime — instantiates a generated dungeon into a live World: nav, doors (locks/secrets/one-way),
 * enemies (with ambush triggers), chests, lore, shrines (checkpoints), puzzles, objective tracking, boss, rewards.
 * The player carries `keys` (dungeon-scoped tokens) which open the matching locked doors automatically.
 */
import { World } from '../world.js';
import { Rng } from '../../core/rng.js';
import { T, TILE } from './tilemap.js';
import { composeEncounter } from '../director/encounters.js';
import { PuzzleHost } from '../puzzles/host.js';
import { applyEffects } from '../effects.js';
import { logger } from '../../core/logger.js';
const log = logger('dungeon-rt');

export class DungeonRuntime {
  constructor(session, dungeon) {
    this.s = session; this.d = dungeon;
    this.keys = new Set();
    this.doors = [];        // {id, cells, type, needs, openFrom, a, b, open, revealed}
    this.explored = new Set();
    this.interactables = [];
    this.puzzleHost = new PuzzleHost(session);
    this.puzzles = this.puzzleHost.map; // id → {instance, state, hints, solved}
    this.openedChests = new Set();
    this.objective = { id: dungeon.objective, done: false, artifactTaken: false, collapseAt: null, wavesDone: 0, wave: 0, active: false };
    this.complete = false; this.startedAt = 0; this.checkpoint = null;
    this.bossEntity = null; this.pendingSpawns = [];
    this.nextId = 1;
  }

  build() {
    const s = this.s, d = this.d, map = d.map;
    const nav = map.toNav();
    this.nav = nav;
    const world = new World({ registry: s.registry, nav, seed: `${d.seed}:run`, difficulty: s.settings?.difficulty ?? 'seeker', areaLevel: d.ilvl, balance: s.balance });
    world.dungeon = this;
    this.world = world;
    // doors
    for (const dr of map.doors) {
      const door = { id: `door_${dr.edge}`, cells: dr.cells, type: dr.type, needs: dr.needs, openFrom: dr.openFrom, a: dr.a, b: dr.b, open: dr.type === T.DOOR, kind: dr.kind, x: 0, z: 0 };
      const cx = dr.cells.reduce((a, c) => a + c[0], 0) / dr.cells.length, cy = dr.cells.reduce((a, c) => a + c[1], 0) / dr.cells.length;
      door.x = map.wx(cx) - TILE / 2 + TILE / 2; door.z = map.wz(cy);
      door.x = (cx + 0.5) * TILE; door.z = (cy + 0.5) * TILE;
      this.doors.push(door);
    }
    // hide secret rooms from the minimap until found; register echoes for secret doors
    for (const door of this.doors) if (door.kind === 'secret') {
      world.echoes.push({ id: door.id, kind: 'secret_door', x: door.x, z: door.z, holdFor: 9, once: false, found: false, door });
    }
    this.#spawnObjects();
    this.#spawnEnemies();
    this.#spawnHazards();
    return world;
  }

  /** dungeon modifiers that change the player's own numbers (applied once the player entity exists) */
  applyPlayerModifiers(player) {
    const mods = [];
    for (const id of this.d.modifiers) {
      const e = this.s.registry.get(id)?.effect ?? {};
      if (e.listenRange) mods.push({ stat: 'listenRange', op: 'flat', value: e.listenRange });
      if (e.sonicBoost) mods.push({ stat: 'damage', op: 'inc', tags: ['sonic'], value: e.sonicBoost });
    }
    if (mods.length) player.stats.add('dungeon', mods);
  }

  roomAt(x, z) { const [tx, ty] = this.d.map.tileOf(x, z); const rg = this.d.map.region[this.d.map.idx(tx, ty)]; if (rg < 0) return null; return [...this.d.rooms.values()].find((r) => r.region === rg) ?? null; }

  // ───────────────────────── spawning
  #spawnEnemies() {
    const w = this.world, d = this.d, reg = this.s.registry;
    const rng = new Rng(`${d.seed}:spawns`);
    for (const sp of d.content.spawns) {
      const list = composeEncounter(reg, sp.template, rng.fork(sp.id), { level: sp.level, difficulty: w.difficulty });
      const entry = { sp, list, spawned: false };
      if (sp.trigger) this.pendingSpawns.push(entry); else this.#instantiate(entry);
    }
  }

  #instantiate(entry) {
    if (entry.spawned) return;
    entry.spawned = true;
    const w = this.world, { sp, list } = entry;
    const yaw = Math.atan2(this.d.content.entrance.x - sp.x, this.d.content.entrance.z - sp.z);
    const c = Math.cos(yaw), si = Math.sin(yaw);
    let eliteApplied = false;
    list.forEach((m, i) => {
      let x = sp.x + m.dx * c + m.dz * si, z = sp.z - m.dx * si + m.dz * c;
      if (!w.nav.isWalkable(x, z)) { const n = w.nav.nearestWalkable(x, z, 6); if (!n) return; x = n.x; z = n.z; }
      const hidden = sp.hidden && w.registry.get(m.id)?.hidden;
      const makeElite = sp.elite && !eliteApplied && (w.registry.get(m.id)?.tier !== 'minion');
      if (makeElite) eliteApplied = true;
      const e = w.spawnEnemy(m.id, x, z, { level: sp.level, yaw: yaw + Math.PI, elite: makeElite, eliteCount: sp.eliteCount });
      e.group = sp.id; e.spawnId = sp.id; e.ai.cfg.noLeash = false;
      if (sp.trigger === 'enter') { e.alerted = true; e.ai.target = this.s.player; e.ai.state = 'alert'; }
    });
    this.s.events.emit('dungeon:spawn', { id: sp.id });
  }

  /** modifier hazards become real persistent zones owned by an invisible environment object */
  #spawnHazards() {
    const w = this.world, HZ = { hush: 'abl.env.hush_zone', toxic: 'abl.env.toxic_cloud', shock: 'abl.env.shock_floor' };
    for (const h of this.d.content.hazards ?? []) {
      const ab = HZ[h.kind]; if (!ab) continue;
      const src = w.makeObject({ id: `env.${h.kind}`, team: 'enemy', x: h.x, z: h.z, level: this.d.ilvl, untargetable: true, hp: 1 });
      src.hitScale = w.balance.enemyHit(this.d.ilvl, 1, 1, w.difficulty); src.damageMult = 1; src.isHazard = true;
      w.abilities.castImmediate(src, ab, h.x, h.z);
    }
  }

  #spawnObjects() {
    const c = this.d.content, w = this.world;
    const add = (o) => { o.id ??= `ia${this.nextId++}`; this.interactables.push(o); return o; };
    for (const sh of c.shrines) add({ kind: 'shrine', x: sh.x, z: sh.z, r: 2.6, labelKey: 'ia.shrine', room: sh.room });
    add({ kind: 'dungeon_entrance', x: c.entrance.x, z: c.entrance.z, r: 2.4, labelKey: 'ia.leave_dungeon', room: c.entrance.room });
    add({ kind: 'dungeon_exit', x: c.exit.x, z: c.exit.z, r: 2.6, labelKey: 'ia.dungeon_exit', room: c.exit.room });
    for (const ch of c.chests) add({ kind: 'chest', x: ch.x, z: ch.z, r: 2.0, labelKey: 'ia.chest', tier: ch.tier, secret: ch.secret, sealed: ch.sealed, room: ch.room, openKey: `chest_${ch.room}_${Math.round(ch.x)}_${Math.round(ch.z)}` });
    for (const l of c.lore) add({ kind: 'lore', x: l.x, z: l.z, r: 2.2, labelKey: `ia.lore_${l.kind}`, lore: l.textKey, loreKind: l.kind, room: l.room, effects: l.effects });
    for (const o of c.objects) {
      switch (o.kind) {
        case 'key_pedestal': add({ kind: 'key_pedestal', x: o.x, z: o.z, r: 2.2, labelKey: 'ia.take_key', key: o.key, room: o.room }); break;
        case 'mechanism': add({ kind: 'mechanism', x: o.x, z: o.z, r: 2.4, labelKey: 'ia.activate', key: o.key, room: o.room }); break;
        case 'survivor': add({ kind: 'survivor', x: o.x, z: o.z, r: 2.4, labelKey: 'ia.free_survivor', key: o.key, room: o.room }); break;
        case 'resonance_node': { const e = w.spawnEnemy('enm.resonance_node', o.x, o.z, { level: this.d.ilvl + 1 }); e.nodeKey = o.key; e.noXp = false; break; }
        case 'event_stranded_scout': add({ kind: 'stranded_scout', x: o.x, z: o.z, r: 2.4, labelKey: 'ia.talk', room: o.room, npc: o.npc }); break;
        default: break;
      }
    }
    // puzzles
    for (const p of c.puzzles) this.#puzzleObjects(p, add);
    // secret doors & lock doors are handled each tick; secret door interactables appear when revealed
    for (const door of this.doors) if (door.kind === 'secret') add({ kind: 'secret_door', x: door.x, z: door.z, r: 2.4, labelKey: 'ia.open_secret', door: door.id, hiddenUntilRevealed: true });
    for (const door of this.doors) if (door.kind === 'shortcut') add({ kind: 'shortcut_door', x: door.x, z: door.z, r: 2.4, labelKey: 'ia.open_shortcut', door: door.id });
    this.checkpoint = { x: c.entrance.x, z: c.entrance.z, room: c.entrance.room };
  }

  #puzzleObjects(p, add) {
    const room = this.d.rooms.get(p.room);
    const entry = this.puzzleHost.add({ id: p.id, type: p.type, instance: p.instance, room: p.room, def: p, onSolve: (pz) => this.#onPuzzleSolved(pz) });
    const r = 3.2;
    if (p.type === 'tone_logic') {
      const n = p.instance.n;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.4;
        add({ kind: 'tone_pillar', puzzle: p.id, index: i, x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r, r: 1.8, labelKey: 'ia.strike', nameKey: `pz.name.${p.instance.names[i]}`, room: p.room });
      }
      // clue tablets along the walls of the room
      const edge = room.floor.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !this.d.map.isOpen(x + dx, y + dy)) && Math.hypot(this.d.map.wx(x) - p.x, this.d.map.wz(y) - p.z) > r + 3);
      const rng = new Rng(`${this.d.seed}:${p.id}:tablets`);
      p.instance.clues.forEach((clue, i) => {
        const [tx, ty] = edge.length ? rng.pick(edge) : room.floor[i];
        add({ kind: 'tablet', puzzle: p.id, clue: i, x: this.d.map.wx(tx), z: this.d.map.wz(ty), r: 2.2, labelKey: 'ia.read', room: p.room });
      });
    } else if (p.type === 'beam_mirrors') {
      const cell = 1.7, ox = p.x - (p.instance.w * cell) / 2, oz = p.z - (p.instance.h * cell) / 2;
      entry.board = { ox, oz, cell };
      p.instance.mirrors.forEach((m, i) => add({ kind: 'mirror', puzzle: p.id, index: i, x: ox + (m.x + 0.5) * cell, z: oz + (m.y + 0.5) * cell, r: 1.3, labelKey: 'ia.rotate', room: p.room }));
      add({ kind: 'beam_emitter', puzzle: p.id, x: ox + (p.instance.emitter.pos[0] + 0.5) * cell, z: oz + (p.instance.emitter.pos[1] + 0.5) * cell, r: 0, room: p.room, decor: true });
    } else if (p.type === 'glyph_lock') {
      for (let i = 0; i < p.instance.slots; i++) add({ kind: 'glyph_dial', puzzle: p.id, index: i, x: p.x + (i - 1) * 2.4, z: p.z, r: 1.6, labelKey: 'ia.turn', room: p.room });
    }
  }

  // ───────────────────────── per-tick
  update(dt) {
    const s = this.s, w = this.world, p = s.player;
    if (!p) return;
    const room = this.roomAt(p.x, p.z);
    if (room && !this.explored.has(room.id)) { this.explored.add(room.id); s.events.emit('dungeon:explored', { room: room.id, type: room.node.type }); }
    // ambush triggers & boss
    for (const e of this.pendingSpawns) {
      if (e.spawned) continue;
      const sr = this.d.rooms.get(e.sp.room);
      if (sr && room === sr && e.sp.trigger === 'enter') this.#instantiate(e);
    }
    if (this.d.content.boss && !this.bossEntity && room?.id === this.d.content.boss.room) this.#spawnBoss();
    if (this.d.content.waveArena && !this.objective.active && room?.id === this.d.content.waveArena.room && !this.objective.done) this.#startWaves();
    // doors: auto-open locked doors when keys are held and the player is near
    for (const door of this.doors) {
      if (door.open) continue;
      if (door.type === T.LOCK && door.needs.every((k) => this.keys.has(k)) && Math.hypot(p.x - door.x, p.z - door.z) < 3.4) this.openDoor(door.id);
    }
    // puzzles: layered hints only while the player is in the puzzle's room
    this.puzzleHost.update(dt, (pz) => room?.id === pz.room);
    this.#objectiveTick(dt);
    this.#waves(dt);
  }

  // ───────────────────────── doors
  openDoor(id) {
    const door = this.doors.find((x) => x.id === id);
    if (!door || door.open) return false;
    door.open = true;
    for (const [x, y] of door.cells) { this.d.map.set(x, y, T.DOOR); for (let dy = 0; dy < TILE; dy++) for (let dx = 0; dx < TILE; dx++) this.nav.setCell(x * TILE + dx, y * TILE + dy, 0); }
    this.s.events.emit('door:open', { id, kind: door.kind });
    return true;
  }

  // ───────────────────────── interactions
  interact(obj) {
    const s = this.s, w = this.world;
    switch (obj.kind) {
      case 'key_pedestal': if (this.keys.has(obj.key)) return { ok: false }; this.keys.add(obj.key); obj.taken = true; s.events.emit('dungeon:key', { key: obj.key }); return { ok: true, toast: 'toast.key_taken' };
      case 'mechanism': if (obj.active) return { ok: false }; obj.active = true; this.keys.add(obj.key); s.events.emit('dungeon:mechanism', { key: obj.key }); return { ok: true, toast: 'toast.mechanism' };
      case 'survivor': if (obj.freed) return { ok: false }; obj.freed = true; this.keys.add(obj.key); s.events.emit('dungeon:survivor', { key: obj.key }); return { ok: true, toast: 'toast.survivor' };
      case 'secret_door': { const door = this.doors.find((x) => x.id === obj.door); this.openDoor(door.id); obj.used = true; return { ok: true }; }
      case 'shortcut_door': {
        const door = this.doors.find((x) => x.id === obj.door);
        const pa = this.d.rooms.get(door.openFrom);
        const [px, pz] = [s.player.x, s.player.z];
        const dA = Math.hypot(px - (pa.cx + 0.5) * TILE, pz - (pa.cy + 0.5) * TILE);
        const other = this.d.rooms.get(door.a === door.openFrom ? door.b : door.a);
        const dB = Math.hypot(px - (other.cx + 0.5) * TILE, pz - (other.cy + 0.5) * TILE);
        if (dA > dB) return { ok: false, toast: 'toast.shortcut_wrong_side' };
        this.openDoor(door.id); obj.used = true; return { ok: true, toast: 'toast.shortcut_open' };
      }
      case 'shrine': this.checkpoint = { x: obj.x, z: obj.z, room: obj.room }; s.character.refillPotions(); w.heal(s.player, s.player.hpMax, null, true); s.character.voices.charges = s.player.voices.max; s.player.voices.charges = s.player.voices.max; s.events.emit('dungeon:checkpoint', { room: obj.room }); return { ok: true, toast: 'toast.checkpoint' };
      case 'chest': return this.#openChest(obj);
      case 'lore': s.events.emit('lore', { key: obj.lore, kind: obj.loreKind }); s.discover(obj.lore); applyEffects(s, obj.effects); return { ok: true };
      case 'tablet': return { ok: true, tablet: { puzzle: obj.puzzle, clue: obj.clue } };
      case 'tone_pillar': return this.strikePillar(obj);
      case 'mirror': return this.rotateMirror(obj);
      case 'glyph_dial': return this.turnDial(obj);
      case 'dungeon_exit': return this.leave(true);
      case 'dungeon_entrance': return this.leave(false);
      default: return { ok: false };
    }
  }

  strikePillar(obj) { return this.puzzleHost.strike(obj); }
  rotateMirror(obj) { return this.puzzleHost.rotate(obj); }
  turnDial(obj) { return this.puzzleHost.turn(obj); }

  #onPuzzleSolved(pz) {
    if (pz.def.key) this.keys.add(pz.def.key);
    for (const o of this.interactables) if (o.kind === 'chest' && o.sealed === pz.id) o.sealed = null;
  }

  #openChest(obj) {
    if (obj.sealed) return { ok: false, toast: 'toast.chest_sealed' };
    if (this.openedChests.has(obj.openKey)) return { ok: false };
    this.openedChests.add(obj.openKey);
    obj.opened = true;
    const s = this.s, ch = s.character;
    const lvl = this.d.ilvl + obj.tier;
    const n = obj.tier + (obj.secret ? 1 : 0);
    const drops = [{ type: 'chimes', amount: Math.round(s.balance.chimeUnit(lvl) * (3 + obj.tier * 3)) }];
    for (let i = 0; i < n; i++) drops.push({ type: 'item', item: s.factory.roll(this.world.rng, { ilvl: lvl, bias: 0.35 + obj.tier * 0.2, lootFind: s.player.stats.get('lootFind'), tags: ch.buildTags(), classId: ch.classId }) });
    const mats = ['mat.brass_scrap', 'mat.serrane_filament', 'mat.echo_silk', 'mat.sonic_quartz', 'mat.resonant_dust'];
    drops.push({ type: 'material', id: this.world.rng.pick(mats), amount: this.world.rng.int(1, 2 + obj.tier) });
    s.loot.spawn(obj.x, obj.z, drops);
    s.events.emit('chest', { room: obj.room });
    return { ok: true };
  }

  // ───────────────────────── boss & objective
  #spawnBoss() {
    const c = this.d.content.boss, w = this.world;
    const e = w.spawnEnemy(c.boss, c.x, c.z, { level: this.d.ilvl + 2 });
    this.bossEntity = e;
    w.events.on('boss:defeated', (i) => { if (i.entity === e) this.#onBossDead(); });
    this.s.events.emit('dungeon:boss_spawn', { id: c.boss });
  }
  #onBossDead() {
    const o = this.objective, c = this.d.content.boss;
    if (c.artifact) {
      this.interactables.push({ id: `ia_artifact`, kind: 'artifact', x: c.x, z: c.z, r: 2.4, labelKey: 'ia.take_artifact', room: c.room });
      this.s.events.emit('toast', { key: 'toast.artifact_appears' });
    } else this.#finishObjective();
  }
  takeArtifact(obj) {
    if (this.objective.artifactTaken) return { ok: false };
    this.objective.artifactTaken = true; obj.taken = true;
    this.s.character.inv.keyItems.add(`artifact:${this.d.id}`);
    if (this.d.content.boss.collapse) { this.objective.collapseAt = this.world.time + (this.d.graph.timer || 170); this.s.events.emit('dungeon:collapse', { seconds: this.d.graph.timer || 170 }); }
    this.#finishObjective();
    return { ok: true, toast: 'toast.artifact_taken' };
  }
  #finishObjective() { if (this.objective.done) return; this.objective.done = true; this.s.events.emit('dungeon:objective_done', { objective: this.d.objective }); }

  #objectiveTick() {
    const o = this.objective;
    if (o.collapseAt && this.world.time > o.collapseAt && !this.complete) { this.s.events.emit('dungeon:collapsed', {}); this.leave(false, true); }
  }

  #startWaves() { const o = this.objective; o.active = true; o.wave = 0; o.waveNext = this.world.time + 3; this.s.events.emit('toast', { key: 'toast.waves_start' }); }
  #waves() {
    const o = this.objective, wa = this.d.content.waveArena;
    if (!wa || !o.active || o.done) return;
    const w = this.world;
    const alive = w.entities.filter((e) => e.team === 'enemy' && !e.dead && e.wave === o.wave).length;
    if (o.wave > 0 && alive === 0 && !o.waveGap) { o.waveGap = true; o.waveNext = w.time + 3; if (o.wave >= wa.waves) { this.#finishObjective(); o.active = false; return; } }
    if (w.time >= o.waveNext && (o.wave === 0 || o.waveGap)) {
      o.waveGap = false; o.wave++;
      const pool = this.d.content.boss ? [] : this.s.registry.require(this.d.family, 'dungeonFamily').pools[o.wave > wa.waves * 0.6 ? 'hard' : 'mid'];
      const tpl = new Rng(`${this.d.seed}:w${o.wave}`).pick(pool);
      const list = composeEncounter(this.s.registry, tpl, new Rng(`${this.d.seed}:wave${o.wave}`), { level: this.d.ilvl + o.wave });
      list.forEach((m, i) => { const a = (i / list.length) * Math.PI * 2; const x = wa.x + Math.sin(a) * 6, z = wa.z + Math.cos(a) * 6; const e = w.spawnEnemy(m.id, x, z, { level: this.d.ilvl + o.wave, elite: o.wave === wa.waves && i === 0 }); e.wave = o.wave; e.ai.target = this.s.player; e.alerted = true; e.ai.state = 'alert'; });
      this.s.events.emit('dungeon:wave', { wave: o.wave, total: wa.waves });
    }
  }

  /** enemy killed inside the dungeon (resonance nodes grant keys) */
  onKill(e) {
    if (e.nodeKey) { this.keys.add(e.nodeKey); this.s.events.emit('dungeon:node', { key: e.nodeKey }); }
    if (this.d.objective === 'obj.slay_boss' && e === this.bossEntity) this.#finishObjective();
  }

  leave(completed, forced = false) {
    const s = this.s;
    const done = this.objective.done && !forced;
    this.complete = done;
    s.leaveDungeon({ completed: done, forced });
    return { ok: true, leave: true };
  }
}
