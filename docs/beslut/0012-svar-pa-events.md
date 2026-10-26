# 0012 – Svar på events: Kommer / Kommer kanske / Kommer inte

**Kontext:** Medlemmar vill se hur många som kommer på träningar och möten (förslag i WhatsApp 2026-10-22). Erik: bara för inloggade, namn vid hovring för inloggade, och den som vill ska kunna dölja sitt namn men ändå räknas.

**Beslut:**
- **Data:** `rsvps/{slug}/responses/{uid}` med `{ status: 'yes'|'maybe'|'no', name, updatedAt }`. Dokument-id = uid, så ett svar per användare och ingen kan svara åt någon annan. `slug` är eventets stabila adress. Typer i `src/types/rsvp.ts`, dataskikt i `src/lib/firebase/rsvp.ts`.
- **Vem:** bara inloggade med minst en behörighet (medlem eller högre) får läsa och svara. Besökare och nyregistrerade konton utan behörighet ser ingenting. Reglerna avgör (`isMember()` i `firestore.rules`), regeltester i `tests/rules/rsvp.test.ts`.
- **Dolt namn följer profilen:** standard är att namnet visas. Valet "Visa inte mitt namn" ligger i profilen (`users.hidden` (hette tidigare `hideNameInRsvp`, beslut 0018), beslut 0013), inte i svarsrutan, och gäller alla svar. Cloud Function `onUserRsvpNameChanged` (`functions/src/rsvp-names.ts`) uppdaterar `name` på alla användarens svar när valet eller visningsnamnet ändras. `name` är användarens visningsnamn exakt som i `users` (reglerna kontrollerar det, så ingen kan skriva någon annans namn) eller `''` när namnet är dolt. Svaret räknas ändå. Andra medlemmar ser "n som inte visar sitt namn"; styrelse och superadmin ser vem det är genom uppslag av uid i `users` och märkning "(dolt)".
- **Klientsida:** komponenten `RsvpBox` laddar Firebase bara hos den som varit inloggad på enheten och renderar inget alls för besökare, så de statiska sidorna och bygget påverkas inte. Visas på egna events som inte passerat, aldrig för Eventor-tävlingar, utkast eller adminpreview. Svarsrutan är en rad med tre ikonknappar (👍 Kommer, 🤔 Kommer kanske, 👎 Kommer inte) med antal; namn vid hovring (`title`) och under "Visa vilka" (för mobil).
- Att trycka på sitt valda svar igen tar bort svaret. Användaren kan ta bort sitt eget; ingen annan kan radera.

**Konsekvenser / öppet:**
- Reglerna kontrollerar inte att eventet finns eller är publicerat (det kostar en läsning per svar); sluggen måste bara vara en giltig adress. Svar på borttagna events blir kvar. Rensning av gamla svar är ej byggd och bör ingå i GDPR-genomgången.
- Policyn på `/integritet` beskriver svaren; texten ska läsas igenom av styrelsen.
- Resultatlistan (visa/dölja namn och tid, räkna deltagare) är fortfarande ej byggd. Samma princip (tomt namn men räknas) kan återanvändas där, se `framtida-funktioner.md` punkt 12.

**Ändring 2026-10-26:** svarsrutan är ett val per event (`rsvpEnabled`, bockruta under Inställningar i editorn, förvalt av). Äldre events saknar fältet och har därmed ingen svarsruta tills en publicerare slår på den.
