// Freischalt-Schlüssel: vom Anbieter signiert (ECDSA P-256), im Spiel nur prüfbar. Kein Server nötig.
import { CONFIG } from './config.js';
const EPOCH = Date.UTC(2026, 0, 1), ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const b64 = bytes => { let bin = ''; for (const c of bytes) bin += String.fromCharCode(c); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

/** @returns {{type:'einmal'|'abo', until:Date|null, serial:number}} */
export async function verifyKey(str, pubKey = CONFIG.pubKey) {
  const m = /NBK([A-Za-z0-9_-]{90,100})/.exec(String(str).replace(/\s+/g, '')); if (!m) throw new Error('Das ist kein gültiger Schlüssel.');
  let bytes; try { bytes = unb64(m[1]); } catch (e) { throw new Error('Das ist kein gültiger Schlüssel.'); }
  if (bytes.length !== 71 || bytes[0] !== 1) throw new Error('Das ist kein gültiger Schlüssel.');
  const key = await crypto.subtle.importKey('jwk', pubKey, ALG, false, ['verify']);
  if (!(await crypto.subtle.verify(SIG, key, bytes.slice(7), bytes.slice(0, 7)))) throw new Error('Dieser Schlüssel ist nicht echt oder falsch kopiert.');
  const days = bytes[2] * 256 + bytes[3];
  return { type: bytes[1] ? 'abo' : 'einmal', until: days ? new Date(EPOCH + days * 864e5) : null, serial: (bytes[4] << 16) | (bytes[5] << 8) | bytes[6] };
}
export function isActive(lic, now = new Date()) { return !!lic && (!lic.until || lic.until.getTime() + 864e5 > now.getTime()); }
/** Nur für das Schlüssel-Werkzeug und die Tests: braucht den geheimen Schlüssel. */
export async function signKey(privJwk, { type, until, serial }) {
  const days = until ? Math.round((Date.UTC(until.getFullYear(), until.getMonth(), until.getDate()) - EPOCH) / 864e5) : 0;
  const payload = Uint8Array.from([1, type === 'abo' ? 1 : 0, days >> 8, days & 255, (serial >> 16) & 255, (serial >> 8) & 255, serial & 255]);
  const key = await crypto.subtle.importKey('jwk', privJwk, ALG, false, ['sign']); const sig = new Uint8Array(await crypto.subtle.sign(SIG, key, payload));
  const all = new Uint8Array(71); all.set(payload); all.set(sig, 7); return 'NBK' + b64(all);
}
