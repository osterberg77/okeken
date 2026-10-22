# Projektplan – sammanfattning

Utgångspunkt för bygget. Detaljer finns i övriga dokument i `docs/`; vid konflikt gäller detta dokument och `beslut/`.

## Mål

Ersätta okeken.se (Wix) med en snabb, statisk och sökbar sajt plus ett enkelt CMS för träningar, tävlingar och events. Utseende enligt vald designriktning (se `underlag/designriktning.md` och `skisser/`). Liten klubb, lite trafik: enkelt och publiceringsvänligt prioriteras.

## Beslutat

- **Firebase:** Firestore, Hosting, Auth, Storage, Functions (Blaze-plan med budgetlarm; praktiskt 0 kr vid klubbens trafik).
- **GitHub + GitHub Actions:** privat repo på Eriks konto, auto-deploy från `main`. Gratiskvoten (2 000 min/månad) räcker gott: ett bygge tar ca 2–3 min, nattbygge ≈ 90 min/månad, publiceringar några hundra minuter.
- **Statisk prerender:** alla publika sidor (även varje event) byggs till HTML med korrekta Open Graph-taggar. Firestore är redigeringsbackend. Publicering startar en rebuild, ca 1–2 min till live (beslut 0004).
- **Utkast och publicerat skiljs åt:** "Publicera" kopierar utkastet till `published`-snapshoten; bygget läser bara den (se `datamodell.md`).
- **Roller som behörigheter** på vanliga konton, lagrade i Firestore (`users/{uid}.permissions`) och kontrollerade i reglerna (beslut 0005). Admin-sida för tilldelning. Ingen separat "admin": superadmin ensam tilldelar `superadmin`; styrelse tilldelar allt annat, även `board`.
- **Mindre v1** (se nedan): sajten ska kunna ersätta Wix så snart som möjligt; resten byggs ovanpå en sajt i drift.
- **Statiska sidor** redigeras i admin som Markdown (Firestore `pages`) med enkel editor och preview, samma pipeline som events. Startinnehåll seedas från `seed/` med ett engångsskript.
- **Filer:** PDF:er från gamla sajten (Eken-Nytt, spårkartor, dokument) ligger i arkivet utanför repot. Det som behövs läggs i Storage vid migrering. Repot hålls litet: kod, dokumentation och `seed/` (Markdown/JSON).
- **Resultat och träningar** (v1.1) är en enkel digital variant av dagens papperslistor (namn, bana, tid, kommentar), inmatad av publicerare/banläggare. Ingen import.
- **Sökindex:** publicerade events och sidor ingår automatiskt i Pagefind eftersom allt prerenderas.
- **Hosting-adress:** `okeken.web.app` (eller närliggande) tills vidare; okeken.se (Loopia) pekas om vid lansering.
- **Livelox parkerat.** Närvaroregistrering utanför v1.

## Förslag (bekräfta vid scaffolding)

Astro + React-öar, Tailwind 4 (DM Sans + Inter, se `skisser/kalender-och-kontrollsymboler.md`), Pagefind, TypeScript (beslut 0003).

## V1 – ersätter Wix

1. Layout, header/footer, meny enligt designriktningen.
2. Statiska infosidor seedade från `seed/` (Om klubben, Bli medlem, Träning & tävling, Terrängspår, Tävla, guider, Eken-Nytt-arkiv), möjlighet att lägga till sidor och menyalternativ i rimlig omfattning.
3. Inloggning (lösenord, Google, e-postlänk) och roller med admin-sida för tilldelning.
4. Events och träningar: titel, typ, start och slut, plats, text. Skapa, redigera, publicera, avpublicera.
5. **Live preview** i admin av utkast, inkl. SoMe-kort.
6. **Statusbadge** i hörnet på allt opublicerat för inloggade (`StatusBadge`).
7. Ladda upp och ladda ner PDF-banor.
8. Kalender/tidslinje, aktivitetslista och detaljvy.
9. Sök (Pagefind).
10. Enkel delningsknapp (förifylld text och länk, aktiv först när bygget är klart).
11. Omdirigeringar från gamla Wix-adresser (utgå från `gamla-sajten/content/data/redirects.json` i arkivet → `firebase.json`).
12. **Besöksstatistik** från dag ett (se "Besöksstatistik" nedan): minst besökare per event, varifrån de kommer och antal nedladdningar.

## V1.1

- Logga resultat.
- Eventor: manuell hämtning, urval av tävlingar speglas i kalendern (se eventor.md).
- **Schemalagd publicering** (`publishAt`, schemalagd Function).
- Enklare bildbank: uppladdning med automatisk skalning, bildväljare i editorn, bilder i Markdown.

## V1.2

- **SoMe-bilder från mallar** (SVG-mallar med text-/bildfält, export till PNG).
- Automatisk `og:image` per event från standardmall (för events utan huvudbild; huvudbild finns sedan 2026-10-21).
- Mallredigeraren när behovet finns.

## Publiceringsflöde

Admin publicerar/avpublicerar i Firestore → Cloud Function → `repository_dispatch` → GitHub Actions bygger (hämtar publicerad data med Admin SDK, Astro, Pagefind) → deploy till Hosting → skriver `meta/build.lastBuildAt`. Bygget köas via `concurrency`; ingen egen debounce behövs. Nattligt fullbygge som skyddsnät. (v1.1) Schemalagd Function var 15:e minut publicerar event vars `publishAt` passerat.

## Statusregler (UX)

Fast badge i hörnet för `UTKAST`, `SCHEMALAGD – publiceras <tid>`, `AVPUBLICERAD`, `OPUBLICERADE ÄNDRINGAR`. Statusetiketter även i listor och kalender för inloggade. Besökare ser aldrig opublicerat eller badges.

## Bildbank och mallar – återanvändning från Coworken (v1.1/v1.2)

Coworken (`~/progg/coworken`) har en fungerande bildbank och ett mallverktyg. Slutsats: vettigt att återanvända **logiken och datamodellerna**, inte UI-koden rakt av (Coworken är React/Vite med eget CSS-system, detta projekt är Astro + Tailwind, så admin-UI skrivs om i samma anda). Claude Code behöver `~/progg/coworken/src` och `functions` tillagda som arbetskataloger i sessionen när arbetet påbörjas.

**Bildbank (v1.1)**
- Modell `ImageBankItem` (url, webUrl 1920 px, thumbnailUrl 800 px, byline, alt-text, `storagePaths`, `uploadedBy`), källa: `src/types/models/imageBank.ts`. Här utan separat 4K-fält: ett original över 10 MB skalas ner till 3840 px och lagras som `original` (`src/types/image.ts`).
- Uppladdning och skalning i webbläsaren (canvas, WebP) före uppladdning till Storage, källa: `src/firebase/firestore/imageBank.ts`, `src/utils/image.ts`.
- Bildväljare (modal) som kan öppnas från editorn, källa: `ImageBankModal.tsx`; hanteringssida, källa: `AdminImageBankPage.tsx`.
- Anpassning för OK Eken: åtkomst via behörighet `publisher` (Coworkens Storage-regel tillåter alla inloggade, vilket inte är OK här); `description` används som alt-text; bild-URL:er kommer från `webUrl`/`thumbnailUrl` med `srcset`.
- **Status 2026-10-21:** säkerhetslagret klart (beslut 0007): regler för `imageBank` och Storage `image_bank/`, regeltester, typer i `src/types/image.ts`, schema i `datamodell.md`. **Bildbanks-UI klart, verifierat mot emulatorer (2026-10-21, ej mot produktion):** uppladdning med skalning (`src/lib/image-resize.ts`, `src/lib/firebase/image-bank.ts`), hanteringssida `/admin/bilder`, bildväljare (knappen Bild i `MarkdownField`, nu även i eventtexten), Markdown släpper bara igenom bildbankens adresser. *Kvar:* `srcset` vid bygget, och GDPR-policyn nedan innan bilder på barn läggs upp.
- **Huvudbild per event (2026-10-21, verifierad mot emulatorer, ej deployad):** fältet `image` på events (se `datamodell.md`), väljs ur bildbanken i editorn (sektion "Huvudbild", skrivskyddad för banläggare), visas till höger i eventkortet enligt designspecen (under texten på smalt kort) och blir `og:image`/`twitter:image` på eventsidan. Utan huvudbild sätts ingen `og:image` (logotypen finns bara som SVG). Den genererade mallbilden i v1.2 kan senare bli reserv när huvudbild saknas.
- **Editor (2026-10-21):** textfältet för Markdown är nu WYSIWYG (Tiptap 3, lagring fortfarande ren Markdown, se `docs/arkitektur.md`). Verifierad i webbläsare mot lokal testsida; bildväljaren/Firestore ej testade i full admin.
- **Markdown:** bildväljaren infogar `![alt](webUrl)` i editorn. Vid build kan Astro lägga på `srcset`/lazy loading. Samma bilder används i events, sidor och mallar.

**Mallar för SoMe-bilder (v1.2)**
- Modell `DesignTemplate` + `TemplateField` (text/bild, maxlängd, `fit`), källa: `src/types/models/template.ts`.
- SVG sanitiseras **alltid** server-side i en Cloud Function (`sanitize-html` med allowlist, inga script/foreignObject), klientskrivning till `templates/` nekas i Storage-reglerna, källa: `functions/src/templates.ts`. Samma mönster ska användas här.
- Fyll i mall + rasterisera till PNG och spara i bildbanken eller ladda ner, källa: `templateUtils.ts`, `TemplateExportActions.tsx` (använder `html-to-image`).
- Några färdiga SVG-mallar uppladdade av superadmin, fyll-i-formulär och export, plus knapp "Skapa SoMe-bild" på eventet (titel, datum, plats förifyllt).
- Mallredigeraren (`TemplateEditorPage.tsx`, ca 3 200 rader) porteras när behovet finns.
- `og:image` för varje event genereras vid bygget från en standardmall (rasterisering i Actions, t.ex. `@resvg/resvg-js`).

## Eventor (v1.1)

Spegel av utvalda tävlingar: `eventorEvents` i Firestore (inte events), manuell hämtning via knappen på `/admin/eventor` (Cloud Function med nyckeln som Firebase-hemlighet), publicerare kryssar i vilka som visas i kalendern, urvalsregler i `settings/eventor`. Kalenderposten länkar till Eventor. Detaljer i `eventor.md`.

## Byggordning (v1) och status

Uppdaterad 2026-10-22. ✅ = klart och live på https://okeken.web.app.

1. ✅ Git, privat GitHub-repo (`osterberg77/okeken`), Firebase-projekt `okeken` (Blaze, europe-north1), Astro + Tailwind, `firebase.json`, emulatorer, GitHub Actions (deploy från `main`, preview för PR).
2. ✅ Layout enligt `skisser/kalender-och-kontrollsymboler.md`: header, footer, kalender med kontrollsymboler, aktivitetslista, detaljvy, eventsidor med Open Graph. *Kvar:* infosidorna (Om oss, Bli medlem länkar tills vidare till gamla sajten; innehållet tas fram av Erik).
3. ✅ Inloggning (lösenord med bekräftelsemejl, Google, e-postlänk), `users` + regler + tester, `/admin/anvandare`, `scripts/set-permissions.mjs`. Erik (osterbergsab@gmail.com) är superadmin.
4. ✅ Events i Firestore (utkast + `published`-ögonblicksbild), regler + tester, `/admin/events` och editor med preview, Facebook-kortpreview och `StatusBadge`. Seed-eventen importerade. Bygget läser Firestore via Admin SDK. Infosidor (`pages`): regler, regeltester, typer, byggläsning och Function `onPageWritten` klara. Admin-UI klart: `/admin/sidor` och `/admin/sida` (editor med preview via den delade `PageDetail`, formateringsknappar, länkväljare för sidor/events/egen adress med varning för opublicerade mål, slug från titeln vid första publiceringen med kontroll av reserverade adresser och krock före skrivning), publik rendering på `/<slug>` med Pagefind, menyn byggs från `getMenu()` (platshållarna Om oss/Bli medlem visas tills en meny med publicerade sidor är publicerad), seed-sidor i `seed/pages/` via `scripts/seed-pages.mjs` (som utkast). *Kvar:* Erik/styrelsen skriver riktiga texter och publicerar sidorna; fler Wix-sidor (Terrängspår, Tävla, guider, Eken-Nytt) som sidor; redirects från Wix; utkast/statusetiketter i publika kalendern är klara (steg 6).
5. ✅ Publiceringspipeline: Function `onEventWritten` (`functions/`) skickar `repository_dispatch` (`content-published`) när publicerat innehåll ändras; Deploy-workflown triggas också av nattlig cron (03:15 UTC), bygger, deployar och skriver `meta/build.lastBuildAt` (byggets *starttid*) via `scripts/write-build-time.mjs`. Editorn visar "byggs om" och aktiverar "Dela på Facebook" först när `lastBuildAt > publishedAt`. Regel + test för `meta/build`.
   Live sedan 2026-10-21. Uppsättningen gjordes en gång: GitHub-token (fine-grained, *Contents: read & write*, går ut om ett år, byt med `firebase functions:secrets:set GITHUB_DISPATCH_TOKEN --project okeken`), extra roller för `github-deploy@` och tre roller för Googles tjänstekonton, API:erna Cloud Billing/Eventarc m.fl., städpolicy för Artifact Registry i europe-north1 (`firebase functions:artifacts:setpolicy --location europe-north1`).
6. ✅ Kalendern: inloggade publicerare ser utkast, avpublicerade och opublicerade ändringar bland de vanliga eventen, med `StatusLabel`, streckad gul kant och `StatusBadge` i detaljvyn (`src/lib/firebase/calendar-drafts.ts`, laddas bara om man är inloggad). Besökare får aldrig Firebase eller utkast. *Kvar:* visuell kontroll mobil + desktop (Erik).
7. ✅ PDF-banor (kod klar, väntar på deploy av Storage-reglerna): `storage.rules` (`courses/<eventId>/<slumpat>-<namn>.pdf`, bara nya filer, max 10 MB, get men inte list, behörighet läses från `users/{uid}`), `courseFiles` i events (max 8, validerade i `firestore.rules`), uppladdning och borttagning i editorn, nedladdningslänkar under "Banor" på eventsidan. Granskad av Opus 2026-10-21. Borttagna banor raderas ur Storage av editorn efter sparning (bara filer som varken utkast eller publicerad version pekar på; regeln `delete` är tillfälligt slapp, se "Att göra före release"). Beslutat (0006): banläggare får läsa events och redigera `courseFiles` själva; på publicerade events går banorna live direkt (vid nästa bygge) utan att övriga utkastsändringar publiceras. Regler och tester klara. Editor-UI för banläggare klart: de når `/admin/events` (läsning) och kan i editorn bara ändra, ladda upp och ta bort banor (`saveCourseFiles` i `src/lib/firebase/events.ts`); övriga fält är skrivskyddade, ingen publicering och ingen byggstatus (de får inte läsa `meta/build`).
   **Menyhantering (beslut 0008):** menyn ligger i `menu/main` (utkast `items` + `published`), med undermenyer (max 8 poster × 8 undersidor, rubriker utan egen sida). Regler + tester (`tests/rules/menu.test.ts`), byggläsning (`getMenu()`), Function `onMenuWritten`, `seed/menu.json`. Sidornas fält `inMenu`/`menuOrder`/`menuLabel` är borttagna; `scripts/migrate-menu.mjs` flyttar dem till `menu/main` och måste köras mot produktion direkt efter deploy (se beslut 0008). Admin-vyn `/admin/meny` är klar: lista med toppnivåposter och indenterade undersidor, flytta upp/ned med knappar, "Flytta in under…"/"Flytta ut"/"Flytta till…", byt menytext, ta bort ur menyn, lägg till sida (alla sidor som inte redan är med) eller rubrik, gränserna 8/8/ingen tredje nivå/unika sidor stoppas i UI:t med förklaring, spara utkast/publicera, StatusBadge/BuildStatus, varningar och förhandsvisning via `resolveMenu`. Sidlistan visar "Ej i menyn" och sidredigeraren "I menyn: ja/nej → Hantera menyn". Undermenyerna i headern är klara: `<details>`-rullgardiner med chevron, fungerar utan JS, liten inline-JS för Escape/klick utanför/aria-expanded (avsteg 4 i `skisser/kalender-och-kontrollsymboler.md`).
   **Styrelsens protokoll (beslut 0009):** admin-UI i `/admin/protokoll` (lista) och `/admin/styrelsemote` (nytt/redigera/läsvy, `ProtocolEditor.tsx`): nytt protokoll från mall (senaste, valfritt tidigare eller standarddagordning) med val att lyfta över ej avbockade punkter, närvarande, text med @-omnämnanden, att göra som checkbox-lista, sekreterare/justerare, godkänn/dra tillbaka, lås, kopiera till nytt, radera utkast, "Skriv ut" (`ProtocolView`). Länk under "Styrelsen" i kontomenyn. `StatusBadge.tsx` har `ProtocolStatusLabel`/`ProtocolStatusBadge`.
8. Pagefind-sök är byggd: `build` kör `pagefind --site dist`, bara eventsidor indexeras (`data-pagefind-body`), sökning på `/sok` (sökikon i headern, godkänd av Erik). Redirect `/traningskalender` → `/` ligger i `firebase.json`; övriga Wix-adresser läggs till när målsidorna finns (404 tills dess är OK, sajten byggs klart före flytten). *Kvar:* omdirigeringar från Wix (`firebase.json`), finjustering, lansering (DNS för okeken.se på Loopia).

9. ✅ Eventor-spegel (2026-10-21/22): hämtning på `/admin/eventor`, urval som utkast och knappen Publicera (live = valt urval, ett bygge per publicering), valda tävlingar visas i kalendern och länkar till Eventor. Se `eventor.md`.
9b. Mobilfixar och hosting (2026-10-22): tabeller och långa ord stannar inom sidkorten, periodkedjans ring klipps inte, sidor revalideras (`no-cache`) så att cachade 404 inte fastnar på mobil.

Justeringar efter första användartestet (2026-10-21): listans ordning när man väljer en dag bakåt, månadsväljare vid månadsrubriken och filtret Information. Se "Avsteg" i `skisser/kalender-och-kontrollsymboler.md`.

### Att göra före release: tajta till reglerna

- **Storage-uppladdning är tillfälligt slapp** (2026-10-21): `courses/` kräver bara inloggad + PDF + ≤ 10 MB, `image_bank/` bara inloggad + bildtyp + ≤ 10 MB. Uppladdning nekades med 403 i produktion av okänd orsak (IAM-rollen `firestoreServiceAgent` är redan tillagd, se `deploy.md`). Före release: ta tillbaka rollkontrollen (`canUploadCourses()`, `canPublishImages()`), filnamnsmönster, `!imagePostExists`, och metadatakontrollerna, hitta vilket villkor som felar i produktion, och slå på `describe.skip` i `tests/rules/storage.test.ts`. Strikt variant: commit `e247536`.
- `courses/` `delete` är också slapp (vilken inloggad som helst): kräv `canUploadCourses()` när reglerna tajtas till.
- Överskrivningstesterna för Storage går inte att köra i emulatorn (den räknar överskrivning som create); skyddet bygger på att Storage-`create` inte gäller befintliga filer.

### Att veta inför nästa session

- Arbetssätt och kommandon: `CLAUDE.md`. Designspec är bindande: `skisser/kalender-och-kontrollsymboler.md`.
- Regeltester: `npm run test:rules` (479 st). Lokalt mot emulatorer: `npm run emulators` + `npm run dev:emu`.
- Deploykontot `github-deploy@okeken.iam.gserviceaccount.com` har roller för Hosting, regler, index och Firestore-läsning; Functions-deploy kräver fler roller (se steg 5).
- Logotypernas källfiler (EPS/PDF/PNG) ligger i arkivet utanför repot (`~/progg/arkiv/okeken-logo/`); bara `assets/logo/lila-bakgrund.svg` är incheckad. `.dirac-cache/` ligger i `.gitignore`.

## Flytt från Wix

**Status 2026-10-21:** åtta infosidor är importerade som utkast i produktion (`seed/pages/`): Om klubben, Bli medlem, Träning och tävling, Tävla, Terrängspår i Botorp, Veckans bana i Livelox, Banläggning i Purple Pen, Stöd för träningsansvarig. Adresserna (satta från titeln vid publicering) matchar gamla okeken.se utom Om klubben (`/om-ok-eken`) och Purple Pen (`/banlaggning-purple-pen`), som har redirect i `firebase.json`. PDF-kartor för terrängspåren och startlistan ligger i `public/dokument/`. Kvar att flytta: informationsbladet (8 MB), Eken-Nytt-arkivet (102 PDF:er, 18 MB), nyheter och blogg; de kräver dokumentarkiv eller nyhetssida (se `framtida-funktioner.md`). Bli medlem-sidan ber om mejl i stället för Idrottonline-formuläret tills vi beslutat hur ansökan ska ske.

- Omdirigeringar från gamla adresser (förslag i `gamla-sajten/content/data/redirects.json`) läggs i `firebase.json`.
- Domän okeken.se ägs av klubben och ligger hos Loopia. DNS pekas om till Firebase Hosting vid lansering.
- Wix avvecklas först efter att PDF:er sparats (se `gamla-sajten/scripts/fetch-wix-assets.sh`) och sajten är live.

## GDPR

- Resultat med namn och bilder på barn som publiceras öppet kräver en enkel policy om samtycke (före v1.1). Gäller även bildbanken (beslut 0007): bilder i bildbanken är publika för den som har länken.
- Bli-medlem-formuläret (personnummer) kräver särskild hänsyn; förslag: länka till Idrottonline i stället för eget formulär.

## Övrigt beslutat från granskningen

- Stabila event-adresser: `/event/<datum>-<slug>`, låses efter första publicering.
- Inloggning: e-post + lösenord (med bekräftelsemejl), Google eller e-postlänk utan lösenord.

## Besöksstatistik

**Behov:** besökare per träning/event (varje event har egen adress), varifrån de kommer (referenser, land) och antal nedladdningar av filer. Mer behövs inte. Gratis, cookiefritt (ingen cookiebanner), ingen statistik i admin/preview.

**Beslut: något från v1, valet mellan två vägar avgörs senare.**
- **Väg A – Umami Cloud (gratis):** ett script-tag i layouten på publika sidor. Sidvisningar per adress, referenser och land ingår. Nedladdningar loggas som händelser (`data-umami-event="download"` + filnamn på länken). Gratisnivån enligt tredjepartskälla: 100 000 händelser/mån, 1 sajt, 6 månaders historik (kontrollera på Umamis prissida). Dashboard hos Umami.
- **Väg B – egen räknare (v1.1):** litet klientskript → Cloud Function (`/api/hit` via Hosting) → dagliga räknare i Firestore (`stats/{datum}/pages/{slug}`), botfiltrering på User-Agent, land från IP på servern (IP sparas inte), dagligt roterande hash för unika besökare. Fördel: statistiken visas direkt i admin på varje event ("142 visningar, 31 nedladdningar") och ligger i egen databas. Nackdel: egen kod att underhålla, botbrus, enklare analys.
- **Plan:** börja med väg A i v1 (en rad i layouten) så att siffror finns från dag ett. Utvärdera väg B inför v1.1 och byt om den ger tillräckligt mervärde (byte är billigt: ett script mot en egen endpoint). Behåll i båda fallen samma händelsenamn: `pageview`, `download` (med `file`) och `share`.
- Lägg en rad om statistiken i integritetstexten.

## Startinnehåll

Rådata från gamla sajten (sidtexter, JSON-data, 107 nedladdade PDF:er, privata kontakter) ligger **utanför repot** i `Projects/okeken/gamla-sajten/` (arkiv, se dess `content/README.md`). Det som bedöms ha framtida värde väljs ut och läggs i `seed/` i repot (Markdown/JSON) respektive Storage vid migrering. Logotyper i `assets/logo/`. Äldre underlag i `docs/underlag/`.

## Öppna frågor

- Eventor: OK Ekens organisations-ID och distriktets ID (v1.1).
- Mallar: vilka 2–3 startmallar (event, resultat, träning)? (v1.2)
- Bara publicerare får ladda upp bilder? (förslag: ja)
- Egen färgprofil eller fortsatt lila + grön? Nyhetsbrevstjänst idag?
- Vilken logotypvariant i headern (`lila-bakgrund` eller `gron-gul`)?
- Bli medlem: länka till Idrottonline eller eget formulär?
- Statistik: Umami Cloud hela vägen, eller egen räknare i v1.1? (avgörs efter att vi sett vad Umami räcker till)
