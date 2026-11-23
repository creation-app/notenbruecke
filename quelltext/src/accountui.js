// Bildschirme rund ums Konto: anlegen, anmelden, Status, abmelden.
import * as ACC from './account.js';
import { map, settings, esc } from './screens.js';
import { track } from './stats.js';

const val = id => (document.getElementById(id) || {}).value || '';
const pwField = (id, label, auto) => `<label class="fld">${label}<span class="pwrow"><input id="${id}" type="password" autocomplete="${auto}" maxlength="100"><button type="button" class="btn sm" data-act="show" data-for="${id}">Zeigen</button></span></label>`;
const showPw = e => { const i = document.getElementById(e.dataset.for); i.type = i.type === 'password' ? 'text' : 'password'; e.textContent = i.type === 'password' ? 'Zeigen' : 'Verbergen'; };
const errBox = (msg = '') => `<p class="note warn" id="aerr" role="alert" ${msg ? '' : 'hidden'}>${esc(msg)}</p>`;
const setErr = msg => { const e = document.getElementById('aerr'); e.textContent = msg; e.hidden = !msg; };
const busy = (on, label) => { const b = document.querySelector('#screen [data-act="ok"]'); if (b) { b.disabled = on; b.textContent = on ? 'Einen Moment …' : label; } };

/** Übersicht in den Einstellungen: angemeldet oder nicht. */
export function accountScreen(app, back = () => settings(app)) {
  const p = app.profile, a = p.acct;
  if (!a) return app.screen(`<div class="maphead"><h2>Konto</h2><button class="btn sm" data-act="back">Zurück</button></div>
    <p>Mit einem Konto ist dein Spielstand <b>online gesichert</b>. Du kannst auf jedem Gerät weiterspielen – du meldest dich einfach mit Benutzername und Passwort an.</p>
    <div class="col"><button class="btn go" data-act="reg">Konto für „${esc(p.name)}“ anlegen</button><button class="btn" data-act="login">Ich habe schon ein Konto</button></div>
    <p class="muted">Dein bisheriger Spielstand wird beim Anlegen mitgenommen. Ohne Konto bleibt alles wie bisher nur auf diesem Gerät.</p>`, { back, reg: () => registerForm(app, () => accountScreen(app, back)), login: () => loginForm(app, () => accountScreen(app, back)) });
  app.screen(`<div class="maphead"><h2>Konto</h2><button class="btn sm" data-act="back">Zurück</button></div>
    <p>Angemeldet als <b id="accName">${esc(a.name)}</b>.</p>
    ${a.expired ? '<p class="note warn">Die Anmeldung ist abgelaufen. Bitte melde dich neu an – dein Spielstand hier bleibt erhalten.</p>' : `<p class="note ${a.err ? 'warn' : 'ok'}" id="accStatus">${a.err ? `Noch nicht gesichert: ${esc(a.err)} Das Spiel versucht es später nochmal.` : a.dirty ? 'Wird gleich gesichert …' : `Online gesichert ${ACC.ago(a.at)}.`}</p>`}
    <div class="col">${a.expired ? '<button class="btn go" data-act="relog">Neu anmelden</button>' : '<button class="btn" data-act="now">Jetzt sichern</button><button class="btn" data-act="pw">Passwort ändern</button>'}<button class="btn" data-act="out">Abmelden</button></div>`, {
    back, now: async () => { a.dirty = true; await ACC.sync(app, p); accountScreen(app, back); }, pw: () => pwForm(app, () => accountScreen(app, back)),
    relog: () => loginForm(app, () => accountScreen(app, back), a.name), out: () => logoutAsk(app, back) });
}
function logoutAsk(app, back) {
  const p = app.profile;
  app.screen(`<h2>Abmelden</h2><p>Online bleibt dein Spielstand gesichert. Was soll mit dem Profil <b>${esc(p.name)}</b> auf diesem Gerät passieren?</p>
    <div class="col"><button class="btn go" data-act="rm">Von diesem Gerät entfernen</button><button class="btn" data-act="keep">Hier behalten (ohne Online-Sicherung)</button><button class="btn quiet" data-act="back">Doch nicht abmelden</button></div>
    <p class="muted">Auf einem geteilten Gerät (z. B. Schul-iPad) am besten entfernen. Später einfach wieder anmelden.</p>`, {
    back: () => accountScreen(app, back), rm: async () => { if (p.acct && p.acct.dirty) await ACC.sync(app, p); await ACC.logout(app, p, true); app.toast('Abgemeldet.'); app.profile ? map(app) : (app.state.current = null, import('./screens.js').then(S => S.title(app))); },
    keep: async () => { if (p.acct && p.acct.dirty) await ACC.sync(app, p); await ACC.logout(app, p, false); accountScreen(app, back); } });
}
export function registerForm(app, back) {
  const p = app.profile, sugg = /^[A-Za-z0-9ÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß _.-]{1,18}[A-Za-z0-9ÄÖÜäöüß]$/.test(p.name) ? p.name : '';
  app.screen(`<div class="maphead"><h2>Konto anlegen</h2><button class="btn sm" data-act="back">Zurück</button></div><div class="aform">
    <label class="fld">Benutzername<input id="aname" autocomplete="username" maxlength="20" value="${esc(sugg)}"><small>3 bis 20 Zeichen. Tipp: nicht dein ganzer Name, z. B. „Lea Klavier“.</small></label>
    ${pwField('apw', 'Passwort (mindestens 6 Zeichen)', 'new-password')}
    <label class="fld">E-Mail <span class="muted">(freiwillig)</span><input id="amail" type="email" autocomplete="email" maxlength="200"><small>Dann kannst du dich auch mit der E-Mail anmelden.</small></label></div>
    ${errBox()}<p class="muted">Merke dir Benutzername und Passwort gut. Wenn du das Passwort vergisst, kann deine Lehrkraft es zurücksetzen.</p>
    <div class="row stick"><button class="btn go" data-act="ok">Konto anlegen</button></div>`, {
    back, show: showPw,
    ok: async () => { const name = val('aname').trim(), pw = val('apw'), mail = val('amail').trim(); if (name.length < 3) return setErr('Bitte wähle einen Benutzernamen (mindestens 3 Zeichen).'); if (pw.length < 6) return setErr('Das Passwort braucht mindestens 6 Zeichen.');
      busy(true, 'Konto anlegen'); const r = await ACC.register(app, p, name, pw, mail); if (!r.ok) { busy(false, 'Konto anlegen'); return setErr(r.error || 'Das hat nicht geklappt.'); }
      track('konto/neu'); app.screen(`<h2>Geschafft!</h2><p>Dein Spielstand ist jetzt online gesichert.</p><p class="shortcode">${esc(r.user.name)}</p><p>Auf einem anderen Gerät: <b>Mit Konto anmelden</b> wählen und diesen Benutzernamen mit deinem Passwort eingeben.</p><div class="row"><button class="btn go" data-act="ok">Weiter</button></div>`, { ok: () => map(app) }); } });
  setTimeout(() => { const i = document.getElementById(sugg ? 'apw' : 'aname'); if (i) i.focus(); }, 50);
}
export function loginForm(app, back, preset = '') {
  app.screen(`<div class="maphead"><h2>Mit Konto anmelden</h2><button class="btn sm" data-act="back">Zurück</button></div><div class="aform">
    <label class="fld">Benutzername oder E-Mail<input id="alog" autocomplete="username" maxlength="200" value="${esc(preset)}"></label>${pwField('apw', 'Passwort', 'current-password')}</div>
    ${errBox()}<p class="muted">Passwort vergessen? Deine Lehrkraft kann es zurücksetzen.</p><div class="row stick"><button class="btn go" data-act="ok">Anmelden</button></div>`, {
    back, show: showPw,
    ok: async () => { const l = val('alog').trim(), pw = val('apw'); if (!l || !pw) return setErr('Bitte gib Benutzername und Passwort ein.'); busy(true, 'Anmelden'); const r = await ACC.login(app, l, pw);
      if (!r.ok) { busy(false, 'Anmelden'); return setErr(r.error || 'Das hat nicht geklappt.'); } track('konto/anmelden'); app.toast(`Angemeldet als <b>${esc(r.user.name)}</b>.`); map(app); } });
  setTimeout(() => { const i = document.getElementById(preset ? 'apw' : 'alog'); if (i) i.focus(); }, 50);
}
function pwForm(app, back) {
  const p = app.profile;
  app.screen(`<div class="maphead"><h2>Passwort ändern</h2><button class="btn sm" data-act="back">Zurück</button></div><div class="aform">${pwField('aold', 'Bisheriges Passwort', 'current-password')}${pwField('apw', 'Neues Passwort (mindestens 6 Zeichen)', 'new-password')}</div>${errBox()}
    <div class="row stick"><button class="btn go" data-act="ok">Ändern</button></div>`, { back, show: showPw,
    ok: async () => { if (val('apw').length < 6) return setErr('Das neue Passwort braucht mindestens 6 Zeichen.'); busy(true, 'Ändern'); const r = await ACC.changePassword(p, val('aold'), val('apw')); if (!r.ok) { busy(false, 'Ändern'); return setErr(r.error || 'Das hat nicht geklappt.'); } app.toast('Passwort geändert.'); back(); } });
}
