// Endlos-Modus: Springen, Notenregen und Brückenbauer ohne Ende – drei Leben, es wird immer schneller, es zählt der eigene Rekord.
import { LEVEL_SET } from './levels.js';
import { dailyPool } from './daily.js';
import { N } from './music.js';

export const ENDLESS_TYPES = ['jump', 'regen', 'bau'], ENDLESS_LIVES = 3;
export const ENDLESS_TITLE = { jump: 'Endlos-Springen', regen: 'Endlos-Notenregen', bau: 'Endlos-Brückenbauer' };
/** Rekorde getrennt je Instrument. */
export function endlessKey(type) { return (LEVEL_SET === 'gitarre' ? 'g-' : '') + type; }
export function endlessBest(profile, type) { const e = (profile.endless || {})[endlessKey(type)]; return e ? e.best || 0 : 0; }
/** Bester Lauf über alle drei Spielarten und beide Instrumente (für die Bestenliste). */
export function endlessTop(profile) { return Math.max(0, ...Object.values(profile.endless || {}).map(e => (e && e.best) || 0)); }
/** Zeit pro Note: Am Anfang großzügig, mit jeder Note etwas knapper. */
export function timeLimit(type, done) { return type === 'bau' ? Math.max(5, 12 - 0.15 * done) : Math.max(3.5, 9 - 0.12 * done); }
/** Das Level: alle Noten, die das Kind schon kennt (wie bei der Tagesaufgabe). Kommen Bass-Noten vor, wird im großen System gespielt. */
export function endlessLevel(profile, type) {
  const pool = dailyPool(profile), notes = [...new Set(pool.map(e => e.key))], grand = pool.some(e => e.clef === 'bass');
  return { id: 'endlos-' + type, type, endless: true, title: ENDLESS_TITLE[type], notes, fresh: [], len: type === 'bau' ? 300 : 400, clef: grand ? 'grand' : 'treble', theme: 'abend', accidentals: notes.some(k => N(k).alt !== 0) };
}
/** Lauf eintragen. Gibt { score, best, prevBest, newBest, runs } zurück. */
export function recordEndless(profile, type, score) {
  const key = endlessKey(type), all = profile.endless = profile.endless || {}, prev = all[key] || { best: 0, runs: 0 }; score = Math.max(0, score | 0);
  all[key] = { best: Math.max(prev.best || 0, score), runs: (prev.runs || 0) + 1 }; return { score, best: all[key].best, prevBest: prev.best || 0, newBest: score > (prev.best || 0), runs: all[key].runs };
}
export const GOALS = [10, 25, 50, 75, 100, 150, 200, 300];
export function nextGoal(score) { return GOALS.find(g => g > score) || null; }
/** Herzen und Zeitbalken für die Anzeige oben. */
export function endlessHud(lives, score, id) { return `<span class="hearts" role="img" aria-label="${lives} von ${ENDLESS_LIVES} Leben">${'<i class="on">♥</i>'.repeat(Math.max(0, lives))}${'<i>♥</i>'.repeat(Math.max(0, ENDLESS_LIVES - lives))}</span> <b id="eScore">${score}</b>${id ? ` <i class="tbar"><i id="${id}"></i></i>` : ''}`; }
