// Tagesaufgabe: einmal am Tag 20 Noten aus dem, was das Kind schon kennt (Unsicheres kommt öfter). Jede geschaffte Tagesaufgabe wärmt das Ei einen Tag.
import { dayKey } from './save.js';
import { ALL_NOTES, LEVELS, LEVEL_SET, skipOf } from './levels.js';
import { pool as trainPool, normalize } from './training.js';
import { N } from './music.js';
import { EGGS } from './pets.js';

export const DAILY_MIN_LEVELS = 3;
/** Stand: { last: Tag der letzten geschafften Aufgabe, egg: welches Ei gerade im Nest liegt, warm: gewärmte Tage, total: alle Tagesaufgaben }. */
export function dailyState(profile) { const d = (profile && profile.daily) || {}; return { last: typeof d.last === 'string' ? d.last : '', egg: Math.max(0, d.egg | 0), warm: Math.max(0, d.warm | 0), total: Math.max(0, d.total | 0) }; }
/** Die Tagesaufgabe öffnet sich nach den ersten drei Leveln (oder wenn die Einstufung schon weiter vorn einsteigen lässt). */
export function dailyOpen(profile) { return !!profile.unlockAll || LEVELS.filter(l => profile.levels[l.id]).length >= DAILY_MIN_LEVELS || skipOf(profile).some(s => s > 1); }
export function doneToday(profile, day = dayKey()) { return dailyState(profile).last === day; }
/** Das Ei im Nest: { tier, days, warm, left, pet, name } – oder null, wenn alle geschlüpft sind. */
export function nest(profile) { const s = dailyState(profile), e = EGGS[s.egg]; return e ? { tier: s.egg, days: e.days, warm: Math.min(s.warm, e.days), left: Math.max(0, e.days - s.warm), pet: e.pet, name: e.name } : null; }
/** Die Noten der Tagesaufgabe: alles, was schon vorkam – im passenden Schlüssel. Wer noch fast nichts kennt, bekommt die Noten der ersten Welt. */
export function dailyPool(profile) {
  const guitar = LEVEL_SET === 'gitarre', all = trainPool(normalize({ range: guitar ? 'gall' : 'both', acc: !guitar }), profile), st = profile.notes || {};
  const seenKey = k => !!st[k] && st[k].seen >= 1, bass = !guitar && Object.keys(st).some(k => { try { return seenKey(k) && N(k).step < 0; } catch (e) { return false; } }), treble = guitar || Object.keys(st).some(k => { try { return seenKey(k) && N(k).step >= 0; } catch (e) { return false; } });
  const seen = all.filter(e => seenKey(e.key) && (e.clef === 'bass' ? bass : treble || !bass));
  if (new Set(seen.map(e => e.key)).size >= 5) return seen;
  const first = ALL_NOTES[0]; return all.filter(e => first.includes(e.key) && e.clef === 'treble');
}
/** Tagesaufgabe geschafft. Zählt einmal pro Tag; schlüpft das Ei, kommt das Tier zu den Tieren. Gibt zurück, was passiert ist. */
export function completeDaily(profile, day = dayKey()) {
  const s = dailyState(profile); if (s.last === day) return { counted: false, hatched: null, ...s, nest: nest(profile) };
  s.last = day; s.total++; let hatched = null; const e = EGGS[s.egg];
  if (e) { s.warm++; if (s.warm >= e.days) { hatched = e.pet; profile.pets = [...new Set([...(Array.isArray(profile.pets) ? profile.pets : []), e.pet])]; s.egg++; s.warm = 0; } }
  profile.daily = s; return { counted: true, hatched, ...s, nest: nest(profile) };
}
