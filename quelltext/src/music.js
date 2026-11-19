// Zentrale Musikdefinition: Notennamen, Oktaven, Frequenzen, Notensystem-Positionen.
// Eine Note ist {step, alt, key}: step = diatonische Schritte ab c¹ (0), alt = -1/0/+1.
export const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'h'];
const SEMI = [0, 2, 4, 5, 7, 9, 11];
const SUP = ['', '¹', '²', '³', '⁴'];

export function letterIdx(n) { return ((n.step % 7) + 7) % 7; }
export function octaveOf(n) { return Math.floor(n.step / 7); } // 0 = eingestrichen

/** Deutscher Stammname ohne Oktave: fis, b, es, as, des ... */
export function letterName(n) {
  const l = LETTERS[letterIdx(n)];
  if (!n.alt) return l;
  if (n.alt > 0) return l + 'is';
  if (l === 'h') return 'b';
  if (l === 'e' || l === 'a') return l + 's';
  return l + 'es';
}

export function nameParts(n) {
  const o = octaveOf(n); let base = letterName(n);
  if (o <= -2) base = base[0].toUpperCase() + base.slice(1);
  return { base, sup: o >= 0 ? String(o + 1) : '' };
}
export function nameStr(n) { const p = nameParts(n); return p.base + (p.sup ? SUP[+p.sup] : ''); }
export function nameHtml(n) { const p = nameParts(n); return p.base + (p.sup ? `<sup>${p.sup}</sup>` : ''); }

function make(step, alt) {
  const n = { step, alt: alt || 0 }; const p = nameParts(n); n.key = p.base + p.sup; return n;
}
export function note(step, alt = 0) { return make(step, alt); }

/** Parser für Schlüssel wie 'c1', 'fis1', 'b1', 'es2', 'c' (klein), 'G' (groß). */
export function N(id) {
  const m = /^(es|as|b|[acdefgh](?:is|es)?)(\d)?$/i.exec(id);
  if (!m) throw new Error('Unbekannte Note: ' + id);
  const upper = m[1][0] !== m[1][0].toLowerCase(); const s = m[1].toLowerCase();
  let letter, alt = 0;
  if (s === 'b') { letter = 'h'; alt = -1; } else if (s === 'es') { letter = 'e'; alt = -1; }
  else if (s === 'as') { letter = 'a'; alt = -1; }
  else { letter = s[0]; if (s.endsWith('is')) alt = 1; else if (s.length > 1) alt = -1; }
  const o = upper ? -2 : (m[2] ? +m[2] - 1 : -1);
  if (upper && m[2]) throw new Error('Unbekannte Note: ' + id);
  return make(LETTERS.indexOf(letter) + 7 * o, alt);
}

export function midiOf(n) { return 60 + octaveOf(n) * 12 + SEMI[letterIdx(n)] + n.alt; }
export function freqOfMidi(midi, a4 = 440) { return a4 * Math.pow(2, (midi - 69) / 12); }
export function midiOfFreq(f, a4 = 440) { return 69 + 12 * Math.log2(f / a4); }

const SHARP = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0]];
const FLAT = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
export function noteOfMidi(midi, preferFlat = false) {
  const pc = ((midi % 12) + 12) % 12; const [l, alt] = (preferFlat ? FLAT : SHARP)[pc];
  return make(l + 7 * (Math.floor(midi / 12) - 5), alt);
}

export const CLEFS = { treble: { bottom: 2 }, bass: { bottom: -10 }, grand: { bottom: -4 } };
/** Linien des Systems als Positionen. Im großen System liegen Bass (unten) und Violine (oben) so, dass c¹ genau dazwischen sitzt. */
export function staffLines(clef) { return clef === 'grand' ? [-6, -4, -2, 0, 2, 6, 8, 10, 12, 14] : [0, 2, 4, 6, 8]; }
export function stemUp(pos, clef) { return clef === 'grand' ? (pos >= 4 ? pos < 10 : pos < -2) : pos < 4; }
/** Position im System: 0 = unterste Linie, 1 = erster Zwischenraum ... */
export function staffPos(n, clef) { return n.step - CLEFS[clef].bottom; }
export function ledgerPositions(pos, clef) {
  const out = [];
  if (clef === 'grand') { if (pos === 4) out.push(4); for (let p = -8; p >= pos; p -= 2) out.push(p); for (let p = 16; p <= pos; p += 2) out.push(p); return out; }
  for (let p = -2; p >= pos; p -= 2) out.push(p);
  for (let p = 10; p <= pos; p += 2) out.push(p);
  return out;
}
export function describePos(pos, clef) {
  if (clef === 'grand') return pos >= 4 ? describePos(pos - 6) + ' im Violinschlüssel' : describePos(pos + 6) + ' im Bassschlüssel';
  if (pos < 0 || pos > 8) { const below = pos < 0, d = below ? -pos : pos - 8, side = below ? 'unter' : 'über';
    return d === 1 ? `direkt ${side} dem System` : d % 2 === 0 ? `${d / 2}. Hilfslinie ${side} dem System` : `${side} der ${(d - 1) / 2}. Hilfslinie`; }
  return pos % 2 === 0 ? `${pos / 2 + 1}. Linie` : `${(pos + 1) / 2}. Zwischenraum`;
}

/** Vergleich gespielter Ton / gesuchter Ton. */
export function classify(targetMidi, heardMidi) {
  if (heardMidi === targetMidi) return 'correct';
  if ((((heardMidi - targetMidi) % 12) + 12) % 12 === 0) return heardMidi > targetMidi ? 'octave-high' : 'octave-low';
  return 'wrong';
}
