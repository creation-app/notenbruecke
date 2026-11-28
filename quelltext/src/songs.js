// Liederwelt: gemeinfreie Melodien (Volks- und Kinderlieder, Beethoven, Pierpont) zum Spielen vom Blatt.
// Notiert in C-Dur (Viertel = 1). Für die Gitarre wird alles eine Quinte höher gesetzt (G-Lage: g¹ bis g²) – so bleiben es Noten aus den ersten Gitarren-Welten.
import { N, midiOf } from './music.js';
import { LEVEL_SET } from './levels.js';

const RAW = [
  ['auclair', 'Au clair de la lune', 'Volkslied aus Frankreich', 4, 76, 'c1 c1 c1 d1 | e1:2 d1:2 | c1 e1 d1 d1 | c1:4 | c1 c1 c1 d1 | e1:2 d1:2 | c1 e1 d1 d1 | c1:4'],
  ['lamm', 'Mary hat ein kleines Lamm', 'Kinderlied aus den USA', 4, 84, 'e1 d1 c1 d1 | e1 e1 e1:2 | d1 d1 d1:2 | e1 g1 g1:2 | e1 d1 c1 d1 | e1 e1 e1 e1 | d1 d1 e1 d1 | c1:4'],
  ['entchen', 'Alle meine Entchen', 'Kinderlied aus Deutschland', 4, 84, 'c1 d1 e1 f1 | g1:2 g1:2 | a1 a1 a1 a1 | g1:4 | a1 a1 a1 a1 | g1:4 | f1 f1 f1 f1 | e1:2 e1:2 | g1 g1 g1 g1 | c1:4'],
  ['haenschen', 'Hänschen klein', 'Kinderlied aus Deutschland', 4, 88, 'g1 e1 e1:2 | f1 d1 d1:2 | c1 d1 e1 f1 | g1 g1 g1:2 | g1 e1 e1:2 | f1 d1 d1:2 | c1 e1 g1 g1 | c1:4'],
  ['summ', 'Summ, summ, summ', 'Kinderlied aus Böhmen', 4, 88, 'g1 f1 e1:2 | d1 e1 f1 d1 | c1:4 | e1 f1 g1 e1 | d1 e1 f1 d1 | e1 f1 g1 e1 | d1 e1 f1 d1 | g1 f1 e1:2 | d1 e1 f1 d1 | c1:4'],
  ['weihnachtsmann', 'Morgen kommt der Weihnachtsmann', 'Melodie aus Frankreich', 4, 92, 'c1 c1 g1 g1 | a1 a1 g1:2 | f1 f1 e1 e1 | d1 d1 c1:2 | g1 g1 f1 f1 | e1 e1 d1:2 | g1 g1 f1 f1 | e1 e1 d1:2 | c1 c1 g1 g1 | a1 a1 g1:2 | f1 f1 e1 e1 | d1 d1 c1:2'],
  ['fuchs', 'Fuchs, du hast die Gans gestohlen', 'Kinderlied aus Deutschland', 4, 96, 'c1 d1 e1 f1 | g1 g1 g1 g1 | a1 f1 c2 a1 | g1:4 | a1 f1 c2 a1 | g1:4 | g1 f1 f1 f1 | f1 e1 e1 e1 | e1 d1 e1 d1 | c1:4'],
  ['freude', 'Freude schöner Götterfunken', 'Ludwig van Beethoven', 4, 92, 'e1 e1 f1 g1 | g1 f1 e1 d1 | c1 c1 d1 e1 | e1:1.5 d1:0.5 d1:2 | e1 e1 f1 g1 | g1 f1 e1 d1 | c1 c1 d1 e1 | d1:1.5 c1:0.5 c1:2'],
  ['jingle', 'Jingle Bells', 'James Lord Pierpont', 4, 100, 'e1 e1 e1:2 | e1 e1 e1:2 | e1 g1 c1:1.5 d1:0.5 | e1:4 | f1 f1 f1:1.5 f1:0.5 | f1 e1 e1 e1:0.5 e1:0.5 | e1 d1 d1 e1 | d1:2 g1:2 | e1 e1 e1:2 | e1 e1 e1:2 | e1 g1 c1:1.5 d1:0.5 | e1:4 | f1 f1 f1:1.5 f1:0.5 | f1 e1 e1 e1:0.5 e1:0.5 | g1 g1 f1 d1 | c1:4'],
];
const TO_G = { c1: 'g1', d1: 'a1', e1: 'h1', f1: 'c2', g1: 'd2', a1: 'e2', c2: 'g2' };
const parse = (text, map) => text.split(/\s+/).filter(t => t && t !== '|').map(t => { const [k, d] = t.split(':'), key = map ? map[k] : k; if (!key) throw new Error('Note ' + k + ' lässt sich nicht für die Gitarre setzen'); N(key); return { key, beats: d ? +d : 1 }; });
const build = map => RAW.map(([id, title, from, meter, bpm, text]) => { const notes = parse(text, map); let t = 0; for (const n of notes) { n.t0 = t; t += n.beats; } return { id, title, from, meter, bpm, notes, beats: t, keys: [...new Set(notes.map(n => n.key))].sort((a, b) => midiOf(N(a)) - midiOf(N(b))) }; });
const SETS = { klavier: build(null), gitarre: build(TO_G) };
/** Die Lieder für das aktuelle Instrument. */
export function songs() { return SETS[LEVEL_SET] || SETS.klavier; }
export function songById(id) { return songs().find(s => s.id === id) || null; }
export const TEMPOS = [['langsam', 0.7], ['mittel', 0.85], ['Original', 1]];
/** Rekorde getrennt je Instrument. */
export function songKey(id) { return (LEVEL_SET === 'gitarre' ? 'g-' : '') + id; }
export function songRec(profile, id) { const r = (profile.songs || {})[songKey(id)] || {}; return { step: r.step || 0, tempo: r.tempo || 0, bpm: r.bpm || 0, runs: r.runs || 0 }; }
/** Ein Lied ist offen, sobald alle seine Noten schon einmal vorkamen. Fehlende Noten werden zurückgegeben. */
export function missingNotes(profile, song) { const st = profile.notes || {}; return profile.unlockAll ? [] : song.keys.filter(k => !(st[k] && st[k].seen >= 1)); }
export function songOpen(profile, song) { return missingNotes(profile, song).length === 0; }
/** Sterne: Note für Note nach Treffern beim ersten Versuch, im Tempo nach rechtzeitig gespielten Noten. */
export function songStars(mode, ratio) { return mode === 'tempo' ? (ratio >= 0.9 ? 3 : ratio >= 0.75 ? 2 : ratio >= 0.5 ? 1 : 0) : (ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1); }
/** Ergebnis eintragen. Gibt { stars, best, better } zurück. */
export function recordSong(profile, id, mode, ratio, bpm) {
  const all = profile.songs = profile.songs || {}, key = songKey(id), r = all[key] || (all[key] = { step: 0, tempo: 0, bpm: 0, runs: 0 }), stars = songStars(mode, ratio), prev = r[mode] || 0;
  r.runs = (r.runs || 0) + 1; r[mode] = Math.max(prev, stars); if (mode === 'tempo' && stars > 0) r.bpm = Math.max(r.bpm || 0, Math.round(bpm)); return { stars, best: r[mode], better: stars > prev };
}
export function songStarTotal(profile) { return songs().reduce((a, s) => { const r = songRec(profile, s.id); return a + r.step + r.tempo; }, 0); }
