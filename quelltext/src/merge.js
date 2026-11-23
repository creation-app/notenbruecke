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
  out.regenBest = Math.max(num(a.regenBest), num(b.regenBest));
  if (Array.isArray(a.skip) || Array.isArray(b.skip)) { const sa = a.skip || [], sb = b.skip || []; out.skip = Array.from({ length: Math.max(sa.length, sb.length) }, (_, i) => Math.max(num(sa[i]), num(sb[i]))); }
  out.seenIntro = !!(a.seenIntro || b.seenIntro); out.calibrated = !!(a.calibrated || b.calibrated);
  if (Array.isArray(a.storyRead) || Array.isArray(b.storyRead)) out.storyRead = [...new Set([...(a.storyRead || []), ...(b.storyRead || [])])];
  return out;
}
