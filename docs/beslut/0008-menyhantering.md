# 0008 – Menyhantering i `menu/main`

**Kontext:** Menyn byggdes av fälten `inMenu`, `menuOrder` och `menuLabel` på varje infosida: en platt lista där ordningen styrdes av siffror spridda över sidorna. Erik vill ha en riktig menyhantering: en vy med alla menyposter, flytta upp/ned, ta bort ur menyn och undermenyer (en rubrik, med eller utan egen sida, med sidor under sig). Menyändringar ska vara publiceringsstyrda som allt annat innehåll: besökare ser aldrig opublicerat och publicering = rebuild.

**Beslut:**
- Menyn är ett dokument, `menu/main`, med utkastet `items` och ögonblicksbilden `published = { items }` + `publishedAt` + `updatedBy`/`updatedAt`. Ingen status: "Publicera" kopierar utkastet till `published` i samma skrivning och reglerna kräver att de är exakt lika (samma mönster som events och sidor). Dokumentet kan inte raderas; en tom meny publiceras som `{ items: [] }`.
- `items`: högst 8 poster `{ label, pageId, children }`. `label` 1–40 tecken. `pageId` är dokument-id i `pages` (stabilt, till skillnad från titeln; slug finns inte förrän sidan publicerats) eller `null` för en rubrik utan egen sida. `children` är högst 8 sid-id:n (strängar); texten är sidans titel. Ingen tredje nivå. En sida får förekomma högst en gång i hela menyn.
- Kalendern (startsidan) är fast första post och lagras inte.
- Bygget läser bara `published` (Admin SDK, content collection `menu`) och slår upp sid-id mot publicerade sidor (`resolveMenu` i `src/lib/menu-resolve.ts`). Opublicerade/saknade sidor utelämnas tyst (varning i byggloggen; adminvyn ska visa samma varningar med samma funktion). Rubrik utan synliga undersidor visas inte. Utan publicerad meny visas platshållarna Om oss/Bli medlem.
- Åtkomst: bara `publisher`, `board`, `superadmin` (`canPublish()`). Banläggare, medlemmar och besökare har ingen åtkomst.
- Function `onMenuWritten` begär bygge när `published` ändras. Sidor som publiceras, byter titel eller avpubliceras startar redan bygge via `onPageWritten`, så menyn hålls i fas med sidorna.
- Fälten `inMenu`/`menuOrder`/`menuLabel` tas bort från sidorna (regler, typer, seed). `scripts/migrate-menu.mjs` flyttar dem en gång.

**Varför barnen är strängar och inte `{ pageId }`-mappar:** reglerna saknar loopar och har ett tak på 1000 uttryck per anrop. En kontroll per plats för 8 × 8 mappar (som `validCourseFiles`) slog i taket redan för en giltig full meny. Nu kontrolleras posterna plats för plats medan alla sid-id:n samlas i en lista och valideras på en gång: `join(',')` + en regex för formatet, `split(',')` jämförd med originalet (fångar icke-strängar och kommatecken i id:t) och `toSet()` för unikhet. Även unikheten kunde därmed läggas i reglerna. Behövs egna texter på undersidor senare får barnen bli mappar igen, med en ny mätning mot taket.

**Konsekvenser:**
- Reglerna kan inte kontrollera att sid-id:t finns eller är publicerat (för många `get`). Det hanteras i bygget och i adminvyn.
- Avpubliceras en sida försvinner den ur menyn vid nästa bygge utan att menyn själv publiceras om. Det är avsiktligt (besökare ska aldrig få döda länkar) men betyder att den publicerade menyn kan innehålla id:n som inte syns.
- Headern visar undermenyer som rullgardiner (`<details>`, fungerar utan JS); utseendet beskrivs i `skisser/kalender-och-kontrollsymboler.md`, avsteg 4.
- **Driftsättning:** nya regler nekar sidor som fortfarande har de gamla fälten, så migreringen måste köras direkt efter att reglerna deployats (före någon redigerar en sida):
  1. `node scripts/migrate-menu.mjs --dry-run` (läser produktion med ADC, skriver inget) och kontrollera utskriften.
  2. Deploya (push till `main`; CI deployar regler, Functions och Hosting).
  3. `node scripts/migrate-menu.mjs`. Skriptet är idempotent: `menu/main` skapas bara om den saknas och sidor utan de gamla fälten hoppas över. Allt skrivs i en batch.
  Utkastsmenyn byggs av sidornas utkastfält, den publicerade av ögonblicksbilderna på publicerade/avpublicerade sidor, så besökarnas meny blir densamma som före migreringen (i produktion i dag: ingen publicerad sida, alltså `published: null` och platshållarna). Mot emulatorn: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 node scripts/migrate-menu.mjs`.
- Bygget tål både gamla och nya sidor (läser bara `title`/`body` ur ögonblicksbilden), så en deploy före migreringen ger ingen synlig ändring.
