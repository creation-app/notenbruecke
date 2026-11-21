// Wiederholung mit Abstand: pro Note ein "Kasten" 0..4. Unsichere Noten kommen öfter.
const WEIGHT = [9, 6, 3.5, 2, 1];
export const MASTERED_BOX = 3;
export function newStat() { return { box: 0, seen: 0, ok: 0 }; }
/** Ab wann eine richtige Antwort als "noch nicht flüssig" gilt (Millisekunden): am Klavier spielen bzw. ins System schreiben. */
export const SLOW_PLAY_MS = 7000, SLOW_WRITE_MS = 12000;
/** slow: richtig, aber langsam. Das zählt als gekonnt, führt aber nicht über Kasten 2 hinaus – "sicher" ist eine Note erst, wenn sie auch zügig kommt. */
export function update(stat, firstTry, slow = false) {
  stat.seen++; if (firstTry) { stat.ok++; if (!slow) stat.box = Math.min(4, stat.box + 1); else { stat.slow = (stat.slow || 0) + 1; if (stat.box < MASTERED_BOX - 1) stat.box++; } } else stat.box = Math.max(0, stat.box - 2);
  return stat;
}
export function pickNext(keys, stats, rnd = Math.random, avoid = null) {
  const pool = keys.length > 1 ? keys.filter(k => k !== avoid) : keys;
  const w = pool.map(k => WEIGHT[(stats[k] || { box: 0 }).box]);
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
export function isMastered(stat) { return !!stat && stat.box >= MASTERED_BOX; }
/** Häufigste Verwechslungen: [{target, played, n}] */
export function topConfusions(conf, max = 5) {
  return Object.entries(conf || {}).map(([k, n]) => { const [target, played] = k.split('>'); return { target, played, n }; })
    .filter(c => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, max);
}
