// Zwei Stände desselben Kontos zusammenführen (z. B. iPad und Handy): Nichts Erreichtes geht verloren.
const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const num = x => (typeof x === 'number' && isFinite(x) ? x : 0);
/** a = Server, b = dieses Gerät. Einstellungen (Name, Figur, Spielart …) kommen von b, Fortschritt ist das Beste aus beiden. */
export function mergeProfiles(a, b) {
  a = obj(a); b = obj(b); const out = { ...a, ...b };
  const la = obj(a.levels), lb = obj(b.levels); out.levels = {};
  for (const k of new Set([...Object.keys(la), ...Object.keys(lb)])) { const x = obj(la[k]), y = obj(lb[k]); out.levels[k] = num(y.stars) > num(x.stars) ? { ...x, ...y } : num(x.stars) > num(y.stars) ? { ...y, ...x } : { ...x, ...y }; }
  const na = obj(a.notes), nb = obj(b.notes); out.notes = {};
  for (const k of new Set([...Object.keys(na), ...Object.keys(nb)])) { const x = na[k], y = nb[k]; out.notes[k] = !x ? y : !y ? x : num(y.seen) >= num(x.seen) ? y : x; }
  const ca = obj(a.conf), cb = obj(b.conf); out.conf = {}; for (const k of new Set([...Object.keys(ca), ...Object.keys(cb)])) out.conf[k] = Math.max(num(ca[k]), num(cb[k]));
  out.creatures = [...new Set([...(Array.isArray(a.creatures) ? a.creatures : []), ...(Array.isArray(b.creatures) ? b.creatures : [])])];
  const da = obj(a.days), db = obj(b.days); out.days = {}; for (const k of new Set([...Object.keys(da), ...Object.keys(db)])) out.days[k] = Math.max(num(da[k]), num(db[k]));
  const ta = obj(a.train), tb = obj(b.train); out.train = {};
  for (const k of new Set([...Object.keys(ta), ...Object.keys(tb)])) { const x = obj(ta[k]), y = obj(tb[k]), bx = num(y.best) > num(x.best) ? y : x, rx = Array.isArray(x.runs) ? x.runs : [], ry = Array.isArray(y.runs) ? y.runs : [];
    out.train[k] = { ...x, ...y, best: num(bx.best), bestAcc: num(bx.bestAcc), stars: Math.max(num(x.stars), num(y.stars)), runs: ry.length >= rx.length ? ry : rx }; }
  { const ma = obj(a.master), mb = obj(b.master); if (Object.keys(ma).length || Object.keys(mb).length) { out.master = {}; for (const k of new Set([...Object.keys(ma), ...Object.keys(mb)])) { const x = obj(ma[k]), y = obj(mb[k]); out.master[k] = { crown: Math.max(num(x.crown), num(y.crown)), runs: Math.max(num(x.runs), num(y.runs)) }; } } }
  { const da2 = obj(a.daily), db2 = obj(b.daily); if (Object.keys(da2).length || Object.keys(db2).length) { const ahead = num(da2.egg) > num(db2.egg) || (num(da2.egg) === num(db2.egg) && num(da2.warm) >= num(db2.warm)) ? da2 : db2, la2 = String(da2.last || ''), lb2 = String(db2.last || ''); out.daily = { egg: num(ahead.egg), warm: num(ahead.warm), total: Math.max(num(da2.total), num(db2.total)), last: la2 > lb2 ? la2 : lb2 }; } }
  { const ea = obj(a.endless), eb = obj(b.endless); if (Object.keys(ea).length || Object.keys(eb).length) { out.endless = {}; for (const k of new Set([...Object.keys(ea), ...Object.keys(eb)])) { const x = obj(ea[k]), y = obj(eb[k]); out.endless[k] = { best: Math.max(num(x.best), num(y.best)), runs: Math.max(num(x.runs), num(y.runs)) }; } } }
  out.regenBest = Math.max(num(a.regenBest), num(b.regenBest));
  if (Array.isArray(a.skip) || Array.isArray(b.skip)) { const sa = a.skip || [], sb = b.skip || []; out.skip = Array.from({ length: Math.max(sa.length, sb.length) }, (_, i) => Math.max(num(sa[i]), num(sb[i]))); }
  if (Array.isArray(a.skipG) || Array.isArray(b.skipG)) { const sa = a.skipG || [], sb = b.skipG || []; out.skipG = Array.from({ length: Math.max(sa.length, sb.length) }, (_, i) => Math.max(num(sa[i]), num(sb[i]))); }
  if (Array.isArray(a.pets) || Array.isArray(b.pets)) out.pets = [...new Set([...(Array.isArray(a.pets) ? a.pets : []), ...(Array.isArray(b.pets) ? b.pets : [])])];
  out.seenIntro = !!(a.seenIntro || b.seenIntro); out.calibrated = !!(a.calibrated || b.calibrated);
  if (Array.isArray(a.storyRead) || Array.isArray(b.storyRead)) out.storyRead = [...new Set([...(a.storyRead || []), ...(b.storyRead || [])])];
  return out;
}
