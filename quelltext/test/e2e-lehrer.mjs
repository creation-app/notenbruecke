// Lehrer-Seite gegen den lokalen Server: Anmeldung, Übersicht, Statistik, Hinweise, Passwort zurücksetzen, Konto löschen, Handy-Ansicht.
import { chromium } from 'playwright'; import path from 'node:path';
const API = process.env.API || 'http://localhost:8787', T = Date.now().toString(36).slice(-5), errors = []; const ok = (c, m) => { if (!c) { errors.push(m); console.log('FEHLER', m); } };
const post = (p, b, tok) => fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(b) }).then(r => r.json());
// Testdaten: zwei Konten, Nutzungszahlen mit einem oft abgebrochenen Level
await post('/api/register', { name: 'Ella ' + T, email: `ella${T}@example.org`, password: 'geheim1', state: { levels: { h1: { stars: 3 }, h2: { stars: 1 } }, notes: { c1: { box: 4, seen: 8 } }, creatures: ['c1'], days: { [new Date(Date.now() + 36e5).toISOString().slice(0, 10)]: 900 } } });
await post('/api/register', { name: 'Finn ' + T, password: 'geheim2', state: {} });
await post('/api/event', { events: [{ e: 'test/start', n: 20 }, { e: 'test/levelstart/h3', n: 10 }, { e: 'test/level/h3', n: 2 }, { e: 'test/levelstart/h1', n: 6 }, { e: 'test/level/h1', n: 6 }, { e: 'test/zeit/jump', n: 1800 }, { e: 'test/zeit/train', n: 600 }, { e: 'test/training/play-treble-time', n: 7 }, { e: 'test/geraet/tablet', n: 15 }, { e: 'test/geraet/handy', n: 5 }, { e: 'kauf/start', n: 3 }] });
for (let i = 0; i < 4; i++) await post('/api/event', { events: Array.from({ length: 40 }, () => ({ e: 'test/zeit/menue', n: 600 })) }); // viel Menüzeit (je Ereignis höchstens 600 s)
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript(a => { window.NB_API = a; }, API); const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto('file://' + path.resolve('dist/lehrer/index.html')); await page.waitForTimeout(300);
await page.fill('#lpw', 'falsch'); await page.click('#lf button'); await page.waitForTimeout(400); ok((await page.textContent('#lerr')).includes('stimmt nicht'), 'falsches Lehrer-Passwort');
await page.fill('#lpw', 'lehrer-test-123'); await page.click('#lf button'); await page.waitForSelector('.tiles'); const t = await page.textContent('body');
ok(t.includes('Ella ' + T) && t.includes('Finn ' + T), 'Schüler sichtbar'); ok(t.includes('Spielminuten pro Tag') && t.includes('Springen (Klavier)'), 'Zeit nach Spielart');
ok(/Erster Notenregen<\/b> \(Himmel\) wird oft abgebrochen|Erster Notenregen \(Himmel\) wird oft abgebrochen/.test(t), 'Hinweis auf abgebrochenes Level'); ok(t.includes('Auffällig viel Zeit in Menüs'), 'Hinweis Menüzeit'); ok(t.includes('Violinschlüssel · Klavier · 60 s'), 'Training lesbar');
await page.screenshot({ path: 'shots/l1-uebersicht.png', fullPage: true });
await page.selectOption('#scope', 'kauf'); const kt = await page.textContent('.tiles'); await page.selectOption('#scope', 'test'); ok(kt !== await page.textContent('.tiles'), 'Filter Kauf-Link'); await page.selectOption('#scope', 'alle');
await page.fill('#find', 'ella ' + T); ok((await page.$$('.urow')).length === 1, 'Suche'); await page.click('.urow'); ok(await page.$('.det'), 'Details aufklappen'); ok((await page.textContent('.det')).includes('★★★'), 'Sterne je Level: ' + (await page.textContent('.det')).slice(0, 300)); await page.screenshot({ path: 'shots/l2-detail.png' });
await page.fill('#rpw', 'neu-lehrer1'); await page.click('#rp button'); await page.waitForTimeout(500); ok((await page.textContent('#rmsg')).includes('neu-lehrer1'), 'Passwort zurückgesetzt');
ok((await post('/api/login', { login: 'Ella ' + T, password: 'neu-lehrer1' })).token, 'Anmelden mit neuem Passwort');
await page.fill('#find', 'finn ' + T); await page.click('.urow'); await page.click('#del'); ok((await page.textContent('#del')).includes('Wirklich'), 'Löschen fragt nach'); await page.click('#del'); await page.waitForSelector('.tiles'); await page.waitForTimeout(300); ok(!(await page.textContent('body')).includes('Finn ' + T), 'Konto gelöscht');
await page.reload(); await page.waitForSelector('.tiles'); ok(true, 'bleibt nach Neuladen angemeldet'); await page.click('#out'); ok(await page.$('#lpw'), 'Abmelden');
const ph = await (await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true })).newPage(); await ph.addInitScript(a => { window.NB_API = a; }, API); await ph.goto('file://' + path.resolve('dist/lehrer/index.html')); await ph.fill('#lpw', 'lehrer-test-123'); await ph.click('#lf button'); await ph.waitForSelector('.tiles');
ok(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Handy: nichts ragt seitlich heraus'); await ph.screenshot({ path: 'shots/l3-handy.png', fullPage: true });
await browser.close(); console.log(errors.length ? errors.join('\n') : 'LEHRER OK'); process.exit(errors.length ? 1 : 0);
