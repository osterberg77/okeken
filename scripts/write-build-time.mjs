#!/usr/bin/env node
// Skriver meta/build.lastBuildAt efter lyckad deploy (körs i GitHub Actions).
// Tiden är när bygget *startade* (argument 1, ISO-8601): ett event som publicerades
// medan bygget pågick ska inte räknas som delningsklart.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const startedAt = new Date(process.argv[2] ?? '');
if (Number.isNaN(startedAt.getTime())) {
  console.error('Användning: node scripts/write-build-time.mjs <starttid ISO-8601>');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: 'okeken' });
await getFirestore().doc('meta/build').set({ lastBuildAt: Timestamp.fromDate(startedAt) });
console.log(`meta/build.lastBuildAt = ${startedAt.toISOString()}`);
