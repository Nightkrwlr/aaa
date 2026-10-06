/**
 * GameSession — the single orchestrator of a playthrough. It owns the persistent state (GameState, Character, stash)
 * and swaps the *live* context between overworld and dungeons, wiring every system together through events:
 *
 *   world events (combat) ──► session (kill → xp/loot/bestiary/quests, death, boss, listen…) ──► UI/audio events
 *
 * The session is headless: the browser client and the automated tests drive exactly the same object.
 */
import { EventBus } from '../core/events.js';
import { Rng } from '../core/rng.js';
import { logger } from '../core/logger.js';
import { Balance } from './balance.js';
import { World } from './world.js';
import { buildZone } from './world/zone.js';
import { populateZone } from './world/populate.js';
import { createPlayerEntity } from './player.js';
import { baseEntity } from './entity.js';
import { Character } from './character.js';
import { ItemFactory } from './items/generator.js';
import { Crafting } from './items/crafting.js';
import { LootSystem } from './items/loot.js';
import { Inventory } from './items/inventory.js';
import { GameState, checkCond } from './state.js';
import { applyEffects } from './effects.js';
import { QuestSystem } from './quests.js';
import { DialogueSystem } from './dialogue.js';
import { GateSystem } from './world/gates.js';
import { Weather } from './world/weather.js';
import { ExperienceDirector } from './director/experience.js';
import { EventSystem } from './world/events.js';
import { Codex } from './codex.js';
import { ShopSystem } from './shop.js';
import { buildInteractables } from './world/interactables.js';
import { PuzzleHost } from './puzzles/host.js';
import { generateDungeon } from './dungeon/index.js';
import { DungeonRuntime } from './dungeon/runtime.js';

const log = logger('session');
const FAMILY_CODEX = { 'fam.hollow': 'cdx.hollows', 'fam.discordant': 'cdx.discordants', 'fam.serrane_construct': 'cdx.constructs' };
const FORWARD = ['toast', 'level:up', 'xp:gain', 'loot:picked', 'loot:chimes', 'loot:material', 'loot:consumable', 'loot:potion', 'loot:drop', 'voice:captured', 'voice:echo', 'voice:lost', 'potion:used', 'consumable:used', 'equip',
  'boss:start', 'boss:phase', 'boss:shield_up', 'boss:shield_break', 'boss:reset', 'cadence:chord', 'listen:start', 'listen:end', 'listen:pulse', 'perfectDodge', 'elite:barrier_break', 'weather'];

export class GameSession {
  /**
   * @param {{registry:any, seed?:string, classId?:string, name?:string, settings?:any}} o
   */
  constructor({ registry, seed = 'sunderchoir-1', classId = 'cls.belfry', name = 'Reposo', settings = {} }) {
    this.registry = registry; this.seed = seed;
    this.settings = { difficulty: 'seeker', lootFilter: { mode: 'normal' }, autoPickupMaterials: true, puzzleHints: true, telemetry: false, ...settings };
    this.events = new EventBus();
    this.balance = Balance.from(registry);
    this.factory = new ItemFactory(registry, this.balance);
    this.crafting = new Crafting(registry, this.balance, this.factory);
    this.rng = new Rng(`${seed}:session`);
    this.state = new GameState();
    this.character = new Character({ registry, balance: this.balance, factory: this.factory, classId, name });
    this.stash = new Inventory(80);
    this.mode = 'overworld';
    this.overworld = null; this.dungeonCtx = null;
    this.quests = new QuestSystem(this);
    this.dialogue = new DialogueSystem(this);
    this.gates = new GateSystem(this);
    this.codex = new Codex(this);
    this.shop = new ShopSystem(this);
    this.puzzleHost = new PuzzleHost(this);
    this.director = new ExperienceDirector(this);
    this.dyn = new EventSystem(this);
    this.weather = null;
    this.gateBarriers = new Map();
    this.areaId = null; this.areaT = 0;
    this.pendingDeath = null; this.dead = false;
    this.telemetry = [];
    this.events.on('flag', () => { if (this.mode === 'overworld') this.#spawnNpcs(); });
    this.events.on('listen:start', () => this.discover('cdx.listen'));
    this.events.on('cadence:chord', () => this.discover('cdx.cadence'));
    this.events.on('gate:open', ({ id }) => { this.state.setFlag(`open:${id}`); this.#applyGateBarriers(); this.events.emit('flag', { flag: `open:${id}`, value: true }); });
    this.events.on('quest:done', () => { this.state.stats.quests++; this.events.emit('autosave', { reason: 'quest' }); });
    this.events.on('dungeon:checkpoint', () => this.events.emit('autosave', { reason: 'shrine' }));
  }

  // ───────────────────────── live context accessors
  get ctx() { return this.mode === 'dungeon' ? this.dungeonCtx : this.overworld; }
  get world() { return this.ctx?.world; }
  get player() { return this.ctx?.player; }
  get loot() { return this.ctx?.loot; }
  get zone() { return this.overworld?.zone; }
  get dungeon() { return this.dungeonCtx?.runtime ?? null; }
  get interactables() { return this.mode === 'dungeon' ? this.dungeon.interactables : this.overworld.interactables; }
  get time() { return this.state.clock.seconds; }

  // ───────────────────────── lifecycle
  /** begin a new game or continue the loaded state in the overworld */
  start({ zoneId = 'zone.calvarre_lower' } = {}) {
    const ch = this.character;
    ch.autoLoadout();
    this.#enterOverworld(zoneId);
    if (!this.state.quests['qst.first_echo'] && !this.state.flags.intro_done) {
      this.state.setFlag('intro_done');
      this.quests.start('qst.first_echo');
    }
    this.events.emit('session:started', {});
    return this;
  }

  #enterOverworld(zoneId, at = null) {
    const reg = this.registry;
    const zone = buildZone(reg, zoneId);
    const world = new World({ registry: reg, nav: zone.nav, seed: `${this.seed}:${zoneId}`, areaLevel: this.character.level, difficulty: this.settings.difficulty, balance: this.balance });
    world.zone = zone; world.session = this;
    const cp = at ?? this.#checkpointPos(zone);
    const player = this.#makePlayer(world, cp.x, cp.z);
    const loot = new LootSystem(world, this.factory, () => ({ character: this.character, settings: this.settings }));
    world.loot = loot;
    const ctx = { kind: 'overworld', world, player, loot, zone, groups: [], npcs: new Map(), interactables: [], puzzles: new Map() };
    this.overworld = ctx; this.mode = 'overworld';
    this.#bindWorld(ctx);
    ctx.groups = populateZone(world, zone, { seed: `${this.seed}:${this.state.restCount}`, difficulty: this.settings.difficulty, skip: this.state.cleared });
    this.#spawnNpcs(ctx);
    this.#spawnZoneBosses(ctx);
    const built = buildInteractables(this, zone);
    ctx.interactables = built.list; ctx.puzzleDefs = built.puzzles;
    for (const [id, p] of built.puzzles) this.#registerWorldPuzzle(id, p);
    this.#registerSecrets(ctx);
    this.#registerResourceEchoes(ctx);
    this.weather = new Weather(this, zone.def.weather, `${this.seed}:${zoneId}`);
    world.weatherFx = this.weather.fx();
    this.#applyGateBarriers();
    this.areaId = null;
    return ctx;
  }

  #checkpointPos(zone) {
    const cp = this.state.checkpoint;
    if (cp && cp.zone === zone.id) { const n = zone.nav.nearestWalkable(cp.x, cp.z, 6); if (n) return n; }
    return zone.spawnPoint;
  }

  #makePlayer(world, x, z) {
    const ch = this.character;
    const p = createPlayerEntity(world, ch.cls, ch.level, x, z);
    p.corpseTime = 1e9; // the player entity is never garbage-collected; respawn revives it
    world.addPlayer(p);
    ch.autoLoadout();
    ch.recompute(world, p);
    p.hp = p.hpMax;
    p.voices.charges = ch.voices.charges = Math.max(ch.voices.charges, 0);
    return p;
  }

  /** spawn NPC entities whose condition holds (idempotent; also called when story flags change) */
  #spawnNpcs(ctx = this.overworld) {
    if (!ctx) return;
    for (const n of ctx.zone.npcs) {
      if (ctx.npcs.has(n.id) || (n.cond && !checkCond(this, n.cond))) continue;
      ctx.npcs.set(n.id, this.#npcEntity(ctx.world, n.id, n.x, n.z, n.yaw ?? 0));
    }
  }

  #npcEntity(world, npcId, x, z, yaw) {
    const def = this.registry.require(npcId, 'npc');
    const e = baseEntity(world, 'npc', 'neutral', { id: npcId, def: { model: def.model }, x, z, yaw, radius: 0.5, height: 1.75 });
    e.hp = e.hpMax = 1; e.untargetable = true; e.noSeparate = true; e.npc = npcId; e.corpseTime = 1e9;
    world.add(e);
    return e;
  }

  #spawnZoneBosses(ctx) {
    for (const b of ctx.zone.def.bosses ?? []) {
      if (this.state.bosses.has(b.boss)) continue;
      const e = ctx.world.spawnEnemy(b.boss, b.pos[0], b.pos[1], { level: b.level });
      e.spawnId = b.id; e.zoneBoss = b;
      if (b.gate) e.gateId = b.gate;
    }
  }

  // ───────────────────────── world event wiring
  #bindWorld(ctx) {
    const w = ctx.world, ev = w.events;
    for (const t of FORWARD) ev.on(t, (i) => { if (this.ctx === ctx) this.events.emit(t, i); });
    ev.on('entity:died', (i) => {
      if (i.entity === ctx.player) return this.#onPlayerDied(ctx, i);
      if (i.entity.team !== 'enemy' || i.entity.kind === 'object') return;
      const k = i.killer;
      if (k === ctx.player || k?.owner === ctx.player) this.#onKill(ctx, i.entity);
      else this.#onEnemyDied(ctx, i.entity);
    });
    ev.on('boss:defeated', (i) => this.#onBossDefeated(ctx, i.entity));
    ev.on('listen:pulse', (i) => { this.state.stats.listens++; const near = this.interactables.filter((o) => Math.hypot(o.x - i.entity.x, o.z - i.entity.z) <= i.range).map((o) => o.id); this.events.emit('listen', { near, range: i.range }); });
    ev.on('voice:captured', (i) => { if (i.isNew) { this.state.stats.voicesCaptured++; this.discover(i.voice); this.discover('cdx.voices'); } });
    ev.on('cadence:chord', () => { this.state.stats.chords++; });
    ev.on('perfectDodge', () => { this.state.stats.perfectDodges++; });
    ev.on('level:up', (i) => { this.events.emit('autosave', { reason: 'level' }); this.#telemetry('level', { level: i.level }); });
    w.hooks.onKill.push((e) => { if (e.nodeKey && ctx.runtime) ctx.runtime.onKill(e); });
  }

  #onKill(ctx, e) {
    const st = this.state, ch = this.character;
    st.kills[e.id] = (st.kills[e.id] ?? 0) + 1; st.stats.kills++;
    ch.counters.kills++;
    if (!e.noXp) ch.grantXp(ctx.world, ctx.player, this.balance.xpFor(e.level, e.tier, ch.level));
    if (this.codex.see(e.id)) this.events.emit('bestiary:new', { id: e.id });
    const fc = FAMILY_CODEX[e.def?.family]; if (fc) this.discover(fc);
    this.events.emit('kill', { entity: e });
    this.#onEnemyDied(ctx, e);
    ctx.runtime?.onKill?.(e);
  }

  #onEnemyDied(ctx, e) {
    if (!e.spawnId || ctx.kind !== 'overworld') return;
    const grp = ctx.groups.find((g) => g.id === e.spawnId);
    if (grp && grp.enemies.every((m) => m.dead || m.removed)) this.state.cleared.add(grp.id);
  }

  #onBossDefeated(ctx, e) {
    const id = e.def?.bossId ?? e.id;
    const first = !this.state.bosses.has(id);
    this.state.bosses.add(id);
    this.events.emit('boss', { boss: id, entity: e, first });
    this.events.emit('toast', { key: 'toast.boss_defeated', params: { name: id } });
    this.events.emit('autosave', { reason: 'boss' });
    this.#telemetry('boss', { id, t: Math.round(ctx.world.time) });
  }

  #onPlayerDied(ctx) {
    if (this.dead) return;
    this.dead = true;
    const st = this.state;
    st.stats.deaths++; this.character.counters.deaths++;
    const lost = ctx.loot.dropDeathBundle(ctx.player.x, ctx.player.z);
    this.pendingDeath = { lost, x: ctx.player.x, z: ctx.player.z, mode: this.mode };
    this.events.emit('player:died', { lost });
    this.#telemetry('death', { area: this.areaId, mode: this.mode, level: this.character.level });
  }

  /** bring the player back to the last checkpoint (waypoint / shrine / dungeon entrance) */
  respawn() {
    if (!this.dead) return false;
    const ctx = this.ctx, p = ctx.player, w = ctx.world;
    let pos;
    if (this.mode === 'dungeon') pos = this.dungeon.checkpoint;
    else { const z = ctx.zone; const cp = this.#checkpointPos(z); pos = cp; }
    p.dead = false; p.removed = false; p.hp = p.hpMax; p.x = pos.x; p.z = pos.z; p.vx = p.vz = 0; p.kb = null;
    p.cast = null; p.dash = null; p.intent = null; p.shield = 0;
    w.status.clear(p, () => true);
    w.resources.init(p, p.cls.resource);
    p.invuln = w.time + 2.5;
    p.cmd.moveTo = null; p.cmd.attackTarget = null;
    this.dead = false; this.pendingDeath = null;
    this.events.emit('player:respawn', { x: p.x, z: p.z });
    return true;
  }

  // ───────────────────────── per-frame
  update(dt) {
    const w = this.world; if (!w) return;
    this.state.clock.seconds += dt;
    this.character.counters.playSeconds += dt;
    w.update(dt);
    this.loot.update(dt);
    if (this.mode === 'overworld') {
      this.weather.update(dt); w.weatherFx = this.weather.fx();
      this.director.update(dt);
      this.dyn.update();
      this.puzzleHost.update(dt, (pz) => Math.hypot(pz.def.center[0] - this.player.x, pz.def.center[1] - this.player.z) < 16);
      this.#trackArea(dt);
      this.#respawnNodes();
    } else this.dungeon.update(dt);
    this.#updateEchoes();
  }

  #trackArea(dt) {
    this.areaT -= dt;
    if (this.areaT > 0 || !this.player) return;
    this.areaT = 0.4;
    this.state.explore(this.zone, this.player.x, this.player.z);
    const a = this.zone.areaAt(this.player.x, this.player.z);
    if ((a?.id ?? null) === this.areaId) return;
    this.areaId = a?.id ?? null;
    if (!a) return;
    const first = !this.state.visitedAreas.has(a.id);
    this.state.visitedAreas.add(a.id);
    this.events.emit('area', { area: a.id, first });
    this.events.emit('music', { state: a.music });
    if (first) this.events.emit('toast', { key: 'toast.area_discovered', params: { name: a.id } });
  }

  /** puzzle entry for the active context (dungeon or overworld) */
  puzzleEntry(id) { return (this.mode === 'dungeon' ? this.dungeon.puzzles : this.puzzleHost.map).get(id); }

  /** floating marker above an NPC: 'objective' (an active quest wants you to talk to them), 'new' (offers a quest) or null */
  npcMarker(npcId) {
    for (const id of this.quests.active()) for (const o of this.quests.objectives(id)) if (o.type === 'talk' && o.npc === npcId && !o.done) return 'objective';
    const def = this.registry.get(npcId);
    for (const q of def?.offers ?? []) if (this.quests.available(q)) return 'new';
    return null;
  }

  // ───────────────────────── interaction
  isActive(o) {
    if (o.hidden) return false;
    if (o.taken || o.used || o.opened) return false;
    if (o.hiddenUntilRevealed && !o.revealed) return false;
    if (o.cond && !checkCond(this, o.cond)) return false;
    if (o.kind === 'resource') return !this.#isDepleted(o);
    if (o.kind === 'secret_chest' && this.state.secrets[o.secret]) return false;
    return true;
  }

  nearestInteractable(x = this.player.x, z = this.player.z, extra = 0.6) {
    let best = null, bd = Infinity;
    for (const o of this.interactables) {
      if (o.decor || !this.isActive(o)) continue;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d <= (o.r ?? 2.4) + extra && d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** @returns {{ok:boolean, reason?:string, toast?:string, dialogue?:any, ui?:string, leave?:boolean, tablet?:any}} */
  interact(obj) {
    if (!obj || this.dead) return { ok: false };
    const p = this.player;
    if (Math.hypot(obj.x - p.x, obj.z - p.z) > (obj.r ?? 2.4) + 1.4) return { ok: false, reason: 'far' };
    this.events.emit('interact', { id: obj.id, kind: obj.kind, obj });
    const res = this.mode === 'dungeon' ? this.#interactDungeon(obj) : this.#interactOverworld(obj);
    if (res?.toast) this.events.emit('toast', { key: res.toast });
    return res ?? { ok: true };
  }

  #interactDungeon(obj) {
    const rt = this.dungeon;
    switch (obj.kind) {
      case 'artifact': return rt.takeArtifact(obj);
      case 'stranded_scout': { const r = this.#talk(obj.npc ?? 'npc.scout', obj); if (!obj.npc) obj.used = true; return r; }
      case 'tablet': { const pz = rt.puzzles.get(obj.puzzle); this.events.emit('ui:open', { panel: 'tablet', puzzle: obj.puzzle, clue: obj.clue, instance: pz?.instance }); return { ok: true, tablet: { puzzle: obj.puzzle, clue: obj.clue } }; }
      case 'lore': { const r = rt.interact(obj); this.events.emit('ui:open', { panel: 'lore', key: obj.lore }); return r; }
      default: return rt.interact(obj);
    }
  }

  #talk(npcId, obj) {
    const view = this.dialogue.start(npcId);
    if (!view) return { ok: true, toast: 'toast.npc_silent' };
    this.events.emit('ui:open', { panel: 'dialogue', npc: npcId, view });
    return { ok: true, dialogue: view };
  }

  #interactOverworld(obj) {
    const st = this.state, ch = this.character;
    switch (obj.kind) {
      case 'npc': { const e = this.overworld.npcs.get(obj.npc); if (e) e.yaw = Math.atan2(this.player.x - e.x, this.player.z - e.z); return this.#talk(obj.npc, obj); }
      case 'waypoint': {
        const first = this.unlockWaypoint(obj.wp);
        this.#setCheckpoint(obj);
        this.events.emit('ui:open', { panel: 'waypoints', at: obj.wp });
        return { ok: true, toast: first ? 'toast.waypoint_unlocked' : 'toast.checkpoint' };
      }
      case 'station': this.events.emit('ui:open', { panel: 'craft', station: obj.station }); return { ok: true, ui: 'craft' };
      case 'stash': this.events.emit('ui:open', { panel: 'stash' }); return { ok: true, ui: 'stash' };
      case 'chart': this.events.emit('ui:open', { panel: 'chart' }); return { ok: true, ui: 'chart' };
      case 'lore': {
        this.discover(obj.discover); this.events.emit('lore', { key: obj.lore ?? obj.discover });
        applyEffects(this, obj.effects);
        this.events.emit('ui:open', { panel: 'lore', key: obj.discover });
        return { ok: true, ui: 'lore' };
      }
      case 'gate': {
        const r = this.gates.tryOpen(obj.gate);
        this.events.emit('ui:open', { panel: 'gate', gate: obj.gate, status: this.gates.status(obj.gate) });
        return r.ok ? { ok: true, toast: r.already ? undefined : 'toast.gate_open' } : { ok: false, reason: 'locked', status: r.status };
      }
      case 'dungeon_portal': return this.enterDungeon(obj.dungeon);
      case 'resource': return this.#gather(obj);
      case 'tablet': return this.#readTablet(obj);
      case 'tone_pillar': return this.puzzleHost.strike(obj);
      case 'glyph_dial': return this.puzzleHost.turn(obj);
      case 'event_npc': return this.#talk(obj.npc, obj);
      case 'secret_chest': return this.#openSecretChest(obj);
      case 'chest': return this.#openChest(obj);
      default: log.warn(`unhandled interactable ${obj.kind}`); return { ok: false };
    }
  }

  #setCheckpoint(obj) {
    const p = this.zone.poiById.get(obj.wp) ?? obj;
    this.state.checkpoint = { zone: this.zone.id, wp: obj.wp, x: p.x + 1.4, z: p.z + 1.4 };
  }

  #openChest(obj) {
    obj.opened = true; this.state.secrets[obj.id] = 'found';
    const ch = this.character, lvl = ch.level + (obj.tier ?? 0);
    const drops = [{ type: 'chimes', amount: Math.round(this.balance.chimeUnit(lvl) * (3 + (obj.tier ?? 1) * 3)) }];
    for (let i = 0; i < (obj.items ?? 1); i++) drops.push({ type: 'item', item: this.factory.roll(this.world.rng, { ilvl: lvl, bias: 0.4, tags: ch.buildTags(), classId: ch.classId, lootFind: this.player.stats.get('lootFind') }) });
    for (const m of obj.materials ?? []) drops.push({ type: 'material', id: m, amount: 2 });
    this.loot.spawn(obj.x, obj.z, drops);
    applyEffects(this, obj.effects);
    return { ok: true };
  }
  #openSecretChest(obj) { this.state.secrets[obj.secret] = 'solved'; return this.#openChest(obj); }

  // ───────────────────────── gathering (world-condition nodes)
  #isDepleted(o) { const t = this.state.depleted[o.id]; return t !== undefined && this.time - t < (o.respawn ?? 420); }
  #respawnNodes() { /* depleted nodes simply re-activate by timestamp in isActive */ }
  nodeAvailable(o) {
    if (!o.needs) return { ok: true };
    if (o.needs === 'listen') { const e = this.world.echoes.find((x) => x.id === o.id); return this.world.listen.isRevealed(e ?? {}) ? { ok: true } : { ok: false, reason: 'listen' }; }
    if (o.needs.startsWith('weather:')) return this.weather.current === o.needs.slice(8) ? { ok: true } : { ok: false, reason: o.needs };
    return { ok: true };
  }
  #gather(o) {
    const av = this.nodeAvailable(o);
    if (!av.ok) return { ok: false, reason: av.reason, toast: av.reason === 'listen' ? 'toast.gather_needs_listen' : 'toast.gather_needs_weather' };
    const lvlBonus = 1 + Math.floor(this.character.prof.alchemy.level / 4);
    const n = this.rng.fork(`g${o.id}${this.time | 0}`).int(1, 2 + (this.weather.current === 'windstorm' ? 1 : 0)) * (o.mat === 'mat.wind_lichen' ? lvlBonus : 1);
    this.character.inv.addMaterial(o.mat, n);
    this.state.depleted[o.id] = this.time;
    this.events.emit('collect', { id: o.mat, n });
    this.events.emit('loot:material', { id: o.mat, amount: n });
    this.#profXp('alchemy', 6);
    return { ok: true };
  }
  #profXp(prof, amount) {
    const p = this.character.prof[prof]; if (!p) return;
    p.xp += amount;
    while (p.xp >= 30 + p.level * 18 && p.level < 20) { p.xp -= 30 + p.level * 18; p.level++; this.events.emit('toast', { key: 'toast.prof_up', params: { prof, level: p.level } }); }
  }

  #registerResourceEchoes(ctx) {
    for (const o of ctx.interactables) if (o.kind === 'resource' && o.needs === 'listen') ctx.world.echoes.push({ id: o.id, kind: 'resource', x: o.x, z: o.z, holdFor: 8, once: false, found: false });
  }

  // ───────────────────────── secrets (data: kind 'secret')
  #registerSecrets(ctx) {
    const reg = this.registry;
    for (const s of reg.all('secret').filter((x) => x.zone === ctx.zone.id)) {
      if (this.state.secrets[s.id]) continue;
      const [x, z] = s.pos;
      if (s.find === 'listen') {
        ctx.world.echoes.push({ id: s.id, kind: 'secret', x, z, holdFor: s.holdFor ?? 9, once: true, found: false, secret: s.id,
          needs: (w) => !s.needs || ((!s.needs.weather || this.weather?.current === s.needs.weather) && (!s.needs.cond || checkCond(this, s.needs.cond))),
          onFirstHeard: () => this.revealSecret(s.id) });
      } else if (s.find === 'interact') {
        const o = { id: s.id, kind: 'secret_chest', secret: s.id, x, z, r: 2.2, labelKey: 'ia.open_cache', tier: s.tier ?? 2, items: s.items ?? 1, materials: s.materials, effects: s.effects, cond: s.needs?.cond, hiddenUntilRevealed: !!s.hidden };
        if (s.needs?.weather) o.cond = { all: [o.cond ?? {}, { weather: s.needs.weather }] };
        ctx.interactables.push(o);
        if (s.hidden) ctx.world.echoes.push({ id: `${s.id}:echo`, kind: 'cache', x, z, holdFor: 8, once: true, found: false,
          needs: () => !s.needs?.weather || this.weather?.current === s.needs.weather,
          onFirstHeard: () => { o.revealed = true; this.events.emit('toast', { key: 'toast.secret_found' }); } });
      }
    }
  }

  revealSecret(id) {
    const s = this.registry.get(id); if (!s || this.state.secrets[id]) return false;
    this.state.secrets[id] = 'found'; this.state.stats.secretsFound++; this.character.counters.secrets++;
    if (s.discover) this.discover(s.discover);
    applyEffects(this, s.effects);
    this.events.emit('secret:found', { id, pos: s.pos });
    this.events.emit('toast', { key: s.toast ?? 'toast.secret_found' });
    this.events.emit('autosave', { reason: 'secret' });
    return true;
  }

  #updateEchoes() { /* echoes carry their own reveal timers; nothing per-frame beyond Listen pulses */ }

  // ───────────────────────── world puzzles
  #registerWorldPuzzle(id, p) {
    if (this.state.secrets[id] === 'solved') { /* already solved: keep an entry so tablets still open, but mark solved */ }
    const entry = this.puzzleHost.add({ id, type: p.def.type, instance: p.instance, def: p.def, room: id, onSolve: (pz) => this.#onWorldPuzzleSolved(pz) });
    if (this.state.secrets[id] === 'solved') { entry.solved = true; entry.state.solved = true; }
    entry.hints.enabled = this.settings.puzzleHints !== false;
  }
  #onWorldPuzzleSolved(pz) {
    this.state.secrets[pz.id] = 'solved';
    applyEffects(this, pz.def.onSolve);
    if (pz.def.chest) this.#spawnPuzzleReward(pz);
    this.events.emit('autosave', { reason: 'puzzle' });
  }
  #spawnPuzzleReward(pz) {
    const [cx, cz] = pz.def.chest.pos ?? pz.def.center;
    const ch = this.character;
    const drops = [{ type: 'chimes', amount: Math.round(this.balance.chimeUnit(ch.level + 2) * 14) }];
    if (pz.def.chest.unique) drops.push({ type: 'item', item: this.factory.makeUnique(this.world.rng, pz.def.chest.unique, ch.level + 2) });
    else drops.push({ type: 'item', item: this.factory.roll(this.world.rng, { ilvl: ch.level + 2, rarity: 'attuned', tags: ch.buildTags(), classId: ch.classId }) });
    this.loot.spawn(cx, cz, drops);
  }
  #readTablet(obj) {
    const read = (this.state.puzzlesRead[obj.puzzle] ??= []);
    if (!read.includes(obj.clue)) read.push(obj.clue);
    const entry = this.puzzleHost.get(obj.puzzle);
    this.events.emit('ui:open', { panel: 'tablet', puzzle: obj.puzzle, clue: obj.clue, instance: entry?.instance });
    if (entry && read.length >= entry.instance.clues.length) { this.state.setFlag(`${obj.puzzle}:read`); this.events.emit('flag', { flag: `${obj.puzzle}:read` }); }
    return { ok: true, tablet: { puzzle: obj.puzzle, clue: obj.clue } };
  }

  // ───────────────────────── progression helpers used by effects/UI
  discover(id) {
    if (!id || this.state.discovered.has(id)) return false;
    this.state.discovered.add(id);
    this.events.emit('discover', { id });
    if (this.registry.get(id)?.kind === 'codex') this.events.emit('toast', { key: 'toast.codex_new', params: { id } });
    return true;
  }

  unlockWaypoint(id) {
    if (this.state.waypoints.has(id)) return false;
    this.state.waypoints.add(id);
    this.events.emit('waypoint', { id });
    this.events.emit('autosave', { reason: 'waypoint' });
    return true;
  }

  openGate(id) {
    if (this.state.gates[id]) return false;
    this.state.gates[id] = 'open';
    this.events.emit('gate:open', { id });
    return true;
  }
  tryOpenGate(id) { return this.gates.tryOpen(id); }

  /** closed gates are drawn as resonance curtains: a ring of blocked nav cells around the sealed region */
  #applyGateBarriers() {
    const zone = this.zone; if (!zone) return;
    for (const g of zone.def.gates ?? []) {
      const open = !!this.state.gates[g.id];
      const had = this.gateBarriers.get(g.id);
      if (open) {
        if (had) { for (const i of had) zone.nav.blocked[i] = 0; zone.nav.version++; this.gateBarriers.delete(g.id); this.events.emit('gate:barrier', { id: g.id, open: true }); }
        continue;
      }
      if (had) continue;
      const nav = zone.nav, cells = [];
      const [cx, cz] = g.ellipse.c, [rx, rz] = g.ellipse.r, th = g.ellipse.thickness ?? 2;
      for (let j = 0; j < nav.rows; j++) for (let i = 0; i < nav.cols; i++) {
        const x = nav.wx(i), z = nav.wz(j);
        const n = Math.sqrt(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2);
        const band = th / Math.min(rx, rz);
        if (n >= 1 - band / 2 && n <= 1 + band / 2) { const k = j * nav.cols + i; if (!nav.blocked[k]) { nav.blocked[k] = 1; cells.push(k); } }
      }
      nav.version++; this.gateBarriers.set(g.id, cells);
      this.events.emit('gate:barrier', { id: g.id, open: false, ellipse: g.ellipse });
    }
  }
  barrierOpen(id) { return !this.gateBarriers.has(id); }

  // ───────────────────────── travel & rest
  fastTravel(wpId) {
    if (this.mode !== 'overworld') return { ok: false, reason: 'dungeon' };
    if (!this.state.waypoints.has(wpId)) return { ok: false, reason: 'locked' };
    if (this.director.inCombat()) return { ok: false, reason: 'combat' };
    if (this.dead) return { ok: false, reason: 'dead' };
    const poi = this.zone.poiById.get(wpId); if (!poi) return { ok: false, reason: 'missing' };
    const n = this.zone.nav.nearestWalkable(poi.x + 1.4, poi.z + 1.4, 5) ?? { x: poi.x, z: poi.z };
    const p = this.player; p.x = n.x; p.z = n.z; p.vx = p.vz = 0; p.cmd.moveTo = null; p.cmd.attackTarget = null;
    this.state.checkpoint = { zone: this.zone.id, wp: wpId, x: n.x, z: n.z };
    this.events.emit('fasttravel', { wp: wpId, x: n.x, z: n.z });
    return { ok: true };
  }

  /** rest at a waypoint: full heal, potions, voices, merchants & packs refresh. Never during combat. */
  rest() {
    if (this.mode !== 'overworld') return { ok: false };
    if (this.director.inCombat()) return { ok: false, reason: 'combat' };
    const ch = this.character, p = this.player, w = this.world;
    ch.refillPotions(); ch.voices.charges = p.voices.max; p.voices.charges = p.voices.max;
    w.heal(p, p.hpMax, null, true);
    this.state.restCount++;
    this.#respawnGroups();
    this.shop.cache.clear();
    this.events.emit('rest', {});
    this.events.emit('toast', { key: 'toast.rested' });
    this.events.emit('autosave', { reason: 'rest' });
    return { ok: true };
  }

  #respawnGroups() {
    const ctx = this.overworld, w = ctx.world;
    for (const e of w.entities) if (e.kind === 'enemy' && e.spawnId && !e.zoneBoss && !e.eventId && !e.dead) { e.removed = true; }
    // kill-and-remove leftovers first so groups can spawn clean
    w.entities.splice(0, w.entities.length, ...w.entities.filter((e) => !e.removed));
    this.state.cleared.clear();
    ctx.groups = populateZone(w, ctx.zone, { seed: `${this.seed}:${this.state.restCount}`, difficulty: this.settings.difficulty, skip: this.state.cleared });
  }

  // ───────────────────────── dungeons
  /** @param {string|object} specOrId registry id of a 'dungeonSpec' or a literal spec */
  enterDungeon(specOrId) {
    if (this.mode !== 'overworld') return { ok: false, reason: 'busy' };
    const base = typeof specOrId === 'string' ? this.registry.require(specOrId, 'dungeonSpec') : specOrId;
    if (base.requires && !checkCond(this, base.requires)) return { ok: false, reason: 'locked', toast: 'toast.dungeon_locked' };
    const spec = { seed: base.seed, family: base.family, size: base.size ?? 'small', objective: base.objective, modifiers: base.modifiers, ilvl: base.ilvl ?? this.character.level, difficulty: this.settings.difficulty, boss: base.boss, narrative: base.narrative, storyNpc: base.storyNpc, specId: base.id ?? null };
    const gen = generateDungeon(this.registry, spec);
    if (!gen.ok) { log.error(`dungeon generation failed: ${gen.errors.join(' | ')}`); return { ok: false, reason: 'generation', toast: 'toast.dungeon_failed' }; }
    const over = this.overworld, back = { x: this.player.x, z: this.player.z };
    this.dead = false;
    const rt = new DungeonRuntime(this, gen.dungeon);
    rt.spec = base;
    const world = rt.build();
    world.session = this;
    const e = gen.dungeon.content.entrance;
    const player = this.#makePlayer(world, e.x, e.z);
    rt.applyPlayerModifiers(player);
    // carry health & belt state across
    player.hp = Math.max(1, Math.round(player.hpMax * (over.player.hp / over.player.hpMax)));
    const loot = new LootSystem(world, this.factory, () => ({ character: this.character, settings: this.settings }));
    world.loot = loot;
    const ctx = { kind: 'dungeon', world, player, loot, runtime: rt, back, interactables: rt.interactables };
    ctx.runtime = rt; this.dungeonCtx = ctx; this.mode = 'dungeon';
    this.#bindWorld(ctx);
    rt.startedAt = world.time;
    this.events.emit('dungeon:enter', { id: gen.dungeon.id, family: gen.dungeon.family, objective: gen.dungeon.objective, modifiers: gen.dungeon.modifiers, code: gen.dungeon.code, spec: base.id ?? null, seed: gen.dungeon.seed });
    this.events.emit('music', { state: this.registry.get(gen.dungeon.family)?.music ?? 'tense' });
    this.#telemetry('dungeon_enter', { family: gen.dungeon.family, objective: gen.dungeon.objective, ilvl: gen.dungeon.ilvl });
    return { ok: true, dungeon: gen.dungeon };
  }

  leaveDungeon({ completed = false, forced = false } = {}) {
    if (this.mode !== 'dungeon') return false;
    const ctx = this.dungeonCtx, rt = ctx.runtime, d = rt.d, over = this.overworld;
    const hpRatio = ctx.player.hp / ctx.player.hpMax;
    this.mode = 'overworld'; this.dungeonCtx = null; this.dead = false;
    const p = over.player;
    p.hp = Math.max(1, Math.round(p.hpMax * (ctx.player.dead ? 1 : hpRatio)));
    p.x = ctx.back.x; p.z = ctx.back.z; p.vx = p.vz = 0; p.cmd.moveTo = null;
    this.character.recompute(over.world, p);
    this.areaId = null;
    this.#spawnNpcs();
    this.events.emit('dungeon:leave', { completed, forced, id: d.id });
    this.events.emit('music', { state: 'explore' });
    if (completed) this.#dungeonRewards(rt);
    else if (forced) this.events.emit('toast', { key: 'toast.dungeon_collapsed' });
    return true;
  }

  #dungeonRewards(rt) {
    const d = rt.d, ch = this.character, st = this.state, u = this.balance.chimeUnit(d.ilvl);
    const modBonus = 1 + d.modifiers.reduce((a, m) => a + (this.registry.get(m)?.reward ?? 0), 0);
    const sizeMult = { small: 1, medium: 1.6, large: 2.4 }[d.size] ?? 1;
    const first = !st.dungeons.bySeed[d.seed];
    st.dungeons.bySeed[d.seed] = true; st.dungeons.done++; st.stats.dungeons++;
    if (rt.spec?.id) st.dungeons.specs[rt.spec.id] = true;
    const drops = [{ type: 'chimes', amount: Math.round(u * 18 * sizeMult * modBonus) }];
    const n = Math.round((first ? 2 : 1) * sizeMult * modBonus);
    for (let i = 0; i < n; i++) drops.push({ type: 'item', item: this.factory.roll(this.world.rng, { ilvl: d.ilvl + 1, bias: 0.55, tags: ch.buildTags(), classId: ch.classId, lootFind: this.player.stats.get('lootFind') }) });
    this.loot.spawn(this.player.x, this.player.z, drops);
    ch.grantXp(this.world, this.player, Math.round(this.balance.xpFor(d.ilvl, 'elite', ch.level) * 3 * sizeMult * modBonus));
    applyEffects(this, rt.spec?.onComplete);
    this.events.emit('dungeonDone', { family: d.family, spec: rt.spec?.id ?? null, seed: d.seed, objective: d.objective });
    this.events.emit('autosave', { reason: 'dungeon' });
    this.#telemetry('dungeon_done', { family: d.family, objective: d.objective, t: Math.round(rt.world.time) });
  }

  /** a random "Resonance Chart" dungeon (endgame loop): reproducible from the share code */
  openRift({ family, size = 'medium', seed = `rift-${this.state.dungeons.done + 1}-${this.state.restCount}`, objective, modifiers } = {}) {
    const fams = this.registry.all('dungeonFamily');
    const f = family ?? new Rng(`${this.seed}:rift:${seed}`).pick(fams).id;
    return this.enterDungeon({ id: null, seed, family: f, size, objective, modifiers, ilvl: this.character.level });
  }

  // ───────────────────────── dynamic-event hooks
  registerEventNpc(ev) {
    const ctx = this.overworld;
    const e = this.#npcEntity(ctx.world, ev.npc.id, ev.npc.x, ev.npc.z, 0);
    e.eventId = ev.id;
    const o = { id: `evt:${ev.id}`, kind: 'event_npc', npc: ev.npc.id, x: ev.npc.x, z: ev.npc.z, r: 2.8, labelKey: 'ia.talk', eventId: ev.id };
    ctx.interactables.push(o);
    ctx.npcs.set(`evt:${ev.id}`, e);
    this.events.once('event:end', () => {
      ctx.interactables.splice(ctx.interactables.indexOf(o), 1);
      e.removed = true;
    });
  }

  // ───────────────────────── inventory-facing helpers (kept thin: UI → session → character)
  usePotion() { return this.character.usePotion(this.world, this.player); }
  useConsumable(id) { return this.character.useConsumable(this.world, this.player, id); }
  equip(iid, slot) { return this.character.equip(this.world, this.player, iid, slot); }
  unequip(slot) { return this.character.unequip(this.world, this.player, slot); }
  allocateTalent(id) { return this.character.allocate(this.world, this.player, id); }
  deallocateTalent(id) { return this.character.deallocate(this.world, this.player, id); }
  respec() { return this.character.respecAll(this.world, this.player); }
  pickup(uid, opts) { return this.loot.pickup(uid, opts); }

  stashPut(iid) { const it = this.character.inv.remove(iid); if (!it) return { ok: false }; if (this.stash.add(it) < 0) { this.character.inv.add(it); return { ok: false, reason: 'full' }; } return { ok: true }; }
  stashTake(iid) { const it = this.stash.find(iid); if (!it) return { ok: false }; if (this.character.inv.add(it) < 0) return { ok: false, reason: 'full' }; this.stash.remove(iid); return { ok: true }; }

  #telemetry(type, data) {
    if (!this.settings.telemetry) return;
    this.telemetry.push({ t: Math.round(this.time), type, ...data });
    if (this.telemetry.length > 500) this.telemetry.shift();
  }
}
