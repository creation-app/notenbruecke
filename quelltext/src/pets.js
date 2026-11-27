// Tiere, die man sich verdient: der Pegasus für die geschaffte zweite Welt und fünf wilde Tiere für die Level der letzten Welt.
import { levelsOf, skipOf, WORLDS } from './levels.js';
export const PEGASUS = 'pegasus', PEGASUS_WORLD = 1;
export const WILD = [['schnecke', 'Raketenschnecke'], ['krake', 'Dreiaugen-Krake'], ['eule', 'Disco-Eule'], ['drache', 'Feuerdrache'], ['phoenix', 'Feuervogel']];
const NAMES = { [PEGASUS]: 'Pegasus', ...Object.fromEntries(WILD) };
export function petName(id) { return NAMES[id] || null; }
/** Welt geschafft: jedes Level gespielt – oder die Einstufung hat die ganze Welt übersprungen. */
export function worldCleared(profile, world) { const ls = levelsOf(world); return ls.length > 0 && ((skipOf(profile)[world] || 0) >= ls.length || ls.every(l => profile.levels[l.id])); }
/** Das Level der letzten Welt, das dieses wilde Tier freischaltet. */
export function wildLevel(id) { const i = WILD.findIndex(w => w[0] === id); return i < 0 ? null : levelsOf(WORLDS.length - 1)[i] || null; }
/** Was der Spielstand gerade hergibt (für das aktuelle Instrument). */
export function earnedNow(profile) { const out = []; if (!profile) return out; if (worldCleared(profile, PEGASUS_WORLD)) out.push(PEGASUS); for (const [id] of WILD) { const l = wildLevel(id); if (l && profile.levels[l.id]) out.push(id); } return out; }
/** Einmal verdient, bleibt ein Tier (auch nach einem Wechsel des Instruments). */
export function ownedPets(profile) { return profile ? [...new Set([...(Array.isArray(profile.pets) ? profile.pets : []), ...earnedNow(profile)])].filter(petName) : []; }
export function owns(profile, id) { return ownedPets(profile).includes(id); }
/** Verdient, aber noch nicht gefeiert. */
export function duePets(profile) { const have = Array.isArray(profile.pets) ? profile.pets : []; return earnedNow(profile).filter(id => !have.includes(id)); }
