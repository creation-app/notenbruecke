// Server-Tests gegen einen lokal laufenden Worker (npx wrangler dev --local --port 8787, Lehrer-Passwort aus .dev.vars).
import test from 'node:test'; import assert from 'node:assert/strict';
const API = process.env.API || 'http://localhost:8787', T = Date.now().toString(36).slice(-5);
const call = async (path, opt = {}, tok) => { const r = await fetch(API + path, { method: opt.method || (opt.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined }); return { status: r.status, cors: r.headers.get('access-control-allow-origin'), ...(await r.json()) }; };
const state = (stars = 2) => ({ id: 'abc', name: 'Lea', mode: 'abenteuer', levels: { h1: { stars }, h2: { stars: 1 } }, notes: { c1: { box: 3, seen: 5 }, d1: { box: 1, seen: 2 } }, creatures: ['c1', 'd1'], days: { [new Date(Date.now() + 3600000).toISOString().slice(0, 10)]: 420 }, train: { 'play-treble-time': { best: 22, stars: 1, runs: [{ n: 22 }] } } });

test('Konto anlegen, anmelden, Fehlerfälle', async () => {
  const name = 'Lea ' + T;
  let r = await call('/api/register', { body: { name, password: 'geheim1', state: state() } }); assert.equal(r.status, 200); assert.ok(r.token.length > 30); assert.equal(r.rev, 1); assert.equal(r.cors, '*');
  assert.equal((await call('/api/register', { body: { name: name.toUpperCase(), password: 'geheim1' } })).status, 409, 'Name doppelt (auch Groß/Klein)');
  for (const [b, f] of [[{ name: 'L', password: 'geheim1' }, 'name'], [{ name: 'Leo<script>', password: 'geheim1' }, 'name'], [{ name: 'Leo ' + T, password: '123' }, 'password'], [{ name: 'Leo ' + T, password: 'geheim1', email: 'kaputt' }, 'email']]) { const x = await call('/api/register', { body: b }); assert.equal(x.status, 400); assert.equal(x.field, f); }
  r = await call('/api/login', { body: { login: name.toLowerCase(), password: 'geheim1' } }); assert.equal(r.status, 200); assert.equal(r.user.name, name); assert.equal(r.state.levels.h1.stars, 2); assert.equal(r.rev, 1);
  assert.equal((await call('/api/login', { body: { login: name, password: 'falsch!' } })).status, 401); assert.equal((await call('/api/login', { body: { login: 'gibtsnicht' + T, password: 'egal123' } })).status, 401);
  // mit E-Mail
  const mail = `eltern.${T}@example.org`; r = await call('/api/register', { body: { name: 'Mia ' + T, email: mail, password: 'flöte99', state: {} } }); assert.equal(r.status, 200);
  assert.equal((await call('/api/register', { body: { name: 'Mia2 ' + T, email: mail.toUpperCase(), password: 'flöte99' } })).status, 409, 'E-Mail doppelt');
  r = await call('/api/login', { body: { login: mail, password: 'flöte99' } }); assert.equal(r.status, 200); assert.equal(r.user.name, 'Mia ' + T);
});
test('Spielstand speichern, Schutz vor Überschreiben, Abmelden', async () => {
  const name = 'Ben ' + T; const { token } = await call('/api/register', { body: { name, password: 'klavier', state: state(1) } }); const t2 = (await call('/api/login', { body: { login: name, password: 'klavier' } })).token;
  let r = await call('/api/state', { method: 'PUT', body: { state: state(3), rev: 1 } }, token); assert.equal(r.status, 200); assert.equal(r.rev, 2);
  r = await call('/api/state', { method: 'PUT', body: { state: state(2), rev: 1 } }, t2); assert.equal(r.status, 409, 'zweites Gerät mit altem Stand'); assert.equal(r.rev, 2); assert.equal(r.state.levels.h1.stars, 3);
  r = await call('/api/state', {}, t2); assert.equal(r.rev, 2); assert.equal(r.state.levels.h1.stars, 3);
  assert.equal((await call('/api/state', {}, 'quatsch')).status, 401); assert.equal((await call('/api/state', { method: 'PUT', body: { state: 'x', rev: 2 } }, token)).status, 400);
  assert.equal((await call('/api/state', { method: 'PUT', body: { state: { big: 'x'.repeat(400000) }, rev: 2 } }, token)).status, 400, 'zu groß');
  assert.equal((await call('/api/password', { body: { old: 'falsch', password: 'neues123' } }, token)).status, 401); assert.equal((await call('/api/password', { body: { old: 'klavier', password: 'neues123' } }, token)).status, 200);
  assert.equal((await call('/api/login', { body: { login: name, password: 'neues123' } })).status, 200);
  await call('/api/logout', { body: {} }, token); assert.equal((await call('/api/state', {}, token)).status, 401, 'nach Abmelden ungültig'); assert.equal((await call('/api/state', {}, t2)).status, 200, 'anderes Gerät bleibt angemeldet');
});
test('Sperre nach vielen Fehlversuchen', async () => {
  const name = 'Tom ' + T; await call('/api/register', { body: { name, password: 'richtig1' } });
  for (let i = 0; i < 8; i++) await call('/api/login', { body: { login: name, password: 'falsch' + i } });
  const r = await call('/api/login', { body: { login: name, password: 'richtig1' } }); assert.equal(r.status, 429); assert.match(r.error, /warte/);
});
test('Nutzungszahlen und Lehrer-Übersicht', async () => {
  let r = await call('/api/event', { body: { events: [{ e: 'test/level/h1' }, { e: 'test/level/h1' }, { e: 'test/zeit/jump', n: 90 }, { e: 'BÖSE<>' }, { e: 'x'.repeat(100) }] } }); assert.equal(r.n, 3);
  assert.equal((await call('/api/teacher/overview')).status, 401); assert.equal((await call('/api/teacher/login', { body: { password: 'falsch' } })).status, 401);
  const { token } = await call('/api/teacher/login', { body: { password: 'lehrer-test-123' } }); assert.match(token, /^t\.\d+\./);
  r = await call('/api/teacher/overview', {}, token); assert.equal(r.status, 200); const lea = r.users.find(u => u.name === 'Lea ' + T); assert.ok(lea);
  assert.equal(lea.summary.stars, 4); assert.equal(lea.summary.levels, 2); assert.equal(lea.summary.minutesWeek, 7); assert.equal(lea.summary.trainBest, 22); assert.equal(lea.summary.sure, 1); assert.deepEqual(lea.summary.levelStars, { h1: 2, h2: 1 }); assert.ok(!('state' in lea) && !('pw' in lea), 'keine Passwörter in der Übersicht');
  const ev = r.stats.filter(s => s.ev === 'test/level/h1'); assert.ok(ev.length && ev[ev.length - 1].n >= 2);
  assert.equal((await call(`/api/teacher/user/${lea.id}/password`, { body: { password: 'neu-von-lehrer' } }, token)).status, 200); assert.equal((await call('/api/login', { body: { login: 'Lea ' + T, password: 'neu-von-lehrer' } })).status, 200);
  const one = await call(`/api/teacher/user/${lea.id}`, {}, token); assert.equal(one.state.levels.h1.stars, 2);
  const forged = 't.' + (Date.now() + 99999) + '.abc'; assert.equal((await call('/api/teacher/overview', {}, forged)).status, 401, 'gefälschtes Lehrer-Token');
  const tom = r.users.find(u => u.name === 'Tom ' + T); assert.equal((await call(`/api/teacher/user/${tom.id}`, { method: 'DELETE' }, token)).status, 200); assert.ok(!(await call('/api/teacher/overview', {}, token)).users.some(u => u.name === 'Tom ' + T));
});
