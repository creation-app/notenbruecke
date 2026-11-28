import test from 'node:test'; import assert from 'node:assert/strict';
import * as M from '../src/music.js'; import { detectPitch, NoteTracker, a4FromCents } from '../src/pitch.js';
import * as S from '../src/srs.js'; import * as V from '../src/save.js';

test('Notennamen und MIDI', () => {
  const cases = { c1: [60, 'c¹'], g1: [67, 'g¹'], h1: [71, 'h¹'], c2: [72, 'c²'], a2: [81, 'a²'], c: [48, 'c'], f: [53, 'f'], G: [43, 'G'], C: [36, 'C'],
    fis1: [66, 'fis¹'], b1: [70, 'b¹'], es2: [75, 'es²'], as1: [68, 'as¹'], gis1: [68, 'gis¹'], des2: [73, 'des²'], cis2: [73, 'cis²'], dis2: [75, 'dis²'], B: [46, 'B'] };
  for (const [id, [midi, name]] of Object.entries(cases)) { const n = M.N(id); assert.equal(M.midiOf(n), midi, id); assert.equal(M.nameStr(n), name, id); assert.equal(n.key, id, id); }
  assert.throws(() => M.N('x1'));
});
test('Notensystem-Positionen', () => {
  const tre = { e1: 0, f1: 1, g1: 2, a1: 3, h1: 4, c2: 5, d2: 6, e2: 7, f2: 8, c1: -2, a2: 10 };
  for (const [id, pos] of Object.entries(tre)) assert.equal(M.staffPos(M.N(id), 'treble'), pos, id);
  const bas = { G: 0, H: 2, d: 4, f: 6, a: 8, c1: 10, E: -2, C: -4, c: 3 };
  for (const [id, pos] of Object.entries(bas)) assert.equal(M.staffPos(M.N(id), 'bass'), pos, id);
  assert.deepEqual(M.ledgerPositions(-2), [-2]); assert.deepEqual(M.ledgerPositions(-4), [-2, -4]); assert.deepEqual(M.ledgerPositions(11), [10]); assert.deepEqual(M.ledgerPositions(5), []);
  assert.equal(M.describePos(2), '2. Linie'); assert.equal(M.describePos(5), '3. Zwischenraum');
});
test('MIDI zurück in Noten', () => {
  for (let m = 36; m <= 96; m++) { assert.equal(M.midiOf(M.noteOfMidi(m)), m); assert.equal(M.midiOf(M.noteOfMidi(m, true)), m); }
  assert.equal(M.noteOfMidi(70).key, 'b1'); assert.equal(M.noteOfMidi(66).key, 'fis1'); assert.equal(M.noteOfMidi(66, true).key, 'ges1');
});
test('Bewertung: richtig, falsche Oktave, falsche Note', () => {
  assert.equal(M.classify(67, 67), 'correct'); assert.equal(M.classify(67, 55), 'octave-low'); assert.equal(M.classify(67, 79), 'octave-high');
  assert.equal(M.classify(67, 65), 'wrong'); assert.equal(M.classify(67, 69), 'wrong');
});

const SR = 44100;
function piano(midi, t0, dur, opt = {}) { // Klavierähnlich: Obertöne, leichte Inharmonizität, Ausklang
  const f = M.freqOfMidi(midi, opt.a4 || 440), n = Math.round(dur * SR), out = new Float32Array(n), B = 0.0004;
  const amps = opt.weakFund ? [0.15, 1, 0.7, 0.4, 0.3, 0.2] : [1, 0.6, 0.4, 0.25, 0.18, 0.1, 0.06];
  for (let i = 0; i < n; i++) { const t = i / SR; let s = 0;
    amps.forEach((a, h) => { const k = h + 1, fk = f * k * Math.sqrt(1 + B * k * k); if (fk < SR / 2) s += a * Math.sin(2 * Math.PI * fk * (t + t0)) * Math.exp(-t * (1.2 + 0.6 * h)); });
    out[i] = (opt.gain || 0.25) * s * Math.min(1, t / 0.004) + (opt.noise || 0.004) * (Math.random() * 2 - 1); }
  return out;
}
function concat(parts) { const n = parts.reduce((a, p) => a + p.length, 0), o = new Float32Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }
function run(signal, opt) { const tr = new NoteTracker(opt), ev = [], hop = 2048, N = 4096;
  for (let i = 0; i + N <= signal.length; i += hop) { const e = tr.push(detectPitch(signal.subarray(i, i + N), SR), (i + N) / SR * 1000); if (e) ev.push(e.midi); } return ev; }
const silence = s => new Float32Array(Math.round(s * SR));

test('Erkennung: jeder Ton von C bis c³, richtige Oktave', () => {
  for (let m = 36; m <= 84; m++) { const r = detectPitch(piano(m, 0, 0.2).subarray(2000, 2000 + 4096), SR); assert.ok(r, 'kein Ergebnis ' + m); assert.equal(Math.round(M.midiOfFreq(r.freq)), m, 'MIDI ' + m); assert.ok(r.clarity > 0.86, 'Klarheit ' + m + ' ' + r.clarity); }
});
test('Erkennung: schwacher Grundton wird nicht zur Oktave', () => {
  for (const m of [36, 43, 48, 55, 60, 67]) { const r = detectPitch(piano(m, 0, 0.2, { weakFund: true }).subarray(2000, 6096), SR); assert.equal(Math.round(M.midiOfFreq(r.freq)), m, 'MIDI ' + m); }
});
test('Stille und Rauschen lösen nichts aus', () => {
  const noise = new Float32Array(SR * 2).map(() => (Math.random() * 2 - 1) * 0.05); assert.deepEqual(run(noise), []); assert.deepEqual(run(silence(1)), []);
});
test('Ein Anschlag = genau ein Ereignis, auch beim langen Ausklingen', () => { assert.deepEqual(run(piano(67, 0, 3)), [67]); });
test('Melodie mit Tonwiederholungen', () => {
  const mel = [60, 62, 64, 65, 67, 67, 69, 69, 69, 69, 67]; assert.deepEqual(run(concat(mel.map(m => piano(m, 0, 0.5)))), mel);
});
test('Legato: neuer Ton ohne Pause, dazu leise und laute Töne', () => {
  assert.deepEqual(run(concat([piano(60, 0, 0.6), piano(64, 0, 0.6, { gain: 0.08 }), piano(67, 0, 0.6, { gain: 0.5 }), silence(0.3), piano(48, 0, 0.8)])), [60, 64, 67, 48]);
});
test('Sehr kurzer Tupfer wird ignoriert', () => { assert.deepEqual(run(concat([piano(67, 0, 0.09), silence(0.5)])), []); });
test('Kalibrierung gleicht verstimmtes Klavier aus', () => {
  const sig = piano(60, 0, 1, { a4: 432 }); const tr = new NoteTracker(); const cents = [];
  for (let i = 0; i + 4096 <= sig.length; i += 2048) { tr.push(detectPitch(sig.subarray(i, i + 4096), SR), i / SR * 1000); if (tr.current) cents.push(tr.current.cents + (tr.current.midi - 60) * 100); }
  const a4 = a4FromCents(cents); assert.ok(Math.abs(a4 - 432) < 1.5, 'a4=' + a4);
  assert.deepEqual(run(concat([60, 61, 71].map(m => piano(m, 0, 0.5, { a4: 432 }))), { a4 }), [60, 61, 71]);
});
test('Wiederholung: unsichere Noten kommen häufiger', () => {
  const stats = { a: { box: 4 }, b: { box: 0 } }; let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const cnt = { a: 0, b: 0 };
  for (let i = 0; i < 2000; i++) cnt[S.pickNext(['a', 'b'], stats, rnd)]++; assert.ok(cnt.b > cnt.a * 5);
  assert.notEqual(S.pickNext(['a', 'b'], stats, rnd, 'b'), 'b'); assert.equal(S.pickNext(['a'], stats, rnd, 'a'), 'a');
  const st = S.newStat(); S.update(st, true); S.update(st, true); S.update(st, true); assert.ok(S.isMastered(st)); S.update(st, false); assert.equal(st.box, 1);
  assert.deepEqual(S.topConfusions({ 'e1>g1': 4, 'f1>a1': 1, 'c1>d1': 2 }).map(c => c.target), ['e1', 'c1']);
});
test('Spielstand: speichern, laden, Code', () => {
  const store = { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = v; } };
  const st = V.emptyState(); const p = V.newProfile('Mika Müller', 2, 'profi'); p.levels['w1-1'] = { stars: 3 }; p.creatures.push('g1'); st.profiles.push(p);
  assert.ok(V.persist(store, st)); assert.deepEqual(V.load(store), st);
  const code = V.exportCode(p); assert.deepEqual(V.importCode(code), p); assert.deepEqual(V.importCode(code.replace(/(.{20})/g, '$1\n ')), p);
  assert.throws(() => V.importCode(code.slice(0, -3) + 'zzz')); assert.throws(() => V.importCode('Quatsch'));
  assert.deepEqual(V.load({ getItem() { throw new Error('gesperrt'); } }).profiles.length, 1); // Ausweichspeicher
  assert.equal(V.persist({ setItem() { throw new Error('voll'); } }, st), false);
});
test('Übungstage in Folge', () => {
  const p = V.newProfile('A'); const d = new Date(2026, 10, 19);
  for (const off of [0, 1, 2, 4]) { const x = new Date(d); x.setDate(d.getDate() - off); V.addPractice(p, 300, x); }
  assert.equal(V.streak(p, d), 3); const next = new Date(d); next.setDate(d.getDate() + 1); assert.equal(V.streak(p, next), 3);
  next.setDate(next.getDate() + 1); assert.equal(V.streak(p, next), 0);
});
test('Übungstage: Monats-, Jahres- und Zeitumstellungs-Grenzen, Mindestzeit', () => {
  const mk = (from, n, secs = 300) => { const p = V.newProfile('A'); for (let i = 0; i < n; i++) { const x = new Date(from); x.setDate(from.getDate() - i); V.addPractice(p, secs, x); } return p; };
  assert.equal(V.streak(mk(new Date(2026, 11, 3, 18), 10), new Date(2026, 11, 3, 18)), 10, 'über den Monatswechsel');
  assert.equal(V.streak(mk(new Date(2027, 0, 4, 9), 12), new Date(2027, 0, 4, 9)), 12, 'über den Jahreswechsel');
  assert.equal(V.streak(mk(new Date(2026, 2, 31, 7), 6), new Date(2026, 2, 31, 7)), 6, 'über die Umstellung auf Sommerzeit (29.3.2026)');
  assert.equal(V.streak(mk(new Date(2026, 9, 27, 23, 30), 6), new Date(2026, 9, 27, 23, 30)), 6, 'über die Umstellung auf Winterzeit (25.10.2026)');
  assert.equal(V.streak(mk(new Date(2026, 2, 29, 0, 30), 3), new Date(2026, 2, 29, 0, 30)), 3, 'kurz nach Mitternacht am Umstellungstag');
  assert.equal(V.streak(mk(new Date(2028, 2, 2), 5), new Date(2028, 2, 2)), 5, 'über den 29. Februar');
  const late = mk(new Date(2026, 10, 26, 23, 59), 4); assert.equal(V.streak(late, new Date(2026, 10, 27, 0, 1)), 4, 'eine Minute nach Mitternacht: gestern zählt noch'); assert.equal(V.streak(late, new Date(2026, 10, 28, 0, 1)), 0, 'ein ganzer Tag Pause: Serie vorbei');
  const short = V.newProfile('B'), d = new Date(2026, 10, 27, 16); V.addPractice(short, 59, d); assert.equal(V.streak(short, d), 0, 'unter einer Minute ist kein Übungstag'); assert.equal(V.practiceDays(short), 0); V.addPractice(short, 1, d); assert.equal(V.streak(short, d), 1); assert.equal(V.practiceDays(short), 1); assert.equal(V.practiced(short, V.dayKey(d)), true);
  const gap = mk(new Date(2026, 10, 27), 3); V.addPractice(gap, 300, new Date(2026, 10, 20)); V.addPractice(gap, 20, new Date(2026, 10, 24)); assert.equal(V.streak(gap, new Date(2026, 10, 27)), 3); assert.equal(V.practiceDays(gap), 4, 'Übungstage insgesamt zählen auch alte Tage, aber keine Mini-Tage');
  const two = V.newProfile('C'); V.addPractice(two, 40, d); V.addPractice(two, 40, d); assert.equal(two.days[V.dayKey(d)], 80, 'mehrere Runden am selben Tag werden addiert'); assert.equal(V.dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05'); assert.equal(V.dayKey(new Date(2026, 0, 6, 0, 0)), '2026-01-06');
});
test('Erkennung mit halber Abtastrate (wie im Spiel): C bis c³', () => {
  for (let m = 36; m <= 84; m++) { const full = piano(m, 0, 0.2).subarray(2000, 2000 + 4096), d = new Float32Array(2048); for (let i = 0; i < 2048; i++) d[i] = (full[2 * i] + full[2 * i + 1]) / 2;
    const r = detectPitch(d, SR / 2); assert.ok(r, 'kein Ergebnis ' + m); const mf = M.midiOfFreq(r.freq); assert.equal(Math.round(mf), m, 'MIDI ' + m); assert.ok(Math.abs(mf - m) < 0.2, 'Abweichung ' + m + ': ' + (mf - m)); }
});
test('Kurzcode: 12 Zeichen, übersteht Abtippfehler-Varianten, erkennt Fehler', async () => {
  const L = await import('../src/levels.js'); const worlds = L.WORLDS.map((w, i) => L.levelsOf(i).map(l => l.id));
  const p = V.newProfile('Mika', 4, 'profi'); ['h1', 'h2', 'h3'].forEach(id => { p.levels[id] = { stars: 3 }; }); p.levels.t1 = { stars: 1 }; p.skip = [11, 0, 0, 0];
  const code = V.exportShort(p, worlds); assert.match(code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  for (const variant of [code, code.toLowerCase(), code.replace(/-/g, ' '), code.replace(/0/g, 'O').replace(/1/g, 'l')]) { const q = V.importShort(variant, worlds);
    assert.equal(q.hero, 4); assert.equal(q.mode, 'profi'); assert.deepEqual(q.skip, [11, 0, 0, 0]); assert.deepEqual(Object.keys(q.levels), ['h1', 'h2', 'h3', 't1']); assert.equal(q.levels.h2.stars, 3); assert.equal(q.levels.t1.stars, 1); }
  const wrong = code.slice(0, 2) + (code[2] === 'A' ? 'B' : 'A') + code.slice(3); assert.throws(() => V.importShort(wrong, worlds)); assert.throws(() => V.importShort(code.slice(0, -2), worlds));
});
test('Spielstand-Link enthält alles und ist gepresst kürzer', async () => {
  const p = V.newProfile('Mika Müller', 2, 'profi'); for (let i = 0; i < 30; i++) { p.notes['n' + i] = { box: i % 5, seen: i, ok: i >> 1 }; p.days['2026-10-' + String(i + 1).padStart(2, '0')] = 300 + i; p.conf[`a${i}>b${i}`] = i; } p.levels.h1 = { stars: 3, time: 12.5 }; p.creatures = ['c1', 'g1'];
  const pay = await V.exportPayload(p); assert.equal(pay[0], 'Z'); assert.deepEqual(await V.importPayload(pay), p); assert.ok(pay.length < JSON.stringify(p).length * 0.75, 'gepresst: ' + pay.length + ' von ' + JSON.stringify(p).length);
  await assert.rejects(V.importPayload('Zabc')); await assert.rejects(V.importPayload('Qabc'));
});
test('Einstieg nach Einstufung schaltet Level frei', async () => {
  const L = await import('../src/levels.js'); const p = V.newProfile('A'); const h = L.levelsOf(0), t = L.levelsOf(1);
  assert.ok(!L.levelUnlocked(p, h[5])); p.skip = [6, 0, 0, 0]; assert.ok(L.levelUnlocked(p, h[5])); assert.ok(!L.levelUnlocked(p, h[6])); assert.ok(!L.worldUnlocked(p, 1));
  p.skip = [15, 9, 0, 0]; assert.ok(L.worldUnlocked(p, 1)); assert.ok(L.levelUnlocked(p, t[8])); assert.ok(!L.levelUnlocked(p, t[9])); assert.ok(!L.worldUnlocked(p, 2)); assert.ok(!L.worldUnlocked(p, 3));
  for (let i = 0; i < 6; i++) p.levels[t[i].id] = { stars: 1 }; assert.ok(L.worldUnlocked(p, 3), 'Große Brücke öffnet nach 6 Bass-Leveln');
  for (const s of L.PLACEMENT) s.notes.forEach(k => M.N(k));
});

test('Großes System: Positionen, Linien, Hilfslinien', () => {
  const pos = k => M.staffPos(M.N(k), 'grand'); assert.equal(pos('c1'), 4); assert.equal(pos('e1'), 6); assert.equal(pos('f2'), 14); assert.equal(pos('a'), 2); assert.equal(pos('G'), -6);
  assert.deepEqual(M.staffLines('grand'), [-6, -4, -2, 0, 2, 6, 8, 10, 12, 14]); assert.deepEqual(M.ledgerPositions(4, 'grand'), [4]); assert.deepEqual(M.ledgerPositions(3, 'grand'), []); assert.deepEqual(M.ledgerPositions(5, 'grand'), []);
  assert.deepEqual(M.ledgerPositions(16, 'grand'), [16]); assert.deepEqual(M.ledgerPositions(-8, 'grand'), [-8]); assert.equal(M.describePos(8, 'grand'), '2. Linie im Violinschlüssel'); assert.equal(M.describePos(0, 'grand'), '4. Linie im Bassschlüssel');
  assert.ok(M.stemUp(6, 'grand')); assert.ok(!M.stemUp(12, 'grand')); assert.ok(M.stemUp(-4, 'grand')); assert.ok(!M.stemUp(0, 'grand'));
});
test('Freischalt-Schlüssel: echt, gefälscht, abgelaufen', async () => {
  const fs = await import('node:fs'); const { verifyKey, signKey, isActive } = await import('../src/license.js');
  const priv = JSON.parse(fs.readFileSync('../geheim/privat.jwk.json', 'utf8'));
  const once = await signKey(priv, { type: 'einmal', until: null, serial: 7 }); let lic = await verifyKey('  ' + once.replace(/(.{20})/g, '$1\n')); assert.equal(lic.type, 'einmal'); assert.equal(lic.until, null); assert.equal(lic.serial, 7); assert.ok(isActive(lic));
  lic = await verifyKey('https://example.org/#k=' + once); assert.equal(lic.serial, 7);
  const abo = await signKey(priv, { type: 'abo', until: new Date(2027, 0, 31), serial: 70000 }); lic = await verifyKey(abo); assert.equal(lic.type, 'abo'); assert.equal(lic.serial, 70000);
  assert.ok(isActive(lic, new Date(2027, 0, 31, 12))); assert.ok(!isActive(lic, new Date(2027, 1, 2))); assert.ok(!isActive(null));
  const forged = once.slice(0, 6) + (once[6] === 'A' ? 'B' : 'A') + once.slice(7); await assert.rejects(verifyKey(forged)); await assert.rejects(verifyKey('NBKabc')); await assert.rejects(verifyKey('Quatsch'));
  const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); const fake = await signKey(await crypto.subtle.exportKey('jwk', other.privateKey), { type: 'einmal', until: null, serial: 1 }); await assert.rejects(verifyKey(fake));
});
test('Titelmusik: alle Stücke haben 8 Takte und gültige Töne', async () => {
  const { SONGS, pitch } = await import('../src/audio.js'); assert.deepEqual(Object.keys(SONGS), ['original', 'tanz', 'feder', 'jagd']);
  for (const [k, S] of Object.entries(SONGS)) { assert.equal(S.lead.length, 64, k); assert.equal(S.bass.length, 8, k); assert.equal(S.pad.length, 8, k); assert.notEqual(S.lead[0], '-'); assert.ok(S.bpm >= 100 && S.bpm <= 160);
    for (const t of S.lead) { if (t === '-' || t === '.') continue; assert.match(t, /^[A-G]#?[4-6]$/, k + ' ' + t); assert.ok(pitch(t) > 200 && pitch(t) < 1700); }
    for (const pair of [...S.bass, ...S.pad]) { assert.equal(pair.length, 2, k); pair.forEach(n => assert.ok(pitch(n) > 40 && pitch(n) < 600, k + ' ' + n)); } }
  assert.ok(Math.abs(pitch('A4') - 440) < 1e-9); assert.ok(Math.abs(pitch('C4') - 261.626) < 0.01); assert.ok(Math.abs(pitch('A#4') - 466.16) < 0.01);
});

test('Wiederholung: langsam richtig reicht nicht für "sicher"', () => {
  const a = S.newStat(); for (let i = 0; i < 6; i++) S.update(a, true, true); assert.equal(a.box, 2); assert.ok(!S.isMastered(a)); assert.equal(a.slow, 6); assert.equal(a.ok, 6);
  S.update(a, true); assert.ok(S.isMastered(a)); S.update(a, true, true); assert.ok(S.isMastered(a), 'einmal langsam nimmt nichts weg');
  S.update(a, false); assert.equal(a.box, 1);
});

test('Training: Notenvorrat, Disziplin und Voreinstellungen', async () => {
  const T = await import('../src/training.js'); const { N } = await import('../src/music.js');
  const d = T.normalize({}); assert.deepEqual(d, { input: 'play', range: 'treble', acc: false, len: 'time', weak: false });
  assert.equal(T.normalize({ range: 'bass', acc: true }).acc, true, 'Vorzeichen gibt es auch im Bass'); assert.equal(T.normalize({ weak: true, acc: true }).acc, false);
  { const bv = T.pool(T.normalize({ range: 'bass', acc: true }), {}), av = T.pool(T.normalize({ range: 'both', acc: true }), {}), flat = bv.filter(e => N(e.key).alt !== 0); assert.ok(flat.length >= 8 && bv.every(e => e.clef === 'bass')); for (const e of flat) { const pos = M.staffPos(N(e.key), 'bass'); assert.ok(pos >= -2 && pos <= 10, e.key + ' liegt im Bass-System: ' + pos); assert.ok(M.midiOf(N(e.key)) >= 36 && M.midiOf(N(e.key)) < 60, e.key); assert.equal(T.hasCreature(e.key), false); } assert.ok(av.some(e => e.clef === 'treble' && N(e.key).alt) && av.some(e => e.clef === 'bass' && N(e.key).alt)); assert.equal(T.disc(T.normalize({ range: 'bass', acc: true })), 'play-bass+v-time'); assert.equal(T.hasCreature('fis1'), true); } assert.equal(T.normalize({ range: 'quatsch', input: 'x', len: 'y' }).range, 'treble');
  const tr = T.pool(T.normalize({}), {}), ba = T.pool(T.normalize({ range: 'bass' }), {}), both = T.pool(T.normalize({ range: 'both' }), {}), acc = T.pool(T.normalize({ acc: true }), {});
  assert.ok(tr.length >= 10 && tr.every(e => e.clef === 'treble' && N(e.key).alt === 0)); assert.ok(ba.length >= 10 && ba.every(e => e.clef === 'bass' && N(e.key).alt === 0));
  assert.equal(both.length, tr.length + ba.length); assert.ok(acc.length > tr.length && acc.some(e => N(e.key).alt !== 0));
  assert.equal(T.disc(T.normalize({})), 'play-treble-time'); assert.equal(T.disc(T.normalize({ acc: true, input: 'name', len: 'count' })), 'name-treble+v-count'); assert.equal(T.disc(T.normalize({ weak: true })), null);
  assert.equal(new Set(['treble', 'bass', 'both'].flatMap(r => ['play', 'name'].flatMap(i => ['time', 'count'].map(l => T.disc(T.normalize({ range: r, input: i, len: l })))))).size, 12);
  assert.match(T.discLabel(T.normalize({ range: 'both' })), /Beide Schlüssel · am Klavier · 60 Sekunden/);
  const p = { notes: { c1: { box: 4, seen: 9, ok: 9 }, f1: { box: 1, seen: 3, ok: 1 }, G: { box: 0, seen: 2, ok: 0 }, a1: { box: 0, seen: 1, ok: 0 }, fis1: { box: 2, seen: 5, ok: 3 }, kaputt: { box: 0, seen: 5 } } };
  assert.deepEqual(T.weakNotes(p), [{ key: 'f1', clef: 'treble' }, { key: 'G', clef: 'bass' }, { key: 'fis1', clef: 'treble' }]); assert.deepEqual(T.pool(T.normalize({ weak: true }), p), T.weakNotes(p));
  assert.ok(T.sameSound({ key: 'cis2' }, { key: 'des2' })); assert.ok(!T.sameSound({ key: 'c1' }, { key: 'd1' })); assert.ok(!T.sameSound(null, { key: 'c1' }));
});
test('Training: Rechnung, Rekorde und Sterne', async () => {
  const T = await import('../src/training.js'); const { totalStars } = await import('../src/levels.js');
  assert.deepEqual(T.metrics({ correct: 30, first: 27, tried: 30, ms: 60000 }), { npm: 30, acc: 90 }); assert.deepEqual(T.metrics({ correct: 20, first: 20, tried: 20, ms: 40000 }), { npm: 30, acc: 100 });
  assert.deepEqual(T.metrics({ correct: 0, first: 0, tried: 0, ms: 0 }), { npm: 0, acc: 0 });
  assert.equal(T.starsFor('play', 14, 100), 0); assert.equal(T.starsFor('play', 15, 100), 1); assert.equal(T.starsFor('play', 25, 80), 2); assert.equal(T.starsFor('play', 60, 79), 0); assert.equal(T.starsFor('name', 40, 95), 2); assert.equal(T.starsFor('name', 55, 95), 3);
  const p = { levels: { h1: { stars: 3 } }, notes: {} }, cfg = T.normalize({});
  let r = T.record(p, cfg, { correct: 18, first: 16, tried: 18, ms: 60000 }, '2026-11-21'); assert.ok(r.counted && r.newBest); assert.equal(r.best, 18); assert.equal(r.stars, 1); assert.equal(r.starsGained, 1); assert.equal(r.nextStar, 25); assert.equal(totalStars(p), 4);
  r = T.record(p, cfg, { correct: 16, first: 16, tried: 16, ms: 60000 }); assert.ok(r.counted && !r.newBest); assert.equal(r.best, 18); assert.equal(r.prevBest, 18); assert.equal(r.starsGained, 0);
  r = T.record(p, cfg, { correct: 50, first: 20, tried: 50, ms: 60000 }); assert.ok(!r.counted && !r.newBest); assert.equal(r.why, 'acc'); assert.equal(r.best, 18, 'Drauflos-Raten bringt keinen Rekord'); assert.equal(r.stars, 1);
  r = T.record(p, cfg, { correct: 3, first: 3, tried: 3, ms: 60000 }); assert.equal(r.why, 'few');
  r = T.record(p, cfg, { correct: 41, first: 40, tried: 41, ms: 60000 }); assert.ok(r.newBest); assert.equal(r.stars, 3); assert.equal(r.starsGained, 2); assert.equal(r.nextStar, null); assert.equal(totalStars(p), 6); assert.equal(T.trainStars(p), 3);
  assert.equal(p.train['play-treble-time'].runs.length, 5); for (let i = 0; i < 40; i++) T.record(p, cfg, { correct: 10, first: 10, tried: 10, ms: 60000 }); assert.equal(p.train['play-treble-time'].runs.length, 30);
  const c20 = T.normalize({ len: 'count' }); r = T.record(p, c20, { correct: 20, first: 19, tried: 20, ms: 30000 }); assert.equal(r.npm, 40); assert.ok(r.newBest); assert.equal(r.stars, 0, '20-Noten-Runden geben keine Sterne'); assert.equal(r.nextStar, null);
  r = T.record(p, T.normalize({ weak: true }), { correct: 20, first: 20, tried: 20, ms: 30000 }); assert.equal(r.disc, null); assert.equal(r.why, 'weak'); assert.ok(!r.newBest); assert.equal(Object.keys(p.train).length, 2);
  const times = [['c1', 900], ['d1', 1000], ['e1', 950], ['f2', 3200], ['f2', 2800], ['a1', 2100], ['g1', 1000]].map(([key, ms]) => ({ key, clef: 'treble', ms }));
  assert.deepEqual(T.slowest(times).map(e => e.key), ['f2', 'a1']); assert.equal(Math.round(T.slowest(times)[0].ms), 3000); assert.deepEqual(T.slowest(times.slice(0, 2)), []);
});

test('Mikrofon-Verstärkung aus gemessenen Pegeln', async () => {
  const { gainFor, GAIN_MAX } = await import('../src/audio.js');
  assert.equal(gainFor([]), 1); assert.equal(gainFor([0.08, 0.1, 0.06]), 1, 'laute Geräte bleiben unverstärkt'); assert.equal(gainFor([0.004, 0.005, 0.0045]), 8.9); assert.equal(gainFor([0.0001, 0.0002, 0.0001]), GAIN_MAX); assert.equal(gainFor([0.01, 0.5, 0.01]), 4, 'Ausreißer zählt nicht (Median)');
});

test('Spielstände zusammenführen (Konto auf zwei Geräten)', async () => {
  const { mergeProfiles } = await import('../src/merge.js');
  const server = { id: 's', name: 'Lea', hero: 1, levels: { h1: { stars: 3 }, h2: { stars: 1, best: 50 } }, notes: { c1: { box: 4, seen: 9 }, d1: { box: 0, seen: 1 } }, conf: { 'c1>d1': 2 }, creatures: ['c1', 'd1'], days: { '2026-11-20': 300, '2026-11-21': 100 },
    train: { 'play-treble-time': { best: 30, bestAcc: 90, stars: 2, runs: [1, 2, 3] } }, regenBest: 12, skip: [1, 0, 0], seenIntro: true };
  const local = { id: 'l', name: 'Lea M.', hero: 2, levels: { h2: { stars: 2, best: 40 }, h3: { stars: 1 } }, notes: { c1: { box: 1, seen: 3 }, d1: { box: 2, seen: 4 }, e1: { box: 0, seen: 1 } }, conf: { 'c1>d1': 1, 'e1>f1': 1 }, creatures: ['e1', 'c1'], days: { '2026-11-21': 400 },
    train: { 'play-treble-time': { best: 25, bestAcc: 99, stars: 3, runs: [1] }, 'name-bass-count': { best: 40, stars: 0, runs: [1] } }, regenBest: 9, skip: [0, 1], seenIntro: false };
  const m = mergeProfiles(server, local);
  assert.equal(m.name, 'Lea M.'); assert.equal(m.hero, 2, 'Einstellungen vom Gerät'); assert.deepEqual(m.levels, { h1: { stars: 3 }, h2: { stars: 2, best: 40 }, h3: { stars: 1 } });
  assert.deepEqual(m.notes.c1, { box: 4, seen: 9 }); assert.deepEqual(m.notes.d1, { box: 2, seen: 4 }); assert.ok(m.notes.e1); assert.deepEqual(m.conf, { 'c1>d1': 2, 'e1>f1': 1 });
  assert.deepEqual(m.creatures.sort(), ['c1', 'd1', 'e1']); assert.deepEqual(m.days, { '2026-11-20': 300, '2026-11-21': 400 });
  assert.equal(m.train['play-treble-time'].best, 30); assert.equal(m.train['play-treble-time'].bestAcc, 90); assert.equal(m.train['play-treble-time'].stars, 3); assert.equal(m.train['play-treble-time'].runs.length, 3); assert.ok(m.train['name-bass-count']);
  assert.equal(m.regenBest, 12); assert.deepEqual(m.skip, [1, 1, 0]); assert.equal(m.seenIntro, true);
  assert.deepEqual(mergeProfiles(mergeProfiles(server, local), local).levels, m.levels, 'mehrfaches Zusammenführen ändert nichts');
  assert.ok(mergeProfiles(null, local).levels.h3 && mergeProfiles(server, {}).levels.h1, 'leere Stände');
});

// ---------- Sprache soll nicht als Note zählen ----------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
/** Sprechähnlich: Silben mit gleitender Tonhöhe, Formanten, wechselnder Lautstärke. glide in Halbtönen pro Sekunde. */
function speech(seconds, seed, { lo = 180, hi = 330, minGlide = 3, maxGlide = 12, gain = 0.2 } = {}) {
  const r = rng(seed), out = new Float32Array(Math.round(seconds * SR)); let i = 0, ph = 0;
  while (i < out.length) {
    const dur = 0.16 + r() * 0.24, n = Math.round(dur * SR), f0 = lo + r() * (hi - lo), g = (minGlide + r() * (maxGlide - minGlide)) * (r() < 0.5 ? -1 : 1), F1 = 400 + r() * 500, F2 = 1000 + r() * 1200, a = gain * (0.6 + r() * 0.4);
    for (let k = 0; k < n && i < out.length; k++, i++) { const t = k / SR, f = f0 * Math.pow(2, g * t / 12) * (1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t)); ph += 2 * Math.PI * f / SR; let s = 0;
      for (let h = 1; h <= 14 && f * h < 5000; h++) { const fh = f * h, w = 1 / h * (1 + 3 * Math.exp(-((fh - F1) ** 2) / 20000) + 2 * Math.exp(-((fh - F2) ** 2) / 60000)); s += w * Math.sin(ph * h); }
      out[i] = a * 0.25 * s * Math.sin(Math.PI * Math.min(1, k / n)) ** 0.5 + 0.003 * (r() * 2 - 1); }
    i += Math.round((0.04 + r() * 0.1) * SR);
  }
  return out;
}
/** Gezupfte Saite: startet etwas zu hoch und sinkt in gut 100 ms auf die Tonhöhe, klingt schnell aus. */
function pluck(midi, dur, sharpCents = 25, gain = 0.25) {
  const f = M.freqOfMidi(midi), n = Math.round(dur * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, fi = f * Math.pow(2, sharpCents * Math.exp(-t / 0.05) / 1200); ph += 2 * Math.PI * fi / SR; let s = 0; for (let h = 1; h <= 8; h++) s += Math.sin(ph * h) / h * Math.exp(-t * (2.5 + 1.2 * h)); out[i] = gain * s * Math.min(1, t / 0.003) + 0.003 * (Math.random() * 2 - 1); }
  return out;
}
test('Sprache: gleitende Stimme löst (fast) keine Noten aus, Klavier und Gitarre weiterhin jede', () => {
  const secs = 30, count = (o, opt) => { let n = 0; for (const seed of [1, 2, 3, 4]) n += run(speech(secs, seed, o), opt).length; return n; };
  for (const [name, o, maxPart] of [['fast monoton (0–1 Halbton/s)', { minGlide: 0, maxGlide: 1 }, 1], ['leicht gleitend (1–3)', { minGlide: 1, maxGlide: 3 }, 0.6], ['normal gleitend (2–6)', { minGlide: 2, maxGlide: 6 }, 0.35], ['lebhaft (3–12)', { minGlide: 3, maxGlide: 12 }, 0.2]]) {
    const old = count(o, { steadyCents: 1e9 }), now = count(o); console.log(`      Sprache ${name}: früher ${old} Fehl-Noten in 2 min, jetzt ${now}`); assert.ok(now <= Math.max(1, old * maxPart), `${name}: ${now} von ${old}`); }
  // Klavier: Tonfolge mit Wiederholungen, alles muss ankommen
  const mel = [60, 62, 64, 64, 65, 67, 67, 60, 72, 48, 43, 36], sig = concat(mel.flatMap(m => [piano(m, 0, 0.5), silence(0.12)])); assert.deepEqual(run(sig), mel);
  // Gitarre: gezupft, anfangs zu hoch, tiefe Saiten (klingend E = 40) bis hohes g
  const gm = [40, 45, 47, 50, 55, 59, 64, 65, 67, 40, 41, 43], gs = concat(gm.flatMap(m => [pluck(m, 0.55), silence(0.1)])); assert.deepEqual(run(gs), gm);
  assert.deepEqual(run(concat(gm.flatMap(m => [pluck(m, 0.55, 45), silence(0.1)]))), gm, 'kräftig gezupft (45 Cent zu hoch am Anfang)');
});
test('Leises wird überhört, wenn der Pegel des Instruments bekannt ist', () => {
  const loud = concat([piano(60, 0, 0.6), silence(0.2), piano(64, 0, 0.6), silence(0.2)]), quiet = loud.map(x => x * 0.05);
  assert.deepEqual(run(quiet), [60, 64], 'ohne Bezugspegel zählt auch Leises'); const ref = 0.12; // etwa der Spitzenpegel des lauten Signals
  assert.deepEqual(run(quiet, { minRms: 0.1 * ref }), [], 'ein Zwanzigstel so laut wie das Instrument: überhört'); assert.deepEqual(run(loud, { minRms: 0.1 * ref }), [60, 64]); assert.deepEqual(run(loud.map(x => x * 0.4), { minRms: 0.1 * ref }), [60, 64], 'leiser gespielt zählt noch');
});

test('Gitarre: Level-Satz, Namen wie im Heft, Griffe, Reihenfolge der Töne', async () => {
  const L = await import('../src/levels.js'), I = await import('../src/instrument.js');
  assert.equal(L.LEVELS[0].id, 'h1'); assert.equal(M.nameStr(M.N('f2')), 'f²');
  I.setInstr('gitarre');
  try {
    assert.equal(L.LEVELS[0].id, 'ga1'); assert.equal(L.WORLDS.length, 4); assert.equal(L.SKIP_KEY, 'skipG'); assert.equal(I.INSTR.shift, 12);
    // Reihenfolge wie im Inhaltsverzeichnis von „Garantiert Gitarre lernen für Kinder 1“: e f g | h c d | g a | d e f | a h c | e f g
    const order = []; for (const l of L.LEVELS) for (const k of l.fresh) if (!order.includes(k)) order.push(k);
    assert.deepEqual(order, ['e2', 'f2', 'g2', 'h1', 'c2', 'd2', 'g1', 'a1', 'd1', 'e1', 'f1', 'a', 'h', 'c1', 'e', 'f', 'g']);
    assert.deepEqual(L.ALL_NOTES.map(a => a.length), [6, 5, 6, 0]); assert.equal(L.creatureTotal(), 17);
    const names = { e2: 'hohes e', f2: 'hohes f', g2: 'hohes g', h1: 'mittleres h', c2: 'mittleres c', d2: 'hohes d', g1: 'mittleres g', a1: 'mittleres a', d1: 'mittleres d', e1: 'mittleres e', f1: 'mittleres f', a: 'tiefes a', h: 'tiefes h', c1: 'tiefes c', e: 'tiefes e', f: 'tiefes f', g: 'tiefes g' };
    for (const [k, v] of Object.entries(names)) { assert.equal(M.nameStr(M.N(k)), v); assert.equal(M.nameHtml(M.N(k)), v); assert.equal(M.N(k).key, k, 'Kennung bleibt'); }
    assert.deepEqual(M.shownParts(M.N('g2')), { base: 'g', sup: 'hoch', word: true });
    // Griffe: Saite und Bund wie im Heft; jede Level-Note ist in der ersten Lage bis zum 3. Bund greifbar
    const g = k => I.grip(M.midiOf(M.N(k))); assert.deepEqual(g('e2'), { string: 5, fret: 0 }); assert.deepEqual(g('f2'), { string: 5, fret: 1 }); assert.deepEqual(g('g2'), { string: 5, fret: 3 }); assert.deepEqual(g('h1'), { string: 4, fret: 0 }); assert.deepEqual(g('d2'), { string: 4, fret: 3 });
    assert.deepEqual(g('a1'), { string: 3, fret: 2 }); assert.deepEqual(g('f1'), { string: 2, fret: 3 }); assert.deepEqual(g('h'), { string: 1, fret: 2 }); assert.deepEqual(g('c1'), { string: 1, fret: 3 }); assert.deepEqual(g('e'), { string: 0, fret: 0 }); assert.deepEqual(g('g'), { string: 0, fret: 3 });
    for (const l of L.LEVELS) for (const k of [...l.notes, ...(l.melody || [])]) { const x = g(k); assert.ok(x && x.fret <= 3, l.id + ' ' + k); assert.equal(M.N(k).alt, 0); }
    assert.equal(I.gripText(M.midiOf(M.N('h'))), 'A-Saite, 2. Bund (Mittelfinger)'); assert.equal(I.gripText(M.midiOf(M.N('e2'))), 'hohe e-Saite, leer (ohne Finger)');
    // Melodien nur mit Tönen, die bis dahin gelernt sind
    const known = new Set(); for (const l of L.LEVELS) { l.fresh.forEach(k => known.add(k)); l.notes.forEach(k => assert.ok(known.has(k), `${l.id}: ${k} noch nicht eingeführt`)); (l.melody || []).forEach(k => assert.ok(known.has(k), `${l.id}: Melodieton ${k} noch nicht eingeführt`)); }
    for (const st of L.PLACEMENT) { assert.equal(st.skip.length, 4); st.skip.forEach((v, w) => assert.ok(v <= L.levelsOf(w).length)); }
    const p = { levels: {}, skipG: [10, 1, 0, 0], skip: [0, 0, 0, 0] }; assert.ok(L.worldUnlocked(p, 1) && !L.worldUnlocked(p, 2)); assert.ok(L.levelUnlocked(p, L.LEVELS[9]));
  } finally { I.setInstr('klavier'); }
  assert.equal(L.LEVELS[0].id, 'h1'); assert.equal(M.nameStr(M.N('f2')), 'f²'); assert.equal(L.ALL_LEVELS.length, 73);
  const known = new Set(); for (const l of L.SETS.klavier.levels) { l.fresh.forEach(k => known.add(k)); } assert.ok(known.size > 20);
});

test('Kurzcode trägt das Instrument; alte Codes bleiben Klavier', async () => {
  const L = await import('../src/levels.js'); const ids = set => set.worlds.map((w, i) => set.levels.filter(l => l.world === i).map(l => l.id)), both = { klavier: ids(L.SETS.klavier), gitarre: ids(L.SETS.gitarre) };
  const g = V.newProfile('G', 3, 'profi'); g.instr = 'gitarre'; g.levels = { ga1: { stars: 3 }, ga2: { stars: 2 }, gb1: { stars: 1 } }; g.skipG = [10, 1, 0, 0]; g.skip = [15, 13, 0, 0];
  const code = V.exportShort(g, both.gitarre, 'gitarre'); assert.match(code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/); const back = V.importShort(code, both);
  assert.equal(back.instr, 'gitarre'); assert.deepEqual(Object.keys(back.levels), ['ga1', 'ga2', 'gb1']); assert.deepEqual(back.skipG, [10, 1, 0, 0]); assert.equal(back.skip, undefined); assert.equal(back.hero, 3); assert.equal(back.mode, 'profi');
  const p = V.newProfile('P', 1); p.levels = { h1: { stars: 3 }, t1: { stars: 2 } }; p.skip = [6, 0, 0, 0]; const pc = V.exportShort(p, both.klavier); const pb = V.importShort(pc, both);
  assert.equal(pb.instr, undefined); assert.deepEqual(Object.keys(pb.levels), ['h1', 't1']); assert.deepEqual(pb.skip, [6, 0, 0, 0]); assert.deepEqual(V.importShort(pc, both.klavier).levels, pb.levels, 'alte Aufrufform');
});
test('Meisterprüfungen: Kronen-Regeln, Level-Liste, Zusammenführen', async () => {
  const L = await import('../src/levels.js'), { mergeProfiles } = await import('../src/merge.js');
  assert.equal(L.masterCrown('jump', { ratio: 1, time: 16 * 3.5, n: 16 }), 3); assert.equal(L.masterCrown('jump', { ratio: 1, time: 16 * 3.6, n: 16 }), 2, 'zu langsam für Gold'); assert.equal(L.masterCrown('jump', { ratio: 14 / 16, time: 30, n: 16 }), 2, '14 von 16 reicht nicht für Gold'); assert.equal(L.masterCrown('jump', { ratio: 15 / 16, time: 30, n: 16 }), 3);
  assert.equal(L.masterCrown('jump', { ratio: 12 / 16, time: 90, n: 16 }), 2); assert.equal(L.masterCrown('jump', { ratio: 11 / 16, time: 30, n: 16 }), 1); assert.equal(L.masterCrown('jump', { ratio: 1, time: 16 * 6.5, n: 16 }), 1, 'sehr langsam: Bronze');
  assert.equal(L.masterCrown('regen', { correct: 34, errors: 3 }), 3); assert.equal(L.masterCrown('regen', { correct: 34, errors: 4 }), 2); assert.equal(L.masterCrown('regen', { correct: 33, errors: 0 }), 2); assert.equal(L.masterCrown('regen', { correct: 24, errors: 8 }), 2); assert.equal(L.masterCrown('regen', { correct: 23, errors: 0 }), 1); assert.equal(L.masterCrown('regen', { correct: 40, errors: 9 }), 1);
  assert.equal(L.masterCrown('bau', { ratio: 11 / 12, time: 72, n: 12 }), 3); assert.equal(L.masterCrown('bau', { ratio: 10 / 12, time: 40, n: 12 }), 2); assert.equal(L.masterCrown('bau', { ratio: 1, time: 73, n: 12 }), 2); assert.equal(L.masterCrown('bau', { ratio: 8 / 12, time: 40, n: 12 }), 1);
  for (const set of ['klavier', 'gitarre']) { L.setLevelSet(set); const ids = new Set(); for (let w = 0; w < L.WORLDS.length; w++) { const ms = L.masterLevels(w), all = new Set(L.levelsOf(w).flatMap(l => l.notes)); assert.deepEqual(ms.map(m => m.type), ['jump', 'regen', 'bau']);
      for (const m of ms) { assert.ok(!ids.has(m.id) && /^m-[a-z-]+-(jump|regen|bau)$/.test(m.id), m.id); ids.add(m.id); assert.deepEqual(new Set(m.notes), all, 'alle Noten der Welt'); assert.ok(m.notes.length >= 6 && m.master && m.clef === L.WORLDS[w].clef); assert.equal(L.findLevel(m.id).id, m.id); assert.ok(!L.LEVELS.some(l => l.id === m.id)); } }
    const p = V.newProfile('M'); assert.equal(L.masterOpen(p, 0), false); L.levelsOf(0).forEach(l => { p.levels[l.id] = { stars: 1 }; }); assert.equal(L.masterOpen(p, 0), true); assert.equal(L.masterOpen(p, 1), false);
    assert.deepEqual(L.crownCount(p), { gold: 0, any: 0, total: 12 }); const [a, b, c] = L.masterLevels(0); p.master = { [a.id]: { crown: 3 }, [b.id]: { crown: 3 }, [c.id]: { crown: 2 } }; assert.deepEqual(L.crownCount(p), { gold: 2, any: 3, total: 12 }); assert.equal(L.worldMastered(p, 0), false); p.master[c.id].crown = 3; assert.equal(L.worldMastered(p, 0), true); assert.equal(L.totalStars(p), L.levelsOf(0).length, 'Kronen zählen nicht als Sterne'); }
  L.setLevelSet('klavier');
  const m = mergeProfiles({ master: { x: { crown: 3, runs: 2 }, y: { crown: 1, runs: 1 } } }, { master: { x: { crown: 2, runs: 5 }, z: { crown: 2, runs: 1 } } }); assert.deepEqual(m.master, { x: { crown: 3, runs: 5 }, y: { crown: 1, runs: 1 }, z: { crown: 2, runs: 1 } }); assert.equal(mergeProfiles({}, {}).master, undefined);
});
test('Tagesaufgabe und Eier: einmal pro Tag, kleine Eier zuerst, nichts geht verloren', async () => {
  const D = await import('../src/daily.js'), P = await import('../src/pets.js'), L = await import('../src/levels.js'), { mergeProfiles } = await import('../src/merge.js'); L.setLevelSet('klavier');
  assert.deepEqual(P.EGGS.map(e => e.days), [2, 3, 4, 6, 8, 10, 14], 'Eier brauchen immer länger'); assert.equal(new Set(P.EGGS.map(e => e.pet)).size, 7); for (const e of P.EGGS) assert.equal(P.petName(e.pet), e.name);
  const p = V.newProfile('E'), day = i => { const d = new Date(2026, 10, 1, 12); d.setDate(d.getDate() + i); return V.dayKey(d); };
  assert.deepEqual(D.dailyState(p), { last: '', egg: 0, warm: 0, total: 0 }); assert.equal(D.dailyOpen(p), false); p.levels.h1 = p.levels.h2 = { stars: 1 }; assert.equal(D.dailyOpen(p), false); p.levels.h3 = { stars: 1 }; assert.equal(D.dailyOpen(p), true);
  { const q = V.newProfile('S'); q.skip = [9, 0, 0, 0]; assert.equal(D.dailyOpen(q), true, 'Einstufung öffnet die Tagesaufgabe'); const u = V.newProfile('U'); u.unlockAll = true; assert.equal(D.dailyOpen(u), true); }
  assert.deepEqual(D.nest(p), { tier: 0, days: 2, warm: 0, left: 2, pet: 'kueken', name: 'Piepmatz' });
  let r = D.completeDaily(p, day(0)); assert.ok(r.counted && !r.hatched && r.warm === 1 && r.nest.left === 1); assert.equal(D.doneToday(p, day(0)), true); assert.equal(D.doneToday(p, day(1)), false);
  r = D.completeDaily(p, day(0)); assert.ok(!r.counted && !r.hatched && D.dailyState(p).warm === 1 && D.dailyState(p).total === 1, 'zweimal am selben Tag zählt nur einmal');
  assert.equal(D.eggAtRisk(p, day(0)), false); assert.equal(D.eggAtRisk(p, day(1)), true, 'am Tag danach muss gespielt werden');
  r = D.completeDaily(p, day(1)); assert.ok(r.counted && r.hatched === 'kueken' && r.egg === 1 && r.warm === 0, 'am nächsten Tag: das Ei schlüpft'); assert.deepEqual(p.pets, ['kueken']); assert.ok(P.owns(p, 'kueken')); assert.equal(D.nest(p).name, 'Schildi');
  // Ein Tag ausgelassen: das angewärmte Ei ist verloren, ein neues derselben Größe liegt im Nest
  D.completeDaily(p, day(2)); D.completeDaily(p, day(3)); assert.equal(D.dailyState(p).warm, 2); assert.equal(D.coolEgg(p, day(4)), false, 'am Tag danach ist noch nichts verloren'); assert.equal(D.eggAtRisk(p, day(4)), true);
  assert.equal(D.coolEgg(p, day(5)), true, 'Tag 4 ausgelassen: Ei kalt'); assert.equal(D.dailyState(p).warm, 0); assert.equal(D.dailyState(p).egg, 1, 'dieselbe Ei-Größe'); assert.equal(D.coldDays(p), 2); assert.equal(D.coolEgg(p, day(5)), false, 'nur einmal'); assert.deepEqual(p.pets, ['kueken'], 'geschlüpfte Tiere bleiben');
  r = D.completeDaily(p, day(5)); assert.ok(r.counted && r.warm === 1 && !r.hatched); assert.equal(D.coldDays(p), 0, 'nach dem Weiterspielen ist der Hinweis weg'); assert.equal(p.daily.lost, 1);
  { const q = V.newProfile('Q'); D.completeDaily(q, day(0)); const res = D.completeDaily(q, day(9)); assert.ok(res.counted && res.warm === 1 && !res.hatched, 'lange Pause: Zählung beginnt neu'); const z = V.newProfile('Z'); assert.equal(D.coolEgg(z, day(3)), false, 'ohne angewärmtes Ei geht nichts verloren'); }
  const hatched = ['kueken']; let d = 6; while (D.nest(p)) { r = D.completeDaily(p, day(d++)); if (r.hatched) hatched.push(r.hatched); assert.ok(d < 80); }
  assert.deepEqual(hatched, P.EGGS.map(e => e.pet)); assert.deepEqual(P.ownedPets(p).filter(x => P.EGGS.some(e => e.pet === x)), P.EGGS.map(e => e.pet));
  { const f = V.newProfile('F2'); let n = 0; while (D.nest(f)) D.completeDaily(f, day(n++)); assert.equal(n, 47, 'ohne Pause: 47 Tage bis zum Sternendrachen'); }
  const tot = D.dailyState(p).total; r = D.completeDaily(p, day(d)); assert.ok(r.counted && !r.hatched && r.nest === null && D.dailyState(p).total === tot + 1, 'nach dem letzten Ei geht die Tagesaufgabe weiter');
  // Noten der Tagesaufgabe
  const fresh = V.newProfile('F'), fp = D.dailyPool(fresh); assert.ok(fp.length >= 5 && fp.every(e => e.clef === 'treble' && L.ALL_NOTES[0].includes(e.key)), 'ohne Vorwissen: Noten der ersten Welt');
  const tr = V.newProfile('T'); ['c1', 'd1', 'e1', 'f1', 'g1', 'a1'].forEach(k => { tr.notes[k] = { box: 1, seen: 3 }; }); const tp = D.dailyPool(tr); assert.deepEqual([...new Set(tp.map(e => e.key))].sort(), ['a1', 'c1', 'd1', 'e1', 'f1', 'g1']); assert.ok(tp.every(e => e.clef === 'treble'), 'nur Violinschlüssel, solange der Bass unbekannt ist');
  ['c', 'H', 'A'].forEach(k => { tr.notes[k] = { box: 0, seen: 2 }; }); const bp = D.dailyPool(tr); assert.ok(bp.some(e => e.clef === 'bass' && e.key === 'A') && bp.some(e => e.clef === 'treble' && e.key === 'g1') && !bp.some(e => e.key === 'h1'), 'mit Bass-Noten: beide Schlüssel, nur Bekanntes');
  L.setLevelSet('gitarre'); const gp = D.dailyPool(V.newProfile('G')); assert.ok(gp.length >= 5 && gp.every(e => L.ALL_NOTES[0].includes(e.key)), 'Gitarre: Noten der hohen Saiten'); L.setLevelSet('klavier');
  // Zusammenführen: der weitere Stand gewinnt
  assert.deepEqual(mergeProfiles({ daily: { egg: 2, warm: 1, total: 6, last: '2026-11-10' } }, { daily: { egg: 1, warm: 2, total: 9, last: '2026-11-12' } }).daily, { egg: 2, warm: 1, total: 9, last: '2026-11-12' }); assert.deepEqual(mergeProfiles({ daily: { egg: 1, warm: 1, total: 2, last: 'a' } }, { daily: { egg: 1, warm: 2, total: 3, last: 'b' } }).daily, { egg: 1, warm: 2, total: 3, last: 'b' }); assert.equal(mergeProfiles({}, {}).daily, undefined);
});
test('Endlos-Modus: Zeitlimit, Level aus bekannten Noten, Rekorde je Instrument', async () => {
  const E = await import('../src/endless.js'), L = await import('../src/levels.js'), { mergeProfiles } = await import('../src/merge.js'); L.setLevelSet('klavier');
  assert.equal(E.timeLimit('jump', 0), 9); assert.ok(E.timeLimit('jump', 10) < E.timeLimit('jump', 5)); assert.equal(E.timeLimit('jump', 500), 3.5); assert.equal(E.timeLimit('bau', 0), 12); assert.equal(E.timeLimit('bau', 500), 5);
  const p = V.newProfile('E'); ['c1', 'd1', 'e1', 'f1', 'g1', 'a1'].forEach(k => { p.notes[k] = { box: 1, seen: 3 }; });
  for (const t of E.ENDLESS_TYPES) { const l = E.endlessLevel(p, t); assert.ok(l.endless && l.type === t && l.id === 'endlos-' + t && l.clef === 'treble' && !l.accidentals && l.len >= 300); assert.deepEqual([...l.notes].sort(), ['a1', 'c1', 'd1', 'e1', 'f1', 'g1']); assert.equal(new Set(l.notes).size, l.notes.length); }
  ['c', 'H', 'A', 'G'].forEach(k => { p.notes[k] = { box: 0, seen: 2 }; }); p.notes.fis1 = { box: 0, seen: 2 }; const g = E.endlessLevel(p, 'jump'); assert.equal(g.clef, 'grand', 'mit Bass-Noten: großes System'); assert.ok(g.accidentals && g.notes.includes('A') && g.notes.includes('fis1') && new Set(g.notes).size === g.notes.length);
  assert.equal(E.endlessBest(p, 'regen'), 0); let r = E.recordEndless(p, 'regen', 12); assert.deepEqual(r, { score: 12, best: 12, prevBest: 0, newBest: true, runs: 1 }); r = E.recordEndless(p, 'regen', 9); assert.deepEqual(r, { score: 9, best: 12, prevBest: 12, newBest: false, runs: 2 }); r = E.recordEndless(p, 'regen', 20); assert.ok(r.newBest && r.prevBest === 12 && r.best === 20);
  assert.equal(E.recordEndless(p, 'jump', 0).newBest, false, 'null Noten sind kein Rekord'); E.recordEndless(p, 'bau', 7); assert.equal(E.endlessTop(p), 20);
  L.setLevelSet('gitarre'); assert.equal(E.endlessBest(p, 'regen'), 0, 'Gitarre zählt eigene Rekorde'); E.recordEndless(p, 'regen', 31); assert.equal(E.endlessKey('regen'), 'g-regen'); assert.equal(E.endlessLevel(V.newProfile('G'), 'bau').clef, 'treble'); L.setLevelSet('klavier'); assert.equal(E.endlessBest(p, 'regen'), 20); assert.equal(E.endlessTop(p), 31);
  assert.equal(E.nextGoal(0), 10); assert.equal(E.nextGoal(10), 25); assert.equal(E.nextGoal(99), 100); assert.equal(E.nextGoal(300), null);
  assert.deepEqual(mergeProfiles({ endless: { regen: { best: 20, runs: 3 } } }, { endless: { regen: { best: 14, runs: 5 }, bau: { best: 4, runs: 1 } } }).endless, { regen: { best: 20, runs: 5 }, bau: { best: 4, runs: 1 } }); assert.equal(mergeProfiles({}, {}).endless, undefined);
});
test('Liederwelt: Lieder stimmen im Takt, Gitarre in G-Lage, Öffnen und Sterne', async () => {
  const SG = await import('../src/songs.js'), L = await import('../src/levels.js'), { mergeProfiles } = await import('../src/merge.js');
  for (const set of ['klavier', 'gitarre']) { L.setLevelSet(set); const all = SG.songs(), known = new Set(L.ALL_NOTES.flat()); assert.equal(all.length, 9); assert.equal(new Set(all.map(s => s.id)).size, 9);
    for (const s of all) { assert.ok(s.title && s.from && s.meter === 4 && s.bpm >= 60 && s.bpm <= 120, s.id); assert.ok(s.notes.length >= 20 && s.notes.length <= 60, s.id + ': ' + s.notes.length + ' Noten'); assert.equal(s.beats % s.meter, 0, s.id + ': volle Takte');
      // jeder Takt ist genau voll: Keine Note ragt über einen Taktstrich
      for (const n of s.notes) { assert.ok([0.5, 1, 1.5, 2, 3, 4].includes(n.beats), s.id + ': Notenwert ' + n.beats); assert.ok(Math.floor(n.t0 / s.meter + 1e-9) === Math.floor((n.t0 + n.beats - 1e-9) / s.meter), `${s.id}: Note bei Schlag ${n.t0} ragt über den Taktstrich`); assert.ok(known.has(n.key), `${set} ${s.id}: ${n.key} kommt in den Leveln vor`); assert.equal(M.N(n.key).alt, 0, 'keine Vorzeichen'); }
      const ps = s.keys.map(k => M.staffPos(M.N(k), 'treble')); assert.ok(Math.min(...ps) >= -2 && Math.max(...ps) <= 9, `${set} ${s.id}: liegt gut im System`); assert.deepEqual(s.keys, [...s.keys].sort((a, b) => M.midiOf(M.N(a)) - M.midiOf(M.N(b)))); } }
  L.setLevelSet('klavier'); const pk = SG.songs(); L.setLevelSet('gitarre'); const gt = SG.songs();
  for (let i = 0; i < pk.length; i++) { assert.equal(pk[i].notes.length, gt[i].notes.length); for (let k = 0; k < pk[i].notes.length; k++) { assert.equal(M.midiOf(M.N(gt[i].notes[k].key)) - M.midiOf(M.N(pk[i].notes[k].key)), 7, 'Gitarre: eine Quinte höher'); assert.equal(gt[i].notes[k].beats, pk[i].notes[k].beats); } }
  assert.equal(SG.songKey('lamm'), 'g-lamm'); L.setLevelSet('klavier'); assert.equal(SG.songKey('lamm'), 'lamm');
  // bekannte Anfänge (in C-Dur)
  const start = id => SG.songById(id).notes.slice(0, 7).map(n => n.key).join(' ');
  assert.equal(start('entchen'), 'c1 d1 e1 f1 g1 g1 a1'); assert.equal(start('haenschen'), 'g1 e1 e1 f1 d1 d1 c1'); assert.equal(start('freude'), 'e1 e1 f1 g1 g1 f1 e1'); assert.equal(start('weihnachtsmann'), 'c1 c1 g1 g1 a1 a1 g1'); assert.equal(start('jingle'), 'e1 e1 e1 e1 e1 e1 e1'); assert.equal(start('fuchs'), 'c1 d1 e1 f1 g1 g1 g1'); assert.equal(start('auclair'), 'c1 c1 c1 d1 e1 d1 c1');
  // öffnen: sobald alle Noten des Lieds vorkamen
  const p = V.newProfile('L'), s1 = SG.songById('auclair'), s3 = SG.songById('entchen'); assert.deepEqual(SG.missingNotes(p, s1), ['c1', 'd1', 'e1']); assert.equal(SG.songOpen(p, s1), false); ['c1', 'd1', 'e1'].forEach(k => { p.notes[k] = { seen: 1 }; }); assert.equal(SG.songOpen(p, s1), true); assert.deepEqual(SG.missingNotes(p, s3), ['f1', 'g1', 'a1']); p.unlockAll = true; assert.equal(SG.songOpen(p, s3), true); p.unlockAll = false;
  // Sterne und Eintragen
  assert.equal(SG.songStars('step', 1), 3); assert.equal(SG.songStars('step', 0.89), 2); assert.equal(SG.songStars('step', 0.5), 1); assert.equal(SG.songStars('tempo', 0.9), 3); assert.equal(SG.songStars('tempo', 0.75), 2); assert.equal(SG.songStars('tempo', 0.5), 1); assert.equal(SG.songStars('tempo', 0.49), 0);
  assert.deepEqual(SG.songRec(p, 'auclair'), { step: 0, tempo: 0, bpm: 0, runs: 0 }); let r = SG.recordSong(p, 'auclair', 'step', 0.8, 76); assert.deepEqual(r, { stars: 2, best: 2, better: true }); r = SG.recordSong(p, 'auclair', 'step', 0.6, 76); assert.deepEqual(r, { stars: 1, best: 2, better: false });
  r = SG.recordSong(p, 'auclair', 'tempo', 0.4, 53); assert.equal(r.stars, 0); assert.equal(SG.songRec(p, 'auclair').bpm, 0, 'nicht geschafft: kein Tempo-Rekord'); SG.recordSong(p, 'auclair', 'tempo', 0.95, 53); SG.recordSong(p, 'auclair', 'tempo', 0.8, 76); assert.deepEqual(SG.songRec(p, 'auclair'), { step: 2, tempo: 3, bpm: 76, runs: 5 }); assert.equal(SG.songStarTotal(p), 5);
  assert.deepEqual(mergeProfiles({ songs: { lamm: { step: 3, tempo: 1, bpm: 60, runs: 2 } } }, { songs: { lamm: { step: 2, tempo: 2, bpm: 84, runs: 4 }, fuchs: { step: 1, tempo: 0, bpm: 0, runs: 1 } } }).songs, { lamm: { step: 3, tempo: 2, bpm: 84, runs: 4 }, fuchs: { step: 1, tempo: 0, bpm: 0, runs: 1 } }); assert.equal(mergeProfiles({}, {}).songs, undefined);
});
