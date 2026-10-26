# Roller och behörigheter

Behörigheter (funktioner) kopplas på vanliga konton – ett konto kan ha flera. Lagras i Firestore på `users/{uid}.permissions` och kontrolleras av säkerhetsreglerna (beslut 0005). Inga custom claims.

| Roll | Nyckel | Tänkt innehåll |
|---|---|---|
| gäst | – | Ej inloggad. Läsa publicerat innehåll |
| medlem | `member` | Inloggad. Inget eget innehåll i v1 (medlemsinnehåll krockar med statiska sidor) |
| publicerare | `publisher` | Skapa/redigera/publicera events och sidor, bildbanken (beslut 0007), dela till SoMe |
| styrelse | `board` | Som publicerare + tilldela alla behörigheter utom `superadmin` (även `board`, och ta bort sin egen) |
| superadmin | `superadmin` | Allt, och ensam om att tilldela `superadmin`, (v1.2) mallar |

Beslut: ingen separat `admin`-roll.

## Admin-sida för behörigheter

`/admin/anvandare` listar konton med kryssrutor per behörighet. Superadmin ser alla rutor; styrelse ser bara de roller de får tilldela. Sidan skriver direkt till `users/{uid}.permissions` – reglerna avgör om skrivningen är tillåten, så UI:t är bara bekvämlighet.

Inloggning på `/logga-in`: e-post + lösenord (förvalt, välbekant för de flesta), Google eller e-postlänk utan lösenord. Lösenordskonton måste bekräfta e-postadressen innan de får ett users-dokument (regeln kräver `email_verified`), så ingen kan registrera sig med någon annans adress och få dennes roller. "Välj eller byt lösenord" i profilmenyn skickar ett mejl, så den som börjat med Google eller länk kan också skaffa lösenord.

Nya konton: när någon loggar in första gången skapas `users/{uid}` med tom `permissions`. Superadmin/styrelse ger sedan behörigheter. Första superadmin sätts med `scripts/set-permissions.mjs` (Admin SDK).

Headerns kontomeny laddar Firebase bara om webbläsaren varit inloggad tidigare (`localStorage`), så besökare får ingen extra JavaScript.

## Regler (princip)

```
function perms() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissions; }
function has(p)  { return request.auth != null && p in perms(); }
```

- Användare får skapa sitt eget `users/{uid}` med `permissions: []` och ändra `displayName`, aldrig sin egen `permissions`.
- `superadmin` får ändra `permissions` fritt.
- `board` får lägga till/ta bort allt utom `superadmin`, även `board` (också sin egen); skillnaden mellan före och efter (`diff`) får inte röra `superadmin`.
- Storage-regler läser samma dokument via `firestore.get()`.
- `pages` (infosidor): bara `publisher`, `board`, `superadmin`, samma regler som events (`tests/rules/pages.test.ts`).
- `menu/main` (huvudmenyn, beslut 0008): bara `publisher`, `board`, `superadmin` får läsa, spara utkast och publicera. Medlemmar och besökare har ingen åtkomst (bygget läser med Admin SDK). Ingen får radera dokumentet. Tester: `tests/rules/menu.test.ts`.
- `imageBank` och Storage `image_bank/` (beslut 0007): bara `publisher`, `board`, `superadmin` får läsa, ladda upp, ändra metadata (namn, fotograf, alt-text) och radera. Banläggare och medlemmar har ingen åtkomst. Filerna kan hämtas av alla med länken men inte listas. Tester: `tests/rules/imageBank.test.ts`, `tests/rules/storage.test.ts`.
- `protocols` (styrelsens protokoll, beslut 0009): bara `board` och `superadmin` får läsa, skapa, redigera och radera (`canViewProtocols` i `src/types/user.ts` speglar regeln). Publicerare, banläggare och medlemmar har ingen åtkomst, och bygget läser aldrig collectionen. Bara den utsedda sekreteraren respektive justeraren får godkänna sin del (servertid, inget annat fält ändras) och dra tillbaka sitt eget godkännande; när båda godkänt är protokollet låst och kan varken ändras eller raderas. Innehållsändringar nollställer båda godkännandena. Tester: `tests/rules/protocols.test.ts`.
- `membershipFees` och `membershipPayments` (medlemsavgift, beslut 0020): avgiftstabellen läses av alla; styrelse och superadmin skriver tabellen och ser/prickar av betalningar (`canManageMembership`). Betalaren läser sin egen betalning. Webbetalningar skapas av Function. Tester: `tests/rules/membership.test.ts`.
- UI döljer funktioner men är aldrig själva skyddet. Regeltester mot emulatorn täcker delegeringen.


## UI för infosidor

`/admin/events`, `/admin/sidor` och `/admin/sida` kräver `canPublish`. Banläggare finns inte som roll (beslut 0024).
