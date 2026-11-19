// Mikrofon (Web Audio) und kurze, synthetische Spielklänge. Während ein Klang läuft, hört das Spiel nicht zu.
import { detectPitch, NoteTracker } from './pitch.js';
import { freqOfMidi } from './music.js';

const SFX = {
  ok: [[784, 0, .07], [1175, .07, .13]], jump: [[392, 0, .05], [523, .05, .05], [659, .1, .06]], oops: [[233, 0, .1, 'triangle'], [196, .1, .16, 'triangle']],
  free: [[1047, 0, .07], [1319, .07, .07], [1568, .14, .07], [2093, .21, .16]], click: [[660, 0, .04]], star: [[1319, 0, .08], [1760, .08, .14]],
  done: [[523, 0, .11], [659, .11, .11], [784, .22, .11], [1047, .33, .3]], miss: [[262, 0, .12, 'triangle']],
};
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
  /** Klavierähnlicher Ton (für Brückenbauer und Sammlung). */
  playNote(midi) {
    if (this.muted || !this.ensure()) return; const t = this.ctx.currentTime + 0.01, f = freqOfMidi(midi);
    try { this.tone(f, t, 0.9, 'triangle', 0.16); this.tone(f * 2, t, 0.5, 'sine', 0.05); } catch (e) { return; }
    this.gateUntil = Math.max(this.gateUntil, performance.now() + 1050);
  }
}
