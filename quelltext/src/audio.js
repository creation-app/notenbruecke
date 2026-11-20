// Mikrofon (Web Audio) und kurze, synthetische Spielklänge. Während ein Klang läuft, hört das Spiel nicht zu.
import { detectPitch, NoteTracker } from './pitch.js';
import { freqOfMidi } from './music.js';

const SFX = {
  ok: [[784, 0, .07], [1175, .07, .13]], jump: [[392, 0, .05], [523, .05, .05], [659, .1, .06]], oops: [[233, 0, .1, 'triangle'], [196, .1, .16, 'triangle']],
  free: [[1047, 0, .07], [1319, .07, .07], [1568, .14, .07], [2093, .21, .16]], click: [[660, 0, .04]], star: [[1319, 0, .08], [1760, .08, .14]],
  done: [[523, 0, .11], [659, .11, .11], [784, .22, .11], [1047, .33, .3]], miss: [[262, 0, .12, 'triangle']],
};
// ---- Musik: eigener Titelsong und Erfolgsmelodie, komplett im Browser erzeugt (kein Mitschnitt, keine fremden Stücke).
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function pitch(name) { const m = /^([A-G])(#?)(\d)$/.exec(name); return 440 * Math.pow(2, (12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] ? 1 : 0) - 69) / 12); }
// Achtel-Raster, 8 Takte. "-" hält den Ton, "." ist Pause. Das Motiv c–e–g ist die "Brücke".
export const SONG = { bpm: 126,
  lead: ('E5 G5 C6 G5 E5 G5 A5 G5 ' + 'F5 A5 C6 A5 G5 - E5 - ' + 'D5 F5 A5 F5 D5 F5 G5 F5 ' + 'E5 - G5 - C5 - - . ' +
         'E5 G5 C6 G5 E5 G5 A5 G5 ' + 'F5 A5 C6 D6 E6 - C6 - ' + 'D6 C6 A5 F5 G5 A5 B5 D6 ' + 'C6 - - - G5 C6 - .').split(' '),
  bass: [['C2', 'G2'], ['F2', 'C3'], ['D2', 'A2'], ['C2', 'G2'], ['C2', 'G2'], ['F2', 'C3'], ['G2', 'D3'], ['C2', 'G2']],
  pad: [['E4', 'G4'], ['F4', 'A4'], ['F4', 'A4'], ['E4', 'G4'], ['E4', 'G4'], ['F4', 'A4'], ['D4', 'G4'], ['E4', 'G4']] };
export class GameAudio {
  constructor() { this.ctx = null; this.micState = 'off'; this.gateUntil = 0; this.gated = false; this.level = 0; this.tracker = new NoteTracker(); this.lastPoll = 0; this.muted = false; }
  ensure() {
    try { if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); } catch (e) { this.ctx = null; }
    return this.ctx;
  }
  /** Bildschirm wach halten: Beim Klavierspielen berührt niemand das Tablet. */
  async keepAwake(on) {
    try { if (on && !this.lock && navigator.wakeLock) { this.lock = await navigator.wakeLock.request('screen'); this.lock.addEventListener('release', () => { this.lock = null; }); }
      else if (!on && this.lock) { await this.lock.release(); this.lock = null; } } catch (e) { this.lock = null; }
  }
  setA4(a4) { this.tracker.a4 = a4 || 440; }
  /** Muss aus einem Klick heraus aufgerufen werden. @returns {'on'|'denied'|'unsupported'} */
  async startMic() {
    if (this.micState === 'on') return 'on';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !this.ensure()) return (this.micState = 'unsupported');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      this.src = this.ctx.createMediaStreamSource(this.stream); this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 4096; this.analyser.smoothingTimeConstant = 0;
      this.src.connect(this.analyser); this.sink = this.ctx.createGain(); this.sink.gain.value = 0; this.analyser.connect(this.sink); this.sink.connect(this.ctx.destination);
      this.buf = new Float32Array(4096); this.half = new Float32Array(2048); this.bytes = new Uint8Array(4096);
      const tr = this.stream.getAudioTracks()[0]; if (tr) tr.addEventListener('ended', () => { this.micState = 'off'; }); this.tracker.reset(); return (this.micState = 'on');
    } catch (e) { return (this.micState = 'denied'); }
  }
  /** Liefert ein Noten-Ereignis, sobald ein Ton stabil erkannt wurde. */
  poll(now) {
    if (this.micState !== 'on' || now - this.lastPoll < 45) return null;
    this.lastPoll = now; if (this.ctx.state !== 'running') { this.ctx.resume().catch(() => {}); return null; }
    if (this.analyser.getFloatTimeDomainData) this.analyser.getFloatTimeDomainData(this.buf); else { this.analyser.getByteTimeDomainData(this.bytes); for (let i = 0; i < 4096; i++) this.buf[i] = (this.bytes[i] - 128) / 128; }
    if (now < this.gateUntil) { this.gated = true; this.level = 0; return null; }
    if (this.gated) { this.gated = false; this.tracker.resume(); }
    const d = this.half; for (let i = 0; i < 2048; i++) d[i] = (this.buf[2 * i] + this.buf[2 * i + 1]) * 0.5;
    const res = detectPitch(d, this.ctx.sampleRate / 2); this.level = res ? res.rms : 0;
    return this.tracker.push(res, now);
  }
  get heard() { return this.micState === 'on' && !this.gated ? this.tracker.current : null; }
  tone(freq, at, dur, type = 'square', vol = 0.06) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur + 0.02);
  }
  sfx(name) {
    if (this.muted || !this.ensure()) return; const seq = SFX[name], t = this.ctx.currentTime + 0.01; let end = 0;
    try { for (const [f, s, d, type] of seq) { this.tone(f, t + s, d, type || 'square'); end = Math.max(end, s + d); } } catch (e) { return; }
    this.gateUntil = Math.max(this.gateUntil, performance.now() + end * 1000 + 140);
  }
  /** Stimme für die Musik: läuft über einen eigenen Lautstärkeregler mit etwas Hall. */
  voice(freq, at, dur, type, vol, slide) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, at); if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.012); g.gain.setValueAtTime(vol, at + Math.max(0.02, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g); g.connect(this.bus); o.start(at); o.stop(at + dur + 0.03);
  }
  hat(at, vol) { const c = this.ctx; if (!this.noise) { this.noise = c.createBuffer(1, 2205, 44100); const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); }
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.bus); s.start(at); }
  ensureBus() {
    if (this.bus || !this.ensure()) return !!this.bus; const c = this.ctx; this.bus = c.createGain(); this.bus.gain.value = 0; this.bus.connect(c.destination);
    const d = c.createDelay(0.5), fb = c.createGain(), wet = c.createGain(); d.delayTime.value = 0.19; fb.gain.value = 0.28; wet.gain.value = 0.22; this.bus.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(c.destination); return true;
  }
  /** Titelsong in Schleife. Nur in den Menüs: Im Level muss das Mikrofon das Klavier hören. */
  startMusic() {
    if (this.muted || this.musicOff || this.musicTimer || !this.ensureBus()) return; const c = this.ctx, step = 60 / SONG.bpm / 2; let i = 0, next = c.currentTime + 0.08;
    this.bus.gain.cancelScheduledValues(c.currentTime); this.bus.gain.setValueAtTime(this.bus.gain.value, c.currentTime); this.bus.gain.linearRampToValueAtTime(1, c.currentTime + 0.4);
    const tick = () => { if (typeof document !== 'undefined' && document.hidden) { next = c.currentTime + 0.1; return; } if (next < c.currentTime - 0.5) next = c.currentTime + 0.05;
      while (next < c.currentTime + 0.3) { const tok = SONG.lead[i], bar = i >> 3, k = i & 7;
        try { if (tok !== '-' && tok !== '.') { let n = 1; while (SONG.lead[(i + n) % 64] === '-' && n < 8) n++; const f = pitch(tok); this.voice(f, next, step * n * 0.94, 'square', 0.045); this.voice(f / 2, next, step * n * 0.9, 'triangle', 0.05); }
          const b = SONG.bass[bar]; if (k % 2 === 0) this.voice(pitch(k === 4 ? b[1] : b[0]) * (k === 2 || k === 6 ? 2 : 1), next, step * 1.7, 'triangle', 0.11);
          if (k === 2 || k === 6) for (const p of SONG.pad[bar]) this.voice(pitch(p), next, step * 1.2, 'sine', 0.035);
          if (k === 0 || k === 4) this.voice(150, next, 0.11, 'sine', 0.16, 45); this.hat(next, k % 2 ? 0.018 : 0.035); } catch (e) { /* ein fehlender Ton darf nichts stoppen */ }
        next += step; i = (i + 1) % 64; } };
    tick(); this.musicTimer = setInterval(tick, 90);
  }
  stopMusic() { if (!this.musicTimer) return; clearInterval(this.musicTimer); this.musicTimer = null; const c = this.ctx; this.bus.gain.cancelScheduledValues(c.currentTime); this.bus.gain.setValueAtTime(this.bus.gain.value, c.currentTime); this.bus.gain.linearRampToValueAtTime(0, c.currentTime + 0.25); this.gateUntil = Math.max(this.gateUntil, performance.now() + 700); }
  /** Erfolgsmelodie nach einem geschafften Level; mit drei Sternen etwas länger. */
  fanfare(stars = 1) {
    if (this.muted || !this.ensureBus()) return; const c = this.ctx, t = c.currentTime + 0.05, s = 0.115; this.bus.gain.cancelScheduledValues(c.currentTime); this.bus.gain.setValueAtTime(1, c.currentTime);
    const lead = [['G4', 0, 1], ['C5', 1, 1], ['E5', 2, 1], ['G5', 3, 1], ['C6', 4, 3], ['A5', 7, 1], ['B5', 8, 1], ['C6', 9, stars >= 3 ? 2 : 5]]; if (stars >= 3) lead.push(['D6', 11, 1], ['E6', 12, 1], ['G6', 13, 5]);
    try { for (const [n, at, len] of lead) { const f = pitch(n); this.voice(f, t + at * s, len * s * 0.95, 'square', 0.05); this.voice(f / 2, t + at * s, len * s * 0.95, 'triangle', 0.06); }
      for (const [n, at, len] of [['C3', 0, 4], ['F3', 4, 3], ['G3', 7, 2], ['C3', 9, stars >= 3 ? 9 : 5]]) this.voice(pitch(n), t + at * s, len * s, 'triangle', 0.12);
      for (const [a, b, at] of [['E4', 'G4', 4], ['F4', 'A4', 7], ['E4', 'G4', 9]]) { this.voice(pitch(a), t + at * s, 3 * s, 'sine', 0.04); this.voice(pitch(b), t + at * s, 3 * s, 'sine', 0.04); } } catch (e) { return; }
    this.gateUntil = Math.max(this.gateUntil, performance.now() + (stars >= 3 ? 2400 : 1900));
  }
  /** Klavierähnlicher Ton (für Brückenbauer und Sammlung). */
  playNote(midi) {
    if (this.muted || !this.ensure()) return; const t = this.ctx.currentTime + 0.01, f = freqOfMidi(midi);
    try { this.tone(f, t, 0.9, 'triangle', 0.16); this.tone(f * 2, t, 0.5, 'sine', 0.05); } catch (e) { return; }
    this.gateUntil = Math.max(this.gateUntil, performance.now() + 1050);
  }
}
