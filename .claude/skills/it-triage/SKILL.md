---
name: it-triage
description: Daglig koll på WhatsApp-gruppen "OK Eken - hemsidebygge". Kollar att bryggan lever, läser nya meddelanden, sorterar dem till ärenden, felsöker och fixar det som är tydligt, tar fram svarsförslag och uppdaterar ärendeloggen. Använd när Erik skriver /it-triage eller ber dig "kolla gruppen", "göra vanliga uppdateringen" eller "läsa av WhatsApp".
---

# /it-triage – vanlig uppdatering från byggkanalen

Gör hela rundan i huvudsessionen (ingen subagent, se CLAUDE.md). Svara Erik på svenska.
Argument efter `/it-triage` är fritext från Erik, t.ex. "bara läs" (hoppa över steg 4–6) eller "posta change-log".

Gruppen: **"OK Eken - hemsidebygge"**, JID `120363413962914017@g.us` (slå annars upp på namn med `list_chats`).
Loggen: `/Users/erikosterberg/.claude/projects/-Users-erikosterberg-progg-okeken/memory/whatsapp-feedback-log.md` (minnet `whatsapp-feedback-log`). Den håller "Senast läst", personer och ärendetabellen.

## 1. Kolla bryggan

1. Anropa `list_chats` och notera gruppens `last_message_time`.
2. Tomt `list_messages` bevisar **inte** att bryggan är synkad (ett meddelande missades en gång så). Jämför alltid: om `last_message_time` är nyare än det senaste `list_messages` returnerar, eller om `list_chats` felar, är bryggan nere eller efter.
3. Är den nere: starta `go run main.go` i `/Users/erikosterberg/progg/whatsapp-mcp/whatsapp-bridge` med `run_in_background`. Vänta tills `list_chats` svarar och tiden stämmer. Kräver bryggan QR-inloggning, stanna och be Erik skanna. Gissa inte.

## 2. Läs bara nytt

1. Läs loggfilen först. Hämta endast meddelanden **efter** "Senast läst" (`list_messages` med `after`, sortera på tid). Gå aldrig bakåt förbi den.
2. Ladda ner bilder/filer med `download_media` bara om de behövs för att förstå ärendet.
3. Tider visas i Europe/Stockholm.

## 3. Sortera

För varje nytt meddelande, avgör typ och koppla till avsändare (id → namn enligt loggens persontabell; "Me" = Erik):

- **Bugg/fel** – något funkar inte.
- **Fråga** – någon undrar hur eller var.
- **Förslag** – ny eller ändrad funktion.
- **Beröm/övrigt** – inget att göra, men notera.

Lägg varje sak som egen rad i ärendetabellen med löpnummer, avsändare och tid. Slå ihop med befintligt ärende om det är samma sak. Kolla också om ett nytt inlägg svarar på ett öppet ärende (t.ex. testaren bekräftar en fix).

## 4. Felsök och fixa (det som är tydligt)

- **Bugg**: reproducera eller hitta orsaken först (kod, `git log`, produktionsdata). Fråga "är det kod, data eller ej publicerat?" – ofta är innehåll bara ett utkast i produktion, vilket Erik måste publicera i /admin/sidor.
- **Fråga**: svara utifrån koden och `docs/`. Finns funktionen men är svår att hitta, föreslå förklarande text.
- **Liten, tydlig ändring**: gör den lokalt, följ konventionerna i CLAUDE.md, kör `npm run check` (och `npm run test:rules` om regler rörts), verifiera visuellt i webbläsaren för UI (mobil + desktop).
- **Förslag**: är det tveksamt (oklart behov, stor ändring, krockar med annat, bieffekter, mycket nätverkstrafik, se minnet `avoid-network-heavy-features`) – **bygg inte**. Ta fram konsekvenser och frågor till svaret i steg 5 och vänta på Eriks ja.
- Små, tydliga ändringar och buggfixar bygger du på eget ansvar. Större eller tveksamma förslag: ställ frågorna i gruppen och bygg först när det finns ett tydligt behov och Erik sagt ja. Rör inte designspecen i `docs/skisser/` utan att fråga.
- **UI-ändringar verifieras i webbläsaren innan deploy** (Chrome-tillägget, `npm run dev`, mobil + desktop). Är tillägget inte anslutet: håll kvar ändringen lokalt, deploya inte, och be Erik ansluta det (Chrome öppet, tillägget på, samma claude.ai-konto, ev. omstart av Chrome).
- **Commit och deploy av mindre saker får du göra själv** (byggfas, snabb respons går före). Stagea explicita filer (aldrig `git add -A`), engelskt commitmeddelande, kör `npm run check` först. Push till `main` triggar deploy (GitHub Actions, ca 1–2 min); kontrollera att körningen blev grön (`gh run list`/`gh run watch`) och verifiera i produktion innan du postar att det är live. Misslyckas bygget: rätta eller backa direkt, och posta inget.
- **Mindre** = en fix eller liten förbättring, ingen ny collection, ingen regeländring av betydelse, inga nya beroenden, inget som ändrar designspecen. Annat (större funktioner, regler/roller, migreringar) stäms av med Erik före deploy.
- **Fortfarande Eriks ok**: ändringar i produktions-Firestore (publicera sidor i admin, behörigheter, migreringar) och nya tunga beroenden. Säkerhetsregler hålls enkla (minnet `keep-security-rules-simple`).

## 5. Svara i gruppen

Claude ansvarar för bygget och kommunikationen runt det; Erik styr i bakgrunden. Du får därför **posta själv utan att fråga Erik först**: svar, frågor, förklaringar, uppföljningar, bekräftelser och change-log för sådant som är live. Erik får sedan en rapport (steg 7).

Fråga Erik **före** postning bara om meddelandet:
- lovar eller bestämmer något stort (ny funktion, tidplan, ändrad princip),
- gäller styrelsen, pengar, integritet/GDPR eller en enskild persons konto,
- är osäkert eller känsligt i tonen, eller sägs i Eriks namn.

När du postar:

1. Läs kanalen igen precis före `send_message` så inget nytt krockar, och väg in det.
2. Börja meddelandet med **"🤖 AI-byggaren:"**.
3. Svenska, kort, för klubbmedlemmar, inte tekniskt. Posta bara sådant som är **live**; sådant som bara är fixat lokalt kallas "kommer vid nästa uppdatering" eller utelämnas.
4. Vid tveksamma förslag: tagga personen, fråga om detaljerna, belys konsekvenserna, vänlig ton.
5. Ett samlat meddelande hellre än många små.

## 6. Uppdatera loggen

Efter varje körning, även när inget nytt fanns:

- Sätt "Senast läst" till tidsstämpeln för det senaste lästa meddelandet plus när du läste (behåll en kort rad om vad som hände; komprimera äldre rader).
- Uppdatera ärendetabellen: nya rader, ändrad status (Ny / Fixat lokalt / Live + commit / Väntar på svar / Avförd).
- Lägg nya personer i persontabellen om Erik berättat namn.
- Skriv inte in något i repot för loggen; den ligger i minnet utanför repot.

## 7. Rapportera till Erik

Avsluta med en kort sammanfattning:

1. **Bryggan**: ok / startad / problem.
2. **Nytt i gruppen**: en rad per ärende (vem, vad, typ).
3. **Gjort**: vad som felsökts/fixats och hur det verifierats.
3b. **Postat**: vad du skrev i gruppen (kort citat).
4. **Behöver ditt ja**: stora förslag att bestämma om, större deployer, publicering i admin/produktionsdata.
5. **Väntar på andra**: obesvarade frågor till gruppen.

Är inget nytt: säg det kort, med tidsstämpeln för senast lästa meddelande och att bryggan verifierats.
