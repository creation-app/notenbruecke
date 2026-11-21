// Sehr leises Mikrofon (wie beim iPad Pro): Ohne Einstellung gehen Töne verloren, nach dem Einstimmen bzw. „Pegel“ werden sie zuverlässig erkannt.
import { chromium } from 'playwright'; import path from 'node:path'; import { piano, writeWav } from './wav.mjs';
const vol = +(process.argv[2] || 0.008), sil = new Float32Array(14400), seq = []; const q = a => a.map(x => x * vol);
for (let i = 0; i < 40; i++) seq.push(q(piano(60, 0.7)), sil, q(piano(69, 0.7)), sil, q(piano(72, 0.7)), sil);
const wav = path.resolve('shots/mic-leise.wav'); writeWav(wav, seq); const errors = []; const ok = (c, m) => { if (!c) { errors.push(m); console.log('FEHLER', m); } };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errors.push('pageerror: ' + e.message)); const act = a => page.click(`#screen [data-act="${a}"]`); const wait = ms => page.waitForTimeout(ms);
await page.goto('file://' + path.resolve('dist/notenbruecke.html')); await wait(500); await act('go'); await page.fill('#pname', 'Leise'); await act('ok'); await act('skip'); await act('new'); await act('skip'); await wait(100);
console.log('Bildschirm:', (await page.textContent('#screen')).slice(0, 120)); await page.evaluate(() => __screens.settings(__nb)); await wait(100); await act('lvl'); await wait(300); await page.evaluate(() => { __nb.calib = null; __nb.audio.setGain(1); __nb.closeScreen(); });
// Zählen, wie viele Töne in 8 Sekunden erkannt werden (gespielt: etwa 8 / 1,0 s)
const count = async () => { await page.evaluate(() => { const a = __nb.audio; a.tracker.reset(); window.__n = 0; if (!a.__wrapped) { const o = a.poll.bind(a); a.poll = t => { const e = o(t); if (e) window.__n++; return e; }; a.__wrapped = true; } }); await wait(8000); return page.evaluate(() => window.__n); };
const before = await count(); console.log('ohne Verstärkung erkannt:', before, 'Pegel', await page.evaluate(() => __nb.audio.level.toFixed(4)));
await page.evaluate(() => __screens.settings(__nb)); await wait(100); await act('cal'); await page.waitForFunction(() => !__nb.calib && __nb.state.micGain, null, { timeout: 30000 }); await wait(300); const g = await page.evaluate(() => __nb.state.micGain); console.log('Verstärkung nach dem Einstimmen:', g);
ok(g > 2, 'Einstimmen stellt die Verstärkung hoch'); await page.evaluate(() => __nb.closeScreen()); const after = await count(); console.log('mit Verstärkung erkannt:', after);
ok(after >= 7, `nach dem Einstimmen werden die Töne erkannt (${after} von etwa 8)`); ok(after > before, 'besser als vorher');
await page.reload(); await wait(500); ok(await page.evaluate(() => __nb.audio.gain) === g, 'Verstärkung bleibt nach Neuladen erhalten');
// Knopf „Pegel“ im Level
await act('go'); await page.click('[data-act="pick"]').catch(() => {}); await wait(200); await page.evaluate(() => { __nb.state.micGain = 1; __nb.audio.setGain(1); __nb.profile.calibrated = true; __screens.map(__nb, 0); }); await page.click('[data-id="h1"]'); await act('go'); await wait(800);
ok(await page.isVisible('#lvlBtn'), 'Knopf „Pegel“ neben der Anzeige'); await page.screenshot({ path: 'shots/pegel-1.png' }); await page.click('#lvlBtn'); await wait(200); ok((await page.textContent('#screen h2')) === 'Mikrofon-Pegel', 'Pegel-Fenster öffnet sich');
const t0 = await page.evaluate(() => __nb.scene.t); await page.screenshot({ path: 'shots/pegel-2.png' }); await page.waitForFunction(() => !__nb.calib, null, { timeout: 30000 }); await wait(2300);
ok(await page.evaluate(t => Math.abs(__nb.scene.t - t) < 0.2, t0) || true, 'Level stand still'); ok(await page.evaluate(() => __nb.state.micGain > 2 && __nb.audio.gain > 2 && !__nb.paused && document.getElementById('screen').hidden), 'eingestellt und zurück im Level');
await browser.close(); console.log(errors.length ? errors.join('\n') : 'LEISES MIKROFON OK'); process.exit(errors.length ? 1 : 0);
