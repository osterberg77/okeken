# OK Eken – ny hemsida

Ny webbplats för OK Eken (ersätter okeken.se på Wix). Snabb, statisk och sökbar sida med ett enkelt CMS för träningar, tävlingar och events.

> Status: uppstart. Se [`docs/`](docs/README.md) för implementationsdetaljer, skisser och beslut. Full projektplan: [`docs/plan.md`](docs/plan.md).

## Sammanfattning

- **Vad:** snabb, statisk och sökbar sajt med enkelt CMS för träningar, tävlingar och events, plus statiska infosidor.
- **Hur:** Astro prerenderar alla publika sidor (inkl. varje event med korrekta SoMe-förhandsvisningar). Firebase (Firestore, Auth, Storage, Hosting) är backend och hosting. GitHub Actions bygger och deployar från `main`.
- **Publicering:** ändring i admin → rebuild (ca 1–2 min) → live. Live preview av utkast, avpublicering och schemalagd publicering. Tydlig statusbadge i hörnet för allt opublicerat.
- **Roller:** behörigheter på vanliga konton (gäst, medlem, banläggare, publicerare, styrelse, superadmin).
- **Etapper:** v1 ersätter Wix; resultat, Eventor, schemalagd publicering och bildbank i v1.1; SoMe-mallar i v1.2. Se `docs/plan.md`.
- **Eventor (v1.1):** nattlig synk av ett urval tävlingar till kalendern. Livelox parkerat.
- **Nästa steg:** scaffolda projektet enligt byggordningen i [`docs/plan.md`](docs/plan.md).

## Tech-stack

| Område | Val | Status |
|---|---|---|
| Databas | Firebase Firestore | Beslutat |
| Hosting | Firebase Hosting | Beslutat |
| Autentisering | Firebase Authentication (Google + e-postlänk), roller i Firestore | Beslutat (beslut 0005) |
| Filer (PDF-banor, bildbank) | Firebase Storage, bilder skalas i webbläsaren vid uppladdning | Förslag |
| Serverlogik (publiceringstrigger, schemalagd publicering, Eventor-synk) | Cloud Functions for Firebase | Förslag |
| Källkod / CI/CD | GitHub + GitHub Actions, auto-deploy från `main` | Beslutat |
| Frontend | Astro (statisk output) + React-öar för interaktivt | Förslag |
| Styling | Tailwind CSS 4, Plus Jakarta Sans | Förslag (följer designutkastet) |
| Sök | Pagefind (statiskt index vid build) | Förslag |
| Språk | TypeScript | Förslag |

"Förslag" = ej slutligt bekräftat; ändra här och i `docs/beslut/` när det avgörs.

## Principer

- **Statiskt först.** Alla publika sidor, inklusive varje event, genereras vid build (prerender) och serveras som ren HTML från Firebase Hosting. Firestore är redigeringsbackend; vid publicering startas en ny build (ca 1–2 min). Det ger korrekt delning till SoMe (Open Graph) och sökbarhet.
- **Live preview, enkel korrigering.** Utkast kan förhandsgranskas direkt i admin. Publicera, avpublicera och schemalägg publicering med ett klick.
- **Enkelt CMS.** Inloggade användare med rätt behörighet kan skapa och redigera innehåll utan att röra koden.
- **Tydlig status för inloggade.** Allt som inte är live märks alltid med en synlig badge i hörnet (se `docs/arkitektur.md`).
- **Roller som behörigheter.** Funktioner kopplas på vanliga konton; ett konto kan ha flera.
- **Snabbt och sökbart.** Litet JS-bidrag, fulltextsök över sidor och events.

## Version 1 – scope

Mål: ersätta Wix så snart som möjligt. Fullständig lista i [`docs/plan.md`](docs/plan.md).

- Layout enligt vald designriktning (kalender/tidslinje överst, aktivitetslista, detaljvy)
- Statiska informationssidor seedade från `seed/`, med möjlighet att lägga till sidor och menyalternativ
- Inloggning och roller med admin-sida för tilldelning
- Skapa/redigera **träningar och events** (start och slut, plats, text, kategori) med **live preview**, **publicera/avpublicera** och **statusbadge**
- **Ladda upp PDF-banor** (och ladda ner dem)
- **Sök** och enkel **delning till sociala medier**
- Omdirigeringar från gamla Wix-adresser

V1.1: resultat, Eventor-koppling, schemalagd publicering, bildbank. V1.2: SoMe-bilder från mallar, og:image per event.
Senare: närvaroregistrering/kiosk-läge, Livelox-integration, blogg, nyhetsbrev, sponsorer.

## Roller (översikt)

`gäst` · `medlem` · `banläggare` · `publicerare` · `styrelse` · `superadmin`

Detaljer i [`docs/roller-och-behorigheter.md`](docs/roller-och-behorigheter.md).

## Mappstruktur (planerad)

```
.
├── README.md
├── docs/                  # Implementationsdetaljer, skisser, beslut
├── src/                   # Astro-sajt (sidor, komponenter, content)
├── functions/             # Cloud Functions (Eventor-synk m.m.)
├── firestore.rules
├── storage.rules
├── firebase.json
└── .github/workflows/     # CI/CD
```

## Utveckling

```bash
npm install
npm run dev          # lokal utveckling (Astro)
npm run build        # statisk build till dist/
npm run preview      # förhandsgranska bygget
npm run check        # typkontroll (astro check)
npm run emulators    # Auth, Firestore, Storage, Hosting lokalt
```

## Deploy

- Push/merge till `main` → GitHub Actions bygger och deployar till Firebase Hosting.
- Pull requests → preview-kanal på Firebase Hosting.
- Secrets (t.ex. `FIREBASE_SERVICE_ACCOUNT`, Eventor API-nyckel) ligger i GitHub Secrets / Firebase, aldrig i repot.

Se [`docs/deploy.md`](docs/deploy.md).
