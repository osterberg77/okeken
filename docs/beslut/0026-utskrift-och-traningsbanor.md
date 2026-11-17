# 0026 – Utskrift, originalfil och enkla träningsbanor på kartsidan

**Kontext:** Medlemmar vill kunna ta med kartan ut: ladda ner originalfilen, skriva ut ett utsnitt i rätt skala och snabbt lägga en enkel träningsbana (start, kontroller, mål) utan att öppna OCAD eller Mapper.

**Beslut:**
- **Originalfilen** går att ladda ner för alla medlemmar (samma krets som ser kartan). Konverteringsjobbet sparar `sourcePath` i `maps/{mapId}.current`; Storage-regeln för `map_sources/` tillåter `get` för medlemmar. Nya uppladdningar får `Content-Disposition: attachment` med filnamnet.
- **Utskrift i webbläsaren**, ingen server. Sidan byggs av kartans egna tiles som `<img>` placerade i millimeter på en A4 (stående 190 × 276 mm, liggande 277 × 189 mm inom 10 mm marginal) och skrivs ut med `window.print()`. Zoomnivån väljs som den lägsta som ger minst ca 180 dpi, så att en sida kostar ca 100–150 rutor (ca 1 MB). Skalan räknas i Web Mercator med cos(latitud), vilket ger fel under 0,1 % över ett A4-utsnitt. Utskriften är norr-upp (kartan kan vara vriden några grader, se grivation i `kartor.md`). Användaren måste skriva ut i 100 %. Nedre vänstra hörnet: `public/kartbidrag-swish.png`; nedre högra: banlängd och skala.
- **Träningsbanor** läggs genom att klicka på kartan: första punkten är start, sista är mål, övriga kontroller i ordning. Banlängden är fågelvägen mellan punkterna. Symbolerna ritas i ISOM-storlek för vald skala, både på skärmen och i utskriften (`src/lib/course.ts`).
- **Banorna lagras per användare** i `users/{uid}/courses/{courseId}` (namn, kartId, punkter, skala). Bara ägaren läser och skriver, och bara medlemmar får skapa. Raderas med kontot.

**Konsekvenser:**
- Regler och tester: `tests/rules/courses.test.ts`, ändrat test i `tests/rules/maps.test.ts`.
- Versioner byggda före ändringen saknar `sourcePath`; klienten använder då `job.sourcePath` om jobbet byggde samma fil.
- Inga nya beroenden.
