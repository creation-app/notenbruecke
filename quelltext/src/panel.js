// Unteres Bedienfeld: Mikrofon-Anzeige links, rechts Klaviatur / Antwortknöpfe / Brückenbauer-Steuerung.
import { noteOfMidi, nameHtml, N, midiOf } from './music.js';
import { isGuitar, OPEN, FRETS, STRING_SHORT } from './instrument.js';

const WHITE = [0, 2, 4, 5, 7, 9, 11], BLACK_AFTER = [0, 1, 3, 4, 5];
export class Panel {
  constructor(root, app) {
    this.app = app; this.root = root;
    root.innerHTML = `<div class="ptask" id="panelTask" role="status"></div><div class="mic"><div class="mic-ico"><svg aria-hidden="true" width="40" height="50" viewBox="0 0 8 10" shape-rendering="crispEdges"><g fill="#75CCF5"><rect x="2" y="0" width="4" height="6"/><rect x="0" y="4" width="1" height="2"/><rect x="7" y="4" width="1" height="2"/><rect x="1" y="6" width="6" height="1"/><rect x="3" y="7" width="2" height="2"/><rect x="2" y="9" width="4" height="1"/></g></svg></div>
      <div class="mic-txt"><div class="mic-l1" id="micL1"></div><div class="mic-l2" id="micL2" role="status" aria-live="polite"></div><div class="mrow"><div class="meter" id="meter" aria-hidden="true"></div><button class="lvlbtn" id="lvlBtn" aria-label="Mikrofon-Pegel anpassen">Pegel</button></div></div></div><div class="right" id="panelRight"></div>`;
    this.l1 = root.querySelector('#micL1'); this.l2 = root.querySelector('#micL2'); this.right = root.querySelector('#panelRight');
    const m = root.querySelector('#meter'); this.bars = []; for (let i = 0; i < 12; i++) { const b = document.createElement('i'); m.appendChild(b); this.bars.push(b); }
    this.keys = new Map(); this.heard = null; this.hint = null;
  }
  /** Die Aufgabe in einem Satz – immer sichtbar oben im Bedienfeld, damit klar ist: am Klavier spielen oder unten antippen. */
  task(text) { const el = this.root.querySelector('#panelTask'); el.innerHTML = text ? `<span>Deine Aufgabe</span>${text}` : ''; el.hidden = !text; }
  say(l1, l2 = '', tone = '') { this.l1.textContent = l1; this.l2.innerHTML = l2; this.l2.className = 'mic-l2 ' + tone; }
  setLevel(rms) { const n = rms > 0 ? Math.max(0, Math.min(12, Math.round((Math.log10(rms) + 2.6) * 6))) : 0; if (n === this._n) return; this._n = n; this.bars.forEach((b, i) => { b.className = i < n ? (i < 7 ? 'on' : 'hi') : ''; }); }
  showMic(v) { this.root.querySelector('.mic').hidden = !v; this.root.classList.toggle('solo', !v); }
  clear() { this.right.innerHTML = ''; this.keys.clear(); this.heard = this.hint = null; }

  /** Griffbrett wie im Gitarrenheft: Sattel oben, Saiten von links (tiefe E-Saite) nach rechts (hohe e-Saite), darunter der 1. bis 3. Bund. */
  fretboard() {
    this.clear(); const fb = document.createElement('div'); fb.className = 'fb'; fb.setAttribute('role', 'group'); fb.setAttribute('aria-label', 'Griffbrett');
    const add = (cls, html) => { const e = document.createElement('span'); e.className = cls; e.innerHTML = html; fb.appendChild(e); return e; };
    add('fn', ''); STRING_SHORT.forEach(s => add('sn', s));
    for (let f = 0; f <= FRETS; f++) { add('fn', f ? f + '.' : 'leer');
      for (let s = 0; s < 6; s++) { const midi = OPEN[s] + f, k = document.createElement('button'); k.className = 'fc' + (f ? '' : ' open'); k.style.setProperty('--sw', [6, 5, 4, 3, 2, 2][s] + 'px'); k.innerHTML = `<i>${f || ''}</i>`;
        k.setAttribute('aria-label', `${STRING_SHORT[s]}-Saite, ${f ? f + '. Bund' : 'leer'}`); k.tabIndex = -1; k.addEventListener('pointerdown', e => { e.preventDefault(); this.app.keyTap(midi); }); this.keys.set(midi, k); fb.appendChild(k); } }
    this.right.appendChild(fb);
  }
  keyboard(clef) {
    if (isGuitar()) return this.fretboard();
    this.clear(); const base = clef === 'bass' ? 36 : clef === 'grand' ? 48 : 60; const kb = document.createElement('div'); kb.className = 'kb'; kb.setAttribute('role', 'group'); kb.setAttribute('aria-label', 'Klaviatur');
    for (let i = 0; i < 15; i++) { const midi = base + 12 * Math.floor(i / 7) + WHITE[i % 7], n = noteOfMidi(midi);
      const k = this.key(midi, 'wk', i % 7 === 0 ? nameHtml(n) : ''); k.style.left = i * 36 + 'px'; kb.appendChild(k);
      if (i < 14 && BLACK_AFTER.includes(i % 7)) { const b = this.key(midi + 1, 'bk', ''); b.style.left = i * 36 + 25 + 'px'; kb.appendChild(b); } }
    this.right.appendChild(kb);
  }
  key(midi, cls, label) {
    const k = document.createElement('button'); k.className = cls; k.innerHTML = label ? `<span>${label}</span>` : ''; k.setAttribute('aria-label', 'Taste ' + noteOfMidi(midi).key); k.tabIndex = -1;
    k.addEventListener('pointerdown', e => { e.preventDefault(); this.app.keyTap(midi); }); this.keys.set(midi, k); return k;
  }
  setHeard(midi) { if (midi === this.heard) return; this.mark(this.heard, 'heard', false); this.heard = midi; this.mark(midi, 'heard', true); }
  setHint(midi) { if (midi === this.hint) return; this.mark(this.hint, 'hint', false); this.hint = midi; this.mark(midi, 'hint', true); }
  flash(midi, cls) { const k = this.keys.get(midi); if (!k) return; k.classList.add(cls); setTimeout(() => k.classList.remove(cls), 600); }
  mark(midi, cls, on) { const k = midi == null ? null : this.keys.get(midi); if (k) k.classList.toggle(cls, on); }

  answers(labels, onPick) {
    this.clear(); const box = document.createElement('div'); box.className = 'answers'; this.ansBtns = {};
    for (const l of labels) { const b = document.createElement('button'); b.className = 'btn ans'; b.textContent = l; b.addEventListener('click', () => onPick(l, b)); box.appendChild(b); this.ansBtns[l] = b; }
    this.right.appendChild(box);
  }
  bau(withAcc, on) {
    this.clear(); const box = document.createElement('div'); box.className = 'bauctl';
    const mk = (txt, aria, fn, cls = '') => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.innerHTML = txt; b.setAttribute('aria-label', aria); b.addEventListener('click', fn); box.appendChild(b); return b; };
    mk('&#9650;', 'Note höher', () => on.move(1), 'sq'); mk('&#9660;', 'Note tiefer', () => on.move(-1), 'sq');
    if (withAcc) { this.accBtns = { 1: mk('&#9839;', 'Kreuz', () => on.acc(1), 'sq'), '-1': mk('&#9837;', 'b-Vorzeichen', () => on.acc(-1), 'sq') }; }
    mk('Setzen', 'Note setzen', () => on.place(), 'go'); this.right.appendChild(box);
  }
  setAcc(alt) { if (this.accBtns) for (const k of [1, -1]) this.accBtns[k].classList.toggle('sel', alt === k); }
}
