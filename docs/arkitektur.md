# Arkitektur

## Översikt

```
Admin (Firebase Auth) ──► Firestore (utkast/publicerat)
                              │  publicera / avpublicera / schemalagd tid nådd
                              ▼
                    Cloud Function ──repository_dispatch──► GitHub Actions
                                                              │ hämtar publicerad data (Admin SDK)
                                                              │ Astro build + Pagefind
                                                              ▼
                                                      Firebase Hosting (ren HTML)
                                                              │
                                              skriver meta/build.lastBuildAt
```

Alla publika sidor (infosidor och varje event) är statiska HTML-filer med korrekta Open Graph-taggar. Kalendern får sin data inbäddad som JSON vid bygget; filter, "Idag" och tidslinje sker i webbläsaren.

## Publiceringsflöde

- **Live preview:** admin renderar samma eventkomponent från utkastet i Firestore (klientsida) inkl. en förhandsvisning av SoMe-kortet. Inget bygge behövs.
- **Publicera / avpublicera / ändra:** ändrar `status`; en Cloud Function startar en rebuild. Fördröjning ca 1–2 min accepteras.
- **Schemalagd publicering:** event får `status: scheduled` + `publishAt`. En schemalagd Function (var 5–15:e minut) sätter `published` när tiden passerat och triggar rebuild.
- **Delningsknapp:** aktiveras när `meta/build.lastBuildAt` är senare än eventets `publishedAt`, så att ingen delar en länk innan förhandsvisningen finns (Facebook cachar annars en tom förhandsvisning).
- **Köa, inte avbryta:** Actions använder `concurrency: { group: deploy, cancel-in-progress: false }`. GitHub behåller bara en väntande körning per grupp och en nyare ersätter den äldre. Eftersom bygget hämtar data när det startar kommer snabba ändringar med i samma bygge. Ingen egen debounce behövs. Alla ändringar som påverkar publicerat innehåll (inkl. resultat) startar ett bygge.
- **Skyddsnät:** nattligt fullbygge (cron). Eventor hämtas manuellt, inte i nattbygget.

## Bilder

Bildbanken (Storage + `imageBank`) levererar tre storlekar per bild (thumb 800 px, web 1920 px, ev. 4K). Bilder i events och Markdown refererar `webUrl`; bygget lägger på lazy loading (`srcset` återstår). Uppladdning sker i webbläsaren: filerna först, sedan Firestore-posten (reglerna kräver den ordningen); `renderMarkdown` renderar bara bilder från bildbankens Storage-adress. I emulatorläge (`PUBLIC_FIREBASE_EMULATORS=true`) byts värden till Storage-emulatorn bara vid visning; den lagrade adressen är alltid den kanoniska. Lokalt: starta emulatorer med en config utan hosting (port 5000 kan vara upptagen på Mac) och med Auth, Firestore 8180, Storage 9199 under `--project okeken`.

## Infosidor och länkar i editorn

Infosidor delar mönster med events: `PageDetail` renderas både av `src/pages/[slug].astro` (statisk HTML, `data-pagefind-body`) och av adminpreviewn. Menyn i `Header.astro` byggs av Kalender + `getMenu()` (`src/lib/menu.ts`): den publicerade `menu/main` (beslut 0008) där varje sid-id slås upp mot de publicerade sidorna (`resolveMenu`, `src/lib/menu-resolve.ts`). Undermenyerna renderas ännu platt (en rubrik länkar till sin första undersida). Utan publicerad meny med minst en publicerad sida visas gamla sajtens platshållare. Menyn redigeras i `/admin/meny` (`MenuEditor`, Firestore-läsning/skrivning i `src/lib/firebase/menu.ts`, rena redigeringsfunktioner i `src/lib/menu-edit.ts`; flytta med knappar, ingen drag-and-drop). Varningar och förhandsvisning använder samma `resolveMenu` som bygget. Function `onMenuWritten` begär bygge när menyns `published` ändras; `onPageWritten` gör det när en sida publiceras, ändras eller avpubliceras, vilket också uppdaterar menyn. Editorn (`MarkdownField`) laddar publicerade sidor och events från Firestore för länkväljaren och infogar interna länkar utan domän (`/slug`, `/event/slug`). Slugs kontrolleras mot reserverade adresser och andra sidor i `src/lib/firebase/pages.ts` före skrivning, eftersom reglerna inte kan garantera unikhet.

Textfältet `MarkdownField` är en visuell (WYSIWYG) editor byggd på Tiptap 3 (`MarkdownEditor.tsx`, laddas med `React.lazy` som egen chunk, bara i admin-öar; ca 160 kB gzip, inget i publika sidors JS). Lagringsformatet är fortsatt ren Markdown: `@tiptap/markdown` läser och skriver, och publika sidor/preview renderas som förut av `src/lib/markdown.ts`. Stöd: rubrik 2–3, fet, kursiv, punkt- och numrerad lista, citat, länk (bara `SAFE_URL`-protokoll, länkväljaren `LinkPicker`), bild (bara bildbanken, `isBankImageUrl`), horisontell linje och tabeller (finns i seed; ingen knapp, redigeras i cellerna). Avstängt: understruken, genomstruken, inline-kod, kodblock; rå HTML och osäkra länkar/bilder faller bort vid inklistring och inläsning. Extern `value` sätts in i editorn bara om den skiljer sig från senast skickade värdet (`lastEmitted`), så ingen uppdateringsloop uppstår. Normalisering: texten skrivs om först när någon ändrar något; tabeller får utfyllda kolumner och avslutande radbrytningar trimmas (renderat resultat identiskt för alla seed-sidor och events). Inline-kod och kodblock i gammal text försvinner som kod vid första redigering.

## Styrelsens protokoll: admin-UI, utskrift och omnämnanden

Protokollen (beslut 0009) finns bara i admin, bakom `AdminGate` med `canViewProtocols`. `/admin/protokoll` listar (senaste möte först, `ProtocolStatusLabel`), `/admin/styrelsemote` är nytt-flöde (utan `?id`: välj mall och om ej avbockade punkter ska lyftas över) eller editor/läsvy (`?id=`). Datalager: `src/lib/firebase/protocols.ts`; logik: `src/lib/protocol.ts`. Editorn sparar bara när `sameProtocolContent` säger att något ändrats och varnar innan en sparning nollställer befintliga godkännanden; godkänn/dra tillbaka är separata skrivningar och knapparna är avstängda vid osparade ändringar. Låst protokoll är skrivskyddat (bara `ProtocolView`), kan inte raderas och rättas via "Kopiera till nytt protokoll". `ProtocolStatusBadge` visas för icke-låsta protokoll; låst märks med ett meddelande i vyn.

`ProtocolView` är den enda komponenten som renderar protokollet, för skärmens läsvy och för utskriften. "Skriv ut" anropar `window.print()`; `@media print` i `global.css` döljer header och footer (`body:has(.protocol-print)`) och admin-delarna har `print:hidden`, så bara `ProtocolView` skrivs ut (logga, rubrik, närvarande, text, Att göra med ☑/☐, signeringsrader med namn och godkännandedatum, märkning "UTKAST – ej godkänt" för ej låsta). Rubriker bryts inte från sitt stycke (`break-after: avoid`). Inga PDF-bibliotek. Knappen är avstängd vid osparade ändringar så att utskriften alltid är det sparade protokollet.

Omnämnanden: `MarkdownEditor` tar den valfria propen `mentionCandidates` (via `MarkdownField`); utan den finns ingen @-funktion. Med den läggs `@tiptap/extension-mention` till (laddas i samma lazy-chunk), med en egen Markdown-tokenizer så att `@[Namn](mention:uid)` läses och skrivs oförändrat. Listan är en liten DOM-popup (upp/ned/Enter/Tab/Esc, `role=listbox`). `renderMarkdown` släpper inte igenom `mention:`-länkar, så texten visas som "@Namn".

## Statusbadge (obligatorisk)

Inloggade användare med rätt behörighet ska aldrig kunna missta ett ej publicerat innehåll för live. Regler:

- Opublicerade sidor/events finns inte i den statiska buildens publika HTML. De nås bara via admin/preview-rutter (klientsida, kräver inloggning och behörighet).
- På varje sådan sida visas en **fast, tydlig badge i hörnet** (alltid synlig, även vid scroll, mobil och desktop):
  - `UTKAST – ej publicerad`
  - `SCHEMALAGD – publiceras <datum, tid>`
  - `AVPUBLICERAD – syns inte för besökare`
  - `OPUBLICERADE ÄNDRINGAR – live-versionen skiljer sig` (utkastets innehåll skiljer sig från `published`-snapshoten)
- Samma statusmärkning (liten etikett) i admin-listor och i kalendern/aktivitetslistan för inloggade, med avvikande färg som inte krockar med eventkategorierna.
- Badgen renderas av en gemensam komponent (`StatusBadge`) som används av alla preview-/adminvyer, så den inte glöms i enskilda sidor.
- Besökare (ej inloggade) ser aldrig badges eller opublicerat innehåll.

## Statiskt vs dynamiskt

- **Statiskt (byggs):** infosidor, meny, alla events, sökindex (Pagefind), kalenderdata.
- **Klientsida mot Firebase:** inloggning, admin/preview, och senare resultatinmatning/närvaro.

## Alternativ som valdes bort (tills vidare)

- Serverrendering av `/event/*` via Cloud Function + CDN-cache: ger direkt-publicering utan väntan men mer drift. Revideras om 1–2 min väntan visar sig vara ett problem.

## Adminöversikt och profilmeny

`/admin` (`AdminHome`) samlar adminvyerna i grupper efter behörighet: Publicering, Banläggning och Styrelsen. Grupperna och länkarna ligger i en enda lista i `src/lib/admin-nav.ts` som styr både översikten och profilmenyn, så en ny adminvy läggs till på ett ställe. Profilmenyn har bara en länk, "Administration", för den som har någon adminbehörighet. Listan döljer bara det man inte får använda; reglerna är skyddet.
