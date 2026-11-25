# 0027 – Aktuellt på startsidan (fastnålad information)

**Kontext:** Gruppen har flera gånger frågat hur man publicerar information utan kalenderkoppling (klädbeställning, ungdomsträningar nästa år) och vill kunna "nåla fast" den (ärende 19–20, 2026-10-26 och 2026-11-25). En egen nyhetssida bedömdes som för mycket underhåll.

**Beslut:**
- Event av typen Information får bockrutan **Nåla fast på startsidan** (`pinned`, boolean, ingår i ögonblicksbilden; äldre events saknar fältet = av).
- Startsidan visar en ruta **Aktuellt** ovanför kalendern med fastnålad, publicerad Information som pågår idag (start ≤ idag ≤ slut), de som slutar först, högst tre. Bara rubrik och utdrag, länk till eventsidan. Start och slut styr alltså hur länge den visas; ingen ny visningsperiod eller prioritet.
- Urvalet görs i webbläsaren mot verkligt datum (som kalenderlistorna), så det stämmer även mellan byggen.
- Posten syns fortfarande i kalendern som vanlig Information.

**Konsekvenser:**
- Regler: `pinned` i `eventKeys()`, `validEventContent` och `eventSnapshot`. `validCoords` förenklad till `is number` för att hålla publicering med tre extra platser under taket på 1000 uttryck. Test i `tests/rules/events.test.ts`.
- Avsteg från designspecen (ny ruta ovanför kalendern), godkänt av Erik 2026-11-25.
- Inga nya beroenden eller collections.
