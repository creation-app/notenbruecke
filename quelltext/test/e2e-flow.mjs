// Normaler Spielverlauf ohne Abkürzungen: Freischalten Level für Level, Profi-Spielart, Pause, Welt 2 öffnet sich, Finale.
import { chromium } from 'playwright'; import path from 'node:path'; const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } }); page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const act = async a => { await page.click(`#screen [data-act="${a}"]`); await page.waitForTimeout(60); while (await page.$('#screen:not([hidden]) .petcard')) { await page.click('#screen .petcard [data-act="ok"]'); await page.waitForTimeout(60); } }; /* Tier-Karten prüft e2e-pegasus */ const wait = ms => page.waitForTimeout(ms); const ok = (c, m) => { if (!c) { errors.push('ASSERT: ' + m); console.log('FEHLER', m); } };
const midi = () => page.evaluate(() => { const t = __nb.scene.target; return 60 + Math.floor(t.step / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][((t.step % 7) + 7) % 7] + t.alt; });
const shown = () => page.evaluate(() => !document.getElementById('screen').hidden);
async function play(type) {
  if (type === 'jump' || type === 'boss') { for (let g = 0; g < 400 && !(await shown()); g++) { if (await page.evaluate(() => __nb.scene.phase === 'listen')) await page.evaluate(m => __nb.keyTap(m), await midi()); await wait(120); } }
  else if (type === 'regen') { for (let i = 0; i < 22; i++) { const l = await page.evaluate(() => { const n = __nb.scene.active.n, L = 'cdefgah'[((n.step % 7) + 7) % 7]; return n.alt > 0 ? L + 'is' : n.alt < 0 ? (L === 'h' ? 'b' : L === 'e' || L === 'a' ? L + 's' : L + 'es') : L; }); await page.click(`.ans:text-is("${l}")`); await wait(60); }
    await page.evaluate(() => { __nb.scene.left = 0.1; }); await wait(500); }
  else { for (let g = 0; g < 60 && !(await shown()); g++) { await page.evaluate(() => { const s = __nb.scene; if (s.locked) return; const tk = s.tasks[s.ti]; if (tk.word) { let st = 'cdefgah'.indexOf(tk.word[s.slot].toLowerCase()); let pos = st - (s.clef === 'bass' ? -10 : 2); while (pos < s.minPos) pos += 7; while (pos > s.maxPos) pos -= 7; s.pos = pos; s.setAcc(0); } else { s.pos = tk.notes[0].step - (s.clef === 'bass' ? -10 : 2); s.setAcc(tk.notes[0].alt); } s.place(); }); await wait(150); } }
}
await page.goto('file://' + path.resolve('dist/notenbruecke.html')); await wait(500); await page.screenshot({ path: 'shots/f1-ipad-titel.png' }); await act('go'); await page.fill('#pname', 'Profi'); await page.click('[data-m="profi"]'); await act('ok');
for (let i = 0; i < 4; i++) await act('next'); await act('new'); await act('next'); await act('next'); await wait(100);
await page.evaluate(() => { __nb.profile.keys = true; });
ok(await page.$eval('[data-id="h2"]', e => e.disabled), 'h2 anfangs gesperrt'); ok(await page.$eval('[data-w="1"]', e => e.disabled), 'Welt 2 anfangs gesperrt');
const ids = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'];
await page.click('[data-id="h1"]');
for (let i = 0; i < ids.length; i++) { const L = await page.evaluate(id => { const l = __levels.find(x => x.id === id); return { type: l.type }; }, ids[i]); await act('go'); await wait(300);
  if (i === 0) { await page.click('#pauseBtn'); await wait(100); ok(await page.evaluate(() => __nb.paused), 'Pause aktiv'); await page.screenshot({ path: 'shots/f2-pause.png' }); await act('go'); ok(!(await page.evaluate(() => __nb.paused)), 'Pause beendet'); }
  if (i === 5) { await wait(900); await page.screenshot({ path: 'shots/f3-profi.png' }); }
  await play(L.type); await wait(400); const rec = await page.evaluate(id => __nb.profile.levels[id], ids[i]); ok(rec && rec.stars >= (L.type === "regen" ? 2 : 3), `${ids[i]} mit 3 Sternen: ${JSON.stringify(rec)}`);
  if (i === 7) await page.screenshot({ path: 'shots/f4-boss-ergebnis.png' }); if (i < ids.length - 1) await act('next'); }
await act('map'); await wait(200); ok(!(await page.$eval('[data-w="1"]', e => e.disabled)), 'Welt 2 nach 8 Leveln offen'); await page.click('[data-w="1"]'); await wait(200); await page.screenshot({ path: 'shots/f5-welt2-intro.png' });
ok(await page.$('.story'), 'Welt-2-Geschichte erscheint'); await act('next'); await act('next'); await wait(100); ok(!(await page.$eval('[data-id="t1"]', e => e.disabled)), 't1 offen');
const pr = await page.evaluate(() => __nb.profile); ok(Object.values(pr.days)[0] > 5, 'Übungszeit gezählt: ' + JSON.stringify(pr.days)); ok(pr.levels.h1.time > 0, 'Bestzeit gespeichert'); ok(pr.creatures.length >= 7, 'Notenwesen: ' + pr.creatures.length);
// Finale
await page.evaluate(() => { const p = __nb.profile; __levels.forEach(l => { if (l.id !== 'z7') p.levels[l.id] = { stars: 1 }; }); p.pets = ['pegasus', 'schnecke', 'krake', 'eule', 'drache', 'phoenix']; /* Tier-Karten prüft e2e-pegasus */ p.seenWorld = { 0: 1, 1: 1, 2: 1 }; p.levels.z7 = undefined; delete p.levels.z7; __screens.map(__nb, 2); }); await wait(200);
await page.click('[data-id="z7"]'); await act('go'); await wait(300); await page.evaluate(() => { const s = __nb.scene; s.idx = s.targets.length - 2; s.hero.x = s.plats[s.idx].x; s.hero.y = 100 - s.plats[s.idx].pos * 5; }); await wait(700); await page.screenshot({ path: 'shots/f6-waechter.png' });
await play('boss'); await wait(400); await act('next'); await wait(200); ok(await page.$('.story'), 'Finale erscheint'); await page.screenshot({ path: 'shots/f7-finale.png' }); await act('next'); await act('next'); await act('next'); await wait(200); if (await page.$('.story')) { await act('next'); await act('next'); await wait(200); } ok(await page.$('.nodes'), 'zurück auf der Karte');
// Handy quer
await page.setViewportSize({ width: 844, height: 390 }); await wait(200); await page.screenshot({ path: 'shots/f8-handy.png' });
console.log(errors.length ? errors.join('\n') : 'ABLAUF OK'); await browser.close(); process.exit(errors.length ? 1 : 0);
