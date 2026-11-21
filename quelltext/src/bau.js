// Spielart "Brückenbauer": Noten selbst ins System schreiben (einzeln oder als Wort aus Notennamen).
import { stemUp, N, note, midiOf, staffPos, nameHtml, nameStr, letterIdx, LETTERS, CLEFS, describePos, ledgerPositions } from './music.js';
import { pickNext, update as srsUpdate, newStat, SLOW_WRITE_MS } from './srs.js';
import * as G from './gfx.js';
import { label, noteLabel } from './text.js';

export class BauScene {
  constructor(app, level) { this.app = app; this.level = level; this.isLevel = true; }
  enter() {
    const { app, level } = this; this.clef = level.clef; this.theme = level.theme; this.bg = app.background(level.theme); this.line = G.THEMES[level.theme].line;
    const ps = level.notes.map(k => staffPos(N(k), this.clef)); const g = this.clef === 'grand'; this.minPos = Math.max(g ? -8 : -4, Math.min(...ps) - 2); this.maxPos = Math.min(g ? 16 : 12, Math.max(...ps) + 2);
    this.tasks = this.buildTasks(); this.ti = 0; this.firstTry = 0; this.t = 0; this.parts = new G.Particles(); this.freed = [];
    app.panel.showMic(false); app.panel.bau(!!level.accidentals, { move: d => this.move(d), acc: a => this.setAcc(this.alt === a ? 0 : a), place: () => this.place() });
    app.hud.show(level.title, true); this.startTask();
  }
  buildTasks() {
    const { level } = this, stats = this.app.profile.notes, out = []; let last = null; const words = (level.words || []).slice().sort(() => Math.random() - 0.5).slice(0, 3);
    const singles = 8 - words.length; for (let i = 0; i < singles; i++) { last = pickNext(level.notes, stats, Math.random, last); out.push({ notes: [N(last)], word: null }); }
    words.forEach((w, i) => out.splice(2 + i * 2, 0, { word: w, notes: null }));
    return out;
  }
  startTask() {
    const tk = this.tasks[this.ti], { app } = this; this.slot = 0; this.placed = []; this.pos = Math.max(this.minPos, Math.min(this.maxPos, 4)); this.alt = 0; this.tries = 0; this.t0 = performance.now(); this.taskClean = true; this.wrongT = 0; this.msg = null; app.panel.setAcc(0);
    this.n = tk.word ? tk.word.length : 1; this.xs = Array.from({ length: this.n }, (_, i) => 176 + (i - (this.n - 1) / 2) * 40);
    app.hud.progress(this.ti, this.tasks.length);
    app.bubble(tk.word ? `Schreibe das Wort <b>${tk.word}</b> – Note für Note.` : `Setze die Note <b>${nameHtml(tk.notes[0])}</b> ins System.`, 0);
  }
  move(d) { this.pos = Math.max(this.minPos, Math.min(this.maxPos, this.pos + d)); this.msg = null; }
  setAcc(a) { this.alt = a; this.app.panel.setAcc(a); }
  pointer(wx, wy) { if (wy < 18 || this.locked) return; this.pos = Math.max(this.minPos, Math.min(this.maxPos, Math.round((G.STAFF_BOTTOM - wy) / G.STEP_PX))); this.msg = null; }
  place() {
    if (this.locked) return; const { app } = this, p = app.profile, tk = this.tasks[this.ti];
    const cand = note(this.pos + CLEFS[this.clef].bottom, this.alt); app.audio.playNote(midiOf(cand));
    const ok = tk.word ? (LETTERS[letterIdx(cand)] === tk.word[this.slot].toLowerCase() && !cand.alt) : (cand.step === tk.notes[0].step && cand.alt === tk.notes[0].alt);
    if (ok) {
      p.notes[cand.key] = srsUpdate(p.notes[cand.key] || newStat(), this.tries === 0, performance.now() - this.t0 > SLOW_WRITE_MS);
      if (this.app.levelNoteKeys(this.level).includes(cand.key) && !p.creatures.includes(cand.key)) { p.creatures.push(cand.key); this.freed.push(cand); }
      this.placed.push(cand); this.parts.burst(this.xs[this.slot], G.yOfPos(this.pos), [G.C.YE, G.C.W, G.C.GL], 14); this.slot++; this.tries = 0; this.t0 = performance.now(); if (this.slot < this.n) app.bubble(`Schreibe das Wort <b>${tk.word}</b> – Note für Note.`, 0);
      if (this.slot >= this.n) { if (this.taskClean) this.firstTry++; this.locked = true; app.bubble('Richtig!', 1);
        setTimeout(() => { this.locked = false; this.ti++; if (this.ti >= this.tasks.length) { app.audio.sfx('done'); app.finishLevel(this.level, { ratio: this.firstTry / this.tasks.length, freed: this.freed, line: `Beim ersten Versuch richtig: <b>${this.firstTry} von ${this.tasks.length}</b>` }); } else this.startTask(); }, 900); }
    } else {
      this.tries++; this.taskClean = false; this.wrongT = 0.5; const want = tk.word ? tk.word[this.slot].toLowerCase() : null;
      if (!tk.word) { const ck = `${tk.notes[0].key}>${cand.key}`; p.conf[ck] = (p.conf[ck] || 0) + 1; p.notes[tk.notes[0].key] = srsUpdate(p.notes[tk.notes[0].key] || newStat(), false); }
      app.bubble(`Das ist <b>${nameHtml(cand)}</b> (${describePos(this.pos, this.clef)}). Gesucht ist <b>${tk.word ? want : nameHtml(tk.notes[0])}</b>.`, 0);
    }
  }
  update(dt) { this.t += dt; this.parts.update(dt); if (this.wrongT > 0) this.wrongT -= dt; }
  draw(ctx, tx) {
    const line = this.line, tk = this.tasks[Math.min(this.ti, this.tasks.length - 1)]; G.drawBackground(ctx, this.bg, this.t * 3, this.t); G.drawStaff(ctx, line, 4, G.VIEW_W - 4, this.clef); G.drawClef(ctx, this.clef, 6, line);
    const dark = this.theme === 'himmel' ? G.C.K : G.C.CREAM;
    for (let i = 0; i < this.n; i++) { const x = Math.round(this.xs[i]);
      if (i < this.placed.length) { const n = this.placed[i], pos = staffPos(n, this.clef); G.drawLedgers(ctx, x - 9, 19, ledgerPositions(pos, this.clef), line); G.drawNote(ctx, x, G.yOfPos(pos), { style: 'ok', up: stemUp(pos, this.clef), alt: n.alt, line: G.C.K }); }
      else if (i === this.slot && !this.locked) { const sx = x + (this.wrongT > 0 ? Math.round(Math.sin(this.wrongT * 50) * 2) : 0), y = G.yOfPos(this.pos);
        G.drawLedgers(ctx, x - 9, 19, ledgerPositions(this.pos, this.clef), line); G.drawGlow(ctx, sx, y, 0.55 + 0.25 * Math.sin(this.t * 5)); G.drawNote(ctx, sx, y, { style: 'gold', halo: '#FFF1D6', up: stemUp(this.pos, this.clef), alt: this.alt, line: G.C.K });
        if (this.tries >= 2 && !tk.word) { const tp = staffPos(tk.notes[0], this.clef); ctx.globalAlpha = 0.45; G.drawNote(ctx, x, G.yOfPos(tp), { style: 'ghost', stem: false, line: G.C.G2 }); ctx.globalAlpha = 1; } }
      if (tk.word) label(tx, tk.word[i], x, 126, { size: 30, color: i < this.placed.length ? '#B4EB6B' : '#FFFFFF', stroke: G.C.K }); }
    this.parts.draw(ctx);
  }
}
