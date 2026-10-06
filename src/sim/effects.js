/**
 * Game effects — the small vocabulary shared by quests, dialogue, secrets and events.
 * [{op:'setFlag',flag}, {op:'startQuest',id}, {op:'giveItem',…}, {op:'xp',amount}, …]
 */
import { logger } from '../core/logger.js';
const log = logger('effects');

export function applyEffects(session, effects, ctx = {}) {
  for (const fx of effects ?? []) applyEffect(session, fx, ctx);
}

export function applyEffect(session, fx, ctx = {}) {
  const st = session.state, ch = session.character, w = session.world;
  switch (fx.op) {
    case 'setFlag': st.setFlag(fx.flag, fx.value ?? true); session.events.emit('flag', { flag: fx.flag, value: fx.value ?? true }); break;
    case 'clearFlag': st.clearFlag(fx.flag); break;
    case 'startQuest': session.quests.start(fx.id); break;
    case 'advanceQuest': session.quests.advanceTo(fx.id, fx.stage); break;
    case 'completeQuest': session.quests.complete(fx.id); break;
    case 'failQuest': session.quests.fail(fx.id); break;
    case 'xp': ch.grantXp(w, session.player, fx.amount); break;
    case 'chimes': ch.inv.addChimes(fx.amount); session.events.emit('toast', { key: 'toast.chimes', params: { n: fx.amount } }); break;
    case 'talentPoints': ch.talentBonus += fx.amount; session.events.emit('toast', { key: 'toast.talent_points', params: { n: fx.amount } }); break;
    case 'giveMaterial': ch.inv.addMaterial(fx.id, fx.amount ?? 1); break;
    case 'giveConsumable': ch.inv.addConsumable(fx.id, fx.amount ?? 1); break;
    case 'giveKeyItem': ch.inv.keyItems.add(fx.id); session.events.emit('toast', { key: 'toast.key_item', params: { name: fx.id } }); break;
    case 'takeKeyItem': ch.inv.keyItems.delete(fx.id); break;
    case 'giveItem': {
      const rng = session.rng.fork(`give${fx.id ?? fx.unique ?? ''}${session.state.clock.seconds | 0}`);
      const item = fx.unique ? session.factory.makeUnique(rng, fx.unique, fx.ilvl ?? ch.level)
        : session.factory.roll(rng, { ilvl: fx.ilvl ?? ch.level, rarity: fx.rarity ?? 'fine', slot: fx.slot, baseId: fx.base, tags: ch.buildTags(), classId: ch.classId, noUnique: true });
      if (ch.inv.add(item) < 0) session.loot.spawn(session.player.x, session.player.z, [{ type: 'item', item }]);
      session.events.emit('toast', { key: 'toast.item', item });
      break;
    }
    case 'unlockWaypoint': session.unlockWaypoint(fx.id); break;
    case 'openGate': session.openGate(fx.id); break;
    case 'discover': session.discover(fx.id); break;
    case 'toast': session.events.emit('toast', { key: fx.key, params: fx.params }); break;
    case 'subtitle': session.events.emit('subtitle', { key: fx.key, speaker: fx.speaker }); break;
    case 'music': session.events.emit('music', { state: fx.state }); break;
    case 'rep': st.rep[fx.faction] = (st.rep[fx.faction] ?? 0) + fx.amount; break;
    case 'spawnEnemy': { const e = w.spawnEnemy(fx.enemy, fx.x ?? session.player.x + 4, fx.z ?? session.player.z + 4, { level: fx.level ?? ch.level }); e.ai.target = session.player; break; }
    case 'revealEcho': session.revealSecret(fx.id); break;
    case 'refillPotions': ch.refillPotions(); break;
    case 'npcMemory': (st.npcMemory[fx.npc] ??= {})[fx.key] = fx.value ?? true; break;
    case 'openUi': session.events.emit('ui:open', { panel: fx.panel, npc: ctx.npc ?? fx.npc, data: fx.data }); break;
    case 'rest': session.rest(); break;
    case 'recompute': ch.recompute(w, session.player); break;
    default: log.warn(`unknown effect op ${fx.op}`);
  }
}
