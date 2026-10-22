#!/usr/bin/env node
// Bygger medlemslistan (members/{uid}, beslut 0015) från alla befintliga användare. Körs en gång efter första deploy av
// onUserMemberWritten; därefter håller funktionen listan i synk.
//
//   gcloud auth application-default login   (en gång)
//   npm --prefix functions run build && node scripts/sync-members.mjs
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { memberDoc } from '../functions/lib/members.js';

initializeApp({ credential: applicationDefault(), projectId: 'okeken' });
const db = getFirestore();
let written = 0;
for (const user of (await db.collection('users').get()).docs) {
  const member = memberDoc(user.data());
  const ref = db.doc(`members/${user.id}`);
  if (member) {
    await ref.set(member);
    written++;
  } else {
    await ref.delete();
  }
}
console.log(`Medlemslistan: ${written} medlemmar.`);
