import { parseCoords } from '../geo';
import { DEFAULT_PLACE_ICON, isPlaceIcon, toExtraPlaces } from '../place-icons';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { eventSlug } from '../slug';
import { dayKey } from '../time';
import type { CourseFile, EventContent, EventRecord } from '../../types/event';
import { db } from './client';

const events = collection(db, 'events');

/** lat/lng skrivs bara när koordinaterna går att läsa (reglerna tillåter dem som valfria nycklar) */
function locationToFirestore(l: EventContent['location']) {
  const at = parseCoords(l.coords);
  const places = l.places.flatMap((p) => {
    const pt = parseCoords(p.coords);
    return pt ? [{ icon: p.icon, label: p.label.trim(), lat: pt.lat, lng: pt.lng }] : [];
  });
  return { name: l.name.trim(), mapUrl: l.mapUrl.trim(), icon: l.icon, places, ...(at ? { lat: at.lat, lng: at.lng } : {}) };
}

function contentToFirestore(c: EventContent) {
  return {
    type: c.type,
    title: c.title.trim(),
    startsAt: Timestamp.fromDate(c.startsAt),
    endsAt: Timestamp.fromDate(c.endsAt),
    location: locationToFirestore(c.location),
    body: c.body,
    courseSetter: c.courseSetter.trim(),
    livelox: c.livelox.trim(),
    courseFiles: c.courseFiles.map((f) => ({ name: f.name, storagePath: f.storagePath, label: f.label.trim() })),
    // Alltid med (null = ingen bild): reglerna kräver att published.image är exakt utkastets
    image: c.image
      ? { imageId: c.image.imageId, url: c.image.url, thumbnailUrl: c.image.thumbnailUrl, alt: c.image.alt.trim() }
      : null,
    // Alltid med (null = ingen), av samma skäl som image
    publisher: c.publisher,
    // Alltid med (false = av), så att published.rsvpEnabled är exakt utkastets
    rsvpEnabled: c.rsvpEnabled,
  };
}

function contentFromFirestore(d: DocumentData): EventContent {
  return {
    type: d.type,
    title: d.title ?? '',
    startsAt: (d.startsAt as Timestamp).toDate(),
    endsAt: (d.endsAt as Timestamp).toDate(),
    location: {
      name: d.location?.name ?? '',
      mapUrl: d.location?.mapUrl ?? '',
      coords: typeof d.location?.lat === 'number' && typeof d.location?.lng === 'number' ? `${d.location.lat}, ${d.location.lng}` : '',
      icon: isPlaceIcon(d.location?.icon) ? d.location.icon : DEFAULT_PLACE_ICON,
      places: toExtraPlaces(d.location?.places).map((p) => ({ icon: p.icon, label: p.label, coords: `${p.lat}, ${p.lng}` })),
    },
    body: d.body ?? '',
    courseSetter: d.courseSetter ?? '',
    livelox: d.livelox ?? '',
    courseFiles: Array.isArray(d.courseFiles) ? d.courseFiles : [],
    image: d.image ?? null,
    publisher: typeof d.publisher === 'string' ? d.publisher : null,
    rsvpEnabled: d.rsvpEnabled === true,
  };
}

function recordFromFirestore(id: string, d: DocumentData): EventRecord {
  return {
    id,
    ...contentFromFirestore(d),
    status: d.status,
    slug: d.slug ?? null,
    published: d.published ? contentFromFirestore(d.published) : null,
    publishedAt: d.publishedAt ? (d.publishedAt as Timestamp).toDate() : null,
    publishAt: d.publishAt ? (d.publishAt as Timestamp).toDate() : null,
    resultsEnabled: d.resultsEnabled === true,
    updatedAt: d.updatedAt ? (d.updatedAt as Timestamp).toDate() : null,
  };
}

export function sameContent(a: EventContent, b: EventContent): boolean {
  return JSON.stringify(contentToFirestore(a)) === JSON.stringify(contentToFirestore(b));
}

/** Läget som statusbadgen visar */
export type EventState = 'draft' | 'changed' | 'live' | 'unpublished' | 'scheduled';

export function eventState(e: EventRecord, draft: EventContent = e): EventState {
  if (e.status === 'draft' || !e.published) return 'draft';
  if (e.status === 'unpublished') return 'unpublished';
  return sameContent(draft, e.published) ? 'live' : 'changed';
}

/** Läget i listor och editor: en schemalagd publicering går före de andra lägena */
export function displayState(e: EventRecord, draft: EventContent = e): EventState {
  return e.publishAt ? 'scheduled' : eventState(e, draft);
}

export function watchEvents(callback: (events: EventRecord[]) => void, onError: () => void): () => void {
  return onSnapshot(
    query(events, orderBy('startsAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => recordFromFirestore(d.id, d.data()))),
    onError,
  );
}

export function watchEvent(id: string, callback: (event: EventRecord | null) => void, onError: () => void): () => void {
  return onSnapshot(
    doc(events, id),
    (snap) => callback(snap.exists() ? recordFromFirestore(snap.id, snap.data()) : null),
    onError,
  );
}

export interface BuildInfo {
  /** Starttid för senaste lyckade bygget */
  lastBuildAt: Date | null;
  /** När Function senast begärde ett bygge */
  requestedAt: Date | null;
}

/** Läser meta/build: lastBuildAt skrivs av Actions, requestedAt av Function vid publicering. */
export function watchBuild(callback: (info: BuildInfo) => void): () => void {
  const date = (v: unknown) => (v ? (v as Timestamp).toDate() : null);
  return onSnapshot(
    doc(db, 'meta', 'build'),
    (snap) => callback({ lastBuildAt: date(snap.get('lastBuildAt')), requestedAt: date(snap.get('requestedAt')) }),
    () => callback({ lastBuildAt: null, requestedAt: null }),
  );
}

const stamp = (uid: string) => ({ updatedBy: uid, updatedAt: serverTimestamp() });

export async function createEvent(content: EventContent, uid: string): Promise<string> {
  const ref = await addDoc(events, {
    ...contentToFirestore(content),
    // Träningar får resultatvyn förvald (kan stängas av i editorn)
    resultsEnabled: content.type === 'training',
    status: 'draft',
    slug: null,
    published: null,
    publishedAt: null,
    source: 'manual',
    createdBy: uid,
    createdAt: serverTimestamp(),
    ...stamp(uid),
  });
  return ref.id;
}

export async function saveEvent(id: string, content: EventContent, uid: string): Promise<void> {
  await updateDoc(doc(events, id), { ...contentToFirestore(content), ...stamp(uid) });
}

/** Ledig adress för ett event som publiceras första gången */
async function uniqueSlug(id: string, content: EventContent): Promise<string> {
  const base = eventSlug(dayKey(content.startsAt), content.title);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await getDocs(query(events, where('slug', '==', candidate)));
    if (taken.docs.every((d) => d.id === id)) return candidate;
  }
}

/** Sparar utkastet och gör det till den publicerade versionen. Adressen sätts första gången. */
export async function publishEvent(id: string, slug: string | null, content: EventContent, uid: string): Promise<void> {
  const data = contentToFirestore(content);
  await updateDoc(doc(events, id), {
    ...data,
    status: 'published',
    published: data,
    publishedAt: serverTimestamp(),
    // Publicera nu ersätter en schemalagd publicering
    publishAt: null,
    slug: slug ?? (await uniqueSlug(id, content)),
    ...stamp(uid),
  });
}

/**
 * Banläggarens sparning (beslut 0006, courseSetterUpdate i firestore.rules): bara courseFiles, och på
 * publicerade events samma lista i published.courseFiles. Allt annat skulle nekas av reglerna.
 */
export async function saveCourseFiles(id: string, status: EventRecord['status'], files: CourseFile[], uid: string): Promise<void> {
  const courseFiles = files.map((f) => ({ name: f.name, storagePath: f.storagePath, label: f.label.trim() }));
  await updateDoc(doc(events, id), {
    courseFiles,
    ...(status === 'published' ? { 'published.courseFiles': courseFiles } : {}),
    ...stamp(uid),
  });
}

export async function unpublishEvent(id: string, uid: string): Promise<void> {
  await updateDoc(doc(events, id), { status: 'unpublished', publishAt: null, ...stamp(uid) });
}

/** Bockrutan "Resultat på träningen" (beslut 0017): sparas direkt, ingår inte i utkast/publicering */
export async function setResultsEnabled(id: string, enabled: boolean, uid: string): Promise<void> {
  await updateDoc(doc(events, id), { resultsEnabled: enabled, ...stamp(uid) });
}

/** Schemalägger publicering av utkastet (eller avbryter med null). Själva publiceringen görs av Function `publishScheduled`. */
export async function scheduleEvent(id: string, at: Date | null, uid: string): Promise<void> {
  await updateDoc(doc(events, id), { publishAt: at ? Timestamp.fromDate(at) : null, ...stamp(uid) });
}

/** Bara aldrig publicerade utkast (se firestore.rules) */
export async function deleteDraft(id: string): Promise<void> {
  await deleteDoc(doc(events, id));
}
