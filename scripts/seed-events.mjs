#!/usr/bin/env node
// Engångsimport av seed/events/*.md till Firestore som publicerade events.
// Dokument-id = filnamnet (= adressen), så skriptet kan köras igen utan dubbletter;
// befintliga dokument hoppas över så att ändringar gjorda i admin inte skrivs över.
//
//   node scripts/seed-events.mjs                                   (produktion, kräver ADC)
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 node scripts/seed-events.mjs   (emulatorn)
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { parse } from 'yaml';

const DIR = 'seed/events';

initializeApp({ credential: applicationDefault(), projectId: 'okeken' });
const db = getFirestore();

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.md')).sort()) {
  const id = file.replace(/\.md$/, '');
  const ref = db.doc(`events/${id}`);
  if ((await ref.get()).exists) {
    console.log(`finns redan: ${id}`);
    continue;
  }
  const [, frontmatter, body] = (await readFile(join(DIR, file), 'utf8')).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = parse(frontmatter);
  const content = {
    type: fm.type,
    title: fm.title,
    startsAt: Timestamp.fromDate(new Date(fm.startsAt)),
    endsAt: Timestamp.fromDate(new Date(fm.endsAt)),
    location: { name: fm.location?.name ?? '', mapUrl: fm.location?.mapUrl ?? '' },
    body: body.trim(),
    courseSetter: fm.courseSetter ?? '',
    livelox: fm.livelox ?? '',
  };
  await ref.set({
    ...content,
    status: 'published',
    slug: id,
    published: content,
    publishedAt: FieldValue.serverTimestamp(),
    source: 'seed',
    createdBy: 'seed',
    createdAt: FieldValue.serverTimestamp(),
    updatedBy: 'seed',
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`importerad: ${id}`);
}
