#!/usr/bin/env node
// Sätter behörigheter direkt med Admin SDK, förbi säkerhetsreglerna.
// Används för att utse första superadmin; därefter sköts allt i /admin/anvandare.
//
//   gcloud auth application-default login   (en gång)
//   node scripts/set-permissions.mjs erik@example.com superadmin
//
// Personen måste ha loggat in på sajten en gång så att kontot finns.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PERMISSIONS = ['member', 'publisher', 'board', 'superadmin'];
const [email, ...permissions] = process.argv.slice(2);

if (!email || permissions.length === 0 || permissions.some((p) => !PERMISSIONS.includes(p))) {
  console.error(`Användning: node scripts/set-permissions.mjs <e-post> <${PERMISSIONS.join('|')}> …`);
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: 'okeken' });

const user = await getAuth().getUserByEmail(email);
const ref = getFirestore().doc(`users/${user.uid}`);
const snap = await ref.get();
const current = snap.exists ? (snap.get('permissions') ?? []) : [];
const next = [...new Set([...current, ...permissions])];

await ref.set(
  snap.exists
    ? { permissions: next }
    : { displayName: user.displayName ?? '', email: user.email, permissions: next, createdAt: FieldValue.serverTimestamp() },
  { merge: true },
);
console.log(`${email}: ${next.join(', ')}`);
