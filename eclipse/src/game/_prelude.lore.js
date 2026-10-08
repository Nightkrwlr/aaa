// Prelude del frente «lore» (D5): datos y funciones puras del contenido (src/engine/lore-data.js).
// Alias con prefijo Lore para no chocar con los de otros frentes ni con los identificadores minificados del juego.
import {
  LORE_ENTRIES as LoreEntries, LORE_COLLECTIONS as LoreCols, LORE_VOICES as LoreVoices, LORE_HINTS as LoreHints,
  LORE_REGION_NAMES as LoreRegNames, LORE_GLYPHS as LoreGlyphs, LORE_COLORS as LoreColors, LORE_DIRS as LoreDirs, LORE_WORDS as LoreWords,
  loreHash as LoreHash, loreRng as LoreRng, loreHintValue as LoreHintValue, loreFill as LoreFill, loreHintKeys as LoreHintKeys,
  loreGarble as LoreGarble, loreMembers as LoreMembers, loreEntryText as LoreEntryText,
} from '@engine/lore-data.js';
