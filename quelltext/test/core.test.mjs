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
