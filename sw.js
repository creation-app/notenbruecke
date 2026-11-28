// Die Notenbrücke – Service Worker. Netz zuerst (Updates kommen sofort an), ohne Netz die zuletzt geladene Fassung.
const CACHE = 'notenbruecke-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('notenbruecke-')) await caches.delete(k); await self.clients.claim(); })()));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url);
  if (u.origin !== self.location.origin || u.pathname.includes('/gestern/') || u.pathname.includes('/quelltext/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE), key = u.origin + u.pathname, nav = r.mode === 'navigate';
    const fromNet = (async () => { const res = nav ? await fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }) : await fetch(r); if (res && res.ok && res.type === 'basic') await cache.put(key, res.clone()); return res; })();
    try {
      // Bei sehr langsamem Netz nicht ewig warten, wenn schon eine Fassung da ist.
      const hit = await cache.match(key); if (!hit) return await fromNet;
      return await Promise.race([fromNet, new Promise((_, no) => setTimeout(() => no(new Error('langsam')), 4000))]);
    } catch (err) { const hit = await cache.match(key); if (hit) return hit; throw err; }
  })());
});
