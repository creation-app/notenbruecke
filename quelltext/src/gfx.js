// Pixelgrafik: alles wird programmatisch auf ein festes Raster gezeichnet (keine Bilddateien).
import { GLYPHS } from './glyphs.js';
import { staffLines } from './music.js';

export const C = { K: '#26364B', SKY: '#75CCF5', B1: '#2998E8', B2: '#174B83', G1: '#78B833', G2: '#467C35', GL: '#A5D84F',
  OR: '#FF9D35', YE: '#FFD966', CREAM: '#FFF1D6', RED: '#EF5350', W: '#FFFFFF' };
/** Sichtbreite der Welt in Weltpixeln: 320 bei 16:10, breiter auf breiten Bildschirmen (Handy quer), damit nie schwarze Ränder bleiben. */
export let VIEW_W = 320;
export function setViewW(w) { VIEW_W = w; }
export const VIEW_H = 150, STAFF_BOTTOM = 100, STEP_PX = 5;
/** Auf Viertel-Weltpixel runden = ganze Bildschirmpixel: flüssige Bewegung ohne unscharfe Kanten. */
export const q = v => Math.round(v * 4) / 4;
export function yOfPos(pos) { return STAFF_BOTTOM - pos * STEP_PX; }

export function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function px(ctx, x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
export function fromMap(rows, pal, ctx, ox = 0, oy = 0) {
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const col = pal[row[i]]; if (col) px(ctx, ox + i, oy + j, col); } });
}

// ---------- Spielfigur ----------
const HEAD = ['......KKKKKK....', '....KKOOOOOOKK..', '...KOOOOOOOOOOK.', '..KOOSSSSSSSSOK.', '..KOSSSSSSSSSSK.', '..KSSSWKSSSWKSK.',
  '..KSSSKKSSSKKSK.', '..KSSSKKSSSKKSK.', '..KSsSSSSSSSSsK.', '...KSSSSKKSSSSK.', '....KKSSSSSSKK..'];
const BODY = ['.KKKRRKKKKKKK...', 'KRRRRKBBBBBBK...', 'KRRRRKBBYYBBKK..', 'KRRRrKBBYBBBSK..', '.KRRrKBBYBBBKK..', '.KRrrKBYYBBBK...', '..KrrKBBBBBBK...'];
const BODY_FLY = ['KKKKRRKKKKKKK...', 'RRRRRKBBBBBBK...', 'KRRRRKBBYYBBKK..', '.KKRrKBBYBBBSK..', '...KKKBBYBBBKK..', '.....KBYYBBBK...', '.....KBBBBBBK...'];
const LEGS = { run1: ['..KKKKbKKKKbK...', '....KbbK...KbbK.', '....KKKK...KKKK.'], run2: ['..KKKKbKKKKbK...', '......KbbKbbK...', '......KKKKKKK...'], stand: ['..KKKKbKKKKbK...', '.....KbbK.KbbK..', '.....KKKK.KKKK..'], tuck: ['.....KbKKKKbK...', '....KbbK.KbbK...', '....KKK..KKK....'] };
const EYES = { up: ['KK', 'KK', 'SS'], down: ['SS', 'KK', 'KK'], open: ['WK', 'KK', 'KK'], closed: ['SS', 'KK', 'SS'], happy: ['KK', 'SS', 'SS'], side: ['KW', 'KK', 'KK'] };
export const HEROES = [
  { name: 'Rot', R: '#EF5350', r: '#B83A3A', O: '#FF9D35', B: '#2998E8', b: '#174B83' },
  { name: 'Grün', R: '#78B833', r: '#467C35', O: '#6B4A2B', B: '#FFD966', b: '#8A5A2B' },
  { name: 'Lila', R: '#9B6BD6', r: '#6B3FA0', O: '#26364B', B: '#FF9D35', b: '#7A3E1A' },
  { name: 'Blau', R: '#2998E8', r: '#174B83', O: '#FFD966', B: '#EF5350', b: '#8E2A2A' },
  { name: 'Gold', R: '#FFD966', r: '#D9A441', O: '#B83A3A', B: '#467C35', b: '#26364B' },
  { name: 'Türkis', R: '#3FC9B8', r: '#1F7F78', O: '#FFF1D6', B: '#9B6BD6', b: '#4A2A70' },
];
export const HERO_W = 18, HERO_H = 24;
// ---------- Hüte: mit Sternen freigeschaltet. Die Zeilen liegen über dem Kopf (2 Zeilen darüber, 3 über dem Haar). ----------
export const HATS = [
  { name: 'Ohne Hut', stars: 0, rows: [] },
  { name: 'Stirnband', stars: 5, rows: ['', '', '', '', '..KEEEEEEEEEEEKE'] },
  { name: 'Mütze', stars: 15, rows: ['.......WW.......', '.....KKWWKK.....', '....KEEEEEEEK...', '...KEEEEEEEEEEK.', '..KWWWWWWWWWWWK.'] },
  { name: 'Zauberhut', stars: 30, rows: ['.......KPK......', '......KPPPK.....', '.....KPPYPPK....', '....KPPPPPPPPK..', '.KKPPPPPPPPPPPKK'] },
  { name: 'Krone', stars: 50, rows: ['...Y...YY...Y...', '...YY.YYYY.YY...', '...YYYYYYYYYY...', '..KYEYYBBYYEYK..', '..KKKKKKKKKKKK..'] },
];
const HAT_PAL = { K: C.K, W: '#FFFFFF', Y: C.YE, E: '#EF5350', P: '#9B6BD6', B: '#2998E8' };
/** Der Hut, den das Profil wirklich tragen darf (0, wenn die Sterne nicht reichen). */
export function hatOf(profile, stars) { const h = profile && profile.hat | 0; return HATS[h] && stars >= HATS[h].stars ? h : 0; }
function heroFrame(look, o, hat = 0) {
  const c = cv(HERO_W, HERO_H), x = c.getContext('2d');
  const pal = { K: C.K, O: look.O, S: '#FFE1C4', s: '#F2B8A0', W: '#FFFFFF', R: look.R, r: look.r, B: look.B, b: look.b, Y: C.YE };
  const head = HEAD.map(r => r.split('')); const e = EYES[o.eyes || 'open'];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) { head[5 + j][6 + i] = e[j][i]; head[5 + j][11 + i] = e[j][i]; }
  const by = 2 + (o.lift || 0);
  fromMap(LEGS[o.legs || 'stand'], pal, x, 1, by + 18);
  fromMap(o.fly ? BODY_FLY : BODY, pal, x, 1, by + 11);
  fromMap(head.map(r => r.join('')), pal, x, 1 + (o.hx || 0), by + (o.hy || 0));
  if (hat) fromMap(HATS[hat].rows, HAT_PAL, x, 1 + (o.hx || 0), by + (o.hy || 0) - 2);
  const arm = (cOut, cIn) => { px(x, cIn, by + 5, C.K); px(x, cOut, by + 5, C.K); for (let y = by + 6; y <= by + 12; y++) { px(x, cIn, y, y < by + 8 ? pal.S : look.B); px(x, cOut, y, C.K); } };
  if (o.arms === 'both' || o.arms === 'right') arm(17, 16); if (o.arms === 'both') arm(0, 1);
  return c;
}
export function makeHero(i, hat = 0) {
  const L = HEROES[i % HEROES.length];
  return { idle0: heroFrame(L, {}, hat), idle1: heroFrame(L, { hy: 1 }, hat), blink: heroFrame(L, { eyes: 'closed' }, hat), lookUp: heroFrame(L, { eyes: 'up', hy: -1 }, hat), lookDown: heroFrame(L, { eyes: 'down', hy: 1 }, hat),
    listen: heroFrame(L, { hx: 1, hy: 1, eyes: 'side', arms: 'right' }, hat), jump: heroFrame(L, { legs: 'tuck', fly: true, hy: -1, eyes: 'happy', lift: -1, arms: 'both' }, hat),
    cheer0: heroFrame(L, { eyes: 'happy', arms: 'both' }, hat), cheer1: heroFrame(L, { eyes: 'happy', hy: -1, fly: true, arms: 'both', lift: -1, legs: 'tuck' }, hat), oops: heroFrame(L, { eyes: 'closed', hx: -1, hy: 1 }, hat),
    run0: heroFrame(L, { legs: 'run1', eyes: 'side' }, hat), run1: heroFrame(L, { legs: 'run2', eyes: 'side', hy: 1, fly: true }, hat), wave0: heroFrame(L, { arms: 'right', eyes: 'happy' }, hat), wave1: heroFrame(L, { eyes: 'happy', hy: 1 }, hat) };
}

// ---------- Notenwesen ----------
/** Begleiter in drei Stufen: 0 klein, 1 mit Flügeln, 2 mit Flügeln und Krone. Er wächst, je sicherer seine Note sitzt. */
export function buddyStage(stat) { const b = stat ? stat.box | 0 : 0; return b >= 3 ? 2 : b === 2 ? 1 : 0; }
export const BUDDY_STAGE = ['klein', 'mit Flügeln', 'mit Flügeln und Krone'];
export function makeBuddy(letter, alt, stage) {
  const c = cv(22, 22), x = c.getContext('2d'), cr = makeCreature(letter, alt); x.imageSmoothingEnabled = false;
  if (stage === 0) { x.drawImage(cr, 5, 10, 12, 12); return c; }
  for (const [wx, d] of [[2, -1], [19, 1]]) { for (let k = 0; k < 3; k++) { px(x, wx + d * 0, 12 + k, '#FFFFFF'); px(x, wx + d, 11 + k, '#FFFFFF'); } px(x, wx + d * 2, 11, '#DDEBF7'); px(x, wx, 15, '#DDEBF7'); }
  x.drawImage(cr, 3, 6);
  if (stage === 2) { for (let i = 8; i <= 13; i++) { px(x, i, 5, C.YE); px(x, i, 4, C.YE); } for (const i of [8, 10, 11, 13]) px(x, i, 3, C.YE); px(x, 9, 5, '#EF5350'); px(x, 12, 5, '#2998E8'); }
  return c;
}
const CREATURE_COL = [['#FFD966', '#D9A441'], ['#F07FA0', '#B84A72'], ['#B58BE8', '#7A52B8'], ['#4FD1C5', '#2C8F88'], ['#8CCB3F', '#4E8A2E'], ['#FF9D35', '#C46A14'], ['#5AAEF2', '#2A6DB8']];
export function makeCreature(letter, alt = 0, locked = false) {
  const W = 16, H = 16, g = Array.from({ length: H }, () => Array(W).fill(null));
  const [base, shade] = locked ? ['#5A6C84', '#46566E'] : CREATURE_COL[letter];
  const rx = [5, 5.6, 4.6, 5.2, 6, 5, 5.4][letter], ry = [4.6, 4.2, 5, 4.4, 4.8, 4.4, 4.6][letter], cx = 7.5, cy = 9.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d <= 1) g[y][x] = (x - cx) * 0.6 + (y - cy) > 2.6 ? shade : base; }
  const top = Math.round(cy - ry), set = (x, y, c) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c; };
  const F = [() => { set(7, top - 1, base); set(7, top - 2, base); set(7, top - 3, C.RED); set(8, top - 3, C.RED); },
    () => { for (const s of [3, 12]) { set(s, top + 1, base); set(s, top, base); set(s + (s < 8 ? 1 : -1), top, base); set(s, top - 1, base); } },
    () => { set(7, top - 1, '#467C35'); set(8, top - 2, '#78B833'); set(9, top - 2, '#78B833'); set(9, top - 3, '#78B833'); set(6, top - 2, '#78B833'); },
    () => { for (const s of [4, 11]) { set(s, top, '#FFF1D6'); set(s, top - 1, '#FFF1D6'); set(s + (s < 8 ? -1 : 1), top - 2, '#FFF1D6'); } },
    () => { for (const s of [5, 7, 9, 10]) set(s, top - 1, base); set(6, top - 2, base); set(9, top - 2, base); },
    () => { for (const s of [4, 6, 8, 10]) { set(s, top - 1, shade); set(s + 1, top, shade); } },
    () => { set(7, top - 1, shade); set(8, top - 1, shade); set(8, top - 2, shade); set(9, top - 3, shade); set(9, top - 2, shade); }];
  F[letter]();
  if (!locked) {
    for (const ex of [5, 9]) { set(ex, 8, '#FFFFFF'); set(ex + 1, 8, '#FFFFFF'); set(ex, 9, '#FFFFFF'); set(ex + 1, 9, C.K); }
    set(7, 11, C.K); set(8, 11, C.K);
    if (alt > 0) { set(13, 2, C.YE); set(12, 3, C.YE); set(13, 3, '#FFFFFF'); set(14, 3, C.YE); set(13, 4, C.YE); }
    if (alt < 0) { set(2, 2, '#75CCF5'); set(2, 3, '#2998E8'); set(1, 3, '#75CCF5'); set(3, 3, '#2998E8'); set(2, 4, '#2998E8'); }
  }
  const c = cv(W, H), x = c.getContext('2d'); const out = locked ? '#3A4A62' : C.K;
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    if (g[y][xx]) px(x, xx, y, g[y][xx]);
    else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g[y + b] && g[y + b][xx + a])) px(x, xx, y, out);
  }
  return c;
}

// ---------- Notenschrift ----------
const HEAD_MAP = ['....XXXXX..', '..XXXXXXXX.', '.XXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXX.', '.XXXXXXXX..', '..XXXXX....'];
const hm = (i, j) => j >= 0 && j < 9 && i >= 0 && i < 11 && HEAD_MAP[j][i] === 'X';
/** Viertelnote; (x,y) = Mitte des Notenkopfs. style: 'gold' | 'ink' | 'ghost' | 'ok' */
export function drawNote(ctx, x, y, o = {}) {
  const st = o.style || 'ink', line = o.line || C.K;
  const b = o.beats || 1, hollow = b >= 2, dotted = Math.abs(b - 1.5) < 0.01 || Math.abs(b - 3) < 0.01, flag = b <= 0.5, noStem = b >= 4;
  const fill = st === 'gold' ? [C.YE, C.OR] : st === 'ok' ? [C.GL, C.G1] : st === 'ghost' ? [null, null] : [line, line];
  for (let j = 0; j < 9; j++) for (let i = 0; i < 11; i++) if (hm(i, j)) {
    const edge = !(hm(i - 1, j) && hm(i + 1, j) && hm(i, j - 1) && hm(i, j + 1));
    const col = edge ? line : hollow ? (st === 'gold' ? '#FFF1D6' : st === 'ok' ? '#E3F5C4' : null) : (i + j > 11 ? fill[1] : fill[0]); if (col) px(ctx, x - 5 + i, y - 4 + j, col);
  }
  if (st === 'gold') { px(ctx, x - 3, y - 2, '#FFF'); px(ctx, x - 2, y - 2, '#FFF'); px(ctx, x - 3, y - 1, '#FFF'); }
  if (o.stem !== false && !noStem) { ctx.fillStyle = line; const sl = o.stemLen || 27; if (o.up !== false) ctx.fillRect(x + 5, y - 1 - sl, 1, sl); else ctx.fillRect(x - 5, y + 2, 1, sl);
    if (flag) { if (o.up !== false) for (let k = 0; k < 6; k++) ctx.fillRect(x + 6 + Math.min(k, 3), y - 1 - sl + k * 2, k < 4 ? 2 : 1, 2); else for (let k = 0; k < 6; k++) ctx.fillRect(x - 4 + Math.min(k, 3), y + sl - k * 2, k < 4 ? 2 : 1, 2); } }
  if (dotted) { ctx.fillStyle = line; ctx.fillRect(x + 8, y - (Math.abs(y - STAFF_BOTTOM) % 10 === 0 ? 3 : 1), 2, 2); }
  if (o.alt) { if (o.halo) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) drawAccidental(ctx, x - 13 + dx, y + dy, o.alt, o.halo); drawAccidental(ctx, x - 13, y, o.alt, line); } // halo: heller Rand, damit das Vorzeichen auf jedem Hintergrund lesbar ist
}
const SHARP = ['..X..X.', '..X..XX', '..XXXX.', 'XXX..X.', '..X..X.', '..X..XX', '..XXXX.', 'XXX..X.', '..X..X.'];
const FLAT = ['X....', 'X....', 'X....', 'X....', 'X.XX.', 'XX..X', 'X...X', 'X..X.', 'XXX..'];
export function drawAccidental(ctx, x, y, alt, col) { fromMap(alt > 0 ? SHARP : FLAT, { X: col }, ctx, x - 3, alt > 0 ? y - 4 : y - 6); }
export function drawLedgers(ctx, x, w, positions, col) { ctx.fillStyle = col; for (const p of positions) ctx.fillRect(x, yOfPos(p), w, 1); }
export function drawStaff(ctx, col, x0 = 4, x1 = VIEW_W - 4, clef = 'treble') { ctx.fillStyle = col; for (const p of staffLines(clef)) ctx.fillRect(x0, yOfPos(p), x1 - x0, 1); }
export function drawClef(ctx, clef, x, col) {
  if (clef === 'grand') { fromMap(GLYPHS.treble.rows, { X: col }, ctx, x, STAFF_BOTTOM - 30 + GLYPHS.treble.dy); fromMap(GLYPHS.bass.rows, { X: col }, ctx, x, STAFF_BOTTOM + 30 + GLYPHS.bass.dy); return; }
  const g = GLYPHS[clef]; fromMap(g.rows, { X: col }, ctx, x, STAFF_BOTTOM + g.dy); }

let glowSprite = null;
export function drawGlow(ctx, x, y, alpha) {
  if (!glowSprite) { glowSprite = cv(36, 36); const g = glowSprite.getContext('2d');
    for (let j = 0; j < 36; j++) for (let i = 0; i < 36; i++) { const d = Math.hypot((i - 18) * 0.9, j - 18);
      if (d <= 9 || (d <= 12 && (i + j) % 2 === 0) || (d <= 15 && i % 2 === 0 && j % 2 === 0)) px(g, i, j, '#FFF6C2'); } }
  ctx.globalAlpha = alpha; ctx.drawImage(glowSprite, x - 18, y - 18); ctx.globalAlpha = 1;
}

// ---------- Plattformen ----------
export const THEMES = {
  himmel: { line: C.K, grass: ['#A5D84F', '#78B833', '#467C35'], soil: ['#C98A4B', '#A36A33'], bands: ['#4FB4EE', '#75CCF5', '#9BDCF8', '#C6ECFB'],
    far: ['#8FC9EF', '#76B4E4', '#F2FAFF'], cloud: ['#FFFFFF', '#DDF0FB'], hill: ['#B9DE7A', '#9CCB5A', '#A5D84F', '#78B833', '#467C35'] },
  tiefe: { line: '#FFF1D6', grass: ['#7BE0D6', '#3FB5AC', '#1F7F78'], soil: ['#6B7FA6', '#4A5C82'], bands: ['#1F6FA8', '#185A90', '#124474', '#0D3058'],
    far: ['#0F3B66', '#0B2E52', '#1A5C8C'], cloud: ['#8FE3F2', '#4FB4D8'], hill: ['#1B5A7A', '#164B68', '#3FB5AC', '#12405C', '#0C2C44'] },
  abend: { line: C.K, grass: ['#C7E36A', '#8FBF3F', '#557F2E'], soil: ['#C98A4B', '#A36A33'], bands: ['#F59A5A', '#FBB98A', '#FFDDB5', '#FFF1D6'],
    far: ['#C98BB0', '#A86F9C', '#FFE9D6'], cloud: ['#FFFFFF', '#FFD9C2'], hill: ['#C9DE8A', '#A9C768', '#B5D85F', '#7FAE45', '#4E7A35'] },
  zauber: { line: '#FFF1D6', grass: ['#FFB3D1', '#E86FA6', '#A8457A'], soil: ['#8A6BB8', '#5F4690'], bands: ['#2F2466', '#4B2F86', '#8A479C', '#E0738E'],
    far: ['#5B3A8C', '#48307A', '#FFD966'], cloud: ['#FFC2D6', '#D98FB8'], hill: ['#6B3FA0', '#5A3590', '#E86FA6', '#4A2A70', '#2E1B4F'] },
};
export function drawPlatform(ctx, x, y, w, style, theme) {
  const T = THEMES[theme], y0 = y - 4;
  if (style === 'dashed') {
    ctx.globalAlpha = 0.5; ctx.fillStyle = C.CREAM; ctx.fillRect(x + 1, y0 + 1, w - 2, 7); ctx.globalAlpha = 1; ctx.fillStyle = theme === 'himmel' ? C.K : C.CREAM;
    for (let i = 0; i < w; i++) if (i % 5 < 3) { ctx.fillRect(x + i, y0, 1, 1); ctx.fillRect(x + i, y0 + 8, 1, 1); }
    for (let j = 1; j < 8; j++) if (j % 4 < 3) { ctx.fillRect(x, y0 + j, 1, 1); ctx.fillRect(x + w - 1, y0 + j, 1, 1); }
    return;
  }
  if (style === 'ghost') ctx.globalAlpha = 0.4;
  ctx.fillStyle = C.K; ctx.fillRect(x + 1, y0, w - 2, 9); ctx.fillRect(x, y0 + 1, w, 7);
  ctx.fillStyle = T.grass[0]; ctx.fillRect(x + 1, y0 + 1, w - 2, 1); ctx.fillStyle = T.grass[1]; ctx.fillRect(x + 1, y0 + 2, w - 2, 2);
  ctx.fillStyle = T.grass[2]; for (let i = 1; i < w - 1; i++) if ((i >> 1) % 3) ctx.fillRect(x + i, y0 + 3, 1, 1);
  ctx.fillStyle = T.soil[0]; ctx.fillRect(x + 1, y0 + 4, w - 2, 4); ctx.fillStyle = T.soil[1]; ctx.fillRect(x + 1, y0 + 7, w - 2, 1);
  for (let i = 2; i < w - 2; i++) if ((i * 7 + 3) % 17 === 0) ctx.fillRect(x + i, y0 + 5, 1, 1);
  ctx.globalAlpha = 1;
}

// ---------- Hintergründe (kachelbar, 640 px breit) ----------
const TW = 640, per = (x, k, ph = 0) => Math.sin((x * k * 2 * Math.PI) / TW + ph);
function cloud(g, cx, cy, s, cols) {
  const blobs = [[-9, 2, 6], [-2, -2, 8], [7, 1, 6], [14, 3, 4], [-15, 4, 4]];
  for (let y = cy - 12; y < cy + 9; y++) for (let x = cx - 24; x < cx + 24; x++)
    if (y <= cy + 5 && blobs.some(([bx, by, r]) => Math.hypot(x - cx - bx * s, y - cy - by * s) <= r * s)) px(g, (x + TW) % TW, y, y >= cy + 3 ? cols[1] : cols[0]);
}
export function makeBackground(theme) {
  const T = THEMES[theme], H = VIEW_H, layers = [];
  const sky = cv(TW, H), s = sky.getContext('2d'); const ys = [0, 22, 60, 96];
  for (let y = 0; y < H; y++) { let c = T.bands[0], dither = null; ys.forEach((y0, i) => { if (y >= y0) c = T.bands[i]; if (y === y0 - 1 || y === y0 - 2) dither = T.bands[i]; });
    s.fillStyle = c; s.fillRect(0, y, TW, 1); if (dither) { s.fillStyle = dither; for (let x = (y % 2); x < TW; x += 2) s.fillRect(x, y, 1, 1); } }
  if (theme === 'himmel') for (let y = 14; y < 50; y++) for (let x = 180; x < 230; x++) { const d = Math.hypot(x - 205, y - 32); if (d <= 8) px(s, x, y, C.YE); else if (d <= 10 && (x + y) % 2 === 0) px(s, x, y, '#FFF3B0'); }
  if (theme === 'zauber') for (let i = 0; i < 70; i++) px(s, (i * 97) % TW, (i * 53) % 70, i % 5 ? '#FFF1D6' : C.YE);
  if (theme === 'tiefe') for (let i = 0; i < 9; i++) { s.globalAlpha = 0.12; s.fillStyle = '#BFF3FF'; const x0 = i * 71 + 10; for (let y = 0; y < 90; y++) s.fillRect(x0 + (y >> 2), y, 6 + (i % 3) * 3, 1); s.globalAlpha = 1; }
  layers.push({ c: sky, f: 0 });

  const far = cv(TW, H), f = far.getContext('2d'); const peaks = [[38, 58, .95], [98, 44, .8], [162, 60, .9], [228, 40, .85], [296, 54, .8], [362, 62, .9], [430, 46, .85], [498, 58, .95], [566, 42, .8], [620, 52, .9]];
  for (let x = 0; x < TW; x++) { let b = null, bv = -1e9; for (const p of peaks) for (const sh of [0, TW, -TW]) { const v = p[1] - Math.abs(x - p[0] - sh) * p[2]; if (v > bv) { bv = v; b = [p[0] + sh, p[1]]; } }
    const top = Math.round(128 - bv); for (let y = top; y < H; y++) { let c = x <= b[0] ? T.far[0] : T.far[1]; if (y - top < 6 - (x % 3) && bv > b[1] - 9) c = T.far[2]; px(f, x, y, c); } }
  if (theme === 'himmel') drawCastle(f, 420, 46);
  layers.push({ c: far, f: 0.12 });

  const cl = cv(TW, H), g = cl.getContext('2d');
  if (theme === 'tiefe') { for (let i = 0; i < 26; i++) { const x = (i * 131) % TW, y = 14 + (i * 47) % 110, r = 1 + (i % 3); g.fillStyle = T.cloud[i % 2]; g.fillRect(x, y - r, 1, 1); g.fillRect(x - r, y, 1, 1); g.fillRect(x + r, y, 1, 1); g.fillRect(x, y + r, 1, 1); if (r > 1) g.fillRect(x - 1, y - 1, 1, 1); } }
  else [[150, 34, 1], [330, 112, .8], [96, 116, .7], [30, 40, .6], [470, 30, .9], [560, 108, .7], [250, 20, .5]].forEach(([x, y, sc]) => cloud(g, x, y, sc, T.cloud));
  layers.push({ c: cl, f: 0.25, drift: 2.2 });

  const hl = cv(TW, H), h = hl.getContext('2d');
  for (let x = 0; x < TW; x++) { const t = Math.round(124 + 4 * per(x, 5) + 2 * per(x, 13, 1)); h.fillStyle = T.hill[1]; h.fillRect(x, t, 1, H - t); px(h, x, t, T.hill[0]); }
  layers.push({ c: hl, f: 0.45 });
  const nr = cv(TW, H), n = nr.getContext('2d');
  for (let x = 0; x < TW; x++) { const t = Math.round(136 + 3 * per(x, 6, 2) + 1.5 * per(x, 17));
    for (let y = t; y < H; y++) px(n, x, y, y === t ? T.hill[2] : (y > t + 7 && (y > t + 9 || (x + y) % 2 === 0)) ? T.hill[4] : T.hill[3]);
    if (x % 37 === 5) { const col = theme === 'himmel' ? [C.RED, '#FFFFFF', C.YE][x % 3] : theme === 'tiefe' ? ['#7BE0D6', '#F07FA0', '#FFD966'][x % 3] : ['#FFD966', '#FFB3D1', '#B58BE8'][x % 3];
      if (theme === 'himmel') { px(n, x, t - 1, C.G2); px(n, x, t - 2, C.G2); px(n, x - 1, t - 3, col); px(n, x + 1, t - 3, col); px(n, x, t - 4, col); px(n, x, t - 3, C.OR); }
      else { for (let k = 1; k <= 7; k++) px(n, x + (k > 4 ? 1 : 0), t - k, col); px(n, x - 1, t - 3, col); px(n, x + 2, t - 5, col); px(n, x + 1, t - 8, '#FFFFFF'); } } }
  layers.push({ c: nr, f: 0.7 });
  return layers;
}
function drawCastle(g, x, y) {
  const wall = '#F3E3C3', wsh = '#D8C39C', roof = '#E0605C', rsh = '#B84A4A', R = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(a, b, w, h); };
  const tower = (x0, w, top, rh) => { R(x0, top, w, y - top, wall); R(x0 + w - 2, top, 2, y - top, wsh); const cx = x0 + w / 2;
    for (let i = 0; i < rh; i++) { const half = Math.round(((i + 1) * (w / 2 + 2)) / rh); R(Math.round(cx - half), top - rh + i, half, 1, roof); R(Math.round(cx), top - rh + i, half, 1, rsh); } R(Math.floor(cx), top + 3, 1, 2, C.K); };
  R(x + 10, y - 10, 29, 10, wall); for (let i = 0; i < 29; i += 4) R(x + 10 + i, y - 12, 2, 2, wall);
  tower(x + 6, 7, y - 14, 6); tower(x + 36, 7, y - 14, 6); tower(x + 19, 11, y - 20, 7); R(x + 23, y - 6, 3, 6, C.K); R(x + 24, y - 31, 1, 5, C.K); R(x + 25, y - 31, 4, 3, C.OR);
  for (let i = 0; i < 13; i++) { const ins = Math.round(i * 1.9) + (i % 2); for (let xx = x + ins; xx <= x + 48 - ins; xx++) px(g, xx, y + i, i === 0 ? C.GL : i === 1 ? C.G1 : xx < x + 27 ? '#B5763A' : '#8A5528'); }
}
export function drawBackground(ctx, layers, camX, t) {
  for (const L of layers) { const off = (((camX * L.f + (L.drift || 0) * t) % TW) + TW) % TW; const o = q(off); ctx.drawImage(L.c, -o, 0); if (o > TW - VIEW_W) ctx.drawImage(L.c, TW - o, 0); }
}

// ---------- Partikel ----------
const q4 = v => Math.round(v * 4) / 4;
export class Particles {
  constructor() { this.p = []; }
  burst(x, y, cols, n = 14) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 50; this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: 0.5 + Math.random() * 0.4, c: cols[i % cols.length] }); } }
  update(dt) { for (const q of this.p) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 160 * dt; } this.p = this.p.filter(q => q.t < q.life); }
  draw(ctx, camX = 0) { for (const q of this.p) px(ctx, q4(q.x - camX), q4(q.y), q.c); }
}

// ---------- Tiere ----------
// Pegasus: Belohnung für die zweite Welt. 24 × 20 Pixel, zwei Bilder für den Flügelschlag.
const PEG_PAL = { K: C.K, W: '#FFFFFF', S: '#D3E2F4', F: '#A9CBEE', M: '#FFC83D', m: '#E8951C', H: '#7A5230' };
const PEG_BODY = ["........................", "........................", "..................K.K...", ".................KWKWK..", "................KMWWWWK.", "...............KMMWWKWWK", "..............KMmWWWWWWK", ".KK...........KMMWWWKKK.", "KMMK.........KMmWWWK....", "KMmMKKKKKKKKKKMWWWWK....", "KMmMKWWWWWWWWWWWWWWK....", ".KMMKWWWWWWWWWWWWWSK....", ".KMmKWWWWWWWWWWWWSSK....", "..KMKSWWWWWWWWWWSSK.....", "..KKKKSSKKKKKKKSSKK.....", "....KWK.KSK...KWK.KSK...", "....KWK.KSK...KWK.KSK...", "...KWK.KSK.....KWK.KSK..", "...KHK.KHK.....KHK.KHK..", "...KKK.KKK.....KKK.KKK.."];
const PEG_WINGS = [[[5, 1, "...KK...."], [5, 2, "..KWWK..."], [5, 3, ".KWWFK..."], [5, 4, ".KWWWFK.."], [5, 5, "KWWWFFK.."], [5, 6, "KWWWWFK.."], [5, 7, ".KWWWFFK."], [5, 8, ".KWWWWFK."], [5, 9, "..KKWWWK."], [5, 10, "....KKK.."]], [[1, 4, "...KKKK......"], [1, 5, "..KWWWWKK...."], [1, 6, ".KFWWWWWWKK.."], [1, 7, "..KFFWWWWWWK."], [1, 8, "...KKFFWWWWK."], [1, 9, ".....KKKWWWK."], [1, 10, "........KKK.."]]];
/** Zwei Bilder (Flügel oben, Flügel hinten). locked: nur der Umriss – für die Sammlung, solange er noch nicht frei ist. */
export function makePegasus(locked = false) {
  return PEG_WINGS.map(wing => { const c = cv(24, 20), x = c.getContext('2d'), put = (row, ox, oy) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') px(x, ox + i, oy, locked ? (row[i] === 'K' ? '#7C8AA0' : '#B4BFCE') : PEG_PAL[row[i]]); };
    PEG_BODY.forEach((r, y) => put(r, 0, y)); wing.forEach(([ox, oy, r]) => put(r, ox, oy)); return c; });
}

// Die wilden Tiere der letzten Welt: je 20 × 16 Pixel.
const WILD_PAL = { K: C.K,'W': '#FFFFFF', 'R': '#EF5350', 'r': '#B93A3A', 'O': '#FF9A3D', 'Y': '#FFD75E', 'G': '#78B833', 'g': '#467C35', 'B': '#2998E8', 'b': '#174B83', 'P': '#A56BE0', 'p': '#7443B5', 'M': '#F78FB3', 'T': '#3CC9B5', 't': '#1F8F86', 'N': '#A8744A', 'n': '#7A5230', 'C': '#FFF1D6', 'S': '#D3E2F4', 'L': '#A5D84F' };
const WILD_ART = {
  schnecke: ["....................", ".............K...K..", "............KWK.KWK.", "............KKK.KKK.", ".....KKKKK...K...K..", "...KKRRRRRKK.K...K..", "..KRRRRRRRRRKKK.KK..", "K.KBRRWWWRRRRKGGGGK.", "YKKBRRWKWRRRRKGGGGGK", "OYKBRRWWWRRRRKGKGGKK", "YKKBRRRRRRRRRKGGGGGK", "K.KBrrrrrrrrKGGGKKGK", "..KKKKKKKKKKGGGGGGK.", "..KgGGGGGGGGGGGGGK..", "...KKKKKKKKKKKKKK...", "...................."],
  krake: ["......KKKKKKKK......", "....KKPPPPPPPPKK....", "...KPPPPPPPPPPPPK...", "..KPPMPPPPPPPPMPPK..", "..KPWWWPPWWWPPWWWK..", "..KPWKWPPWKWPPWKWK..", "..KPWWWPPWWWPPWWWK..", "..KPPPPPPPPPPPPPPK..", "..KPPPPKPPPPKPPPPK..", "...KPPPPKKKKPPPPK...", "..KKpPPPPPPPPPPpKK..", ".KPKKpKKPKKPKKpKKPK.", "KPK.KPK.KPK.KPK.KPK.", "KPK.KPK.KPK.KPK.KPK.", ".KPK.KK.KPK.KK.KPK..", "..KK.....K.....KK..."],
  eule: ["...KK..........KK...", "..KNNK........KNNK..", "..KNNNKKKKKKKKNNNK..", "..KNNNNNNNNNNNNNNK..", ".KKKKKKKKKKKKKKKKKK.", ".KKKKWKKKKKKKKWKKKK.", ".KKKWKKKKKKKKWKKKKK.", "..KKKKKKNOONKKKKKK..", "..KNKKKKNOONKKKKNK..", ".KNNNNNNNOONNNNNNNK.", ".KNnNCCCCCCCCCCNnNK.", ".KNnNCCNCCCCNCCNnNK.", ".KNnNCCCCNNCCCCNnNK.", "..KNNCCNCCCCNCCNNK..", "...KKNCCCCCCCCNKK...", "....KOOKKKKKKOOK...."],
  drache: ["..........K...K.....", ".........KGK.KGK....", "....KK...KGGKGGK....", "...KTTK.KGGGGGGGK...", "..KTTTTKKGWKGGWKGK..", "..KTTtTTKGWKGGWKGK..", "...KTtTTKGGGGGGGGK..", "....KTTKKGGKGGKGGKOY", ".....KKGGGGGGGGGGKYO", "....KLGGGGGGKKKKKKOY", "...KLGGGCCCCGGK.....", "K..KLGGCCCCCCGGK....", "KGKKLGGCCCCCCGGK....", ".KGGGGGCCCCCCGGK....", "..KKKGGKKKKKGGGK....", "....KKK.....KKK....."],
  phoenix: [".........KK.........", "........KYYK........", "..K....KYOYK....K...", ".KRK...KOROK...KRK..", "KRORK.KKRRRRKK.KRORK", "KROORKRWKRRKWRKROORK", "KRYOORRWKRRKWRROOYRK", ".KRYOORRRYYRRROOYRK.", "..KRYOORROORROOYRK..", "...KRYORRYYRROYRK...", "....KKRRRRRRRRKK....", "......KRRrrRRK......", ".....KOKRRRRKOK.....", "....KYOK.KK.KOYK....", "...KYOK..KK..KOYK...", "...KKK...KK...KKK..."]
};
// Tiere aus Eiern (Belohnung der Tagesaufgabe): vom kleinen Küken bis zum riesigen Sternendrachen.
const EGG_PAL = { ...WILD_PAL, 'y': '#F2B531', 'S': '#D3E2F4', 'L': '#A5D84F', 'A': '#8FD3F4', 'a': '#5BA9D6', 'V': '#5B4BC4', 'v': '#3A2F8F', 'H': '#FFE9A6' };
const EGG_ART = {
  kueken: ["........KK....", ".......KyyK...", "......KYYYYK..", ".....KYYYYYYK.", "....KKYYYKYYOK", "...KYYYYYYYYOO", "..KYYYYYYYMYKK", ".KYYyyYYYYYK..", ".KYyyyyYYYYK..", ".KYyyyyYYYYK..", "..KYYYYYYYK...", "...KYYYYYK....", "....KOKKOK...."],
  schildi: ["..................", "..................", ".....KKKKKK.......", "....KggggggK......", "...KgGGGgGGgKKKK..", "..KgGgGGGGGGgLLLK.", ".KggGGGGGGgGLLLKLK", ".KggGGGgGGGGLLLLLK", "KLKLLLLLLLLLLLLKK.", ".KKLLLLLLLLLLKKK..", "..KLLgggggLLK.....", "...KKKKKKKKK......"],
  pinguin: ["..............", ".....KKKK.....", "....KbbbbK....", "...KbbWWbbK...", "...KbKWWKbK...", "..KbbWWWWbbK..", "..KbbWOOWbbK..", ".KKbWbObbWbKK.", "KbbbWWWWWWbbbK", ".KbbWWWWWWbbK.", ".KbbWWWWWWbbK.", ".KbbWWWWWWbbK.", "..KbWWWWWWbK..", "...KbWWWWbK...", "....KbWWbK....", "...KOOKKOOK..."],
  flatterdino: ["........KRKK..............", ".........KRRK.............", ".K........KRKKK.........K.", "KTKKK.....KTRTTK.....KKKTK", ".KTTTKKK.KTKTTKTK.KKKTTTK.", "..KtTTTTKKTTTTTTKKTTTTtK..", "...KtttTTTTTOOTTTTTtttK...", "....KtttttTTTTTTtttttK....", ".....KttttTTCCTTttttK.....", "......KttTTCCCCTTttK......", ".......KtTTCCCCTTtK.......", "........KTTCCCCTTK........", ".........KKTCCTKK.........", "...........KTTK...........", "..........KOKKOK..........", "...........K..K..........."],
  rex: ["..........................", "..........................", "................KKKKKK....", "...............KGGGGGGK...", "..............KGGGGGGGGK..", "..........K.KKGGGGGWKGGGK.", "........KKgKgKGGGGGGGGGgK.", ".......KgKKGKKGGGGGGGGGGK.", "......KKGGGGGGGGGGGGGGGK..", ".....KgGGGGGGGGGGGWGWGWK..", "....KKGGGGGGGGGGGKKKKKK...", "...KgGGGGLLLLLGGGGKK......", "...KGGGGLLLLLLGGGGGGK.....", "..KGGGGGLLLLLLLGGKKGGK....", "KKGGGGGGLLLLLLLGGK.KK.....", "GGGGGGGGLLLLLLLGK.........", "KKKKKKKKGGGLLGGGK.........", ".......KGGGGKGGGK.........", ".......KGGGKKGGGK.........", ".......KGGGKKGGGK.........", ".......KggggKggggK........", "........KKKK.KKKK........."],
  wolkenwal: ["....................KWK...........", "...................KWKWK..........", "...................KKWKK..........", ".K................KSKWKSK.........", "KAK...........KKKKKKKKKK..........", ".KAK.......KKKAAAAAAAAAKKK........", ".KAAK....KKAAAAAASSSSSSSAAKK......", "..KAAK..KAASSSSSASSSSSSSAAAAK.....", "..KAAAKKAAASSSSSAAASSSAAAAWAAK....", "...KAAAAAAAAAAAAAAAAAAAAAAKAAAK...", "...KAAAAAAaAAAAAAWWWWWAAAAAAAAK...", "...KAAAAAAAAAWWWWWWWWWWWWWAAAAAK..", "...KAAAAAAAWaWWWWWWWWWWWWWWWKAK...", "...KAAAAAaWWWWWWWWWWWWWKKKKKWAK...", "..KAAAKKAAWWWWWWWWWWWWWWWWWWWK....", "..KAKK..KAAWWWWWaWWWWWWWWWWWK.....", ".KAK.....KKAAWWWaaaaaWWWWWKK......", "KAK........KKKAaaaWWWWAKKK........", ".K...........KaaKKKKKKK...........", "............KaKK.................."],
  sternendrache: ["....K.....................KYK..KYK......", "...KVKK....................KYK.KYK......", "....KVVKK..................KYYKKYYK.....", ".....KVVVKK................KYYYVYYYK....", "......KPVVVKK..............KVVVVVVVVK...", ".......KPPVVVKKK..........KVVVVVVWKVVK..", "........KPPPVVVVKK........KVVVVVVVVVVK..", "........KYPPPPVVVVKK......KVVVVVVVVVVKOY", "..K..K...KKPPPPPVVYVKK....KVVVVVVVVVVKKO", ".KVKKPK.KK.KPPPYPPVVVVKKK.KVVVVVVVVVVVK.", "..K..KVKPPKKKPPPPPPPPVVVVKVVVKKVVKKKKK..", "......K.KVVPYPPPPPVVVVYKKVVVVK.KK.......", ".........KKKKVPVVVVVVVKKVVVVVK..........", "...........KKVVVVVVVVVVVVVVVK...........", "..........KVVVVVVVVVVVVVVVVVK...........", ".........KVVVVVVYVVVVVVVVVVVK...........", "........KVVVVVVVVVHVYVVVVVKVK...........", ".......KVVVVVVHHHHHHHHHVVVVK............", "......KVVVVVVHHHHHHHHHHYVVK.............", "K....KVVVVVVVHHHHHHHHHHHVVK.............", "YKKKKVVVVVVVVHHHHHHHHHHHVK..............", "KYYYVVVVVKKKKVVVHHHHHVVVK...............", "KYYVVVVKK...KVVVVVHVVVVVK...............", "KYKVVKK.....KVVVKKKKKVVVK...............", "KYKKK.......KVVVK...KVVVK...............", ".K..........KvvvvK..KvvvvK..............", ".............KKKK....KKKK...............", "........................................"]
};
/** Ein Ei. tier 0–6 (klein bis riesig), frac 0–1: wie weit es ausgebrütet ist (Risse). */
const EGG_W = [11, 12, 13, 15, 17, 19, 23], EGG_COL = [['#FFF1D6', '#E8C99A', '#C89B62'], ['#DDF2B5', '#A5D84F', '#467C35'], ['#E6F1FB', '#A9CBEE', '#174B83'], ['#C9F3EC', '#3CC9B5', '#1F8F86'], ['#DDEFB8', '#78B833', '#FFD75E'], ['#D9F0FC', '#8FD3F4', '#FFFFFF'], ['#C9C2F2', '#5B4BC4', '#FFD75E']];
export function makeEgg(tier = 0, frac = 0, locked = false) {
  tier = Math.max(0, Math.min(EGG_W.length - 1, tier | 0)); const w = EGG_W[tier], h = Math.round(w * 1.3), c = cv(w + 2, h + 2), x = c.getContext('2d'), [base, shade, spot] = EGG_COL[tier];
  const cx = (w + 1) / 2, cy = h * 0.56 + 1, ry = h * 0.56, inside = (ax, ay) => { const dy = (ay - cy) / (ay < cy ? ry : h + 1 - cy), rx = (w / 2) * (ay < cy ? 1 - 0.22 * (cy - ay) / ry : 1); return ((ax - cx) / rx) ** 2 + dy ** 2 <= 1; };
  let seed = 77 + tier * 13; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let ay = 0; ay < h + 2; ay++) for (let ax = 0; ax < w + 2; ax++) {
    if (inside(ax, ay)) px(x, ax, ay, locked ? '#B4BFCE' : (ax - cx) + (ay - cy) * 0.6 > w * 0.22 ? shade : base);
    else if (inside(ax - 1, ay) || inside(ax + 1, ay) || inside(ax, ay - 1) || inside(ax, ay + 1)) px(x, ax, ay, locked ? '#7C8AA0' : C.K);
  }
  if (!locked) {
    for (let i = 0; i < 3 + tier; i++) { const sx = Math.round(2 + rnd() * (w - 3)), sy = Math.round(3 + rnd() * (h - 5)); if (inside(sx, sy) && inside(sx + 1, sy) && inside(sx - 1, sy)) { px(x, sx, sy, spot); if (tier > 2) px(x, sx + 1, sy, spot); } }
    px(x, Math.round(cx - w * 0.2), Math.round(cy - ry * 0.55), '#FFFFFF');
    const cracks = frac >= 0.999 ? 3 : frac >= 0.6 ? 2 : frac >= 0.3 ? 1 : 0; // je weiter ausgebrütet, desto mehr Risse
    for (let k = 0; k < cracks; k++) { const y0 = Math.round(cy - ry * 0.25 + k * (h * 0.2)); for (let ax = 1; ax <= w; ax++) { if (k === 1 && ax > w * 0.6) break; if (k === 2 && ax < w * 0.45) continue; const zy = y0 + ((ax + k) % 4 < 2 ? 0 : 1); if (inside(ax, zy) && inside(ax - 1, zy) && inside(ax + 1, zy)) px(x, ax, zy, C.K); } }
  }
  return c;
}
/** Bilder eines Tiers (Pegasus: zwei für den Flügelschlag, sonst eins). locked: nur der Umriss. */
export function makePet(id, locked = false) {
  const rows = WILD_ART[id] || EGG_ART[id]; if (!rows) return makePegasus(locked);
  const c = cv(rows[0].length, rows.length), x = c.getContext('2d');
  rows.forEach((r, y) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') px(x, i, y, locked ? (r[i] === 'K' ? '#7C8AA0' : '#B4BFCE') : EGG_PAL[r[i]]); }); return [c];
}
