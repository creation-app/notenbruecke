// Einstieg: Spielschleife, Szenenwechsel, Speicher, HUD.
import { load, persist, addPractice, dayKey, importPayload } from './save.js';
import { CONFIG } from './config.js';
import { verifyKey, isActive } from './license.js';
import { track } from './stats.js';
import { GameAudio } from './audio.js';
import { Panel } from './panel.js';
import * as G from './gfx.js';
import { starsFor, LEVELS, totalStars } from './levels.js';
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
    this.app.drawBuddy(ctx, this, back && walking ? x + 30 : x - 12, 108, this.t, walking ? 0 : Math.abs(Math.sin(this.t * 4)) * 3);
    if (back && walking) { ctx.save(); ctx.translate(G.q(x) + 18, 113); ctx.scale(-1, 1); ctx.drawImage(f, 0, 0); ctx.restore(); } else ctx.drawImage(f, G.q(x), 113); }
}
class App {
  constructor() {
    const $ = id => document.getElementById(id); this.$ = $;
    this.world = $('world'); this.ctx = this.world.getContext('2d'); this.ctx.setTransform(4, 0, 0, 4, 0, 0); this.ctx.imageSmoothingEnabled = false; this.tx = $('text').getContext('2d');
    this.store = (() => { try { const s = window.localStorage; s.getItem('x'); return s; } catch (e) { return null; } })();
    this.state = load(this.store); this.audio = new GameAudio(); this.panel = new Panel($('panel'), this); this.bgCache = {}; this.sec = 0; this.playTotal = 0; this.license = null; this.keysSession = false; this.paused = false;
    this.hud = { show: (t) => { $('hud').hidden = false; $('panel').hidden = false; $('sndBtn').hidden = true; $('hudTitle').textContent = t; this.hudCr(); }, hide: () => { $('hud').hidden = true; $('panel').hidden = true; $('sndBtn').hidden = false; },
      extra: h => { $('hudExtra').innerHTML = h; $('hudExtra').hidden = !h; },
      progress: (i, n) => { const e = $('hudProg'); e.hidden = !n; if (n) { e.innerHTML = n <= 16 ? Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'on' : ''}"></i>`).join('') : `${i} / ${n}`; e.setAttribute('aria-label', `${i} von ${n}`); } } };
    const SPK = on => `<svg aria-hidden="true" width="30" height="30" viewBox="0 0 10 10" shape-rendering="crispEdges"><g fill="#26364B"><rect x="1" y="4" width="2" height="2"/><rect x="3" y="3" width="1" height="4"/><rect x="4" y="2" width="1" height="6"/>${on ? '<rect x="6" y="3" width="1" height="1"/><rect x="7" y="4" width="1" height="2"/><rect x="6" y="6" width="1" height="1"/><rect x="8" y="2" width="1" height="1"/><rect x="9" y="3" width="1" height="4"/><rect x="8" y="7" width="1" height="1"/>' : '<rect x="6" y="3" width="1" height="1"/><rect x="7" y="4" width="1" height="1"/><rect x="8" y="5" width="1" height="1"/><rect x="9" y="6" width="1" height="1"/><rect x="9" y="3" width="1" height="1"/><rect x="8" y="4" width="1" height="1"/><rect x="7" y="5" width="1" height="1"/><rect x="6" y="6" width="1" height="1"/>'}</g></svg>`;
    this.paintSound = () => { for (const id of ['sndHud', 'sndBtn']) { const b = $(id), m = this.audio.muted; b.innerHTML = SPK(!m); b.classList.toggle('off', m); b.setAttribute('aria-label', m ? 'Ton einschalten' : 'Ton ausschalten'); b.setAttribute('aria-pressed', String(m)); } };
    for (const id of ['sndHud', 'sndBtn']) $(id).addEventListener('click', () => this.setMuted(!this.audio.muted));
    // Gerät zugeklappt, Tab gewechselt oder App verlassen: sofort alles stumm schalten
    const quiet = () => { this.audio.stopMusic(); try { if (this.audio.bus) this.audio.bus.gain.value = 0; if (this.audio.ctx && this.audio.ctx.state === 'running') this.audio.ctx.suspend(); } catch (e) { /* egal */ } };
    window.addEventListener('pagehide', quiet); window.addEventListener('freeze', quiet); this.quiet = quiet;
    $('pauseBtn').addEventListener('click', () => { if (this.scene && this.scene.isLevel) S.pause(this); });
    const pt = e => { if (!this.scene || !this.scene.pointer || this.paused) return; const r = this.world.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height; if (this.rot) this.scene.pointer(v * 320, (1 - u) * 200); else this.scene.pointer(u * 320, v * 200); };
    $('stage').addEventListener('pointerdown', e => { if (e.target.closest('#panel,#screen,#hud')) return; pt(e); }); $('stage').addEventListener('pointermove', e => { if (e.buttons && !e.target.closest('#panel,#screen,#hud')) pt(e); });
    document.addEventListener('keydown', e => { const sc = this.scene; if (!sc || !sc.isLevel || this.paused || !$('screen').hidden) return;
      if (e.key === 'Escape') S.pause(this); else if (sc.move && e.key === 'ArrowUp') { sc.move(1); e.preventDefault(); } else if (sc.move && e.key === 'ArrowDown') { sc.move(-1); e.preventDefault(); } else if (sc.place && e.key === 'Enter') sc.place(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.quiet(); else { this.audio.ensure(); if (this.scene && this.scene.isLevel) this.audio.keepAwake(true); else if (this.musicReady && this.scene instanceof Backdrop && !this.calib) this.audio.startMusic(); }
      if (document.hidden && this.scene && this.scene.isLevel && !this.paused && $('screen').hidden) S.pause(this); });
    window.addEventListener('error', () => { if (!this._err) { this._err = true; this.toast('Etwas ist schiefgegangen. Bitte lade die Seite neu – dein Spielstand bleibt erhalten.'); } });
    // Hochkant (z. B. Handy mit Drehsperre): Das Spiel wird um 90° gedreht und füllt den Bildschirm, statt den Weg zu versperren.
    const fit = () => { const w = window.innerWidth, h = window.innerHeight, rot = w < h, s = rot ? Math.min(h / 1280, w / 800) : Math.min(w / 1280, h / 800); const was = this.rot; this.rot = rot; $('stage').classList.toggle('phone', s < 0.62);
      $('stage').style.transform = `translate(-50%,-50%) ${rot ? 'rotate(90deg) ' : ''}scale(${s})`; const el = $('rotate'); if (rot && !was) { el.hidden = false; clearTimeout(this._rotT); this._rotT = setTimeout(() => { el.hidden = true; }, 6000); } else if (!rot) el.hidden = true; };
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
  /** Begleiter: ein gesammeltes Notenwesen schwebt der Figur hinterher (weich nachgezogen, wippt, hüpft bei Erfolg). o merkt sich die Position. */
  drawBuddy(ctx, o, tx, ty, t, hop = 0) { const b = this.buddy; if (!b) return; if (o.bx === undefined || Math.abs(o.bx - tx) > 140) { o.bx = tx; o.by = ty; o.bt = t; }
    const dt = Math.min(0.1, Math.max(0, t - o.bt)), k = 1 - Math.exp(-dt * 5); o.bt = t; o.bx += (tx - o.bx) * k; o.by += (ty - o.by) * k;
    const y = o.by + Math.sin(t * 3) * 2 - hop; if (this.buddySure && Math.floor(t * 6) % 3 === 0) { ctx.fillStyle = '#FFF1D6'; ctx.fillRect(G.q(o.bx - 11 + (Math.floor(t * 6) % 5)), G.q(y + 4 - (Math.floor(t * 4) % 7)), 1, 1); }
    ctx.drawImage(b, G.q(o.bx - 11), G.q(y - 14)); }
  /** Figur (mit Hut) und Begleiter (mit Stufe) neu zeichnen – nach Profilwechsel und immer, wenn die Karte erscheint. */
  refreshLook() { const p = this.profile; this.heroFrames = G.makeHero(p ? p.hero : 0, p ? G.hatOf(p, totalStars(p)) : 0); this.buddy = null; this.buddySure = false;
    if (p && p.buddy && p.creatures.includes(p.buddy)) { const n = N(p.buddy), st = G.buddyStage(p.notes[p.buddy]); this.buddy = G.makeBuddy(((n.step % 7) + 7) % 7, n.alt, st); this.buddySure = st === 2; } }
  applyProfile() { const p = this.profile; this.refreshLook(); this.audio.muted = !!this.state.muted; this.audio.song = this.state.song || 'tanz'; if (p) { this.audio.setA4(p.a4); this.audio.musicOff = p.music === false; } if (this.audio.muted || this.audio.musicOff) this.audio.stopMusic(); if (this.paintSound) this.paintSound(); }
  /** Ton für das ganze Gerät an oder aus (Musik, Spielklänge, Erfolgsmelodie). */
  setMuted(m) { this.state.muted = !!m; this.audio.muted = !!m; this.save(); if (m) { this.audio.stopMusic(); if (this.audio.bus) this.audio.bus.gain.value = 0; } else { this.audio.ensure(); if (this.musicReady && this.scene instanceof Backdrop && !this.calib) this.audio.startMusic(); } this.paintSound(); }
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
    p.levels[level.id] = rec; this.$('sndBtn').hidden = false; this.scene.isLevel = false; track('level/' + level.id); this.flush(); this.bubble(null); this.$('hud').hidden = true; S.result(this, level, out);
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
