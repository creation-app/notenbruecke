// Instrument des aktuellen Profils.
// Klavier: wie notiert, Bildschirm-Tasten. Gitarre: klingt eine Oktave tiefer als notiert, Griffbrett statt Tasten,
// Tonnamen wie im Gitarrenheft („hohes g“, „mittleres c“, „tiefes a“).
import { letterName, setNamer } from './music.js';
import { setLevelSet } from './levels.js';
import { setStorySet } from './story.js';

/** Leere Saiten, notiert (klingend eine Oktave tiefer): E A d g h e. */
export const OPEN = [52, 57, 62, 67, 71, 76], FRETS = 3;
export const STRING_NAME = ['tiefe E-Saite', 'A-Saite', 'd-Saite', 'g-Saite', 'h-Saite', 'hohe e-Saite'], STRING_SHORT = ['E', 'A', 'd', 'g', 'h', 'e'];
const FINGER = ['', 'Zeigefinger', 'Mittelfinger', 'Ringfinger', 'kleiner Finger'];
/** Griff in der ersten Lage für eine notierte Tonhöhe: { string: 0 (tiefe E-Saite) … 5, fret: 0 … 4 }. */
export function grip(midi) { for (let s = 5; s >= 0; s--) { const f = midi - OPEN[s]; if (f >= 0 && f <= 4) return { string: s, fret: f }; } return null; }
export function gripText(midi) { const g = grip(midi); if (!g) return ''; return g.fret === 0 ? `${STRING_NAME[g.string]}, leer (ohne Finger)` : `${STRING_NAME[g.string]}, ${g.fret}. Bund (${FINGER[g.fret]})`; }
/** hoch / mittel / tief wie im Heft: hohes d bis hohes g, mittleres d bis mittleres c, tiefes e bis tiefes c. */
export function register(n) { return n.step >= 8 ? 'hoch' : n.step >= 1 ? 'mittel' : 'tief'; }
const ADJ = { hoch: 'hohes', mittel: 'mittleres', tief: 'tiefes' };
function guitarName(n) { const base = letterName(n), tag = register(n); return { base, tag, full: `${ADJ[tag]} ${base}` }; }

const KLAVIER = { id: 'klavier', name: 'Klavier', shift: 0, on: 'auf deinem Klavier', onThe: 'auf dem Klavier', at: 'am Klavier', play: 'Am Klavier spielen', pad: 'Bildschirm-Tasten', padDesc: 'Ohne Klavier spielen: Tasten antippen',
  tapPad: 'tippe die Tasten unten', padWhere: 'unten auf der Tastatur', place: 'Stell dein Gerät aufs Klavier.', tuneKey: 'c1', tune: 'Spiele dreimal das <b>mittlere c</b> (c<sup>1</sup>), jedes Mal kurz und deutlich.', tuned: 'Dein Klavier', octave: 'Die richtige Oktave zählt!', has: 'Halte dein Klavier bereit.' };
const GITARRE = { id: 'gitarre', name: 'Gitarre', shift: 12, on: 'auf deiner Gitarre', onThe: 'auf der Gitarre', at: 'auf der Gitarre', play: 'Auf der Gitarre spielen', pad: 'Bildschirm-Griffbrett', padDesc: 'Ohne Gitarre spielen: Griffbrett antippen',
  tapPad: 'tippe unten auf das Griffbrett', padWhere: 'unten auf dem Griffbrett', place: 'Stell dein Gerät vor die Gitarre, nah am Schallloch.', tuneKey: 'a', tune: 'Zupfe dreimal die <b>leere A-Saite</b> (die zweittiefste Saite), jedes Mal einzeln und deutlich.', tuned: 'Deine Gitarre', octave: 'Die richtige Saite zählt!', has: 'Halte deine Gitarre bereit.' };
export let INSTR = KLAVIER;
export const INSTRUMENTS = [KLAVIER, GITARRE];
/** Auf das Instrument des Profils umstellen: Level-Satz, Tonnamen, Texte. */
export function setInstr(id) { INSTR = id === 'gitarre' ? GITARRE : KLAVIER; setNamer(INSTR === GITARRE ? guitarName : null); setLevelSet(INSTR.id); setStorySet(INSTR.id); return INSTR; }
export const isGuitar = () => INSTR === GITARRE;
