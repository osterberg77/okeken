#!/usr/bin/env node
// Engångsmigrering till menu/main (beslut 0008): bygger menyn från sidornas gamla fält inMenu/menuOrder/menuLabel
// och tar bort fälten från sidorna, både från utkastet och från `published`-ögonblicksbilden.
//
//   node scripts/migrate-menu.mjs --dry-run                                  (visa vad som skulle göras)
//   node scripts/migrate-menu.mjs                                            (produktion, kräver ADC)
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 node scripts/migrate-menu.mjs     (emulatorn)
//
// - menu/main.items (utkastet) byggs av utkastfälten: sidor med inMenu, sorterade på menuOrder och titel,
//   label = menuLabel eller titeln (högst 40 tecken), inga undermenyer.
// - menu/main.published byggs på samma sätt av ögonblicksbilderna på publicerade/avpublicerade sidor, så att
//   besökarnas meny blir densamma som före migreringen. Finns ingen sådan sida blir published null (platshållarna).
// - Idempotent: finns menu/main redan rörs den inte; sidor utan de gamla fälten hoppas över.
// - Allt skrivs i en batch (antingen allt eller inget). Admin SDK går förbi reglerna.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const MAX_ITEMS = 8;
const MAX_LABEL = 40;
const OLD_FIELDS = ['inMenu', 'menuOrder', 'menuLabel'];

const dryRun = process.argv.includes('--dry-run');
const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulatorn (${process.env.FIRESTORE_EMULATOR_HOST})` : 'PRODUKTION';

initializeApp({ credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT ?? 'okeken' });
const db = getFirestore();

console.log(`Mål: ${target}${dryRun ? ' – torrkörning, inget skrivs' : ''}\n`);

/** Menyposter från sidornas gamla fält. `pick` väljer utkastet eller ögonblicksbilden. */
function buildItems(docs, pick) {
  const entries = docs.flatMap((d) => {
    const c = pick(d);
    if (!c || c.inMenu !== true) return [];
    const title = typeof c.title === 'string' ? c.title.trim() : '';
    const label = ((typeof c.menuLabel === 'string' && c.menuLabel.trim()) || title || d.id).slice(0, MAX_LABEL);
    return [{ pageId: d.id, label, order: Number.isInteger(c.menuOrder) ? c.menuOrder : 0, title }];
  });
  entries.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'sv'));
  if (entries.length > MAX_ITEMS) {
    console.warn(`  Varning: ${entries.length} menysidor, bara de ${MAX_ITEMS} första tas med: ` +
      entries.slice(MAX_ITEMS).map((e) => e.pageId).join(', '));
  }
  return entries.slice(0, MAX_ITEMS).map(({ label, pageId }) => ({ label, pageId, children: [] }));
}

const show = (items) => (items.length ? items.map((i) => `${i.label} → ${i.pageId}`).join(', ') : '(tom)');

const pages = (await db.collection('pages').get()).docs;
const menuRef = db.doc('menu/main');
const menuSnap = await menuRef.get();
const batch = db.batch();
let writes = 0;

// 1. Menyn
if (menuSnap.exists) {
  console.log('menu/main finns redan och lämnas orörd.');
} else {
  const items = buildItems(pages, (d) => d.data());
  const live = pages.filter((d) => ['published', 'unpublished'].includes(d.get('status')));
  const publishedItems = buildItems(live, (d) => d.get('published'));
  const anyLive = live.some((d) => d.get('published')?.inMenu === true);
  console.log(`menu/main skapas.\n  utkast:     ${show(items)}\n  publicerat: ${anyLive ? show(publishedItems) : 'null (aldrig publicerad, platshållarna visas)'}`);
  batch.set(menuRef, {
    items,
    published: anyLive ? { items: publishedItems } : null,
    publishedAt: anyLive ? FieldValue.serverTimestamp() : null,
    updatedBy: 'migrate-menu',
    updatedAt: FieldValue.serverTimestamp(),
  });
  writes++;
}

// 2. Sidorna: ta bort de gamla fälten från utkastet och från ögonblicksbilden.
// updatedAt/updatedBy och publishedAt lämnas orörda: innehållet ändras inte.
for (const d of pages) {
  const data = d.data();
  const published = data.published && typeof data.published === 'object' ? data.published : null;
  const update = {};
  for (const f of OLD_FIELDS) {
    if (f in data) update[f] = FieldValue.delete();
    if (published && f in published) update[`published.${f}`] = FieldValue.delete();
  }
  const keys = Object.keys(update);
  if (keys.length === 0) {
    console.log(`pages/${d.id}: redan migrerad`);
    continue;
  }
  console.log(`pages/${d.id} (${data.status}): tar bort ${keys.join(', ')}`);
  batch.update(d.ref, update);
  writes++;
}

if (writes === 0) {
  console.log('\nInget att göra.');
} else if (dryRun) {
  console.log(`\nTorrkörning: ${writes} dokument skulle skrivas. Kör utan --dry-run för att migrera.`);
} else {
  await batch.commit();
  console.log(`\nKlart: ${writes} dokument skrivna.`);
}
