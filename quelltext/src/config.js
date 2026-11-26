// Stellschrauben für Verkauf und Zählung. Die Kauf-Variante wird über window.NB_SHOP eingeschaltet (zweite Adresse, gleiches Spiel).
/** Adresse des Notenbrücke-Servers (Cloudflare Worker). Wird nach der ersten Veröffentlichung eingetragen. */
export const API_URL = '';
export const CONFIG = {
  shop: typeof window !== 'undefined' && !!window.NB_SHOP,
  freeLevels: ['h1', 'h2', 'h3', 'h4', 'h5', 'ga1', 'ga2', 'ga3', 'ga4', 'ga5'],       // in der Kauf-Variante ohne Schlüssel spielbar
  priceOnce: '12,99 €', priceAbo: '2,99 € im Monat', // Platzhalter, bis die Preise feststehen
  checkoutOnce: '', checkoutAbo: '',                 // Kauf-Adressen des Zahlungsanbieters; leer = Kauf noch nicht freigeschaltet
  apiUrl: (typeof window !== 'undefined' && window.NB_API !== undefined) ? window.NB_API : API_URL,  // Server für Konten und Statistik; leer = beides aus
  pubKey: {"kty":"EC","crv":"P-256","x":"6ZA8UmaJ8MpG0x4OnGe_dMbzVTbSnzEW7kJwKpGBObI","y":"ltiwubgM3vXBnjZ6hzAn4PZDQKpiJpuhDKL-x1BAxAU"},
};
