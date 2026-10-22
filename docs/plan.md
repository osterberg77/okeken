# Projektplan – sammanfattning

Utgångspunkt för bygget. Detaljer finns i övriga dokument i `docs/`; vid konflikt gäller detta dokument och `beslut/`.

## Mål

Ersätta okeken.se (Wix) med en snabb, statisk och sökbar sajt plus ett enkelt CMS för träningar, tävlingar och events. Utseende enligt vald designriktning (se `underlag/designriktning.md` och `skisser/`). Liten klubb, lite trafik: enkelt och publiceringsvänligt prioriteras.

## Beslutat

- **Firebase:** Firestore, Hosting, Auth, Storage, Functions (Blaze-plan med budgetlarm; praktiskt 0 kr vid klubbens trafik).
- **GitHub + GitHub Actions:** repo på Eriks konto (publikt sedan 2026-10-22, inga hemligheter i repot), auto-deploy från `main`. Gratiskvoten (2 000 min/månad) räcker gott: ett bygge tar ca 2–3 min, nattbygge ≈ 90 min/månad, publiceringar några hundra minuter.
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
11. ~~Omdirigeringar från gamla Wix-adresser~~ Beslutat 2026-10-22: behövs inte. Vi byter sida när den nya är klar; de få redirects som finns i `firebase.json` får ligga kvar.
12. **Besöksstatistik** (egen räknare, beslut 0014): mest besökta sidor, varifrån besökarna kommer och nedladdningar per fil och sida. **Live 2026-10-22:** `/api/hit` verifierad i produktion, land (SE) fylls i. TTL på `statsSeen.expireAt` beställd med gcloud (kontrollera att den står som aktiv).

## V1.1 (beslutat 2026-10-22: görs näst efter besöksräknaren)

- **Logga resultat på träningar** (beslut 0017, byggd 2026-10-22: regler + tester gröna, Function och build kontrollerade; **adminvyn `/admin/resultat` är inte sedd i webbläsaren** (webbläsarstyrningen gick inte att använda), publicering via Function ej provad live, ej deployad). Ursprunglig design: Hör till eventet: en bockruta "Resultat" på eventet slår på funktionen. Banläggare (och publicerare) för in rader efter träningen på en enkel adminsida kopplad till ett event (`/admin/resultat?event=…`, `results` under eventet, se `datamodell.md`). Rad: namn, bana (fritext, men dropdown med eventets banor/PDF:er som bekvämlighet, ingen låsning mot PDF), starttid, måltid eller sluttid (antingen klocktid i mål eller total tid), en bockruta *ungdom* (för LOK-stöd som hänger på ålder; loggas bara i adminlistan och följer aldrig med till den publika resultatlistan) och visning: *visa tid* (standard) / *visa bara deltagit* / *dölj*. Namnet söks bland medlemmar och en träff länkar raden till medlemmen (`uid`); annars fritext (gäster, ej medlemmar). Förutom resultatlistan fungerar adminvyn som startlista under träningen: vilka som startat och vilka som inte kommit tillbaka från skogen (bara inloggade ser den, aldrig publikt). Publika resultatlistan på eventsidan byggs bara av rader som är publicerade och inte dolda. Utkast sparas löpande under träningen och banläggaren trycker "Publicera resultat" efteråt. Listan kan fyllas i av löparna själva på banläggarens dator (stora knappar, snabb namnsökning), så sidan ska vara lätt att använda utan handledning. Namnsökningen går mot en liten `members`-lista (id + visningsnamn, hålls i synk av en Function, läsbar för banläggare och uppåt, respekterar "dölj mitt namn"); den som inte har konto skrivs som fritext.
- ✅ Eventor: klart (steg 9). ✅ Bildbank: klar (se nedan).
- **Schemalagd publicering** (beslut 0016, byggd 2026-10-22, live 2026-10-22: Cloud Scheduler API på, `github-deploy@` har `roles/cloudscheduler.admin`, funktionen ligger i `europe-west1` (Scheduler finns inte i europe-north1) med egen städpolicy för Artifact Registry. Schemajobbet `firebase-schedule-publishScheduled-europe-west1` är aktivt; ännu inte provat med ett riktigt schemalagt event). Schemaläggningen ligger som kalenderikon på en delad Publicera-knapp i eventeditorn (öppnar en liten ruta med datum/tid).
- Egen besöksräknare (väg B, se Besöksstatistik) flyttad till v1.

- **Medlemslistan `members` är byggd (beslut 0015, 2026-10-22):** Function, regler och tester klara, deployat och fylld med `node scripts/sync-members.mjs` (4 medlemmar). Resultat och "publicerat av" bygger på den.
- **"Publicerat av" på events (2026-10-22, byggt, verifierat med regeltester och bygge, ej sett i webbläsaren):** fält `publisher` (uid) på events, väljs i editorn (förvalt: den som skapar; "Ingen" eller annan medlem går bra), visas som liten profilbild + "Publicerat av <namn>" längst ned i eventkortet och i adminpreview. Bygget slår upp namn och bild i `members` och visar bara dem med `publicName`. Infosidor (`pages`) har inget kort och ingen publicerare. *Kvar:* utkast i kalendern visar ingen publicerare; titta på kortet i webbläsaren; överväg att höja `CONSENT_VERSION` så att bara den som godkänt den nya texten får `publicName`. Ursprunglig beskrivning: Fält i editorn: vem som står som publicerare. Förvalt är den inloggade, men man kan välja ingen eller en annan person (sökning i samma `members`-lista som namnsökningen i resultaten). Kortet och detaljvyn visar en liten profilbild med "Publicerat av <namn>". Att granska när det byggs: namn och bild hamnar i publik, prerenderad HTML och i Firestore-snapshoten, så det ska bara gälla den som godkänt policyn och inte valt att dölja sitt namn; uppdatera `/integritet`; byggs om när personen byter namn/bild eller raderar sitt konto (`deleteMyAccount` ska rensa fältet).

## V1.2

- **SoMe-bilder från mallar** (SVG-mallar med text-/bildfält, export till PNG).
- Genererad `og:image` per event från mall. Delning till SoMe fungerar redan: eventets huvudbild blir `og:image`/`twitter:image`, och utan huvudbild används `og-default.png` (logotypen). Mallbilden är bara en förbättring för events utan huvudbild.
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
- **Status 2026-10-21:** säkerhetslagret klart (beslut 0007): regler för `imageBank` och Storage `image_bank/`, regeltester, typer i `src/types/image.ts`, schema i `datamodell.md`. **Bildbanks-UI klart och deployat (verifierat mot emulatorer 2026-10-21):** uppladdning med skalning (`src/lib/image-resize.ts`, `src/lib/firebase/image-bank.ts`), hanteringssida `/admin/bilder`, bildväljare (knappen Bild i `MarkdownField`, nu även i eventtexten), Markdown släpper bara igenom bildbankens adresser. *Kvar:* `srcset` vid bygget, och GDPR-policyn nedan innan bilder på barn läggs upp.
- **Huvudbild per event (2026-10-21, verifierad mot emulatorer, deployad):** fältet `image` på events (se `datamodell.md`), väljs ur bildbanken i editorn (sektion "Huvudbild", skrivskyddad för banläggare), visas till höger i eventkortet enligt designspecen (under texten på smalt kort) och blir `og:image`/`twitter:image` på eventsidan. Utan huvudbild används `/og-default.png` (logotypen som PNG). Den genererade mallbilden i v1.2 kan senare bli reserv när huvudbild saknas.
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

Uppdaterad 2026-10-22 (genomgång mot koden). ✅ = klart och live på https://okeken.web.app. Allt som ligger på `main` är deployat (Deploy-körningen 2026-10-22 18:59 UTC lyckades, inklusive regler och Functions).

1. ✅ Git, privat GitHub-repo (`osterberg77/okeken`), Firebase-projekt `okeken` (Blaze, europe-north1), Astro + Tailwind, `firebase.json`, emulatorer, GitHub Actions (deploy från `main`, preview för PR).
2. ✅ Layout enligt `skisser/kalender-och-kontrollsymboler.md`: header, footer, kalender med kontrollsymboler, aktivitetslista, detaljvy, eventsidor med Open Graph. Infosidorna ligger nu i menyn (se steg 4).
3. ✅ Inloggning (lösenord med bekräftelsemejl, Google, e-postlänk), `users` + regler + tester, `/admin/anvandare`, `scripts/set-permissions.mjs`. Erik är superadmin.
4. ✅ Events i Firestore (utkast + `published`-ögonblicksbild), regler + tester, `/admin/events` och editor med preview, Facebook-kortpreview och `StatusBadge`. Seed-eventen importerade. Bygget läser Firestore via Admin SDK. Infosidor (`pages`): regler, regeltester, typer, byggläsning och Function `onPageWritten` klara. Admin-UI klart: `/admin/sidor` och `/admin/sida` (editor med preview via den delade `PageDetail`, formateringsknappar, länkväljare för sidor/events/egen adress med varning för opublicerade mål, slug från titeln vid första publiceringen med kontroll av reserverade adresser och krock före skrivning), publik rendering på `/<slug>` med Pagefind, menyn byggs från `getMenu()` (platshållarna Om oss/Bli medlem visas tills en meny med publicerade sidor är publicerad), seed-sidor i `seed/pages/` via `scripts/seed-pages.mjs` (som utkast). **Publicerade 2026-10-22:** Om klubben, Bli medlem, Träning och tävling, Terrängspår, Banläggning i Purple Pen, Stöd för träningsansvarig. **Fortfarande utkast:** Tävla, Veckans bana i Livelox. *Kvar:* styrelsen läser igenom och finjusterar texterna.
5. ✅ Publiceringspipeline: Function `onEventWritten` (`functions/`) skickar `repository_dispatch` (`content-published`) när publicerat innehåll ändras; Deploy-workflown triggas också av nattlig cron (03:15 UTC), bygger, deployar och skriver `meta/build.lastBuildAt` (byggets *starttid*) via `scripts/write-build-time.mjs`. Editorn visar "byggs om" och aktiverar "Dela på Facebook" först när `lastBuildAt > publishedAt`. Regel + test för `meta/build`.
   Live sedan 2026-10-21. Uppsättningen gjordes en gång: GitHub-token (fine-grained, *Contents: read & write*, går ut om ett år, byt med `firebase functions:secrets:set GITHUB_DISPATCH_TOKEN --project okeken`), extra roller för `github-deploy@` och tre roller för Googles tjänstekonton, API:erna Cloud Billing/Eventarc m.fl., städpolicy för Artifact Registry i europe-north1 (`firebase functions:artifacts:setpolicy --location europe-north1`).
6. ✅ Kalendern: inloggade publicerare ser utkast, avpublicerade och opublicerade ändringar bland de vanliga eventen, med `StatusLabel`, streckad gul kant och `StatusBadge` i detaljvyn (`src/lib/firebase/calendar-drafts.ts`, laddas bara om man är inloggad). Besökare får aldrig Firebase eller utkast. *Kvar:* visuell kontroll mobil + desktop (Erik).
7. ✅ PDF-banor (live, Storage-reglerna deployade): `storage.rules` (`courses/<eventId>/<slumpat>-<namn>.pdf`, bara nya filer, max 10 MB, get men inte list, behörighet läses från `users/{uid}`), `courseFiles` i events (max 8, validerade i `firestore.rules`), uppladdning och borttagning i editorn, nedladdningslänkar under "Banor" på eventsidan. Granskad av Opus 2026-10-21. Borttagna banor raderas ur Storage av editorn efter sparning (bara filer som varken utkast eller publicerad version pekar på; regeln `delete` kräver `canUploadCourses()`). Beslutat (0006): banläggare får läsa events och redigera `courseFiles` själva; på publicerade events går banorna live direkt (vid nästa bygge) utan att övriga utkastsändringar publiceras. Regler och tester klara. Editor-UI för banläggare klart: de når `/admin/events` (läsning) och kan i editorn bara ändra, ladda upp och ta bort banor (`saveCourseFiles` i `src/lib/firebase/events.ts`); övriga fält är skrivskyddade, ingen publicering och ingen byggstatus (de får inte läsa `meta/build`).
   **Menyhantering (beslut 0008):** menyn ligger i `menu/main` (utkast `items` + `published`), med undermenyer (max 8 poster × 8 undersidor, rubriker utan egen sida). Regler + tester (`tests/rules/menu.test.ts`), byggläsning (`getMenu()`), Function `onMenuWritten`, `seed/menu.json`. Sidornas fält `inMenu`/`menuOrder`/`menuLabel` är borttagna; `scripts/migrate-menu.mjs` flyttar dem till `menu/main` och måste köras mot produktion direkt efter deploy (se beslut 0008). Admin-vyn `/admin/meny` är klar: lista med toppnivåposter och indenterade undersidor, flytta upp/ned med knappar, "Flytta in under…"/"Flytta ut"/"Flytta till…", byt menytext, ta bort ur menyn, lägg till sida (alla sidor som inte redan är med) eller rubrik, gränserna 8/8/ingen tredje nivå/unika sidor stoppas i UI:t med förklaring, spara utkast/publicera, StatusBadge/BuildStatus, varningar och förhandsvisning via `resolveMenu`. Sidlistan visar "Ej i menyn" och sidredigeraren "I menyn: ja/nej → Hantera menyn". Undermenyerna i headern är klara: `<details>`-rullgardiner med chevron, fungerar utan JS, liten inline-JS för Escape/klick utanför/aria-expanded (avsteg 4 i `skisser/kalender-och-kontrollsymboler.md`).
   **Styrelsens protokoll (beslut 0009):** admin-UI i `/admin/protokoll` (lista) och `/admin/styrelsemote` (nytt/redigera/läsvy, `ProtocolEditor.tsx`): nytt protokoll från mall (senaste, valfritt tidigare eller standarddagordning) med val att lyfta över ej avbockade punkter, närvarande, text med @-omnämnanden, att göra som checkbox-lista, sekreterare/justerare, godkänn/dra tillbaka, lås, kopiera till nytt, radera utkast, "Skriv ut" (`ProtocolView`). Länk under "Styrelsen" i kontomenyn. `StatusBadge.tsx` har `ProtocolStatusLabel`/`ProtocolStatusBadge`.
8. Pagefind-sök är byggd: `build` kör `pagefind --site dist`, bara eventsidor indexeras (`data-pagefind-body`), sökning på `/sok` (sökikon i headern, godkänd av Erik). Redirect `/traningskalender` → `/` ligger i `firebase.json`; övriga Wix-adresser läggs till när målsidorna finns (404 tills dess är OK, sajten byggs klart före flytten). *Kvar:* finjustering och lansering (DNS för okeken.se på Loopia).

8b. ✅ Karta med Leaflet/OpenStreetMap på event och Eventor-tävlingar, platsväljare i admin, Google Maps-länk (beslut 0010). Säkerhetshuvuden i `firebase.json` (X-Frame-Options, nosniff, Referrer-Policy).

9. ✅ Eventor-spegel (2026-10-21/22): hämtning på `/admin/eventor`, urval som utkast och knappen Publicera (live = valt urval, ett bygge per publicering), valda tävlingar visas i kalendern och länkar till Eventor. Se `eventor.md`.
9b. Mobilfixar och hosting (2026-10-22): tabeller och långa ord stannar inom sidkorten, periodkedjans ring klipps inte, sidor revalideras (`no-cache`) så att cachade 404 inte fastnar på mobil. Undantag: `/_astro/**` (hashade JS/CSS-filer) får `public, max-age=31536000, immutable` (en senare regel i `firebase.json` vinner, provat i Hosting-emulatorn). Bilder i Storage: bildbankens unika filer laddas upp med `immutable`, profilbilden (fast filnamn) med `max-age=300`.

Justeringar efter första användartestet (2026-10-21): listans ordning när man väljer en dag bakåt, månadsväljare vid månadsrubriken och filtret Information. Se "Avsteg" i `skisser/kalender-och-kontrollsymboler.md`.

### Att göra före release: tajta till reglerna

- **Storage-reglerna är i stort sett tajtade och deployade** (2026-10-22, efter Opus-granskning): `canUploadCourses()`/`canPublishImages()`, filnamnsmönster, typ och storlek är tillbaka för uppladdning, och `courses/` `delete` kräver `canUploadCourses()`. Kvar: `!imagePostExists` och metadatakontrollerna (`contentDisposition`/`contentEncoding`/egen metadata), som kan vara orsaken till 403 vid uppladdning i produktion. Återinför dem ett steg i taget och testa uppladdning i admin efter varje deploy; slå sedan på de två `it.skip` i `tests/rules/storage.test.ts`. Strikt variant: commit `e247536`.
- Överskrivningstesterna för Storage går inte att köra i emulatorn (den räknar överskrivning som create); skyddet bygger på att Storage-`create` inte gäller befintliga filer.

### Att veta inför nästa session

- Arbetssätt och kommandon: `CLAUDE.md`. Designspec är bindande: `skisser/kalender-och-kontrollsymboler.md`.
- Regeltester: `npm run test:rules`. Lokalt mot emulatorer: `npm run emulators` + `npm run dev:emu`.
- Deploykontot `github-deploy@okeken.iam.gserviceaccount.com` har roller för Hosting, regler, index och Firestore-läsning; Functions-deploy kräver fler roller (se steg 5).
- Logotypernas källfiler (EPS/PDF/PNG) ligger i arkivet utanför repot (`~/progg/arkiv/okeken-logo/`); bara `assets/logo/lila-bakgrund.svg` är incheckad. `.dirac-cache/` ligger i `.gitignore`.

## Flytt från Wix

**Status 2026-10-21:** åtta infosidor är importerade som utkast i produktion (`seed/pages/`): Om klubben, Bli medlem, Träning och tävling, Tävla, Terrängspår i Botorp, Veckans bana i Livelox, Banläggning i Purple Pen, Stöd för träningsansvarig. Adresserna (satta från titeln vid publicering) matchar gamla okeken.se utom Om klubben (`/om-ok-eken`) och Purple Pen (`/banlaggning-purple-pen`), som har redirect i `firebase.json`. PDF-kartor för terrängspåren och startlistan ligger i `public/dokument/`. Kvar att flytta: informationsbladet (8 MB), Eken-Nytt-arkivet (102 PDF:er, 18 MB), nyheter och blogg; de kräver dokumentarkiv eller nyhetssida (se `framtida-funktioner.md`). Bli medlem-sidan ber om mejl i stället för Idrottonline-formuläret tills vi beslutat hur ansökan ska ske.

- Omdirigeringar från gamla adresser behövs inte (beslut 2026-10-22: vi byter sida när den nya är klar).
- Informationsbladet, Eken-Nytt-arkivet, nyheter och blogg tas senare.
- Domän okeken.se ägs av klubben och ligger hos Loopia. DNS pekas om till Firebase Hosting vid lansering.
- Wix avvecklas först efter att PDF:er sparats (se `gamla-sajten/scripts/fetch-wix-assets.sh`) och sajten är live.

## GDPR

- **Profil och kontoradering klart 2026-10-22 (beslut 0013):** `/profil` med namn, färg, bild, byte av e-post och lösenord, integritetsval, och permanent radering via `deleteMyAccount`. Verifierat mot emulatorer (Auth, Firestore, Storage, Functions) på mobilbredd: profilfärg, radering (konto, dokument och svar borta, annan användare orörd). **Ej verifierat i webbläsaren:** bilduppladdning, byte av e-post och lösenord. Deployat.
- **Svar på events klart 2026-10-22 (beslut 0012):** Kommer/Kommer kanske/Kommer inte för inloggade medlemmar, antal och namn vid hovring, möjlighet att dölja sitt namn (räknas ändå, styrelsen ser vem). Verifierat mot emulatorer (Auth + Firestore) på mobilbredd. Deployat.
- **Grundplatta klar 2026-10-22 (beslut 0011):** policysida `/integritet` (`src/pages/integritet.astro`, länkad i sidfoten och kontomenyn) och kort godkännande vid inloggning (`ConsentDialog`, `users/{uid}.consent`). Den som inte godkänt eller valt "Fråga mig senare" får frågan igen vid nästa inloggning. **Texten är en grundplatta och ska läsas igenom av styrelsen** (personuppgiftsansvarig, rättslig grund, lagringstid, kontaktadress) innan skarp lansering. Uppdatera policyn och höj `CONSENT_VERSION` när en ny funktion samlar in uppgifter (resultat, Kommer/Kommer inte, bilder, statistik).
- Resultat med namn och bilder på barn som publiceras öppet kräver en enkel policy om samtycke (före v1.1). Gäller även bildbanken (beslut 0007): bilder i bildbanken är publika för den som har länken.
- Bli-medlem-formuläret (personnummer) kräver särskild hänsyn; förslag: länka till Idrottonline i stället för eget formulär.

## Övrigt beslutat från granskningen

- Stabila event-adresser: `/event/<datum>-<slug>`, låses efter första publicering.
- Inloggning: e-post + lösenord (med bekräftelsemejl), Google eller e-postlänk utan lösenord.

## Besöksstatistik

**Behov:** besökare per träning/event (varje event har egen adress), varifrån de kommer (referenser, land) och antal nedladdningar av filer. Mer behövs inte. Gratis, cookiefritt (ingen cookiebanner), ingen statistik i admin/preview.

**Beslut 2026-10-22: egen räknare från v1 (väg B), ingen Umami.** Allt som behövs är: vilka sidor som besöks mest, varifrån besökarna kommer (referens, land) och antal nedladdningar per fil och sida.
- Klientskript (någon hundra byte, bara publika sidor, inte för inloggade publicerare) skickar `pageview` (sökväg, `document.referrer`) och `download` (fil + sidan den klickades på, via `navigator.sendBeacon`) till en Cloud Function bakom Hosting (`/api/hit`).
- Funktionen filtrerar bottar på User-Agent, tar land från IP-sidans huvud (IP sparas aldrig) och ökar dagliga räknare i Firestore med `FieldValue.increment`: `stats/{datum}/pages/{slug}` (visningar, referenser per domän, länder) och `.../downloads/{sidan}__{fil}`. Inga cookies och ingen persondata, så ingen cookiebanner.
- Unika besökare: tas med om det blir enkelt (Erik 2026-10-22), annars räcker antal visningar. Förslag: dagligt roterande hash av IP + User-Agent + dagens salt, bara hashen sparas (med TTL så den försvinner efter något dygn), aldrig IP.
- Reglerna: klienter får aldrig skriva `stats` (bara Functions via Admin SDK) och bara publicerare/styrelse/superadmin läser. Nytt regeltest krävs.
- Admin: `/admin/statistik` (klart). *Kvar:* en rad per event i editorn ("142 visningar, 31 nedladdningar").
- Integritetstexten är uppdaterad och ADR 0014 skriven.

## Startinnehåll

Rådata från gamla sajten (sidtexter, JSON-data, 107 nedladdade PDF:er, privata kontakter) ligger **utanför repot** i `Projects/okeken/gamla-sajten/` (arkiv, se dess `content/README.md`). Det som bedöms ha framtida värde väljs ut och läggs i `seed/` i repot (Markdown/JSON) respektive Storage vid migrering. Logotyper i `assets/logo/`. Äldre underlag i `docs/underlag/`.

## Öppna frågor

- Mallar: vilka 2–3 startmallar (event, resultat, träning)? (v1.2)
- Bara publicerare får ladda upp bilder? (förslag: ja)
- Nyhetsbrevstjänst idag? (Mailchimp enligt `framtida-funktioner.md`.) Beslutat 2026-10-22: nuvarande logotyp och färger behålls.
- Bli medlem: länka till Idrottonline eller eget formulär?
