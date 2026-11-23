# Server der Notenbrücke

Cloudflare Worker mit D1-Datenbank: Konten (Benutzername oder E-Mail + Passwort), Spielstände, anonyme Nutzungszahlen, Lehrer-Übersicht.
Wird automatisch über `.github/workflows/server.yml` veröffentlicht, sobald die drei Geheimnisse im Repository eingetragen sind:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `LEHRER_PASSWORT`.

Lokal testen: `npm i -D wrangler`, `.dev.vars` mit `LEHRER_PASSWORT="..."` anlegen, `npx wrangler d1 execute notenbruecke --local --file schema.sql`, `npx wrangler dev --local`, dann `node --test test/api.test.mjs`.
