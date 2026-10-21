import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { syncEventor } from './eventor-sync.js';

initializeApp();
setGlobalOptions({ region: 'europe-north1', maxInstances: 3 });

const GITHUB_TOKEN = defineSecret('GITHUB_DISPATCH_TOKEN');
const EVENTOR_API_KEY = defineSecret('EVENTOR_API_KEY');
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

type Snapshot = { data(): FirebaseFirestore.DocumentData | undefined } | undefined;

/** Det besökarna ser av ett event/en sida: bara publicerade dokument syns */
function visibleContent(s: Snapshot) {
  const state = liveState(s?.data());
  return state?.status === 'published' ? state : null;
}

/** Det besökarna ser av menyn (menu/main): bara `published`. Utkastet (`items`) ska inte starta bygge */
function visibleMenu(s: Snapshot) {
  return s?.data()?.published ?? null;
}

/**
 * Startar bygget om det publicerade innehållet ändrats (publicera, ändra, avpublicera, radera).
 * Gemensam för events, infosidor och menyn. Sidornas slug och titel ingår i menyn (beslut 0008), så en sida
 * som publiceras eller avpubliceras startar bygget via onPageWritten och menyn byggs om med den.
 */
async function requestBuildIfChanged(before: unknown, after: unknown, payload: Record<string, string>) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;

  // Adminvyn jämför requestedAt med lastBuildAt för att visa "bygger" (gul) eller "fel" (röd)
  await getFirestore().doc('meta/build').set({ requestedAt: FieldValue.serverTimestamp() }, { merge: true });

  const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN.value()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ event_type: 'content-published', client_payload: payload }),
  });

  if (!res.ok) {
    // Kasta så att felet syns i loggarna; nattbygget fångar ändå upp ändringen
    throw new Error(`repository_dispatch misslyckades: ${res.status} ${await res.text()}`);
  }
  logger.info('Bygge begärt', payload);
}

export const onEventWritten = onDocumentWritten(
  { document: 'events/{eventId}', secrets: [GITHUB_TOKEN] },
  (event) =>
    requestBuildIfChanged(visibleContent(event.data?.before), visibleContent(event.data?.after), {
      eventId: event.params.eventId,
    }),
);

export const onPageWritten = onDocumentWritten(
  { document: 'pages/{pageId}', secrets: [GITHUB_TOKEN] },
  (event) =>
    requestBuildIfChanged(visibleContent(event.data?.before), visibleContent(event.data?.after), {
      pageId: event.params.pageId,
    }),
);

export const onMenuWritten = onDocumentWritten(
  { document: 'menu/{menuId}', secrets: [GITHUB_TOKEN] },
  (event) =>
    requestBuildIfChanged(visibleMenu(event.data?.before), visibleMenu(event.data?.after), {
      menuId: event.params.menuId,
    }),
);

/** Det besökarna ser av en Eventor-tävling: bara valda (och inte borttagna hos Eventor). Övriga fält påverkar inte sajten. */
function visibleEventor(s: Snapshot) {
  const d = s?.data();
  if (!d || d.selected !== true || d.gone === true) return null;
  return {
    name: d.name,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    allDay: d.allDay,
    organiserName: d.organiserName,
    url: d.url,
  };
}

export const onEventorEventWritten = onDocumentWritten(
  { document: 'eventorEvents/{eventId}', secrets: [GITHUB_TOKEN] },
  (event) =>
    requestBuildIfChanged(visibleEventor(event.data?.before), visibleEventor(event.data?.after), {
      eventorEventId: event.params.eventId,
    }),
);

/** "Hämta från Eventor": bara för publicerare, styrelse och superadmin. Nyckeln finns bara som hemlighet här. */
export const syncEventorNow = onCall({ secrets: [EVENTOR_API_KEY], timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Logga in.');
  const user = await getFirestore().doc(`users/${request.auth.uid}`).get();
  const permissions: string[] = user.data()?.permissions ?? [];
  if (!permissions.some((p) => ['publisher', 'board', 'superadmin'].includes(p))) {
    throw new HttpsError('permission-denied', 'Saknar behörighet.');
  }
  try {
    return await syncEventor(getFirestore(), EVENTOR_API_KEY.value());
  } catch (err) {
    logger.error('Eventor-hämtning misslyckades', err);
    throw new HttpsError('internal', 'Kunde inte hämta från Eventor.');
  }
});
