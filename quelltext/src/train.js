// Spielart "Training": eine Note nach der anderen, so schnell und sicher wie möglich. Keine Geschichte, nur Tempo und Treffer.
import { stemUp, N, midiOf, staffPos, classify, noteOfMidi, nameHtml, letterName, ledgerPositions } from './music.js';
import { pickNext, update as srsUpdate, newStat } from './srs.js';
import { pool, sameSound, TRAIN_SECS, TRAIN_COUNT, SLOW_MS } from './training.js';
import * as G from './gfx.js';
import { label } from './text.js';

const NOTE_X = 150, NEXT_X = 218, COUNTDOWN = 3;
const ORDER = ['c', 'cis', 'des', 'd', 'dis', 'es', 'e', 'f', 'fis', 'ges', 'g', 'gis', 'as', 'a', 'ais', 'b', 'h'];
export class TrainScene {
  constructor(app, level) { this.app = app; this.level = level; this.cfg = level.cfg; this.isLevel = true; }
  enter() {
    const { app, cfg, level } = this; this.pool = pool(cfg, app.profile); this.theme = level.theme; this.bg = app.background(level.theme); this.line = G.THEMES[level.theme].line;
    this.t = 0; this.count = COUNTDOWN; this.elapsed = 0; this.done = false; this.correct = 0; this.first = 0; this.tried = 0; this.times = []; this.freed = []; this.parts = new G.Particles();
    this.slide = 1; this.hop = 0; this.shake = 0; this.accMidi = null; this.accAt = -1e9; this.cur = null; this.next = this.pick(null); this.kbClef = null;
    if (cfg.input === 'play') app.panel.showMic(true); else { app.panel.showMic(false); const names = [...new Set(this.pool.map(e => letterName(N(e.key))))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); app.panel.answers(names, (l, btn) => this.answer(l, btn)); }
    app.hud.show(level.title, true); app.hud.progress(0, cfg.len === 'count' ? TRAIN_COUNT : 0); this.advance(); this.hudUpdate();
    if (cfg.input === 'play') app.panel.say(app.listening ? 'Ich höre …' : 'Tippe die Taste', 'Gleich geht es los.');
    app.bubble(cfg.input === 'play' ? 'Spiele jede Note einmal – so viele wie möglich!' : 'Tippe den Namen jeder Note – so viele wie möglich!', COUNTDOWN);
  }
  /** Nächste Note: unsichere kommen öfter; nie dieselbe (oder gleich klingende) zweimal hintereinander. */
  pick(prev) {
    const keys = [...new Set(this.pool.map(e => e.key))], stats = this.app.profile.notes; let e = null;
    for (let i = 0; i < 12; i++) { const k = pickNext(keys, stats, Math.random, prev ? prev.key : null), opts = this.pool.filter(x => x.key === k); e = opts[Math.floor(Math.random() * opts.length)]; if (!sameSound(prev, e)) break; }
    const n = N(e.key); return { n, key: e.key, clef: e.clef, pos: staffPos(n, e.clef) };
  }
  advance() {
    this.cur = this.next; this.next = this.pick(this.cur); this.curTried = false; this.noteStart = this.elapsed; this.slide = 0;
    if (this.cfg.input === 'play' && this.kbClef !== this.cur.clef) { this.kbClef = this.cur.clef; this.app.panel.keyboard(this.cur.clef); }
  }
  hudUpdate() {
    const { app, cfg } = this; if (cfg.len === 'count') { app.hud.progress(this.correct, TRAIN_COUNT); app.hud.extra(`<span id="tTime">${Math.floor(this.elapsed)}</span> s`); }
    else app.hud.extra(`<b>${this.correct}</b> Noten &middot; <span id="tTime">${Math.max(0, Math.ceil(TRAIN_SECS - this.elapsed))}</span> s`);
  }
  get live() { return !this.done && this.count <= 0; }
  hit(midi) {
    const { app, cfg } = this, p = app.profile, c = this.cur, ms = (this.elapsed - this.noteStart) * 1000;
    this.correct++; if (!this.curTried) { this.first++; this.tried++; }
    p.notes[c.key] = srsUpdate(p.notes[c.key] || newStat(), !this.curTried, ms > SLOW_MS[cfg.input]); this.times.push({ key: c.key, clef: c.clef, ms });
    if (cfg.input === 'play' && !p.creatures.includes(c.key)) { p.creatures.push(c.key); this.freed.push(c.n); }
    app.audio.sfx('ok'); this.parts.burst(NOTE_X, G.yOfPos(c.pos), [G.C.YE, G.C.W, G.C.OR], 12); this.hop = 1;
    if (cfg.input === 'play') { app.panel.flash(midi, 'good'); app.panel.say(app.listening ? 'Ich höre …' : 'Tippe die Taste', `<b>${nameHtml(c.n)}</b> – richtig!`, 'ok'); }
    if (cfg.len === 'count' && this.correct >= TRAIN_COUNT) { this.hudUpdate(); return this.finish(); }
    this.advance(); this.hudUpdate();
  }
  miss(heardKey) { const p = this.app.profile, c = this.cur; if (!this.curTried) { this.curTried = true; this.tried++; const ck = `${c.key}>${heardKey}`; p.conf[ck] = (p.conf[ck] || 0) + 1; } this.shake = 0.35; this.app.audio.sfx('oops'); }
  /** Ton vom Klavier (Mikrofon) oder von den Bildschirm-Tasten. */
  onNote(midi) {
    if (this.cfg.input !== 'play' || !this.live) return; const { app } = this, c = this.cur, tm = midiOf(c.n), now = performance.now();
    if (midi === this.accMidi && (now - this.accAt < 350 || (midi !== tm && now - this.accAt < 1200))) return; // ausklingender Ton der letzten Note
    const cls = classify(tm, midi);
    if (cls === 'correct') { this.accMidi = midi; this.accAt = now; return this.hit(midi); }
    const heard = noteOfMidi(midi, c.n.alt < 0); this.miss(heard.key); app.panel.flash(midi, 'bad');
    app.panel.say(app.listening ? 'Ich höre …' : 'Tippe die Taste', cls === 'wrong' ? `Das war <b>${nameHtml(heard)}</b>.` : `Eine Oktave zu ${cls === 'octave-high' ? 'hoch' : 'tief'}.`, 'warn');
  }
  /** Antwortknopf (Namen antippen). */
  answer(l, btn) { if (this.cfg.input !== 'name' || !this.live) return; if (letterName(this.cur.n) === l) return this.hit(null); this.miss(l); btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 350); }
  finish() { this.done = true; this.app.audio.sfx('done'); this.app.finishTraining(this.level, { correct: this.correct, first: this.first, tried: this.tried, ms: this.cfg.len === 'time' ? TRAIN_SECS * 1000 : this.elapsed * 1000, times: this.times, freed: this.freed }); }
  update(dt) {
    this.t += dt; this.parts.update(dt); if (this.slide < 1) this.slide = Math.min(1, this.slide + dt / 0.14); if (this.hop > 0) this.hop = Math.max(0, this.hop - dt * 3.5); if (this.shake > 0) this.shake -= dt;
    if (this.done) return;
    if (this.count > 0) { this.count -= dt; if (this.count <= 0) { this.noteStart = 0; if (this.cfg.input === 'play') this.app.panel.say(this.app.listening ? 'Ich höre …' : 'Tippe die Taste', 'Los!'); } return; }
    this.elapsed += dt; const el = document.getElementById('tTime');
    if (this.cfg.len === 'time') { if (el) el.textContent = Math.max(0, Math.ceil(TRAIN_SECS - this.elapsed)); if (this.elapsed >= TRAIN_SECS) this.finish(); } else if (el) el.textContent = Math.floor(this.elapsed);
  }
  draw(ctx, tx) {
    const line = this.line, c = this.cur; G.drawBackground(ctx, this.bg, this.t * 4, this.t); G.drawStaff(ctx, line, 4, G.VIEW_W - 4, c.clef); G.drawClef(ctx, c.clef, 6, line);
    this.app.drawBuddy(ctx, this, 72, 46, this.t, Math.sin(this.hop * Math.PI) * 7);
    if (this.count > 0) { const n = Math.ceil(this.count); label(tx, String(n), NOTE_X + 10, G.yOfPos(4), { size: 150 + 40 * (this.count - Math.floor(this.count)), color: '#FFFFFF', stroke: G.C.K }); return; }
    const off = (1 - this.slide) * (1 - this.slide) * (NEXT_X - NOTE_X), sh = this.shake > 0 ? Math.round(Math.sin(this.shake * 60) * 1.5) : 0, x = G.q(NOTE_X + off) + sh, y = G.yOfPos(c.pos);
    if (!this.done) {
      const nx = this.next; if (nx.clef === c.clef) { ctx.globalAlpha = 0.38; const x2 = G.q(NEXT_X + off), y2 = G.yOfPos(nx.pos); G.drawLedgers(ctx, x2 - 9, 19, ledgerPositions(nx.pos, nx.clef), line); G.drawNote(ctx, x2, y2, { style: 'ink', up: stemUp(nx.pos, nx.clef), alt: nx.n.alt, line }); ctx.globalAlpha = 1; }
      G.drawLedgers(ctx, x - 9, 19, ledgerPositions(c.pos, c.clef), line); G.drawGlow(ctx, x, y, 0.6 + 0.3 * Math.sin(this.t * 6));
      G.drawNote(ctx, x, y, { halo: '#FFF1D6', style: this.shake > 0 ? 'ghost' : 'gold', up: stemUp(c.pos, c.clef), alt: c.n.alt, line: this.shake > 0 ? G.C.RED : G.C.K });
    }
    this.parts.draw(ctx);
  }
}
