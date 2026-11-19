// Anonyme Zählung (GoatCounter): nur Ereignisnamen, keine Namen, keine Kennungen, keine Cookies. Aus, solange kein Kürzel gesetzt ist.
import { CONFIG } from './config.js';
export const sent = [];
export function track(name) {
  const ev = (CONFIG.shop ? 'kauf/' : 'test/') + name; sent.push(ev);
  if (!CONFIG.statsCode || typeof Image === 'undefined') return;
  try { new Image().src = `https://${CONFIG.statsCode}.goatcounter.com/count?p=${encodeURIComponent(ev)}&e=true&t=${encodeURIComponent(ev)}&rnd=${Math.random().toString(36).slice(2, 8)}`; } catch (e) { /* Zählung darf das Spiel nie stören */ }
}
