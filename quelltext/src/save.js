// Spielstand: lokale Profile, Fortschritt, Übungszeiten, Spielstand-Code.
const KEY = 'notenbruecke.v1';
let memory = null; // Ausweichspeicher, falls localStorage fehlt

export function newProfile(name, hero = 0, mode = 'abenteuer') {
  return { id: Math.random().toString(36).slice(2, 10), name: String(name).slice(0, 14), hero, mode, levels: {}, notes: {}, conf: {},
    creatures: [], days: {}, a4: 440, keys: false, unlockAll: false, regenBest: 0, seenIntro: false };
}
export function emptyState() { return { v: 1, profiles: [], current: null }; }

export function load(storage) {
  try {
    const raw = storage ? storage.getItem(KEY) : null;
    const s = raw ? JSON.parse(raw) : memory;
    if (s && s.v === 1 && Array.isArray(s.profiles)) return s;
  } catch (e) { /* defekter Speicher: neu anfangen */ }
  return memory || emptyState();
}
export function persist(storage, state) {
  memory = state;
  try { if (storage) { storage.setItem(KEY, JSON.stringify(state)); return true; } } catch (e) { /* voll oder gesperrt */ }
  return false;
}
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addPractice(profile, seconds, d = new Date()) {
  const k = dayKey(d); profile.days[k] = Math.round((profile.days[k] || 0) + seconds);
}
/** Übungstage in Folge bis heute (heute darf noch fehlen). */
export function streak(profile, today = new Date()) {
  let n = 0; const d = new Date(today);
  if (!profile.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (profile.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function checksum(str) { let a = 1, b = 0; for (let i = 0; i < str.length; i++) { a = (a + str.charCodeAt(i)) % 65521; b = (b + a) % 65521; } return ((b << 16 | a) >>> 0).toString(36); }
function toB64(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (const c of bytes) bin += String.fromCharCode(c); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromB64(b) { const bin = atob(b.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }

export function exportCode(profile) { const body = toB64(JSON.stringify(profile)); return `NB1.${body}.${checksum(body)}`; }
export function importCode(code) {
  const m = /^NB1\.([A-Za-z0-9_-]+)\.([a-z0-9]+)$/.exec(String(code).replace(/\s+/g, ''));
  if (!m || checksum(m[1]) !== m[2]) throw new Error('Der Code ist unvollständig oder falsch abgetippt.');
  let p; try { p = JSON.parse(fromB64(m[1])); } catch (e) { throw new Error('Der Code lässt sich nicht lesen.'); }
  if (!p || typeof p.name !== 'string' || typeof p.levels !== 'object') throw new Error('Der Code enthält keinen Spielstand.');
  return Object.assign(newProfile(p.name), p);
}

// ---- Kurzcode: 20 Zeichen zum Aufschreiben. Enthält Figur, Spielart, Sterne je Level und den Einstiegspunkt,
// aber nicht Namen, Übungstage und Noten-Statistik (dafür gibt es die vollständige Sicherung).
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function shortSum(body) { let s = 7; for (let i = 0; i < body.length; i++) s = (s * 31 + B32.indexOf(body[i]) * (i + 3)) % 1024; return B32[s >> 5] + B32[s & 31]; }
export function exportShort(profile, levelIds) {
  const bits = []; const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  push(1, 2); push(profile.hero & 7, 3); push(profile.mode === 'profi' ? 1 : 0, 1); push(profile.unlockAll ? 1 : 0, 1);
  for (const id of levelIds) push(Math.min(3, (profile.levels[id] || {}).stars || 0), 2);
  for (let w = 0; w < 3; w++) push(Math.min(15, (profile.skip || [])[w] || 0), 4);
  while (bits.length % 5) bits.push(0);
  let body = ''; for (let i = 0; i < bits.length; i += 5) body += B32[bits.slice(i, i + 5).reduce((a, b) => a * 2 + b, 0)];
  return (body + shortSum(body)).replace(/(.{5})(?=.)/g, '$1-');
}
export function importShort(code, levelIds) {
  const c = String(code).toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V').replace(/[^0-9A-Z]/g, '');
  const need = Math.ceil((7 + levelIds.length * 2 + 12) / 5) + 2;
  if (c.length !== need || [...c].some(ch => !B32.includes(ch))) throw new Error(`Der Kurzcode hat ${need} Zeichen. Bitte prüfe, ob etwas fehlt.`);
  const body = c.slice(0, -2); if (shortSum(body) !== c.slice(-2)) throw new Error('Der Kurzcode stimmt nicht. Bitte vergleiche ihn Zeichen für Zeichen.');
  const bits = []; for (const ch of body) { const v = B32.indexOf(ch); for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1); }
  let k = 0; const take = n => { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + bits[k++]; return v; };
  if (take(2) !== 1) throw new Error('Dieser Kurzcode gehört zu einer anderen Spielversion.');
  const p = newProfile('Spieler', take(3), take(1) ? 'profi' : 'abenteuer'); p.unlockAll = !!take(1);
  for (const id of levelIds) { const s = take(2); if (s) p.levels[id] = { stars: s }; }
  p.skip = [take(4), take(4), take(4)]; p.seenIntro = true; return p;
}
