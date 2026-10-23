# 0018 – "Dölj mig": opt-out ur synlighet

**Kontext:** En medlem ska kunna skydda sin identitet (2026-10-23). Det fanns bara `users.hideNameInRsvp`, som döljer namnet på svar på events. Nu ska en dold person utelämnas överallt där andra kan se personer, bara synlig för dem som har behörighet och ett syfte (need to know). Granskat av Opus mot koden.

**Beslut:**
- **Ett fält:** `users.hidden` (bool, användaren sätter själv) ersätter `hideNameInRsvp`. Engångsmigrering: `scripts/migrate-hidden.mjs`. `members/{uid}.hidden` speglas av `onUserMemberWritten` (och `publicName = consent && !hidden`).
- **Utelämna, inte maskera:** en dold person tas bort helt (raden finns inte) ur allt som visas för besökare och andra medlemmar. Styrelse och superadmin ser alla. Banläggare ser dolda i interna listor för sina events (need to know), men den publicerade listan utelämnar dem. Svar på events: namnet blir `''` och räknas ändå (beslut 0012, oförändrat).
- **Resultat:** raderna i `eventResultsPublished` har `memberUid` (dokumentet läses bara av Admin SDK och resultatansvariga). Bygget (`src/lib/server/published-events.ts`) läser `users where hidden == true`, utelämnar rader med dolt `memberUid` och rader utan länk vars namn är exakt en dold persons visningsnamn (fritext). `memberUid` tas bort innan data når sidorna. Det räknas om vid varje bygge, så även historiska resultat döljs, och placeringarna numreras om i `ResultsList` när raden är borta.
- **Ombyggnad:** `onUserMemberWritten` begär bygge när `hidden` eller `publicName` ändras (inte vid vanliga profiländringar eller nya konton).
- **Dokumentation:** `docs/integritet.md` är facit över var namn visas och för vilka nivåer. Varje ny vy som visar personer läggs in där.
- **Kontoradering (retroaktivt):** `deleteAccountData` sätter `name: "Borttagen"` och `memberUid: null` på personens interna resultatrader (raden och placeringen finns kvar), bygger om publicerade listor som innehåller personen och nollställer "Publicerat av" i utkast och publicerat innehåll. Frågan görs per event (inget collection group-index) och går att köra om. Ingen tombstone behövs: användardokumentet raderas, och bygget utelämnar eller nollställer det som pekade på det. Opt-out är motsatsen: flaggan kan slås på och av, raden utelämnas men finns kvar internt.
- **Avgränsning (egna beslut):** meddelanden (0019) söker bara bland `hidden == false`, och kontoradering tar då även bort personens konversationer.

**Konsekvenser:**
- Slår igenom på publika sidor efter ett bygge (1–2 min); texten i profilen säger det.
- Fritext som kringgår filtret: banläggarens namn på events (`courseSetter`), sidtexter och protokoll. Resultatrader med fritext fångas bara om namnet är exakt lika.
- Eventor, Livelox och sådant som redan kopierats av andra styrs inte av oss.
- Gamla Hosting-releaser kan återpublicera namn vid rollback; rulla inte tillbaka förbi en dold-ändring.
