# Roller och behörigheter

Behörigheter (funktioner) kopplas på vanliga konton – ett konto kan ha flera. Lagras i Firestore på `users/{uid}.permissions` och kontrolleras av säkerhetsreglerna (beslut 0005). Inga custom claims.

| Roll | Nyckel | Tänkt innehåll |
|---|---|---|
| gäst | – | Ej inloggad. Läsa publicerat innehåll |
| medlem | `member` | Inloggad. Inget eget innehåll i v1 (medlemsinnehåll krockar med statiska sidor) |
| banläggare | `course_setter` | Läsa events (även utkast), ladda upp PDF-banor och koppla dem till event (`courseFiles`, beslut 0006), (v1.1) mata in resultat |
| publicerare | `publisher` | Skapa/redigera/publicera events och sidor, bildbanken (beslut 0007), dela till SoMe |
| styrelse | `board` | Som publicerare + tilldela `member`, `course_setter`, `publisher` |
| superadmin | `superadmin` | Allt, inklusive tilldelning av `board` och `superadmin`, (v1.2) mallar |

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
- `board` får bara lägga till/ta bort `member`, `course_setter`, `publisher`; skillnaden mellan före och efter (`diff`) får inte röra `board`/`superadmin`.
- Storage-regler läser samma dokument via `firestore.get()`.
- `course_setter` (beslut 0006): läsa `events` och uppdatera bara `courseFiles` (+ `updatedBy`/`updatedAt`). På ett publicerat event får samma skrivning sätta `published.courseFiles` till exakt utkastets lista; allt annat i `published` (även huvudbilden `image`), samt `publishedAt`, `status` och `slug`, måste vara oförändrat. Ingen åtkomst till `pages`, `menu` eller `meta/build`. Tester: `tests/rules/events.test.ts` ("banläggare").
- `pages` (infosidor): bara `publisher`, `board`, `superadmin`, samma regler som events (`tests/rules/pages.test.ts`).
- `menu/main` (huvudmenyn, beslut 0008): bara `publisher`, `board`, `superadmin` får läsa, spara utkast och publicera. Banläggare, medlemmar och besökare har ingen åtkomst (bygget läser med Admin SDK). Ingen får radera dokumentet. Tester: `tests/rules/menu.test.ts`.
- `imageBank` och Storage `image_bank/` (beslut 0007): bara `publisher`, `board`, `superadmin` får läsa, ladda upp, ändra metadata (namn, fotograf, alt-text) och radera. Banläggare och medlemmar har ingen åtkomst. Filerna kan hämtas av alla med länken men inte listas. Tester: `tests/rules/imageBank.test.ts`, `tests/rules/storage.test.ts`.
- `protocols` (styrelsens protokoll, beslut 0009): bara `board` och `superadmin` får läsa, skapa, redigera och radera (`canViewProtocols` i `src/types/user.ts` speglar regeln). Publicerare, banläggare och medlemmar har ingen åtkomst, och bygget läser aldrig collectionen. Bara den utsedda sekreteraren respektive justeraren får godkänna sin del (servertid, inget annat fält ändras) och dra tillbaka sitt eget godkännande; när båda godkänt är protokollet låst och kan varken ändras eller raderas. Innehållsändringar nollställer båda godkännandena. Tester: `tests/rules/protocols.test.ts`.
- UI döljer funktioner men är aldrig själva skyddet. Regeltester mot emulatorn täcker delegeringen.


## UI för banläggare och infosidor

`canViewEvents` (`src/types/user.ts`) släpper in publicerare, styrelse, superadmin och banläggare på `/admin/events`. Banläggare ser editorn med alla fält utom banorna skrivskyddade (huvudbilden visas utan knappar) och sparar bara `courseFiles` (plus `published.courseFiles` på publicerade events). `/admin/sidor` och `/admin/sida` kräver `canPublish`, alltså inte banläggare. Detsamma gäller den kommande menyvyn.
