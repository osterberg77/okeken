// Körs bara i bygget (Astro content loader). Läser publicerade tävlingar ur Eventor-spegeln med Admin SDK.
// Bara publicerade (`live`) och inte `gone` släpps igenom; allt annat i spegeln når aldrig besökarna.
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';

export async function loadSelectedEventorEvents() {
  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId: 'okeken' });

  let snap;
  try {
    snap = await getFirestore().collection('eventorEvents').where('live', '==', true).get();
  } catch (err) {
    // Hellre ett misslyckat bygge än en deployad sajt utan de valda tävlingarna
    throw new Error(
      'Kunde inte läsa eventorEvents från Firestore. Lokalt: kör `gcloud auth application-default login` ' +
        `eller starta emulatorn (npm run dev:emu). Orsak: ${(err as Error).message}`,
    );
  }

  return snap.docs.flatMap((d) => {
    const e = d.data();
    if (e.gone === true) return [];
    return [
      {
        id: d.id,
        name: e.name as string,
        startsAt: (e.startsAt as Timestamp).toDate(),
        endsAt: (e.endsAt as Timestamp).toDate(),
        allDay: e.allDay === true,
        organiserName: (e.organiserName as string) || undefined,
        url: e.url as string,
      },
    ];
  });
}
