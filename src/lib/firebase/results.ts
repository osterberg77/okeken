import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { SHOW_MODES, type ResultRow, type ShowMode } from '../../types/result';
import { app, db } from './client';

// Resultat på träningar (beslut 0017). Raderna är interna; det publika skapas av Function setResultsPublished.

const rowsOf = (eventId: string) => collection(db, 'events', eventId, 'results');

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

function fromFirestore(id: string, d: DocumentData): ResultRow {
  return {
    id,
    name: d.name ?? '',
    course: d.course ?? '',
    memberUid: typeof d.memberUid === 'string' ? d.memberUid : null,
    startAt: toDate(d.startAt),
    finishAt: toDate(d.finishAt),
    totalSeconds: typeof d.totalSeconds === 'number' ? d.totalSeconds : null,
    youth: d.youth === true,
    show: SHOW_MODES.includes(d.show) ? (d.show as ShowMode) : 'time',
    updatedAt: toDate(d.updatedAt),
  };
}

export function watchResults(eventId: string, callback: (rows: ResultRow[]) => void, onError: () => void): () => void {
  return onSnapshot(
    query(rowsOf(eventId), orderBy('createdAt', 'asc')),
    (snap) => callback(snap.docs.map((d) => fromFirestore(d.id, d.data()))),
    onError,
  );
}

export type NewResult = Pick<ResultRow, 'name' | 'course' | 'memberUid' | 'startAt' | 'youth' | 'show'>;

export async function addResult(eventId: string, r: NewResult, uid: string): Promise<void> {
  await addDoc(rowsOf(eventId), {
    name: r.name.trim(),
    course: r.course.trim(),
    memberUid: r.memberUid,
    startAt: r.startAt ? Timestamp.fromDate(r.startAt) : null,
    finishAt: null,
    totalSeconds: null,
    youth: r.youth,
    show: r.show,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}

export type ResultPatch = Partial<Pick<ResultRow, 'name' | 'course' | 'startAt' | 'finishAt' | 'totalSeconds' | 'youth' | 'show'>>;

export async function updateResult(eventId: string, id: string, patch: ResultPatch, uid: string): Promise<void> {
  const data: Record<string, unknown> = { updatedBy: uid, updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(patch)) {
    data[k] = v instanceof Date ? Timestamp.fromDate(v) : typeof v === 'string' ? v.trim() : v;
  }
  await updateDoc(doc(rowsOf(eventId), id), data);
}

export async function deleteResult(eventId: string, id: string): Promise<void> {
  await deleteDoc(doc(rowsOf(eventId), id));
}

export interface PublishedInfo {
  publishedAt: Date | null;
  count: number;
}

/** Status för den publicerade listan (null = inte publicerad) */
export function watchPublishedResults(eventId: string, callback: (info: PublishedInfo | null) => void): () => void {
  return onSnapshot(
    doc(db, 'eventResultsPublished', eventId),
    (snap) => {
      const d = snap.data();
      callback(snap.exists() && d ? { publishedAt: toDate(d.publishedAt), count: Array.isArray(d.entries) ? d.entries.length : 0 } : null);
    },
    () => callback(null),
  );
}

/** Publicerar (eller uppdaterar) respektive drar tillbaka den publika listan; byggs av en Cloud Function */
export async function setResultsPublished(eventId: string, published: boolean): Promise<number> {
  const call = httpsCallable<{ eventId: string; published: boolean }, { count: number }>(getFunctions(app, 'europe-north1'), 'setResultsPublished');
  return (await call({ eventId, published })).data.count;
}
