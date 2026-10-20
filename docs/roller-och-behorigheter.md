# Roller och behörigheter

Behörigheter (funktioner) kopplas på vanliga konton – ett konto kan ha flera. Lagras i Firestore på `users/{uid}.permissions` och kontrolleras av säkerhetsreglerna (beslut 0005). Inga custom claims.

| Roll | Nyckel | Tänkt innehåll |
|---|---|---|
| gäst | – | Ej inloggad. Läsa publicerat innehåll |
| medlem | `member` | Inloggad. Inget eget innehåll i v1 (medlemsinnehåll krockar med statiska sidor) |
| banläggare | `course_setter` | Ladda upp/ersätta PDF-banor, (v1.1) mata in resultat |
| publicerare | `publisher` | Skapa/redigera/publicera events och sidor, (v1.1) bildbanken, dela till SoMe |
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
- UI döljer funktioner men är aldrig själva skyddet. Regeltester mot emulatorn täcker delegeringen.
