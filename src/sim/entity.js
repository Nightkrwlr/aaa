import { StatBlock } from './stats.js';

/** Entity kinds: 'player' | 'enemy' | 'npc' | 'summon' | 'object' */
export function baseEntity(world, kind, team, props = {}) {
  const e = {
    uid: world.nextUid++, kind, team,
    id: props.id ?? kind, def: props.def ?? null,
    x: props.x ?? 0, z: props.z ?? 0, y: 0, yaw: props.yaw ?? 0,
    vx: 0, vz: 0, radius: props.radius ?? 0.45, height: props.height ?? 1.7,
    level: props.level ?? 1,
    stats: new StatBlock(world.statDefs, world.statRules),
    hp: 1, hpMax: 1, shield: 0, dead: false,
    flags: new Set(),
    cd: {}, cast: null, castLockUntil: 0,
    invuln: 0, kb: null,
    lastHitTime: -99, lastHurtTime: -99,
    ...props.extra,
  };
  world.status.init(e);
  return e;
}

/** sets hp/hpMax from life stat, preserving ratio */
export function syncLife(e, healToFull = false) {
  const max = Math.max(1, Math.round(e.stats.get('life')));
  const ratio = healToFull ? 1 : e.hpMax > 0 ? e.hp / e.hpMax : 1;
  e.hpMax = max;
  e.hp = Math.max(1, Math.min(max, Math.round(max * ratio)));
  e.shieldMax = e.stats.get('shieldMax');
  if (e.shield > e.shieldMax && !e.hasTempShield) e.shield = e.shieldMax;
}

/** Create an enemy from content. Scales HP/damage from the central Balance curves. */
export function createEnemy(world, defId, x, z, opts = {}) {
  const def = world.registry.require(defId, 'enemy');
  const level = opts.level ?? world.areaLevel;
  const diff = world.difficulty;
  const bal = world.balance;
  const e = baseEntity(world, 'enemy', opts.team ?? 'enemy', {
    id: def.id, def, x, z, level, radius: def.radius ?? 0.5, height: def.height ?? 1.5, yaw: opts.yaw ?? 0,
  });
  const tier = opts.tier ?? def.tier ?? 'standard';
  e.tier = tier;
  e.role = def.role ?? [];
  const hpMult = (def.hpMult ?? 1) * (opts.hpMult ?? 1);
  const life = bal.enemyHp(level, tier, hpMult, diff);
  e.stats.add('base', [
    { stat: 'life', op: 'base', value: life },
    { stat: 'armor', op: 'base', value: bal.expectedArmor(level) * (def.armor ?? 0.4) },
    { stat: 'moveSpeed', op: 'base', value: (def.speed ?? 4.5) * (opts.speedMult ?? 1) * (bal.d.enemyDamage.difficultyAi[diff] ?? 1) ** 0.5 },
    { stat: 'critChance', op: 'base', value: -0.01 },
  ]);
  for (const [t, r] of Object.entries(def.resist ?? {})) e.stats.add('base', { stat: `res.${t}`, op: 'flat', value: r });
  for (const m of def.mods ?? []) e.stats.add('def', m);
  e.hitScale = bal.enemyHit(level, 1, 1, diff);
  e.damageMult = (def.damageMult ?? 1) * (opts.damageMult ?? 1);
  e.ccResist = def.ccResist ?? (tier === 'boss' ? 0.6 : tier === 'miniboss' ? 0.4 : tier === 'elite' ? 0.25 : 0);
  if (def.ccImmune) e.ccImmune = def.ccImmune.slice();
  else if (tier === 'boss') e.ccImmune = ['stunned', 'frozen'];
  e.kbResist = def.kbResist ?? (tier === 'boss' ? 1 : tier === 'miniboss' ? 0.7 : 0);
  e.abilityIds = (def.abilities ?? []).slice();
  e.ai = { brain: def.ai?.brain ?? 'melee', cfg: { ...(def.ai ?? {}) }, state: 'idle', stateT: 0, home: { x, z }, target: null, lastSeen: null, path: null, pathT: 0, memory: {} };
  e.xpValue = bal.xpFor(level, tier, level);
  e.hidden = !!opts.hidden || !!def.hidden;
  if (e.hidden) { e.untargetable = true; e.hiddenFromAi = true; }
  if (def.noSeparate) e.noSeparate = true;
  if (def.shield) e.damageGate = frontalGate(def.shield);
  e.modifiers = opts.modifiers ?? [];
  syncLife(e, true);
  return e;
}

/** frontal shield: hits arriving inside the arc are reduced (sonic partially pierces) */
function frontalGate(cfg) {
  const half = (cfg.arc ?? 140) * Math.PI / 360;
  return function gate(dmg, { source, type }) {
    if (!source) return dmg;
    let d = Math.atan2(source.x - this.x, source.z - this.z) - this.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > half) return dmg;
    const reduce = cfg.reduce * (type === 'sonic' ? 1 - (cfg.sonicPierce ?? 0) : 1);
    this.shieldHit = true;
    return Math.max(1, Math.round(dmg * (1 - reduce)));
  };
}
