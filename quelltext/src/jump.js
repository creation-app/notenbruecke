// Spielart "Springen": Das Notensystem ist das Level. Richtiger Ton auf dem Klavier = Sprung auf die nächste Plattform.
import { stemUp, N, midiOf, staffPos, classify, noteOfMidi, nameHtml, letterName, describePos, ledgerPositions } from './music.js';
import { pickNext, update as srsUpdate, newStat, SLOW_PLAY_MS } from './srs.js';
import * as G from './gfx.js';
import { label, noteLabel } from './text.js';

const STRIDE = 84, PW = 46, HERO_SX = 78, JUMP_S = 0.42;
export class JumpScene {
  constructor(app, level) { this.app = app; this.level = level; this.isLevel = true; }
  enter() {
    const { app, level } = this, p = app.profile;
    this.clef = level.clef; this.theme = level.theme; this.bg = app.background(level.theme); this.line = G.THEMES[level.theme].line;
    this.targets = this.buildTargets(); this.boss = !!level.melody;
    const first = staffPos(this.targets[0], this.clef), home = this.clef === 'grand' ? 4 : 0, startPos = first === home ? home - 2 : home;
    this.plats = [{ x: 70, pos: startPos, note: null, built: true }, ...this.targets.map((n, i) => ({ x: 70 + (i + 1) * STRIDE, pos: staffPos(n, this.clef), note: n, built: false }))];
    this.idx = 0; this.firstTry = 0; this.combo = 0; this.t = 0; this.elapsed = 0; this.started = false; this.freed = [];
    this.hero = { x: 70, y: G.yOfPos(startPos) }; this.camX = 70 - HERO_SX; this.phase = 'listen'; this.oopsT = 0; this.landT = 0; this.ghost = null; this.queue = null;
    this.guard = G.makeCreature(4, 0, true); this.parts = new G.Particles(); this.accMidi = null; this.accAt = -1e9; this.hintAfter = (p.mode === 'profi' ? 3 : 2) + (this.boss ? 1 : 0);
    app.panel.showMic(true); app.panel.keyboard(this.clef); app.hud.show(level.title, true); this.prompt(true);
  }
  buildTargets() {
    const { level } = this, stats = this.app.profile.notes;
    if (level.melody) return level.melody.map(N);
    const out = [...level.fresh]; let last = out[out.length - 1] || null;
    while (out.length < level.len) { last = pickNext(level.notes, stats, Math.random, level.notes.length > 2 ? last : null); out.push(last); }
    return out.map(N);
  }
  get target() { return this.targets[this.idx]; }
  prompt(first) {
    const { app } = this, tg = this.target; this.tries = 0; const isNew = !app.profile.notes[tg.key]; this.t0 = performance.now(); this.fresh = isNew;
    this.hint = isNew; app.panel.setHint(isNew ? midiOf(tg) : null);
    app.hud.progress(this.idx, this.targets.length);
    app.hud.extra(app.profile.mode === 'profi' ? `<span id="jTime">0:00</span>${this.combo > 1 ? ` &middot; <b>${this.combo}×</b> Serie` : ''}` : '');
    if (isNew) app.bubble(`Neu: <b>${nameHtml(tg)}</b> – ${describePos(staffPos(tg, this.clef), this.clef)}. Die Taste leuchtet.`, 0);
    else if (first) app.bubble(this.boss ? `Spiele die Melodie: <b>${this.level.title}</b>` : 'Welcher Ton baut die Brücke?', 4);
    else app.bubble(null);
    if (first) app.panel.say(app.listening ? 'Ich höre …' : 'Tippe die Taste', app.listening ? 'Ich höre noch nichts.' : '');
  }
  onNote(midi) {
    if (this.phase === 'jump') { this.queue = midi; return; }
    if (this.phase !== 'listen') return;
    const { app } = this, p = app.profile, tg = this.target, tm = midiOf(tg), now = performance.now();
    if (midi === this.accMidi && (now - this.accAt < 350 || (midi !== tm && now - this.accAt < 1200))) return; // ausklingender Ton
    this.started = true; const cls = classify(tm, midi), heard = noteOfMidi(midi, tg.alt < 0);
    if (cls === 'correct') {
      const first = this.tries === 0; p.notes[tg.key] = srsUpdate(p.notes[tg.key] || newStat(), first, !this.fresh && performance.now() - this.t0 > SLOW_PLAY_MS);
      if (first) { this.firstTry++; this.combo++; } else this.combo = 0;
      app.panel.say('Ich höre …', `Perfekt! <b>${nameHtml(tg)}</b> erkannt!`, 'ok'); app.panel.flash(midi, 'good'); app.panel.setHint(null); app.bubble(null);
      if (!p.creatures.includes(tg.key)) { p.creatures.push(tg.key); this.freed.push(tg); this.freeAt = tg; }
      app.audio.sfx('ok'); this.phase = 'jump'; this.jumpT = 0; this.from = { ...this.hero }; this.accMidi = midi; this.accAt = now; this.ghost = null;
    } else {
      this.tries++; this.combo = 0; const ck = `${tg.key}>${heard.key}`; p.conf[ck] = (p.conf[ck] || 0) + 1;
      this.ghost = { note: heard, pos: staffPos(heard, this.clef), t: 0 }; this.oopsT = 0.5; app.audio.sfx('oops'); app.panel.flash(midi, 'bad');
      if (cls === 'wrong') app.panel.say('Ich höre …', `Das war <b>${nameHtml(heard)}</b>. Versuch es noch einmal!`, 'warn');
      else app.panel.say('Ich höre …', `Das ist ein <b>${letterName(tg)}</b>, aber eine Oktave zu ${cls === 'octave-high' ? 'hoch' : 'tief'}.`, 'warn');
      if (this.tries >= this.hintAfter && !this.hint) { this.hint = true; app.panel.setHint(tm); app.bubble('Tipp: Die leuchtende Taste ist richtig.', 4); }
    }
  }
  update(dt) {
    const { app } = this; this.t += dt; this.parts.update(dt); if (this.oopsT > 0) this.oopsT -= dt; if (this.landT > 0) this.landT -= dt;
    if (this.started && this.phase !== 'done') { this.elapsed += dt; const el = document.getElementById('jTime'); if (el) el.textContent = fmtTime(this.elapsed); }
    if (this.ghost && (this.ghost.t += dt) > 2.2) this.ghost = null;
    if (this.phase === 'jump') {
      this.jumpT += dt / JUMP_S; const u = Math.min(1, this.jumpT), to = this.plats[this.idx + 1], ty = G.yOfPos(to.pos);
      this.hero.x = this.from.x + (to.x - this.from.x) * u; this.hero.y = this.from.y + (ty - this.from.y) * u - Math.sin(Math.PI * u) * 22;
      if (u >= 1) {
        this.idx++; to.built = true; this.landT = 0.28; this.hero.y = ty; this.parts.burst(to.x, ty - 4, [G.C.YE, G.C.W, G.THEMES[this.theme].grass[0]], 16);
        if (this.freeAt) { app.toast(`Notenwesen <b>${nameHtml(this.freeAt)}</b> befreit!`, this.freeAt); app.audio.sfx('free'); this.parts.burst(to.x, ty - 20, [G.C.YE, G.C.OR, G.C.W], 22); this.freeAt = null; }
        if (this.idx >= this.targets.length) { this.phase = 'done'; this.doneT = 0; app.audio.sfx('done'); if (this.boss) { this.parts.burst(to.x + 54, ty - 24, ['#C9D1DC', '#FFFFFF', '#8E9BB0'], 40); app.toast('Der Nebelwächter löst sich auf!'); } app.hud.progress(this.idx, this.targets.length); app.bubble(null); }
        else { this.phase = 'listen'; this.prompt(false); const q = this.queue; this.queue = null; if (q != null) this.onNote(q); }
      }
    } else if (this.phase === 'done') {
      this.doneT += dt;
      if (this.doneT > 1.1 && !this.reported) { this.reported = true; app.finishLevel(this.level, { ratio: this.firstTry / this.targets.length, time: this.elapsed, freed: this.freed,
        line: `Beim ersten Versuch richtig: <b>${this.firstTry} von ${this.targets.length}</b>` }); }
    }
    this.camX += (this.hero.x - HERO_SX - this.camX) * Math.min(1, dt * 6);
  }
  draw(ctx, tx) {
    const cam = G.q(this.camX), T = this.theme, line = this.line, light = T !== 'himmel';
    G.drawBackground(ctx, this.bg, this.camX, this.t);
    // Der Graue Nebel liegt über allem, was noch nicht gebaut ist
    const fogX = Math.max(0, this.plats[Math.min(this.idx + 1, this.plats.length - 1)].x + 34 - cam + (this.phase === 'done' ? this.doneT * 400 : 0));
    if (fogX < G.VIEW_W) { ctx.fillStyle = T === 'himmel' ? 'rgba(214,220,228,0.62)' : 'rgba(150,160,180,0.42)'; ctx.fillRect(fogX + 6, 0, G.VIEW_W - fogX, G.VIEW_H);
      for (let y = 0; y < G.VIEW_H; y += 2) ctx.fillRect(fogX + ((y >> 1) % 3) * 2, y, 6, 2); }
    if (this.boss) { const gx = this.plats[this.plats.length - 1].x + 38 - cam; if (gx < G.VIEW_W + 40 && this.phase !== 'done') { const gy = G.yOfPos(this.plats[this.plats.length - 1].pos) - 40 + G.q(Math.sin(this.t * 2) * 2); ctx.drawImage(this.guard, gx, gy, 32, 32); } }
    const vis = [];
    this.plats.forEach((pl, i) => { const sx = pl.x - cam; if (sx < 58 || sx > G.VIEW_W + 40) return;
      const style = pl.built ? 'solid' : i === this.idx + 1 ? 'dashed' : i === this.idx + 2 ? 'ghost' : null; if (!style) return;
      G.drawLedgers(ctx, sx - 27, 54, ledgerPositions(pl.pos, this.clef), line); G.drawPlatform(ctx, sx - PW / 2, G.yOfPos(pl.pos), PW, style, T); vis.push([pl, i, sx, style]); });
    G.drawStaff(ctx, line, 4, G.VIEW_W - 4, this.clef);
    if (this.phase !== 'done') for (let k = (this.boss ? 3 : 2); k >= 1; k--) { // gesuchte Note + Vorschau
      const pl = this.plats[this.idx + k]; if (!pl) continue; const nx = pl.x - 42 - cam, ny = G.yOfPos(pl.pos); if (nx > G.VIEW_W + 10) continue;
      G.drawLedgers(ctx, nx - 9, 19, ledgerPositions(pl.pos, this.clef), line);
      if (k === 1) { if (this.phase === 'listen') G.drawGlow(ctx, nx, ny, 0.65 + 0.3 * Math.sin(this.t * 5)); G.drawNote(ctx, nx, ny, { style: 'gold', halo: '#FFF1D6', up: stemUp(pl.pos, this.clef), alt: pl.note.alt, line: G.C.K }); }
      else { ctx.globalAlpha = 0.4; G.drawNote(ctx, nx, ny, { style: 'ink', up: stemUp(pl.pos, this.clef), alt: pl.note.alt, line }); ctx.globalAlpha = 1; }
    }
    if (this.ghost && this.ghost.pos >= -6 && this.ghost.pos <= 14) { const pl = this.plats[this.idx + 1], nx = pl.x - 42 - cam + 16, a = Math.max(0, 1 - this.ghost.t / 2.2);
      ctx.globalAlpha = a; G.drawLedgers(ctx, nx - 9, 19, ledgerPositions(this.ghost.pos, this.clef), G.C.RED); G.drawNote(ctx, nx, G.yOfPos(this.ghost.pos), { style: 'ghost', stem: false, alt: this.ghost.note.alt, line: G.C.RED }); ctx.globalAlpha = 1;
      tx.globalAlpha = a; noteLabel(tx, this.ghost.note, nx + 14, G.yOfPos(this.ghost.pos), { size: 20, color: '#FFFFFF', stroke: G.C.RED }); tx.globalAlpha = 1; }
    G.drawClef(ctx, this.clef, 6, line);
    // Figur
    const H = this.app.heroFrames; let f;
    const nxt = this.plats[this.idx + 1], above = nxt && nxt.pos > this.plats[this.idx].pos;
    if (this.phase === 'jump') f = H.jump; else if (this.phase === 'done') f = Math.floor(this.doneT * 7) % 2 ? H.cheer1 : H.cheer0; else if (this.landT > 0) f = H.cheer0; else if (this.oopsT > 0) f = H.oops;
    else if (this.app.audio.heard) f = H.listen; else if (this.t % 3.4 > 3.25) f = H.blink; else if (nxt && this.t % 4.5 < 1.3) f = above ? H.lookUp : H.lookDown; else f = Math.floor(this.t * 1.6) % 2 ? H.idle1 : H.idle0;
    const bob = this.phase === 'done' ? Math.abs(Math.sin(this.doneT * 9)) * 5 : 0, shake = this.oopsT > 0 ? Math.round(Math.sin(this.oopsT * 50) * 1.5) : 0;
    const sq = this.landT > 0 && this.phase !== 'done' ? this.landT / 0.28 : 0, w = G.q(18 * (1 + 0.22 * sq)), h = G.q(24 * (1 - 0.22 * sq)); // Landung: kurz zusammenstauchen
    this.app.drawBuddy(ctx, this, this.hero.x - cam - 20, this.hero.y - 34, this.t, this.phase === 'done' ? Math.abs(Math.sin(this.doneT * 9 + 1)) * 7 : this.landT > 0 ? Math.sin(this.landT / 0.28 * Math.PI) * 6 : 0);
    ctx.drawImage(f, G.q(this.hero.x - cam - w / 2) + shake, G.q(this.hero.y - 4 - 23 - bob + (24 - h)), w, h);
    this.parts.draw(ctx, cam);
    // Beschriftung
    for (const [pl, i, sx, style] of vis) { const y = G.yOfPos(pl.pos) + 2.2;
      if (style === 'solid') { if (pl.note) noteLabel(tx, pl.note, sx, y, { size: 19, color: '#FFFFFF', stroke: G.C.K }); else label(tx, 'Start', sx, y, { size: 17, color: '#FFFFFF', stroke: G.C.K }); }
      else if (style === 'dashed' && this.hint) noteLabel(tx, pl.note, sx, y - 2, { size: 22, color: light ? G.C.CREAM : G.C.K });
      else if (style === 'ghost') label(tx, '?', sx, y - 2, { size: 22, color: '#FFFFFF', stroke: 'rgba(38,54,75,.5)' }); }
  }
}
export function fmtTime(s) { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
