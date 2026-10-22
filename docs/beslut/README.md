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
| [0008](0008-menyhantering.md) | Menyn i ett publiceringsstyrt dokument `menu/main` med undermenyer; menyfälten tas bort från sidorna | Förslag |
| [0009](0009-styrelsens-protokoll.md) | Styrelsens protokoll i `protocols` (bara styrelse/superadmin), godkännande och lås i reglerna, omnämnanden `@[Namn](mention:uid)` | Beslutat |
| [0011](0011-gdpr-godkannande.md) | Integritetspolicy på `/integritet` och godkännande per användare i `users/{uid}.consent`, med versionsstyrd omfråga | Beslutat |
| [0012](0012-svar-pa-events.md) | Kommer/Kommer kanske/Kommer inte i `rsvps/{slug}/responses/{uid}`, bara medlemmar, dolt namn räknas ändå | Beslutat |
