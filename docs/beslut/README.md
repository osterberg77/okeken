# Beslutslogg

En fil per beslut: `NNNN-kort-titel.md` med *Kontext*, *Beslut*, *Konsekvenser*.

| # | Beslut | Status |
|---|---|---|
| 0001 | Firebase (Firestore, Hosting, Auth, Storage) | Beslutat |
| 0002 | GitHub + GitHub Actions, auto-deploy från `main` | Beslutat |
| 0003 | Astro + React-öar, Tailwind 4, Pagefind | Förslag |
| [0004](0004-statisk-prerender-med-rebuild.md) | Statisk prerender med rebuild vid publicering | Beslutat |
| [0005](0005-roller-i-firestore.md) | Roller i Firestore (`users/{uid}.permissions`) i stället för custom claims | Beslutat |
| [0006](0006-banlaggare-och-courseFiles.md) | Banläggare redigerar `courseFiles` själva och kan publicera banor utan övriga utkastsändringar | Beslutat |
| [0007](0007-bildbank.md) | Bildbank: platt `image_bank/`, bara egna Storage-URL:er, publika bilder via token-URL, radering först när posten är borta | Beslutat |
| [0008](0008-menyhantering.md) | Menyn i ett publiceringsstyrt dokument `menu/main` med undermenyer; menyfälten tas bort från sidorna | Beslutat |
| [0009](0009-styrelsens-protokoll.md) | Styrelsens protokoll i `protocols` (bara styrelse/superadmin), godkännande och lås i reglerna, omnämnanden `@[Namn](mention:uid)` | Beslutat |
| [0010](0010-karta-med-leaflet.md) | Riktig karta med Leaflet och OpenStreetMap, Google Maps-länk | Beslutat |
| [0011](0011-gdpr-godkannande.md) | Integritetspolicy på `/integritet` och godkännande per användare i `users/{uid}.consent`, med versionsstyrd omfråga | Beslutat |
| [0012](0012-svar-pa-events.md) | Kommer/Kommer kanske/Kommer inte i `rsvps/{slug}/responses/{uid}`, bara medlemmar, dolt namn räknas ändå | Beslutat |
| [0013](0013-profil-och-kontoradering.md) | Profilsida `/profil` (namn, färg, bild, e-post, lösenord, integritet) och permanent kontoradering via Cloud Function `deleteMyAccount` | Beslutat |
| [0014](0014-besoksstatistik.md) | Egen besöksräknare: skript → Cloud Function `hit` → dagliga räknare i Firestore, unika via dagshash, ingen IP sparas | Beslutat |
| [0015](0015-medlemslista.md) | Medlemslista `members/{uid}` (namn, bild, `publicName`) som Function håller i synk med `users`, läsbar för banläggare och uppåt | Beslutat |
| [0016](0016-schemalagd-publicering.md) | Schemalagd publicering: `publishAt` på events, Function var 15:e minut publicerar utkastet | Beslutat |
| [0017](0017-resultat-pa-traningar.md) | Resultat på träningar: interna rader per event, publik lista byggs av en Function, ungdomsmarkering aldrig publik | Beslutat |
| [0018](0018-dolj-mig.md) | "Dölj mig": `users.hidden` ersätter `hideNameInRsvp`, dolda utelämnas helt ur publika vyer, bygget filtrerar resultat, `docs/integritet.md` är facit | Beslutat |
| [0019](0019-meddelanden.md) | Meddelanden: `conversations/{a_b}` med `messages`, personlig avsändare, en läsmarkering per konversation, röd badge, dolda nås inte i sökningen | Beslutat |
| [0020](0020-medlemsavgift-och-betalningar.md) | Medlemsavgift: avgiftstabell per år, betalning via Swish-länk/QR utan avtal, väntande betalningar som styrelsen prickar av, status per person och år | Beslutat |
| [0024](0024-banlaggare-tas-bort.md) | Banläggare som roll tas bort; publicerare lägger in banor (ersätter 0006) | Beslutat |
