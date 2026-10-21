import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

initializeApp();
setGlobalOptions({ region: 'europe-north1', maxInstances: 3 });

const GITHUB_TOKEN = defineSecret('GITHUB_DISPATCH_TOKEN');
const REPO = 'osterberg77/okeken';

/** Det besökarna ser: bara dessa fält påverkar sajten, utkastsändringar ska inte starta bygge. */
function liveState(data: FirebaseFirestore.DocumentData | undefined) {
  if (!data) return null;
  return {
    status: data.status ?? null,
    slug: data.slug ?? null,
    published: data.published ?? null,
  };
}

/** Startar bygget om det publicerade innehållet ändrats (publicera, ändra, avpublicera, radera). */
export const onEventWritten = onDocumentWritten(
  { document: 'events/{eventId}', secrets: [GITHUB_TOKEN] },
  async (event) => {
    const before = liveState(event.data?.before.data());
    const after = liveState(event.data?.after.data());
    const visible = (s: ReturnType<typeof liveState>) => (s?.status === 'published' ? s : null);

    if (JSON.stringify(visible(before)) === JSON.stringify(visible(after))) return;

    // Adminvyn jämför requestedAt med lastBuildAt för att visa "bygger" (gul) eller "fel" (röd)
    await getFirestore().doc('meta/build').set({ requestedAt: FieldValue.serverTimestamp() }, { merge: true });

    const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN.value()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ event_type: 'content-published', client_payload: { eventId: event.params.eventId } }),
    });

    if (!res.ok) {
      // Kasta så att felet syns i loggarna; nattbygget fångar ändå upp ändringen
      throw new Error(`repository_dispatch misslyckades: ${res.status} ${await res.text()}`);
    }
    logger.info('Bygge begärt', { eventId: event.params.eventId });
  },
);
