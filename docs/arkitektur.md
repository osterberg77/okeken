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
- **Skyddsnät:** nattligt fullbygge (cron) som också drar in Eventor-ändringar.

## Bilder

Bildbanken (Storage + `imageBank`) levererar tre storlekar per bild (thumb 800 px, web 1920 px, ev. 4K). Bilder i events och Markdown refererar `webUrl`; bygget lägger på lazy loading (`srcset` återstår). Uppladdning sker i webbläsaren: filerna först, sedan Firestore-posten (reglerna kräver den ordningen); `renderMarkdown` renderar bara bilder från bildbankens Storage-adress. I emulatorläge (`PUBLIC_FIREBASE_EMULATORS=true`) byts värden till Storage-emulatorn bara vid visning; den lagrade adressen är alltid den kanoniska. Lokalt: starta emulatorer med en config utan hosting (port 5000 kan vara upptagen på Mac) och med Auth, Firestore 8180, Storage 9199 under `--project okeken`.

## Infosidor och länkar i editorn

Infosidor delar mönster med events: `PageDetail` renderas både av `src/pages/[slug].astro` (statisk HTML, `data-pagefind-body`) och av adminpreviewn. Menyn i `Header.astro` byggs av Kalender + `getMenu()` (`src/lib/menu.ts`): den publicerade `menu/main` (beslut 0008) där varje sid-id slås upp mot de publicerade sidorna (`resolveMenu`, `src/lib/menu-resolve.ts`). Undermenyerna renderas ännu platt (en rubrik länkar till sin första undersida). Utan publicerad meny med minst en publicerad sida visas gamla sajtens platshållare. Menyn redigeras i `/admin/meny` (`MenuEditor`, Firestore-läsning/skrivning i `src/lib/firebase/menu.ts`, rena redigeringsfunktioner i `src/lib/menu-edit.ts`; flytta med knappar, ingen drag-and-drop). Varningar och förhandsvisning använder samma `resolveMenu` som bygget. Function `onMenuWritten` begär bygge när menyns `published` ändras; `onPageWritten` gör det när en sida publiceras, ändras eller avpubliceras, vilket också uppdaterar menyn. Editorn (`MarkdownField`) laddar publicerade sidor och events från Firestore för länkväljaren och infogar interna länkar utan domän (`/slug`, `/event/slug`). Slugs kontrolleras mot reserverade adresser och andra sidor i `src/lib/firebase/pages.ts` före skrivning, eftersom reglerna inte kan garantera unikhet.

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
