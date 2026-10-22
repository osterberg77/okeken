// Körs bara i bygget (Astro content loader). Läser publicerade ögonblicksbilder med Admin SDK.
// Lokalt: `gcloud auth application-default login`, eller FIRESTORE_EMULATOR_HOST mot emulatorn.
// I CI: tjänstekontot via google-github-actions/auth.
import { toPublicCourseFiles } from '../courses';
import { toPublicImage } from '../event-image';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';

function toLocation(l: { name?: string; mapUrl?: string; lat?: number; lng?: number } | undefined) {
  if (!l) return undefined;
  const hasCoords = typeof l.lat === 'number' && typeof l.lng === 'number';
  if (!l.name && !hasCoords) return undefined;
  return {
    name: l.name ?? '',
    mapUrl: l.mapUrl || undefined,
    lat: hasCoords ? l.lat : undefined,
    lng: hasCoords ? l.lng : undefined,
  };
}

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
        location: toLocation(p.location),
        courseSetter: p.courseSetter || undefined,
        livelox: p.livelox || undefined,
        courseFiles: Array.isArray(p.courseFiles) && p.courseFiles.length ? toPublicCourseFiles(p.courseFiles) : undefined,
        image: toPublicImage(p.image),
        body: p.body ?? '',
      },
    ];
  });
}
