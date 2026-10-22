# 0014 – Egen besöksräknare

**Kontext:** Klubben vill veta vilka sidor som besöks mest, varifrån besökarna kommer och hur många som laddar ner varje fil (2026-10-22). Umami (väg A i `plan.md`) valdes bort till förmån för en egen räknare: statistiken ligger i vår databas och kostar inget.

**Beslut:**
- Ett litet inline-skript i `BaseLayout.astro` skickar `pageview` (sida + referent) och `download` (fil + sidan den klickades på) med `navigator.sendBeacon` till `/api/hit`. Det körs bara i produktion, aldrig på `noindex`-sidor (admin, inloggning) och aldrig för inloggade (kontoknappens cache `okeken:avatar` finns i localStorage).
- Hosting skickar `/api/hit` till Cloud Function `hit` (`functions/src/stats.ts`, europe-north1, `onRequest`). Ren logik (adressnormalisering, botfilter, referent som värdnamn) finns i `functions/src/stats-core.ts` med test i `tests/server/stats-core.test.ts`.
- Funktionen skriver dagliga räknare med `FieldValue.increment`: `statsPages/{datum}__{sida}` (`views`, `unique`, `sources`, `countries`) och `statsDownloads/{datum}__{sida|fil}` (`count`). Datum i Europe/Stockholm.
- **Unika besökare:** hash av dagens slumpade salt + IP + användaragent + sida, sparad som dokument i `statsSeen` (skapas med `create`; lyckas det är besöket unikt). Saltet ligger i `statsSeen/{datum}__salt` och kan inte läsas från klienten. IP och användaragent sparas aldrig. Dokumenten har `expireAt` (3 dygn) och raderas av Firestores TTL.
- **Regler:** `statsPages` och `statsDownloads` kan bara skrivas av funktionen och läses av publicerare, styrelse och superadmin; `statsSeen` är stängd för klienter. Test: `tests/rules/stats.test.ts`.
- Admin: `/admin/statistik` (`StatsView.tsx`) summerar 7/30/90 dagar: mest besökta sidor, källor, länder och nedladdningar per fil och sida.
- Integritetstexten på `/integritet` beskriver räkningen. Ingen ny godkännandeversion behövs: inga personuppgifter sparas.

**Att veta:**
- Besökarens land kommer från ett huvud som Hosting/Cloud Run kan skicka (`x-appengine-country` m.fl.). Det är inte verifierat i produktion; saknas huvudet blir landet `??` ("Okänt"). Kontrollera efter första deploy.
- TTL-policyn slås på en gång: `gcloud firestore fields ttls update expireAt --collection-group=statsSeen --enable-ttl --project okeken`. Utan den fungerar räknaren men hashar och salt ligger kvar.
- Räknaren är öppen för alla som kan skicka POST. Falska anrop kan öka siffror men inte läsa något; funktionens `maxInstances` begränsar kostnaden.
