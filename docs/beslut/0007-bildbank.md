# 0007 – Bildbank

**Kontext:** Publicerare behöver ladda upp bilder och infoga dem i events och infosidor (`![alt](webUrl)`). Modellen kommer från Coworken (plan.md, "Bildbank och mallar"), men Coworkens Storage-regel låter alla inloggade skriva vad som helst under `image_bank/`, och Firestore-posterna kan peka på godtyckliga URL:er. Här har vi medlemmar och banläggare som inte ska kunna lägga upp bilder, publicerade sidor som pekar på filerna, och bilder kan visa barn.

**Beslut:**
- **Behörighet:** bara `publisher`, `board`, `superadmin` (`canPublish`) får läsa och skriva `imageBank/{imageId}` och ladda upp/radera i `image_bank/`. Storage läser behörigheten från `users/{uid}` som för banorna.
- **Platt mapp, filer bundna till posten:** `image_bank/<imageId>-<original|web|thumbnail>.<jpg|png|webp>`, där `imageId` är postens Firestore-id. Firestore-reglerna kräver att `storagePaths` och `url`/`webUrl`/`thumbnailUrl` pekar på exakt den postens filer. En post kan därför inte peka på `courses/`, på andra posters filer eller på externa adresser.
- **Bara egna Storage-URL:er:** URL:erna måste ha formen `https://firebasestorage.googleapis.com/v0/b/okeken.firebasestorage.app/o/image_bank%2F…?alt=media&token=<uuid>`. Bildbanken kan alltså inte användas för att hänga in externa bilder eller spårpixlar.
- **Bara bildtyper:** JPEG, PNG och WebP; filändelsen ska stämma med `contentType` och ingen extra metadata (`contentDisposition`, `contentEncoding`, `customMetadata`) tillåts. SVG nekas (kan innehålla skript). Max 10 MB per fil; `size` på posten (den valda filen) får vara upp till 30 MB, större original skalas ner i webbläsaren före uppladdning.
- **Publika via token-URL:** `get` tillåts för alla (bilderna visas för besökare), `list` för ingen. Filnamnen innehåller slumpade id:n och kan inte gissas.
- **Ingen överskrivning:** uppladdning bara av nya filer, och bara så länge posten inte finns. Efter skapandet får bara `name`, `byline` och `description` ändras.
- **Radering tillåten, men bara för filer utan post:** UI:t raderar posten först och sedan filerna. Storage-regeln tillåter `delete` bara om `imageBank/<imageId>` inte finns. Till skillnad från `courses/` (där ingen radering tillåts eftersom publicerade ögonblicksbilder pekar på filerna) behövs radering här: bilder på personer måste kunna tas bort på begäran (GDPR), och misslyckade uppladdningar lämnar annars skräp. Kopplingen till posten gör att ingen kan radera eller ersätta filer som en befintlig post pekar på.

**Konsekvenser:**
- Raderas en bild som används i publicerad Markdown blir det en trasig bild på sajten direkt (filen ligger i Storage, inte i bygget). UI:t bör varna; reglerna kan inte veta var bilden används.
- Avbryts en radering mellan post och filer blir filerna kvar (publika via sin token-URL) tills någon raderar dem; de kan inte listas från klienten, så städning sker i konsolen.
- Storage-reglerna läser högst två Firestore-dokument per anrop (`users/{uid}` och `imageBank/{imageId}`); behörigheten läses därför med bara `get` (inte `exists` + `get`).
- Mot emulatorn returnerar `getDownloadURL` `http://127.0.0.1:9199/…`, vilket reglerna nekar. Lokal utveckling av bildbanks-UI:t behöver ett sätt runt det (t.ex. skriva posten utan regler i seed, eller byta värd i URL:en i emulatorläge).
- Bilder (särskilt på barn) omfattas av GDPR-policyn i `plan.md`: de är publika för den som har länken, och samtycke ska finnas innan de läggs upp.
- Regler: `firestore.rules`, `storage.rules`. Tester: `tests/rules/imageBank.test.ts`, `tests/rules/storage.test.ts`. Typer: `src/types/image.ts`.

## Kända luckor (granskning 2026-10-21)

- `cacheControl` kontrolleras inte vid uppladdning, så en publicerare kan sätta lång cache och en raderad bild kan ligga kvar i CDN/webbläsare. Ett försök att kräva `null` nekade även vanliga uppladdningar i emulatorn (okänt standardvärde), så det är inte infört. Undersök efter deploy vilket värde som faktiskt skickas.
- Markdown-renderaren släpper bara igenom bilder från bildbankens Storage-adress (`src/lib/markdown.ts`), så externa bilder och spårpixlar kan inte läggas in via text.
- Raderas posten men inte filerna (avbruten radering) kan posten återskapas av en annan publicerare som känner id och token. Låg risk, kräver betrodd roll.
