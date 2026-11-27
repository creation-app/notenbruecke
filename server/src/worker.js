// Server der Notenbrücke: Konten (Name oder E-Mail + Passwort), Spielstand, anonyme Nutzungszahlen, Lehrer-Übersicht.
// Läuft als Cloudflare Worker mit einer D1-Datenbank (SQLite). Keine Cookies: Anmeldung über ein Zugangs-Token.

const DAY = 86400000, SESSION_DAYS = 365, PBKDF2_ITER = 20000, MAX_STATE = 300000;
const NAME_RE = /^[A-Za-z0-9ÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß _.-]{1,18}[A-Za-z0-9ÄÖÜäöüß]$/, EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/, EV_RE = /^[a-z0-9][a-z0-9/_.+-]{0,63}$/;

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = n => b64(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(s) { return b64(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
async function pbkdf2(pw, salt, iter) { const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']); return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: iter }, k, 256)); }
export async function hashPw(pw) { const salt = rand(16); return `pbkdf2$${PBKDF2_ITER}$${salt}$${await pbkdf2(pw, salt, PBKDF2_ITER)}`; }
function same(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export async function checkPw(pw, stored) { const [, iter, salt, h] = String(stored).split('$'); return !!h && same(await pbkdf2(pw, salt, +iter), h); }
async function hmac(secret, msg) { const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64(await crypto.subtle.sign('HMAC', k, enc.encode(msg))); }

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Max-Age': '86400' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
const fail = (status, msg, extra = {}) => json({ error: msg, ...extra }, status);
const today = (t = Date.now()) => new Date(t + 3600000).toISOString().slice(0, 10); // deutsche Zeit (Winterzeit) reicht für Tageszählung

/** Kurzfassung eines Spielstands für die Lehrer-Übersicht. */
export function summarize(p, now = Date.now()) {
  p = p && typeof p === 'object' ? p : {}; const lv = p.levels || {}, days = p.days || {}, train = p.train || {};
  const lstars = Object.values(lv).reduce((a, l) => a + ((l && l.stars) || 0), 0), tstars = Object.values(train).reduce((a, t) => a + ((t && t.stars) || 0), 0);
  let week = 0; for (let i = 0; i < 7; i++) week += +days[today(now - i * DAY)] || 0;
  const dk = Object.keys(days).filter(k => days[k] >= 60).sort(), notes = Object.values(p.notes || {}), tbest = Math.max((train['play-treble-time'] || {}).best || 0, (train['play-gall-time'] || {}).best || 0);
  return { stars: lstars + tstars, levels: Object.keys(lv).filter(k => lv[k] && lv[k].stars > 0).length, creatures: (p.creatures || []).length, minutesTotal: Math.round(Object.values(days).reduce((a, s) => a + (+s || 0), 0) / 60),
    minutesWeek: Math.round(week / 60), lastDay: dk[dk.length - 1] || null, daysPlayed: dk.length, mode: p.mode || null, sure: notes.filter(n => n && n.box >= 3).length, seenNotes: notes.length,
    trainBest: tbest, instr: p.instr === 'gitarre' ? 'gitarre' : 'klavier', trainRuns: Object.values(train).reduce((a, t) => a + ((t && t.runs && t.runs.length) || 0), 0), stars3: Object.values(lv).filter(l => l && l.stars >= 3).length,
    levelStars: Object.fromEntries(Object.entries(lv).map(([k, l]) => [k, (l && l.stars) || 0])) };
}

async function body(req) { try { const t = await req.text(); if (t.length > MAX_STATE + 2000) return null; return JSON.parse(t || '{}'); } catch (e) { return null; } }
function cleanState(s) { if (!s || typeof s !== 'object' || Array.isArray(s)) return null; const t = JSON.stringify(s); return t.length > MAX_STATE ? null : t; }

async function session(env, req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') || ''); if (!m) return null;
  const row = await env.DB.prepare('SELECT s.user_id AS id, s.expires FROM sessions s WHERE s.token = ?').bind(await sha256(m[1])).first();
  return row && row.expires > Date.now() ? row.id : null;
}
async function newSession(env, userId) { const tok = rand(32); await env.DB.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)').bind(await sha256(tok), userId, Date.now() + SESSION_DAYS * DAY).run(); return tok; }
const pub = u => ({ name: u.name, email: u.email || null });

async function teacherOk(env, req) {
  const m = /^Bearer t\.(\d+)\.(.+)$/.exec(req.headers.get('Authorization') || ''); if (!m || !env.LEHRER_PASSWORT) return false;
  return +m[1] > Date.now() && same(await hmac(env.LEHRER_PASSWORT + '|lehrer', m[1]), m[2]);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, ''), now = Date.now(), DB = env.DB;
    try {
      if (path === '' || path === '/api' || path === '/api/health') return json({ ok: true, name: 'Notenbrücke', time: now });

      // ---------- Konto anlegen: Name + Passwort, E-Mail freiwillig. Der bisherige Spielstand wird mitgeschickt. ----------
      if (path === '/api/register' && req.method === 'POST') {
        const b = await body(req); if (!b) return fail(400, 'Ungültige Anfrage.');
        const name = String(b.name || '').trim().replace(/\s+/g, ' '), email = String(b.email || '').trim() || null, pw = String(b.password || ''), st = cleanState(b.state || {});
        if (!NAME_RE.test(name)) return fail(400, 'Der Benutzername braucht 3 bis 20 Zeichen: Buchstaben, Zahlen, Leerzeichen, Punkt, Strich.', { field: 'name' });
        if (email && !EMAIL_RE.test(email)) return fail(400, 'Diese E-Mail-Adresse sieht nicht richtig aus.', { field: 'email' });
        if (pw.length < 6 || pw.length > 100) return fail(400, 'Das Passwort braucht mindestens 6 Zeichen.', { field: 'password' });
        if (!st) return fail(400, 'Der Spielstand ist zu groß oder kaputt.');
        if (await DB.prepare('SELECT 1 FROM users WHERE name = ?').bind(name).first()) return fail(409, 'Diesen Benutzernamen gibt es schon. Bitte wähle einen anderen.', { field: 'name' });
        if (email && await DB.prepare('SELECT 1 FROM users WHERE email = ? OR name = ?').bind(email, email).first()) return fail(409, 'Mit dieser E-Mail gibt es schon ein Konto.', { field: 'email' });
        const r = await DB.prepare('INSERT INTO users (name, email, pw, state, rev, summary, created, seen) VALUES (?, ?, ?, ?, 1, ?, ?, ?)').bind(name, email, await hashPw(pw), st, JSON.stringify(summarize(JSON.parse(st), now)), now, now).run();
        const id = r.meta.last_row_id; return json({ token: await newSession(env, id), user: { name, email }, rev: 1 });
      }

      // ---------- Anmelden mit Benutzername oder E-Mail ----------
      if (path === '/api/login' && req.method === 'POST') {
        const b = await body(req); if (!b) return fail(400, 'Ungültige Anfrage.'); const login = String(b.login || '').trim(), pw = String(b.password || '');
        const u = login ? await DB.prepare('SELECT * FROM users WHERE name = ? OR email = ?').bind(login, login).first() : null;
        if (u && u.lock_until > now) return fail(429, `Zu viele Versuche. Bitte warte ${Math.ceil((u.lock_until - now) / 60000)} Minuten.`);
        if (!u || !(await checkPw(pw, u.pw))) {
          if (u) { const f = u.fails + 1; await DB.prepare('UPDATE users SET fails = ?, lock_until = ? WHERE id = ?').bind(f >= 8 ? 0 : f, f >= 8 ? now + 10 * 60000 : 0, u.id).run(); }
          return fail(401, 'Benutzername oder Passwort stimmt nicht.');
        }
        await DB.prepare('UPDATE users SET fails = 0, lock_until = 0, seen = ? WHERE id = ?').bind(now, u.id).run();
        return json({ token: await newSession(env, u.id), user: pub(u), state: JSON.parse(u.state), rev: u.rev });
      }

      // ---------- Spielstand lesen und speichern (mit Versionsnummer gegen Überschreiben) ----------
      if (path === '/api/state') {
        const id = await session(env, req); if (!id) return fail(401, 'Bitte melde dich neu an.', { relogin: true });
        if (req.method === 'GET') { const u = await DB.prepare('SELECT name, email, state, rev FROM users WHERE id = ?').bind(id).first(); if (!u) return fail(401, 'Konto nicht gefunden.', { relogin: true }); await DB.prepare('UPDATE users SET seen = ? WHERE id = ?').bind(now, id).run(); return json({ user: pub(u), state: JSON.parse(u.state), rev: u.rev }); }
        if (req.method === 'PUT') {
          const b = await body(req), st = b && cleanState(b.state); if (!st) return fail(400, 'Der Spielstand ist zu groß oder kaputt.');
          const r = await DB.prepare('UPDATE users SET state = ?, rev = rev + 1, summary = ?, seen = ? WHERE id = ? AND rev = ?').bind(st, JSON.stringify(summarize(JSON.parse(st), now)), now, id, +b.rev || 0).run();
          if (!r.meta.changes) { const u = await DB.prepare('SELECT state, rev FROM users WHERE id = ?').bind(id).first(); if (!u) return fail(401, 'Konto nicht gefunden.', { relogin: true }); return fail(409, 'Auf einem anderen Gerät wurde inzwischen gespielt.', { state: JSON.parse(u.state), rev: u.rev }); }
          return json({ rev: (+b.rev || 0) + 1 });
        }
      }
      if (path === '/api/logout' && req.method === 'POST') { const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') || ''); if (m) await DB.prepare('DELETE FROM sessions WHERE token = ?').bind(await sha256(m[1])).run(); return json({ ok: true }); }
      if (path === '/api/password' && req.method === 'POST') {
        const id = await session(env, req); if (!id) return fail(401, 'Bitte melde dich neu an.', { relogin: true }); const b = await body(req) || {}; const u = await DB.prepare('SELECT pw FROM users WHERE id = ?').bind(id).first();
        if (!u || !(await checkPw(String(b.old || ''), u.pw))) return fail(401, 'Das bisherige Passwort stimmt nicht.'); const pw = String(b.password || ''); if (pw.length < 6 || pw.length > 100) return fail(400, 'Das Passwort braucht mindestens 6 Zeichen.');
        await DB.prepare('UPDATE users SET pw = ? WHERE id = ?').bind(await hashPw(pw), id).run(); return json({ ok: true });
      }

      // ---------- Anonyme Nutzungszahlen (ohne Personenbezug, ohne Cookies) ----------
      if (path === '/api/event' && req.method === 'POST') {
        const b = await body(req); const list = b && Array.isArray(b.events) ? b.events.slice(0, 40) : []; const d = today(now), stmts = [];
        for (const e of list) { const ev = String((e && e.e) || ''), n = Math.max(1, Math.min(600, Math.round(+e.n || 1))); if (EV_RE.test(ev)) stmts.push(DB.prepare('INSERT INTO stats (day, ev, n) VALUES (?, ?, ?) ON CONFLICT(day, ev) DO UPDATE SET n = n + excluded.n').bind(d, ev, n)); }
        if (stmts.length) await DB.batch(stmts); return json({ ok: true, n: stmts.length });
      }

      // ---------- Lehrer ----------
      if (path === '/api/teacher/login' && req.method === 'POST') {
        if (!env.LEHRER_PASSWORT) return fail(503, 'Auf dem Server ist noch kein Lehrer-Passwort eingetragen.');
        const lock = await DB.prepare("SELECT v FROM kv WHERE k = 'lehrer_lock'").first(); const lk = lock ? JSON.parse(lock.v) : { f: 0, until: 0 };
        if (lk.until > now) return fail(429, `Zu viele Versuche. Bitte warte ${Math.ceil((lk.until - now) / 60000)} Minuten.`);
        const b = await body(req) || {};
        if (!same(await sha256(String(b.password || '')), await sha256(env.LEHRER_PASSWORT))) { lk.f++; if (lk.f >= 6) { lk.f = 0; lk.until = now + 15 * 60000; } await DB.prepare("INSERT INTO kv (k, v) VALUES ('lehrer_lock', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify(lk)).run(); return fail(401, 'Das Lehrer-Passwort stimmt nicht.'); }
        await DB.prepare("DELETE FROM kv WHERE k = 'lehrer_lock'").run(); const exp = now + 12 * 3600000; return json({ token: `t.${exp}.${await hmac(env.LEHRER_PASSWORT + '|lehrer', String(exp))}` });
      }
      if (path.startsWith('/api/teacher/')) {
        if (!(await teacherOk(env, req))) return fail(401, 'Bitte melde dich als Lehrer neu an.', { relogin: true });
        if (path === '/api/teacher/overview' && req.method === 'GET') {
          const days = Math.max(7, Math.min(365, +url.searchParams.get('days') || 60)), from = today(now - days * DAY);
          const users = (await DB.prepare('SELECT id, name, email, created, seen, summary FROM users ORDER BY seen DESC').all()).results.map(u => ({ ...u, summary: JSON.parse(u.summary || '{}') }));
          const stats = (await DB.prepare('SELECT day, ev, n FROM stats WHERE day >= ? ORDER BY day').bind(from).all()).results;
          return json({ users, stats, from, now });
        }
        const m = /^\/api\/teacher\/user\/(\d+)$/.exec(path), mr = /^\/api\/teacher\/user\/(\d+)\/password$/.exec(path);
        if (mr && req.method === 'POST') { const b = await body(req) || {}, pw = String(b.password || ''); if (pw.length < 6 || pw.length > 100) return fail(400, 'Das neue Passwort braucht mindestens 6 Zeichen.');
          const r = await DB.prepare('UPDATE users SET pw = ?, fails = 0, lock_until = 0 WHERE id = ?').bind(await hashPw(pw), +mr[1]).run(); if (!r.meta.changes) return fail(404, 'Konto nicht gefunden.');
          await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(+mr[1]).run(); return json({ ok: true }); }
        if (m && req.method === 'GET') { const u = await DB.prepare('SELECT id, name, email, created, seen, state FROM users WHERE id = ?').bind(+m[1]).first(); return u ? json({ ...u, state: JSON.parse(u.state) }) : fail(404, 'Konto nicht gefunden.'); }
        if (m && req.method === 'DELETE') { await DB.batch([DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(+m[1]), DB.prepare('DELETE FROM users WHERE id = ?').bind(+m[1])]); return json({ ok: true }); }
      }
      return fail(404, 'Nicht gefunden.');
    } catch (e) { return fail(500, 'Serverfehler. Bitte später nochmal versuchen.', { detail: String(e && e.message || e).slice(0, 200) }); }
  },
};
