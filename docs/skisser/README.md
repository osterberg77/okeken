# Skisser

Lägg valda skisser/layouter här (PNG/SVG/PDF) och beskriv kort vad som gäller. Namnge `YYYY-MM-DD-namn.ext`.

## Detaljspec

- **[kalender-och-kontrollsymboler.md](kalender-och-kontrollsymboler.md)** – exakta mått, färger och SVG för kalendern, kontrollsymbolerna, kartbakgrunden, eventdetalj och header (Förslag 3, slutversion). Referenskod: `referens/startsida.dc.html`.
- [logo.md](logo.md) – logotypvarianter.

## Vald designriktning (sammanfattning)

- Startsida: tidslinje/kalender överst, aktivitetslista under (desktop: lista vänster, detalj höger)
- Kategorier med färg + ikon: Träning, Tävling, Möte, Information, Händelse
- Header: logotyp + meny. Footer: logotyp + kontaktinfo
- Profil: färger hämtade från logotypen (lila `#9C397B`/`#682652`, grön `#31A947`/`#21712F`, gul `#F9D932`, sandbakgrund `#F7F4EC`); Plus Jakarta Sans. Definieras i `src/styles/global.css`. (Designutkastets `#2E7D32`/`#7B1FA2` ersattes 2026-10-20 för att matcha logotypen.)
- Kategorifärger i `src/lib/categories.ts`. Eventets aktiva period visas med en orienteringskontroll (`ControlFlag`).

Fullständig riktning finns i projektdokumentet *okeken-designriktning*.
