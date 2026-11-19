// Schrift auf der scharfen Text-Ebene (1280×600) über der Pixelwelt. Koordinaten in Weltpixeln.
import { nameParts } from './music.js';
export const SC = 4;
export function label(t, text, x, y, o = {}) {
  const size = o.size || 22; t.font = `${o.weight || 700} ${size}px "Atkinson Hyperlegible", system-ui, sans-serif`; t.textAlign = o.align || 'center'; t.textBaseline = 'middle';
  if (o.stroke) { t.lineWidth = 6; t.strokeStyle = o.stroke; t.lineJoin = 'round'; t.strokeText(text, x * SC, y * SC); }
  t.fillStyle = o.color || '#26364B'; t.fillText(text, x * SC, y * SC);
}
/** Notenname mit hochgestellter Oktavzahl, zentriert. */
export function noteLabel(t, n, x, y, o = {}) {
  const p = nameParts(n), size = o.size || 22, f = (s) => `700 ${s}px "Atkinson Hyperlegible", system-ui, sans-serif`;
  t.font = f(size); const w1 = t.measureText(p.base).width; t.font = f(size * 0.62); const w2 = p.sup ? t.measureText(p.sup).width + 1 : 0;
  const x0 = x * SC - (w1 + w2) / 2; t.textAlign = 'left'; t.textBaseline = 'middle';
  const draw = (txt, xx, yy, s) => { t.font = f(s); if (o.stroke) { t.lineWidth = 6; t.strokeStyle = o.stroke; t.lineJoin = 'round'; t.strokeText(txt, xx, yy); } t.fillStyle = o.color || '#26364B'; t.fillText(txt, xx, yy); };
  draw(p.base, x0, y * SC, size); if (p.sup) draw(p.sup, x0 + w1 + 1, y * SC - size * 0.32, size * 0.62);
}
