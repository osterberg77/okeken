# Deploy

- Repo på GitHub, `main` är produktion.
- GitHub Actions:
  - **PR:** build + preview-kanal på Firebase Hosting.
  - **Push till `main`:** build + deploy till Firebase Hosting (`firebase-tools` eller `FirebaseExtended/action-hosting-deploy`), samt deploy av Firestore/Storage-regler och Functions.
- Secrets i GitHub: `FIREBASE_SERVICE_ACCOUNT` m.fl. Eventor-nyckeln ligger som GitHub Secret (synken körs i Actions). Hemligheter som bara Functions behöver (t.ex. GitHub-token för `repository_dispatch`) i Secret Manager.
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
