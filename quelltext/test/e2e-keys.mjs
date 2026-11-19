// Durchlauf im echten Browser: Profil anlegen, Geschichte, alle drei Spielarten, Übersichten. Eingabe über Test-Zugriff auf die Szene.
import { chromium } from 'playwright'; import path from 'node:path';
const url = 'file://' + path.resolve('dist/notenbruecke.html'); const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = n => page.screenshot({ path: `shots/${n}.png` }); const act = a => page.click(`#screen [data-act="${a}"]`); const wait = ms => page.waitForTimeout(ms);
const assert = (c, m) => { if (!c) { errors.push('ASSERT: ' + m); console.log('FEHLER', m); } };
await page.goto(url); await wait(600); await shot('01-titel'); await act('go');
await page.fill('#pname', 'Mika'); await page.click('[data-act="hero"][data-i="2"]'); await shot('02-profil'); await act('ok'); await wait(200); await shot('03-geschichte');
for (let i = 0; i < 4; i++) await act('next'); await act('new'); await wait(200); await shot('04-weltintro'); await act('next'); await act('next'); await wait(200); await shot('05-karte');
await page.evaluate(() => { __nb.profile.keys = true; __nb.profile.calibrated = true; });
// Level 1: Springen
await page.click('[data-id="h1"]'); await wait(100); await shot('06-levelkarte'); await act('go'); await wait(400); await shot('07-springen-start');
const playJump = async (mistakes) => { for (let guard = 0; guard < 200; guard++) { const st = await page.evaluate(() => { const s = __nb.scene; return { phase: s.phase, idx: s.idx, n: s.targets ? s.targets.length : 0, done: !document.getElementById('screen').hidden }; });
    if (st.done) return; if (st.phase === 'listen') { const m = await page.evaluate(() => { const s = __nb.scene; const t = s.target; return 60 + Math.floor(t.step / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][((t.step % 7) + 7) % 7] + t.alt; });
      if (mistakes && st.idx === 2 && guard < 60) { await page.click(`.kb button[aria-label="Taste ${m === 60 ? 'd1' : 'c1'}"]`).catch(() => {}); await wait(250); if (st.idx === 2 && mistakes === 2) { await shot('08-springen-falsch'); mistakes = 1; }
        await page.evaluate((mm) => __nb.scene.onNote(mm + 12), m); await wait(300); await shot('09-springen-oktave'); mistakes = 0; }
      await page.evaluate((mm) => __nb.keyTap(mm), m); } await wait(180); } };
await playJump(2); await wait(300); await shot('10-ergebnis');
let p = await page.evaluate(() => __nb.profile); assert(p.levels.h1 && p.levels.h1.stars >= 1, 'h1 gespeichert'); assert(p.creatures.includes('c1') && p.creatures.includes('g1'), 'Notenwesen befreit'); assert(Object.keys(p.conf).length >= 1, 'Verwechslung notiert');
await act('next'); await wait(100); await act('go'); await wait(300); await playJump(0); await wait(200);
p = await page.evaluate(() => __nb.profile); assert(p.levels.h2 && p.levels.h2.stars === 3, 'h2 fehlerfrei = 3 Sterne, ist ' + JSON.stringify(p.levels.h2));
// Level 3: Notenregen
await act('next'); await wait(100); await act('go'); await wait(2500); await shot('11-notenregen');
for (let i = 0; i < 12; i++) { const l = await page.evaluate(() => { const a = __nb.scene.active, n = a.n; const L = 'cdefgah'[((n.step % 7) + 7) % 7]; return L; }); if (i === 3) { await page.click(`.ans:not(:text-is("${l}"))`); await wait(100); } await page.click(`.ans:text-is("${l}")`); await wait(150); }
await shot('12-notenregen-punkte'); const sc = await page.evaluate(() => __nb.scene.score); assert(sc > 100, 'Notenregen zählt Punkte: ' + sc);
await page.evaluate(() => { __nb.scene.speed = 300; }); await wait(1800); await shot('13-notenregen-verpasst'); await page.evaluate(() => { __nb.scene.left = 0.2; }); await wait(700); await shot('14-notenregen-ergebnis');
p = await page.evaluate(() => __nb.profile); assert(p.levels.h3 && p.regenBest > 0, 'Notenregen gespeichert');
// Level 4 überspringen (Lehrer-Schalter), Level 5: Brückenbauer
await page.evaluate(() => { __nb.profile.unlockAll = true; }); await act('map'); await wait(100); await page.click('[data-id="h5"]'); await act('go'); await wait(300);
for (let t = 0; t < 8; t++) { const info = await page.evaluate(() => { const s = __nb.scene, tk = s.tasks[s.ti]; return { word: tk.word, pos: tk.word ? null : tk.notes[0].step - 2, n: s.n }; });
  if (t === 0) { await page.click('[aria-label="Note höher"]'); await page.click('[aria-label="Note höher"]'); await page.evaluate((i) => { if (__nb.scene.pos === i.pos) __nb.scene.move(1); }, info); await page.click('[aria-label="Note setzen"]'); await wait(200); await shot('15-bau-falsch'); }
  if (info.word) { for (const ch of info.word) { await page.evaluate((c) => { __nb.scene.pos = 'CDEFGAH'.indexOf(c) - 2 + (('CDEFGAH'.indexOf(c) - 2) < -2 ? 7 : 0); }, ch); await wait(60); await page.click('[aria-label="Note setzen"]'); await wait(120); } await shot('16-bau-wort'); }
  else { await page.evaluate((i) => { __nb.scene.pos = i.pos; }, info); await wait(60); if (t === 1) await shot('17-bau'); await page.click('[aria-label="Note setzen"]'); }
  await wait(1100); }
await wait(300); await shot('18-bau-ergebnis'); p = await page.evaluate(() => __nb.profile); assert(p.levels.h5 && p.levels.h5.stars >= 2, 'Brückenbauer gespeichert ' + JSON.stringify(p.levels.h5));
// Boss, Bass, Vorzeichen
for (const [id, name] of [['h8', '19-boss'], ['t2', '20-bass'], ['z3', '21-vorzeichen'], ['t11', '22-bass-tief'], ['h14', '23-hoch']]) { await act('map'); await wait(150); await page.evaluate(() => { __nb.profile.seenWorld = { 0: 1, 1: 1, 2: 1 }; });
  await page.evaluate((i) => { const lv = window.__levels.find(l => l.id === i); __nb.runLevel(lv); }, id); await wait(700);
  for (let k = 0; k < 3; k++) { const m = await page.evaluate(() => { const t = __nb.scene.target; return 60 + Math.floor(t.step / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][((t.step % 7) + 7) % 7] + t.alt; }); await page.evaluate((mm) => __nb.keyTap(mm), m); await wait(650); }
  await shot(name); await page.evaluate(() => { const s = __nb.scene; s.idx = s.targets.length - 1; s.hero.x = s.plats[s.idx].x; }); await wait(100);
  const m = await page.evaluate(() => { const t = __nb.scene.target; return 60 + Math.floor(t.step / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][((t.step % 7) + 7) % 7] + t.alt; }); await page.evaluate((mm) => __nb.keyTap(mm), m); await wait(2200); }
await shot('24-weltende'); await act('map'); await wait(200);
await page.evaluate(() => window.__screens.map(__nb, 1)); await wait(200); await shot('25-karte-tiefe');
await page.click('[data-act="coll"]'); await wait(150); await page.click('[data-act="cr"]:not([disabled])'); await wait(150); await shot('26-sammlung'); await act('back');
await page.evaluate(() => { const p = __nb.profile, d = new Date(); for (let i = 1; i < 9; i++) { const x = new Date(d); x.setDate(d.getDate() - i); if (i !== 5) p.days[`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`] = 200 * i; } p.conf['e1>g1'] = 4; });
await page.click('[data-act="pass"]'); await wait(150); await shot('27-uebungspass'); await act('back'); await page.click('[data-act="board"]'); await wait(100); await shot('28-bestenliste'); await act('back');
await page.click('[data-act="set"]'); await wait(100); await shot('29-einstellungen'); await page.click('[data-act="exp"]'); await wait(400);
const code = await page.inputValue('#codeOut'); assert(code.includes('#s='), 'Link erzeugt');
// Neu laden: Spielstand bleibt
await page.reload(); await wait(600); await act('go'); await wait(100); await shot('30-profile'); const names = await page.$$eval('.pcard b', e => e.map(x => x.textContent)); assert(names.includes('Mika'), 'Profil nach Neuladen da');
// Code auf "anderem Gerät"
await page.evaluate(() => localStorage.clear()); await page.reload(); await wait(500); await act('go'); await page.fill('#pname', 'X'); await act('ok'); await act('skip'); await act('new'); await act('skip'); await wait(100); await page.click('[data-act="prof"]'); await act('code'); await page.fill('#codeIn', code); await act('ok'); await wait(200);
p = await page.evaluate(() => __nb.profile); assert(p.name === 'Mika' && p.levels.h5, 'Spielstand per Code übertragen'); await shot('31-nach-code');
console.log(errors.length ? errors.join('\n') : 'E2E OK'); await browser.close(); process.exit(errors.length ? 1 : 0);
