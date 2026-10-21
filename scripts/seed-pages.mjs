#!/usr/bin/env node
// Importerar seed/pages/*.md till Firestore som UTKAST (status 'draft', ingen adress, inget publicerat).
// Publicera i admin (/admin/sidor); då sätts adressen från titeln. Dokument-id = filnamnet, och
// befintliga dokument hoppas över så att ändringar gjorda i admin inte skrivs över.
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
    inMenu: fm.inMenu === true,
    menuOrder: Number.isInteger(fm.menuOrder) ? fm.menuOrder : 0,
    menuLabel: fm.menuLabel ?? '',
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
