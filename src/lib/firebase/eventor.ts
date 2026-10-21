import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { DEFAULT_EVENTOR_SETTINGS, type EventorEvent, type EventorSettings } from '../../types/eventor';
import { app, db } from './client';

function fromFirestore(id: string, d: DocumentData): EventorEvent {
  return {
    id,
    name: d.name ?? '',
    startsAt: (d.startsAt as Timestamp).toDate(),
    endsAt: (d.endsAt as Timestamp).toDate(),
    allDay: d.allDay === true,
    organiserId: d.organiserId ?? null,
    organiserName: d.organiserName ?? '',
    classificationId: d.classificationId,
    disciplineId: d.disciplineId,
    statusId: d.statusId,
    form: d.form ?? '',
    url: d.url ?? '',
    webUrl: d.webUrl ?? '',
    suggested: d.suggested === true,
    gone: d.gone === true,
    selected: d.selected === true,
    selectedBy: d.selectedBy ?? null,
    selectedAt: d.selectedAt ? (d.selectedAt as Timestamp).toDate() : null,
    live: d.live === true,
    liveBy: d.liveBy ?? null,
    liveAt: d.liveAt ? (d.liveAt as Timestamp).toDate() : null,
    fetchedAt: (d.fetchedAt as Timestamp).toDate(),
  };
}

export function watchEventorEvents(onData: (events: EventorEvent[]) => void, onError: (err: Error) => void): () => void {
  return onSnapshot(
    query(collection(db, 'eventorEvents'), orderBy('startsAt')),
    (snap) => onData(snap.docs.map((d) => fromFirestore(d.id, d.data()))),
    onError,
  );
}

/** Kryssa i/ur (utkast). Syns i kalendern först när det publicerats. */
export function setEventorSelected(id: string, selected: boolean, uid: string): Promise<void> {
  return updateDoc(doc(db, 'eventorEvents', id), { selected, selectedBy: uid, selectedAt: serverTimestamp() });
}

/** Publicera: det som är kryssat blir det som visas i kalendern (startar ett bygge). */
export async function publishEventorSelection(events: EventorEvent[], uid: string): Promise<number> {
  const changed = events.filter((e) => e.live !== e.selected);
  for (let i = 0; i < changed.length; i += 400) {
    const batch = writeBatch(db);
    for (const e of changed.slice(i, i + 400)) {
      batch.update(doc(db, 'eventorEvents', e.id), { live: e.selected, liveBy: uid, liveAt: serverTimestamp() });
    }
    await batch.commit();
  }
  return changed.length;
}

export function watchEventorSettings(onData: (s: EventorSettings) => void, onError: (err: Error) => void): () => void {
  return onSnapshot(
    doc(db, 'settings', 'eventor'),
    (snap) => onData({ ...DEFAULT_EVENTOR_SETTINGS, ...(snap.exists() ? (snap.data() as Partial<EventorSettings>) : {}) }),
    onError,
  );
}

export function saveEventorSettings(s: EventorSettings, uid: string): Promise<void> {
  return setDoc(doc(db, 'settings', 'eventor'), { ...s, updatedBy: uid, updatedAt: serverTimestamp() });
}

export interface SyncResult {
  fetched: number;
  added: number;
  updated: number;
  removed: number;
  gone: number;
  suggested: number;
}

/** "Hämta från Eventor": körs i en Cloud Function som äger API-nyckeln. */
export async function syncEventorNow(): Promise<SyncResult> {
  const call = httpsCallable<void, SyncResult>(getFunctions(app, 'europe-north1'), 'syncEventorNow', { timeout: 120_000 });
  return (await call()).data;
}
