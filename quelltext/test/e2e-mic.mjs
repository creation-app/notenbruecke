// Echter Mikrofon-Weg: Chrome spielt eine Klavier-ähnliche Aufnahme als Mikrofon ein. Prüft Einstimmen + ein ganzes Sprung-Level.
import { chromium } from 'playwright'; import path from 'node:path'; import { piano, writeWav } from './wav.mjs';
const a4 = +(process.argv[2] || 440), shift = 12 * Math.log2(a4 / 440); const sil = new Float32Array(48000 * 0.35);
const seq = (process.argv[3] || '60,60,60,67,60,67,67,60').split(',').map(Number); const wav = path.resolve('shots/mic.wav');
writeWav(wav, seq.flatMap(m => [piano(m + shift, 0.9), sil])); const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const act = async a => { await page.click(`#screen [data-act="${a}"]`); await page.waitForTimeout(60); while (await page.$('#screen:not([hidden]) .petcard')) { await page.click('#screen .petcard [data-act="ok"]'); await page.waitForTimeout(60); } }; /* Tier-Karten prüft e2e-pegasus */ const wait = ms => page.waitForTimeout(ms);
await page.goto('file://' + path.resolve('dist/notenbruecke.html')); await wait(500); await act('go'); await page.fill('#pname', 'Mikro'); if (process.argv[4] === 'profi') await page.click('[data-m="profi"]'); await act('ok'); await act('skip'); await act('new'); await act('skip'); await wait(100);
await page.click('[data-id="h1"]'); await act('go'); await wait(1200); await page.screenshot({ path: 'shots/mic-1-einstimmen.png' });
await page.waitForFunction(() => __nb.profile.calibrated, null, { timeout: 30000 }).catch(() => errors.push('Einstimmen nicht abgeschlossen'));
const got = await page.evaluate(() => __nb.profile.a4); if (Math.abs(got - a4) > 1.5) errors.push(`Kammerton ${got} statt ${a4}`);
await wait(2500); await page.screenshot({ path: 'shots/mic-2-level.png' });
await page.waitForFunction(() => !!__nb.profile.levels.h1, null, { timeout: 90000 }).catch(() => errors.push('Level nicht geschafft'));
const p = await page.evaluate(() => __nb.profile); await page.screenshot({ path: 'shots/mic-3-ergebnis.png' });
const odd = Object.keys(p.conf).filter(k => !['c1>g1', 'g1>c1'].includes(k)); if (odd.length) errors.push('Fehlerkennung: ' + JSON.stringify(p.conf));
console.log(`a4=${got.toFixed(1)} Sterne=${p.levels.h1 && p.levels.h1.stars} Zeit=${p.levels.h1 && p.levels.h1.time}s Verwechslungen=${JSON.stringify(p.conf)} Notenwesen=${p.creatures}`);
console.log(errors.length ? errors.join('\n') : 'MIKROFON-TEST OK'); await browser.close(); process.exit(errors.length ? 1 : 0);
