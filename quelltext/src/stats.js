// Anonyme Nutzungszahlen: Was wird wie oft gespielt? Keine Namen, keine Cookies, keine Geräte-Kennung.
// Gesendet wird gebündelt an den eigenen Server der Notenbrücke – nur wenn eine Server-Adresse eingetragen ist.
import { CONFIG } from './config.js';

export const sent = []; const queue = new Map(); let timer = null;
export function track(name, n = 1) {
  const ev = (CONFIG.shop ? 'kauf/' : 'test/') + name; sent.push(ev); if (!CONFIG.apiUrl) return;
  queue.set(ev, (queue.get(ev) || 0) + n); if (!timer) timer = setTimeout(() => flushStats(), 30000);
}
export function flushStats() {
  clearTimeout(timer); timer = null; if (!queue.size || !CONFIG.apiUrl) return;
  const events = [...queue].map(([e, n]) => ({ e, n: Math.round(n) })).filter(x => x.n > 0); queue.clear(); if (!events.length) return;
  try { fetch(CONFIG.apiUrl.replace(/\/+$/, '') + '/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events }), keepalive: true }).catch(() => {}); } catch (e) { /* Zählung darf das Spiel nie stören */ }
}
