// Freies Training auf dem Handy (hoch und quer): Der Schalter "Mit Vorzeichen" reagiert auf jeden Tipp, auch nach dem Scrollen, und springt nicht weg.
import { chromium } from 'playwright'; import path from 'node:path'; const errors = []; const ok = (c, m) => { if (!c) { errors.push(m); console.log('FEHLER', m); } };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const [w, h] of [[390, 664], [375, 553], [360, 640], [430, 932], [320, 568], [667, 375], [844, 390]]) {
  const tag = w + 'x' + h, page = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage(); page.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
  await page.goto('file://' + path.resolve('dist/notenbruecke.html')); await page.waitForTimeout(300);
  const act = a => page.click(`#screen [data-act="${a}"]`); await act('go'); await page.fill('#pname', 'Mia'); await act('ok'); await act('skip'); await act('new'); await act('skip'); await page.waitForTimeout(200);
  await page.evaluate(() => { __nb.profile.unlockAll = true; __nb.full = true; }); await act('train'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('screen')).zoom === '1'), tag + ': kein CSS-zoom mehr auf dem Bildschirm');
  const on = () => page.$eval('#screen .toggle[data-act="acc"]', n => n.getAttribute('aria-checked') === 'true');
  const box = async () => { const q = await page.locator('#screen .toggle[data-act="acc"]').boundingBox(); return q; };
  const scrollTo = where => page.evaluate(where => { const sb = document.querySelector('#screen .sbody'), n = sb.querySelector('.toggle[data-act="acc"]'); n.scrollIntoView({ block: where }); return sb.scrollTop; }, where);
  let want = false;
  for (const where of ['center', 'end', 'start']) for (const fx of [0.06, 0.5, 0.94]) {
    const y0 = await scrollTo(where), q = await box(), x = q.x + q.width * fx, y = q.y + q.height / 2;
    ok(await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest('.toggle[data-act="acc"]'); }, [x, y]), `${tag}: Schalter liegt frei (${where}, ${fx})`);
    await page.touchscreen.tap(x, y); await page.waitForTimeout(120); want = !want; ok(await on() === want, `${tag}: Tipp schaltet um (${where}, ${fx})`);
    const y1 = await page.evaluate(() => document.querySelector('#screen .sbody').scrollTop); ok(Math.abs(y1 - y0) < 2, `${tag}: Ansicht springt nicht weg (${y0} → ${y1})`);
  }
  // gesperrt im Bassschlüssel: sichtbar grau, Tipp erklärt den Grund
  await page.click('#screen [data-act="range"][data-v="bass"]'); await scrollTo('center'); let q = await box(); await page.touchscreen.tap(q.x + 30, q.y + q.height / 2); await page.waitForTimeout(120);
  ok(!(await on()) && await page.$eval('#screen .toggle[data-act="acc"]', n => n.classList.contains('off') && !!n.querySelector('small.why')), tag + ': gesperrter Schalter erklärt sich');
  ok(await page.evaluate(() => { const s = document.querySelector('#screen .toggle[data-act="acc"] small'), q = s.getBoundingClientRect(), sb = document.querySelector('#screen .sbody').getBoundingClientRect(); return s.scrollWidth <= s.clientWidth + 1 && q.right <= sb.right + 1 && q.left >= sb.left - 1; }), tag + ': Erklärung nicht abgeschnitten');
  if (w === 390) await page.screenshot({ path: 'out/schalter-gesperrt.png' });
  await page.click('#screen [data-act="range"][data-v="treble"]'); await scrollTo('center'); q = await box(); await page.touchscreen.tap(q.x + 30, q.y + q.height / 2); await page.waitForTimeout(120); ok(await on(), tag + ': zurück im Violinschlüssel geht es wieder');
  // und die Runde enthält dann wirklich Vorzeichen
  await page.click('#screen [data-act="in"][data-v="name"]'); await act('go'); await page.waitForTimeout(500); ok(await page.evaluate(() => __nb.scene && __nb.scene.cfg && __nb.scene.cfg.acc === true), tag + ': Runde startet mit Vorzeichen');
  await page.context().close();
}
await b.close(); console.log(errors.length ? errors.join('\n') : 'SCHALTER OK (7 Handy-Größen)'); process.exit(errors.length ? 1 : 0);
