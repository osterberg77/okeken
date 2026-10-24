// Körs bara i bygget (Astro content loader). Läser publicerade ögonblicksbilder med Admin SDK.
// Lokalt: `gcloud auth application-default login`, eller FIRESTORE_EMULATOR_HOST mot emulatorn.
// I CI: tjänstekontot via google-github-actions/auth.
import { toPublicCourseFiles } from '../courses';
import { toPublicImage } from '../event-image';
import { isPlaceIcon, toExtraPlaces } from '../place-icons';
import { normalizeName, omitHidden, type HiddenPeople } from '../hidden';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';

function toLocation(l: { name?: string; mapUrl?: string; lat?: number; lng?: number; icon?: unknown; places?: unknown } | undefined) {
  if (!l) return undefined;
  const places = toExtraPlaces(l.places);
  const hasCoords = typeof l.lat === 'number' && typeof l.lng === 'number';
  if (!l.name && !hasCoords) return undefined;
  return {
    name: l.name ?? '',
    mapUrl: l.mapUrl || undefined,
    lat: hasCoords ? l.lat : undefined,
    lng: hasCoords ? l.lng : undefined,
    icon: isPlaceIcon(l.icon) ? l.icon : undefined,
    places: places.length ? places : undefined,
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

  // "Publicerat av" slås upp här: bara medlemmar som godkänt policyn och inte dolt sitt namn visas (members.publicName)
  const members = new Map((await getFirestore().collection('members').get()).docs.map((m) => [m.id, m.data()]));
  const publisherOf = (uid: unknown) => {
    const m = typeof uid === 'string' ? members.get(uid) : undefined;
    if (!m || m.publicName !== true || typeof m.displayName !== 'string') return undefined;
    return {
      name: m.displayName as string,
      photoUrl: typeof m.photoUrl === 'string' ? (m.photoUrl as string) : undefined,
      color: typeof m.avatarColor === 'string' ? (m.avatarColor as string) : undefined,
    };
  };

  // Publicerade resultatlistor (eventResultsPublished/{eventId}, skrivs bara av Function setResultsPublished).
  // Fälten plockas ut ett och ett så att inget annat kan följa med.
  // Personer som valt "Dölj mig" (beslut 0018) utelämnas helt; läses ur users (inte members) så att även den som mist
  // sin behörighet fortfarande är dold. Placeringar räknas om i ResultsList när raden är borta.
  const hiddenUsers = (await getFirestore().collection('users').where('hidden', '==', true).get()).docs;
  const hidden: HiddenPeople = {
    uids: new Set(hiddenUsers.map((u) => u.id)),
    names: new Set(hiddenUsers.flatMap((u) => (typeof u.data().displayName === 'string' ? [normalizeName(u.data().displayName)] : []))),
  };

  const resultDocs = await getFirestore().collection('eventResultsPublished').get();
  const resultsOf = (eventId: string) => {
    const entries = resultDocs.docs.find((r) => r.id === eventId)?.data().entries;
    if (!Array.isArray(entries) || entries.length === 0) return undefined;
    const rows = entries.flatMap((e: Record<string, unknown>) =>
      typeof e?.name === 'string' && typeof e.course === 'string'
        ? [{ name: e.name, course: e.course, seconds: typeof e.seconds === 'number' ? e.seconds : null, memberUid: typeof e.memberUid === 'string' ? e.memberUid : null }]
        : [],
    );
    // memberUid används bara för filtret och plockas bort här, så det når aldrig sidorna
    return omitHidden(rows, hidden).map(({ name, course, seconds }) => ({ name, course, seconds }));
  };

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
        publisher: publisherOf(p.publisher),
        results: resultsOf(d.id),
        body: p.body ?? '',
      },
    ];
  });
}
