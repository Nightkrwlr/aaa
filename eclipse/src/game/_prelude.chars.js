// Prelude del frente «personajes, enemigos, botín y efectos de combate» (src/engine/chars.js y fx.js).
// Alias con prefijo Ck para no chocar con los de otros frentes ni con los identificadores minificados del juego.
import {
  CharFx as CkCharFx, charClock as CkClock, patchCharMaterial as CkPatch, rimRig as CkRimRig, rimMaterial as CkRimMat,
  hdrMaterial as CkHdr, charShadow as CkShadow,
} from '@engine/chars.js';
import {
  StreakBatch as CkStreakBatch, GroundBatch as CkGroundBatch, SparkPool as CkSparkPool, hot as CkHot, fxTime as CkFxTime,
} from '@engine/fx.js';
