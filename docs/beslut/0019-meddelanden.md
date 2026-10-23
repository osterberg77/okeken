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
- **UI:** `/meddelanden` (`MessagesPage`), listan i profilmenyn, `NotifyToggle` (kuvert-ikon bredvid knappar som skapar notiser, se nedan).
- `CONSENT_VERSION` höjd 2026-10-23 och `/integritet` uppdaterad (nya avsnitt om "Dölj mig" och meddelanden).

**Konsekvenser:**
- Konversationen läses bara av deltagarna, också av styrelsen inte. Det står i policyn.
- Första meddelandet till någon kostar en nekad skrivning (klienten kan inte läsa en konversation som inte finns), sedan skapas den.
- Ingen e-post, ingen push: den som inte öppnar sajten ser inte badgen.

## Kuvertet: lägga till en notis var som helst
Fyra delar, så att en ny plats tar ett par rader:
1. **Tillstånd:** `const [notify, setNotify] = useState(true)` (på som standard där meddelandet är normalt, annars `false`). Hooken ligger före tidiga `return`.
2. **Knappen:** `<NotifyToggle enabled={notify} onChange={setNotify} summary="Anna får veta att …" />` bredvid knappen eller valet. Upplyst = skickas, nedtonad och överstruken = skickas inte; tooltipen visar `summary`. Visa den bara när något faktiskt skulle skickas (en mottagare finns och det inte är en själv).
3. **Utskicket:** efter att den egentliga åtgärden lyckats, `sendNotices(session.uid, { recipients, text, link })` ur `src/lib/firebase/messages.ts` (importeras dynamiskt). `recipients` rensas på en själv, tomma värden och dubbletter. Funktionen kastar aldrig, så en notis som inte går fram stoppar inte det den hör till.
4. **Text:** kort, på svenska, och en `link` till sidan som berörs (en adress på sajten). Återkommande texter hör hemma som en liten funktion i `src/lib/notify.ts` med test (se `permissionNotice`).

Avsändaren måste vara banläggare eller uppåt (reglerna tillåter `notice` bara då). Används idag på: behörighetsändring (`UserAdmin`, på), "Publicerat av" på events (`EventEditor`, på, skickas vid sparning om personen bytts), sista godkännandet av ett protokoll (`ProtocolEditor`, på, till omnämnda och ansvariga).
