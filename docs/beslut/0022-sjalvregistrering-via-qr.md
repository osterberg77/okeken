# 0022 – Självregistrering på träningar via QR-kod

**Kontext:** Man vill kunna registrera att man sprungit även när ingen från klubben är på plats: en skylt vid starten med en QR-kod, en fast adress, frivillig tid och synlighet, betyg på banan och en frivillig Swish-slant till kartor (Erik 2026-10-24). Klubben vill också att nätverkstrafiken hålls nere.

**Beslut:**
- **Fast adress `/ute`** (`src/pages/ute.astro`, komponenten `SelfRegister`). Sidan är statisk: eventlistan (egna träningar) kommer från bygget, så sidan kostar inga läsningar. Bara aktiva träningar listas. Förvalt event är den senast startade; en rullista byter. Skylten med QR-koden görs för hand.
- **Alla anrop går genom Cloud Function `registerSelfResult`** (`functions/src/self-result.ts`), öppen för alla, som skriver i `events/{id}/results` med Admin SDK. Reglerna för klientskrivning är oförändrade: klienter skriver aldrig dit själva, och det krävs ingen anonym inloggning (som hade gett obehöriga ett `request.auth`).
- **Medlem** (inloggad, minst en behörighet): raden får dokument-id = uid, namnet kommer från kontot och `memberUid` sätts. Registrerar man sig igen skrivs den egna raden över. **Gäst:** ny rad med fritt namn, `source: 'guest'`.
- **Skydd mot skräp (gäster):** dolt lockbetesfält, tak på 150 gästrader per träning, bara träningar som är publicerade och har `resultsEnabled`, bara från och med startdagen till och med slutdagen (svensk tid, klockslagen räknas inte). Listan blir ändå aldrig publik utan att banläggaren publicerar. Vill vi skärpa mer är nästa steg App Check.
- **Banor och förval:** banorna på eventet (PDF-banornas namn) visas som knappar; skrivs en tid in blir "Visa tid" förvalt tills man väljer själv. Sidan visar bara träningar som är öppna (från och med startdagen till och med slutdagen, samma regel som i Function:en) och annars en text om nästa träning.
- **Fält:** bana (fritext), valfri tid (mm:ss → `totalSeconds`), visa tid / bara deltagit / dölj, betyg 1–5 (`rating`) och `source` (`staff` | `member` | `guest`). Visa tid utan tid blir "bara deltagit". `youth` är alltid falskt; banläggaren sätter den. Raderna syns i `/admin/resultat` med märkning "Gäst (QR)" och betyg; betygssnittet visas överst. Betyget publiceras aldrig (`publicEntries` plockar fält ett och ett).
- **Regler:** `rating` och `source` är valfria nycklar i `results` (`resultAllowedKeys`), så personalen kan rätta självregistrerade rader. Regeltest i `tests/rules/results.test.ts`.
- **Swish:** efter registreringen hämtas Swish-numret ur årets avgiftstabell (en läsning, först då) och en `swish://`-länk utan belopp visas (`swishOpenLink`); löparen väljer summan själv.
- **Trafik:** sidan gör inga läsningar och ingen kartladdning; en registrering är ett funktionsanrop (och en läsning av eget konto för medlemmar). Inga lyssnare eller polling.

**Att veta:**
- Kräver att funktionen och reglerna deployas, och att policytexten (`/integritet`) kompletteras med att gäster kan registrera sig med namn.
- Gäster kan inte ändra sin rad själva; banläggaren rättar.
