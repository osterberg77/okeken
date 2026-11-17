# 0026 – Utskrift, originalfil och enkla träningsbanor på kartsidan

**Kontext:** Medlemmar vill kunna ta med kartan ut: ladda ner originalfilen, skriva ut ett utsnitt i rätt skala och snabbt lägga en enkel träningsbana (start, kontroller, mål) utan att öppna OCAD eller Mapper.

**Beslut:**
- **Originalfilen** går att ladda ner för alla medlemmar (samma krets som ser kartan). Konverteringsjobbet sparar `sourcePath` i `maps/{mapId}.current`; Storage-regeln för `map_sources/` tillåter `get` för medlemmar. Nya uppladdningar får `Content-Disposition: attachment` med filnamnet.
- **Utskrift i webbläsaren**, ingen server. Sidan byggs av kartans egna tiles som `<img>` placerade i millimeter för hela A4-arket och centreras på sidans utskrivbara yta (fast positionerad, beskuren), så att kartan går ut till skrivarens marginal även i webbläsare som inte följer `@page`-marginalen (t.ex. Safari). Ramen på skärmen visar det som säkert kommer med inom 5 mm marginal (stående 200 × 287 mm, liggande 287 × 200 mm). Skrivs ut med `window.print()`. Zoomnivån väljs som den lägsta som ger minst ca 180 dpi, så att en sida kostar ca 100–150 rutor (ca 1 MB). Skalan räknas i Web Mercator med cos(latitud), vilket ger fel under 0,1 % över ett A4-utsnitt. Utskriften är norr-upp (kartan kan vara vriden några grader, se grivation i `kartor.md`). Skalan är 1:7 500 som standard (klubbens vanliga skala) och kan ändras; kartans egen skala finns alltid med i listan. Användaren måste skriva ut i 100 %. Nedre vänstra hörnet: `public/kartbidrag-swish.png`; nedre högra: banlängd och skala.
- **Träningsbanor** läggs genom att klicka på kartan: första punkten är start, sista är mål, övriga kontroller i ordning. Klick på ett streck lägger in en kontroll mellan dess punkter. Punkter dras för att flyttas och klickas för att tas bort; Ångra backar senaste ändringen (tillägg, flytt eller borttagning). Banlängden är fågelvägen mellan punkterna. Symbolerna ritas i ISOM-storlek för vald skala, både på skärmen och i utskriften (`src/lib/course.ts`).
- **Banorna lagras per användare** i `users/{uid}/courses/{courseId}` (namn, kartId, punkter, skala). Bara ägaren läser och skriver, och bara medlemmar får skapa. Raderas med kontot.

**Konsekvenser:**
- Regler och tester: `tests/rules/courses.test.ts`, ändrat test i `tests/rules/maps.test.ts`.
- Versioner byggda före ändringen saknar `sourcePath`; klienten använder då `job.sourcePath` om jobbet byggde samma fil.
- Inga nya beroenden.

**Tillägg 2026-11-17: import från IOF XML.** I banpanelen kan man importera en bana från IOF XML 3.0 (t.ex. Purple Pen, Arkiv > Exportera). Tolken (`src/lib/iof-xml.ts`) läser kontrollernas `Position lat/lng` i banans ordning och kräver alltså koordinater i filen, vilket Purple Pen bara skriver om kartan där har georeferens. Saknas de visas ett förklarande fel; `MapPosition` (mm på papperet) används inte eftersom kartans georeferens inte lagras. Importen fyller bara i editorn (kan ändras och sparas som vanligt), max 50 punkter, varning om banan ligger utanför vald karta. GPS-läget "Visa min position" finns redan för att hitta kontrollerna i skogen.
