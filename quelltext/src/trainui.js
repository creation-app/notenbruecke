// Bildschirme für das freie Training: Auswahl, Ergebnis, Karte im Übungspass.
import { map, calibrate, paywall, esc, stars } from './screens.js';
import { CONFIG } from './config.js';
import { N, nameHtml } from './music.js';
import * as T from './training.js';
import { INSTR, isGuitar } from './instrument.js';

const THEME = { treble: 'himmel', bass: 'tiefe', both: 'abend', g0: 'himmel', g1: 'zauber', g2: 'tiefe', gall: 'abend' };
export function trainLevel(cfg) { return { id: 'training', type: 'train', title: 'Training', cfg, theme: cfg.weak ? 'himmel' : cfg.acc ? 'zauber' : THEME[cfg.range], clef: 'treble', notes: [] }; }

/** Auswahl vor der Runde: drei Fragen, die letzte Auswahl ist vorbelegt. */
export function trainSetup(app, preset, back) {
  back = back || (() => map(app)); app.backdrop('himmel');
  const p = app.profile, full = !(CONFIG.shop && !app.licensed), weakN = T.weakNotes(p).length; let cfg = T.normalize({ ...(p.trainCfg || {}), ...(preset || {}) });
  const R0 = T.RANGES[INSTR.id][0], fix = () => { if (!full) { cfg.range = R0; cfg.acc = false; cfg.weak = false; } if (cfg.weak && weakN < T.WEAK_MIN) cfg.weak = false; cfg = T.normalize(cfg); }; fix();
  const start = () => { p.trainCfg = { ...cfg }; app.save(); app.runLevel(trainLevel(cfg)); };
  const go = async keys => { app.audio.ensure(); if (keys) app.keysSession = true;
    if (cfg.input === 'play' && !app.keysOn) { app.audio.micState = app.audio.micState === 'on' ? 'on' : 'off'; const r = await app.audio.startMic(); if (r !== 'on') return render(); if (!p.calibrated) return calibrate(app, start); } start(); };
  const seg = (act, v, on, title, sub, o = {}) => `<button class="btn opt seg ${on ? 'sel' : ''}" data-act="${act}" data-v="${v}" ${o.dis ? 'disabled' : ''} aria-pressed="${on}"><b>${title}</b><small>${o.lock ? 'Nur in der Vollversion' : sub}</small></button>`;
  const render = () => {
    const mic = app.audio.micState, keys = app.keysOn, play = cfg.input === 'play', blocked = play && !keys && (mic === 'denied' || mic === 'unsupported'), d = T.disc(cfg), t = d && p.train && p.train[d], accOff = cfg.range === 'bass' || cfg.weak;
    const micLine = !play ? '' : keys ? `<p class="note">Du spielst mit: ${INSTR.pad}.</p>` : mic === 'on' ? '<p class="note ok">Mikrofon ist an.</p>' : mic === 'off' ? `<p class="note">${INSTR.place} Das Spiel fragt gleich nach dem Mikrofon.</p>`
      : `<p class="note warn">${mic === 'denied' ? 'Das Mikrofon wurde nicht erlaubt.' : 'Hier gibt es kein Mikrofon.'} Du kannst ohne Mikrofon spielen (${INSTR.pad}) oder „Namen antippen“ wählen.</p>`;
    const rec = cfg.weak ? 'Hier geht es nur ums Üben: Wackelnoten-Runden zählen nicht als Rekord.' : t && t.best ? `Dein Rekord hier: <b>${t.best}</b> Noten pro Minute.` : 'Hier hast du noch keinen Rekord.';
    app.screen(`<div class="maphead"><div><small class="kicker">Tempo und Treffsicherheit</small><h2>Training</h2></div><button class="btn sm" data-act="back">Zurück</button></div>
      <h3 class="segq">1. Wie antwortest du?</h3><div class="segrow c2">${seg('in', 'play', play, INSTR.play, isGuitar() ? 'Mit Mikrofon – die richtige Saite zählt' : 'Mit Mikrofon – die richtige Oktave zählt')}${seg('in', 'name', !play, 'Namen antippen', 'Ohne Klavier, nur lesen')}</div>
      <h3 class="segq">2. Welche Noten?</h3>${isGuitar() ? `<div class="segrow c4">${[['g0', 'e-Saite und h-Saite'], ['g1', 'g-Saite und d-Saite'], ['g2', 'A-Saite und E-Saite'], ['gall', 'Alle 17 Töne']].map(([v, sub], i) => seg('range', v, !cfg.weak && cfg.range === v, T.rangeLabel(v), sub, { lock: !full && i > 0 })).join('')}</div>
      <button class="toggle ${cfg.weak ? 'on' : ''}" data-act="range" data-v="${cfg.weak ? cfg.range : 'weak'}" role="switch" aria-checked="${cfg.weak}" ${full && weakN < T.WEAK_MIN ? 'disabled' : ''}><i></i><span><b>Nur meine Wackelnoten</b><small>${!full ? 'Nur in der Vollversion' : weakN >= T.WEAK_MIN ? `${weakN} Noten, die noch nicht sitzen` : 'Erst ab 3 unsicheren Noten'}</small></span></button>`
      : `<div class="segrow c4">${seg('range', 'treble', !cfg.weak && cfg.range === 'treble', 'Violinschlüssel', 'c<sup>1</sup> bis a<sup>2</sup>')}${seg('range', 'bass', !cfg.weak && cfg.range === 'bass', 'Bassschlüssel', 'C bis c<sup>1</sup>', { lock: !full })}${seg('range', 'both', !cfg.weak && cfg.range === 'both', 'Beide Schlüssel', 'Die Schlüssel wechseln', { lock: !full })}${seg('range', 'weak', cfg.weak, 'Meine Wackelnoten', weakN >= T.WEAK_MIN ? `${weakN} Noten, die noch nicht sitzen` : 'Erst ab 3 unsicheren Noten', { dis: full && weakN < T.WEAK_MIN, lock: !full })}</div>
      <button class="toggle ${cfg.acc ? 'on' : ''}" data-act="acc" role="switch" aria-checked="${cfg.acc}" ${accOff ? 'disabled' : ''}><i></i><span><b>Mit Vorzeichen (♯ und ♭)</b><small>${!full ? 'Nur in der Vollversion' : accOff ? 'Gibt es bisher nur im Violinschlüssel' : 'Kreuze und Bes aus dem Land der Zauberzeichen'}</small></span></button>`}
      <h3 class="segq">3. Wie lange?</h3><div class="segrow c2">${seg('len', 'time', cfg.len === 'time', '60 Sekunden', 'So viele Noten wie möglich')}${seg('len', 'count', cfg.len === 'count', '20 Noten', 'In Ruhe – die Uhr läuft nur mit')}</div>
      <p class="note" id="trainRec">${rec}</p>${micLine}
      <div class="row stick">${blocked ? `<button class="btn go" data-act="keys">Ohne Mikrofon: ${INSTR.pad}</button><button class="btn" data-act="go">Mikrofon nochmal versuchen</button>` : '<button class="btn go big" data-act="go">Los!</button>'}</div>`, {
      back, go: () => go(false), keys: () => go(true), in: e => { cfg.input = e.dataset.v; fix(); render(); }, len: e => { cfg.len = e.dataset.v; fix(); render(); },
      range: e => { const v = e.dataset.v; if (!full && v !== R0) return paywall(app, null); if (v === 'weak') cfg.weak = true; else { cfg.weak = false; cfg.range = v; } fix(); render(); },
      acc: () => { if (!full) return paywall(app, null); cfg.acc = !cfg.acc; fix(); render(); } }, 'wide');
  };
  render();
}

const sec = ms => (ms / 1000).toFixed(1).replace('.', ',');
export function trainResult(app, level, r) {
  const cfg = level.cfg, slow = T.slowest(r.times), setup = () => trainSetup(app, cfg);
  const head = r.newBest ? 'Neuer Rekord!' : r.counted && r.acc >= 90 ? 'Stark gespielt!' : 'Runde geschafft!';
  const cmp = r.newBest ? (r.prevBest ? `Vorher waren es ${r.prevBest} – du hast dich um <b>${r.npm - r.prevBest}</b> verbessert.` : 'Das ist deine erste Bestmarke in dieser Disziplin.')
    : r.counted ? `Dein Rekord: <b>${r.best}</b> Noten pro Minute.${r.best - r.npm <= 3 ? ' Ganz knapp!' : ''}`
      : r.why === 'weak' ? 'Wackelnoten-Runden zählen nicht als Rekord. Sie machen deine unsicheren Noten sicherer.' : r.why === 'few' ? 'Für einen Rekord brauchst du mindestens 5 richtige Noten.' : `Für einen Rekord brauchst du mindestens ${T.RECORD_MIN_ACC} % Treffer. Erst genau, dann schnell!`;
  const st = cfg.len === 'time' && r.disc ? `<div class="trstars">${stars(r.stars)}<span>${r.starsGained ? `<b>+${r.starsGained} ${r.starsGained === 1 ? 'Stern' : 'Sterne'}</b> für deine Hüte! ` : ''}${r.nextStar ? `Nächster Stern ab <b>${r.nextStar}</b> Noten pro Minute mit mindestens ${T.STAR_MIN_ACC} % Treffern.` : 'Alle drei Sterne geholt!'}</span></div>` : '';
  app.screen(`<small class="kicker">${esc(T.discLabel(cfg))}</small><h2>${head}</h2>
    <div class="trnums"><div><p class="bigno" id="trNpm">${r.npm}</p><b>Noten pro Minute</b></div><div><p class="bigno" id="trAcc">${r.acc}<small> %</small></p><b>beim ersten Versuch richtig</b></div></div>
    <p>${cfg.len === 'count' ? `${r.correct} Noten in ${sec(r.ms)} Sekunden. ` : `${r.correct} Noten in 60 Sekunden. `}<span id="trCmp">${cmp}</span></p>${st}
    ${slow.length ? `<p class="note">Am längsten gebraucht: ${slow.map(e => `<b>${nameHtml(N(e.key))}</b> (${sec(e.ms)} s)`).join(', ')}</p>` : ''}
    ${r.freed.length ? `<div class="freed"><p>Neu in deiner Sammlung:</p><div class="row tight">${r.freed.map(n => `<span class="crcard"><span data-cr="${n.key}"></span><b>${nameHtml(n)}</b></span>`).join('')}</div></div>` : ''}
    <div class="row"><button class="btn" data-act="map">Karte</button><button class="btn" data-act="setup">Andere Auswahl</button><button class="btn go" data-act="again">Nochmal</button></div>`, {
    map: () => map(app), setup, again: () => { app.audio.ensure(); app.runLevel(level); } });
  app.audio.fanfare(r.newBest ? 3 : r.counted ? 2 : 1);
}

/** Verlauf der letzten Runden als kleine Kurve. */
function spark(runs) {
  const v = runs.slice(-12).map(x => x.n), lo = Math.min(...v), hi = Math.max(...v), W = 190, H = 46, x = i => v.length < 2 ? W / 2 : 8 + i * (W - 16) / (v.length - 1), y = n => hi === lo ? H / 2 : H - 8 - (n - lo) * (H - 16) / (hi - lo);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Verlauf der letzten Runden: ${v.join(', ')} Noten pro Minute"><polyline fill="none" stroke="#2998E8" stroke-width="3" points="${v.map((n, i) => `${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ')}"/>${v.map((n, i) => `<rect x="${(x(i) - 3).toFixed(1)}" y="${(y(n) - 3).toFixed(1)}" width="6" height="6" fill="${i === v.length - 1 ? '#FF9D35' : '#26364B'}"/>`).join('')}</svg>`;
}
/** Inhalt der Trainings-Karte im Übungspass. */
export function trainCard(p) {
  const ds = Object.values(p.train || {}).filter(t => t.runs && t.runs.length); if (!ds.length) return '<p class="muted">Noch keine Trainingsrunde gespielt.</p>';
  return ds.map(t => { const last = t.runs[t.runs.length - 1]; return `<div class="trow"><div><b>${esc(T.discLabel(T.normalize(t.cfg)))}</b>${t.stars ? ' ' + stars(t.stars) : ''}<br><small>Rekord: <b>${t.best || '–'}</b> Noten pro Minute · zuletzt ${last.n} mit ${last.a} % Treffern · ${t.runs.length} ${t.runs.length === 1 ? 'Runde' : 'Runden'}</small></div>${spark(t.runs)}</div>`; }).join('');
}
