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
Arkiv över styrelseprotokoll, skrivna och godkända direkt på sajten (kompletterar punkt 6, som gäller uppladdade PDF:er).

**Så skulle det fungera**
- **Nytt protokoll från mall.** Inför ett möte skapar man ett nytt protokoll och väljer "Hämta mall från", med senaste protokollet som förval. Alla rubriker förs över (utan innehåll).
- **Att göra.** En sektion längst ner med punkter som olika personer ska göra till nästa möte (ansvarig + text).
- **Punkter från föregående protokoll.** När man skapar nästa protokoll frågar sajten om "Att göra" ska lyftas över som "Punkter från föregående protokoll" överst i det nya.
- **Sekreterare och justeringsman.** Man taggar vem som är sekreterare och justeringsman. De två godkänner protokollet i efterhand, och då **låses** det. Fram tills dess kan alla med styrelsebehörighet redigera.

**Teknik och säkerhet (utkast)**
- Protokoll är internt och får aldrig prerenderas eller hamna i publikt bygge (ADR 0004). De ligger i en egen Firestore-collection och visas bara i admin, klientsida bakom inloggning, med regler för rollen `board` i `firestore.rules` och regeltest mot emulatorn.
- Låsningen måste ligga i reglerna, inte bara i UI:t: efter godkännande nekas all ändring av dokumentet. Godkännande får bara göras av den som är utsedd till sekreterare respektive justeringsman, och redigering bara när status är utkast.
- Statusflöde: *utkast* → *godkänt av sekreterare* + *godkänt av justeringsman* → *låst*. Använd `StatusBadge` i alla vyer.
- Återanvänder Markdown-editorn och `src/lib/markdown.ts`. Rättelser efter låsning bör ske som ett nytt protokoll eller en tillagd anteckning, inte genom att låsa upp.
- Kostnad: medel.

**Frågor till styrelsen:** "Vilka rubriker har ni i ett vanligt protokoll? Ska 'Att göra' kunna bockas av? Ska gamla protokoll från Wix/Drive läggas in som PDF i arkivet? Vem får läsa arkivet: hela styrelsen eller alla medlemmar?"

## Hur vi använder listan
1. Erik väljer en fråga och postar den i WhatsApp-gruppen (börja med "🤖 AI-byggaren:" om Claude postar, se `CLAUDE.md`).
2. Svaren sammanfattas här under respektive rubrik (status: *Frågat*, *Beslutat ja*, *Beslutat nej*).
3. Beslutade funktioner flyttas in i `plan.md` med en egen version; större beslut får en ADR.
