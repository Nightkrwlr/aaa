/**
 * Player entity construction. Persistent state lives in Character (character.js); this builds the live entity.
 */
import { baseEntity, syncLife } from './entity.js';

export function createPlayerEntity(world, cls, level, x = 0, z = 0) {
  const bal = world.balance;
  const e = baseEntity(world, 'player', 'player', { id: cls.id, x, z, level, radius: 0.42, height: 1.75 });
  e.cls = cls;
  e.stats.add('class', classMods(world, cls, level));
  world.resources.init(e, cls.resource);
  world.abilities.cadence.init(e);
  world.listen.init(e);
  world.controller.initCmd(e);
  e.voices = { library: new Set(), equipped: [], charges: 0, max: 3 };
  e.loadout = { ...cls.loadout };
  e.weaponHit = bal.weaponHit(level) * (cls.profile.unarmedMult ?? 0.6);
  e.spellHit = e.weaponHit;
  e.patches = [];
  e.abVersion = 0;
  syncLife(e, true);
  return e;
}

/** level-scaled baseline from the class profile and Balance curves */
export function classMods(world, cls, level) {
  const b = world.balance, p = cls.profile;
  const mods = [
    { stat: 'life', op: 'base', value: b.playerBaseLife(level) * p.life },
    { stat: 'armor', op: 'base', value: b.expectedArmor(level) * 0.4 * p.armor },
    { stat: 'moveSpeed', op: 'base', value: p.moveSpeed },
  ];
  for (const [t, v] of Object.entries(p.res ?? {})) mods.push({ stat: `res.${t}`, op: 'flat', value: v });
  return mods;
}
