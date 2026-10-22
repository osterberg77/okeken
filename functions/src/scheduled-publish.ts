import type { Firestore } from 'firebase-admin/firestore';
import { eventSlug } from './slug.js';
import { stockholmDay } from './stats-core.js';

// Schemalagd publicering (beslut 0016): publicerar utkast vars `publishAt` har passerat, på samma sätt som
// knappen Publicera (publishEvent i src/lib/firebase/events.ts): ögonblicksbilden är utkastets innehåll,
// adressen sätts första gången och `publishAt` töms. onEventWritten startar sedan bygget.
// Bara Date och vanliga värden (ingen FieldValue/Timestamp-klass), så att testerna kan köra mot rotens firebase-admin.

/** Fälten i ögonblicksbilden: samma som eventSnapshot() i firestore.rules */
function snapshotOf(d: FirebaseFirestore.DocumentData) {
  return {
    type: d.type,
    title: d.title,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    location: d.location,
    body: d.body,
    courseSetter: d.courseSetter,
    livelox: d.livelox,
    courseFiles: d.courseFiles ?? [],
    image: d.image ?? null,
    publisher: d.publisher ?? null,
  };
}

async function uniqueSlug(db: Firestore, id: string, d: FirebaseFirestore.DocumentData): Promise<string> {
  const base = eventSlug(stockholmDay((d.startsAt as { toDate(): Date }).toDate()), String(d.title));
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await db.collection('events').where('slug', '==', candidate).get();
    if (taken.docs.every((x) => x.id === id)) return candidate;
  }
}

/** Publicerar alla utkast som ska publiceras senast `now`. Returnerar id:n som publicerades. */
export async function publishDueEvents(db: Firestore, now = new Date()): Promise<string[]> {
  const due = await db.collection('events').where('publishAt', '<=', now).get();
  const published: string[] = [];
  for (const snap of due.docs) {
    const d = snap.data();
    if (!d.title || !d.startsAt || !d.endsAt) continue;
    try {
      await snap.ref.update(
        {
          status: 'published',
          published: snapshotOf(d),
          publishedAt: now,
          slug: d.slug ?? (await uniqueSlug(db, snap.id, d)),
          publishAt: null,
        },
        // Ändrades eventet under tiden hoppar vi över det; nästa körning tar det med den nya versionen
        { lastUpdateTime: snap.updateTime },
      );
      published.push(snap.id);
    } catch (err) {
      console.error('Kunde inte publicera schemalagt event', snap.id, err);
    }
  }
  return published;
}
