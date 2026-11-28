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
const dayNo = k => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null; };
/** Tage seit der letzten geschafften Tagesaufgabe (null: noch nie). */
export function daysSince(profile, day = dayKey()) { const a = dayNo(dailyState(profile).last), b = dayNo(day); return a == null || b == null ? null : b - a; }
/** Muss heute gespielt werden, damit das angewärmte Ei nicht kalt wird? */
export function eggAtRisk(profile, day = dayKey()) { const s = dailyState(profile); return s.warm > 0 && daysSince(profile, day) === 1; }
/** Wer einen ganzen Tag auslässt, verliert das angewärmte Ei: Es wird kalt, und im Nest liegt ein neues Ei derselben Größe. Gibt true zurück, wenn gerade eines verloren ging. */
export function coolEgg(profile, day = dayKey()) {
  const s = dailyState(profile), gap = daysSince(profile, day); if (!(s.warm > 0 && gap != null && gap >= 2)) return false;
  profile.daily = { ...s, warm: 0, cold: s.warm, lost: ((profile.daily || {}).lost | 0) + 1 }; return true;
}
/** Wie viele gewärmte Tage das zuletzt verlorene Ei hatte (0: keins verloren oder schon weitergespielt). */
export function coldDays(profile) { return ((profile && profile.daily) || {}).cold | 0; }
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
  coolEgg(profile, day); const s = dailyState(profile), lost = ((profile.daily || {}).lost | 0); if (s.last === day) return { counted: false, hatched: null, ...s, nest: nest(profile) };
  s.last = day; s.total++; let hatched = null; const e = EGGS[s.egg];
  if (e) { s.warm++; if (s.warm >= e.days) { hatched = e.pet; profile.pets = [...new Set([...(Array.isArray(profile.pets) ? profile.pets : []), e.pet])]; s.egg++; s.warm = 0; } }
  profile.daily = lost ? { ...s, lost } : s; return { counted: true, hatched, ...s, nest: nest(profile) };
}
