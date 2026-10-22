import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { RSVP_STATUSES, type RsvpResponse, type RsvpStatus } from '../../types/rsvp';
import { db } from './client';

/** Följer alla svar på ett event. Kräver minst en behörighet (se firestore.rules). */
export function watchRsvps(slug: string, callback: (responses: RsvpResponse[]) => void, onError: () => void): () => void {
  return onSnapshot(
    collection(db, 'rsvps', slug, 'responses'),
    (snap) =>
      callback(
        snap.docs
          .map((d) => ({ uid: d.id, status: d.data().status, name: typeof d.data().name === 'string' ? d.data().name : '' }))
          .filter((r): r is RsvpResponse => RSVP_STATUSES.includes(r.status)),
      ),
    onError,
  );
}

/** Sparar svaret. Namnet måste vara exakt visningsnamnet i users (reglerna kontrollerar det), eller tomt om det ska döljas. */
export async function setRsvp(slug: string, uid: string, status: RsvpStatus, hideName: boolean): Promise<void> {
  const name = hideName ? '' : String((await getDoc(doc(db, 'users', uid))).data()?.displayName ?? '');
  await setDoc(doc(db, 'rsvps', slug, 'responses', uid), { status, name, updatedAt: serverTimestamp() });
}

export async function clearRsvp(slug: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, 'rsvps', slug, 'responses', uid));
}

/** Styrelsen (som får läsa users) ser vem som dolt sitt namn. Misslyckade uppslag ger null. */
export async function lookupNames(uids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    uids.map(async (uid) => {
      try {
        const data = (await getDoc(doc(db, 'users', uid))).data();
        out[uid] = String(data?.displayName || data?.email || '');
      } catch {
        // Saknar behörighet eller dokumentet: namnet förblir dolt
      }
    }),
  );
  return out;
}
