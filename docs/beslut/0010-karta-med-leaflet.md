# 0010 – Riktig karta med Leaflet och OpenStreetMap

**Kontext:** Den ritade SVG-kartan (`RouteMap`) visade bara en rutt utan orter, och egna event krävde att koordinater klistrades in som text (beslutat 2026-10-22).

**Beslut:**
- **Leaflet 1.9** (ca 40 kB) med brickor från OpenStreetMap, laddat dynamiskt (`src/lib/leaflet-map.ts`) och bara där en karta ska visas. Attributionen "© OpenStreetMap" ska alltid synas.
- Den ritade SVG-kartan finns kvar i den förbyggda HTML:en och utan JS; när sidan hydreras byts den mot Leaflet. Därför hydreras `EventDetail` på `/event/[slug]` med `client:idle`.
- **Google Maps-länk** (`googleMapsUrl` i `src/lib/geo.ts`) byggs av koordinaterna och visas under kartan, för alla event med position, även Eventor. Fältet "Kartlänk" är borttaget ur admin; `location.mapUrl` finns kvar i datat (reglerna kräver fältet) och används bara som reservlänk på äldre event utan koordinater.
- **Platsväljare i admin** (`LocationPicker`): klicka/dra markör, eller sök ort via OSM:s Nominatim (endast vid knapptryck, max 5 träffar, Sverige). Resultatet skrivs som text i det befintliga koordinatfältet, så datamodell och regler är oförändrade.
- Mobil: en finger drar inte kartan (så att sidan går att skrolla), nyp för att zooma.
