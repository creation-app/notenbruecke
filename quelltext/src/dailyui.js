// Tagesaufgabe und Eier: Leiste auf der Karte, Karte vor dem Start, Ergebnis mit Ei, Schlüpfen.
import { map, calibrate, esc } from './screens.js';
import { INSTR } from './instrument.js';
import { dailyOpen, doneToday, nest, dailyPool, completeDaily, dailyState, DAILY_MIN_LEVELS } from './daily.js';
import { EGGS, petName } from './pets.js';
import { metrics, TRAIN_COUNT } from './training.js';
import { track } from './stats.js';

const days = n => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
const dots = n => `<span class="eggdots" role="img" aria-label="${n.warm} von ${n.days} Tagen gewärmt">${Array.from({ length: n.days }, (_, i) => `<i class="${i < n.warm ? 'on' : ''}"></i>`).join('')}</span>`;
const egg = (n, size, cls = '') => `<span class="eggpic ${cls}" data-egg="${n.tier}" data-warm="${(n.warm / n.days).toFixed(3)}" data-size="${size}"></span>`;
export function dailyLevel(profile, input) { return { id: 'tagesaufgabe', type: 'train', daily: true, title: 'Tagesaufgabe', cfg: { input, range: 'daily', acc: false, len: 'count', weak: false }, pool: dailyPool(profile), theme: 'himmel', clef: 'treble', notes: [] }; }

/** Die Leiste oben auf der Karte. */
export function dailyBar(p) {
  const open = dailyOpen(p), done = doneToday(p), n = nest(p);
  const sub = !open ? `Öffnet sich nach ${DAILY_MIN_LEVELS} Leveln` : done ? 'Heute geschafft! Morgen geht es weiter.' : n ? `${TRAIN_COUNT} Noten – dann wird dein Ei wärmer. Noch ${days(n.left)}!` : `${TRAIN_COUNT} Noten – bleib in Übung!`;
  return `<button class="dailybar ${done ? 'done' : ''}" data-act="daily" ${open ? '' : 'disabled'}>${n ? egg(n, 44) : '<span data-pet="sternendrache" data-size="52"></span>'}<span class="dtxt"><b>Tagesaufgabe</b><small>${sub}</small></span>${n && open ? dots(n) : ''}${!open ? '' : done ? '<i class="cta ok">geschafft</i>' : '<i class="cta">Los!</i>'}</button>`;
}

/** Karte vor dem Start: das Nest, worum es geht, und die Wahl zwischen Spielen und Namen antippen. */
export function dailyCard(app, msg = '') {
  const p = app.profile, n = nest(p), done = doneToday(p), st = dailyState(p), mic = app.audio.micState, noMic = !app.keysOn && (mic === 'denied' || mic === 'unsupported');
  const start = input => { app.runLevel(dailyLevel(p, input)); };
  const play = async keys => { app.audio.ensure(); if (keys) app.keysSession = true; if (!app.keysOn) { app.audio.micState = app.audio.micState === 'on' ? 'on' : 'off'; const r = await app.audio.startMic(); if (r !== 'on') return dailyCard(app, 'Das Mikrofon ist gerade nicht verfügbar.'); if (!p.calibrated) return calibrate(app, () => start('play')); } start('play'); };
  const nestHtml = n ? `<div class="nest">${egg(n, 132)}<div><p class="lead">${done ? `Dein Ei ist für heute warm: <b>Tag ${n.warm} von ${n.days}</b>.` : n.warm ? `Dein Ei ist schon <b>${days(n.warm)}</b> warm. Es braucht <b>${days(n.days)}</b>.` : `In deinem Nest liegt ${st.egg ? 'ein neues Ei' : 'ein Ei'}. Es braucht <b>${days(n.days)}</b> Wärme.`}</p>${dots(n)}<p class="muted">${n.tier < 2 ? 'Kleine Eier schlüpfen schnell. Später kommen große Eier mit riesigen Tieren!' : n.tier < 5 ? 'Je größer das Ei, desto größer das Tier – und desto länger braucht es.' : 'Ein riesiges Ei! Darin wächst etwas ganz Besonderes.'}</p></div></div>`
    : `<div class="nest"><span data-pet="sternendrache" data-size="132"></span><div><p class="lead">Alle ${EGGS.length} Eier sind geschlüpft. Du hast sie alle!</p><p class="muted">Die Tagesaufgabe hält dich weiter in Übung.</p></div></div>`;
  app.screen(`<div class="maphead"><div><small class="kicker">Jeden Tag einmal · etwa 2 Minuten</small><h2>Tagesaufgabe</h2></div><button class="btn sm" data-act="back">Zurück</button></div>${nestHtml}
    <p>${done ? 'Du hast die Tagesaufgabe heute schon geschafft. Du kannst nochmal üben – fürs Ei zählt es erst morgen wieder.' : `<b>${TRAIN_COUNT} Noten</b> aus allem, was du schon kennst. Was noch wackelt, kommt öfter dran.`}</p>${msg ? `<p class="note warn" role="status">${esc(msg)}</p>` : ''}
    <div class="row stick"><button class="btn ${done ? '' : 'go'} big" data-act="${noMic ? 'keys' : 'play'}">${noMic ? `Ohne Mikrofon: ${INSTR.pad}` : `Spielen ${INSTR.at}`}</button><button class="btn ${done ? '' : 'go'} big" data-act="name">Namen antippen</button></div>`,
  { back: () => map(app), play: () => play(false), keys: () => play(true), name: () => { app.audio.ensure(); start('name'); } }, 'wide');
}

const line = raw => { const m = metrics(raw); return `<b>${raw.correct}</b> Noten · <b>${m.acc} %</b> beim ersten Versuch richtig · <b>${m.npm}</b> Noten pro Minute`; };
/** Nach der Runde: Ei wärmen, vielleicht schlüpft es. */
export function dailyDone(app, level, raw) {
  const p = app.profile, before = nest(p), r = completeDaily(p); app.save(); track(r.hatched ? 'ei/' + r.hatched : r.counted ? 'tagesaufgabe' : 'tagesaufgabe/nochmal');
  if (r.hatched) return hatch(app, before, r, raw);
  const n = r.nest;
  app.screen(`<div class="petcard"><small class="kicker">Tagesaufgabe</small><h2>${r.counted ? 'Geschafft!' : 'Gut geübt!'}</h2>${n ? egg(n, 150, r.counted ? 'warm' : '') : '<span data-pet="sternendrache" data-size="150"></span>'}
    ${n ? `<p class="lead" id="dEgg">${r.counted ? `Dein Ei ist einen Tag wärmer: <b>Tag ${n.warm} von ${n.days}</b>.` : `Dein Ei war heute schon warm: <b>Tag ${n.warm} von ${n.days}</b>.`}</p>${dots(n)}<p>${r.counted ? `Noch ${days(n.left)}, dann schlüpft es. Komm morgen wieder!` : 'Morgen kannst du es weiter wärmen.'}</p>` : '<p class="lead">Stark – du bleibst in Übung!</p>'}
    <p class="muted" id="dLine">${line(raw)}</p><div class="row"><button class="btn go big" data-act="map">Weiter</button></div></div>`, { map: () => map(app) });
  app.audio.fanfare(r.counted ? 2 : 1);
}
/** Das Ei wackelt, bekommt Risse – und dann ist das Tier da. */
function hatch(app, before, r, raw) {
  const p = app.profile, id = r.hatched, next = r.nest, token = 'h' + Date.now();
  app.screen(`<div class="petcard" id="${token}"><small class="kicker">Tagesaufgabe geschafft</small><h2>Dein Ei bewegt sich …</h2>${egg({ ...before, warm: before.days }, 170, 'wiggle')}<p class="lead">Es knackt und wackelt!</p></div>`, {});
  app.audio.sfx('star');
  setTimeout(() => {
    if (!document.getElementById(token)) return; // inzwischen woanders
    app.screen(`<div class="petcard"><small class="kicker">Aus dem Ei geschlüpft</small><h2 id="hName">${esc(petName(id))}</h2><span class="hatchpet" data-pet="${id}" data-size="${before.tier >= 5 ? 240 : before.tier >= 3 ? 200 : 150}"></span><p class="lead">${esc(petName(id))} ist geschlüpft und gehört jetzt dir!</p>
      <p id="hNext">${next ? `Im Nest liegt schon das nächste Ei. Es ist größer und braucht <b>${days(next.days)}</b>.` : `Das war das letzte Ei – du hast alle ${EGGS.length} Tiere ausgebrütet!`}</p><p class="muted">${line(raw)}</p>
      <div class="row"><button class="btn" data-act="take">Als Begleiter mitnehmen</button><button class="btn go big" data-act="ok">Weiter</button></div></div>`,
    { ok: () => map(app), take: () => { p.buddy = id; app.save(); app.refreshLook(); app.audio.sfx('ok'); map(app); } });
    app.audio.fanfare(3);
  }, 1700);
}
