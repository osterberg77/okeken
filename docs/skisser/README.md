# Skisser

Lägg valda skisser/layouter här (PNG/SVG/PDF) och beskriv kort vad som gäller. Namnge `YYYY-MM-DD-namn.ext`.

## Detaljspec

- **[kalender-och-kontrollsymboler.md](kalender-och-kontrollsymboler.md)** – exakta mått, färger och SVG för kalendern, kontrollsymbolerna, kartbakgrunden, eventdetalj och header (Förslag 3, slutversion). Referenskod: `referens/startsida.dc.html`.
- [logo.md](logo.md) – logotypvarianter.

## Vald designriktning (sammanfattning)

- Startsida: tidslinje/kalender överst, aktivitetslista under (desktop: lista vänster, detalj höger)
- Kategorier med färg + ikon: Träning, Tävling, Möte, Information, Händelse
- Header: logotyp + meny. Footer: logotyp + kontaktinfo
- **Gällande spec för kalender, symboler, header, färger och typsnitt: [kalender-och-kontrollsymboler.md](kalender-och-kontrollsymboler.md)** (DM Sans + Inter, accent `#8A4B9E`). Implementerad i `src/styles/global.css`, `src/components/DaySymbol.tsx`, `Calendar.tsx`, `EventDetail.tsx`.

Fullständig riktning finns i projektdokumentet *okeken-designriktning*.
