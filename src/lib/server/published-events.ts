// Körs bara i bygget (Astro content loader). Läser publicerade ögonblicksbilder med Admin SDK.
// Lokalt: `gcloud auth application-default login`, eller FIRESTORE_EMULATOR_HOST mot emulatorn.
// I CI: tjänstekontot via google-github-actions/auth.
import { toPublicCourseFiles } from '../courses';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';

export async function loadPublishedEvents() {
  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId: 'okeken' });

  let snap;
  try {
    snap = await getFirestore().collection('events').where('status', '==', 'published').get();
  } catch (err) {
    // Hellre ett misslyckat bygge än en deployad sajt utan events
    throw new Error(
      'Kunde inte läsa events från Firestore. Lokalt: kör `gcloud auth application-default login` ' +
        `eller starta emulatorn (npm run dev:emu). Orsak: ${(err as Error).message}`,
    );
  }

  return snap.docs.flatMap((d) => {
    const { published: p, slug } = d.data();
    if (!p || !slug) return [];
    return [
      {
        id: slug as string,
        type: p.type,
        title: p.title,
        startsAt: (p.startsAt as Timestamp).toDate(),
        endsAt: (p.endsAt as Timestamp).toDate(),
        location: p.location?.name ? { name: p.location.name, mapUrl: p.location.mapUrl || undefined } : undefined,
        courseSetter: p.courseSetter || undefined,
        livelox: p.livelox || undefined,
        courseFiles: Array.isArray(p.courseFiles) && p.courseFiles.length ? toPublicCourseFiles(p.courseFiles) : undefined,
        body: p.body ?? '',
      },
    ];
  });
}
