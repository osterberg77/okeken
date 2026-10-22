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
| `location` | `{ name, mapUrl, lat?, lng? }` | Strängar; tom sträng = saknas. `mapUrl` = länk till Google Maps e.d. `lat`/`lng` (valfria, alltid som par) ger karta med körsträcka. |
| `body` | string (markdown) | |
| `courseFiles` | `[{ name, storagePath, label }]` | PDF-banor, max 8, valfritt fält (äldre events saknar det). `name` 1–200 tecken, `label` 0–200. `storagePath` är `courses/<eventId>/<uuid>-<namn>.pdf` och måste ligga under eventets egen mapp; filnamnen är unika (skriv aldrig över), så att `published`-snapshoten inte påverkas av ändringar i utkastet. Publik nedladdning via `src/lib/courses.ts`; Storage tillåter `get` men inte `list`. Får ändras av banläggare, se nedan |
| `image` | `{ imageId, url, thumbnailUrl, alt } \| null` | Huvudbild ur bildbanken, valfritt fält (äldre events saknar det; klienten skriver alltid `null` eller en map). `url` = bildbankspostens `webUrl` (1920 px, används på eventsidan och som `og:image`), `thumbnailUrl` = postens miniatyr (editorn). Båda måste ha bildbankens adressformat (`https://firebasestorage.googleapis.com/v0/b/okeken.firebasestorage.app/o/image_bank%2F<id>-web\|thumbnail.<jpg\|png\|webp>?alt=media&token=<uuid>`); reglerna binder dem inte till `imageId` (sparar uttryck) och kontrollerar inte att posten finns. `alt` 0–300 tecken, förifylls med bildens beskrivning (annars namn) och kan ändras per event. Adresserna kopieras vid val, så raderas bilden ur bildbanken blir den trasig på sajten. Ingår i `published`. Får inte ändras av banläggare |
| `livelox` | string | Länk till Livelox (tom = saknas) |
| `courseSetter` | string | Banläggarens namn (fritext; tom = saknas) |
| `source` | `manual \| seed \| eventor` | |
| `eventorId` | string? | Vid speglad tävling |
| `slug` | string \| null | Stabil adress, t.ex. `2026-10-21-tisdagstraning`. Sätts vid första publiceringen (`<startdatum>-<titel>`, `-2` vid krock) och låses därefter |
| `status` | `draft \| scheduled \| published \| unpublished` | Styr synlighet |
| `publishAt` | timestamp? | Schemalagd publicering (status `scheduled`) |
| `publisher` | `string \| null` | "Publicerat av": uid för en medlem i `members` (beslut 0015), eller `null`. Valfritt fält (äldre events saknar det; klienten skriver alltid `null` eller ett uid, 1–128 tecken A–Z/a–z/0–9). Förvalt är den som skapar eventet. Namn och bild slås upp vid bygget och visas bara om `members/{uid}.publicName` är sant. Ingår i `published`. Får inte ändras av banläggare |
| `publishAt` | timestamp? | Schemalagd publicering (beslut 0016): när `publishScheduled` ska publicera utkastet. `null` eller saknas = ingen. Ingår inte i `published`. Töms vid publicering/avpublicering |
| `published` | objekt? | **Snapshot** av innehållet som är live (title, body, tider, plats, courseFiles, image m.m.; `image` alltid med, `null` om bild saknas). "Publicera" kopierar utkastet hit. **Bygget läser bara detta fält.** Utkastet är fälten på dokumentet i övrigt |
| `publishedAt` | timestamp? | Sätts vid Publicera. Delningsknappen jämför `meta/build.lastBuildAt` mot detta (inte `updatedAt`, som ändras vid varje sparat utkast) |
| `createdBy`, `createdAt`, `updatedAt` | | |

**Banläggare (`course_setter`, beslut 0006)** får läsa alla events och uppdatera ett event *bara* så att `courseFiles` ändras (plus `updatedBy`/`updatedAt`). Är eventet publicerat (`status == 'published'`) får samma skrivning sätta `published.courseFiles` till exakt utkastets `courseFiles`; resten av `published`, `publishedAt`, `status` och `slug` är orörda. Banorna går då live vid nästa bygge utan att andra utkastsändringar publiceras. På utkast och avpublicerade events ändras bara utkastets `courseFiles`. Banläggare kan inte skapa, radera, publicera eller avpublicera.

### `events/{eventId}/results/{resultId}`
Enkel digital variant av dagens papperslistor: `name`, `course?` (bana), `time?`, `note?`, `createdBy`. Ingen import. Visas som tabell på eventsidan (byggs statiskt).

### `pages/{pageId}` (infosidor i Markdown)
Samma publiceringsmodell som events: fälten på dokumentet är utkastet, `published` är den exakta kopian som är live. Alla fält finns alltid. Bara publicerare, styrelse och superadmin får läsa och skriva (inte banläggare). Regler och tester: `firestore.rules`, `tests/rules/pages.test.ts`. Typer: `src/types/page.ts`; bygget läser via `src/lib/server/published-pages.ts` och `src/lib/pages.ts` (`getPublicPages`). Var sidan visas i menyn styrs av `menu/main`, inte av sidan (beslut 0008).

| Fält | Typ | Anm. |
|---|---|---|
| `title` | string | 1–200 tecken |
| `body` | string (markdown) | Högst 50 000 tecken. Bilder infogas som `![alt](webUrl)` från bildbanken (v1.1) |
| `status` | `draft \| published \| unpublished` | `draft` bara för aldrig publicerade (då är `slug` och `published` null) |
| `slug` | string \| null | Sidan serveras på `/<slug>`. Samma format som events (`a-z0-9` och bindestreck, max 120). Sätts vid första publiceringen och låses därefter (menyn och andra sidor länkar dit). Får inte vara reserverad: `event`, `admin`, `sok`, `logga-in`, `pagefind`, `api`, `assets`, `404`, `index`, `kalender`, `traningskalender` (listan finns i både `firestore.rules` och `src/lib/slug.ts`, håll dem synkade). Reglerna kan inte garantera unika slugs mellan sidor: editorn ska kontrollera det, och vid krock behåller bygget den först skapade sidan |
| `published` | objekt? | Snapshot `{ title, body }`, exakt lika med utkastet i samma skrivning. **Bygget läser bara detta fält** |
| `publishedAt` | timestamp? | Sätts (serverTid) vid varje publicering |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | | Sätts till egen uid och servertid |

Bara aldrig publicerade utkast (`publishedAt == null`) får raderas; publicerade sidor avpubliceras i stället. Function `onPageWritten` startar bygget när det publicerade innehållet ändras (det bygger också om menyn, som visar sidornas titel och adress).

Fälten `inMenu`, `menuOrder` och `menuLabel` fanns till och med 2026-10-21 och flyttades till `menu/main` med `scripts/migrate-menu.mjs`. Reglerna nekar dem nu, så en sida som inte migrerats kan inte sparas förrän skriptet körts.

### `imageBank/{imageId}` (bildbank, beslut 0007)
En post per bild. Alla fält finns alltid. Bara publicerare, styrelse och superadmin får läsa, skapa, ändra och radera (inte banläggare). Efter skapandet får bara `name`, `byline` och `description` ändras. Regler och tester: `firestore.rules`, `tests/rules/imageBank.test.ts`. Typer och konstanter: `src/types/image.ts`.

| Fält | Typ | Anm. |
|---|---|---|
| `name` | string | 1–200 tecken (förifylls med filnamnet) |
| `byline` | string | Fotograf, högst 200 tecken; tom = saknas |
| `description` | string | Alt-text, högst 300 tecken; tom = saknas |
| `url`, `webUrl`, `thumbnailUrl` | string | Nedladdnings-URL (`getDownloadURL`) till original, webbversion (längsta sida 1920 px) och miniatyr (800 px). Måste vara exakt `https://firebasestorage.googleapis.com/v0/b/okeken.firebasestorage.app/o/image_bank%2F<imageId>-<variant>.<ext>?alt=media&token=<uuid>` och peka på samma fil som motsvarande `storagePaths`. Inga externa adresser |
| `storagePaths` | `{ original, web, thumbnail }` | `image_bank/<imageId>-<original\|web\|thumbnail>.<jpg\|png\|webp>`, där `imageId` är postens eget id (bara `A–Z a–z 0–9`, högst 64 tecken). En post kan alltså inte peka på andra posters filer eller på `courses/` |
| `size` | heltal | Den valda filens storlek i byte, 0–30 MB. Är den över 10 MB lagras originalet nedskalat (längsta sida 3840 px) |
| `type` | `image/jpeg \| image/png \| image/webp` | Den valda filens typ |
| `uploadedBy` | uid | Egen uid vid skapande |
| `createdAt` | timestamp | Servertid vid skapande |

Uppladdning i UI:t: ta fram id (`doc(collection(db, 'imageBank')).id`), skala i webbläsaren, ladda upp de tre filerna, skapa sedan posten. Radering: radera posten först, sedan filerna (Storage tillåter bara radering av filer som saknar post). Bilder infogas i Markdown som `![alt](webUrl)`; en raderad bild blir en trasig bild på publicerade sidor som använder den.

### `templates/{templateId}`
`name`, `svgPath`, `svgUrl`, `fields[]` (`id`, `type: text|image`, `label`, `maxLength?`, `defaultValue?`, `fit?`), `createdBy`. SVG skrivs bara via en Cloud Function som sanitiserar.

### `menu/main` (huvudmenyn, beslut 0008)
Ett enda dokument. Samma publiceringsmönster som events/sidor men utan status: `items` är utkastet, `published` är den exakta kopian som är live. Kalendern (startsidan) är fast första post och lagras inte. Bara publicerare, styrelse och superadmin får läsa och skriva (inte banläggare); dokumentet kan inte raderas. Regler och tester: `firestore.rules`, `tests/rules/menu.test.ts`. Typer och gränser: `src/types/menu.ts`. Bygget läser via `src/lib/server/published-menu.ts` och `src/lib/menu.ts` (`getMenu`); uppslagningen av sidor ligger i den rena funktionen `resolveMenu` (`src/lib/menu-resolve.ts`) som adminvyn kan återanvända för förhandsvisning och varningar.

| Fält | Typ | Anm. |
|---|---|---|
| `items` | lista | Utkastet, högst 8 poster `{ label, pageId, children }` |
| `items[].label` | string | Text i menyn, 1–40 tecken |
| `items[].pageId` | string \| null | Dokument-id i `pages` (inte slug). `null` = rubrik utan egen sida |
| `items[].children` | lista av string | Undermeny: högst 8 dokument-id i `pages`. Texten är sidans titel. Ingen tredje nivå |
| `published` | `{ items }` \| null | Exakt lika med utkastet i samma skrivning. `null` tills menyn publicerats första gången; kan inte återställas till `null` (en tom meny publiceras som `{ items: [] }`). **Bygget läser bara detta fält** |
| `publishedAt` | timestamp? | Servertid vid varje publicering |
| `updatedBy`, `updatedAt` | | Egen uid och servertid vid varje skrivning |

Id-format: 1–128 tecken `A–Z a–z 0–9 _ -`. En sida får förekomma högst en gång i hela menyn (som post eller undersida); reglerna kontrollerar det. Att sidan finns och är publicerad kan reglerna inte kontrollera: bygget hoppar tyst över sidor som inte är publicerade (en post vars egen sida saknas visas som rubrik om den har publicerade undersidor) och skriver en varning i byggloggen; adminvyn ska visa samma varningar (`resolveMenu`). En rubrik utan synliga undersidor visas inte. Är menyn aldrig publicerad, eller innehåller den ingen publicerad sida, visar headern platshållarna Om oss/Bli medlem (gamla sajten). Function `onMenuWritten` startar bygget när `published` ändras.

### `protocols/{protocolId}` (styrelsens protokoll, beslut 0009)
Internt: bara styrelse och superadmin får läsa och skriva. **Bygget läser aldrig collectionen.** Alla 15 fält finns alltid (reglerna kräver exakt dessa). Ingen status lagras; den härleds ur godkännandena (*utkast* → *godkänt av en* → *låst*, `protocolState` i `src/lib/protocol.ts`). Regler och tester: `firestore.rules`, `tests/rules/protocols.test.ts`. Typer och gränser: `src/types/protocol.ts`. Datalager: `src/lib/firebase/protocols.ts`.

| Fält | Typ | Anm. |
|---|---|---|
| `meetingAt` | timestamp | Mötets tid (UTC, visas i Europe/Stockholm) |
| `location` | string | 0–200 tecken |
| `body` | string (markdown) | Högst 50 000 tecken. Omnämnanden skrivs `@[Namn](mention:uid)` och renderas som "@Namn" |
| `attendees` | `[{ uid, name }]` | Närvarande, högst 10. `uid` = konto i `users`, `name` = ögonblicksnamn 1–200 tecken. Frånvarande noteras inte |
| `todos` | `[{ id, text, assigneeUid, assigneeName, done }]` | Att göra, högst 8. `id` eget och stabilt (`A–Z a–z 0–9 _ -`, 1–64), `text` 1–300, `assigneeUid` uid eller `null`, `assigneeName` ögonblicksnamn 0–200, `done` bool |
| `secretaryUid`, `secretaryName` | uid \| null, string | Sekreterare ("Vid protokollet"), namn 0–200 |
| `adjusterUid`, `adjusterName` | uid \| null, string | Justerare ("Justeras"), väljs per protokoll. Aldrig samma som sekreteraren |
| `secretaryApprovedAt`, `adjusterApprovedAt` | timestamp \| null | Servertid när respektive person godkände. Båda satta = låst |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | | Egen uid och servertid. Godkännanden ändrar inte `updated*` |

Ogiltiga eller dubblerade id på att göra-punkter (t.ex. `nybörjare-träff` med å/ä/ö) rättas av klienten när protokollet läses (`uniqueTodoIds` i `src/lib/protocol.ts`) och sparas rätt nästa gång. uid-format: `A–Z a–z 0–9 _ -`, 1–128 tecken. Godkännande: bara den utsedda personen, bara det egna fältet, värdet `request.time`; tillbakadragande av eget godkännande (`null`) går på olåst protokoll. Varje innehållsändring nollställer båda godkännandena i samma skrivning. Låst protokoll kan inte ändras eller raderas; radering bara av utkast utan godkännanden. Reglerna kontrollerar inte att uid:n finns eller är unika i listorna (klienten gör det, `validateProtocol`).

### `users/{uid}`
`displayName`, `email`, `permissions[]` (`member`, `course_setter`, `publisher`, `board`, `superadmin`). Källan för behörigheter (beslut 0005); ändras bara av superadmin/styrelse enligt reglerna.

`avatarColor` (id ur paletten i `src/lib/avatar.ts`), `photoUrl` (token-URL till `avatars/<uid>.jpg`, tom sträng = ingen bild) och `hideNameInRsvp` (bool, standardval för namn i svar på events) är valfria och skrivs bara av användaren själv (beslut 0013). Raderas hela dokumentet av `deleteMyAccount`.

`consent` (valfri): `{ version, acceptedAt }`, användarens godkännande av integritetspolicyn (beslut 0011). `version` är policyns datum (`CONSENT_VERSION` i `src/lib/consent.ts`), `acceptedAt` sätts av servern (`request.time`). Bara användaren själv kan skriva fältet, och inte vid kontoskapandet; styrelse och superadmin kan läsa det.

### `rsvps/{slug}/responses/{uid}`
Svar på ett event (beslut 0012). `status` (`yes`, `maybe`, `no`), `name` (användarens visningsnamn, eller `''` när namnet är dolt) och `updatedAt` (servertid). Dokument-id = uid. Läs/skriv bara för inloggade med minst en behörighet; användaren skriver och raderar bara sitt eget.

### `meta/build`
`lastBuildAt` (skrivs av Actions efter lyckad deploy, värdet är byggets starttid) och `requestedAt` (skrivs av Function när den begär ett bygge). Adminvyn visar grön om `lastBuildAt >= requestedAt`, gul om bygge pågår, röd om det gått mer än 10 minuter utan resultat. Ett event är delningsklart när `lastBuildAt > event.publishedAt`.

## Storage

Regler och tester: `storage.rules`, `tests/rules/storage.test.ts`.

```
courses/{eventId}/{filename}.pdf
image_bank/{imageId}-{original|web|thumbnail}.{jpg|png|webp}   # bildbanken, beslut 0007
templates/{templateId}.svg   # skrivs endast av Cloud Function
```

- `courses/`: alla får hämta, ingen får lista. Banläggare, publicerare, styrelse och superadmin laddar upp nya PDF:er (max 10 MB). Ingen överskrivning eller radering.
- `avatars/<uid>.jpg`: profilbild (beslut 0013). Bara ägaren skriver och raderar, JPEG högst 500 kB, inloggade får hämta, ingen listning. Raderas av `deleteMyAccount`.
- `image_bank/`: platt mapp. Alla får hämta (bilderna visas för besökare via token-URL), ingen får lista. Publicerare, styrelse och superadmin laddar upp nya filer (JPEG/PNG/WebP, ändelsen ska stämma med typen, max 10 MB) och bara så länge posten `imageBank/<imageId>` inte finns. Radering är tillåten bara när posten är borta. Ingen överskrivning och ingen ändring av metadata.

## Senare
`attendance/{eventId}/entries/{id}` för närvaroregistrering (namn utan konto ska gå att registrera).
