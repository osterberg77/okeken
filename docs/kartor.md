# Orienteringskartor som kartlager (tiles)

Status 2026-11-16: **pipelinen och georeferensen är verifierade** på Kartbas Botorp 25 och Kartbas Åtvid 25. Uppladdning i admin, konverteringsjobb (Cloud Run Job, provat i Docker mot emulatorerna), regler med tester och kartsidan `/kartor` är byggda. **Inte deployat** (jobbet kräver engångsuppsättning, se `tools/map-converter/README.md`) och kartsidan är inte sedd i webbläsare med riktig medlemsdata. Beslut: 0025.

## Pipeline (`scripts/map-tiles.mjs`)

```
PANMAP=<panmap>/dist/cli/main.js node scripts/map-tiles.mjs "Kartbas Botorp 25.omap" ut/botorp [--dpi 600] [--zoom 12-17] [--colors 128] [--keep]
```

1. `.ocd` konverteras först till `.omap` med panmap (`convert`). Det är oprovat på riktiga .ocd-filer.
2. Georeferensen läses ur `.omap` (skala, ref_point, grivation, `auxiliary_scale_factor`). Rutnätets skalfaktor räknas med `proj -S`.
3. `panmap export --white-background` ger SVG. viewBox är i papperskoordinater med enheten 0,01 mm och y nedåt (= omap-µm / 10).
4. `rsvg-convert` ger en PNG. Standard är 600 dpi, där 1 px = 0,635 m vid 1:15 000, vilket ungefär motsvarar zoomnivå 17.
5. En world file (`.pgw`) med full affin transform (skala, rotation, translation) enligt Mappers `Georeferencing::updateTransformation`:
   `P = ref + R(−grivation) · diag(s, −s) · (m − map_ref)`, där `s = rutnätsfaktor × auxiliary × skala / 10⁶` (meter per µm).
6. `gdal_translate` ger en GeoTIFF (COG, EPSG:3006), som sparas för senare PDF-utsnitt. `gdalwarp -r lanczos` projicerar om till EPSG:3857 i exakt z17-upplösning, linjerat mot tile-rutnätet (`-tap`). `gdal2tiles --xyz` gör sedan tiles under `tiles/{z}/{x}/{y}.png`, plus `map.json` med bounds och zoomnivåer. Utan den uttryckliga warpen vrider gdal2tiles rätt och projicerar om med närmaste-pixel-sampling, och då blir sneda kanter trappstegade, tydligast på roterade kartor (upptäckt 2026-11-16 på Halleholm, grivation 5,3°).

7. `pngquant` med 128 färger: ca en tredjedel av full PNG utan synlig skillnad (64 färger gjorde gröna streck blågröna).

Verktyg: Node ≥ 18, `rsvg-convert` (`brew install librsvg`), GDAL med `gdal2tiles.py` och `proj`, `pngquant`. I drift körs allt i imagen `tools/map-converter/`.

## Verifierat

- **Kartbas-kartorna ligger i rutnätet.** Grivation saknas (= 0). `auxiliary_scale_factor` 1,000367 tar ut rutnätsfaktorn 0,999633 vid E 552 000, så den effektiva skalan är exakt 1:15 000 (0,15 m per SVG-enhet). Nordlinjerna lutar ca 6° österut, alltså magnetisk nord, inte en roterad karta. Kyrkbergen-filen (2026-03-01) har däremot grivation 5,9°, och den hanteras av rotationstermerna.
- **Läget stämmer mot OSM.** Väg E 680 och sjöstränder blandade med OSM-tiles på z16–17 sammanfaller inom ca 2–3 m.
- **panmaps GeoJSON-export är speglad nord–syd.** Den räknar N = ref + y i stället för ref − y, och ignorerar skalfaktorerna. Använd den inte för georeferens. (Värt att rapportera upstream.)
- **panmap 0.7.0 kraschar på Åtvid** ("Entity expansion limit exceeded"). fast-xml-parser räknar även vanliga `&quot;` mot en gräns på 1 000. Vår lokala patch höjer `maxTotalExpansions` och `maxExpandedLength` i `src/formats/omap/reader/decode.ts`. Övriga skydd mot DOCTYPE-entiteter behålls.

## Tid och storlek (M-serien Mac, 600 dpi, z12–17)

| Karta | Bredd px | Total tid | Tiles | Storlek tiles | GeoTIFF |
|---|---|---|---|---|---|
| Botorp 25 | 13 769 | ca 4 min (rsvg ca 3) | 4 368 | 157 MB (z17: 102 MB) | 97 MB |
| Åtvid 25 | 21 980 | ca 4 min | 6 471 | 148 MB | 81 MB |

Siffrorna ovan är före pngquant. Med 128 färger blev Åtvid 40 MB (6 581 tiles, ca 6 kB per ruta). Besökare hämtar bara rutor inom kartan och i vyn, och webbläsaren cachar dem i ett år (`immutable`, ny version = ny adress).

## Licens

panmap är AGPL-3.0. Konverteringsjobbet kör en patchad panmap åt publicerarna, och därför ligger patchen och Dockerfilen (fast commit) i det publika repot under `tools/map-converter/`. Repot i övrigt är MIT.

## Kartsidan

`/kartor` (länk i kontomenyn för medlemmar): en karta i taget över OSM, val mellan kartorna, reglage för o-kartans opacitet (sparas lokalt) och "Visa min position" (GPS, följer tills man stänger av).

## Öppet

- Visa alla kartor samtidigt i stället för en i taget? Botorp och Åtvid överlappar, så det översta lagret täcker det andra där.
- Senare: PDF-utsnitt ur GeoTIFF:en (`map_rasters/`), rättningsförslag som GeoJSON, banläggning, banan + GPS vid utsättning.
