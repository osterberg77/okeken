// Körs bara i bygget (Astro content loader). Läser publicerade ögonblicksbilder av infosidor med Admin SDK.
// Lokalt: `gcloud auth application-default login`, eller FIRESTORE_EMULATOR_HOST mot emulatorn.
// I CI: tjänstekontot via google-github-actions/auth.
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';

export async function loadPublishedPages() {
  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId: 'okeken' });

  let snap;
  try {
    snap = await getFirestore().collection('pages').where('status', '==', 'published').get();
  } catch (err) {
    // Hellre ett misslyckat bygge än en deployad sajt utan sidor
    throw new Error(
      'Kunde inte läsa pages från Firestore. Lokalt: kör `gcloud auth application-default login` ' +
        `eller starta emulatorn (npm run dev:emu). Orsak: ${(err as Error).message}`,
    );
  }

  // Reglerna kan inte garantera unika slugs mellan dokument. Vid krock behålls den först skapade sidan,
  // så att befintliga länkar fortsätter peka dit (editorn ska förhindra krocken).
  const docs = [...snap.docs].sort(
    (a, b) =>
      ((a.get('createdAt') as Timestamp | undefined)?.toMillis() ?? 0) -
        ((b.get('createdAt') as Timestamp | undefined)?.toMillis() ?? 0) || a.id.localeCompare(b.id),
  );
  const seen = new Set<string>();

  return docs.flatMap((d) => {
    const { published: p, slug } = d.data();
    if (!p || typeof slug !== 'string' || !slug) return [];
    if (seen.has(slug)) {
      console.warn(`Infosidan ${d.id} har samma adress (/${slug}) som en tidigare sida och hoppas över.`);
      return [];
    }
    seen.add(slug);
    return [
      {
        id: slug,
        // Dokument-id: menyn (menu/main) pekar på sidor med det, inte med slug
        pageId: d.id,
        slug,
        title: p.title as string,
        body: (p.body as string) ?? '',
      },
    ];
  });
}
