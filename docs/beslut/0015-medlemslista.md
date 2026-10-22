# 0015 – Medlemslista för namnsökning

**Kontext:** Banläggare ska kunna söka medlemmar när de för in resultat, och publicerare ska kunna välja "publicerat av" (2026-10-22). `users` får bara läsas av ägaren, styrelsen och superadmin (beslut 0005) och innehåller e-post och behörigheter.

**Beslut:**
- `members/{uid}` är en avskalad kopia: `displayName`, valfri `photoUrl`/`avatarColor` och `publicName`. Ingen e-post, inga behörigheter.
- Bara den som har minst en behörighet (medlem eller högre) och ett namn finns i listan. Raderas kontot eller tas behörigheterna bort försvinner posten.
- Cloud Function `onUserMemberWritten` (`functions/src/members.ts`) skriver listan när `users/{uid}` ändras. Klienter kan inte skriva.
- Läsning: banläggare, publicerare, styrelse och superadmin.
- `publicName` är sant när personen godkänt policyn och inte valt att dölja sitt namn. Interna listor visar alla medlemmar; publika sidor ("publicerat av") visar bara namn och bild när `publicName` är sant.
- Befintliga användare fylls på en gång med `scripts/sync-members.mjs` efter första deploy.
