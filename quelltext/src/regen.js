// Spielart "Notenregen": Noten wandern auf das Tor zu; den Namen rechtzeitig antippen. Das Tempo passt sich an.
import { stemUp, N, staffPos, letterName, nameHtml, ledgerPositions } from './music.js';
import { pickNext, update as srsUpdate, newStat } from './srs.js';
import * as G from './gfx.js';
import { label } from './text.js';

const GATE = 52, SPACING = 74, DURATION = 60;
export class RegenScene {
  constructor(app, level) { this.app = app; this.level = level; this.isLevel = true; }
  enter() {
    const { app, level } = this; this.clef = level.clef; this.theme = level.theme; this.bg = app.background(level.theme); this.line = G.THEMES[level.theme].line;
    this.notes = []; this.t = 0; this.left = DURATION; this.correct = 0; this.wrong = 0; this.combo = 0; this.score = 0; this.freeze = 0; this.last = null; this.parts = new G.Particles(); this.started = false;
    this.speed = app.profile.mode === 'profi' ? 30 : 20; this.maxSpeed = app.profile.mode === 'profi' ? 85 : 60;
    const order = ['c', 'cis', 'des', 'd', 'dis', 'es', 'e', 'f', 'fis', 'g', 'gis', 'as', 'a', 'b', 'h'];
    const names = [...new Set(level.notes.map(k => letterName(N(k))))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    app.panel.showMic(false); app.panel.answers(names, (l, btn) => this.answer(l, btn)); app.panel.task('Tippe <b>unten den Namen</b> der Note an, bevor sie das rote Tor erreicht.'); app.hud.show(level.title, true); app.hud.progress(0, 0);
    app.bubble('Tippe den Namen der leuchtenden Note, bevor sie das Tor erreicht!', 5);
    for (let i = 0; i < 5; i++) this.spawn(G.VIEW_W + 20 + i * SPACING); this.hudUpdate();
  }
  spawn(x) { const k = pickNext(this.level.notes, this.app.profile.notes, Math.random, this.last); this.last = k; const n = N(k); this.notes.push({ n, x, pos: staffPos(n, this.clef), tried: false }); }
  get active() { return this.notes[0]; }
  hudUpdate() { this.app.hud.extra(`<b>${this.score}</b> Punkte${this.combo > 1 ? ` &middot; ${this.combo}× Serie` : ''} &middot; <span id="rTime">${Math.ceil(this.left)}</span> s`); }
  answer(l, btn) {
    const a = this.active, { app } = this, p = app.profile; if (!a || this.freeze > 0 || this.left <= 0) return; this.started = true;
    if (letterName(a.n) === l) {
      p.notes[a.n.key] = srsUpdate(p.notes[a.n.key] || newStat(), !a.tried); this.correct++; this.combo = a.tried ? 0 : this.combo + 1; this.score += 10 + Math.min(10, this.combo);
      this.speed = Math.min(this.maxSpeed, this.speed + 1.6); this.parts.burst(a.x, G.yOfPos(a.pos), [G.C.YE, G.C.W, G.C.OR], 14); app.audio.sfx('ok');
      this.notes.shift(); this.spawn(this.notes[this.notes.length - 1].x + SPACING);
    } else { if (!a.tried) { a.tried = true; this.wrong++; const ck = `${a.n.key}>${l}`; p.conf[ck] = (p.conf[ck] || 0) + 1; } this.combo = 0; app.audio.sfx('oops'); btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 350); }
    this.hudUpdate();
  }
  /** Schmaler Bildschirm (hochkant): Der Weg bis zum Tor ist kürzer – die Noten fliegen entsprechend langsamer, damit gleich viel Zeit zum Lesen bleibt. */
  narrow() { return Math.max(0.45, Math.min(1, (G.VIEW_W - GATE) / 268)); }
  update(dt) {
    this.t += dt; this.parts.update(dt); const { app } = this;
    if (this.done) return;
    if (this.started) { this.left -= dt; const el = document.getElementById('rTime'); if (el) el.textContent = Math.max(0, Math.ceil(this.left)); }
    if (this.left <= 0) { this.done = true; app.audio.sfx('done'); const total = this.correct + this.wrong + this.missed || 1;
      const th = app.profile.mode === 'profi' ? [12, 20, 28] : [8, 14, 20]; const stars = this.correct >= th[2] ? 3 : this.correct >= th[1] ? 2 : 1;
      app.finishLevel(this.level, { stars, score: this.score, freed: [], line: `<b>${this.correct}</b> Noten richtig erkannt &middot; <b>${this.score}</b> Punkte` }); return; }
    if (this.freeze > 0) { this.freeze -= dt; if (this.freeze <= 0) { this.notes.shift(); this.spawn(this.notes[this.notes.length - 1].x + SPACING); } return; }
    for (const n of this.notes) n.x -= this.speed * this.narrow() * dt;
    const a = this.active;
    if (a && a.x <= GATE) { a.x = GATE; a.missed = true; this.freeze = 1.3; this.combo = 0; this.missed = (this.missed || 0) + 1; this.speed = Math.max(16, this.speed * 0.82);
      app.profile.notes[a.n.key] = srsUpdate(app.profile.notes[a.n.key] || newStat(), false); app.audio.sfx('miss'); app.bubble(`Das war <b>${nameHtml(a.n)}</b>.`, 1.3); this.hudUpdate(); }
  }
  draw(ctx, tx) {
    const line = this.line; G.drawBackground(ctx, this.bg, this.t * 6, this.t); G.drawStaff(ctx, line, 4, G.VIEW_W - 4, this.clef);
    ctx.fillStyle = G.C.RED; for (let y = G.yOfPos(11); y < G.yOfPos(-3); y += 4) ctx.fillRect(GATE - 9, y, 1, 2);
    this.notes.forEach((n, i) => { if (n.x > G.VIEW_W + 12) return; const y = G.yOfPos(n.pos); G.drawLedgers(ctx, G.q(n.x) - 9, 19, ledgerPositions(n.pos, this.clef), line);
      if (i === 0) { G.drawGlow(ctx, G.q(n.x), y, 0.6 + 0.3 * Math.sin(this.t * 6)); G.drawNote(ctx, G.q(n.x), y, { halo: '#FFF1D6', style: n.missed ? 'ghost' : 'gold', up: stemUp(n.pos, this.clef), alt: n.n.alt, line: n.missed ? G.C.RED : G.C.K }); }
      else G.drawNote(ctx, G.q(n.x), y, { style: 'ink', up: stemUp(n.pos, this.clef), alt: n.n.alt, line }); });
    G.drawClef(ctx, this.clef, 6, line); this.parts.draw(ctx);
    label(tx, 'Tor', GATE - 9, G.yOfPos(12.6), { size: 18, color: '#FFFFFF', stroke: G.C.RED });
  }
}
