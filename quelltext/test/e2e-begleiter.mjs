// Begleiter: Notenwesen in der Sammlung auswählen, es erscheint im Level und im Menü, bleibt gespeichert, lässt sich ablegen.
import { chromium } from 'playwright'; import path from 'node:path'; const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } }); page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const act = a => page.click(`#screen [data-act="${a}"]`); const wait = ms => page.waitForTimeout(ms); const ok = (c, m) => { if (!c) { errors.push(m); console.log('FEHLER', m); } };
await page.goto('file://' + path.resolve('dist/notenbruecke.html')); await wait(300); await act('go'); await page.fill('#pname', 'Budi'); await act('ok'); for (let i = 0; i < 4; i++) await act('next'); await act('new'); await act('next'); await act('next'); await wait(100);
await page.evaluate(() => { const p = __nb.profile; p.keys = true; p.creatures = ['c1', 'e1']; p.notes.e1 = { box: 3, seen: 4, ok: 4 }; __nb.save(); __screens.map(__nb, 0); });
await act('coll'); ok(await page.$eval('[data-k="g1"]', e => e.disabled), 'nicht gesammeltes Wesen ist gesperrt'); await page.click('[data-k="e1"]'); ok((await page.textContent('[data-act="buddy"]')).includes('mitnehmen'), 'Knopf mitnehmen'); await act('buddy'); await wait(100);
ok(await page.evaluate(() => __nb.profile.buddy === 'e1' && !!__nb.buddy && __nb.buddySure), 'Begleiter gesetzt'); ok(await page.$('.crcard.bud[data-k="e1"]'), 'Karte markiert'); ok((await page.textContent('[data-act="buddy"]')).includes('ablegen'), 'Knopf ablegen'); await page.screenshot({ path: 'shots/b1-sammlung.png' });
await act('back'); await page.click('[data-id="h1"]'); await act('go'); await wait(900);
ok(await page.evaluate(() => typeof __nb.scene.bx === 'number' && Math.abs(__nb.scene.bx - (__nb.scene.hero.x - 20)) < 200), 'Begleiter wird im Level gezeichnet'); await page.screenshot({ path: 'shots/b2-level.png' });
await page.reload(); await wait(400); ok(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('notenbruecke.v1')); return s.profiles[0].buddy === 'e1'; }), 'Begleiter gespeichert');
await page.evaluate(() => { __nb.profile.creatures = ['c1']; __nb.applyProfile(); }); ok(await page.evaluate(() => __nb.buddy === null), 'Begleiter ohne Wesen in der Sammlung wird nicht gezeigt');
await browser.close(); console.log(errors.length ? errors.join('\n') : 'BEGLEITER OK'); process.exit(errors.length ? 1 : 0);
