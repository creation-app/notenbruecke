// Übungstage: Zahlen im Übungspass, auf der Karte und in der Bestenliste stimmen; Zeit zählt nur, solange wirklich gespielt wird.
import { chromium } from 'playwright'; import path from 'node:path'; const errors = []; const ok = (c, m) => { if (!c) { errors.push(m); console.log('FEHLER', m); } };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const tz of ['Europe/Berlin', 'America/New_York']) for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 664 }]) {
  const tag = `${tz} ${vp.width}`, page = await (await b.newContext({ viewport: vp, timezoneId: tz, locale: 'de-DE', deviceScaleFactor: vp.width < 500 ? 2 : 1, isMobile: vp.width < 500, hasTouch: vp.width < 500 })).newPage(); page.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
  await page.goto('file://' + path.resolve('dist/notenbruecke.html')); await page.waitForTimeout(300); const act = a => page.click(`#screen [data-act="${a}"]`); await act('go'); await page.fill('#pname', 'Tage'); await act('ok'); await act('skip'); await act('new'); await act('skip'); await page.waitForTimeout(200);
  const setDays = spec => page.evaluate(spec => { const key = off => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }; __nb.profile.days = {}; for (const [off, s] of spec) __nb.profile.days[key(off)] = s; __nb.save(); window.__key = key; }, spec);
  const passInfo = async () => { await page.evaluate(() => __screens.pass(__nb)); return page.evaluate(() => ({ streak: document.getElementById('passStreak').textContent.trim(), days: document.getElementById('passDays').textContent.trim(), min: document.getElementById('passMin').textContent.trim(), cells: [...document.querySelectorAll('#screen .cal i')].map(i => [i.dataset.day, i.className, i.title]), fits: (() => { const sh = document.querySelector('#screen .sheet').getBoundingClientRect(); return ['passStreak', 'passDays', 'passMin'].every(id => { const e = document.getElementById(id), q = e.getBoundingClientRect(); return q.left >= sh.left - 1 && q.right <= sh.right + 1 && e.scrollWidth <= e.clientWidth + 1; }); })() })); };
  // 1. heute 6 min, gestern 12, vorgestern 2, vor 5 Tagen 30 s (zählt nicht), vor 10 Tagen 5 min, vor 40 Tagen 3 min
  await setDays([[0, 360], [1, 720], [2, 120], [5, 30], [10, 300], [40, 180]]); let r = await passInfo();
  ok(r.streak === '3 Tage in Folge', tag + ': 3 Tage in Folge → ' + r.streak); ok(r.days === 'Übungstage insgesamt: 5 · heute schon geübt', tag + ': Übungstage insgesamt → ' + r.days);
  ok(r.min === 'Letzte 7 Tage: 20 min · Insgesamt: 28 min', tag + ': Minuten → ' + r.min); ok(r.fits, tag + ': Zeilen passen ins Blatt');
  const keys = await page.evaluate(() => [0, 1, 2, 5, 10, 27, 28].map(o => window.__key(o))), cell = k => r.cells.find(c => c[0] === k);
  ok(r.cells.length === 28 && r.cells[27][0] === keys[0] && r.cells[0][0] === keys[5] && !cell(keys[6]), tag + ': Kalender zeigt genau die letzten 28 Tage, heute zuletzt');
  ok(new Set(r.cells.map(c => c[0])).size === 28, tag + ': kein Tag doppelt oder ausgelassen');
  ok(cell(keys[0])[1] === 'l2' && cell(keys[1])[1] === 'l3' && cell(keys[2])[1] === 'l1' && cell(keys[3])[1] === '' && cell(keys[4])[1] === 'l2', tag + ': Kalenderfarben ' + JSON.stringify([0, 1, 2, 3, 4].map(i => cell(keys[i])[1])));
  ok(/: 6 min$/.test(cell(keys[0])[2]) && /: 0 min$/.test(cell(keys[3])[2]), tag + ': Kalender-Hinweise');
  ok(r.cells.filter(c => c[1]).length === 4, tag + ': 4 gefärbte Tage in 4 Wochen');
  await page.evaluate(() => __screens.map(__nb, 0)); ok((await page.textContent('#screen .pill.goal')).includes('Heute geübt: 5 von 5 Minuten'), tag + ': Karte zeigt das Tagesziel als erreicht: ' + await page.textContent('#screen .pill.goal'));
  await page.evaluate(() => __screens.board(__nb)); ok(await page.evaluate(() => { const tr = document.querySelector('#screen table.board tr.me'), th = [...document.querySelectorAll('#screen table.board th')].findIndex(t => t.textContent === 'Tage in Folge'); return tr && tr.children[th].textContent.trim() === '3'; }), tag + ': Bestenliste zeigt 3 Tage in Folge');
  // 2. heute noch nicht geübt: Serie von gestern bleibt stehen
  await setDays([[1, 720], [2, 120], [3, 61]]); r = await passInfo(); ok(r.streak === '3 Tage in Folge' && r.days === 'Übungstage insgesamt: 3 · heute noch nicht', tag + ': ohne heute → ' + r.streak + ' / ' + r.days);
  await page.evaluate(() => __screens.map(__nb, 0)); ok((await page.textContent('#screen .pill.goal')).includes('Heute geübt: 0 von 5 Minuten'), tag + ': Karte heute 0');
  // 3. vorgestern zuletzt: Serie ist vorbei; ein einzelner Tag heißt "Tag"
  await setDays([[2, 600], [3, 600]]); r = await passInfo(); ok(r.streak === '0 Tage in Folge' && r.days.startsWith('Übungstage insgesamt: 2'), tag + ': Pause → ' + r.streak);
  await setDays([[0, 90]]); r = await passInfo(); ok(r.streak === '1 Tag in Folge', tag + ': Einzahl → ' + r.streak); await setDays([[0, 59]]); r = await passInfo(); ok(r.streak === '0 Tage in Folge' && r.days === 'Übungstage insgesamt: 0 · heute noch nicht', tag + ': 59 Sekunden sind kein Übungstag → ' + r.streak);
  // 4. leer
  await setDays([]); r = await passInfo(); ok(r.streak === '0 Tage in Folge' && r.min === 'Letzte 7 Tage: 0 min · Insgesamt: 0 min' && r.cells.every(c => !c[1]), tag + ': leerer Pass');
  if (vp.width === 390 && tz === 'Europe/Berlin') { await setDays([[0, 360], [1, 720], [2, 120], [5, 30], [10, 300], [40, 180]]); await passInfo(); await page.screenshot({ path: 'out/pass-390.png' }); await setDays([]); }
  // 5. Zeit läuft nur beim Spielen: Runde starten, aktiv bleiben → zählt; nichts tun → zählt nicht mehr; Pause → zählt nicht
  if (vp.width === 1280) {
    await page.evaluate(() => { __nb.profile.unlockAll = true; __screens.map(__nb, 0); }); await act('train'); await page.click('#screen [data-act="in"][data-v="name"]'); await page.click('#screen [data-act="len"][data-v="count"]'); await act('go'); await page.waitForTimeout(500);
    const total = () => page.evaluate(() => (__nb.profile.days[window.__key(0)] || 0) + __nb.sec);
    const t0 = await total(); for (let i = 0; i < 4; i++) { await page.waitForTimeout(1000); await page.mouse.click(640, 300); } const t1 = await total(); ok(t1 - t0 > 3 && t1 - t0 < 5.5, `${tag}: beim Spielen läuft die Uhr mit (${(t1 - t0).toFixed(1)} s in 4 s)`);
    await page.evaluate(() => { __nb.lastAct = performance.now() - 61000; }); await page.waitForTimeout(200); const t2 = await total(); await page.waitForTimeout(3000); const t3 = await total(); ok(t3 - t2 < 0.2, `${tag}: ohne Ton und Tipp bleibt die Uhr nach 60 s stehen (${(t3 - t2).toFixed(2)} s in 3 s)`);
    await page.mouse.click(640, 300); await page.waitForTimeout(2000); const t4 = await total(); ok(t4 - t3 > 1.4, `${tag}: nach einem Tipp läuft sie weiter (${(t4 - t3).toFixed(1)} s in 2 s)`);
    await page.click('#pauseBtn'); await page.waitForTimeout(300); const t5 = await total(); await page.waitForTimeout(2500); await page.mouse.move(600, 200); const t6 = await total(); ok(t6 - t5 < 0.2, `${tag}: in der Pause steht die Uhr (${(t6 - t5).toFixed(2)} s in 2,5 s)`);
    // im Menü zählt nichts
    await page.evaluate(() => { __nb.paused = false; __screens.map(__nb, 0); }); await page.waitForTimeout(300); const t7 = await total(); for (let i = 0; i < 3; i++) { await page.waitForTimeout(700); await page.mouse.click(640, 30); } const t8 = await total(); ok(t8 - t7 < 0.2, `${tag}: im Menü zählt keine Übungszeit (${(t8 - t7).toFixed(2)} s)`);
    ok(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('notenbruecke.v1')), v = s.profiles[0].days[window.__key(0)]; return Number.isInteger(v) && v >= 5 && v <= 12; }), tag + ': gespeicherte Sekunden von heute plausibel: ' + await page.evaluate(() => JSON.parse(localStorage.getItem('notenbruecke.v1')).profiles[0].days[window.__key(0)]));
  }
  await page.context().close();
}
await b.close(); console.log(errors.length ? errors.join('\n') : 'ÜBUNGSTAGE OK'); process.exit(errors.length ? 1 : 0);
