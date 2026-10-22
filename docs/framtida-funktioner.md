# Förslag framåt – funktioner att fråga klubben om

Det här är idéer **utöver** v1, v1.1 och v1.2 i `plan.md`. Inget här är beslutat. Tanken är att Erik ställer en fråga i taget i WhatsApp-gruppen "OK Eken - hemsidebygge" och att svaren (och beslut) förs in här eller i en ADR i `docs/beslut/`.

Redan bestämt och därför *inte* med här: resultat, Eventor-synk, schemalagd publicering, bildbank + enkel editor (v1.1) och SoMe-bilder från mallar (v1.2). Bildbank och editor prioriteras eftersom mycket redan finns i Coworken.

Kostnadsskala: **liten** (några timmar), **medel** (några dagar), **stor** (veckor eller löpande ansvar).

## 1. Utskick och nyhetsbrev

**Läge idag:** klubben kör Mailchimp, med mallar.

**Alternativ**
- **A. Behåll Mailchimp (förslag).** Sajten får en prenumerationsruta som skickar till Mailchimp, och ev. knappen "Skapa nyhetsbrev från event" som genererar färdig HTML att klistra in. Kostnad: liten.
- **B. Bygga eget.** Kräver: mailleverantör (Firebase skickar inte vanlig mail; t.ex. Amazon SES eller Resend), avsändarverifiering (SPF/DKIM/DMARC) så att brevet inte hamnar i skräpposten, lista med samtycke och avregistreringslänk (GDPR), hantering av studsade adresser, mallredigerare. Kostnad: stor, och klubben får ansvar för listan.

**Fråga till gruppen:** "Är ni nöjda med Mailchimp, eller är det något som skaver (kostnad, krångligt, mallarna)? Om det funkar bra låter vi det vara och bara lägger en prenumerationsruta på nya sajten."

## 2. Kalenderprenumeration (iCal)
Medlemmar prenumererar på klubbens kalender i sin mobil (Google/Apple Calendar) och får nya träningar automatiskt. Genereras statiskt vid bygget från publicerade events. Kostnad: liten.

**Fråga:** "Skulle ni vilja kunna lägga in klubbens träningar och tävlingar i er egen mobilkalender så att de uppdateras av sig själva?"

## 3. Nyheter/blogg
Gamla sajten hade nyheter och blogg (se `redirects.json`). Kan göras som en sidtyp med datum, visas som lista på startsidan eller egen sida. Delar editor och bildbank med övriga sidor. Kostnad: liten–medel.

**Fråga:** "Behöver vi en nyhetsflik, eller räcker det att skriva allt som events i kalendern (typ Information)? Vem skulle skriva nyheter?"

## 4. Anmälan och närvaro på träningar
Besökare eller medlemmar anger att de kommer (namn räcker, ingen inloggning). Hjälper träningsansvarig att planera banor och kartor. Finns som idé i datamodellen (`attendance`). Kostnad: medel. Kräver en regel för namn utan konto (missbruk/skräp) och en rutin för att radera gamla listor (GDPR).

**Fråga:** "Skulle ni använda en 'Jag kommer'-knapp på tisdagsträningen, eller är det bra som det är?"

## 5. Ansvarsschema (träningsansvariga, banläggare, funktionärer)
Vem har ansvar vilken vecka, synligt i kalendern och med påminnelse. Gamla sajten har en sida med stöd för träningsansvarig. Kostnad: medel.

**Fråga:** "Hur planerar ni idag vem som är träningsansvarig och banläggare (kalkylblad, WhatsApp)? Vore det bra att det syntes i kalendern?"

## 6. Dokumentarkiv
Eken-Nytt, protokoll, årsmötesunderlag, stadgar som sökbara PDF:er. Kan ligga i Storage med samma behörighetsmodell som banor, med publika och bara-medlemmar-mappar. Kostnad: liten–medel. Fråga om vad som ska vara publikt. Se även punkt 11 för styrelsens protokoll.

**Fråga:** "Vilka dokument vill ni ska finnas på sajten, och vilka ska bara medlemmar kunna se?"

## 7. Fotogalleri från tävlingar och läger
Bygger på bildbanken (v1.1). Kräver tydlig policy för bilder på barn (se GDPR i `plan.md`). Kostnad: medel.

**Fråga:** "Vill ni ha bilder från tävlingar och läger på sajten? Hur gör vi med bilder på barn?"

## 8. Bli medlem och medlemsregister
Förslag i planen: länka till Idrottonline i stället för eget formulär (personnummer kräver särskild hänsyn). Ingen egen funktion.

**Fråga:** "Hur går en ny medlem med idag, och vem hanterar det i Idrottonline?"

## 9. Sponsorer och samarbetspartners
Logotyper och länkar i sidfoten eller på egen sida. Kostnad: liten.

**Fråga:** "Har klubben sponsorer eller samarbetspartners som ska synas?"

## 10. Medlemsområde
Innehåll som bara inloggade medlemmar ser (t.ex. kontaktlistor, interna dokument). Allt statiskt prerenderas och är publikt per definition (ADR 0004), så detta kräver en annan teknik och blir därför en större förändring. Rekommendation: undvik, lägg känsligt material utanför sajten.

## 11. Styrelsens protokollarkiv
**Status: byggs (2026-10-21), se ADR 0009.** Datamodell, regler och tester är klara; justerare väljs per protokoll (inte alltid ordföranden); deltagarlistan är bara närvarande; personer kan omnämnas i texten (`@[Namn](mention:uid)`); tak 10 närvarande och 8 att göra-punkter (reglernas uttrycksgräns). Medlemsläsning tas eventuellt senare (ny ADR). Texten nedan är underlaget från beslutet; vid avvikelse gäller ADR 0009.

**Beslutat ja (2026-10-21).** Arkiv över styrelseprotokoll, skrivna och godkända direkt på sajten (kompletterar punkt 6, som gäller uppladdade PDF:er).

**Beslut från Erik**
- Protokoll skrivs i samma Markdown-editor med WYSIWYG som övriga sidredigerare (`src/lib/markdown.ts`, ingen egen editor).
- Gamla protokoll laddas **inte** upp. Första protokollet är exemplet från 2026-10-20 (se nedan).
- Bara styrelsen (`board`) ser protokollen. Det räcker till att börja med.
- **Deltagarlista** med taggar mot riktiga konton, så det står noterat vilka som var på plats.

**Så skulle det fungera**
- **Nytt protokoll från mall.** Inför ett möte skapar man ett nytt protokoll och väljer "Hämta mall från", med senaste protokollet som förval. Alla rubriker förs över (utan innehåll).
- **Deltagare.** Kallade väljs bland riktiga konton (förval: alla med `board`). Per person markeras närvarande eller frånvarande. I exemplet visas frånvarande som överstruket.
- **Att göra.** En checkbox-lista där varje punkt kan vara avbockad eller inte. Punkten har text och ansvarig (kontotagg). Ansvariga i exemplet står i löptexten ("Andreas tar ansvar för planering"). Avbockning går att ändra så länge protokollet är utkast.
- **Senare utbyggnad (inte nu):** Att göra som riktiga uppgifter där personer taggas och punkterna kopplas till en todo-lista per användare. Håll datamodellen öppen för det: varje punkt får eget id, ansvarig som uid och status, så att den kan lyftas ur protokollet utan omarbetning.
- **Punkter från föregående protokoll.** Vid nytt protokoll frågar sajten om "Att göra" ska lyftas över överst. Förslag: bara de som inte är avbockade förs över, så att det blir tydligt vad som återstår.
- **Sekreterare och justeringsman.** Taggas som konton. De godkänner i efterhand och då **låses** protokollet. Fram tills dess kan alla med styrelsebehörighet redigera.
- **Metadata:** mötesdatum, plats, nästa möte (datum, tid, plats/digitalt), distribution.

**Exempel: OK Ekens styrelseprotokoll 2026-10-20**
- Dagordning (mallens rubriker): 1 Mötets öppnande, 2 Val av mötessekreterare, 3 Godkännande av dagordning, 4 Föregående protokoll, 5 Föreningsrepresentation, 6 Ekonomi (vartannat möte), 7 Inkomna skrivelser och information, 8 Ledskötsel, 9 Kartor, 10 Träningar, 11 OK Ekens Arrangemang (a Tävlingar, b Nybörjare), 12 Externa tävlingar, 13 Information till okeken.se, Facebook, Mejl, 14 Övriga frågor, 15 Nästa möte, 16 Mötets avslutande.
- Rubriknumrering och ordning ska följa mallen. I exemplet skiljer sig ordningen på punkt 5–7 mellan dagordning och protokoll (Inkomna skrivelser och Föreningsrepresentation har bytt plats, Ekonomi ligger före Ledskötsel); mallen ska ha en enda ordning.
- Underskriftsfält: "Vid protokollet" (sekreterare) och "Justeras" (ordförande), med datum.
- Fotrad: "DISTRIBUTION: Mejl till styrelsen; original finns även tillgängligt på Onedrive under Styrelsemöten". Med arkivet på sajten behöver texten ses över.
- PDF-filen med exemplet ligger utanför repot (se "minimal commits"); lägg den som seed-protokoll vid implementation, inte som fil i repot.

**Teknik och säkerhet (utkast)**
- Protokoll är internt och får aldrig prerenderas eller hamna i publikt bygge (ADR 0004). De ligger i en egen Firestore-collection och visas bara i admin, klientsida bakom inloggning, med regler för rollen `board` i `firestore.rules` och regeltest mot emulatorn.
- Låsningen måste ligga i reglerna, inte bara i UI:t: efter godkännande nekas all ändring av dokumentet. Godkännande får bara göras av den som är utsedd till sekreterare respektive justeringsman, och redigering bara när status är utkast.
- Deltagare och ansvariga lagras som användar-id (uid), inte som fritext, och visas med namn från användarprofilen. Regeln ska kräva att taggade uid finns.
- Statusflöde: *utkast* → *godkänt av sekreterare* + *godkänt av justeringsman* → *låst*. Använd `StatusBadge` i alla vyer.
- Rättelser efter låsning bör ske som ett nytt protokoll eller en tillagd anteckning, inte genom att låsa upp.
- Kostnad: medel.

**Öppna frågor kvar:** Ska ordföranden (justeraren) alltid vara den som justerar, eller kan man välja? Ska medlemmar senare kunna läsa arkivet (ändrar behörighetsmodellen, ny ADR)?

## 12. Kommer/Kommer kanske/Kommer inte och integritetsval (Eriks riktning 2026-10-22)

Föranlett av önskemål i gruppen om en "vill delta"-knapp. **Svar på events är byggt 2026-10-22 (beslut 0012).** Resultatlistan med namnval är inte byggd.

**Svar på events och möten**
- Tre val: *Kommer*, *Kommer kanske*, *Kommer inte*. Bara för inloggade användare, aldrig publikt (sidorna är statiska, så svaren läses och skrivs klientside bakom inloggning).
- Antal syns bredvid knappen i event/möteskortet för inloggade. Namnen visas vid hovring, bara för inloggade.
- Kräver ny collection, regler i `firestore.rules` och regeltest (kärnprincipen om säkerhet i reglerna).

**Resultatlista och samtycke (GDPR)**
- Opt-in/opt-out för att visa namn, med tre nivåer: *visa för inloggade*, *visa publikt*, *aldrig*.
- Man ska också kunna dölja sin tid och bara stå som "deltagit".
- Deltagandet ska kunna räknas även när namnet är dolt. Den som inte vill synas får ändå tillåta registrering, så att till exempel bara styrelsen ser vem det är.
- Frågan om godkännande av användaruppgifter tas upp vartefter, se GDPR i `plan.md`.

**Namngivning:** fältet `courseSetter` visas som "Ansvarig" för möten och information, "Banläggare" för övriga (UI-etikett, rollnyckeln är oförändrad).

## Hur vi använder listan
1. Erik väljer en fråga och postar den i WhatsApp-gruppen (börja med "🤖 AI-byggaren:" om Claude postar, se `CLAUDE.md`).
2. Svaren sammanfattas här under respektive rubrik (status: *Frågat*, *Beslutat ja*, *Beslutat nej*).
3. Beslutade funktioner flyttas in i `plan.md` med en egen version; större beslut får en ADR.
