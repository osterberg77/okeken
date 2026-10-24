#!/usr/bin/env node
// Skapar texterna till de fasta sidorna /ute och /medlemsavgift (beslut 0023) som redan publicerade infosidor.
// Reglerna tillåter inte att man skapar dem för hand (adresserna är reserverade), så de skrivs här med Admin SDK.
// Därefter redigeras och publiceras de i /admin/sidor som alla andra sidor. Befintliga dokument skrivs inte över.
//
//   node scripts/seed-fixed-pages.mjs                                   (produktion, kräver ADC)
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 node scripts/seed-fixed-pages.mjs   (emulatorn)
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'okeken' });
const db = getFirestore();

const PAGES = [
  {
    id: 'fast-ute',
    slug: 'ute',
    title: 'Jag har sprungit',
    body: 'Registrera gärna att du varit ute, så vet vi att våra banor uppskattas. Tid och namn är valfria att visa.',
  },
  {
    id: 'fast-medlemsavgift',
    slug: 'medlemsavgift',
    title: 'Medlemsavgift',
    body: 'Lägg till alla som ska vara medlemmar, så räknar vi ut avgiften. Sedan betalar du med Swish.',
  },
];

for (const { id, slug, title, body } of PAGES) {
  const ref = db.doc(`pages/${id}`);
  if ((await ref.get()).exists) {
    console.log(`finns redan: ${id}`);
    continue;
  }
  const content = { title, body };
  await ref.set({
    ...content,
    status: 'published',
    slug,
    published: content,
    publishedAt: FieldValue.serverTimestamp(),
    createdBy: 'seed',
    createdAt: FieldValue.serverTimestamp(),
    updatedBy: 'seed',
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`skapad och publicerad: ${id} (/${slug})`);
}
