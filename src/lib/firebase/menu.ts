import { doc, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc, type DocumentData } from 'firebase/firestore';
import type { MenuItem, MenuRecord } from '../../types/menu';
import { db } from './client';
import type { EventState } from './events';

const ref = doc(db, 'menu', 'main');

function itemsFromFirestore(raw: unknown): MenuItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => ({
    label: String(i?.label ?? ''),
    pageId: typeof i?.pageId === 'string' ? i.pageId : null,
    children: Array.isArray(i?.children) ? i.children.filter((c: unknown): c is string => typeof c === 'string') : [],
  }));
}

function recordFromFirestore(d: DocumentData): MenuRecord {
  return {
    items: itemsFromFirestore(d.items),
    published: d.published ? { items: itemsFromFirestore(d.published.items) } : null,
    publishedAt: d.publishedAt ? (d.publishedAt as Timestamp).toDate() : null,
    updatedBy: d.updatedBy ?? null,
    updatedAt: d.updatedAt ? (d.updatedAt as Timestamp).toDate() : null,
  };
}

/** null = dokumentet finns inte ännu (skapas vid första sparningen) */
export function watchMenu(callback: (menu: MenuRecord | null) => void, onError: () => void): () => void {
  return onSnapshot(ref, (snap) => callback(snap.exists() ? recordFromFirestore(snap.data()) : null), onError);
}

export const sameMenuItems = (a: MenuItem[], b: MenuItem[]) => JSON.stringify(a) === JSON.stringify(b);

/** Samma lägen som för events och sidor, så StatusLabel/StatusBadge kan delas. Menyn kan inte avpubliceras. */
export function menuState(published: MenuRecord['published'], draft: MenuItem[]): EventState {
  if (!published) return 'draft';
  return sameMenuItems(draft, published.items) ? 'live' : 'changed';
}

const stamp = (uid: string) => ({ updatedBy: uid, updatedAt: serverTimestamp() });
const plain = (items: MenuItem[]) => items.map(({ label, pageId, children }) => ({ label, pageId, children: [...children] }));

/** Sparar utkastet; skapar menu/main om det saknas */
export async function saveMenu(exists: boolean, items: MenuItem[], uid: string): Promise<void> {
  if (exists) await updateDoc(ref, { items: plain(items), ...stamp(uid) });
  else await setDoc(ref, { items: plain(items), published: null, publishedAt: null, ...stamp(uid) });
}

/** Sparar utkastet och gör det live i samma skrivning (reglerna kräver att published == { items }) */
export async function publishMenu(exists: boolean, items: MenuItem[], uid: string): Promise<void> {
  const data = { items: plain(items), published: { items: plain(items) }, publishedAt: serverTimestamp(), ...stamp(uid) };
  if (exists) await updateDoc(ref, data);
  else await setDoc(ref, data);
}
