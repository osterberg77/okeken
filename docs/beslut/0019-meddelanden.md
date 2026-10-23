# 0019 – Meddelanden mellan användare

**Kontext:** Klubben vill kunna skicka små notiser (godkänd som medlem, dags att betala avgiften) och låta användare skriva till varandra (2026-10-23). Ingen gruppchatt, bara text och emojis. Granskat av Opus mot koden. E-postnotiser är medvetet utanför och kommer senare.

**Beslut:**
- **Modell:** `conversations/{a_b}` med uid:na i ordning (`participants`, `lastMessageAt`, `lastSenderUid`, `lastText` ≤ 200, `readAt` per deltagare) och `messages` som subcollection (`senderUid`, `text` 1–1000, `kind` `text` | `notice`, valfri `link`, `createdAt`). Meddelanden kan inte ändras eller raderas av användare.
- **Avsändare:** alltid den inloggade (reglerna kräver `senderUid == auth.uid`). Automatiska meddelanden (`kind: notice`) skickas av den som gör ändringen, med etiketten "Automatiskt meddelande" och en valfri länk (en adress på sajten). Bara banläggare och uppåt får skriva `notice`. En systemavsändare via Function kommer först vid helautomatiska utskick (betalningspåminnelse).
- **Läst:** en läsmarkering per konversation och person (inte per meddelande). Oläst = den andra skrev sist, efter min `readAt`. Badge: en lyssnare på mina konversationer, röd siffra på profilbilden och i menyn.
- **Vem får skriva:** en medlem (minst en behörighet) startar en konversation mot en användare som inte är dold. Banläggare och uppåt når även dolda. Den som redan är deltagare får svara även utan behörighet (så att den som fått ett meddelande kan svara).
- **Sekretess (beslut 0018):** `members` läses av vanliga medlemmar bara för `hidden == false` (listfrågan kräver `where('hidden','==',false)`), sig själva och den de har en konversation med. En dold person kan själv skriva till andra, och visar då sitt namn för mottagaren. Styrelsen kan inte läsa andras konversationer.
- **Radering:** `deleteAccountData` raderar personens konversationer med alla meddelanden.
- **Skjutet upp:** blockera/tysta, rate limit, rensning av gamla lästa konversationer, systemavsändare, e-post. Styrelsen hanterar missbruk manuellt i en så liten klubb.
- **UI:** `/meddelanden` (`MessagesPage`), listan i profilmenyn, `NotifyToggle` (kuvert-ikon bredvid knappar som skapar notiser) byggs i nästa steg.
- `CONSENT_VERSION` höjd 2026-10-23 och `/integritet` uppdaterad (nya avsnitt om "Dölj mig" och meddelanden).

**Konsekvenser:**
- Konversationen läses bara av deltagarna, också av styrelsen inte. Det står i policyn.
- Första meddelandet till någon kostar en nekad skrivning (klienten kan inte läsa en konversation som inte finns), sedan skapas den.
- Ingen e-post, ingen push: den som inte öppnar sajten ser inte badgen.
