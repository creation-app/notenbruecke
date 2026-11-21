// Geräte-Profile (Touch, Größe, Ausrichtung) in Chromium nachgestellt: Start, Profil, Level 1 mit Bildschirm-Tasten, Notenregen, Brückenbauer per Fingertipp.
// Achtung: Das ist Chromium mit Geräte-Maßen, NICHT Safari. Es prüft Layout, Touch und Drehung, nicht das iOS-Mikrofon.
import { chromium, devices } from 'playwright'; import path from 'node:path'; const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const list = ['iPad (gen 7) landscape', 'iPad (gen 7)', 'iPad Mini', 'iPad Pro 11 landscape', 'iPhone 15 landscape', 'iPhone 15', 'iPhone SE', 'Pixel 7 landscape', 'Pixel 7', 'Galaxy S9+'];
for (const name of list) {
  const d = devices[name]; const ctx = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.deviceScaleFactor, isMobile: true, hasTouch: true, userAgent: d.userAgent }); const page = await ctx.newPage(); const err = m => { errors.push(name + ': ' + m); console.log('FEHLER', name, m); };
  page.on('pageerror', e => err('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') err('console ' + m.text()); });
  const tap = a => page.tap(`#screen [data-act="${a}"]`); const wait = ms => page.waitForTimeout(ms); const shown = () => page.evaluate(() => !document.getElementById('screen').hidden);
  await page.goto('file://' + path.resolve('dist/notenbruecke.html')); await wait(400);
  const portrait = d.viewport.width < d.viewport.height; if (await page.evaluate(() => !!__nb.rot) !== portrait) err('Drehung falsch erkannt');
  // Die Bühne füllt den Bildschirm und ragt nirgends hinaus
  const r = await page.evaluate(() => { const b = document.getElementById('stage').getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: innerWidth, h: innerHeight }; });
  if (r.l < -1 || r.t < -1 || r.r > r.w + 1 || r.b > r.h + 1) err('Bühne ragt hinaus ' + JSON.stringify(r)); if ((r.r - r.l) < r.w * 0.98 && (r.b - r.t) < r.h * 0.98) err('Bühne füllt nicht ' + JSON.stringify(r));
  await tap('go'); await page.fill('#pname', 'Geri'); await tap('ok'); for (let i = 0; i < 4; i++) await tap('next'); await tap('new'); await tap('next'); await tap('next'); await wait(150);
  await page.evaluate(() => { __nb.profile.keys = true; __nb.profile.unlockAll = true; __screens.map(__nb, 0); }); await wait(150);
  if (name === 'iPhone 15' || name === 'iPad (gen 7)') await page.screenshot({ path: `shots/g-${name.replace(/\W+/g, '')}-karte.png` });
  // Kleinste Tippfläche auf der Karte (in echten Bildschirm-Pixeln)
  const small = await page.evaluate(() => Math.min(...[...document.querySelectorAll('#screen button:not([disabled])')].map(b => { const q = b.getBoundingClientRect(); return Math.min(q.width, q.height); }))); console.log(name.padEnd(24), 'kleinste Tippfläche Karte:', small.toFixed(0), 'px');
  // Level 1: echte Fingertipps auf die Bildschirm-Tasten
  await page.tap('[data-id="h1"]'); await tap('go'); await wait(400);
  for (let g = 0; g < 300 && !(await shown()); g++) { if (await page.evaluate(() => __nb.scene.phase === 'listen')) { const m = await page.evaluate(() => { const t = __nb.scene.target; return 60 + Math.floor(t.step / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][((t.step % 7) + 7) % 7] + t.alt; }); const key = await page.$(`#panel [data-midi="${m}"]`); if (key) await key.tap(); else await page.evaluate(x => __nb.keyTap(x), m); } await wait(120); }
  const rec = await page.evaluate(() => __nb.profile.levels.h1); if (!rec || rec.stars < 1) err('Level 1 nicht geschafft: ' + JSON.stringify(rec));
  if (name === 'iPhone 15') await page.screenshot({ path: 'shots/g-iPhone15-ergebnis.png' });
  // Brückenbauer: Fingertipp auf die Notenlinien muss an der richtigen Stelle ankommen (auch gedreht)
  await tap('map'); await wait(150); await page.tap('[data-id="h5"]'); await tap('go'); await wait(500);
  const probe = await page.evaluate(() => { const s = __nb.scene; const got = []; const orig = s.pointer.bind(s); s.pointer = (x, y) => { got.push([x, y]); orig(x, y); }; window.__got = got; const b = __nb.world.getBoundingClientRect(); const fx = 0.5, fy = 0.3; return __nb.rot ? { x: b.left + (1 - fy) * b.width, y: b.top + fx * b.height } : { x: b.left + fx * b.width, y: b.top + fy * b.height }; });
  await page.touchscreen.tap(probe.x, probe.y); await wait(100); const got = await page.evaluate(() => window.__got[0]); const want = await page.evaluate(() => [__nb.W / 4 * 0.5, __nb.H / 4 * 0.3]);
  if (!got || Math.abs(got[0] - want[0]) > 3 || Math.abs(got[1] - want[1]) > 3) err('Fingertipp landet falsch: ' + JSON.stringify(got));
  if (name === 'iPhone 15') await page.screenshot({ path: 'shots/g-iPhone15-bau.png' });
  await ctx.close();
}
await browser.close(); console.log(errors.length ? errors.length + ' FEHLER' : 'GERAETE OK (' + list.length + ' Profile)'); process.exit(errors.length ? 1 : 0);
