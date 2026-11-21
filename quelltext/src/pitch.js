// Tonhöhenerkennung (McLeod Pitch Method) + Stabilitätsprüfung.
import { midiOfFreq } from './music.js';

/** @returns {{freq:number, clarity:number, rms:number}|null} */
export function detectPitch(buf, sampleRate, opt = {}) {
  const minF = opt.minF || 58, maxF = opt.maxF || 2200, n = buf.length;
  let e = 0; for (let i = 0; i < n; i++) e += buf[i] * buf[i];
  const rms = Math.sqrt(e / n);
  if (rms < 1e-4) return null;
  const maxLag = Math.min(Math.floor(sampleRate / minF), n >> 1), minLag = Math.max(2, Math.floor(sampleRate / maxF));
  const W = n - maxLag, nsdf = new Float32Array(maxLag + 1);
  for (let tau = 0; tau <= maxLag; tau++) {
    let acf = 0, m = 0;
    for (let i = 0; i < W; i++) { const a = buf[i], b = buf[i + tau]; acf += a * b; m += a * a + b * b; }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }
  // Schlüsselmaxima zwischen positiven Nulldurchgängen sammeln
  const peaks = []; let tau = 1;
  while (tau < maxLag && nsdf[tau] > 0) tau++;
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++;
    let best = -1, bestV = 0;
    while (tau < maxLag && nsdf[tau] > 0) { if (nsdf[tau] > bestV) { bestV = nsdf[tau]; best = tau; } tau++; }
    if (best >= minLag && best < maxLag) peaks.push(best);
  }
  if (!peaks.length) return null;
  let top = 0; for (const p of peaks) top = Math.max(top, nsdf[p]);
  const thr = top * (opt.k || 0.9);
  const lag = peaks.find(p => nsdf[p] >= thr);
  const a = nsdf[lag - 1], b = nsdf[lag], c = nsdf[lag + 1], d = a - 2 * b + c;
  const shift = d ? 0.5 * (a - c) / d : 0;
  return { freq: sampleRate / (lag + shift), clarity: b, rms };
}

/**
 * Entscheidet erst nach stabiler Messung, dass eine Note gespielt wurde.
 * Meldet jeden Anschlag genau einmal, auch bei Tonwiederholungen.
 */
export class NoteTracker {
  constructor(opt = {}) {
    this.holdMs = opt.holdMs || 200; this.minClarity = opt.minClarity || 0.86; this.minRms = opt.minRms || 0.002; // leiser erlaubt: viele Geräte nehmen das Klavier nur schwach auf
    this.a4 = opt.a4 || 440; this.reset();
  }
  reset() { this.cand = null; this.since = 0; this.cents = []; this.lastEmit = null; this.lowRms = Infinity; this.onset = true; this.current = null; this.emitRms = 0; }
  /** Nach einer Hörpause: ein noch klingender Ton zählt nicht erneut, ein neuer Anschlag schon. */
  resume() { this.cand = null; this.current = null; this.onset = false; this.lowRms = Infinity; }
  /** @returns {{midi:number,cents:number,freq:number}|null} */
  push(res, t) {
    if (!res || res.rms < this.minRms) { this.cand = null; this.current = null; this.onset = true; this.lowRms = 0; return null; }
    // Anschlag erkennen: Lautstärke steigt deutlich über das bisherige Minimum
    if (res.rms < this.lowRms) this.lowRms = res.rms;
    else if (res.rms > 1.5 * this.lowRms + 0.002) { this.onset = true; this.lowRms = res.rms; this.since = t; }
    if (res.clarity < this.minClarity) { this.cand = null; this.current = null; return null; }
    const mf = midiOfFreq(res.freq, this.a4), m = Math.round(mf);
    this.current = { midi: m, cents: (mf - m) * 100, freq: res.freq, rms: res.rms };
    if (m !== this.cand) { this.cand = m; this.since = t; this.cents = []; }
    this.cents.push((mf - m) * 100);
    const held = t - this.since;
    // Anderer Ton ohne hörbaren Anschlag (Legato): nur wenn er nicht bloß ein leiser Ausklang-Fehler ist
    const changed = this.lastEmit !== null && m !== this.lastEmit && (res.rms >= 0.3 * this.emitRms || held >= 2.5 * this.holdMs);
    if (held >= this.holdMs && (this.onset || changed)) {
      this.onset = false; this.lastEmit = m; this.lowRms = res.rms; this.emitRms = res.rms;
      const s = this.cents.slice().sort((x, y) => x - y);
      return { midi: m, cents: s[s.length >> 1], freq: res.freq };
    }
    return null;
  }
}

/** Kalibrierung: aus gemessenen Cent-Abweichungen den Kammerton ableiten (begrenzt auf ±60 Cent). */
export function a4FromCents(centsList) {
  if (!centsList.length) return 440;
  const s = centsList.slice().sort((x, y) => x - y); const med = Math.max(-60, Math.min(60, s[s.length >> 1]));
  return 440 * Math.pow(2, med / 1200);
}
