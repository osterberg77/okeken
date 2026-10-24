# 0021 – Platsikoner och extra platser på eventkartan

**Kontext:** Träningar behöver kunna visa både start och parkering, och större event toaletter eller en andra parkering (önskemål från Erik 2026-10-24).

**Beslut:**
- Huvudplatsen (`location`) är den platsen vägvisningen går till. Den får en valfri ikon `location.icon`: `start` (lila triangel, standard och även för äldre event), `parking` (P), `toilet`, `finish`, `gathering`, `water`, `firstaid`, `other`. Ikonerna definieras en gång i `src/lib/place-icons.ts`.
- Extra markörer ligger i `location.places`: `{ icon, label, lat, lng }`. De ritas på kartan (Leaflet och den ritade SVG-kartan) men får ingen vägvisning.
- **Högst 3 extra platser.** Reglerna kan inte loopa utan listas upp, och 4 platser går över taket på 1000 uttryck när ett event publiceras (utkast och ögonblicksbild valideras båda). Behövs fler får taket höjas när reglerna förenklas.
- Båda fälten är valfria i reglerna, så äldre event utan dem fortsätter fungera. Ögonblicksbilden kopierar `location` som den är.
- Editorn: ikonväljare för huvudplatsen och `PlacesEditor` för extra platser (varje plats har egen kartväljare). Platser utan giltiga koordinater sparas inte.
