// Spielart "Lied": eine Melodie vom Blatt – mit Notenwerten und Taktstrichen. Drei Arten: anhören, Note für Note, im Tempo.
import { N, midiOf, staffPos, classify, noteOfMidi, nameHtml, letterName, ledgerPositions, stemUp } from './music.js';
import { update as srsUpdate, newStat } from './srs.js';
import * as G from './gfx.js';
import { INSTR, isGuitar, gripText } from './instrument.js';
import { label } from './text.js';

const PXB = 26, BAR_GAP = 8, X0 = 60, HIDE = 50, LAT_S = 0.26, EARLY = 0.4;
const freq = m => 440 * Math.pow(2, (m - 69) / 12);
export class SongScene {
  constructor(app, level) { this.app = app; this.level = level; this.isLevel = true; }
  enter() {
    const { app, level } = this, song = level.song; this.mode = level.mode; this.song = song; this.clef = 'treble'; this.theme = level.theme; this.bg = app.background(level.theme); this.line = G.THEMES[level.theme].line;
    let x = X0, bar = 0; this.bars = [];
    this.items = song.notes.map(n => { if (n.t0 > 0 && Math.abs(n.t0 / song.meter - Math.round(n.t0 / song.meter)) < 1e-6) { this.bars.push(x - 9 + BAR_GAP / 2); x += BAR_GAP; bar++; } const nn = N(n.key), it = { n: nn, key: n.key, midi: midiOf(nn), pos: staffPos(nn, this.clef), beats: n.beats, t0: n.t0, x, st: 'todo' }; x += n.beats * PXB; return it; });
    this.endX = x; this.bars.push(x - 9 + BAR_GAP / 2); this.i = 0; this.t = 0; this.first = 0; this.hits = 0; this.wrong = 0; this.tries = 0; this.done = false; this.doneT = 0; this.shake = 0; this.hint = false; this.parts = new G.Particles(); this.accMidi = null; this.accAt = -1e9; this.freed = [];
    this.bpm = level.bpm || song.bpm; this.beat = this.mode === 'step' ? 0 : -song.meter; this.lastClick = -99; this.camX = 0; this.started = false;
    app.panel.showMic(this.mode !== 'listen'); app.panel.keyboard(this.clef); app.hud.show(song.title, true); app.hud.progress(0, this.items.length);
    if (this.mode === 'listen') { app.panel.task('Hör zu und <b>lies mit</b> – die leuchtende Note erklingt gerade.'); app.bubble('Hör gut zu und lies mit!', 4); }
    else if (this.mode === 'tempo') { app.panel.task(app.listening ? `Spiele <b>im Takt</b> ${INSTR.on}: jede Note, wenn sie die Linie erreicht.` : `Tippe <b>im Takt</b> ${INSTR.padWhere}: jede Note, wenn sie die Linie erreicht.`); app.hud.extra(`<b>${Math.round(this.bpm)}</b> Schläge pro Minute`); app.bubble('Zähl mit: Nach dem Einzählen geht es los!', 4); }
    else { this.prompt(true); }
  }
  get cur() { return this.items[this.i]; }
  prompt(first) {
    const { app } = this; this.tries = 0; this.hint = false; app.panel.setHint(null); app.hud.progress(this.i, this.items.length);
    app.panel.task(app.listening ? `Spiele das Lied <b>Note für Note</b> ${INSTR.on}.` : `Spiele das Lied <b>Note für Note</b> – ${INSTR.tapPad}.`);
    if (first) { app.bubble('Lies die leuchtende Note und spiele sie. Lass dir Zeit!', 4); app.panel.say(app.listening ? 'Ich höre …' : INSTR.pad, app.listening ? 'Ich höre noch nichts.' : ''); }
  }
  /** Bildschirm-x zu einem Zeitpunkt (in Schlägen): zwischen den Noten gleichmäßig. */
  xAt(beat) {
    const it = this.items; if (beat <= 0) return it[0].x + beat * PXB; for (let k = 0; k < it.length; k++) { const a = it[k], nx = k + 1 < it.length ? it[k + 1].x : this.endX; if (beat < a.t0 + a.beats) return a.x + (nx - a.x) * (beat - a.t0) / a.beats; } return this.endX + (beat - this.song.beats) * PXB;
  }
  get playX() { return Math.max(60, Math.round(G.VIEW_W * 0.32)); }
  onNote(midi) {
    if (this.done || this.mode === 'listen') return; const { app } = this, p = app.profile, now = performance.now();
    if (this.mode === 'tempo') {
      if (this.beat < -EARLY) return; const lat = (app.listening ? LAT_S : 0.05) * this.bpm / 60, te = this.beat - lat;
      let best = null; for (const it of this.items) { if (it.st !== 'todo') continue; if (te < it.t0 - EARLY) break; if (it.midi === midi && te <= it.t0 + Math.max(it.beats, 0.75) && (!best || Math.abs(te - it.t0) < Math.abs(te - best.t0))) best = it; }
      if (best) { best.st = 'ok'; this.hits++; this.parts.burst(best.x, G.yOfPos(best.pos), [G.C.YE, G.C.W, G.C.GL], 10); app.panel.flash(midi, 'good'); p.notes[best.key] = srsUpdate(p.notes[best.key] || newStat(), true); } else { this.wrong++; app.panel.flash(midi, 'bad'); }
      return;
    }
    const it = this.cur; if (!it) return;
    if (midi === this.accMidi && (now - this.accAt < 350 || (midi !== it.midi && now - this.accAt < 1200))) return; // ausklingender Ton
    this.started = true; const cls = classify(it.midi, midi), heard = noteOfMidi(midi, it.n.alt < 0);
    if (cls === 'correct') {
      const first = this.tries === 0; if (first) this.first++; p.notes[it.key] = srsUpdate(p.notes[it.key] || newStat(), first); it.st = 'ok'; this.parts.burst(it.x, G.yOfPos(it.pos), [G.C.YE, G.C.W, G.C.GL], 12);
      app.panel.say(app.listening ? 'Ich höre …' : INSTR.pad, `<b>${nameHtml(it.n)}</b> – richtig!`, 'ok'); app.panel.flash(midi, 'good'); app.audio.sfx('ok'); this.accMidi = midi; this.accAt = now; this.i++; app.bubble(null);
      if (this.i >= this.items.length) { this.done = true; app.hud.progress(this.i, this.items.length); app.panel.setHint(null); } else this.prompt(false);
    } else {
      this.tries++; this.wrong++; this.shake = 0.4; const ck = `${it.key}>${heard.key}`; p.conf[ck] = (p.conf[ck] || 0) + 1; app.audio.sfx('oops'); app.panel.flash(midi, 'bad');
      app.panel.say(app.listening ? 'Ich höre …' : INSTR.pad, cls === 'wrong' ? `Das war <b>${nameHtml(heard)}</b>. Schau nochmal genau hin!` : `Das ist ein <b>${letterName(it.n)}</b>, aber eine Oktave zu ${cls === 'octave-high' ? 'hoch' : 'tief'}.`, 'warn');
      if (this.tries >= 2 && !this.hint) { this.hint = true; app.panel.setHint(it.midi); app.bubble(isGuitar() ? `Tipp: Das ist <b>${nameHtml(it.n)}</b>. ${gripText(it.midi)}.` : `Tipp: Das ist <b>${nameHtml(it.n)}</b>. Die Taste leuchtet.`, 5); }
    }
  }
  click(strong) { const a = this.app.audio; if (a.muted || !a.ensure()) return; try { a.tone(strong ? 1568 : 1175, a.ctx.currentTime + 0.005, 0.045, 'square', strong ? 0.035 : 0.022); } catch (e) { /* kein Ton */ } }
  update(dt) {
    const { app, song } = this; this.t += dt; this.parts.update(dt); if (this.shake > 0) this.shake -= dt;
    if (this.done) { this.doneT += dt; if (this.doneT > 1 && !this.reported) { this.reported = true; if (this.mode === 'listen') return app.finishSong(this.level, null); app.audio.sfx('done'); app.finishSong(this.level, this.mode === 'tempo' ? { ratio: this.hits / this.items.length, hits: this.hits, n: this.items.length, wrong: this.wrong } : { ratio: this.first / this.items.length, hits: this.first, n: this.items.length, wrong: this.wrong }); } }
    if (this.mode === 'step') { const it = this.cur || this.items[this.items.length - 1], want = Math.max(0, it.x - Math.round(G.VIEW_W * 0.36)); this.camX += (want - this.camX) * Math.min(1, dt * 7); return; }
    if (this.done) return;
    // anhören und im Tempo: die Zeit läuft
    const before = this.beat; this.beat += dt * this.bpm / 60; const whole = Math.floor(this.beat + 1e-6);
    if (whole > this.lastClick && this.beat < song.beats) { this.lastClick = whole; if (this.mode === 'tempo' || this.beat < 0) this.click(((whole % song.meter) + song.meter) % song.meter === 0); }
    if (this.mode === 'listen') { for (const it of this.items) if (it.st === 'todo' && before < it.t0 && this.beat >= it.t0) { it.st = 'ok'; const a = app.audio; if (!a.muted && a.ensure()) { try { a.tone(freq(it.midi - INSTR.shift), a.ctx.currentTime + 0.005, Math.min(1.6, it.beats * 60 / this.bpm * 0.92), 'triangle', 0.11); } catch (e) { /* kein Ton */ } } app.panel.flash(it.midi, 'good'); this.i = this.items.indexOf(it) + 1; app.hud.progress(this.i, this.items.length); } }
    else { const lat = (app.listening ? LAT_S : 0.05) * this.bpm / 60, te = this.beat - lat; let k = 0; for (const it of this.items) { if (it.st === 'todo' && te > it.t0 + Math.max(it.beats, 0.75) + 0.1) { it.st = 'miss'; app.profile.notes[it.key] = srsUpdate(app.profile.notes[it.key] || newStat(), false); } if (it.st !== 'todo') k++; } if (k !== this.i) { this.i = k; app.hud.progress(k, this.items.length); } }
    this.camX = this.xAt(this.beat) - this.playX;
    if (this.beat >= song.beats + (this.mode === 'tempo' ? 1.2 : 0.6)) this.done = true;
  }
  draw(ctx, tx) {
    const line = this.line, cam = Math.round(this.camX), { song } = this, top = G.yOfPos(8), bot = G.yOfPos(0);
    G.drawBackground(ctx, this.bg, this.t * 3 + cam * 0.3, this.t); G.drawStaff(ctx, line, 4, G.VIEW_W - 4, this.clef);
    ctx.fillStyle = line; for (const bx of this.bars) { const sx = bx - cam; if (sx > HIDE - 6 && sx < G.VIEW_W - 3) ctx.fillRect(sx, top, 1, bot - top + 1); }
    { const ex = this.bars[this.bars.length - 1] - cam; if (ex > HIDE - 6 && ex < G.VIEW_W - 6) ctx.fillRect(ex + 3, top, 2, bot - top + 1); }
    if (this.mode !== 'step') { const px = this.playX; ctx.fillStyle = G.C.RED; for (let y = G.yOfPos(11); y < G.yOfPos(-3); y += 4) ctx.fillRect(px, y, 1, 2); }
    this.items.forEach((it, k) => { const sx = it.x - cam; if (sx < HIDE || sx > G.VIEW_W + 12) return; const y = G.yOfPos(it.pos), cur = this.mode === 'step' ? k === this.i && !this.done : it.st === 'todo' && Math.abs(this.beat - it.t0) < 0.5 && this.beat >= it.t0 - 0.5;
      const x = sx + (cur && this.shake > 0 ? Math.round(Math.sin(this.shake * 60) * 1.5) : 0), up = stemUp(it.pos, this.clef), col = it.st === 'miss' ? G.C.RED : line;
      G.drawLedgers(ctx, x - 9, 19, ledgerPositions(it.pos, this.clef), line); if (cur) G.drawGlow(ctx, x, y, 0.6 + 0.3 * Math.sin(this.t * 6));
      G.drawNote(ctx, x, y, { style: cur ? (this.shake > 0 ? 'ghost' : 'gold') : it.st === 'ok' ? 'ok' : it.st === 'miss' ? 'ghost' : 'ink', halo: cur ? '#FFF1D6' : null, up, alt: it.n.alt, line: cur && this.shake > 0 ? G.C.RED : cur ? G.C.K : col, beats: it.beats, stemLen: 19 }); });
    G.drawClef(ctx, this.clef, 6, line); this.app.drawBuddy(ctx, this, 20, 36, this.t, 0); this.parts.draw(ctx, cam);
    label(tx, String(song.meter), 40, G.yOfPos(6), { size: 30, color: this.theme === 'himmel' ? '#26364B' : '#FFFFFF', stroke: this.theme === 'himmel' ? null : G.C.K }); label(tx, '4', 40, G.yOfPos(2), { size: 30, color: this.theme === 'himmel' ? '#26364B' : '#FFFFFF', stroke: this.theme === 'himmel' ? null : G.C.K });
    if (this.mode !== 'step' && this.beat < 0) { const n = song.meter + Math.floor(this.beat) + 1; label(tx, String(Math.max(1, n)), G.VIEW_W * 0.55, G.yOfPos(4), { size: 150, color: '#FFFFFF', stroke: G.C.K }); }
  }
}
