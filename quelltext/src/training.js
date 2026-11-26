// Freies Training: Regeln ohne Bildschirm – welche Noten, welche Disziplin, wie gerechnet und gewertet wird.
import { SETS, LEVEL_SET } from './levels.js';
import { N, midiOf } from './music.js';
import { isMastered } from './srs.js';
import { dayKey } from './save.js';

export const TRAIN_SECS = 60, TRAIN_COUNT = 20, RECORD_MIN_ACC = 70, RECORD_MIN_NOTES = 5, STAR_MIN_ACC = 80, WEAK_MIN = 3;
/** Ab so vielen Noten pro Minute gibt es 1, 2, 3 Sterne (nur 60-Sekunden-Runden, mindestens 80 % Treffer). */
export const STAR_AT = { play: [15, 25, 40], name: [25, 40, 55] };
/** Richtig, aber langsamer als das: zählt als "noch nicht flüssig". */
export const SLOW_MS = { play: 7000, name: 5000 };
const safe = k => { try { return N(k); } catch (e) { return null; } };
const PA = SETS.klavier.all, TREBLE = PA[0].filter(k => N(k).alt === 0), BASS = PA[1].filter(k => N(k).alt === 0), ACC = PA[2].filter(k => N(k).alt !== 0);
// Gitarre: Bereiche nach Saiten (alles im Violinschlüssel notiert)
const GA = SETS.gitarre.all, GRANGE = { g0: GA[0], g1: GA[1], g2: GA[2], gall: GA.flat() };
export const RANGES = { klavier: ['treble', 'bass', 'both'], gitarre: ['g0', 'g1', 'g2', 'gall'] };
const RANGE_LABEL = { treble: 'Violinschlüssel', bass: 'Bassschlüssel', both: 'Beide Schlüssel', g0: 'Hohe Saiten', g1: 'Mittlere Saiten', g2: 'Tiefe Saiten', gall: 'Alle Saiten' };
const guitar = () => LEVEL_SET === 'gitarre';

export function normalize(c = {}) {
  const cfg = { input: c.input === 'name' ? 'name' : 'play', range: RANGES[LEVEL_SET].includes(c.range) ? c.range : RANGES[LEVEL_SET][0], acc: !!c.acc, len: c.len === 'count' ? 'count' : 'time', weak: !!c.weak };
  if (cfg.range === 'bass' || cfg.weak || guitar()) cfg.acc = false; return cfg;
}
/** Noten, die schon vorkamen, aber noch nicht sicher sitzen – mit dem Schlüssel, in dem sie gezeigt werden. */
export function weakNotes(profile) {
  if (guitar()) return GRANGE.gall.filter(k => profile.notes && profile.notes[k] && profile.notes[k].seen >= 2 && !isMastered(profile.notes[k])).map(k => ({ key: k, clef: 'treble' }));
  return Object.keys(profile.notes || {}).filter(k => safe(k) && profile.notes[k].seen >= 2 && !isMastered(profile.notes[k]))
    .map(k => ({ key: k, clef: TREBLE.includes(k) || ACC.includes(k) ? 'treble' : BASS.includes(k) ? 'bass' : N(k).step < 0 ? 'bass' : 'treble' }));
}
/** Die Noten einer Runde: [{ key, clef }]. Bei "beide" steht das mittlere c in beiden Schlüsseln. */
export function pool(cfg, profile) {
  if (cfg.weak) return weakNotes(profile);
  if (GRANGE[cfg.range]) return GRANGE[cfg.range].map(k => ({ key: k, clef: 'treble' }));
  const out = [];
  if (cfg.range !== 'bass') { TREBLE.forEach(k => out.push({ key: k, clef: 'treble' })); if (cfg.acc) ACC.forEach(k => out.push({ key: k, clef: 'treble' })); }
  if (cfg.range !== 'treble') BASS.forEach(k => out.push({ key: k, clef: 'bass' }));
  return out;
}
/** Kennung der Disziplin (für Rekorde). Wackelnoten-Runden haben keine: Die Noten wechseln ja. */
export function disc(cfg) { return cfg.weak ? null : `${cfg.input}-${cfg.range}${cfg.acc ? '+v' : ''}-${cfg.len}`; }
export function discLabel(cfg) {
  const r = cfg.weak ? 'Meine Wackelnoten' : RANGE_LABEL[cfg.range] + (cfg.acc ? ' mit Vorzeichen' : ''), g = cfg.weak ? guitar() : !!GRANGE[cfg.range];
  return `${r} · ${cfg.input === 'play' ? (g ? 'auf der Gitarre' : 'am Klavier') : 'Namen antippen'} · ${cfg.len === 'time' ? '60 Sekunden' : '20 Noten'}`;
}
/** Die gemeinsame Disziplin für die Bestenliste. */
export const BOARD_DISC = 'play-treble-time', BOARD_DISC_G = 'play-gall-time';
export const boardDisc = () => (guitar() ? BOARD_DISC_G : BOARD_DISC);
export const rangeLabel = r => RANGE_LABEL[r] || r;
/** raw: { correct, first, tried, ms } -> Noten pro Minute und Trefferquote (beim ersten Versuch richtig). */
export function metrics(raw) {
  const ms = Math.max(1000, raw.ms || 0); return { npm: Math.round(raw.correct * 60000 / ms), acc: raw.tried ? Math.round(100 * raw.first / raw.tried) : 0 };
}
export function starsFor(input, npm, acc) { if (acc < STAR_MIN_ACC) return 0; const t = STAR_AT[input] || STAR_AT.play; return npm >= t[2] ? 3 : npm >= t[1] ? 2 : npm >= t[0] ? 1 : 0; }
/** Runde eintragen. Rekord zählt erst ab 70 % Treffern und 5 richtigen Noten – erst genau, dann schnell. */
export function record(profile, cfg, raw, day = dayKey()) {
  const m = metrics(raw), d = disc(cfg), out = { ...m, disc: d, counted: false, newBest: false, prevBest: 0, best: 0, stars: 0, starsGained: 0, nextStar: null, why: '' };
  if (!d) { out.why = 'weak'; return out; }
  profile.train = profile.train || {}; const t = profile.train[d] || (profile.train[d] = { cfg: { input: cfg.input, range: cfg.range, acc: cfg.acc, len: cfg.len }, best: 0, bestAcc: 0, stars: 0, runs: [] });
  t.runs.push({ d: day, n: m.npm, a: m.acc }); if (t.runs.length > 30) t.runs.splice(0, t.runs.length - 30);
  out.prevBest = t.best; out.counted = m.acc >= RECORD_MIN_ACC && raw.correct >= RECORD_MIN_NOTES; if (!out.counted) out.why = raw.correct < RECORD_MIN_NOTES ? 'few' : 'acc';
  if (out.counted && m.npm > t.best) { t.best = m.npm; t.bestAcc = m.acc; out.newBest = true; }
  if (cfg.len === 'time') { const s = out.counted ? starsFor(cfg.input, m.npm, m.acc) : 0; out.starsGained = Math.max(0, s - t.stars); t.stars = Math.max(t.stars, s); const th = STAR_AT[cfg.input]; out.nextStar = t.stars < 3 ? th[t.stars] : null; }
  out.best = t.best; out.stars = t.stars; return out;
}
export function trainStars(profile) { return Object.values((profile && profile.train) || {}).reduce((a, t) => a + (t.stars || 0), 0); }
/** Die bis zu drei langsamsten Noten einer Runde (Durchschnitt je Note), nur wenn sie deutlich über dem Mittel liegen. */
export function slowest(times, max = 3) {
  const by = new Map(); for (const t of times) { const k = t.clef + ':' + t.key, e = by.get(k) || { key: t.key, clef: t.clef, sum: 0, n: 0 }; e.sum += t.ms; e.n++; by.set(k, e); }
  const all = [...by.values()].map(e => ({ key: e.key, clef: e.clef, ms: e.sum / e.n })); if (all.length < 4) return [];
  const mean = all.reduce((a, e) => a + e.ms, 0) / all.length; return all.filter(e => e.ms > mean * 1.25 && e.ms > 1200).sort((a, b) => b.ms - a.ms).slice(0, max);
}
/** Zwei Einträge klingen gleich (z. B. cis² und des²)? Dann nicht direkt nacheinander – das Mikrofon würde den zweiten verschlucken. */
export function sameSound(a, b) { return !!a && !!b && midiOf(N(a.key)) === midiOf(N(b.key)); }
