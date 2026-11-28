// Tiere, die man sich verdient: der Pegasus für die geschaffte zweite Welt und fünf wilde Tiere für die Level der letzten Welt.
import { levelsOf, WORLDS, worldCleared } from './levels.js';
export { worldCleared };
export const PEGASUS = 'pegasus', PEGASUS_WORLD = 1;
export const WILD = [['schnecke', 'Raketenschnecke'], ['krake', 'Dreiaugen-Krake'], ['eule', 'Disco-Eule'], ['drache', 'Feuerdrache'], ['phoenix', 'Feuervogel']];
/** Tiere aus Eiern (Tagesaufgabe): erst kleine Eier, die schnell schlüpfen, später große mit riesigen Tieren. days = so viele Tagesaufgaben braucht das Ei. */
export const EGGS = [{ pet: 'kueken', name: 'Piepmatz', days: 2 }, { pet: 'schildi', name: 'Schildi', days: 3 }, { pet: 'pinguin', name: 'Pinguin Pit', days: 4 }, { pet: 'flatterdino', name: 'Flatterdino', days: 6 }, { pet: 'rex', name: 'Donner-Rex', days: 8 }, { pet: 'wolkenwal', name: 'Wolkenwal', days: 10 }, { pet: 'sternendrache', name: 'Sternendrache', days: 14 }];
const NAMES = { [PEGASUS]: 'Pegasus', ...Object.fromEntries(WILD), ...Object.fromEntries(EGGS.map(e => [e.pet, e.name])) };
export function petName(id) { return NAMES[id] || null; }
/** Das Level der letzten Welt, das dieses wilde Tier freischaltet. */
export function wildLevel(id) { const i = WILD.findIndex(w => w[0] === id); return i < 0 ? null : levelsOf(WORLDS.length - 1)[i] || null; }
/** Was der Spielstand gerade hergibt (für das aktuelle Instrument). */
export function earnedNow(profile) { const out = []; if (!profile) return out; if (worldCleared(profile, PEGASUS_WORLD)) out.push(PEGASUS); for (const [id] of WILD) { const l = wildLevel(id); if (l && profile.levels[l.id]) out.push(id); } return out; }
/** Einmal verdient, bleibt ein Tier (auch nach einem Wechsel des Instruments). */
export function ownedPets(profile) { return profile ? [...new Set([...(Array.isArray(profile.pets) ? profile.pets : []), ...earnedNow(profile)])].filter(petName) : []; }
export function owns(profile, id) { return ownedPets(profile).includes(id); }
/** Verdient, aber noch nicht gefeiert. */
export function duePets(profile) { const have = Array.isArray(profile.pets) ? profile.pets : []; return earnedNow(profile).filter(id => !have.includes(id)); }
