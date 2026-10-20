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
| `courseFiles` | `[{ name, storagePath, label }]` | PDF-banor. Unika filnamn i Storage (skriv aldrig över), så att `published`-snapshoten inte påverkas av ändringar i utkastet |
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

### `events/{eventId}/results/{resultId}`
Enkel digital variant av dagens papperslistor: `name`, `course?` (bana), `time?`, `note?`, `createdBy`. Ingen import. Visas som tabell på eventsidan (byggs statiskt).

### `pages/{slug}` (Markdown)
`title`, `body` (Markdown), `menuParent?`, `menuOrder`, samma `status`/`published`/`publishedAt`-modell som events. Bilder infogas som `![alt](webUrl)` från bildbanken.

### `imageBank/{imageId}`
`url`, `webUrl` (1920 px), `thumbnailUrl` (800 px), `fourKUrl?`, `name`, `byline?`, `description?` (alt-text), `storagePaths`, `size`, `type`, `uploadedBy`, `createdAt`. Modell hämtad från Coworken.

### `templates/{templateId}`
`name`, `svgPath`, `svgUrl`, `fields[]` (`id`, `type: text|image`, `label`, `maxLength?`, `defaultValue?`, `fit?`), `createdBy`. SVG skrivs bara via en Cloud Function som sanitiserar.

### `menu/main`
Ordnad lista över menyalternativ (`label`, `href`, `children[]`).

### `users/{uid}`
`displayName`, `email`, `permissions[]` (`member`, `course_setter`, `publisher`, `board`, `superadmin`). Källan för behörigheter (beslut 0005); ändras bara av superadmin/styrelse enligt reglerna.

### `meta/build`
`lastBuildAt` (skrivs av Actions efter lyckad deploy). Ett event är delningsklart när `lastBuildAt > event.publishedAt`.

## Storage

```
courses/{eventId}/{filename}.pdf
image_bank/{timestamp}_{filename}_{original|thumb|web|4k}
templates/{templateId}.svg   # skrivs endast av Cloud Function
```

## Senare
`attendance/{eventId}/entries/{id}` för närvaroregistrering (namn utan konto ska gå att registrera).
