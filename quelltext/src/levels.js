// Welten und Level. Jede Welt führt Noten in kleinen Schritten ein; drei Spielarten wechseln sich ab.
import { N } from './music.js';

const PIANO_WORLDS = [
  { id: 'himmel', name: 'Himmel der hohen Töne', short: 'Himmel', clef: 'treble', theme: 'himmel', need: 0 },
  { id: 'tiefe', name: 'Tiefen der tiefen Töne', short: 'Tiefe', clef: 'bass', theme: 'tiefe', need: 8 },
  { id: 'zauber', name: 'Land der Zauberzeichen', short: 'Zauberzeichen', clef: 'treble', theme: 'zauber', need: 6 },
  { id: 'beide', name: 'Die große Brücke', short: 'Große Brücke', clef: 'grand', theme: 'abend', need: 6, after: 1, mix: true },
];
// Gitarre: Reihenfolge der Töne wie in „Garantiert Gitarre lernen für Kinder“, Band 1 (erste bis sechste Saite). Notiert im Violinschlüssel, klingend eine Oktave tiefer.
const GUITAR_WORLDS = [
  { id: 'g-hoch', name: 'Die hohen Saiten', short: 'Hohe Saiten', clef: 'treble', theme: 'himmel', need: 0 },
  { id: 'g-mitte', name: 'Die mittleren Saiten', short: 'Mittlere Saiten', clef: 'treble', theme: 'zauber', need: 7 },
  { id: 'g-tief', name: 'Die tiefen Saiten', short: 'Tiefe Saiten', clef: 'treble', theme: 'tiefe', need: 6 },
  { id: 'g-alle', name: 'Die Sechs-Saiten-Brücke', short: 'Alle Saiten', clef: 'treble', theme: 'abend', need: 6, mix: true },
];
export let WORLDS = PIANO_WORLDS;
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

const PIANO_LEVELS = [
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
// ---------- Gitarre ----------
const GS1 = ['e2', 'f2', 'g2'], GS2 = ['h1', 'c2', 'd2'], GH = [...GS1, ...GS2], GS3 = ['g1', 'a1'], GS4 = ['d1', 'e1', 'f1'], GM = [...GS3, ...GS4], GS5 = ['a', 'h', 'c1'], GS6 = ['e', 'f', 'g'], GT = [...GS5, ...GS6], GALL = [...GH, ...GM, ...GT];
const G_HAENSCHEN = HAENSCHEN, G_FREUDE = 'e2 e2 f2 g2 g2 f2 e2 d2 c2 c2 d2 e2 e2 d2 d2 e2 e2 f2 g2 g2 f2 e2 d2 c2 c2 d2 e2 d2 c2 c2'.split(' ');
const G_LAMM = 'h1 a1 g1 a1 h1 h1 h1 a1 a1 a1 h1 d2 d2 h1 a1 g1 a1 h1 h1 h1 h1 a1 a1 h1 a1 g1'.split(' ');
const G_JAKOB = 'g1 a1 h1 g1 g1 a1 h1 g1 h1 c2 d2 h1 c2 d2 d2 e2 d2 c2 h1 g1 d2 e2 d2 c2 h1 g1 g1 d1 g1 g1 d1 g1'.split(' ');
const G_ENTCHEN = ENTCHEN, G_TIEF = 'e g a a c1 h a g e f g a h c1 a e'.split(' ');
const G_JAKOB_TIEF = 'c1 d1 e1 c1 c1 d1 e1 c1 e1 f1 g1 e1 f1 g1 g1 a1 g1 f1 e1 c1 g1 a1 g1 f1 e1 c1 c1 g c1 c1 g c1'.split(' ');
const G_LEITER = 'e f g a h c1 d1 e1 f1 g1 a1 h1 c2 d2 e2 f2 g2 f2 e2 d2 c2 h1 a1 g1 f1 e1 d1 c1 h a g f e'.split(' ');
const GUITAR_LEVELS = [
  L('ga1', 0, 'jump', 'Die hohe e-Saite', ['e2', 'f2'], ['e2', 'f2'], { len: 8 }),
  L('ga2', 0, 'jump', 'Das hohe g', GS1, ['g2']),
  L('ga3', 0, 'regen', 'Erster Notenregen', GS1),
  L('ga4', 0, 'jump', 'Die h-Saite', ['h1', 'c2', 'e2', 'g2'], ['h1', 'c2']),
  L('ga5', 0, 'bau', 'Baue die Brücke', ['e2', 'f2', 'g2', 'h1', 'c2'], [], { words: ['FEE', 'CHEF'] }),
  L('ga6', 0, 'jump', 'Das hohe d', GH, ['d2']),
  L('ga7', 0, 'regen', 'Wolkenbruch', GH),
  L('ga8', 0, 'boss', 'Hänschen klein', [...new Set(G_HAENSCHEN)], [], { melody: G_HAENSCHEN }),
  L('ga9', 0, 'jump', 'Zwei Saiten im Wechsel', GH, [], { len: 12 }),
  L('ga10', 0, 'boss', 'Freude schöner Götterfunken', [...new Set(G_FREUDE)], [], { melody: G_FREUDE }),

  L('gb1', 1, 'jump', 'Die g-Saite', ['g1', 'a1', 'h1'], ['g1', 'a1'], { len: 8 }),
  L('gb2', 1, 'regen', 'Zauberregen', ['g1', 'a1', 'h1', 'c2', 'd2']),
  L('gb3', 1, 'boss', 'Mary hatte ein kleines Lamm', [...new Set(G_LAMM)], [], { melody: G_LAMM }),
  L('gb4', 1, 'jump', 'Die d-Saite', ['d1', 'e1', 'g1', 'a1'], ['d1', 'e1']),
  L('gb5', 1, 'jump', 'Das mittlere f', GM, ['f1']),
  L('gb6', 1, 'bau', 'Wörter aus Noten', GM, [], { words: ['FADE', 'ADE', 'GAGE'] }),
  L('gb7', 1, 'regen', 'Sturm der Noten', [...GM, ...GS2]),
  L('gb8', 1, 'boss', 'Bruder Jakob', [...new Set(G_JAKOB)], [], { melody: G_JAKOB }),
  L('gb9', 1, 'jump', 'Vier Saiten', [...GH, ...GM], [], { len: 12 }),

  L('gc1', 2, 'jump', 'Die A-Saite', ['a', 'h', 'd1'], ['a', 'h'], { len: 8 }),
  L('gc2', 2, 'jump', 'Das tiefe c', ['a', 'h', 'c1', 'd1', 'e1'], ['c1']),
  L('gc3', 2, 'regen', 'Blubberblasen', ['a', 'h', 'c1', 'd1', 'e1']),
  L('gc4', 2, 'boss', 'Alle meine Entchen', [...new Set(G_ENTCHEN)], [], { melody: G_ENTCHEN }),
  L('gc5', 2, 'jump', 'Die tiefe E-Saite', ['e', 'f', 'a', 'h'], ['e', 'f']),
  L('gc6', 2, 'jump', 'Das tiefe g', GT, ['g']),
  L('gc7', 2, 'bau', 'Tiefbau', GT, [], { words: ['ACH', 'FACH', 'AFFE', 'CAFE'] }),
  L('gc8', 2, 'regen', 'Tiefenrausch', GT),
  L('gc9', 2, 'boss', 'Lied der tiefen Saiten', [...new Set(G_TIEF)], [], { melody: G_TIEF }),

  L('gd1', 3, 'jump', 'Kreuz und quer über alle Saiten', GALL, [], { len: 12 }),
  L('gd2', 3, 'regen', 'Der große Notenregen', GALL),
  L('gd3', 3, 'bau', 'Schreiben von tief bis hoch', GALL, [], { words: ['HEFE', 'DACH', 'CHEF'] }),
  L('gd4', 3, 'boss', 'Bruder Jakob auf den tiefen Saiten', [...new Set(G_JAKOB_TIEF)], [], { melody: G_JAKOB_TIEF }),
  L('gd5', 3, 'boss', 'Die große Tonleiter', [...new Set(G_LEITER)], [], { melody: G_LEITER }),
];
const PIANO_PLACEMENT = [
  { name: 'Violinschlüssel: c¹ bis g¹', clef: 'treble', notes: T1, skip: [6, 0, 0, 0] },
  { name: 'Violinschlüssel: bis d²', clef: 'treble', notes: ['a1', 'h1', 'c2', 'd2', 'g1', 'f1'], skip: [11, 0, 0, 0] },
  { name: 'Violinschlüssel: bis a²', clef: 'treble', notes: ['e2', 'f2', 'g2', 'a2', 'd2', 'h1'], skip: [15, 1, 0, 0] },
  { name: 'Bassschlüssel: kleines c bis c¹', clef: 'bass', notes: B3, skip: [15, 9, 0, 0] },
  { name: 'Bassschlüssel: bis zum großen C', clef: 'bass', notes: ['G', 'A', 'H', 'C', 'D', 'E', 'F'], skip: [15, 13, 1, 1] },
  { name: 'Vorzeichen', clef: 'treble', notes: ['fis1', 'b1', 'cis2', 'es2', 'gis1', 'as1', 'des2'], skip: [15, 13, 7, 1], acc: true },
];
const GUITAR_PLACEMENT = [
  { name: 'Hohe e-Saite: e, f und g', clef: 'treble', notes: GS1, skip: [4, 0, 0, 0] },
  { name: 'Hohe Saiten: e-Saite und h-Saite', clef: 'treble', notes: GH, skip: [10, 1, 0, 0] },
  { name: 'Mittlere Saiten: g-Saite und d-Saite', clef: 'treble', notes: GM, skip: [10, 9, 1, 0] },
  { name: 'Tiefe Saiten: A-Saite und E-Saite', clef: 'treble', notes: GT, skip: [10, 9, 9, 1] },
];
function prepare(worlds, levels, dedupe = false) {
  levels.forEach(l => { l.clef = worlds[l.world].clef; l.theme = worlds[l.world].theme; [...l.notes, ...(l.melody || [])].forEach(N); });
  const earlier = new Set();
  const all = worlds.map((w, wi) => { const seen = []; levels.filter(l => l.world === wi).forEach(l => l.notes.forEach(k => { if (!seen.includes(k) && !((w.mix || dedupe) && earlier.has(k))) seen.push(k); })); seen.forEach(k => earlier.add(k)); return seen; });
  return { worlds, levels, all };
}
/** Beide Level-Sätze. Das Spiel arbeitet immer mit dem Satz des aktuellen Profils (siehe setLevelSet). */
export const SETS = { klavier: { ...prepare(PIANO_WORLDS, PIANO_LEVELS), placement: PIANO_PLACEMENT, skipKey: 'skip', free: 5 }, gitarre: { ...prepare(GUITAR_WORLDS, GUITAR_LEVELS, true), placement: GUITAR_PLACEMENT, skipKey: 'skipG', free: 5 } };
export const ALL_LEVELS = [...PIANO_LEVELS, ...GUITAR_LEVELS];
export let LEVELS = PIANO_LEVELS, ALL_NOTES = SETS.klavier.all, PLACEMENT = PIANO_PLACEMENT, SKIP_KEY = 'skip', LEVEL_SET = 'klavier';
export function setLevelSet(id) { const s = SETS[id] || SETS.klavier; LEVEL_SET = SETS[id] ? id : 'klavier'; WORLDS = s.worlds; LEVELS = s.levels; ALL_NOTES = s.all; PLACEMENT = s.placement; SKIP_KEY = s.skipKey; }
/** Freigeschaltete Level je Welt aus der Einstufung (für jedes Instrument getrennt). */
export function skipOf(profile) { return profile[SKIP_KEY] || []; }
export function creatureTotal() { return new Set(ALL_NOTES.flat()).size; }
export function levelsOf(world) { return LEVELS.filter(l => l.world === world); }
export function doneCount(profile, world) { return levelsOf(world).filter(l => profile.levels[l.id]).length; }
export function worldUnlocked(profile, world) { return world === 0 || profile.unlockAll || skipOf(profile)[world] > 0 || doneCount(profile, prevWorld(world)) >= WORLDS[world].need; }
export function levelUnlocked(profile, level) {
  if (profile.unlockAll) return true; if (!worldUnlocked(profile, level.world)) return false;
  const ls = levelsOf(level.world), i = ls.indexOf(level); return i === 0 || i < (skipOf(profile)[level.world] || 0) || !!profile.levels[ls[i - 1].id];
}
export function nextLevel(level) { const i = LEVELS.indexOf(level); return LEVELS[i + 1] || null; }
export function starsFor(ratio) { return ratio >= 0.85 ? 3 : ratio >= 0.65 ? 2 : 1; }
/** Sterne aus Leveln plus Sterne aus dem Training. */
export function totalStars(profile) { return Object.values(profile.levels).reduce((a, l) => a + (l.stars || 0), 0) + Object.values(profile.train || {}).reduce((a, t) => a + (t.stars || 0), 0); }

/** Einstufung: Wer eine Stufe besteht, darf entsprechend weit vorne einsteigen. skip = freigeschaltete Level je Welt (Tabellen oben). */
export const PLACEMENT_Q = 5, PLACEMENT_PASS = 4;
