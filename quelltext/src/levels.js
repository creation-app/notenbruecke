// Welten und Level. Jede Welt führt Noten in kleinen Schritten ein; drei Spielarten wechseln sich ab.
import { N } from './music.js';

export const WORLDS = [
  { id: 'himmel', name: 'Himmel der hohen Töne', short: 'Himmel', clef: 'treble', theme: 'himmel', need: 0 },
  { id: 'tiefe', name: 'Tiefen der tiefen Töne', short: 'Tiefe', clef: 'bass', theme: 'tiefe', need: 8 },
  { id: 'zauber', name: 'Land der Zauberzeichen', short: 'Zauberzeichen', clef: 'treble', theme: 'zauber', need: 6 },
  { id: 'beide', name: 'Die große Brücke', short: 'Große Brücke', clef: 'grand', theme: 'abend', need: 6, after: 1 },
];
export function prevWorld(world) { return WORLDS[world].after != null ? WORLDS[world].after : world - 1; }
export const TYPE_LABEL = { jump: 'Springen', regen: 'Notenregen', bau: 'Brückenbauer', boss: 'Melodie' };

const L = (id, world, type, title, notes, fresh, extra = {}) => ({ id, world, type, title, notes, fresh: fresh || [], len: 10, ...extra });
const T1 = ['c1', 'd1', 'e1', 'f1', 'g1'], T2 = [...T1, 'a1', 'h1'], T3 = [...T2, 'c2', 'd2'], T4 = [...T3, 'e2', 'f2'], T5 = [...T4, 'g2', 'a2'];
const B1 = ['c1', 'f', 'c', 'g'], B2 = [...B1, 'a', 'h'], B3 = [...B2, 'd', 'e'], B4 = [...B3, 'G', 'A', 'H'], B5 = [...B4, 'C', 'D', 'E', 'F'];
const ENTCHEN = 'c1 d1 e1 f1 g1 g1 a1 a1 a1 a1 g1 a1 a1 a1 a1 g1 f1 f1 f1 f1 e1 e1 d1 d1 d1 d1 c1'.split(' ');
const FREUDE = 'e1 e1 f1 g1 g1 f1 e1 d1 c1 c1 d1 e1 e1 d1 d1 e1 e1 f1 g1 g1 f1 e1 d1 c1 c1 d1 e1 d1 c1 c1'.split(' ');
const HAENSCHEN = 'g2 e2 e2 f2 d2 d2 c2 d2 e2 f2 g2 g2 g2 g2 e2 e2 f2 d2 d2 c2 e2 g2 g2 c2'.split(' ');
const JAKOB = 'c d e c c d e c e f g e f g'.split(' ');
const TIEFSEE = 'C E G c G E C F A c A F G H d G C'.split(' ');
const JAKOB2 = 'c d e c c1 d1 e1 c1 e f g e1 f1 g1 g a g f e c g1 a1 g1 f1 e1 c1 c g c c1 g1 c1'.split(' ');
const ELISE = 'e2 dis2 e2 dis2 e2 h1 d2 c2 a1 c1 e1 a1 h1 e1 gis1 h1 c2'.split(' ');

export const LEVELS = [
  L('h1', 0, 'jump', 'Die ersten Töne', ['c1', 'g1'], ['c1', 'g1'], { len: 8 }),
  L('h2', 0, 'jump', 'Die Dreiklang-Treppe', ['c1', 'e1', 'g1'], ['e1']),
  L('h3', 0, 'regen', 'Erster Notenregen', ['c1', 'e1', 'g1']),
  L('h4', 0, 'jump', 'Fünf Freunde', T1, ['d1', 'f1']),
  L('h5', 0, 'bau', 'Baue die Brücke', T1, [], { words: ['FEE'] }),
  L('h6', 0, 'jump', 'Höher hinaus', T2, ['a1', 'h1']),
  L('h7', 0, 'regen', 'Wolkenbruch', T2),
  L('h8', 0, 'boss', 'Alle meine Entchen', [...new Set(ENTCHEN)], [], { melody: ENTCHEN }),
  L('h9', 0, 'jump', 'Über die Mitte', T3, ['c2', 'd2']),
  L('h10', 0, 'bau', 'Wörter aus Noten', T3, [], { words: ['AFFE', 'DACH', 'CAFE', 'HEFE', 'ADE'] }),
  L('h11', 0, 'jump', 'Bis zur obersten Linie', T4, ['e2', 'f2']),
  L('h12', 0, 'regen', 'Sturm der Noten', T4),
  L('h13', 0, 'boss', 'Freude schöner Götterfunken', [...new Set(FREUDE)], [], { melody: FREUDE }),
  L('h14', 0, 'jump', 'Über den Wolken', T5, ['g2', 'a2'], { len: 12 }),
  L('h15', 0, 'boss', 'Hänschen klein', [...new Set(HAENSCHEN)], [], { melody: HAENSCHEN }),

  L('t1', 1, 'jump', 'Die Brücke am mittleren c', ['c1', 'f'], ['f'], { len: 8 }),
  L('t2', 1, 'jump', 'Abstieg in die Tiefe', B1, ['c', 'g']),
  L('t3', 1, 'regen', 'Blubberblasen', B1),
  L('t4', 1, 'jump', 'Die Leuchtgrotte', B2, ['a', 'h']),
  L('t5', 1, 'bau', 'Brücken unter Wasser', B2, [], { words: ['ACH', 'FACH'] }),
  L('t6', 1, 'jump', 'Kristallstufen', B3, ['d', 'e']),
  L('t7', 1, 'regen', 'Strudel', B3),
  L('t8', 1, 'boss', 'Bruder Jakob', [...new Set(JAKOB)], [], { melody: JAKOB }),
  L('t9', 1, 'jump', 'Die große Oktave', B4, ['G', 'A', 'H']),
  L('t10', 1, 'bau', 'Tiefbau', B4, [], { words: ['GAGE', 'EHE', 'CHEF'] }),
  L('t11', 1, 'jump', 'Am Meeresgrund', B5, ['C', 'D', 'E', 'F'], { len: 12 }),
  L('t12', 1, 'regen', 'Tiefenrausch', B5),
  L('t13', 1, 'boss', 'Lied der Tiefsee', [...new Set(TIEFSEE)], [], { melody: TIEFSEE }),

  L('z1', 2, 'jump', 'Kreuz und b', ['f1', 'fis1', 'h1', 'b1', 'g1', 'a1'], ['fis1', 'b1']),
  L('z2', 2, 'regen', 'Zauberregen', ['f1', 'fis1', 'h1', 'b1', 'g1', 'a1']),
  L('z3', 2, 'jump', 'Schwarze Tasten', ['fis1', 'b1', 'cis2', 'es2', 'c2', 'e2', 'd2'], ['cis2', 'es2']),
  L('z4', 2, 'bau', 'Zeichen setzen', ['fis1', 'b1', 'cis2', 'es2', 'f1', 'h1'], [], { accidentals: true }),
  L('z5', 2, 'jump', 'Zwei Namen, eine Taste', ['gis1', 'as1', 'cis2', 'des2', 'fis1', 'b1', 'es2'], ['gis1', 'as1', 'des2']),
  L('z6', 2, 'regen', 'Funkensturm', ['fis1', 'b1', 'cis2', 'es2', 'gis1', 'as1', 'des2', 'g1', 'a1']),
  L('z7', 2, 'boss', 'Für Elise', [...new Set(ELISE)], ['dis2'], { melody: ELISE }),

  L('b1', 3, 'jump', 'Zwei Hände, eine Brücke', ['c', 'e', 'g', 'c1', 'e1', 'g1']),
  L('b2', 3, 'regen', 'Links und rechts', ['c', 'd', 'e', 'f', 'g', 'c1', 'd1', 'e1', 'f1', 'g1']),
  L('b3', 3, 'jump', 'Rund um das mittlere c', ['f', 'g', 'a', 'h', 'c1', 'd1', 'e1', 'f1', 'g1'], [], { len: 12 }),
  L('b4', 3, 'bau', 'Schreiben im großen System', ['c', 'e', 'g', 'a', 'c1', 'd1', 'f1', 'a1', 'c2'], [], { words: ['FACH', 'CAFE'] }),
  L('b5', 3, 'boss', 'Bruder Jakob für zwei Hände', [...new Set(JAKOB2)], [], { melody: JAKOB2 }),
];
LEVELS.forEach(l => { l.clef = WORLDS[l.world].clef; l.theme = WORLDS[l.world].theme; [...l.notes, ...(l.melody || [])].forEach(N); });

const earlier = new Set();
export const ALL_NOTES = WORLDS.map((w, wi) => { const seen = []; LEVELS.filter(l => l.world === wi).forEach(l => l.notes.forEach(k => { if (!seen.includes(k) && !(w.clef === 'grand' && earlier.has(k))) seen.push(k); })); seen.forEach(k => earlier.add(k)); return seen; });
export function creatureTotal() { return new Set(ALL_NOTES.flat()).size; }
export function levelsOf(world) { return LEVELS.filter(l => l.world === world); }
export function doneCount(profile, world) { return levelsOf(world).filter(l => profile.levels[l.id]).length; }
export function worldUnlocked(profile, world) { return world === 0 || profile.unlockAll || (profile.skip || [])[world] > 0 || doneCount(profile, prevWorld(world)) >= WORLDS[world].need; }
export function levelUnlocked(profile, level) {
  if (profile.unlockAll) return true; if (!worldUnlocked(profile, level.world)) return false;
  const ls = levelsOf(level.world), i = ls.indexOf(level); return i === 0 || i < ((profile.skip || [])[level.world] || 0) || !!profile.levels[ls[i - 1].id];
}
export function nextLevel(level) { const i = LEVELS.indexOf(level); return LEVELS[i + 1] || null; }
export function starsFor(ratio) { return ratio >= 0.85 ? 3 : ratio >= 0.65 ? 2 : 1; }
/** Sterne aus Leveln plus Sterne aus dem Training. */
export function totalStars(profile) { return Object.values(profile.levels).reduce((a, l) => a + (l.stars || 0), 0) + Object.values(profile.train || {}).reduce((a, t) => a + (t.stars || 0), 0); }

/** Einstufung: Wer eine Stufe besteht, darf entsprechend weit vorne einsteigen. skip = freigeschaltete Level je Welt. */
export const PLACEMENT = [
  { name: 'Violinschlüssel: c¹ bis g¹', clef: 'treble', notes: T1, skip: [6, 0, 0, 0] },
  { name: 'Violinschlüssel: bis d²', clef: 'treble', notes: ['a1', 'h1', 'c2', 'd2', 'g1', 'f1'], skip: [11, 0, 0, 0] },
  { name: 'Violinschlüssel: bis a²', clef: 'treble', notes: ['e2', 'f2', 'g2', 'a2', 'd2', 'h1'], skip: [15, 1, 0, 0] },
  { name: 'Bassschlüssel: kleines c bis c¹', clef: 'bass', notes: B3, skip: [15, 9, 0, 0] },
  { name: 'Bassschlüssel: bis zum großen C', clef: 'bass', notes: ['G', 'A', 'H', 'C', 'D', 'E', 'F'], skip: [15, 13, 1, 1] },
  { name: 'Vorzeichen', clef: 'treble', notes: ['fis1', 'b1', 'cis2', 'es2', 'gis1', 'as1', 'des2'], skip: [15, 13, 7, 1] },
];
export const PLACEMENT_Q = 5, PLACEMENT_PASS = 4;
