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
import { isReservedPageSlug, slugify } from '../slug';
import type { PageContent, PageRecord } from '../../types/page';
import { db } from './client';
import type { EventState } from './events';

const pages = collection(db, 'pages');

function contentToFirestore(c: PageContent) {
  return {
    title: c.title.trim(),
    body: c.body,
    inMenu: c.inMenu,
    menuOrder: c.menuOrder,
    menuLabel: c.menuLabel.trim(),
  };
}

function contentFromFirestore(d: DocumentData): PageContent {
  return {
    title: d.title ?? '',
    body: d.body ?? '',
    inMenu: d.inMenu === true,
    menuOrder: typeof d.menuOrder === 'number' ? d.menuOrder : 0,
    menuLabel: d.menuLabel ?? '',
  };
}

function recordFromFirestore(id: string, d: DocumentData): PageRecord {
  return {
    id,
    ...contentFromFirestore(d),
    status: d.status,
    slug: d.slug ?? null,
    published: d.published ? contentFromFirestore(d.published) : null,
    publishedAt: d.publishedAt ? (d.publishedAt as Timestamp).toDate() : null,
    updatedAt: d.updatedAt ? (d.updatedAt as Timestamp).toDate() : null,
  };
}

export function samePageContent(a: PageContent, b: PageContent): boolean {
  return JSON.stringify(contentToFirestore(a)) === JSON.stringify(contentToFirestore(b));
}

/** Samma lägen som för events, så StatusLabel/StatusBadge kan delas */
export function pageState(p: PageRecord, draft: PageContent = p): EventState {
  if (p.status === 'draft' || !p.published) return 'draft';
  if (p.status === 'unpublished') return 'unpublished';
  return samePageContent(draft, p.published) ? 'live' : 'changed';
}

export function watchPages(callback: (pages: PageRecord[]) => void, onError: () => void): () => void {
  return onSnapshot(
    query(pages, orderBy('title')),
    (snap) => callback(snap.docs.map((d) => recordFromFirestore(d.id, d.data()))),
    onError,
  );
}

export function watchPage(id: string, callback: (page: PageRecord | null) => void, onError: () => void): () => void {
  return onSnapshot(
    doc(pages, id),
    (snap) => callback(snap.exists() ? recordFromFirestore(snap.id, snap.data()) : null),
    onError,
  );
}

const stamp = (uid: string) => ({ updatedBy: uid, updatedAt: serverTimestamp() });

export async function createPage(content: PageContent, uid: string): Promise<string> {
  const ref = await addDoc(pages, {
    ...contentToFirestore(content),
    status: 'draft',
    slug: null,
    published: null,
    publishedAt: null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    ...stamp(uid),
  });
  return ref.id;
}

export async function savePage(id: string, content: PageContent, uid: string): Promise<void> {
  await updateDoc(doc(pages, id), { ...contentToFirestore(content), ...stamp(uid) });
}

/** Fel med ett meddelande som kan visas för användaren */
export class SlugError extends Error {}

/**
 * Adressen för en sida som publiceras första gången: titeln som slug. Reglerna kan inte garantera
 * unika adresser, så krock och reserverade adresser fångas här innan något skrivs.
 */
export async function checkNewSlug(id: string | null, title: string): Promise<string> {
  const slug = slugify(title);
  const problem = slugProblem(slug);
  if (problem) throw new SlugError(problem);
  const taken = await getDocs(query(pages, where('slug', '==', slug)));
  if (taken.docs.some((d) => d.id !== id)) {
    throw new SlugError(`Adressen /${slug} används redan av en annan sida. Ändra titeln så att den blir unik och försök igen.`);
  }
  return slug;
}

/** Synkron kontroll av vad titeln ger för adress (utan krockkontroll mot andra sidor) */
export function slugProblem(slug: string): string | null {
  if (!slug) return 'Titeln måste innehålla minst en bokstav eller siffra för att kunna bli en adress.';
  if (isReservedPageSlug(slug)) return `Adressen /${slug} är reserverad av sajten. Ändra titeln så att adressen blir en annan.`;
  return null;
}

/** Sparar utkastet och gör det till den publicerade versionen. Adressen sätts (och kontrolleras) första gången. */
export async function publishPage(id: string, slug: string | null, content: PageContent, uid: string): Promise<void> {
  const finalSlug = slug ?? (await checkNewSlug(id, content.title));
  const data = contentToFirestore(content);
  await updateDoc(doc(pages, id), {
    ...data,
    status: 'published',
    published: data,
    publishedAt: serverTimestamp(),
    slug: finalSlug,
    ...stamp(uid),
  });
}

export async function unpublishPage(id: string, uid: string): Promise<void> {
  await updateDoc(doc(pages, id), { status: 'unpublished', ...stamp(uid) });
}

/** Bara aldrig publicerade utkast (se firestore.rules) */
export async function deletePage(id: string): Promise<void> {
  await deleteDoc(doc(pages, id));
}
