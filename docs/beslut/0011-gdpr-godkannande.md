# 0011 – Integritetspolicy och godkännande vid inloggning

**Kontext:** Sidan sparar namn, e-post och behörigheter för användare, och fler funktioner som rör personuppgifter är på väg (resultat, Kommer/Kommer inte, bilder). Erik bad om en grundplatta med information och ett kort godkännande (2026-10-22).

**Beslut:**
- **Policysida:** `/integritet`, en statisk Astro-sida med handskriven text, länkad i sidfoten, kontomenyn och i kontoformuläret. Den följer `CONSENT_VERSION` (`src/lib/consent.ts`, ett datum).
- **Godkännande lagras på användaren:** `users/{uid}.consent = { version, acceptedAt }`. Reglerna släpper bara igenom användaren själv, `acceptedAt == request.time` och exakt dessa nycklar; ingen annan (inte heller styrelse eller superadmin) kan godkänna åt någon, och fältet kan inte sättas när kontot skapas. Styrelse och superadmin kan läsa det i användarlistan. Regeltester i `tests/rules/firestore.test.ts`.
- **Fråga vid inloggning:** `AccountMenu` visar `ConsentDialog` så snart sessionen saknar godkännande av aktuell version. "Fråga mig senare" gäller bara webbläsarsessionen (`sessionStorage`) och nollställs vid utloggning, så den som inte godkänt får frågan igen nästa gång. Menyn visar "Godkänn integritetspolicyn" tills det är gjort.
- **Ny version:** höjs `CONSENT_VERSION` får alla frågan igen.
- **Ingen funktion spärras** av uteblivet godkännande. Behörigheter styrs separat av styrelsen.

**Konsekvenser / öppet:** Policytexten är en grundplatta och behöver styrelsens genomläsning (personuppgiftsansvarig, rättslig grund, lagringstid, radering, som idag görs manuellt eftersom reglerna nekar delete på `users`). Konton som aldrig godkänner är fortfarande kvar. Separata val för namn i resultat och anmälningar (synlighet inloggad/publik/aldrig) kommer som egen ADR, se `framtida-funktioner.md` punkt 12.
