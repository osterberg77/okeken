# Eventor-koppling

Mål: spegla ett urval av tävlingar från Eventor i klubbens kalender. Livelox är parkerat (inga öppna API:er).

## API (verifierat mot Eventors guide och dokumentation)

- Bas-URL: `https://eventor.orientering.se/api/`
- Autentisering: klubbens API-nyckel (32 tecken) i HTTP-headern `ApiKey`. Genereras under Klubb > Klubbinställningar. Hålls hemlig; vid misstanke om läckage genereras en ny.
- Svar: XML (schema på `/api/schema`). Parsas med t.ex. `fast-xml-parser`.
- Tävlingslista: `GET /api/events` med parametrar:
  - `fromDate`, `toDate` (`yyyy-mm-dd hh:mm:ss`)
  - `fromModifyDate`, `toModifyDate` (bara ändrade tävlingar, bra för inkrementell synk)
  - `eventIds`, `organisationIds` (kommaseparerat; ett distrikts-ID inkluderar alla klubbar i det distriktet)
  - `classificationIds`: 1 mästerskap, 2 nationell, 3 distrikt, 4 lokal, 5 klubb
  - `includeEntryBreaks`, `includeAttributes`, `parentIds`
- Enskild tävling: `GET /api/event/{eventId}`.
- Svarselement: `EventList` / `Event`. Exakta fält läses ur `/api/schema` vid implementation.

## Regler att följa (ur guiden)

- Inget numeriskt rate limit anges, men "spara resurser": cacha, anropa inte onödigt. All trafik loggas och hög belastning från en nyckel kan leda till åtgärd.
- Informationsmodellen kan ändras utan förvarning, så parsning ska vara tolerant och fel ska inte fälla bygget.
- Ingen teknisk support från förbundet (Eventor-forumet finns).

## Så fungerar det (implementerat)

- **Spegel, inte events.** Tävlingarna ligger i `eventorEvents/{eventId}` (typ `EventorEvent` i `src/types/eventor.ts`) och blandas aldrig in bland klubbens egna events eller arkiv. Egna fält: `selected` (utkastvalet) och `live` (publicerat), med `…By`/`…At`.
- **Manuell hämtning.** Knappen "Hämta från Eventor" på `/admin/eventor` anropar Cloud Function `syncEventorNow` (publicerare, styrelse, superadmin). Funktionen äger API-nyckeln (Firebase-hemligheten `EVENTOR_API_KEY`, **inte** GitHub Secret, **aldrig** i repot) och kör `functions/src/eventor-sync.ts`: hämtar `/api/events` för regionens organisationer i `monthsAhead` månader, plus `/api/organisations` för arrangörsnamn. Ingen nattlig synk tills vidare.
- **Uppdatering.** Nya tävlingar läggs till, befintliga får nya Eventor-fält men behåller `selected`. Tävlingar som försvunnit hos Eventor tas bort, utom valda/publicerade som markeras `gone` (visas inte i kalendern, syns i listan). Passerade tävlingar rensas.
- **Urval.** `suggested` räknas vid hämtningen: egna klubbens tävlingar (`ownOrganisationId`) eller klassificering + disciplin enligt `settings/eventor` (standard: klassificering 1–3, disciplin 1, region 24 = Östergötland, OK Eken = 510, 12 månader). Alla tävlingar i regionen hämtas och kan väljas manuellt oavsett förslag. Reglerna ändras av styrelse/superadmin på samma sida.
- **Publicera.** Att kryssa i/ur sparar bara utkastet (`selected`) och startar inget bygge. Knappen "Publicera ändringar (n)" sätter `live = selected` för alla ändrade i en skrivning; först då startas ett bygge. Ändrade rader märks med "Opublicerade ändringar" (StatusBadge), som på övriga adminsidor.
- **Kalendern.** Bygget läser bara `live && !gone` (`src/lib/server/eventor-events.ts`) och kalendern visar dem som tävlingar märkta "Eventor ↗" som länkar direkt till tävlingen i Eventor. Ingen egen sida per tävling, ingen detaljvy, inga logotyper (Eventors API har inga). Cloud Function `onEventorEventWritten` startar bygget när det som besökare ser ändras.
- **Säkerhet.** Publicerare får bara skriva `selected*` (se `firestore.rules`, `tests/rules/eventor.test.ts`). Eventor-fälten skrivs bara av funktionen (Admin SDK).
- **Tider.** Eventor anger svensk lokal tid utan zon; omvandlas till UTC med sommartid. Klockan 00:00:00 betyder "hela dagen" (`allDay`).

## Driftsättning

1. `firebase functions:secrets:set EVENTOR_API_KEY --project okeken` (klistra in nyckeln när den frågar).
2. Deploya funktioner och regler (sker via deploy-workflowen vid push till main).

## Fält i Eventors svar (verifierat 2026-10-21)

`EventId`, `Name`, `EventClassificationId` (0–5), `EventStatusId` (3, 4, 5 förekommer, betydelse ej verifierad), `DisciplineId` (1 förekommer mest, 8 en gång), `StartDate`/`FinishDate` (`Date`+`Clock`), `Organiser/OrganisationId`, `WebURL`, `EventCenterPosition`, attributet `eventForm` (t.ex. `RelaySingleDay`). Anmälningslänk: `https://eventor.orientering.se/Events/Show/{EventId}`.

## Öppet

- Betydelsen av disciplin-ID utöver 1 och av `EventStatusId`, och om status ska påverka förslagen.
- Nattlig automatisk hämtning (om manuell blir för tungrodd).
