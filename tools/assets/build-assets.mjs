#!/usr/bin/env node
/**
 * build-assets — turns the raw CC0 KayKit packs into the optimised glTF set the game ships (public/assets/models).
 *
 *   • characters: keeps only the animation clips the game uses, resamples, meshopt-compresses
 *   • props / weapons / dungeon kit / graveyard kit: converted to single-file .glb, deduplicated, quantised, meshopt-compressed
 *   • writes public/assets/manifest.json (file, bytes, bounding box, clips) — the loader and the tests read it
 *
 * The source packs are NOT part of this repository (they are large and unmodified third-party files). Fetch them with
 *   git clone --depth 1 https://github.com/KayKit-Game-Assets/<repo>  (see docs/ASSET_LICENSES.md for the exact list)
 * and point KAYKIT_DIR at the folder that contains the clones (default: ../kaykit-game-assets next to the repo).
 *
 * usage: node tools/assets/build-assets.mjs [--src /path/to/kaykit-game-assets] [--only chars|weapons|dungeon|graveyard]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize, meshopt, resample, getBounds, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { readdirSync, mkdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const SRC = resolve(opt('src', process.env.KAYKIT_DIR ?? '/home/user/kaykit-game-assets'));
const ONLY = opt('only', null);
const OUT = resolve('public/assets');

const PACKS = {
  adventurers: join(SRC, 'kaykit-character-pack-adventures-1.0/addons/kaykit_character_pack_adventures'),
  skeletons: join(SRC, 'kaykit-character-pack-skeletons-1.0/addons/kaykit_character_pack_skeletons'),
  dungeon: join(SRC, 'kaykit-dungeon-remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf'),
  graveyard: join(SRC, 'kaykit-halloween-bits-1.0/addons/kaykit_halloween_bits/Assets/gltf'),
};

/** clips the game actually plays (everything else in the packs — sitting, lying, jumping… — is dropped to keep downloads small) */
const KEEP_CLIPS = new Set([
  'Idle', 'Idle_B', 'Idle_Combat', '2H_Melee_Idle', 'Unarmed_Idle',
  'Walking_A', 'Walking_B', 'Walking_C', 'Walking_Backwards', 'Walking_D_Skeletons',
  'Running_A', 'Running_B', 'Running_C', 'Running_Strafe_Left', 'Running_Strafe_Right',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab', '1H_Melee_Attack_Jump_Chop',
  '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Spinning', '2H_Melee_Attack_Stab',
  'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab',
  '1H_Ranged_Aiming', '1H_Ranged_Shoot', '1H_Ranged_Shooting', '2H_Ranged_Aiming', '2H_Ranged_Shoot', '2H_Ranged_Shooting',
  'Spellcast_Long', 'Spellcast_Raise', 'Spellcast_Shoot', 'Spellcasting', 'Spellcast_Summon',
  'Unarmed_Melee_Attack_Kick', 'Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B',
  'Dodge_Backward', 'Dodge_Forward', 'Dodge_Left', 'Dodge_Right',
  'Block', 'Block_Hit', 'Blocking', 'Block_Attack',
  'Hit_A', 'Hit_B', 'Death_A', 'Death_A_Pose', 'Death_B', 'Death_B_Pose', 'Death_C_Skeletons', 'Death_C_Pose',
  'Spawn_Ground', 'Spawn_Air', 'Spawn_Ground_Skeletons', 'Skeletons_Awaken_Standing', 'Skeletons_Awaken_Floor', 'Skeletons_Awaken_Floor_Long', 'Skeleton_Inactive_Standing_Pose',
  'Taunt', 'Taunt_Longer', 'Cheer', 'Interact', 'PickUp', 'Use_Item', 'Throw',
]);

const CHARACTERS = [
  { id: 'Knight', file: join(PACKS.adventurers, 'Characters/gltf/Knight.glb') },
  { id: 'Barbarian', file: join(PACKS.adventurers, 'Characters/gltf/Barbarian.glb') },
  { id: 'Mage', file: join(PACKS.adventurers, 'Characters/gltf/Mage.glb') },
  { id: 'Rogue', file: join(PACKS.adventurers, 'Characters/gltf/Rogue.glb') },
  { id: 'Rogue_Hooded', file: join(PACKS.adventurers, 'Characters/gltf/Rogue_Hooded.glb') },
  { id: 'Skeleton_Warrior', file: join(PACKS.skeletons, 'Characters/gltf/Skeleton_Warrior.glb') },
  { id: 'Skeleton_Mage', file: join(PACKS.skeletons, 'Characters/gltf/Skeleton_Mage.glb') },
  { id: 'Skeleton_Rogue', file: join(PACKS.skeletons, 'Characters/gltf/Skeleton_Rogue.glb') },
  { id: 'Skeleton_Minion', file: join(PACKS.skeletons, 'Characters/gltf/Skeleton_Minion.glb') },
];

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const manifest = { license: 'CC0-1.0', generator: 'tools/assets/build-assets.mjs', models: {} };
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

/** dispose an animation together with its channels/samplers (glTF-Transform leaves those — and their keyframe accessors — behind otherwise) */
function dropAnimation(a) { for (const c of a.listChannels()) c.dispose(); for (const sm of a.listSamplers()) sm.dispose(); a.dispose(); }

async function optimise(doc, { clips = null, compress = true } = {}) {
  const root = doc.getRoot();
  if (clips) for (const a of root.listAnimations()) if (!clips.has(a.getName())) dropAnimation(a);
  const steps = [prune(), dedup()];
  if (clips) steps.push(resample({ tolerance: 0.002 }));
  steps.push(prune());
  if (compress) steps.push(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeColor: 8, quantizeWeight: 8, quantizeGeneric: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...steps);
  return doc;
}

function bbox(doc) {
  const scene = doc.getRoot().listScenes()[0];
  const b = getBounds(scene);
  return { min: b.min.map((v) => +v.toFixed(3)), max: b.max.map((v) => +v.toFixed(3)) };
}

async function emit(group, id, doc, extra = {}) {
  const dir = join(OUT, 'models', group); mkdirSync(dir, { recursive: true });
  const file = join(dir, `${id}.glb`);
  await io.write(file, doc);
  const bytes = statSync(file).size;
  manifest.models[`${group}/${id}`] = { file: `models/${group}/${id}.glb`, bytes, bbox: bbox(doc), ...extra };
  return bytes;
}

async function characters() {
  let total = 0;
  for (const c of CHARACTERS) {
    if (!existsSync(c.file)) { console.warn(`missing ${c.file}`); continue; }
    const doc = await io.read(c.file);
    const before = statSync(c.file).size;
    for (const a of doc.getRoot().listAnimations()) dropAnimation(a);   // every KayKit character shares one 41-bone rig: clips live in the shared library below
    await optimise(doc);
    const bytes = await emit('chars', c.id, doc);
    total += bytes; console.log(`chars/${c.id.padEnd(18)} ${kb(before).padStart(8)} -> ${kb(bytes).padStart(7)}`);
  }
  // shared animation library: the skeleton pack has the superset of clips; keep only what the game plays
  const src = CHARACTERS.find((c) => c.id === 'Skeleton_Warrior');
  if (existsSync(src.file)) {
    const doc = await io.read(src.file);
    const root = doc.getRoot();
    for (const mesh of root.listMeshes()) mesh.dispose();
    for (const skin of root.listSkins()) skin.dispose();
    for (const node of root.listNodes()) { node.setMesh(null); node.setSkin(null); }
    await optimise(doc, { clips: KEEP_CLIPS, compress: false });
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const clips = root.listAnimations().map((a) => `${a.getName()}`).sort();
    const bytes = await emit('anims', 'Rig_Medium', doc, { clips });
    total += bytes; console.log(`anims/Rig_Medium  ${clips.length} clips -> ${kb(bytes)}`);
  }
  return total;
}

async function flatFolder(group, dir, filter = () => true) {
  let total = 0, n = 0;
  if (!existsSync(dir)) { console.warn(`missing ${dir}`); return 0; }
  for (const f of readdirSync(dir).sort()) {
    if (!/\.(glb|gltf)$/.test(f) || !filter(f)) continue;
    const id = basename(f).replace(/\.gltf\.glb$|\.glb$|\.gltf$/, '');
    const doc = await io.read(join(dir, f));
    await optimise(doc);
    total += await emit(group, id, doc); n++;
  }
  console.log(`${group.padEnd(10)} ${String(n).padStart(3)} models -> ${kb(total)}`);
  return total;
}

if (!ONLY || ONLY === 'chars') await characters();
if (!ONLY || ONLY === 'weapons') {
  await flatFolder('weapons', join(PACKS.adventurers, 'Assets/gltf'));
  await flatFolder('weapons_skeleton', join(PACKS.skeletons, 'Assets/gltf'));
}
if (!ONLY || ONLY === 'dungeon') await flatFolder('dungeon', PACKS.dungeon);
if (!ONLY || ONLY === 'graveyard') await flatFolder('graveyard', PACKS.graveyard);

const man = join(OUT, 'manifest.json');
let prev = {}; try { prev = JSON.parse((await import('node:fs')).readFileSync(man, 'utf8')); } catch { /* first run */ }
manifest.models = { ...(prev.models ?? {}), ...manifest.models };
const sorted = Object.fromEntries(Object.entries(manifest.models).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(man, JSON.stringify({ ...manifest, models: sorted }, null, 1));
const all = Object.values(sorted).reduce((s, m) => s + m.bytes, 0);
console.log(`manifest: ${Object.keys(sorted).length} models, ${(all / 1048576).toFixed(2)} MB total`);
