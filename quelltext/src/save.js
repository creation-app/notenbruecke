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

// ---- Kurzcode: 12 Zeichen zum Aufschreiben. Merkt sich Figur, Spielart und wie weit man in jeder Welt ist.
// Alles andere (Name, einzelne Sterne, Übungstage, Noten-Statistik) steckt im Spielstand-Link bzw. QR-Code.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function shortSum(body) { let s = 7; for (let i = 0; i < body.length; i++) s = (s * 31 + B32.indexOf(body[i]) * (i + 3)) % 1024; return B32[s >> 5] + B32[s & 31]; }
/** worlds = Liste der Level-IDs je Welt (höchstens 4 Welten, je höchstens 15 Level). Beim Einlesen: entweder eine solche Liste (Klavier) oder { klavier: [...], gitarre: [...] }. */
export function exportShort(profile, worlds, instr = 'klavier') {
  const skip = (instr === 'gitarre' ? profile.skipG : profile.skip) || [];
  const bits = []; const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  push(2, 2); push(profile.hero & 7, 3); push(profile.mode === 'profi' ? 1 : 0, 1); push(profile.unlockAll ? 1 : 0, 1);
  for (let w = 0; w < 4; w++) { const done = (worlds[w] || []).filter(id => profile.levels[id]); const sum = done.reduce((a, id) => a + (profile.levels[id].stars || 1), 0);
    push(Math.min(15, done.length), 4); push(done.length ? Math.max(1, Math.min(3, Math.round(sum / done.length))) : 0, 2); push(Math.min(15, skip[w] || 0), 4); }
  push(instr === 'gitarre' ? 1 : 0, 1); // Bit 48: Instrument (alte Codes haben hier 0 = Klavier)
  while (bits.length % 5) bits.push(0);
  let body = ''; for (let i = 0; i < bits.length; i += 5) body += B32[bits.slice(i, i + 5).reduce((a, b) => a * 2 + b, 0)];
  return (body + shortSum(body)).replace(/(.{4})(?=.)/g, '$1-');
}
export function importShort(code, worlds) {
  const c = String(code).toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V').replace(/[^0-9A-Z]/g, '');
  if (c.length !== 12 || [...c].some(ch => !B32.includes(ch))) throw new Error('Der Kurzcode hat 12 Zeichen. Bitte prüfe, ob etwas fehlt.');
  const body = c.slice(0, -2); if (shortSum(body) !== c.slice(-2)) throw new Error('Der Kurzcode stimmt nicht. Bitte vergleiche ihn Zeichen für Zeichen.');
  const bits = []; for (const ch of body) { const v = B32.indexOf(ch); for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1); }
  let k = 0; const take = n => { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + bits[k++]; return v; };
  if (take(2) !== 2) throw new Error('Dieser Kurzcode gehört zu einer anderen Spielversion.');
  const p = newProfile('Spieler', take(3), take(1) ? 'profi' : 'abenteuer'); p.unlockAll = !!take(1); const guitar = bits[47] === 1 && !Array.isArray(worlds), skip = [];
  if (guitar) { p.instr = 'gitarre'; p.skipG = skip; } else p.skip = skip; if (!Array.isArray(worlds)) worlds = worlds[guitar ? 'gitarre' : 'klavier'];
  for (let w = 0; w < 4; w++) { const n = take(4), avg = take(2); skip.push(take(4)); (worlds[w] || []).slice(0, n).forEach(id => { p.levels[id] = { stars: avg || 1 }; }); }
  p.seenIntro = true; return p;
}

// ---- Spielstand-Link (für QR-Code oder zum Verschicken): enthält alles, wird zusammengepresst.
async function pipe(bytes, stream) { const w = stream.writable.getWriter(); w.write(bytes).catch(() => {}); w.close().catch(() => {}); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }
function b64(bytes) { let bin = ''; for (const c of bytes) bin += String.fromCharCode(c); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64(str) { const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(bin, c => c.charCodeAt(0)); }
export async function exportPayload(profile) {
  const days = Object.fromEntries(Object.entries(profile.days).sort().slice(-120)); const raw = new TextEncoder().encode(JSON.stringify({ ...profile, days }));
  if (typeof CompressionStream !== 'undefined') { try { return 'Z' + b64(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) { /* ohne Pressen weiter */ } }
  return 'J' + b64(raw);
}
export async function importPayload(payload) {
  const kind = payload[0]; let bytes;
  try { bytes = unb64(payload.slice(1)); if (kind === 'Z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw')); else if (kind !== 'J') throw new Error('x'); } catch (e) { throw new Error('Der Spielstand-Link ist unvollständig oder beschädigt.'); }
  let p; try { p = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error('Der Spielstand-Link lässt sich nicht lesen.'); }
  if (!p || typeof p.name !== 'string' || typeof p.levels !== 'object') throw new Error('Der Link enthält keinen Spielstand.');
  return Object.assign(newProfile(p.name), p);
}
