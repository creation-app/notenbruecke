// Stellschrauben für Verkauf und Zählung. Die Kauf-Variante wird über window.NB_SHOP eingeschaltet (zweite Adresse, gleiches Spiel).
export const CONFIG = {
  shop: typeof window !== 'undefined' && !!window.NB_SHOP,
  freeLevels: ['h1', 'h2', 'h3', 'h4', 'h5'],       // in der Kauf-Variante ohne Schlüssel spielbar
  priceOnce: '12,99 €', priceAbo: '2,99 € im Monat', // Platzhalter, bis die Preise feststehen
  checkoutOnce: '', checkoutAbo: '',                 // Kauf-Adressen des Zahlungsanbieters; leer = Kauf noch nicht freigeschaltet
  statsCode: '',                                     // GoatCounter-Kürzel; leer = es wird nichts gezählt
  pubKey: {"kty":"EC","crv":"P-256","x":"6ZA8UmaJ8MpG0x4OnGe_dMbzVTbSnzEW7kJwKpGBObI","y":"ltiwubgM3vXBnjZ6hzAn4PZDQKpiJpuhDKL-x1BAxAU"},
};
