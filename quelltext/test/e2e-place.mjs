// Einstufung und Kurzcode im Browser.
import { chromium } from 'playwright'; import path from 'node:path'; const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const act = async a => { await page.click(`#screen [data-act="${a}"]`); await page.waitForTimeout(60); while (await page.$('#screen:not([hidden]) .petcard')) { await page.click('#screen .petcard [data-act="ok"]'); await page.waitForTimeout(60); } }; /* Tier-Karten prüft e2e-pegasus */ const wait = ms => page.waitForTimeout(ms); const ok = (c, m) => { if (!c) { errors.push('ASSERT: ' + m); } };
await page.goto('file://' + path.resolve('dist/notenbruecke.html')); await wait(500); await act('go'); await page.fill('#pname', 'Könner'); await act('ok'); await act('skip'); await wait(100); await page.screenshot({ path: 'shots/p1-frage.png' }); await act('test'); await wait(600);
const answer = async (right) => { const label = await page.$eval('#plStaff canvas', c => c.getAttribute('aria-label')); // Position aus dem Bild ablesen wie ein Kind
  const m = /(\d)\. (Linie|Zwischenraum)|(\d)\. Hilfslinie (unter|über)|direkt (unter|über)|(unter|über) der (\d)\. Hilfslinie/.exec(label); const bass = label.includes('Bass');
  let pos; if (m[1]) pos = m[2] === 'Linie' ? (m[1] - 1) * 2 : m[1] * 2 - 1; else if (m[3]) pos = m[4] === 'unter' ? -2 * m[3] : 8 + 2 * m[3]; else if (m[5]) pos = m[5] === 'unter' ? -1 : 9; else pos = m[6] === 'unter' ? -(2 * m[7] + 1) : 8 + 2 * m[7] + 1;
  const step = pos + (bass ? -10 : 2), L = 'cdefgah'[((step % 7) + 7) % 7]; const btns = await page.$$eval('.ans', b => b.map(x => x.textContent));
  const cands = btns.filter(b => b[0] === L || (L === 'h' && b === 'b') ); let pickBtn = right ? null : btns.find(b => b[0] !== L && !(L === 'h' && b === 'b'));
  if (right) { for (const c of cands) { /* bei Vorzeichen: richtigen Namen über Test-Zugriff nicht nötig, wir probieren den Stammton zuerst */ } pickBtn = cands[0]; }
  await page.click(`.ans:text-is("${pickBtn}")`); await wait(60); };
await page.screenshot({ path: 'shots/p2-test.png' });
for (let i = 0; i < 15; i++) await answer(true);   // Stufen 1–3 bestehen
await page.screenshot({ path: 'shots/p3-bass.png' });
for (let i = 0; i < 5; i++) { if (await page.$('.ans')) await answer(false); }  // Stufe 4 nicht bestehen
await wait(150); await page.screenshot({ path: 'shots/p4-ergebnis.png' });
let p = await page.evaluate(() => __nb.profile); ok(JSON.stringify(p.skip) === '[15,1,0,0]', 'Einstieg nach drei Stufen: ' + JSON.stringify(p.skip));
await act('ok'); await wait(150); if (await page.$('.story')) { await act('next'); await act('next'); } await wait(150); await page.screenshot({ path: 'shots/p5-karte.png' });
ok(await page.$('[data-id="t1"]:not([disabled])'), 'Welt 2, erstes Level offen'); await page.click('[data-w="0"]'); await wait(100); if (await page.$('.story')) { await act('next'); await act('next'); } ok(await page.$('[data-id="h15"]:not([disabled])'), 'h15 offen');
await page.evaluate(() => { __nb.profile.levels.h14 = { stars: 2 }; __nb.save(); }); await page.click('[data-act="set"]'); await wait(100); await page.screenshot({ path: 'shots/p6-kurzcode.png' });
const code = await page.$eval('.shortcode', e => e.textContent); ok(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code), 'Kurzcode angezeigt: ' + code);
await page.evaluate(() => localStorage.clear()); await page.reload(); await wait(400); await act('go'); await page.fill('#pname', 'Y'); await act('ok'); await act('skip'); await act('new'); await act('skip'); await page.click('[data-act="prof"]'); await act('code');
await page.fill('#codeIn', code.toLowerCase().replace(/-/g, ' ')); await act('ok'); ok((await page.textContent('#cerr')).includes('Namen'), 'fragt nach Namen'); await page.fill('#codeName', 'Könner'); await act('ok'); await wait(200);
p = await page.evaluate(() => __nb.profile); ok(p.name === 'Könner' && p.levels.h1 && p.levels.h1.stars === 2 && JSON.stringify(p.skip) === '[15,1,0,0]', 'Kurzcode übernommen: ' + JSON.stringify([p.name, p.levels, p.skip]));
console.log(errors.length ? errors.join('\n') : 'EINSTUFUNG + KURZCODE OK'); await browser.close(); process.exit(errors.length ? 1 : 0);
