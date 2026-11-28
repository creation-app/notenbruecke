// Liederwelt: Leiste auf der Karte, Liederbuch, Karte eines Lieds, Ergebnis.
import { map, calibrate, esc, stars } from './screens.js';
import { INSTR } from './instrument.js';
import { N, nameHtml } from './music.js';
import { songs, songById, songRec, songOpen, missingNotes, TEMPOS, songStarTotal } from './songs.js';

export function songLevel(song, mode, bpm) { return { id: 'lied-' + song.id, type: 'song', song, mode, bpm: bpm || song.bpm, title: song.title, theme: 'abend', clef: 'treble', notes: song.keys, fresh: [] }; }
const played = p => songs().filter(s => songRec(p, s.id).step > 0).length;
/** Die Leiste auf der Karte. */
export function songBar(p) {
  const all = songs(), open = all.filter(s => songOpen(p, s)).length, done = played(p);
  return `<button class="dailybar songbar" data-act="songs"><span class="inf" aria-hidden="true">♪</span><span class="dtxt"><b>Liederbuch</b><small>${done ? `<b>${done}</b> von ${all.length} Liedern gespielt` : open ? `Echte Lieder vom Blatt spielen – ${open === 1 ? '1 Lied ist' : open + ' Lieder sind'} offen` : 'Echte Lieder vom Blatt – lerne noch ein paar Noten'}</small></span><i class="cta">${open ? 'Los!' : 'Ansehen'}</i></button>`;
}
export function songBook(app) {
  const p = app.profile; app.backdrop('abend');
  app.screen(`<div class="maphead"><div><small class="kicker">Echte Lieder vom Blatt · ${songStarTotal(p)} von ${songs().length * 6} Sternen</small><h2>Liederbuch</h2></div><button class="btn sm" data-act="back">Zurück</button></div>
    <p class="lead">Ein Lied öffnet sich, sobald du alle seine Noten kennst. Erst <b>Note für Note</b>, dann <b>im Tempo</b>.</p>
    <div class="nodes songs">${songs().map((s, i) => { const r = songRec(p, s.id), miss = missingNotes(p, s), open = !miss.length; return `<button class="node song ${r.step ? 'done' : ''}" ${open ? '' : 'disabled'} data-act="song" data-id="${s.id}"><span class="num">${i + 1}</span><b>${esc(s.title)}</b><small>${esc(s.from)}</small>${open ? `<span class="srow"><small>Note für Note</small>${stars(r.step)}</span><span class="srow"><small>Im Tempo</small>${stars(r.tempo)}</span>` : `<small class="lock">Dafür fehlt dir noch: ${miss.slice(0, 4).map(k => nameHtml(N(k))).join(', ')}${miss.length > 4 ? ' …' : ''}</small>`}</button>`; }).join('')}</div>`,
  { back: () => map(app), song: e => songCard(app, songById(e.dataset.id)) }, 'wide');
}
export function songCard(app, song, msg = '') {
  const p = app.profile, r = songRec(p, song.id), mic = app.audio.micState, noMic = !app.keysOn && (mic === 'denied' || mic === 'unsupported'); let tempo = app._songTempo == null ? 0 : app._songTempo;
  const run = (mode, bpm) => app.runLevel(songLevel(song, mode, bpm));
  const play = async (mode, keys) => { app.audio.ensure(); if (keys) app.keysSession = true; const bpm = song.bpm * TEMPOS[tempo][1];
    if (!app.keysOn) { app.audio.micState = app.audio.micState === 'on' ? 'on' : 'off'; const res = await app.audio.startMic(); if (res !== 'on') return songCard(app, song, 'Das Mikrofon ist gerade nicht verfügbar.'); if (!p.calibrated) return calibrate(app, () => run(mode, bpm)); } run(mode, bpm); };
  const render = () => app.screen(`<div class="maphead"><div><small class="kicker">Liederbuch · ${esc(song.from)}</small><h2>${esc(song.title)}</h2></div><button class="btn sm" data-act="back">Zurück</button></div>
    <p class="lead">Noten in diesem Lied: ${song.keys.map(k => `<b>${nameHtml(N(k))}</b>`).join(', ')} · ${song.notes.length} Noten im ${song.meter}/4-Takt</p>${msg ? `<p class="note warn" role="status">${esc(msg)}</p>` : ''}
    <div class="songmodes">
      <div class="card"><h3>1. Anhören</h3><p>Hör dir das Lied an und lies mit.</p><button class="btn" data-act="listen">Anhören</button></div>
      <div class="card"><h3>2. Note für Note ${stars(r.step)}</h3><p>Spiele das Lied in deinem Tempo. Wenn eine Note nicht stimmt, bekommst du Hilfe.</p><button class="btn go" data-act="${noMic ? 'stepkeys' : 'step'}">${noMic ? `Ohne Mikrofon: ${INSTR.pad}` : `Spielen ${INSTR.at}`}</button></div>
      <div class="card ${r.step ? '' : 'off'}"><h3>3. Im Tempo ${stars(r.tempo)}</h3>${r.step ? `<p>Spiele im Takt – wie in echter Musik.${r.bpm ? ` Dein schnellstes Tempo: <b>${r.bpm}</b>.` : ''}</p><div class="row tight" role="group" aria-label="Tempo">${TEMPOS.map(([nm, f], i) => `<button class="btn sm seg ${i === tempo ? 'sel' : ''}" data-act="tempo" data-v="${i}" aria-pressed="${i === tempo}">${nm} <small>${Math.round(song.bpm * f)}</small></button>`).join('')}</div><button class="btn go" data-act="${noMic ? 'tempokeys' : 'playtempo'}">${noMic ? `Ohne Mikrofon: ${INSTR.pad}` : 'Im Tempo spielen'}</button>` : '<p class="muted">Öffnet sich, wenn du das Lied einmal Note für Note gespielt hast.</p>'}</div>
    </div>`, { back: () => songBook(app), listen: () => { app.audio.ensure(); run('listen', song.bpm); }, step: () => play('step', false), stepkeys: () => play('step', true), playtempo: () => play('tempo', false), tempokeys: () => play('tempo', true), tempo: e => { tempo = +e.dataset.v; app._songTempo = tempo; render(); } }, 'wide');
  render();
}
export function songResult(app, level, r) {
  const song = level.song, tempo = level.mode === 'tempo', next = songs()[songs().indexOf(song) + 1], p = app.profile;
  const head = tempo ? (r.stars === 3 ? 'Wie ein Profi!' : r.stars === 2 ? 'Schön im Takt!' : r.stars === 1 ? 'Geschafft!' : 'Noch nicht ganz …') : r.stars === 3 ? 'Wunderschön gespielt!' : r.stars === 2 ? 'Gut gespielt!' : 'Lied geschafft!';
  app.screen(`<div class="petcard"><small class="kicker">${esc(song.title)} · ${tempo ? `im Tempo (${Math.round(level.bpm)})` : 'Note für Note'}</small><h2>${head}</h2>${stars(r.stars, 'huge pop')}
    <p id="sLine">${tempo ? `<b>${r.hits} von ${r.n}</b> Noten im Takt gespielt` : `Beim ersten Versuch richtig: <b>${r.hits} von ${r.n}</b>`}</p>
    <p class="muted" id="sHint">${tempo ? (r.stars === 0 ? 'Probier es mit einem langsameren Tempo – oder nochmal Note für Note.' : r.stars < 3 ? 'Für drei Sterne: mindestens 9 von 10 Noten im Takt.' : level.bpm < song.bpm - 1 ? 'Stark! Schaffst du es auch schneller?' : 'Besser geht es nicht!') : r.first ? 'Jetzt kannst du das Lied auch <b>im Tempo</b> spielen.' : r.stars < 3 ? 'Für drei Sterne: mindestens 9 von 10 Noten beim ersten Versuch.' : 'Alles richtig gelesen!'}</p>
    <div class="row"><button class="btn" data-act="book">Liederbuch</button><button class="btn" data-act="again">Nochmal</button>${!tempo ? '<button class="btn go" data-act="tempo">Im Tempo spielen</button>' : next && songOpen(p, next) && r.stars > 0 ? '<button class="btn go" data-act="next">Nächstes Lied</button>' : ''}</div></div>`,
  { book: () => songBook(app), again: () => songCard(app, song), tempo: () => songCard(app, song), next: () => songCard(app, next) });
  app.audio.fanfare(Math.max(1, r.stars));
}
