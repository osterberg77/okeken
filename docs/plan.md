# Projektplan – sammanfattning

Utgångspunkt för bygget. Detaljer finns i övriga dokument i `docs/`; vid konflikt gäller detta dokument och `beslut/`.

## Mål

Ersätta okeken.se (Wix) med en snabb, statisk och sökbar sajt plus ett enkelt CMS för träningar, tävlingar och events. Utseende enligt vald designriktning (se `underlag/designriktning.md` och `skisser/`). Liten klubb, lite trafik: enkelt och publiceringsvänligt prioriteras.

## Beslutat

- **Firebase:** Firestore, Hosting, Auth, Storage, Functions (Blaze-plan med budgetlarm; praktiskt 0 kr vid klubbens trafik).
- **GitHub + GitHub Actions:** privat repo på Eriks konto, auto-deploy från `main`. Gratiskvoten (2 000 min/månad) räcker gott: ett bygge tar ca 2–3 min, nattbygge ≈ 90 min/månad, publiceringar några hundra minuter.
- **Statisk prerender:** alla publika sidor (även varje event) byggs till HTML med korrekta Open Graph-taggar. Firestore är redigeringsbackend. Publicering startar en rebuild, ca 1–2 min till live (beslut 0004).
- **Utkast och publicerat skiljs åt:** "Publicera" kopierar utkastet till `published`-snapshoten; bygget läser bara den (se `datamodell.md`).
- **Roller som behörigheter** på vanliga konton, lagrade i Firestore (`users/{uid}.permissions`) och kontrollerade i reglerna (beslut 0005). Admin-sida för tilldelning. Ingen separat "admin": superadmin tilldelar allt; styrelse tilldelar `member`, `course_setter` och `publisher`.
- **Mindre v1** (se nedan): sajten ska kunna ersätta Wix så snart som möjligt; resten byggs ovanpå en sajt i drift.
- **Statiska sidor** redigeras i admin som Markdown (Firestore `pages`) med enkel editor och preview, samma pipeline som events. Startinnehåll seedas från `seed/` med ett engångsskript.
- **Filer:** PDF:er från gamla sajten (Eken-Nytt, spårkartor, dokument) ligger i arkivet utanför repot. Det som behövs läggs i Storage vid migrering. Repot hålls litet: kod, dokumentation och `seed/` (Markdown/JSON).
- **Resultat och träningar** (v1.1) är en enkel digital variant av dagens papperslistor (namn, bana, tid, kommentar), inmatad av publicerare/banläggare. Ingen import.
- **Sökindex:** publicerade events och sidor ingår automatiskt i Pagefind eftersom allt prerenderas.
- **Hosting-adress:** `okeken.web.app` (eller närliggande) tills vidare; okeken.se (Loopia) pekas om vid lansering.
- **Livelox parkerat.** Närvaroregistrering utanför v1.

## Förslag (bekräfta vid scaffolding)

Astro + React-öar, Tailwind 4 (Plus Jakarta Sans), Pagefind, TypeScript (beslut 0003).

## V1 – ersätter Wix

1. Layout, header/footer, meny enligt designriktningen.
2. Statiska infosidor seedade från `seed/` (Om klubben, Bli medlem, Träning & tävling, Terrängspår, Tävla, guider, Eken-Nytt-arkiv), möjlighet att lägga till sidor och menyalternativ i rimlig omfattning.
3. Inloggning (Google + e-postlänk) och roller med admin-sida för tilldelning.
4. Events och träningar: titel, typ, start och slut, plats, text. Skapa, redigera, publicera, avpublicera.
5. **Live preview** i admin av utkast, inkl. SoMe-kort.
6. **Statusbadge** i hörnet på allt opublicerat för inloggade (`StatusBadge`).
7. Ladda upp och ladda ner PDF-banor.
8. Kalender/tidslinje, aktivitetslista och detaljvy.
9. Sök (Pagefind).
10. Enkel delningsknapp (förifylld text och länk, aktiv först när bygget är klart).
11. Omdirigeringar från gamla Wix-adresser (utgå från `gamla-sajten/content/data/redirects.json` i arkivet → `firebase.json`).

## V1.1

- Logga resultat.
- Eventor: nattlig synk, urval av tävlingar speglas i kalendern.
- **Schemalagd publicering** (`publishAt`, schemalagd Function).
- Enklare bildbank: uppladdning med automatisk skalning, bildväljare i editorn, bilder i Markdown.

## V1.2

- **SoMe-bilder från mallar** (SVG-mallar med text-/bildfält, export till PNG).
- Automatisk `og:image` per event från standardmall.
- Mallredigeraren när behovet finns.

## Publiceringsflöde

Admin publicerar/avpublicerar i Firestore → Cloud Function → `repository_dispatch` → GitHub Actions bygger (hämtar publicerad data med Admin SDK, Astro, Pagefind) → deploy till Hosting → skriver `meta/build.lastBuildAt`. Bygget köas via `concurrency`; ingen egen debounce behövs. Nattligt fullbygge som skyddsnät. (v1.1) Schemalagd Function var 15:e minut publicerar event vars `publishAt` passerat.

## Statusregler (UX)

Fast badge i hörnet för `UTKAST`, `SCHEMALAGD – publiceras <tid>`, `AVPUBLICERAD`, `OPUBLICERADE ÄNDRINGAR`. Statusetiketter även i listor och kalender för inloggade. Besökare ser aldrig opublicerat eller badges.

## Bildbank och mallar – återanvändning från Coworken (v1.1/v1.2)

Coworken (`~/progg/coworken`) har en fungerande bildbank och ett mallverktyg. Slutsats: vettigt att återanvända **logiken och datamodellerna**, inte UI-koden rakt av (Coworken är React/Vite med eget CSS-system, detta projekt är Astro + Tailwind, så admin-UI skrivs om i samma anda). Claude Code behöver `~/progg/coworken/src` och `functions` tillagda som arbetskataloger i sessionen när arbetet påbörjas.

**Bildbank (v1.1)**
- Modell `ImageBankItem` (url, webUrl 1920 px, thumbnailUrl 800 px, valfri 4K om originalet >10 MB, byline, alt-text, `storagePaths`, `uploadedBy`), källa: `src/types/models/imageBank.ts`.
- Uppladdning och skalning i webbläsaren (canvas, WebP) före uppladdning till Storage, källa: `src/firebase/firestore/imageBank.ts`, `src/utils/image.ts`.
- Bildväljare (modal) som kan öppnas från editorn, källa: `ImageBankModal.tsx`; hanteringssida, källa: `AdminImageBankPage.tsx`.
- Anpassning för OK Eken: åtkomst via behörighet `publisher` (Coworkens Storage-regel tillåter alla inloggade, vilket inte är OK här); `description` används som alt-text; bild-URL:er kommer från `webUrl`/`thumbnailUrl` med `srcset`.
- **Markdown:** bildväljaren infogar `![alt](webUrl)` i editorn. Vid build kan Astro lägga på `srcset`/lazy loading. Samma bilder används i events, sidor och mallar.

**Mallar för SoMe-bilder (v1.2)**
- Modell `DesignTemplate` + `TemplateField` (text/bild, maxlängd, `fit`), källa: `src/types/models/template.ts`.
- SVG sanitiseras **alltid** server-side i en Cloud Function (`sanitize-html` med allowlist, inga script/foreignObject), klientskrivning till `templates/` nekas i Storage-reglerna, källa: `functions/src/templates.ts`. Samma mönster ska användas här.
- Fyll i mall + rasterisera till PNG och spara i bildbanken eller ladda ner, källa: `templateUtils.ts`, `TemplateExportActions.tsx` (använder `html-to-image`).
- Några färdiga SVG-mallar uppladdade av superadmin, fyll-i-formulär och export, plus knapp "Skapa SoMe-bild" på eventet (titel, datum, plats förifyllt).
- Mallredigeraren (`TemplateEditorPage.tsx`, ca 3 200 rader) porteras när behovet finns.
- `og:image` för varje event genereras vid bygget från en standardmall (rasterisering i Actions, t.ex. `@resvg/resvg-js`).

## Eventor (v1.1)

API-nyckel som GitHub Secret `EVENTOR_API_KEY` (aldrig i repot). Det nattliga bygget börjar med ett synksteg som hämtar tävlingar (`/api/events`, header `ApiKey`) och skriver dem till Firestore (`source: eventor`); publicerare väljer vilka som visas. Knappen "Synka nu" kör samma workflow manuellt. Detaljer i `eventor.md`.

## Byggordning (v1)

1. Git, GitHub-repo, Firebase-projekt (Blaze + budgetlarm). Scaffolda Astro + Tailwind, `firebase.json`, emulatorer, GitHub Actions för deploy från `main`.
2. Layout, header/footer, meny. Infosidor byggda direkt från `seed/` (Markdown i repot) så att sajten syns tidigt.
3. Auth, `users`, regler med regeltester, admin-sida för behörigheter, engångsskript för första superadmin.
4. Events och sidor i Firestore: datamodell, admin-CRUD, preview, `StatusBadge`, publicera/avpublicera. Seed-skript flyttar sidorna från `seed/` till Firestore.
5. Publiceringspipeline: trigger → Actions → deploy → `lastBuildAt`, delningsknapp.
6. Kalender, tidslinje och aktivitetslista.
7. PDF-banor (Storage).
8. Pagefind-sök, omdirigeringar, finjustering, lansering (DNS på Loopia).

## Flytt från Wix

- Omdirigeringar från gamla adresser (förslag i `gamla-sajten/content/data/redirects.json`) läggs i `firebase.json`.
- Domän okeken.se ägs av klubben och ligger hos Loopia. DNS pekas om till Firebase Hosting vid lansering.
- Wix avvecklas först efter att PDF:er sparats (se `gamla-sajten/scripts/fetch-wix-assets.sh`) och sajten är live.

## GDPR

- Resultat med namn och bilder på barn som publiceras öppet kräver en enkel policy om samtycke (före v1.1).
- Bli-medlem-formuläret (personnummer) kräver särskild hänsyn; förslag: länka till Idrottonline i stället för eget formulär.

## Övrigt beslutat från granskningen

- Stabila event-adresser: `/event/<datum>-<slug>`, låses efter första publicering.
- Inloggning: Google + e-postlänk (utan lösenord).

## Startinnehåll

Rådata från gamla sajten (sidtexter, JSON-data, 107 nedladdade PDF:er, privata kontakter) ligger **utanför repot** i `Projects/okeken/gamla-sajten/` (arkiv, se dess `content/README.md`). Det som bedöms ha framtida värde väljs ut och läggs i `seed/` i repot (Markdown/JSON) respektive Storage vid migrering. Logotyper i `assets/logo/`. Äldre underlag i `docs/underlag/`.

## Öppna frågor

- Eventor: OK Ekens organisations-ID och distriktets ID (v1.1).
- Mallar: vilka 2–3 startmallar (event, resultat, träning)? (v1.2)
- Bara publicerare får ladda upp bilder? (förslag: ja)
- Egen färgprofil eller fortsatt lila + grön? Nyhetsbrevstjänst idag?
- Vilken logotypvariant i headern (`lila-bakgrund` eller `gron-gul`)?
- Bli medlem: länka till Idrottonline eller eget formulär?
