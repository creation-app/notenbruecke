// Menüs und Übersichten (DOM über der Pixelwelt).
import { N, nameHtml, nameStr, noteOfMidi, midiOf, staffPos, describePos, ledgerPositions } from './music.js';
import { WORLDS, LEVELS, TYPE_LABEL, ALL_NOTES, levelsOf, doneCount, worldUnlocked, levelUnlocked, nextLevel, totalStars, creatureTotal, PLACEMENT, PLACEMENT_Q, PLACEMENT_PASS } from './levels.js';
import { letterName } from './music.js';
import { HEROES, makeHero, makeCreature, cv, drawStaff, drawClef, drawNote, drawLedgers, yOfPos, C } from './gfx.js';
import { newProfile, exportCode, importCode, exportShort, importShort, streak, dayKey } from './save.js';
import { isMastered, topConfusions } from './srs.js';
import { a4FromCents } from './pitch.js';
import { INTRO, WORLD_INTRO, WORLD_OUTRO, LEVEL_STORY } from './story.js';
import { fmtTime } from './jump.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = (n, cls = '') => `<span class="stars ${cls}" role="img" aria-label="${n} von 3 Sternen">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const safeN = k => { try { return N(k); } catch (e) { return null; } };
function crCanvas(key, locked, size = 64) { const n = N(key), c = makeCreature(((n.step % 7) + 7) % 7, n.alt, locked); c.style.width = c.style.height = size + 'px'; c.className = 'pix'; c.setAttribute('aria-hidden', 'true'); return c; }
function heroCanvas(i, size = 72) { const c = makeHero(i).idle0; c.style.width = size + 'px'; c.style.height = size * 24 / 18 + 'px'; c.className = 'pix'; c.setAttribute('aria-hidden', 'true'); return c; }
export function fill(root) { root.querySelectorAll('[data-cr]').forEach(e => e.appendChild(crCanvas(e.dataset.cr, e.dataset.locked === '1', +e.dataset.size || 64))); root.querySelectorAll('[data-hero]').forEach(e => e.appendChild(heroCanvas(+e.dataset.hero, +e.dataset.size || 72))); }

export function title(app) {
  app.backdrop('himmel'); const has = app.state.profiles.length > 0;
  app.screen(`<div class="title"><div class="logo">DIE<br>NOTENBRÜCKE</div><p class="sub">Ein Abenteuer auf fünf Linien</p>
    <button class="btn big" data-act="go">${has ? 'Spielen' : 'Neues Spiel'}</button></div>`, { go: () => { app.audio.ensure(); app.audio.sfx('click'); has ? profiles(app) : newProf(app); } }, 'clear');
}
export function profiles(app) {
  app.backdrop('himmel');
  app.screen(`<h2>Wer spielt?</h2><div class="plist">${app.state.profiles.map(p => `<button class="pcard" data-act="pick" data-id="${p.id}"><span data-hero="${p.hero}"></span><b>${esc(p.name)}</b><small>${totalStars(p)} Sterne · ${p.creatures.length} Notenwesen</small></button>`).join('')}
    <button class="pcard new" data-act="new"><span class="plus">+</span><b>Neu</b><small>Neues Profil</small></button></div>
    <div class="row"><button class="btn" data-act="code">Spielstand-Code eingeben</button></div>`, {
    pick: e => { app.state.current = e.dataset.id; app.save(); app.applyProfile(); map(app); }, new: () => newProf(app), code: () => importScreen(app) });
}
function newProf(app) {
  let hero = 0, mode = 'abenteuer';
  const render = () => app.screen(`<h2>Neues Profil</h2><label class="fld">Dein Name<input id="pname" maxlength="14" autocomplete="off" value="${esc(app._pn || '')}"></label>
    <div class="fld">Deine Figur<div class="heroes">${HEROES.map((h, i) => `<button class="hpick ${i === hero ? 'sel' : ''}" data-act="hero" data-i="${i}" aria-label="Figur ${h.name}"><span data-hero="${i}" data-size="60"></span></button>`).join('')}</div></div>
    <div class="fld">So möchte ich spielen<div class="row"><button class="btn opt ${mode === 'abenteuer' ? 'sel' : ''}" data-act="mode" data-m="abenteuer"><b>Abenteuer</b><small>Mit mehr Tipps und ohne Zeitdruck</small></button>
    <button class="btn opt ${mode === 'profi' ? 'sel' : ''}" data-act="mode" data-m="profi"><b>Profi</b><small>Mit Stoppuhr, Serien und weniger Tipps</small></button></div></div>
    <p class="err" id="perr" role="alert"></p><div class="row">${app.state.profiles.length ? '<button class="btn" data-act="back">Zurück</button>' : ''}<button class="btn go" data-act="ok">Los geht’s</button></div>`, {
    hero: e => { keep(); hero = +e.dataset.i; render(); }, mode: e => { keep(); mode = e.dataset.m; render(); }, back: () => profiles(app),
    ok: () => { const name = document.getElementById('pname').value.trim(); if (!name) { document.getElementById('perr').textContent = 'Bitte gib einen Namen ein.'; return; }
      const p = newProfile(name, hero, mode); app.state.profiles.push(p); app.state.current = p.id; app._pn = ''; app.save(); app.applyProfile(); story(app, INTRO, () => { p.seenIntro = true; app.save(); askLevel(app); }); } });
  const keep = () => { app._pn = document.getElementById('pname').value; };
  render();
}
function importScreen(app, back) {
  app.screen(`<h2>Spielstand-Code eingeben</h2><p>Tippe deinen Kurzcode ein (20 Zeichen) oder füge eine vollständige Sicherung ein.</p><textarea id="codeIn" rows="3" spellcheck="false" autocapitalize="characters" aria-label="Spielstand-Code"></textarea>
    <label class="fld">Dein Name (nur beim Kurzcode nötig)<input id="codeName" maxlength="14" autocomplete="off"></label><p class="err" id="cerr" role="alert"></p>
    <div class="row"><button class="btn" data-act="back">Zurück</button><button class="btn go" data-act="ok">Laden</button></div>`, { back: () => (back || profiles)(app),
    ok: () => { try { const raw = document.getElementById('codeIn').value.trim(); let p;
      if (/^NB1\./.test(raw)) p = importCode(raw); else { p = importShort(raw, LEVELS.map(l => l.id)); const nm = document.getElementById('codeName').value.trim(); if (!nm) throw new Error('Bitte gib noch deinen Namen ein.'); p.name = nm.slice(0, 14);
        LEVELS.forEach(l => { if (p.levels[l.id] && l.type !== 'regen') l.notes.forEach(k => { if (!p.creatures.includes(k)) p.creatures.push(k); p.notes[k] = p.notes[k] || { box: 2, seen: 1, ok: 1 }; }); }); p.seenWorld = { 0: 1, 1: 1, 2: 1 }; p.calibrated = false; }
      const i = app.state.profiles.findIndex(q => q.id === p.id); if (i >= 0) app.state.profiles[i] = p; else app.state.profiles.push(p);
      app.state.current = p.id; app.save(); app.applyProfile(); map(app); } catch (e) { document.getElementById('cerr').textContent = e.message; } } });
}

function askLevel(app) {
  app.screen(`<h2>Kennst du schon Noten?</h2><p>Wer schon Noten lesen kann, muss nicht ganz vorne anfangen. Ein kurzer Test (ohne Klavier, etwa zwei Minuten) findet den passenden Einstieg.</p>
    <div class="row"><button class="btn opt" data-act="new"><b>Ich fange neu an</b><small>Los geht es mit den ersten zwei Tönen</small></button><button class="btn opt go" data-act="test"><b>Ich kann schon etwas</b><small>Kurzer Test für den richtigen Einstieg</small></button></div>`, { new: () => map(app), test: () => placement(app, () => map(app)) });
}
/** Einstufung: Stufe für Stufe Noten benennen. Bei der ersten nicht bestandenen Stufe ist Schluss. */
export function placement(app, then) {
  const p = app.profile; let si = 0, qi = 0, right = 0, cur = null, last = null, reached = null, fb = '';
  const order = ['c', 'cis', 'des', 'd', 'es', 'e', 'f', 'fis', 'g', 'gis', 'as', 'a', 'b', 'h'];
  const pick = () => { const st = PLACEMENT[si]; let k; do { k = st.notes[Math.floor(Math.random() * st.notes.length)]; } while (k === last && st.notes.length > 1); last = k; cur = N(k); };
  const finish = () => { const done = reached; if (done) { p.skip = done.skip.map((v, i) => Math.max(v, (p.skip || [])[i] || 0)); p.seenWorld = p.seenWorld || {}; } app.save();
    const w = done ? (done.skip[2] ? 2 : done.skip[1] ? 1 : 0) : 0, start = done ? levelsOf(w)[Math.min(done.skip[w], levelsOf(w).length) - 1] : null;
    app.screen(`<h2>${done ? 'Dein Einstieg steht fest' : 'Du startest am Anfang'}</h2><p class="lead">${done ? `Sicher gelesen: <b>${esc(done.name)}</b>.` : 'Das macht nichts: Im ersten Level lernst du die Noten Schritt für Schritt.'}</p>
      ${start ? `<p>Du kannst jetzt direkt bei <b>${esc(start.title)}</b> in „${esc(WORLDS[w].name)}“ einsteigen. Alle Level davor sind offen, falls du sie trotzdem spielen möchtest.</p>` : ''}<div class="row"><button class="btn go" data-act="ok">Zur Karte</button></div>`, { ok: () => { if (done) p.lastWorld = w; then(); } }); };
  const render = () => { const st = PLACEMENT[si], names = [...new Set((si === 5 ? [...st.notes, 'f1', 'h1', 'c2', 'e2', 'g1', 'a1', 'd2'] : ['c1', 'd1', 'e1', 'f1', 'g1', 'a1', 'h1']).map(k => letterName(N(k))))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    app.screen(`<small class="kicker">Einstufung · Stufe ${si + 1} von ${PLACEMENT.length} · ${esc(st.name)}</small><h2>Wie heißt diese Note?</h2><div class="place"><div id="plStaff"></div><div><p>Frage ${qi + 1} von ${PLACEMENT_Q}</p><p class="note ${fb.startsWith('Richtig') ? 'ok' : 'warn'}" role="status">${fb}</p></div></div>
      <div class="answers small">${names.map(n => `<button class="btn ans" data-act="a" data-n="${n}">${n}</button>`).join('')}</div><div class="row"><button class="btn sm" data-act="stop">Test beenden</button></div>`, {
      stop: () => finish(), a: e => { const ok = letterName(cur) === e.dataset.n; if (ok) right++; fb = ok ? 'Richtig!' : `Das war ${nameStr(cur)}.`; app.audio.sfx(ok ? 'ok' : 'miss'); qi++;
        if (qi >= PLACEMENT_Q) { if (right >= PLACEMENT_PASS) { reached = st; si++; qi = 0; right = 0; fb = 'Stufe geschafft! Weiter geht es.'; if (si >= PLACEMENT.length) return finish(); } else return finish(); }
        pick(); render(); } }, 'wide');
    document.getElementById('plStaff').appendChild(staffCanvas(cur, st.clef)); };
  pick(); render();
}

/** Erzählbild: Text Seite für Seite. */
export function story(app, pages, then, theme) {
  app.backdrop(theme || (app.scene && app.scene.theme) || 'himmel'); let i = 0;
  const render = () => app.screen(`<div class="story"><span data-hero="${app.profile ? app.profile.hero : 0}" data-size="90"></span><p>${esc(pages[i])}</p></div>
    <div class="row"><button class="btn" data-act="skip">Überspringen</button><button class="btn go" data-act="next">${i < pages.length - 1 ? 'Weiter' : 'Los!'}</button></div>`, {
    next: () => { app.audio.sfx('click'); if (++i >= pages.length) then(); else render(); }, skip: () => then() }, 'low');
  render();
}

export function map(app, world) {
  const p = app.profile; if (world == null) world = p.lastWorld || 0; if (!worldUnlocked(p, world)) world = 0; p.lastWorld = world; p.seenWorld = p.seenWorld || {};
  const W = WORLDS[world]; app.backdrop(W.theme);
  if (!p.seenWorld[world]) { p.seenWorld[world] = 1; app.save(); return story(app, WORLD_INTRO[world], () => map(app, world), W.theme); }
  const ls = levelsOf(world);
  app.screen(`<div class="maphead"><button class="chip" data-act="prof" aria-label="Profil wechseln"><span data-hero="${p.hero}" data-size="36"></span><b>${esc(p.name)}</b></button>
    <div class="row tight"><span class="pill">${totalStars(p)} Sterne</span><button class="btn sm" data-act="coll">Sammlung ${p.creatures.length}/${creatureTotal()}</button><button class="btn sm" data-act="pass">Übungspass</button><button class="btn sm" data-act="board">Bestenliste</button><button class="btn sm" data-act="set">Einstellungen</button></div></div>
    <div class="tabs" role="tablist">${WORLDS.map((w, i) => { const open = worldUnlocked(p, i); return `<button role="tab" aria-selected="${i === world}" class="tab ${i === world ? 'sel' : ''}" ${open ? '' : 'disabled'} data-act="world" data-w="${i}">${open ? esc(w.name) : `Noch im Nebel: ${WORLDS[i].need} Level in „${WORLDS[i - 1].short}“ schaffen`}</button>`; }).join('')}</div>
    <div class="nodes">${ls.map((l, i) => { const open = levelUnlocked(p, l), rec = p.levels[l.id]; return `<button class="node t-${l.type} ${rec ? 'done' : ''}" ${open ? '' : 'disabled'} data-act="lvl" data-id="${l.id}"><span class="num">${i + 1}</span><b>${esc(l.title)}</b><small>${TYPE_LABEL[l.type]}</small>${open ? stars(rec ? rec.stars : 0) : '<small class="lock">im Nebel</small>'}</button>`; }).join('')}</div>`, {
    prof: () => profiles(app), coll: () => collection(app), pass: () => pass(app), board: () => board(app), set: () => settings(app),
    world: e => map(app, +e.dataset.w), lvl: e => levelCard(app, LEVELS.find(l => l.id === e.dataset.id)) }, 'wide');
}

export function levelCard(app, level) {
  const p = app.profile, needsPiano = level.type === 'jump' || level.type === 'boss', mic = app.audio.micState, keys = app.keysOn;
  const how = { jump: 'Lies die leuchtende Note und spiele sie auf dem Klavier. Die richtige Oktave zählt!', boss: 'Spiele die Melodie Note für Note auf dem Klavier.', regen: 'Tippe den Namen der leuchtenden Note, bevor sie das Tor erreicht. 60 Sekunden!', bau: 'Schiebe die Note an die richtige Stelle und tippe auf „Setzen“.' }[level.type];
  let micLine = '';
  if (needsPiano) micLine = keys ? '<p class="note">Du spielst mit den Bildschirm-Tasten.</p>' : mic === 'on' ? '<p class="note ok">Mikrofon ist an.</p>' : mic === 'off' ? '<p class="note">Stell dein Tablet aufs Klavier. Das Spiel fragt gleich nach dem Mikrofon.</p>' : `<p class="note warn">${mic === 'denied' ? 'Das Mikrofon wurde nicht erlaubt.' : 'Hier gibt es kein Mikrofon.'} Öffne den Link direkt in Safari oder Chrome und erlaube dort das Mikrofon. Bis dahin kannst du mit den Bildschirm-Tasten spielen.</p>`;
  const blocked = needsPiano && !keys && (mic === 'denied' || mic === 'unsupported');
  app.screen(`<small class="kicker">${esc(WORLDS[level.world].name)} · ${TYPE_LABEL[level.type]}</small><h2>${esc(level.title)}</h2><p class="lead">${esc(LEVEL_STORY[level.id] || '')}</p><p>${how}</p>${micLine}
    <div class="row"><button class="btn" data-act="back">Zurück</button>${blocked ? '<button class="btn go" data-act="keys">Mit Bildschirm-Tasten</button><button class="btn" data-act="go">Mikrofon nochmal versuchen</button>' : '<button class="btn go" data-act="go">Los!</button>'}</div>`, {
    back: () => map(app), keys: () => { app.keysSession = true; app.runLevel(level); },
    go: async () => { app.audio.ensure(); if (needsPiano && !keys) { app.audio.micState = app.audio.micState === 'on' ? 'on' : 'off'; const r = await app.audio.startMic(); if (r !== 'on') return levelCard(app, level);
      if (!p.calibrated) return calibrate(app, () => app.runLevel(level)); } app.runLevel(level); } });
}

export function calibrate(app, then) {
  const p = app.profile, cents = []; app.audio.setA4(440); let last = 'Ich höre noch nichts.';
  const finish = (skip) => { app.calib = null; if (!skip) { p.a4 = a4FromCents(cents); } p.calibrated = true; app.audio.setA4(p.a4); app.save(); then(); };
  const render = () => app.screen(`<h2>Klavier einstimmen</h2><p>Spiele dreimal nacheinander das <b>c<sup>1</sup></b> – das mittlere c. So stellt sich das Spiel auf dein Klavier ein.</p>
    <div class="calib"><div class="dots">${[0, 1, 2].map(i => `<i class="${i < cents.length ? 'on' : ''}"></i>`).join('')}</div><p id="calMsg" role="status">${last}</p><div class="meter big" id="calMeter" aria-hidden="true">${'<i></i>'.repeat(12)}</div></div>
    <div class="row"><button class="btn" data-act="skip">Überspringen</button></div>`, { skip: () => finish(true) });
  app.calib = { onNote(midi, ev) { const dev = (midi - 60) * 100 + (ev ? ev.cents : 0);
      if (Math.abs(dev) <= 80) { cents.push(dev); last = `Gut! Noch ${3 - cents.length}×`; app.audio.sfx('ok'); if (cents.length >= 3) { const c = Math.round(cents.slice().sort((a, b) => a - b)[1]);
        last = Math.abs(c) < 8 ? 'Dein Klavier ist gut gestimmt.' : `Dein Klavier klingt ${Math.abs(c)} Cent ${c > 0 ? 'höher' : 'tiefer'}. Das ist gespeichert.`; render(); app.calib = null; setTimeout(() => finish(false), 1600); return; } }
      else last = `Das war ${nameStr(noteOfMidi(midi))} – ich brauche das mittlere c.`; render(); },
    level(rms) { const m = document.getElementById('calMeter'); if (!m) return; const n = rms > 0 ? Math.max(0, Math.min(12, Math.round((Math.log10(rms) + 2.6) * 6))) : 0; [...m.children].forEach((b, i) => { b.className = i < n ? 'on' : ''; }); } };
  render();
}

export function result(app, level, res) {
  const p = app.profile, nx = nextLevel(level), lastOfWorld = !nx || nx.world !== level.world, canNext = nx && levelUnlocked(p, nx);
  const best = res.bestTime ? `<p>Deine Zeit: <b>${fmtTime(res.time)}</b>${res.newBest ? ' – neue Bestzeit!' : ` · Bestzeit ${fmtTime(res.bestTime)}`}</p>` : res.score != null ? `<p>${res.newBest ? 'Neuer Rekord!' : `Dein Rekord: <b>${res.bestScore}</b> Punkte`}</p>` : '';
  app.screen(`<h2>${res.stars === 3 ? 'Meisterhaft!' : res.stars === 2 ? 'Stark gespielt!' : 'Geschafft!'}</h2>${stars(res.stars, 'huge pop')}<p>${res.line}</p>${best}
    ${res.freed.length ? `<div class="freed"><p>Neu in deiner Sammlung:</p><div class="row tight">${res.freed.map(n => `<span class="crcard"><span data-cr="${n.key}"></span><b>${nameHtml(n)}</b></span>`).join('')}</div></div>` : ''}
    <div class="row"><button class="btn" data-act="map">Karte</button><button class="btn" data-act="again">Nochmal</button>${canNext || (lastOfWorld && res.firstClear) ? '<button class="btn go" data-act="next">Weiter</button>' : ''}</div>`, {
    map: () => map(app), again: () => levelCard(app, level),
    next: () => { if (lastOfWorld && res.firstClear) return story(app, WORLD_OUTRO[level.world], () => map(app, nx && worldUnlocked(p, nx.world) ? nx.world : level.world)); levelCard(app, nx); } });
  app.audio.sfx('star');
}
export function pause(app) {
  app.paused = true;
  app.screen(`<h2>Pause</h2><div class="col"><button class="btn go" data-act="go">Weiterspielen</button><button class="btn" data-act="again">Level neu starten</button><button class="btn" data-act="map">Zur Karte</button></div>`, {
    go: () => { app.paused = false; app.closeScreen(); }, again: () => { app.paused = false; app.runLevel(app.scene.level); }, map: () => { app.paused = false; app.flush(); map(app); } });
}

function staffCanvas(n, clef) { const c = cv(70, 80), x = c.getContext('2d'); x.translate(0, -35); const pos = staffPos(n, clef); drawStaff(x, C.K, 2, 68); drawClef(x, clef, 3, C.K); drawLedgers(x, 39, 19, ledgerPositions(pos), C.K); drawNote(x, 48, yOfPos(pos), { style: 'ink', up: pos < 4, alt: n.alt });
  c.className = 'pix staffpic'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', `${describePos(pos)} im ${clef === 'bass' ? 'Bassschlüssel' : 'Violinschlüssel'}`); return c; }
export function collection(app, sel) {
  const p = app.profile; let detail = '';
  if (sel) { const n = N(sel.key), st = p.notes[sel.key] || { box: 0, seen: 0, ok: 0 };
    detail = `<div class="crdetail"><span data-cr="${sel.key}" data-size="128"></span><div><h3>${nameHtml(n)}</h3><div id="staffHere"></div><p>${describePos(staffPos(n, sel.clef))}</p>
      <p>Sicherheit <span class="bar"><i style="width:${st.box * 25}%"></i></span></p><p>${st.ok} von ${st.seen} Mal beim ersten Versuch</p><button class="btn sm" data-act="play">Anhören</button></div></div>`; }
  app.screen(`<div class="maphead"><h2>Deine Notenwesen</h2><button class="btn sm" data-act="back">Zurück</button></div><div class="collwrap"><div class="coll">${WORLDS.map((w, wi) => `<h3>${esc(w.name)}</h3><div class="crgrid">${ALL_NOTES[wi].map(k => { const has = p.creatures.includes(k);
      return `<button class="crcard ${sel && sel.key === k && sel.clef === w.clef ? 'sel' : ''}" ${has ? '' : 'disabled'} data-act="cr" data-k="${k}" data-clef="${w.clef}"><span data-cr="${k}" data-locked="${has ? 0 : 1}" data-size="56"></span><b>${has ? nameHtml(N(k)) : '?'}</b>${has && isMastered(p.notes[k]) ? '<i class="tick" title="sicher"></i>' : ''}</button>`; }).join('')}</div>`).join('')}</div>${detail}</div>`, {
    back: () => map(app), cr: e => collection(app, { key: e.dataset.k, clef: e.dataset.clef }), play: () => app.audio.playNote(midiOf(N(sel.key))) }, 'wide');
  if (sel) { const h = document.getElementById('staffHere'); if (h) h.appendChild(staffCanvas(N(sel.key), sel.clef)); }
}

export function pass(app) {
  const p = app.profile, today = new Date(), cells = []; let week = 0, total = 0;
  for (let i = 27; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); const s = p.days[dayKey(d)] || 0; if (i < 7) week += s; cells.push(`<i class="${s >= 600 ? 'l3' : s >= 240 ? 'l2' : s > 0 ? 'l1' : ''}" title="${d.getDate()}.${d.getMonth() + 1}.: ${Math.round(s / 60)} min"></i>`); }
  Object.values(p.days).forEach(s => { total += s; });
  const known = Object.keys(p.notes).filter(k => safeN(k) && /\d|^[A-Ha-h]/.test(k)), sure = known.filter(k => isMastered(p.notes[k])), weak = known.filter(k => !isMastered(p.notes[k]) && p.notes[k].seen >= 2);
  const list = ks => ks.length ? ks.map(k => `<span class="tag">${nameHtml(N(k))}</span>`).join('') : '<span class="muted">noch keine</span>';
  const conf = topConfusions(p.conf).filter(c => safeN(c.target) && safeN(c.played));
  app.screen(`<div class="maphead"><h2>Übungspass von ${esc(p.name)}</h2><button class="btn sm" data-act="back">Zurück</button></div>
    <div class="passgrid"><div class="card"><h3>Geübt</h3><p class="bigno">${streak(p)}<small> Tage in Folge</small></p><p>Diese Woche: <b>${Math.round(week / 60)} min</b> · Insgesamt: <b>${Math.round(total / 60)} min</b></p><div class="cal" role="img" aria-label="Übungstage der letzten vier Wochen">${cells.join('')}</div><small class="muted">Die letzten 4 Wochen, heute unten rechts</small></div>
    <div class="card"><h3>Fortschritt</h3><p><b>${totalStars(p)}</b> Sterne · <b>${p.creatures.length}</b> von ${creatureTotal()} Notenwesen</p>${WORLDS.map((w, i) => `<p>${esc(w.short)}: ${doneCount(p, i)} von ${levelsOf(i).length} Leveln <span class="bar"><i style="width:${100 * doneCount(p, i) / levelsOf(i).length}%"></i></span></p>`).join('')}</div>
    <div class="card"><h3>Diese Noten sitzen sicher</h3><div class="tags">${list(sure)}</div><h3>Diese Noten noch üben</h3><div class="tags">${list(weak)}</div></div>
    <div class="card"><h3>Häufige Verwechslungen</h3>${conf.length ? conf.map(c => `<p><b>${nameHtml(N(c.target))}</b> wird oft mit <b>${nameHtml(N(c.played))}</b> verwechselt <span class="muted">(${c.n}×)</span></p>`).join('') : '<p class="muted">Bisher keine auffälligen Verwechslungen.</p>'}</div></div>`, { back: () => map(app) }, 'wide');
}
export function board(app) {
  const rows = app.state.profiles.map(p => ({ p, s: totalStars(p) })).sort((a, b) => b.s - a.s || b.p.regenBest - a.p.regenBest);
  app.screen(`<div class="maphead"><h2>Bestenliste auf diesem Gerät</h2><button class="btn sm" data-act="back">Zurück</button></div>
    <table class="board"><thead><tr><th>Platz</th><th>Name</th><th>Sterne</th><th>Notenwesen</th><th>Notenregen-Rekord</th><th>Tage in Folge</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.p.id === app.profile.id ? 'me' : ''}"><td>${i + 1}.</td><td>${esc(r.p.name)}</td><td>${r.s}</td><td>${r.p.creatures.length}</td><td>${r.p.regenBest || '–'}</td><td>${streak(r.p)}</td></tr>`).join('')}</tbody></table>
    <p class="muted">Die Liste zeigt alle Profile, die auf diesem Gerät spielen.</p>`, { back: () => map(app) }, 'wide');
}
export function settings(app, msg = '') {
  const p = app.profile, mic = { on: 'an', off: 'noch nicht eingeschaltet', denied: 'nicht erlaubt', unsupported: 'hier nicht verfügbar' }[app.audio.micState];
  const tg = (act, on, label, hint) => `<button class="toggle ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="${act}"><i></i><span><b>${label}</b><small>${hint}</small></span></button>`;
  app.screen(`<div class="maphead"><h2>Einstellungen</h2><button class="btn sm" data-act="back">Zurück</button></div><div class="setgrid">
    <div class="card"><h3>Spielen</h3>${tg('mode', p.mode === 'profi', 'Profi-Spielart', 'Stoppuhr, Serien und weniger Tipps')}${tg('keys', p.keys, 'Bildschirm-Tasten', 'Ohne Klavier spielen: Tasten antippen')}${tg('mute', !app.audio.muted, 'Spielklänge', 'Kurze Töne bei Erfolg und Fehler')}</div>
    <div class="card"><h3>Mikrofon</h3><p>Mikrofon: <b>${mic}</b></p><p>Kammerton: <b>${Math.round(p.a4 * 10) / 10} Hz</b></p><button class="btn sm" data-act="cal">Mikrofon testen und Klavier einstimmen</button><h3>Einstieg</h3><button class="btn sm" data-act="place">Einstufung machen</button></div>
    <div class="card"><h3>Spielstand mitnehmen</h3><p>Dein Kurzcode zum Aufschreiben:</p><p class="shortcode" aria-label="Kurzcode">${exportShort(p, LEVELS.map(l => l.id))}</p><p class="muted">Er merkt sich Figur, Sterne und freigeschaltete Level. Übungstage und Noten-Statistik bleiben auf diesem Gerät.</p><button class="btn sm" data-act="exp">Vollständige Sicherung</button> <button class="btn sm" data-act="imp">Code eingeben</button><div id="codeBox"></div></div>
    <div class="card"><h3>Für Lehrkräfte</h3>${tg('unlock', p.unlockAll, 'Alle Level freischalten', 'Zum gezielten Üben einzelner Noten')}<button class="btn sm ${app._del ? 'danger' : ''}" data-act="del">${app._del ? 'Wirklich löschen? Nochmal tippen' : 'Dieses Profil löschen'}</button></div></div><p class="note" role="status">${msg}</p>`, {
    back: () => { app._del = false; map(app); }, mode: () => { p.mode = p.mode === 'profi' ? 'abenteuer' : 'profi'; app.save(); settings(app); }, keys: () => { p.keys = !p.keys; app.save(); settings(app); },
    mute: () => { app.audio.muted = !app.audio.muted; p.muted = app.audio.muted; app.save(); settings(app); }, unlock: () => { p.unlockAll = !p.unlockAll; app.save(); settings(app); },
    cal: async () => { app.audio.ensure(); const r = await app.audio.startMic(); if (r !== 'on') return settings(app, r === 'denied' ? 'Das Mikrofon wurde nicht erlaubt. Erlaube es in den Einstellungen deines Browsers.' : 'Auf dieser Seite gibt es kein Mikrofon.'); calibrate(app, () => settings(app, 'Gespeichert.')); },
    exp: () => { const code = exportCode(p); document.getElementById('codeBox').innerHTML = `<textarea id="codeOut" rows="4" readonly aria-label="Dein Spielstand-Code">${code}</textarea><button class="btn sm" id="copyBtn">Kopieren</button>`;
      document.getElementById('copyBtn').addEventListener('click', async e => { const ta = document.getElementById('codeOut'); ta.select(); try { await navigator.clipboard.writeText(code); e.target.textContent = 'Kopiert'; } catch (err) { e.target.textContent = 'Bitte von Hand kopieren'; } }); },
    imp: () => importScreen(app, a => settings(a)), place: () => placement(app, () => map(app)),
    del: () => { if (!app._del) { app._del = true; return settings(app); } app._del = false; app.state.profiles = app.state.profiles.filter(q => q.id !== p.id); app.state.current = null; app.save(); app.state.profiles.length ? profiles(app) : title(app); } }, 'wide');
}
