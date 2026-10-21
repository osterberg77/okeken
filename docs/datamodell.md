# Datamodell (utkast)

## Firestore

### `events/{eventId}`
Alla fält finns alltid (reglerna kräver det). Innehållsfälten (`type` … `livelox`) är utkastet; `published` är en exakt kopia av dem vid publicering. Regler och tester: `firestore.rules`, `tests/rules/events.test.ts`.

| Fält | Typ | Anm. |
|---|---|---|
| `type` | `training \| competition \| meeting \| info \| happening` | Styr färg/ikon |
| `title` | string | |
| `startsAt` | timestamp | Eventet blir "aktivt" |
| `endsAt` | timestamp | T.ex. tisdagsträning, banor ute till söndag |
| `location` | `{ name, mapUrl }` | Strängar; tom sträng = saknas. `mapUrl` = länk till Google Maps e.d. |
| `body` | string (markdown) | |
| `courseFiles` | `[{ name, storagePath, label }]` | PDF-banor, max 8, valfritt fält (äldre events saknar det). `name` 1–200 tecken, `label` 0–200. `storagePath` är `courses/<eventId>/<uuid>-<namn>.pdf` och måste ligga under eventets egen mapp; filnamnen är unika (skriv aldrig över), så att `published`-snapshoten inte påverkas av ändringar i utkastet. Publik nedladdning via `src/lib/courses.ts`; Storage tillåter `get` men inte `list`. Får ändras av banläggare, se nedan |
| `livelox` | string | Länk till Livelox (tom = saknas) |
| `courseSetter` | string | Banläggarens namn (fritext; tom = saknas) |
| `source` | `manual \| seed \| eventor` | |
| `eventorId` | string? | Vid speglad tävling |
| `slug` | string \| null | Stabil adress, t.ex. `2026-10-21-tisdagstraning`. Sätts vid första publiceringen (`<startdatum>-<titel>`, `-2` vid krock) och låses därefter |
| `status` | `draft \| scheduled \| published \| unpublished` | Styr synlighet |
| `publishAt` | timestamp? | Schemalagd publicering (status `scheduled`) |
| `published` | objekt? | **Snapshot** av innehållet som är live (title, body, tider, plats, courseFiles m.m.). "Publicera" kopierar utkastet hit. **Bygget läser bara detta fält.** Utkastet är fälten på dokumentet i övrigt |
| `publishedAt` | timestamp? | Sätts vid Publicera. Delningsknappen jämför `meta/build.lastBuildAt` mot detta (inte `updatedAt`, som ändras vid varje sparat utkast) |
| `createdBy`, `createdAt`, `updatedAt` | | |

**Banläggare (`course_setter`, beslut 0006)** får läsa alla events och uppdatera ett event *bara* så att `courseFiles` ändras (plus `updatedBy`/`updatedAt`). Är eventet publicerat (`status == 'published'`) får samma skrivning sätta `published.courseFiles` till exakt utkastets `courseFiles`; resten av `published`, `publishedAt`, `status` och `slug` är orörda. Banorna går då live vid nästa bygge utan att andra utkastsändringar publiceras. På utkast och avpublicerade events ändras bara utkastets `courseFiles`. Banläggare kan inte skapa, radera, publicera eller avpublicera.

### `events/{eventId}/results/{resultId}`
Enkel digital variant av dagens papperslistor: `name`, `course?` (bana), `time?`, `note?`, `createdBy`. Ingen import. Visas som tabell på eventsidan (byggs statiskt).

### `pages/{pageId}` (infosidor i Markdown)
Samma publiceringsmodell som events: fälten på dokumentet är utkastet, `published` är den exakta kopian som är live. Alla fält finns alltid. Bara publicerare, styrelse och superadmin får läsa och skriva (inte banläggare). Regler och tester: `firestore.rules`, `tests/rules/pages.test.ts`. Typer: `src/types/page.ts`; bygget läser via `src/lib/server/published-pages.ts` och `src/lib/pages.ts` (`getPublicPages`, `getMenuPages`).

| Fält | Typ | Anm. |
|---|---|---|
| `title` | string | 1–200 tecken |
| `body` | string (markdown) | Högst 50 000 tecken. Bilder infogas som `![alt](webUrl)` från bildbanken (v1.1) |
| `inMenu` | bool | Visas i huvudmenyn |
| `menuOrder` | heltal 0–999 | Sortering i menyn, lägst först; lika värde sorteras på titel |
| `menuLabel` | string | Högst 40 tecken; tom = använd `title` |
| `status` | `draft \| published \| unpublished` | `draft` bara för aldrig publicerade (då är `slug` och `published` null) |
| `slug` | string \| null | Sidan serveras på `/<slug>`. Samma format som events (`a-z0-9` och bindestreck, max 120). Sätts vid första publiceringen och låses därefter (menyn och andra sidor länkar dit). Får inte vara reserverad: `event`, `admin`, `sok`, `logga-in`, `pagefind`, `api`, `assets`, `404`, `index`, `kalender`, `traningskalender` (listan finns i både `firestore.rules` och `src/lib/slug.ts`, håll dem synkade). Reglerna kan inte garantera unika slugs mellan sidor: editorn ska kontrollera det, och vid krock behåller bygget den först skapade sidan |
| `published` | objekt? | Snapshot `{ title, body, inMenu, menuOrder, menuLabel }`, exakt lika med utkastet i samma skrivning. **Bygget läser bara detta fält** |
| `publishedAt` | timestamp? | Sätts (serverTid) vid varje publicering |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | | Sätts till egen uid och servertid |

Bara aldrig publicerade utkast (`publishedAt == null`) får raderas; publicerade sidor avpubliceras i stället. Function `onPageWritten` startar bygget när det publicerade innehållet ändras.

### `imageBank/{imageId}`
`url`, `webUrl` (1920 px), `thumbnailUrl` (800 px), `fourKUrl?`, `name`, `byline?`, `description?` (alt-text), `storagePaths`, `size`, `type`, `uploadedBy`, `createdAt`. Modell hämtad från Coworken.

### `templates/{templateId}`
`name`, `svgPath`, `svgUrl`, `fields[]` (`id`, `type: text|image`, `label`, `maxLength?`, `defaultValue?`, `fit?`), `createdBy`. SVG skrivs bara via en Cloud Function som sanitiserar.

### `menu/main` (ej byggt)
Ordnad lista över menyalternativ (`label`, `href`, `children[]`). Tills vidare styrs menyn av `inMenu`/`menuOrder`/`menuLabel` på `pages`; `menu/main` behövs bara om undermenyer eller externa länkar blir aktuella.

### `users/{uid}`
`displayName`, `email`, `permissions[]` (`member`, `course_setter`, `publisher`, `board`, `superadmin`). Källan för behörigheter (beslut 0005); ändras bara av superadmin/styrelse enligt reglerna.

### `meta/build`
`lastBuildAt` (skrivs av Actions efter lyckad deploy, värdet är byggets starttid) och `requestedAt` (skrivs av Function när den begär ett bygge). Adminvyn visar grön om `lastBuildAt >= requestedAt`, gul om bygge pågår, röd om det gått mer än 10 minuter utan resultat. Ett event är delningsklart när `lastBuildAt > event.publishedAt`.

## Storage

```
courses/{eventId}/{filename}.pdf
image_bank/{timestamp}_{filename}_{original|thumb|web|4k}
templates/{templateId}.svg   # skrivs endast av Cloud Function
```

## Senare
`attendance/{eventId}/entries/{id}` för närvaroregistrering (namn utan konto ska gå att registrera).
