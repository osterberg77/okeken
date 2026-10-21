#!/usr/bin/env node
// Importerar seed/pages/*.md till Firestore som UTKAST (status 'draft', ingen adress, inget publicerat).
// Publicera i admin (/admin/sidor); då sätts adressen från titeln. Dokument-id = filnamnet, och
// befintliga dokument hoppas över så att ändringar gjorda i admin inte skrivs över.
// Skapar också menyutkastet menu/main från seed/menu.json om det inte finns (opublicerat, beslut 0008).
//
//   node scripts/seed-pages.mjs                                   (produktion, kräver ADC)
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 node scripts/seed-pages.mjs   (emulatorn)
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { parse } from 'yaml';

const DIR = 'seed/pages';

initializeApp({ credential: applicationDefault(), projectId: 'okeken' });
const db = getFirestore();

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.md')).sort()) {
  const id = file.replace(/\.md$/, '');
  const ref = db.doc(`pages/${id}`);
  if ((await ref.get()).exists) {
    console.log(`finns redan: ${id}`);
    continue;
  }
  const [, frontmatter, body] = (await readFile(join(DIR, file), 'utf8')).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = parse(frontmatter);
  await ref.set({
    title: fm.title,
    body: body.trim(),
    status: 'draft',
    slug: null,
    published: null,
    publishedAt: null,
    createdBy: 'seed',
    createdAt: FieldValue.serverTimestamp(),
    updatedBy: 'seed',
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`importerad som utkast: ${id}`);
}

const menuRef = db.doc('menu/main');
if ((await menuRef.get()).exists) {
  console.log('finns redan: menu/main');
} else {
  const { items } = JSON.parse(await readFile('seed/menu.json', 'utf8'));
  await menuRef.set({
    items,
    published: null,
    publishedAt: null,
    updatedBy: 'seed',
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log('menyutkast importerat: menu/main');
}
