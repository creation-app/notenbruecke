import fs from 'node:fs'; import { freqOfMidi } from '../src/music.js';
export function piano(midi, dur, sr = 48000, gain = 0.3) { const f = freqOfMidi(midi), n = Math.round(dur * sr), o = new Float32Array(n), B = 0.0004, amps = [1, .6, .4, .25, .18, .1, .06];
  for (let i = 0; i < n; i++) { const t = i / sr; let s = 0; amps.forEach((a, h) => { const k = h + 1; s += a * Math.sin(2 * Math.PI * f * k * Math.sqrt(1 + B * k * k) * t) * Math.exp(-t * (1.6 + .7 * h)); });
    const rel = Math.min(1, (dur - t) / 0.08); o[i] = gain * s * Math.min(1, t / .004) * Math.max(0, rel) + 0.002 * (Math.random() * 2 - 1); } return o; }
export function writeWav(path, parts, sr = 48000) { const n = parts.reduce((a, p) => a + p.length, 0), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  let k = 44; for (const p of parts) for (let i = 0; i < p.length; i++) { b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(p[i] * 32767))), k); k += 2; } fs.writeFileSync(path, b); }
