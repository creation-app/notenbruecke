// Einstieg: Spielschleife, Szenenwechsel, Speicher, HUD.
import { load, persist, addPractice, dayKey, importPayload } from './save.js';
import { CONFIG } from './config.js';
import { verifyKey, isActive } from './license.js';
import { track } from './stats.js';
import { GameAudio } from './audio.js';
import { Panel } from './panel.js';
import * as G from './gfx.js';
import { starsFor, LEVELS } from './levels.js';
import { JumpScene } from './jump.js';
import { RegenScene } from './regen.js';
import { BauScene } from './bau.js';
import * as S from './screens.js';
import { N } from './music.js';

class Backdrop {
  constructor(app, theme) { this.app = app; this.theme = theme; this.bg = app.background(theme); this.t = 0; }
  update(dt) { this.t += dt; }
  draw(ctx) { G.drawBackground(ctx, this.bg, this.t * 7, this.t); const H = this.app.heroFrames; if (!H) return;
    const cyc = this.t % 24, walking = cyc < 9 || (cyc >= 12 && cyc < 21), back = cyc >= 12, x = cyc < 9 ? 30 + cyc * 22 : cyc < 12 ? 228 : cyc < 21 ? 228 - (cyc - 12) * 22 : 30;
    const f = walking ? (Math.floor(this.t * 7) % 2 ? H.run1 : H.run0) : cyc < 12 ? (Math.floor(this.t * 4) % 2 ? H.wave0 : H.wave1) : (Math.floor(this.t * 1.6) % 2 ? H.idle1 : H.idle0);
    if (back && walking) { ctx.save(); ctx.translate(G.q(x) + 18, 113); ctx.scale(-1, 1); ctx.drawImage(f, 0, 0); ctx.restore(); } else ctx.drawImage(f, G.q(x), 113); }
}
class App {
  constructor() {
    const $ = id => document.getElementById(id); this.$ = $;
    this.world = $('world'); this.ctx = this.world.getContext('2d'); this.ctx.setTransform(4, 0, 0, 4, 0, 0); this.ctx.imageSmoothingEnabled = false; this.tx = $('text').getContext('2d');
    this.store = (() => { try { const s = window.localStorage; s.getItem('x'); return s; } catch (e) { return null; } })();
    this.state = load(this.store); this.audio = new GameAudio(); this.panel = new Panel($('panel'), this); this.bgCache = {}; this.sec = 0; this.playTotal = 0; this.license = null; this.keysSession = false; this.paused = false;
    this.hud = { show: (t) => { $('hud').hidden = false; $('panel').hidden = false; $('hudTitle').textContent = t; this.hudCr(); }, hide: () => { $('hud').hidden = true; $('panel').hidden = true; },
      extra: h => { $('hudExtra').innerHTML = h; $('hudExtra').hidden = !h; },
      progress: (i, n) => { const e = $('hudProg'); e.hidden = !n; if (n) { e.innerHTML = n <= 16 ? Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'on' : ''}"></i>`).join('') : `${i} / ${n}`; e.setAttribute('aria-label', `${i} von ${n}`); } } };
    $('pauseBtn').addEventListener('click', () => { if (this.scene && this.scene.isLevel) S.pause(this); });
    const pt = e => { if (!this.scene || !this.scene.pointer || this.paused) return; const r = this.world.getBoundingClientRect(); this.scene.pointer((e.clientX - r.left) / r.width * 320, (e.clientY - r.top) / r.height * 200); };
    $('stage').addEventListener('pointerdown', e => { if (e.target.closest('#panel,#screen,#hud')) return; pt(e); }); $('stage').addEventListener('pointermove', e => { if (e.buttons && !e.target.closest('#panel,#screen,#hud')) pt(e); });
    document.addEventListener('keydown', e => { const sc = this.scene; if (!sc || !sc.isLevel || this.paused || !$('screen').hidden) return;
      if (e.key === 'Escape') S.pause(this); else if (sc.move && e.key === 'ArrowUp') { sc.move(1); e.preventDefault(); } else if (sc.move && e.key === 'ArrowDown') { sc.move(-1); e.preventDefault(); } else if (sc.place && e.key === 'Enter') sc.place(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { this.audio.ensure(); if (this.scene && this.scene.isLevel) this.audio.keepAwake(true); }
      if (document.hidden && this.scene && this.scene.isLevel && !this.paused && $('screen').hidden) S.pause(this); });
    window.addEventListener('error', () => { if (!this._err) { this._err = true; this.toast('Etwas ist schiefgegangen. Bitte lade die Seite neu – dein Spielstand bleibt erhalten.'); } });
    const fit = () => { const s = Math.min(window.innerWidth / 1280, window.innerHeight / 800); $('stage').style.transform = `translate(-50%,-50%) scale(${s})`; $('rotate').hidden = window.innerWidth >= window.innerHeight; };
    window.addEventListener('orientationchange', () => setTimeout(fit, 250)); window.addEventListener('resize', fit); fit();
    this.applyProfile(); this.hud.hide(); S.title(this); this.last = performance.now(); requestAnimationFrame(t => this.loop(t)); track('start'); this.ready = this.boot();
  }
  /** Gespeicherten Schlüssel prüfen und Adress-Anhänge auswerten: #k=Schlüssel schaltet frei, #s=Spielstand lädt einen Spielstand. */
  async boot() {
    if (this.state.licenseKey) { try { this.license = await verifyKey(this.state.licenseKey); } catch (e) { this.license = null; } }
    const h = decodeURIComponent(location.hash || ''); const clear = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* egal */ } };
    if (h.startsWith('#k=')) { clear(); try { await this.activate(h.slice(3)); S.notice(this, 'Vollversion freigeschaltet', this.license.until ? `Dein Abo läuft bis zum ${this.license.until.toLocaleDateString('de-DE')}. Viel Spaß!` : 'Alle Welten sind jetzt offen. Viel Spaß!'); } catch (e) { S.notice(this, 'Das hat nicht geklappt', e.message); } }
    else if (h.startsWith('#s=')) { clear(); try { const p = await importPayload(h.slice(3)); S.confirmImport(this, p); } catch (e) { S.notice(this, 'Das hat nicht geklappt', e.message); } }
  }
  async activate(key) { const lic = await verifyKey(key); if (!isActive(lic)) throw new Error('Dieser Schlüssel ist abgelaufen.'); this.license = lic; this.state.licenseKey = String(key).replace(/\s+/g, ''); this.save(); track('freigeschaltet-' + lic.type); return lic; }
  get licensed() { return isActive(this.license); }
  /** In der Kauf-Variante sind nur die ersten Level frei. */
  locked(level) { return CONFIG.shop && !this.licensed && !CONFIG.freeLevels.includes(level.id); }
  get profile() { return this.state.profiles.find(p => p.id === this.state.current) || null; }
  get keysOn() { const p = this.profile; return this.keysSession || !!(p && p.keys); }
  get listening() { return this.audio.micState === 'on' && !this.keysOn; }
  applyProfile() { const p = this.profile; this.heroFrames = G.makeHero(p ? p.hero : 0); if (p) { this.audio.setA4(p.a4); this.audio.muted = !!p.muted; this.audio.musicOff = p.music === false; if (this.audio.muted || this.audio.musicOff) this.audio.stopMusic(); } }
  save() { return persist(this.store, this.state); }
  flush() {
    const p = this.profile;
    if (p && this.sec >= 1) { const k = dayKey(), before = p.days[k] || 0, goal = (p.goal || 5) * 60; addPractice(p, this.sec); this.playTotal += this.sec; this.sec = 0;
      if (before < goal && p.days[k] >= goal) { this.toast(`Tagesziel geschafft: <b>${p.goal || 5} Minuten</b> geübt!`); this.audio.sfx('star'); track('tagesziel'); }
      while (this.playTotal >= 300) { this.playTotal -= 300; track('spielzeit-5min'); } }
    this.save();
  }
  background(theme) { return this.bgCache[theme] || (this.bgCache[theme] = G.makeBackground(theme)); }
  backdrop(theme) { this.$('toast').hidden = true; if (this.musicReady) this.audio.startMusic(); if (this.scene && this.scene.isLevel) this.flush(); if (!(this.scene instanceof Backdrop) || this.scene.theme !== theme) this.scene = new Backdrop(this, theme); this.hud.hide(); this.bubble(null); this.calib = null; this.audio.keepAwake(false); }
  levelNoteKeys(level) { return level.notes; }
  keyTap(midi) { const sc = this.scene; if (sc && sc.onNote && this.keysOn && !this.paused && this.$('screen').hidden) { this.audio.ensure(); sc.onNote(midi); } }
  hudCr() { const p = this.profile; this.$('hudCr').innerHTML = `Notenwesen <b>${p ? p.creatures.length : 0}</b>`; }

  screen(html, handlers = {}, cls = '') {
    const sc = this.$('screen'); sc.hidden = false; sc.className = cls; sc.innerHTML = `<div class="sheet">${html}</div>`; S.fill(sc);
    sc.onclick = e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled && handlers[b.dataset.act]) handlers[b.dataset.act](b); };
    const f = sc.querySelector('.go,[data-act]'); if (f && document.activeElement && document.activeElement.tagName !== 'INPUT') f.focus({ preventScroll: true });
  }
  closeScreen() { const sc = this.$('screen'); sc.hidden = true; sc.innerHTML = ''; }
  bubble(html, secs = 0) { const b = this.$('bubble'); clearTimeout(this._bt); if (!html) { b.hidden = true; return; } b.innerHTML = html; b.hidden = false; if (secs) this._bt = setTimeout(() => { b.hidden = true; }, secs * 1000); }
  toast(html, note) { const t = this.$('toast'); t.innerHTML = `<span>${html}</span>`; if (note) { const c = G.makeCreature(((note.step % 7) + 7) % 7, note.alt); c.className = 'pix'; t.prepend(c); } t.hidden = false; clearTimeout(this._tt); this._tt = setTimeout(() => { t.hidden = true; }, 2400); this.hudCr(); }

  runLevel(level) {
    this.closeScreen(); this.paused = false; this.calib = null; this.bubble(null); this.hud.extra('');
    this.audio.keepAwake(true); this.audio.stopMusic();
    const Cls = { jump: JumpScene, boss: JumpScene, regen: RegenScene, bau: BauScene }[level.type]; this.scene = new Cls(this, level); this.scene.enter();
  }
  finishLevel(level, res) {
    const p = this.profile, stars = res.stars != null ? res.stars : starsFor(res.ratio), prev = p.levels[level.id], rec = prev || { stars: 0 };
    const out = { ...res, stars, firstClear: !prev }; rec.stars = Math.max(rec.stars, stars);
    if (res.time != null) { const nb = !rec.time || res.time < rec.time; if (nb) rec.time = Math.round(res.time * 10) / 10; if (p.mode === 'profi') { out.newBest = nb; out.bestTime = rec.time; } }
    if (res.score != null) { out.newBest = !rec.score || res.score > rec.score; rec.score = Math.max(rec.score || 0, res.score); out.bestScore = rec.score; p.regenBest = Math.max(p.regenBest || 0, res.score); }
    p.levels[level.id] = rec; this.scene.isLevel = false; track('level/' + level.id); this.flush(); this.bubble(null); this.$('hud').hidden = true; S.result(this, level, out);
  }
  loop(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000); this.last = ts; const sc = this.scene;
    if (!this.paused) {
      const ev = this.audio.poll(ts), sink = this.calib || (this.$('screen').hidden ? sc : null);
      if (ev && sink && sink.onNote && (this.calib || this.listening)) sink.onNote(ev.midi, ev);
      if (this.calib) this.calib.level(this.audio.level);
      else if (sc && sc.isLevel && sc.onNote) { const h = this.listening ? this.audio.heard : null; this.panel.setLevel(this.listening ? this.audio.level : 0); this.panel.setHeard(h ? h.midi : null); }
      if (sc) { sc.update(dt); if (sc.isLevel) { this.sec += dt; if (this.sec > 20) this.flush(); } }
    }
    if (sc) { this.ctx.fillStyle = (G.THEMES[sc.theme] || G.THEMES.himmel).hill[4]; this.ctx.fillRect(0, 0, 320, 200); this.tx.clearRect(0, 0, 1280, 800); sc.draw(this.ctx, this.tx); }
    requestAnimationFrame(t => this.loop(t));
  }
}
const start = () => { window.__nb = new App(); window.__levels = LEVELS; window.__screens = S; window.__config = CONFIG; };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(start, start); else start();
