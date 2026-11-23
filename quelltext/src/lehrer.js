// Lehrer-Seite: Anmeldung mit dem Lehrer-Passwort, Übersicht über Konten und anonyme Nutzung, Passwort zurücksetzen, Konto löschen.
import { LEVELS, WORLDS } from './levels.js';
const API = (window.NB_API || '').replace(/\/+$/, ''), $ = id => document.getElementById(id), app = $('app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LV = Object.fromEntries(LEVELS.map((l, i) => [l.id, { ...l, i, worldName: (WORLDS[l.world] || {}).short || l.world }]));
const TYPE = { jump: 'Springen (Klavier)', boss: 'Melodie (Klavier)', melodie: 'Melodie (Klavier)', regen: 'Notenregen (Antippen)', bau: 'Brückenbauer', train: 'Training', menue: 'Menüs, Karte, Geschichte' };
const DISC = d => { const m = /^(play|name)-(treble|bass|both)(\+v)?-(time|count)$/.exec(d); return m ? `${{ treble: 'Violinschlüssel', bass: 'Bassschlüssel', both: 'Beide Schlüssel' }[m[2]]}${m[3] ? ' mit Vorzeichen' : ''} · ${m[1] === 'play' ? 'Klavier' : 'Antippen'} · ${m[4] === 'time' ? '60 s' : '20 Noten'}` : d === 'wackelnoten' ? 'Wackelnoten' : d; };
let token = sessionStorage.getItem('nbLehrer') || '', days = 30, scope = 'alle', data = null, open = null;
async function call(path, opt = {}) {
  try { const r = await fetch(API + path, { method: opt.method || (opt.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined }); const j = await r.json().catch(() => ({})); return { ...j, ok: r.ok, status: r.status }; }
  catch (e) { return { ok: false, status: 0, error: 'Keine Verbindung zum Server.' }; }
}
function loginView(msg = '') {
  app.innerHTML = `<section class="card narrow"><h1>Notenbrücke · Lehrer-Übersicht</h1>${API ? '' : '<p class="warn">Es ist noch keine Server-Adresse eingetragen.</p>'}<form id="lf"><label>Lehrer-Passwort<input id="lpw" type="password" autocomplete="current-password" required></label><button>Anmelden</button></form><p class="warn" id="lerr">${esc(msg)}</p></section>`;
  $('lf').onsubmit = async e => { e.preventDefault(); const r = await call('/api/teacher/login', { body: { password: $('lpw').value } }); if (!r.ok) return ($('lerr').textContent = r.error || 'Das hat nicht geklappt.'); token = r.token; sessionStorage.setItem('nbLehrer', token); load(); }; $('lpw').focus();
}
async function load() {
  app.innerHTML = '<p class="muted">Lade …</p>'; const r = await call('/api/teacher/overview?days=' + days); if (r.status === 401) { token = ''; sessionStorage.removeItem('nbLehrer'); return loginView(r.error); } if (!r.ok) return loginView(r.error || 'Fehler beim Laden.'); data = r; render();
}
const day = t => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
const rel = t => { if (!t) return '–'; const d = Math.floor((Date.now() - t) / 86400000); return d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`; };
function bars(rows, unit = '', max = null) { const m = max || Math.max(1, ...rows.map(r => r[1])); return `<div class="bars">${rows.map(([l, v, extra]) => `<div class="bar"><span class="bl">${l}</span><span class="bt"><i style="width:${Math.max(1, 100 * v / m)}%"></i></span><span class="bv">${v.toLocaleString('de-DE')}${unit}${extra ? ` <small>${extra}</small>` : ''}</span></div>`).join('') || '<p class="muted">Noch keine Daten.</p>'}</div>`; }
function render() {
  const S = data.stats.filter(s => scope === 'alle' || s.ev.startsWith(scope + '/')), sum = re => { const o = {}; for (const s of S) { const m = re.exec(s.ev.replace(/^(test|kauf)\//, '')); if (m) o[m[1]] = (o[m[1]] || 0) + s.n; } return o; };
  const opens = sum(/^(start)$/).start || 0, mins = sum(/^zeit\/(.+)$/), totalMin = Math.round(Object.values(mins).reduce((a, b) => a + b, 0) / 60), starts = sum(/^levelstart\/(.+)$/), done = sum(/^level\/(.+)$/), train = sum(/^training\/(.+)$/), dev = sum(/^geraet\/(.+)$/);
  const perDay = {}; for (const s of S) if (/\/start$/.test(s.ev)) perDay[s.day] = (perDay[s.day] || 0) + s.n; const minDay = {}; for (const s of S) if (/\/zeit\//.test(s.ev)) minDay[s.day] = (minDay[s.day] || 0) + s.n / 60;
  const U = data.users, active7 = U.filter(u => Date.now() - u.seen < 7 * 864e5).length;
  const lvRows = Object.keys({ ...starts, ...done }).filter(k => LV[k]).sort((a, b) => LV[a].i - LV[b].i).map(k => { const st = starts[k] || 0, dn = done[k] || 0, q = st ? Math.round(100 * Math.min(dn, st) / st) : null; return { k, st, dn, q }; });
  const tips = [];
  for (const r of lvRows) if (r.st >= 5 && r.q !== null && r.q < 50) tips.push(`<b>${esc(LV[r.k].title)}</b> (${esc(LV[r.k].worldName)}) wird oft abgebrochen: nur ${r.q} % von ${r.st} Starts enden mit Ergebnis. Vielleicht zu schwer oder zu lang?`);
  const topMode = Object.entries(mins).filter(([k]) => k !== 'menue').sort((a, b) => b[1] - a[1])[0]; if (topMode) tips.push(`Am meisten Spielzeit: <b>${esc(TYPE[topMode[0]] || topMode[0])}</b> (${Math.round(topMode[1] / 60)} Minuten).`);
  if (mins.menue && totalMin && mins.menue / 60 > totalMin * 0.35) tips.push(`Auffällig viel Zeit in Menüs und Geschichte (${Math.round(mins.menue / 60)} von ${totalMin} Minuten). Vielleicht finden sich Kinder nicht schnell zum Spielen?`);
  const devs = Object.entries(dev).sort((a, b) => b[1] - a[1]); if (devs.length) tips.push(`Geräte: ${devs.map(([k, v]) => `${esc(k)} ${Math.round(100 * v / devs.reduce((a, x) => a + x[1], 0))} %`).join(', ')}.`);
  const unused = LEVELS.filter(l => !starts[l.id]).length; if (opens > 10 && unused) tips.push(`${unused} von ${LEVELS.length} Leveln wurden im Zeitraum gar nicht gestartet.`);
  const dk = []; for (let i = days - 1; i >= 0; i--) dk.push(new Date(Date.now() + 3600000 - i * 864e5).toISOString().slice(0, 10)); const pm = Math.max(1, ...dk.map(d => minDay[d] || 0));
  app.innerHTML = `<header><h1>Notenbrücke · Lehrer-Übersicht</h1><div class="ctl"><label>Zeitraum <select id="days">${[7, 30, 90, 365].map(d => `<option value="${d}" ${d === days ? 'selected' : ''}>${d === 365 ? '1 Jahr' : d + ' Tage'}</option>`).join('')}</select></label>
    <label>Fassung <select id="scope"><option value="alle">beide</option><option value="test" ${scope === 'test' ? 'selected' : ''}>Test-Link</option><option value="kauf" ${scope === 'kauf' ? 'selected' : ''}>Kauf-Link</option></select></label><button id="reload">Aktualisieren</button><button id="out" class="quiet">Abmelden</button></div></header>
  <section class="tiles"><div><b>${U.length}</b>Konten</div><div><b>${active7}</b>Konten aktiv (7 Tage)</div><div><b>${opens.toLocaleString('de-DE')}</b>Spielstarts*</div><div><b>${totalMin.toLocaleString('de-DE')}</b>Spielminuten*</div></section>
  <p class="muted">* anonym gezählt, mit und ohne Konto, im gewählten Zeitraum.</p>
  ${tips.length ? `<section class="card"><h2>Was auffällt</h2><ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul><p class="muted">Automatisch aus den Zahlen abgeleitet – bitte als Hinweis lesen, nicht als Urteil.</p></section>` : ''}
  <section class="card"><h2>Spielminuten pro Tag</h2><div class="days">${dk.map(d => `<i title="${day(d)}: ${Math.round(minDay[d] || 0)} Minuten" style="height:${Math.max(2, 100 * (minDay[d] || 0) / pm)}%"></i>`).join('')}</div><div class="dlab"><span>${day(dk[0])}</span><span>heute</span></div></section>
  <div class="two"><section class="card"><h2>Zeit nach Spielart</h2>${bars(Object.entries(mins).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(TYPE[k] || k), Math.round(v / 60)]), ' min')}</section>
  <section class="card"><h2>Training</h2>${bars(Object.entries(train).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(DISC(k)), v]), ' Runden')}</section></div>
  <section class="card"><h2>Level: gestartet und beendet</h2><table class="lvt"><thead><tr><th>Welt</th><th>Level</th><th>Starts</th><th>Beendet</th><th>Quote</th></tr></thead><tbody>${lvRows.map(r => `<tr class="${r.q !== null && r.st >= 5 && r.q < 50 ? 'low' : ''}"><td>${esc(LV[r.k].worldName)}</td><td>${esc(LV[r.k].title)}</td><td>${r.st}</td><td>${r.dn}</td><td>${r.q === null ? '–' : r.q + ' %'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Noch keine Daten.</td></tr>'}</tbody></table></section>
  <section class="card"><h2>Schülerinnen und Schüler mit Konto</h2><input id="find" placeholder="Suchen …" autocomplete="off"><table class="users"><thead><tr><th>Name</th><th>Zuletzt</th><th>Min. (7 Tage)</th><th>Min. gesamt</th><th>Sterne</th><th>Level</th><th>Sichere Noten</th><th>Training</th></tr></thead><tbody id="ub"></tbody></table>${U.length ? '' : '<p class="muted">Noch hat niemand ein Konto angelegt.</p>'}</section>`;
  $('days').onchange = e => { days = +e.target.value; load(); }; $('scope').onchange = e => { scope = e.target.value; render(); }; $('reload').onclick = load; $('out').onclick = () => { token = ''; sessionStorage.removeItem('nbLehrer'); loginView(); };
  $('find').oninput = () => userRows($('find').value); userRows('');
}
function userRows(q) {
  const ql = q.trim().toLowerCase(), U = data.users.filter(u => !ql || u.name.toLowerCase().includes(ql) || (u.email || '').toLowerCase().includes(ql));
  $('ub').innerHTML = U.map(u => { const s = u.summary || {}; return `<tr class="urow" data-id="${u.id}" tabindex="0"><td><b>${esc(u.name)}</b>${u.email ? `<br><small>${esc(u.email)}</small>` : ''}</td><td>${rel(u.seen)}</td><td>${s.minutesWeek || 0}</td><td>${s.minutesTotal || 0}</td><td>${s.stars || 0}</td><td>${s.levels || 0}</td><td>${s.sure || 0} / ${s.seenNotes || 0}</td><td>${s.trainBest ? s.trainBest + ' /min' : '–'}</td></tr>${open === u.id ? `<tr class="detail"><td colspan="8">${detail(u)}</td></tr>` : ''}`; }).join('');
  document.querySelectorAll('.urow').forEach(r => { const f = () => { open = open === +r.dataset.id ? null : +r.dataset.id; userRows($('find').value); }; r.onclick = f; r.onkeydown = e => { if (e.key === 'Enter') f(); }; });
  const u = data.users.find(x => x.id === open); if (!u || !$('rp')) return;
  $('rp').onsubmit = async e => { e.preventDefault(); const pw = $('rpw').value; const r = await call(`/api/teacher/user/${u.id}/password`, { body: { password: pw } }); $('rmsg').textContent = r.ok ? `Neues Passwort für ${u.name}: „${pw}“ – bitte weitergeben. Andere Geräte müssen sich neu anmelden.` : r.error || 'Fehler.'; $('rmsg').className = r.ok ? 'ok' : 'warn'; };
  $('del').onclick = async () => { if ($('del').dataset.sure !== '1') { $('del').dataset.sure = '1'; $('del').textContent = `Wirklich „${u.name}“ endgültig löschen? Nochmal klicken`; return; } const r = await call(`/api/teacher/user/${u.id}`, { method: 'DELETE' }); if (r.ok) { open = null; load(); } };
}
function detail(u) {
  const s = u.summary || {}, ls = s.levelStars || {};
  return `<div class="det"><div><h3>Fortschritt</h3><p>Angelegt am ${day(u.created)} · an ${s.daysPlayed || 0} Tagen gespielt · zuletzt ${s.lastDay ? day(s.lastDay) : '–'} · ${s.creatures || 0} Notenwesen · Spielart: ${s.mode === 'profi' ? 'Profi' : 'Abenteuer'}</p>
    ${WORLDS.map((w, wi) => `<p class="wl"><b>${esc(w.short)}</b> ${LEVELS.filter(l => l.world === wi).map(l => `<span class="lv s${ls[l.id] || 0}" title="${esc(l.title)}: ${ls[l.id] || 0} Sterne">${'★'.repeat(ls[l.id] || 0) || '·'}</span>`).join('')}</p>`).join('')}</div>
    <div><h3>Passwort zurücksetzen</h3><form id="rp"><input id="rpw" minlength="6" maxlength="100" required placeholder="Neues Passwort (mind. 6 Zeichen)" autocomplete="off"><button>Setzen</button></form><p id="rmsg"></p><h3>Konto löschen</h3><button id="del" class="danger">Konto löschen</button></div></div>`;
}
token ? load() : loginView();
