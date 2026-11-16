# Deploy

- Repo på GitHub, `main` är produktion.
- GitHub Actions:
  - **PR:** build + preview-kanal på Firebase Hosting.
  - **Push till `main`:** build + deploy till Firebase Hosting (`firebase-tools` eller `FirebaseExtended/action-hosting-deploy`), samt deploy av Firestore/Storage-regler och Functions.
- Secrets i GitHub: `FIREBASE_SERVICE_ACCOUNT` m.fl. Hemligheter som bara Functions behöver ligger i Secret Manager: GitHub-token för `repository_dispatch` och Eventor-nyckeln `EVENTOR_API_KEY` (hämtningen körs i en Cloud Function, se eventor.md; sätts med `firebase functions:secrets:set EVENTOR_API_KEY`) i Secret Manager.
- **Deploy-workflown** körs vid push till `main`, manuellt, via `repository_dispatch` (`content-published`, skickas av Function `onEventWritten` i `functions/`) och nattligt (cron). Den deployar regler + Functions, bygger, deployar Hosting och skriver `meta/build.lastBuildAt`.
- Function-hemlighet: `GITHUB_DISPATCH_TOKEN` (Secret Manager, `firebase functions:secrets:set`).
- Workflow-filer i `.github/workflows/` (läggs till vid scaffolding).

## Firebase-projekt

- Projekt-id `okeken` (Hosting: `okeken.web.app`), skapat 2026-10-20 på Eriks Google-konto.
- Region **europe-north1** för Firestore, Storage och Functions (närmast, kan inte ändras i efterhand).
- Blaze-plan med budgetlarm (t.ex. 50 kr/månad).

## Storage-reglerna läser Firestore (engångssteg)

`storage.rules` slår upp behörighet i `users/{uid}` (`firestore.get`). Det kräver att Storages tjänstekonto har rollen `roles/firebaserules.firestoreServiceAgent`. Firebase CLI försöker ge den vid deploy, men CI-kontot `github-deploy@` får inte ändra IAM, så utan detta steg nekas **alla** uppladdningar (403, `storage/unauthorized`). Kör en gång som projektägare (gjort 2026-10-21):

```
gcloud projects add-iam-policy-binding okeken \
  --member="serviceAccount:service-1034481154088@gcp-sa-firebasestorage.iam.gserviceaccount.com" \
  --role="roles/firebaserules.firestoreServiceAgent"
```

Projektnumret (1034481154088) byts om projektet sätts upp på nytt.

## API-nyckelns adressbegränsning

Webbappens nyckel (*Browser key (auto created by Firebase)*) är sedan 2026-10-22 begränsad till vissa webbadresser. Google godtar **inte** jokertecken för porten (`http://localhost:*/*` matchar ingenting), så varje port för lokal utveckling måste stå uttryckligen, t.ex. `http://localhost:4321/*` och `http://localhost:4322/*`. Saknas porten nekas all inloggning från dev med 403 (`Requests from referer … are blocked`). Ändras i Google Cloud Console → APIs & Services → Credentials.

## Storage-trigger kräver läsrätt till bucketen (engångssteg)

Function `onMapSourceUploaded` (beslut 0025) triggas av Storage. Vid deploy slår Firebase CLI upp bucketens region, och utan läsrätt till bucketens metadata stoppas hela deployen med `Can't find the storage bucket region`. Gjort 2026-11-16:

```
gcloud storage buckets add-iam-policy-binding gs://okeken.firebasestorage.app --project okeken \
  --member=serviceAccount:github-deploy@okeken.iam.gserviceaccount.com --role=roles/storage.legacyBucketReader
```

Storages tjänsteagent har också fått `roles/pubsub.publisher` (se `tools/map-converter/README.md`).
