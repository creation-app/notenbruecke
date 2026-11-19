// Neue Teile im Browser: Einstufung mit Klavier, große Brücke (zwei Hände), Tagesziel, Geschichte, QR/Link, Kauf-Fassung mit Schlüssel.
import { chromium } from 'playwright'; import path from 'node:path'; import fs from 'node:fs'; import { signKey } from '../src/license.js'; const errors = [];
const priv = JSON.parse(fs.readFileSync('../geheim/privat.jwk.json', 'utf8'));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const act = a => page.click(`#screen [data-act="${a}"]`); const wait = ms => page.waitForTimeout(ms); const ok = (c, m) => { if (!c) { errors.push('ASSERT: ' + m); console.log('FEHLER', m); } };
const FREE = 'file://' + path.resolve('dist/index.html'), SHOP = 'file://' + path.resolve('dist/shop/index.html');
const midiJs = `(() => { const t = __nb.scene.target; return 60 + Math.floor(t.step / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][((t.step % 7) + 7) % 7] + t.alt; })()`;
const playJump = async () => { for (let g = 0; g < 500 && await page.evaluate(() => document.getElementById('screen').hidden); g++) { if (await page.evaluate(() => __nb.scene.phase === 'listen')) await page.evaluate(`__nb.keyTap(${midiJs})`); await wait(110); } };

// --- Einstufung mit Klavier (Mikrofon als "an" simuliert, Töne über die Prüf-Schnittstelle)
await page.goto(FREE); await wait(500); await act('go'); await page.fill('#pname', 'Lena'); await act('ok'); await act('skip'); await wait(100);
await page.evaluate(() => { __nb.audio.micState = 'on'; __nb.audio.poll = () => null; __nb.profile.calibrated = true; }); await act('test'); await wait(300);
const readRight = async () => { const k = await page.evaluate(() => { const c = document.querySelector('#plStaff canvas').getAttribute('aria-label'); return c; });
  const m = /(\d)\. (Linie|Zwischenraum)|(\d)\. Hilfslinie (unter|über)|direkt (unter|über)|(unter|über) der (\d)\. Hilfslinie/.exec(k), bass = k.includes('Bass');
  let pos; if (m[1]) pos = m[2] === 'Linie' ? (m[1] - 1) * 2 : m[1] * 2 - 1; else if (m[3]) pos = m[4] === 'unter' ? -2 * m[3] : 8 + 2 * m[3]; else if (m[5]) pos = m[5] === 'unter' ? -1 : 9; else pos = m[6] === 'unter' ? -(2 * m[7] + 1) : 9 + 2 * m[7];
  const step = pos + (bass ? -10 : 2); return { step, letter: 'cdefgah'[((step % 7) + 7) % 7], midi: 60 + Math.floor(step / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][((step % 7) + 7) % 7] }; };
for (let i = 0; i < 5; i++) { const r = await readRight(); await page.click(`.ans:text-is("${r.letter}")`); await wait(60); }
ok(await page.evaluate(() => !!__nb.calib), 'nach dem Lesen folgt der Klavier-Teil'); await page.screenshot({ path: 'shots/n1-einstufung-klavier.png' });
for (let i = 0; i < 3; i++) { const r = await readRight(); await page.evaluate(m => __nb.calib.onNote(m), i === 1 ? r.midi + 12 : r.midi); await wait(850); }   // eine falsche Oktave ist erlaubt (2 von 3)
ok((await page.textContent('.kicker')).includes('Stufe 2'), 'Stufe 1 bestanden: ' + await page.textContent('.kicker'));
for (let i = 0; i < 5; i++) { const r = await readRight(); await page.click(`.ans:text-is("${r.letter}")`); await wait(60); }
for (let i = 0; i < 3; i++) { const r = await readRight(); await page.evaluate(m => __nb.calib.onNote(m), r.midi + (i < 2 ? 2 : 0)); await wait(850); }      // Klavier-Teil nicht bestanden
await wait(200); let p = await page.evaluate(() => __nb.profile); ok(JSON.stringify(p.skip) === '[6,0,0,0]', 'nur Stufe 1 zählt, weil Stufe 2 am Klavier nicht klappte: ' + JSON.stringify(p.skip));
ok(!(await page.evaluate(() => __nb.calib)), 'Test beendet'); await page.screenshot({ path: 'shots/n2-einstufung-ergebnis.png' }); await act('ok'); await wait(150); if (await page.$('.story')) { await act('next'); await act('next'); } await wait(150);
await page.evaluate(() => { __nb.audio.micState = 'off'; __nb.profile.keys = true; __nb.profile.unlockAll = true; __nb.profile.seenWorld = { 0: 1, 1: 1, 2: 1, 3: 1 }; __nb.profile.goal = 5; const d = new Date(), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; __nb.profile.days[k] = 295; __screens.map(__nb, 3); });
await wait(200); await page.screenshot({ path: 'shots/n3-karte-bruecke.png' }); ok((await page.textContent('.pill.goal')).includes('4/5'), 'Tagesziel-Anzeige: ' + await page.textContent('.pill.goal'));
// --- Große Brücke: Springen (zwei Hände) + Tagesziel
await page.click('[data-id="b1"]'); await act('go'); await wait(900); await page.screenshot({ path: 'shots/n4-zwei-haende.png' });
for (let i = 0; i < 4; i++) { await page.evaluate(`__nb.keyTap(${midiJs})`); await wait(650); } await page.screenshot({ path: 'shots/n5-zwei-haende-2.png' });
await page.evaluate(() => { __nb.sec = 8; __nb.flush(); }); await wait(100); ok((await page.textContent('#toast')).includes('Tagesziel'), 'Tagesziel-Meldung'); await playJump(); await wait(300);
p = await page.evaluate(() => __nb.profile); ok(p.levels.b1 && p.levels.b1.stars === 3, 'b1 geschafft: ' + JSON.stringify(p.levels.b1));
// --- Notenregen und Brückenbauer im großen System
await act('next'); await act('go'); await wait(2600); await page.screenshot({ path: 'shots/n6-regen-gross.png' });
for (let i = 0; i < 8; i++) { const l = await page.evaluate(() => 'cdefgah'[((__nb.scene.active.n.step % 7) + 7) % 7]); await page.click(`.ans:text-is("${l}")`); await wait(80); }
ok(await page.evaluate(() => __nb.scene.correct) === 8, 'Notenregen groß zählt'); await page.evaluate(() => { __nb.scene.left = 0.1; }); await wait(600); await act('map'); await wait(100);
await page.click('[data-id="b4"]'); await act('go'); await wait(300);
for (let g = 0; g < 60 && await page.evaluate(() => document.getElementById('screen').hidden); g++) { await page.evaluate(() => { const s = __nb.scene; if (s.locked) return; const tk = s.tasks[s.ti]; if (tk.word) { let pos = 'cdefgah'.indexOf(tk.word[s.slot].toLowerCase()) + 4; while (pos < s.minPos) pos += 7; while (pos > s.maxPos) pos -= 7; s.pos = pos; } else s.pos = tk.notes[0].step + 4; s.place(); }); if (g === 2) await page.screenshot({ path: 'shots/n7-bau-gross.png' }); await wait(160); }
p = await page.evaluate(() => __nb.profile); ok(p.levels.b4 && p.levels.b4.stars === 3, 'b4 geschafft: ' + JSON.stringify(p.levels.b4));
await act('map'); await wait(100); await page.click('[data-id="b5"]'); await wait(100); await act('book'); await wait(100); await page.screenshot({ path: 'shots/n8-rueckblick.png' });
ok((await page.textContent('.book')).includes('Wächter der großen Brücke'), 'Rückblick bis zu diesem Level'); await act('back'); await act('go'); await wait(300); await playJump(); await wait(300);
p = await page.evaluate(() => __nb.profile); ok(p.levels.b5, 'Melodie für zwei Hände geschafft');
// --- QR-Code und Link: alles mitnehmen
await act('map'); await wait(100); await page.click('[data-act="set"]'); await wait(100); await page.click('[data-act="exp"]'); await wait(500); await page.screenshot({ path: 'shots/n9-qr.png' });
const link = await page.inputValue('#codeOut'); ok(link.includes('#s=Z'), 'Link erzeugt: ' + link.length + ' Zeichen'); ok(await page.$('#qrHere canvas'), 'QR-Code gezeichnet');
const before = await page.evaluate(() => JSON.stringify(__nb.profile)); await page.evaluate(() => localStorage.clear());
await page.goto('about:blank'); await page.goto(FREE + link.slice(link.indexOf('#'))); await wait(700); await page.screenshot({ path: 'shots/n10-laden.png' }); await act('ok'); await wait(200);
ok(await page.evaluate(() => JSON.stringify(__nb.profile)) === before, 'Spielstand per Link vollständig übernommen'); ok(await page.evaluate(() => location.hash === ''), 'Adress-Anhang entfernt');
// --- Kauf-Fassung: gleiche Spielstände, Schranke ab Level 6, Schlüssel schaltet frei
await page.evaluate(() => { __nb.profile.unlockAll = false; __nb.save(); }); await page.goto(SHOP); await wait(500); await act('go'); await page.click('.pcard'); await wait(200);
ok(await page.evaluate(() => __config.shop && __nb.profile.name === 'Lena'), 'Kauf-Fassung nutzt denselben Spielstand'); await page.screenshot({ path: 'shots/n11-kauf-karte.png' });
await page.click('[data-id="h2"]'); ok(!(await page.$('.offers')), 'h2 ist frei'); await act('back'); await page.click('[data-id="h6"]'); await wait(100); ok(await page.$('.offers'), 'h6 zeigt die Kaufseite'); await page.screenshot({ path: 'shots/n12-kaufseite.png' });
await page.fill('#keyIn', 'NBKfalsch'); await act('key'); await wait(200); ok((await page.textContent('#kerr')).length > 5, 'falscher Schlüssel abgelehnt');
const expired = await signKey(priv, { type: 'abo', until: new Date(2026, 5, 1), serial: 2 }); await page.fill('#keyIn', expired); await act('key'); await wait(300); ok((await page.textContent('#kerr')).includes('abgelaufen'), 'abgelaufenes Abo abgelehnt');
const key = await signKey(priv, { type: 'einmal', until: null, serial: 1 }); await page.fill('#keyIn', key); await act('key'); await wait(400); ok(await page.evaluate(() => __nb.licensed), 'Schlüssel schaltet frei'); await act('ok'); await wait(100);
await page.click('[data-id="h6"]'); ok(!(await page.$('.offers')), 'h6 jetzt spielbar'); await page.reload(); await wait(600); ok(await page.evaluate(() => __nb.licensed), 'Freischaltung bleibt nach Neuladen');
await page.evaluate(() => { delete __nb.state.licenseKey; __nb.save(); }); const abo = await signKey(priv, { type: 'abo', until: new Date(2027, 11, 31), serial: 3 });
await page.goto('about:blank'); await page.goto(SHOP + '#k=' + abo); await wait(800); await page.screenshot({ path: 'shots/n13-freigeschaltet.png' }); ok(await page.evaluate(() => __nb.licensed && __nb.license.type === 'abo'), 'Freischalt-Link (Abo) funktioniert');
await page.goto(FREE); await wait(500); await act('go'); await page.click('.pcard'); await wait(150); await page.click('[data-id="h6"]'); ok(!(await page.$('.offers')), 'Test-Fassung hat keine Schranke');
console.log(errors.length ? errors.join('\n') : 'NEUE TEILE OK'); await browser.close(); process.exit(errors.length ? 1 : 0);
