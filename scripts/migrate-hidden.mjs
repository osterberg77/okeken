#!/usr/bin/env node
// Engångsmigrering (beslut 0018): users.hideNameInRsvp blir users.hidden ("Dölj mig"). Körs efter deploy av ny kod;
// kör sedan scripts/sync-members.mjs så att members.hidden fylls på.
//
//   gcloud auth application-default login   (en gång)
//   node scripts/migrate-hidden.mjs
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'okeken' });
const db = getFirestore();
let moved = 0;
for (const user of (await db.collection('users').get()).docs) {
  const old = user.data().hideNameInRsvp;
  if (old === undefined) continue;
  await user.ref.update({ ...(old === true ? { hidden: true } : {}), hideNameInRsvp: FieldValue.delete() });
  if (old === true) moved++;
}
console.log(`Migrerade ${moved} dolda användare.`);
