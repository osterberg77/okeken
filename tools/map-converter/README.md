# Kartkonvertering (Cloud Run Job `map-converter`)

Gör om en uppladdad orienteringskarta (.omap/.ocd) till tiles. Se beslut 0025 och `docs/kartor.md`.

Flöde: `/admin/kartor` laddar upp till `map_sources/<kartId>/…` → Function `onMapSourceUploaded` sätter `maps/<kartId>.job` och startar jobbet → jobbet kör `scripts/map-tiles.mjs`, laddar upp till `map_tiles/<kartId>/<version>/`, byter `current` och raderar förra versionen.

## Licens

`panmap.patch` är en ändring av [panmap](https://github.com/kiwirm/panmap) och licensieras under AGPL-3.0-or-later. Dockerfilen hämtar panmap på en fast commit och lägger på patchen; tillsammans är de den fullständiga källkoden till den version som körs. Övriga filer i katalogen omfattas av repots MIT-licens.

## Bygga och testa lokalt

```sh
docker build -f tools/map-converter/Dockerfile -t map-converter:local .
# mot emulatorerna (firebase.test.json), efter att maps/<id> och originalet lagts in:
docker run --rm -e MAP_ID=atvid -e SOURCE_PATH=map_sources/atvid/<tid>-<namn>.omap \
  -e BUCKET=demo-okeken.appspot.com -e GCLOUD_PROJECT=demo-okeken \
  -e FIRESTORE_EMULATOR_HOST=host.docker.internal:8180 -e FIREBASE_STORAGE_EMULATOR_HOST=host.docker.internal:9199 \
  map-converter:local
```

Provat 2026-11-16 med Kartbas Åtvid 25: 7,5 min med 4 CPU, 6 581 tiles, 40 MB.

## Engångsuppsättning i GCP (projekt `okeken`, europe-north1)

```sh
P=okeken; R=europe-north1
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project $P
gcloud artifacts repositories create map-converter --repository-format=docker --location=$R --project $P
gcloud builds submit --project $P --region=$R --config tools/map-converter/cloudbuild.yaml .
gcloud run jobs deploy map-converter --project $P --region=$R \
  --image=$R-docker.pkg.dev/$P/map-converter/map-converter:latest \
  --cpu=4 --memory=8Gi --task-timeout=45m --max-retries=0 \
  --set-env-vars=BUCKET=okeken.firebasestorage.app
# Functions tjänstekonto (compute default) får starta jobbet med parametrar:
gcloud run jobs add-iam-policy-binding map-converter --project $P --region=$R \
  --member=serviceAccount:1034481154088-compute@developer.gserviceaccount.com --role=roles/run.developer
# Storage får skicka uppladdningshändelser till Functions (CI-kontot kan inte ge IAM-roller):
gcloud projects add-iam-policy-binding $P --condition=None \
  --member=serviceAccount:$(gcloud storage service-agent --project $P) --role=roles/pubsub.publisher
```

Allt ovan kördes 2026-11-16.

Jobbet kör som compute-standardkontot, som redan får läsa och skriva Firestore och Storage. Ny image efter ändring: kör `gcloud builds submit` och `gcloud run jobs deploy` igen.
