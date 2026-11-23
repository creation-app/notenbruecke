// Konto: Spielstand online sichern und auf anderen Geräten weiterspielen. Ohne Konto läuft alles wie bisher nur auf dem Gerät.
import { CONFIG } from './config.js';
import { mergeProfiles } from './merge.js';
import { newProfile } from './save.js';

export const accountsOn = () => !!CONFIG.apiUrl;
/** Spielstand ohne Kontodaten – so wird er auf dem Server gespeichert. */
export const strip = p => { const { acct, ...rest } = p || {}; return rest; };
const busy = new Set(); let timer = null;

export async function api(path, { method, body, token, keepalive } = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctrl && setTimeout(() => ctrl.abort(), 15000);
  try {
    const txt = body ? JSON.stringify(body) : undefined;
    const r = await fetch(CONFIG.apiUrl.replace(/\/+$/, '') + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: txt, signal: ctrl ? ctrl.signal : undefined, keepalive: !!keepalive && (!txt || txt.length < 60000) });
    let data = {}; try { data = await r.json(); } catch (e) { /* leer */ }
    return { ...data, ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, status: 0, error: 'Keine Verbindung zum Server. Bist du online?' }; } finally { if (t) clearTimeout(t); }
}
/** Inhalt eines Profils ersetzen, aber lokale Kennung und Kontodaten behalten. */
function replace(p, data) { const { id, acct } = p; for (const k of Object.keys(p)) delete p[k]; Object.assign(p, data, { id, acct }); }
const quietSave = app => { app._quiet = true; try { app.save(); } finally { app._quiet = false; } };

export async function register(app, p, name, password, email) {
  const r = await api('/api/register', { body: { name, password, email: email || undefined, state: strip(p) } }); if (!r.ok) return r;
  p.acct = { name: r.user.name, token: r.token, rev: r.rev, dirty: false, at: Date.now() }; quietSave(app); return r;
}
export async function login(app, loginName, password) {
  const r = await api('/api/login', { body: { login: loginName, password } }); if (!r.ok) return r;
  const st = app.state, server = r.state && Object.keys(r.state).length ? r.state : null; let p = st.profiles.find(x => x.acct && x.acct.name.toLowerCase() === r.user.name.toLowerCase()), dirty = false;
  if (p) { replace(p, server ? mergeProfiles(server, strip(p)) : strip(p)); dirty = true; } // gleiches Konto war hier schon: zusammenführen und das Ergebnis hochladen
  else { p = { ...newProfile(r.user.name), ...(server || {}) }; if (!p.id || st.profiles.some(x => x.id === p.id)) p.id = Math.random().toString(36).slice(2, 10); st.profiles.push(p); }
  p.acct = { name: r.user.name, token: r.token, rev: r.rev, dirty, at: Date.now() }; st.current = p.id; quietSave(app); app.applyProfile(); if (dirty) sync(app, p); return r;
}
/** Nach jedem Speichern: geänderte Konten in Kürze hochladen (gebündelt, damit nicht jede Kleinigkeit einzeln geht). */
export function touch(app) { const p = app.profile; if (!accountsOn() || !p || !p.acct || !p.acct.token) return; p.acct.dirty = true; clearTimeout(timer); timer = setTimeout(() => sync(app, p), 4000); }
export async function sync(app, p, keepalive = false) {
  if (!accountsOn() || !p || !p.acct || !p.acct.token || p.acct.expired || busy.has(p.id)) return; busy.add(p.id);
  try {
    for (let i = 0; i < 3; i++) {
      const r = await api('/api/state', { method: 'PUT', body: { state: strip(p), rev: p.acct.rev }, token: p.acct.token, keepalive });
      if (r.ok) { p.acct.rev = r.rev; p.acct.dirty = false; p.acct.at = Date.now(); p.acct.err = null; break; }
      if (r.status === 409 && r.state) { replace(p, mergeProfiles(r.state, strip(p))); p.acct.rev = r.rev; if (app.profile === p) app.refreshLook && app.refreshLook(); continue; }
      if (r.status === 401) { p.acct.expired = true; p.acct.err = 'Bitte melde dich neu an.'; break; }
      p.acct.err = r.error || 'Gerade nicht erreichbar.'; break;
    }
  } finally { busy.delete(p.id); quietSave(app); }
}
/** Beim Start und beim Profilwechsel: Stand vom Server holen (vielleicht wurde auf einem anderen Gerät gespielt). */
export async function pull(app, p) {
  if (!accountsOn() || !p || !p.acct || !p.acct.token || p.acct.expired) return;
  const r = await api('/api/state', { token: p.acct.token }); if (r.status === 401) { p.acct.expired = true; p.acct.err = 'Bitte melde dich neu an.'; quietSave(app); return; } if (!r.ok) return;
  if (r.rev !== p.acct.rev) { replace(p, mergeProfiles(r.state, strip(p))); p.acct.rev = r.rev; p.acct.dirty = true; if (app.profile === p) { app.refreshLook && app.refreshLook(); } }
  if (p.acct.dirty) await sync(app, p); else { p.acct.at = Date.now(); quietSave(app); }
}
export async function logout(app, p, removeHere) {
  if (p.acct && p.acct.token) await api('/api/logout', { body: {}, token: p.acct.token });
  delete p.acct; if (removeHere) { app.state.profiles = app.state.profiles.filter(x => x !== p); if (app.state.current === p.id) app.state.current = app.state.profiles[0] ? app.state.profiles[0].id : null; }
  quietSave(app); app.applyProfile();
}
export async function changePassword(p, old, password) { return api('/api/password', { body: { old, password }, token: p.acct.token }); }
export function ago(t) { if (!t) return 'noch nie'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'gerade eben' : s < 3600 ? `vor ${Math.round(s / 60)} Minuten` : s < 86400 ? `vor ${Math.round(s / 3600)} Stunden` : `am ${new Date(t).toLocaleDateString('de-DE')}`; }
