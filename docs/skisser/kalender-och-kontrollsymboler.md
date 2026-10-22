# Kalender och kontrollsymboler – designspec (Förslag 3)

Källa: designarbetet i chatten "OK Eken hemsida redesign" (2026-10-18), slutversion i artifakten *Förslaget* (`project/Main.dc.html`, https://claude.ai/artifact/2scgGxEqozWRK4cRiMnNpV). Exakt referenskod ligger i `referens/startsida.dc.html` (Design Component-format; läs värden därifrån, kopiera inte formatet). Värdena nedan är de slutliga, efter många justeringar i procent. **Ändra dem inte utan att fråga Erik.**

Tolka detta som en visuell spec. Mockupen har aldrig setts renderad av den som skrev koden, så jämför alltid mot rendering.

## Princip: kalendern som orienteringsbana

Varje dag är en symbol från orienteringskartan, förbundna med korta streck så att raden ser ut som en bana.

| Dagens läge | Symbol |
|---|---|
| Vanlig dag | Enkel ring (kontroll) |
| Dag med aktivitet | Dubbelring (mål-symbol) |
| Idag | Triangel (startsymbol) |
| Idag med aktivitet | Triangel inuti dubbelring |

Allt delar färgen `#8A4B9E` (lila "kontrollfärg"). Alla dagceller ligger på samma vertikala nivå, oavsett innehåll.

## Dagcell (72 × 64 px symbolyta)

- Cell: bredd 72 px, ingen gap mellan celler (symbolerna ska nå varandra via strecken), `border-radius: 20px`, `padding: 8px 0 6px`, gap 2 px mellan veckodag och symbol.
- Cellbakgrund: vald dag `rgba(138,75,158,.12)`, helg (lör/sön) `rgba(43,40,56,.035)`, annars transparent.
- Veckodag: 11 px, vikt 600, versaler, `letter-spacing: .08em`, färg `#8A859C`.
- Symbol: SVG `viewBox="0 0 72 64"`, 72×64, `overflow: visible`, centrum (36, 32), alltid `fill="none"`.
- **Datumsiffran är ett vanligt HTML-lager ovanpå SVG:en, inte `<text>` i SVG** (renderade inte). Centrerad i 72×64, `padding-top: 1px`, DM Sans 700, 16 px, färg `#2B2838`.
- Streck (förbinder symbolerna): horisontella linjer på y = 32, `stroke="rgba(138,75,158,.62)"`, `stroke-width="2"`. De tar i symbolens kant.

### De fyra symbolerna (SVG-innehåll)

```html
<!-- Vanlig dag: enkel ring, ljusare (opacity 0.75 ovanpå .62-färgen) -->
<line x1="0"    y1="32" x2="12.9" y2="32" stroke="rgba(138,75,158,.62)" stroke-width="2"/>
<line x1="59.1" y1="32" x2="72"   y2="32" stroke="rgba(138,75,158,.62)" stroke-width="2"/>
<circle opacity="0.75" cx="36" cy="32" r="23.1" fill="none" stroke="rgba(138,75,158,.62)" stroke-width="2.6"/>

<!-- Aktivitetsdag: dubbelring, full färg. Yttre diameter = enkelringens (r 23.1) -->
<line x1="0"    y1="32" x2="12.9" y2="32" stroke="rgba(138,75,158,.62)" stroke-width="2"/>
<line x1="59.1" y1="32" x2="72"   y2="32" stroke="rgba(138,75,158,.62)" stroke-width="2"/>
<circle cx="36" cy="32" r="23.1" fill="none" stroke="#8A4B9E" stroke-width="2.6"/>
<circle cx="36" cy="32" r="16"   fill="none" stroke="#8A4B9E" stroke-width="2.6"/>

<!-- Idag: triangel, full färg, roterad 30° moturs (som startsymbolen på en karta) -->
<line x1="0"     y1="32" x2="21.2" y2="32" stroke="rgba(138,75,158,.62)" stroke-width="2"/>
<line x1="65.65" y1="32" x2="72"   y2="32" stroke="rgba(138,75,158,.62)" stroke-width="2"/>
<polygon transform="rotate(-30 36 32)" points="36,2.35 61.68,46.83 10.32,46.83"
         fill="none" stroke="#8A4B9E" stroke-width="2.6" stroke-linejoin="round"/>

<!-- Idag med aktivitet: dubbelring + (något mindre) triangel inuti -->
<line x1="0"    y1="32" x2="12.9" y2="32" stroke="rgba(138,75,158,.62)" stroke-width="2"/>
<line x1="59.1" y1="32" x2="72"   y2="32" stroke="rgba(138,75,158,.62)" stroke-width="2"/>
<circle cx="36" cy="32" r="23.1" fill="none" stroke="#8A4B9E" stroke-width="2.6"/>
<circle cx="36" cy="32" r="16"   fill="none" stroke="#8A4B9E" stroke-width="2.6"/>
<polygon transform="rotate(-30 36 32)" points="36,4.1 60.16,45.95 11.84,45.95"
         fill="none" stroke="#8A4B9E" stroke-width="2.6" stroke-linejoin="round"/>
```

Beslut som togs i justeringarna:
- Dubbelringens **yttre** diameter ska vara exakt samma som enkelringens (r 23.1). Inre ring r 16.
- Enkelringar tonas ned (75 %), dubbelringar och trianglar har **full** färg.
- Triangeln i dubbelring-varianten kan sticka ut en aning över yttre ringen (accepterat).
- Streckens längd anpassas så att de precis tar i symbolens kant (se x-värden ovan).

## Kalenderpanelen

- Fönster: **-5 till +10 dagar** runt idag (16 dagar). Pilknappar ‹ › flyttar en vecka. I riktiga sajten ska detta vara **oändlig horisontell scroll** med en liten knapp "idag" som scrollar hem.
- "Idag"-knapp: pillform, vit `rgba(255,255,255,.9)`, liten triangel-ikon (16 px, `rotate(-30)`, stroke `#8A4B9E` 2.2, points `10,1.5 17.4,14.3 2.6,14.3`) + texten *idag*, 13 px vikt 600.
- Filterchips: Alla / Träning / Tävling / Information (se avsteg nedan). Aktiv chip `#2B2838` med vit text, annars vit.
- Panel: `border-radius: 28px`, skugga `0 20px 50px -24px rgba(43,40,56,.25), 0 2px 6px rgba(43,40,56,.05)`.

### Avsteg godkända av Erik (2026-10-21, efter användartest)

1. **Listans ordning.** Rubrikerna utgår alltid från verkliga idag: *Kommande* = inte passerat, närmast först; *Tidigare* = passerat, senaste först. Valt datum styr var listan börjar. Väljer man en dag bakåt i tiden blir *Tidigare* huvudlista (överst, med "Visa fler") och börjar vid den dagen; *Kommande* visas under med tre rader. Väljer man idag eller framåt är det tvärtom. (Tidigare hamnade passerade events under "Kommande" i stigande ordning när man valde en dag bakåt.)
2. **Månadsväljare.** Månadsrubriken är en knapp med en liten nedpil (chevron 16 px, accentfärg, vänds uppåt när öppen). Den öppnar en vit ruta under rubriken (`border-radius: 22px`, panelskuggan, 272 px bred): år med ‹ › och 12 månader i 3 × 4. Månaden som visas är mörk pill (`#2B2838`, vit text), innevarande månad har lila ring, månader med aktiviteter (enligt valt filter) har en liten lila prick, övriga är dämpade (`#8A859C`). Val av månad: innevarande → idag, framtida → den 1:a, passerad → sista dagen, så att listan börjar i den månaden. Piltangenter flyttar fokus (upp/ned ett kvartal, PageUp/PageDown ett år), Escape och klick utanför stänger. Kartbakgrunden klipps nu i en egen ram så att rutan kan hänga ut under panelen.
3. **Filter för Information.** Filterraden: Alla / Träning / Tävling / Information, samma etikett som taggen. Möte och Händelse är sällsynta och syns bara under *Alla* (håller raden kort). På mobil ligger *idag*-knappen först i filterraden så att den alltid syns; filtren scrollas i sidled.
4. **Undermenyer i headern** (beslut 0008). En toppost med undersidor får en liten nedpil (chevron, accentfärg, vänds uppåt när öppen). Rubrik utan egen sida: hela pillen är en knapp som öppnar undermenyn. Post med egen sida: texten länkar till sidan och chevronen är en separat knapp ("Visa undermeny för …"). Undermenyn är ett vitt kort (`border-radius: 22px`, samma skugga som profilmenyn, 240–360 px brett) under posten; på mobil (< 640 px) ett kort i full menybredd under menyraden. Undersidorna 15 px, aktuell sida i accentfärg på pastellbakgrund `#F1E8F6`. Toppposten är markerad (vit pill) när den själv eller någon undersida är öppen. Bara en undermeny öppen åt gången; Escape och klick utanför stänger. Byggd med `<details>`, så den fungerar utan JavaScript; inget öppnas vid hover. Headern ligger nu över kalenderpanelen (z-index) och sidans ram klipper bara i sidled (`overflow-x: clip`) så att rullgardinerna inte klipps.

5. **Huvudbild i eventkortet** (Erik 2026-10-21: "Till event borde vi kunna välja en huvudbild som används för visning, länkning, SoMe osv."). Bilden från specen (300 px till höger, radie 20 px, marginal 14 px, `object-fit: cover`, min. 280 px hög) är nu eventets valfria huvudbild ur bildbanken. Tolkning för smalt kort: när kortet är smalare än 680 px (containerfråga på kortet, inte fönstret, eftersom kortet är smalare i kalenderns detaljvy) ligger bilden överst i kortet (Erik 2026-10-21) i full bredd med 14 px marginal och formatet 16:9, så att sidan inte hoppar när bilden laddas. Utan huvudbild visas ingen bild (ingen platshållare). Kalenderns aktivitetslista får ingen bild eller miniatyr. Samma bild används som `og:image` vid delning; saknas huvudbild delas klubbens logotyp (`public/og-default.png`, 1200×630).

6. **Mindre menyrubriker** (Erik 2026-10-21: "lite i största laget, kanske dra ner till halva storleken"). Menytexten i headern är 15 px på alla skärmbredder (specen hade 30 px på desktop). Pillernas utfyllnad (16 px i sidled, 8 px uppåt/neråt) och chevronen (16 px) är nedskalade i samma proportion, och menyraden är nedflyttad så att den ligger i höjd med logotyp och profilknapp.
7. **Relativ datummarkering i eventkortet** (Erik 2026-10-22). Bredvid datumet visas en liten lila pill: *Idag*, *Imorgon*, *Om n dagar*, *Pågående* för en flerdagsperiod som redan startat, och *Passerat* när eventet är förbi. Pillen räknas i webbläsaren, eftersom sidorna är förbyggda och "idag" från bygget vore fel dagen efter.

### Kartbakgrund i panelen

SVG som fyller panelen (`viewBox="0 0 1240 260"`, `preserveAspectRatio="xMidYMid slice"`), motiv: förenklad karta.

```html
<rect width="1240" height="260" fill="#FFFEF8"/>
<path d="M0 190 C150 160 260 230 420 200 S700 150 860 190 S1120 220 1240 180 L1240 260 L0 260z" fill="#DDEBD0" opacity=".55"/>   <!-- skogsmark -->
<ellipse cx="1080" cy="60" rx="90" ry="26" fill="#D6EAF2" opacity=".7"/>                                                     <!-- vatten -->
<g fill="none" stroke="#C9A77A" stroke-width="1" opacity=".5">                                                                 <!-- höjdkurvor -->
  <path d="M0 50 C200 20 340 90 520 55 S860 20 1240 70"/>
  <path d="M0 90 C180 60 330 130 520 95 S880 60 1240 110"/>
  <path d="M0 130 C200 100 360 170 540 135 S900 100 1240 150"/>
  <path d="M0 230 C200 205 360 250 560 225 S900 205 1240 240"/>
</g>
```

## Eventdetalj

- Kort: vit, `border-radius: 28px`; text till vänster, **bild till höger** (300 px bred, `border-radius: 20px`, marginal 14 px, `object-fit: cover`; hamnar överst på smal skärm). Bilden ska kunna väljas per event (bildbanken). Införd som huvudbild, se avsteg 5.
- Eventtyper (tagg: text/bakgrund): Träning `#3F6B3A`/`#E3F0DC`, Tävling `#6E3A82`/`#EFE3F5`, Möte, Information, Händelse `#6A5A12`/`#F6F0D2`. Tagg: pill, 12 px, vikt 600, `padding: 4px 12px`.
- Passerat event får en grå tagg "Avslutad" (`#ECE8F2` / `#5F5A72`) och visar resultatlista; knappar: "Jag var med – registrera tid", "Ladda ner bana". Tävling: "Se resultat i Eventor".
- **Aktiv period ("BANAN ÄR UTE")** för event med start och slut (t.ex. tisdag till söndag): en kedja med en symbol per dag, veckodag under (11 px versaler):
  - första dagen: triangel (CSS: `border-left/right: 11px transparent; border-bottom: 19px solid #8A4B9E; margin: 6px 0 4px`)
  - dagar emellan: liten ring 20 px, `border: 2.5px solid rgba(138,75,158,.5)`, `margin: 8px 0 6px`
  - sista dagen: dubbelring (26 px, `border: 3px solid #8A4B9E`, `box-shadow: 0 0 0 5px #F7F3FA, 0 0 0 8px #8A4B9E`, `margin: 4px 0`)
  - Bakgrund på rutan `#F7F3FA`, `border-radius: 20px`; text under: "Ute <dag> till <dag>. Karta och bana går att ladda ner."
- Banor A/C/D visas som chips (kod i accentfärg, namn, km).

## Header, färger, typografi

- **Logotyp** uppe till vänster, **138 px bred** (ca 3× tidigare), `drop-shadow(0 14px 18px rgba(43,40,56,.18))`, klickbar till startsidan, ingen text bredvid ("OK Eken Åtvidaberg" står i loggan).
- Meny och inloggning ligger högst upp, ca 15 % ner från loggans överkant (`margin-top: 23px`), `align-items: flex-start`. **Menytext 30 px**, `padding: 10px 24px`, aktiv flik vit pill. Meny: Kalender, Om oss, Bli medlem. Ingen rubrik/ingress ovanför kalendern; kalendern tar den platsen.
- Profil (inloggad): cirkel 56 px uppe i hörnet, `linear-gradient(135deg,#C9A7DA,#8A4B9E)`, initial, vit ring `0 0 0 3px #fff`, meny "Min profil".
- Färger: accent `#8A4B9E`, text `#2B2838`, dämpad text `#5F5A72` / `#8A859C`, bakgrund `#FBFAFD`, kortyta `#fff`, mörk footer `#2B2838`, sekundär pastell `#F1E8F6`. Dekorativa suddiga cirklar i lila (uppe till höger) och grönt (till vänster).
- Typsnitt: **DM Sans** (rubriker, siffror) och **Inter** (brödtext). Notera att äldre notis i `docs/underlag/designriktning.md` säger Plus Jakarta Sans; detta förslag har ersatt det.
- Tillgänglighet: veckodagsceller är riktiga `<button>` med `aria-label` ("tisdag 19 maj"), symbolerna `aria-hidden`.
