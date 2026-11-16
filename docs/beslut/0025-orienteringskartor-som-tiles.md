# 0025 – Orienteringskartor som kartlager (tiles)

**Kontext:** Klubbens kartor (Kartbas Botorp och Kartbas Åtvid, OpenOrienteering Mapper) ska kunna visas för medlemmar i en webbkarta, över OSM, med GPS-position. Kartorna uppdateras efter hand, så en publicerare behöver kunna ladda upp en ersättningsfil. Konverteringen kräver panmap (AGPL-3.0), rsvg-convert och GDAL, vilket inte går att köra i en vanlig Cloud Function. Pipelinen och verifieringen av georeferensen beskrivs i `docs/kartor.md`.

**Beslut:**
- **Åtkomst genom svårgissad adress.** Tiles ligger i Storage under `map_tiles/<kartId>/<version>/{z}/{x}/{y}.png`, där `version` är 96 slumpbitar. Alla med adressen får hämta men ingen får lista. Adressen står bara i `maps/{kartId}`, som bara inloggade med någon behörighet får läsa. Det är ett medvetet svagt skydd (beslutat av Erik 2026-11-16): den som har adressen kan dela den.
- **Hård cachning.** Varje tile laddas upp med `Cache-Control: public, max-age=31536000, immutable`. En ny kartversion får en ny `version` och därmed nya adresser, så gamla tiles behöver aldrig ogiltigförklaras. Tiles är 8-bitars PNG (128 färger, pngquant), ca en tredjedel av full PNG.
- **Konvertering i ett Cloud Run Job** (`map-converter`, europe-north1). En publicerare laddar upp `.omap`/`.ocd` till `map_sources/<kartId>/<tid>-<namn>.<ext>`. Function `onMapSourceUploaded` markerar jobbet i `maps/{kartId}.job` och startar jobbet via Cloud Run Admin API. Jobbet bygger tiles, laddar upp dem och en GeoTIFF (`map_rasters/`, för PDF-utsnitt senare), byter `current` och raderar den förra versionens tiles. Originalfilerna sparas.
- **AGPL:** jobbet kör en patchad panmap åt andra över nätet. Patchen och Dockerfilen (som hämtar panmap på en fast commit) ligger i det publika repot under `tools/map-converter/`, så hela källkoden finns publikt. Patchfilen är AGPL, resten av repot MIT.

**Konsekvenser:**
- Nya regler: `maps` i `firestore.rules`, `map_sources/` och `map_tiles/` i `storage.rules`, med tester.
- Engångsuppsättning i GCP: Artifact Registry-repo, jobbet, rättighet för Functions tjänstekonto att starta jobbet (se `tools/map-converter/README.md`).
- Trafik: en besökare hämtar bara de rutor som syns, ca 10 kB per ruta vid z17. Webbläsaren cachar dem i ett år.
