# 0017 – Resultat på träningar

**Kontext:** På träningar skriver man upp sig på en lista (namn, bana, starttid) och noterar måltid eller egen sluttid när man kommer tillbaka. Banläggaren för in resultaten efter träningen, ibland på en dator som ligger framme så att löparna själva skriver upp sig. Listan ska också visa vilka som är ute i skogen. LOK-stöd för ungdomar hänger på ålder (2026-10-22).

**Beslut:**
- **Bockruta på eventet:** `resultsEnabled` (bool, valfritt) på `events/{id}`, förvalt sant för träningar. Ingår inte i ögonblicksbilden (som `publishAt`), sätts av publicerare direkt i editorn.
- **Interna rader:** `events/{eventId}/results/{entryId}` med `name`, `course` (fritext), `memberUid` (länk till `members`), `startAt`, `finishAt` (måltid), `totalSeconds` (egen sluttid), `youth` (ungdom, LOK-stöd), `show` (`time` | `participated` | `hidden`, förvalt `time`) plus skapande-/ändringsfält. Banläggare, publicerare, styrelse och superadmin läser och skriver; alla andra nekas. Regler och tester: `tests/rules/results.test.ts`.
- **Tid:** `totalSeconds` om den anges, annars `finishAt − startAt`. Ingen tid = inte i mål ("ute i skogen" om starten passerat).
- **Banor** är fritext. Dropdownen (datalist) föreslår eventets PDF-banor och redan använda banor, men raden är inte kopplad till någon fil.
- **Namnsökning:** mot `members` (beslut 0015); en träff sätter `memberUid`. Gäster skrivs som fritext.
- **Publicering är separat:** knappen "Publicera resultat" anropar Cloud Function `setResultsPublished` (`functions/src/results.ts`), som bygger `eventResultsPublished/{eventId}` = `{ entries: [{ name, course, seconds }], publishedAt, publishedBy }` av de interna raderna. Fälten plockas ut ett och ett, så `youth` och `memberUid` kan aldrig bli publika (test: `tests/server/results.test.ts`). Dolda rader tas inte med, "deltagit" visas utan tid, "visa tid" utan tid (inte i mål) utelämnas. Klienter kan inte skriva dokumentet. Utkast sparas löpande i de interna raderna.
- **Bygget** (`src/lib/server/published-events.ts`) läser `eventResultsPublished` och lägger `results` på de publicerade eventen; `EventDetail` visar `ResultsList`. Function `onResultsPublishedWritten` startar bygget när listan ändras.
- **Admin:** `/admin/resultat?event=<id>`: skriv upp dig (stora fält), lista med "I mål nu", måltid, sluttid, bana, visa-läge, ungdom, ta bort; "Ute i skogen" överst; publicering med förhandsvisning av den publika listan.

**Att veta:**
- Namn och tider blir publika bara via "Visa tid"/"Visa bara deltagit"; "Dölj" tas aldrig med. För barn gäller rutinen att den som vill döljas säger till.
- `memberUid` på raderna rensas inte automatiskt när ett konto raderas (ett oanvändbart uid blir kvar i interna rader; namnet är text som banläggaren skrivit).
- Allt kräver att funktionen `setResultsPublished` och reglerna deployas.
