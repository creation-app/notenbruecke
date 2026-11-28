// Endlos-Modus: Leiste auf der Karte, Auswahl der Spielart, Ergebnis mit Rekord.
import { map, levelCard, esc } from './screens.js';
import { INSTR } from './instrument.js';
import { dailyOpen, DAILY_MIN_LEVELS } from './daily.js';
import { ENDLESS_TYPES, ENDLESS_TITLE, endlessBest, endlessTop, endlessLevel, nextGoal } from './endless.js';
import { nameHtml } from './music.js';

const WHAT = () => ({ jump: ['Springen', `Noten ${INSTR.onThe} spielen`], regen: ['Notenregen', 'Namen antippen'], bau: ['Brückenbauer', 'Noten ins System setzen'] });
/** Die Leiste auf der Karte (neben der Tagesaufgabe). */
export function endlessBar(p) {
  const open = dailyOpen(p), top = Math.max(0, ...ENDLESS_TYPES.map(t => endlessBest(p, t)));
  return `<button class="dailybar endbar" data-act="endless" ${open ? '' : 'disabled'}><span class="inf" aria-hidden="true">∞</span><span class="dtxt"><b>Endlos-Modus</b><small>${!open ? `Öffnet sich nach ${DAILY_MIN_LEVELS} Leveln` : top ? `Drei Leben, immer schneller. Dein Rekord: <b>${top}</b>` : 'Drei Leben, immer schneller. Wie weit kommst du?'}</small></span>${open ? '<i class="cta">Los!</i>' : ''}</button>`;
}
export function endlessCard(app) {
  const p = app.profile, W = WHAT();
  app.screen(`<div class="maphead"><div><small class="kicker">Drei Leben · es wird immer schneller</small><h2>Endlos-Modus</h2></div><button class="btn sm" data-act="back">Zurück</button></div>
    <p class="lead">Wie weit kommst du? Es kommen alle Noten dran, die du schon kennst. Jeder Fehler kostet ein Leben – und wer zu lange braucht, verliert auch eins.</p>
    <div class="endgrid">${ENDLESS_TYPES.map(t => { const b = endlessBest(p, t); return `<button class="btn opt end t-${t}" data-act="pick" data-v="${t}"><b>${W[t][0]}</b><small>${W[t][1]}</small><span class="rec">${b ? `Rekord: <b>${b}</b>` : 'Noch kein Rekord'}</span></button>`; }).join('')}</div>`,
  { back: () => map(app), pick: e => levelCard(app, endlessLevel(p, e.dataset.v)) }, 'wide');
}
export function endlessResult(app, level, r) {
  const p = app.profile, goal = nextGoal(r.best), unit = r.score === 1 ? 'Note' : 'Noten';
  app.screen(`<div class="petcard"><small class="kicker">${ENDLESS_TITLE[level.type]}</small><h2>${r.newBest ? 'Neuer Rekord!' : r.score >= r.best * 0.8 && r.score > 0 ? 'Stark gespielt!' : 'Keine Leben mehr!'}</h2><p class="bigno" id="eRes">${r.score}<small> ${unit}</small></p>
    <p id="eRec">${r.newBest ? (r.prevBest ? `Vorher waren es ${r.prevBest} – du hast dich um <b>${r.score - r.prevBest}</b> verbessert.` : 'Das ist dein erster Rekord in dieser Spielart.') : `Dein Rekord: <b>${r.best}</b> ${r.best === 1 ? 'Note' : 'Noten'}.${r.best - r.score <= 3 && r.score > 0 ? ' Ganz knapp!' : ''}`}</p>
    ${goal ? `<p class="muted" id="eGoal">Nächstes Ziel: <b>${goal}</b> Noten.</p>` : ''}${r.freed.length ? `<p class="muted">Neu in deiner Sammlung: ${r.freed.map(n => `<b>${nameHtml(n)}</b>`).join(', ')}</p>` : ''}
    <div class="row"><button class="btn" data-act="map">Karte</button><button class="btn" data-act="other">Andere Spielart</button><button class="btn go" data-act="again">Nochmal</button></div></div>`,
  { map: () => map(app), other: () => endlessCard(app), again: () => levelCard(app, endlessLevel(p, level.type)) });
  app.audio.fanfare(r.newBest ? 3 : 1);
}
export { endlessTop };
