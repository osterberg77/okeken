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

## Plan

- **Nattlig synk räcker** (veckovis hade också gått, men natt ger färska anmälningsdatum). Ett anrop per natt, med `fromDate`=idag och `toDate`=ca 12 månader framåt, filtrerat på `organisationIds` (klubb/distrikt) och ev. `classificationIds`. Använd `fromModifyDate` för att bara uppdatera ändrade.
- Synksteget är första steget i det nattliga bygget (GitHub Actions cron): hämtar → upsertar i Firestore (`source: "eventor"`, `eventorId`) → bygger och deployar. Samma workflow kan köras manuellt via "Synka nu" (`workflow_dispatch`).
- Nyckeln lagras som GitHub Secret `EVENTOR_API_KEY`. **Aldrig i repot.**
- Urval: Eventor-tävlingar hamnar först som *föreslagna*; publicerare kryssar för vilka som visas i kalendern. Val sparas och skrivs inte över av nästa synk (bara Eventor-fälten uppdateras).
- Länk tillbaka till Eventor för anmälan.

## Att klargöra vid implementation

- OK Ekens organisations-ID och distriktets ID i Eventor.
- Vilka klassificeringar och vilken region som ska föreslås.
- Fältmappning Event → `events` (namn, datum, plats, arrangör, länk).
