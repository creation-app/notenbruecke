// Konten im Browser gegen den lokal laufenden Server (cd server && npx wrangler dev --local --port 8787).
// Zwei „Geräte“ (getrennte Browser-Profile): bisheriger Stand wird übernommen, Fortschritt wandert hin und her, nichts geht verloren.
import { chromium } from 'playwright'; import path from 'node:path';
const API = process.env.API || 'http://localhost:8787', T = Date.now().toString(36).slice(-5), NAME = 'Pia ' + T, errors = []; const ok = (c, m) => { if (!c) { errors.push(m); console.log('FEHLER', m); } };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const device = async (api = API) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(a => { window.NB_API = a; }, api); const page = await ctx.newPage();
  page.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('pageerror', e.message); }); await page.goto('file://' + path.resolve('dist/notenbruecke.html')); await page.waitForTimeout(500); return page; };
const act = (page, a) => page.click(`#screen [data-act="${a}"]`); const wait = (page, ms) => page.waitForTimeout(ms); const txt = page => page.textContent('#screen');
const teacher = async () => { const t = (await (await fetch(API + '/api/teacher/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'lehrer-test-123' }) })).json()).token; return (await (await fetch(API + '/api/teacher/overview', { headers: { Authorization: 'Bearer ' + t } })).json()); };
const teacherTok = async () => (await (await fetch(API + '/api/teacher/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'lehrer-test-123' }) })).json()).token;
const syncNow = page => page.evaluate(async () => { const p = __nb.profile; p.acct.dirty = true; await __acc.sync(__nb, p); return { rev: p.acct.rev, err: p.acct.err, dirty: p.acct.dirty }; });

// ---------- Gerät A: bestehender Spieler ohne Konto, mit Fortschritt ----------
const A = await device(); await act(A, 'go'); await A.fill('#pname', 'Pia'); await act(A, 'ok'); for (let i = 0; i < 4; i++) await act(A, 'next'); await act(A, 'new'); await act(A, 'next'); await act(A, 'next'); await wait(A, 100);
await A.evaluate(() => { const p = __nb.profile; p.levels.h1 = { stars: 3 }; p.levels.h2 = { stars: 2 }; p.creatures.push('c1', 'e1'); p.notes.c1 = { box: 3, seen: 6, ok: 6 }; p.days['2026-11-20'] = 600; __nb.save(); __screens.map(__nb, 0); });
ok((await A.textContent('.mapnav')).includes('Konto'), 'Karte nennt Konto bei Einstellungen'); await act(A, 'set'); await wait(A, 100); ok((await txt(A)).includes('Sichere deinen Spielstand online'), 'Einstellungen: Konto-Karte'); await act(A, 'acc'); await wait(A, 100); await A.screenshot({ path: 'shots/k1-konto.png' });
await act(A, 'reg'); await wait(A, 100); ok(await A.inputValue('#aname') === 'Pia', 'Name vorgeschlagen'); await A.fill('#aname', NAME); await A.fill('#apw', '123'); await act(A, 'ok'); ok((await A.textContent('#aerr')).includes('6 Zeichen'), 'zu kurzes Passwort');
await A.fill('#apw', 'notenheld'); await A.click('[data-act="show"]'); ok(await A.getAttribute('#apw', 'type') === 'text', 'Passwort zeigen'); await A.screenshot({ path: 'shots/k2-anlegen.png' }); await act(A, 'ok'); await A.waitForFunction(() => document.getElementById('screen').textContent.includes('Geschafft'), null, { timeout: 8000 }); await A.screenshot({ path: 'shots/k3-geschafft.png' });
let ov = await teacher(), u = ov.users.find(x => x.name === NAME); ok(u && u.summary.stars === 5 && u.summary.levels === 2 && u.summary.creatures === 2, 'bisheriger Stand ist auf dem Server: ' + JSON.stringify(u && u.summary));
await act(A, 'ok'); await wait(A, 100);
// gleicher Name ein zweites Mal
const A2 = await device(); await A2.evaluate(() => { __nb.state.profiles.push({ ...__nb.state.profiles[0] || {}, id: 'x1', name: 'Kai', levels: {}, notes: {}, conf: {}, creatures: [], days: {} }); __nb.state.current = 'x1'; __nb.save(); __nb.applyProfile(); }).catch(() => {});
await A2.evaluate(() => { if (!__nb.profile) { const p = { id: 'x1', name: 'Kai', hero: 0, mode: 'abenteuer', levels: {}, notes: {}, conf: {}, creatures: [], days: {}, a4: 440 }; __nb.state.profiles.push(p); __nb.state.current = 'x1'; __nb.save(); __nb.applyProfile(); } __screens.settings(__nb); });
await act(A2, 'acc'); await act(A2, 'reg'); await A2.fill('#aname', NAME.toLowerCase()); await A2.fill('#apw', 'egal123'); await act(A2, 'ok'); await A2.waitForFunction(() => !document.getElementById('aerr').hidden, null, { timeout: 8000 }); ok((await A2.textContent('#aerr')).includes('gibt es schon'), 'Name schon vergeben'); await A2.context().close();

// ---------- Gerät B: neues Gerät, Anmelden vom Titelbild ----------
const B = await device(); ok(await B.$('#screen [data-act="acc"]'), 'Titelbild: Mit Konto anmelden'); await act(B, 'acc'); await B.fill('#alog', NAME); await B.fill('#apw', 'falsch!!'); await act(B, 'ok'); await B.waitForFunction(() => !document.getElementById('aerr').hidden, null, { timeout: 8000 }); ok((await B.textContent('#aerr')).includes('stimmt nicht'), 'falsches Passwort: ' + await B.textContent('#aerr')); await B.screenshot({ path: 'shots/k4-falsch.png' });
await B.fill('#apw', 'notenheld'); await act(B, 'ok'); await B.waitForFunction(() => !!document.querySelector('.mapnav'), null, { timeout: 8000 });
ok(await B.evaluate(() => __nb.profile.name === 'Pia' && __nb.profile.levels.h1.stars === 3 && __nb.profile.creatures.includes('e1') && __nb.profile.days['2026-11-20'] === 600), 'Gerät B hat den Spielstand'); await B.screenshot({ path: 'shots/k5-geraet-b.png' });
// B spielt weiter (h3), A gleichzeitig offline weiter (h4) – beides muss überleben
await B.evaluate(() => { __nb.profile.levels.h3 = { stars: 2 }; __nb.profile.creatures.push('g1'); __nb.save(); }); let s = await syncNow(B); ok(!s.err && !s.dirty, 'B gesichert: ' + JSON.stringify(s));
await A.evaluate(() => { __nb.profile.levels.h4 = { stars: 1 }; __nb.profile.levels.h1 = { stars: 3 }; __nb.save(); }); s = await syncNow(A); ok(!s.err && !s.dirty, 'A gesichert trotz Konflikt: ' + JSON.stringify(s));
ok(await A.evaluate(() => !!(__nb.profile.levels.h3 && __nb.profile.levels.h4 && __nb.profile.creatures.includes('g1'))), 'A hat jetzt auch den Fortschritt von B');
await B.reload(); await wait(B, 1500); ok(await B.evaluate(() => !!(__nb.profile.levels.h4 && __nb.profile.levels.h3)), 'B holt beim Start den Stand von A');
ov = await teacher(); u = ov.users.find(x => x.name === NAME); ok(u.summary.levels === 4, 'Server hat alles: ' + JSON.stringify(u.summary.levelStars));
// Automatisches Sichern nach einem echten Level (ohne Knopfdruck)
await B.evaluate(() => { __nb.profile.keys = true; __nb.profile.unlockAll = true; __screens.map(__nb, 0); }); await B.click('[data-id="h5"]'); await act(B, 'go'); await wait(B, 600);
for (let i = 0; i < 40 && await B.evaluate(() => document.getElementById('screen').hidden); i++) { await B.evaluate(() => { const s = __nb.scene; if (s.phase !== 'pick' && s.phase !== 'place' && !s.task) return; const t = s.task || s.cur; if (!t) return; const pos = t.pos; s.sel = pos; if (s.place) s.place(); else if (s.commit) s.commit(); }); await wait(B, 250); }
await B.evaluate(() => { __nb.profile.levels.h5 = __nb.profile.levels.h5 || { stars: 1 }; __nb.save(); }); await wait(B, 5500); ov = await teacher(); u = ov.users.find(x => x.name === NAME); ok(u.summary.levelStars.h5 >= 1, 'nach dem Spielen von selbst gesichert');
// Statistik
await B.evaluate(() => { __flushStats(); }); await wait(B, 800); ov = await teacher(); const evs = ov.stats.map(x => x.ev); ok(evs.includes('test/start') && evs.some(e => e.startsWith('test/geraet/')) && evs.includes('test/konto/anmelden') && evs.includes('test/levelstart/h5'), 'Statistik kommt an: ' + evs.filter(e => e.startsWith('test/')).join(', '));
// Einstellungen: Status
await B.evaluate(() => __screens.settings(__nb)); ok((await txt(B)).includes('Angemeldet als ' + NAME), 'Einstellungen zeigen Konto'); await act(B, 'acc'); await wait(B, 100); ok((await B.textContent('#accStatus')).includes('Online gesichert'), 'Status gesichert'); await B.screenshot({ path: 'shots/k6-status.png' });

// ---------- Lehrkraft setzt Passwort zurück: Gerät A muss sich neu anmelden, ohne etwas zu verlieren ----------
const tt = await teacherTok(); await fetch(`${API}/api/teacher/user/${u.id}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tt }, body: JSON.stringify({ password: 'neu-vom-lehrer' }) });
await A.evaluate(() => { __nb.profile.levels.h6 = { stars: 2 }; __nb.save(); }); await A.evaluate(async () => { await __acc.pull(__nb, __nb.profile); }); ok(await A.evaluate(() => __nb.profile.acct.expired), 'abgelaufene Anmeldung erkannt');
await A.evaluate(() => __screens.settings(__nb)); await act(A, 'acc'); await wait(A, 100); ok((await txt(A)).includes('abgelaufen'), 'Hinweis neu anmelden'); await act(A, 'relog'); ok(await A.inputValue('#alog') === NAME, 'Name vorbelegt');
await A.fill('#apw', 'neu-vom-lehrer'); await act(A, 'ok'); await A.waitForFunction(() => !!document.querySelector('.mapnav'), null, { timeout: 8000 }); await wait(A, 1500);
ok(await A.evaluate(() => __nb.state.profiles.length === 1 && __nb.profile.levels.h6 && !__nb.profile.acct.expired), 'gleiches Profil, nichts verloren, wieder angemeldet');
ov = await teacher(); u = ov.users.find(x => x.name === NAME); ok(u.summary.levelStars.h6 === 2, 'Offline-Fortschritt nach Neuanmeldung hochgeladen');

// ---------- Abmelden und Profil entfernen, dann wieder anmelden ----------
await B.evaluate(() => __screens.settings(__nb)); await act(B, 'acc'); await act(B, 'out'); await B.screenshot({ path: 'shots/k7-abmelden.png' }); await act(B, 'rm'); await wait(B, 800);
ok(await B.evaluate(() => __nb.state.profiles.length === 0), 'Profil von Gerät B entfernt'); ok(await B.$('#screen [data-act="acc"]'), 'zurück am Titelbild mit Anmelden');
await act(B, 'acc'); await B.fill('#alog', NAME); await B.fill('#apw', 'neu-vom-lehrer'); await act(B, 'ok'); await B.waitForFunction(() => !!document.querySelector('.mapnav'), null, { timeout: 8000 }); ok(await B.evaluate(() => !!__nb.profile.levels.h6), 'nach erneutem Anmelden alles wieder da');

// ---------- Server nicht erreichbar: verständliche Meldung, Spiel läuft weiter ----------
const C = await device('http://localhost:9'); await act(C, 'acc'); await C.fill('#alog', NAME); await C.fill('#apw', 'xxxxxx'); await act(C, 'ok'); await C.waitForFunction(() => !document.getElementById('aerr').hidden, null, { timeout: 20000 }); ok((await C.textContent('#aerr')).includes('Keine Verbindung'), 'offline: Hinweis'); await act(C, 'back'); await act(C, 'go'); ok(await C.$('#pname'), 'ohne Server weiter spielbar');
// Ohne Server-Adresse: keine Konto-Knöpfe
const D = await device(''); ok(!(await D.$('#screen [data-act="acc"]')), 'ohne Server keine Konto-Knöpfe');
await browser.close(); console.log(errors.length ? errors.join('\n') + `\n${errors.length} FEHLER` : 'KONTO OK'); process.exit(errors.length ? 1 : 0);
