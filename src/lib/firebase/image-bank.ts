import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, type DocumentData,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ImageRejected, prepareImage } from '../image-resize';
import {
  IMAGE_EXTENSIONS, imageStoragePath,
  type ImageBankDraft, type ImageBankItem, type ImageBankMeta, type ImageBankStoragePaths, type ImageVariant,
} from '../../types/image';
import { auth, db } from './client';
import { storage } from './storage';

const images = collection(db, 'imageBank');
const BUCKET = 'okeken.firebasestorage.app';
const VARIANTS: ImageVariant[] = ['original', 'web', 'thumbnail'];

export const EMULATORS = import.meta.env.PUBLIC_FIREBASE_EMULATORS === 'true';

/**
 * firestore.rules kräver bucketens kanoniska adress. Emulatorn ger http://127.0.0.1:9199/…, så adressen byggs
 * av sökväg + token (token är det enda som skiljer filer åt) i stället för att lagra det getDownloadURL gav.
 */
function canonicalUrl(path: string, downloadUrl: string): string {
  const token = new URL(downloadUrl).searchParams.get('token');
  if (!token) throw new Error('Nedladdningsadressen saknar token.');
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

/** I emulatorläge finns filerna lokalt, inte i produktion: byt värd bara för visning. Lagrad adress rörs inte. */
export function displayUrl(url: string): string {
  return EMULATORS ? url.replace('https://firebasestorage.googleapis.com/', 'http://127.0.0.1:9199/') : url;
}

function fromFirestore(id: string, d: DocumentData): ImageBankItem {
  return {
    id,
    name: d.name ?? '',
    byline: d.byline ?? '',
    description: d.description ?? '',
    url: d.url,
    webUrl: d.webUrl,
    thumbnailUrl: d.thumbnailUrl,
    storagePaths: d.storagePaths,
    size: d.size ?? 0,
    type: d.type,
    uploadedBy: d.uploadedBy ?? '',
    createdAt: d.createdAt?.toDate?.() ?? null,
  };
}

export function watchImages(callback: (items: ImageBankItem[]) => void, onError: () => void): () => void {
  return onSnapshot(
    query(images, orderBy('createdAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => fromFirestore(d.id, d.data({ serverTimestamps: 'estimate' })))),
    onError,
  );
}

export type UploadStep = 'Skalar bilden' | 'Laddar upp' | 'Sparar';

/**
 * Skalar och laddar upp en bild. Ordningen styrs av reglerna: filerna först (går bara medan posten saknas),
 * sedan Firestore-posten. Misslyckas något steg raderas redan uppladdade filer (tillåtet så länge posten saknas).
 */
export async function uploadImage(file: File, onStep: (step: UploadStep) => void): Promise<ImageBankItem> {
  const user = auth.currentUser;
  if (!user) throw new Error('Du är inte inloggad.');

  onStep('Skalar bilden');
  const prepared = await prepareImage(file);
  const ext = IMAGE_EXTENSIONS[prepared.type];

  const docRef = doc(images);
  const id = docRef.id;
  const paths = Object.fromEntries(VARIANTS.map((v) => [v, imageStoragePath(id, v, ext)])) as unknown as ImageBankStoragePaths;
  const uploaded: string[] = [];

  try {
    onStep('Laddar upp');
    const urls = {} as Record<ImageVariant, string>;
    await Promise.all(
      VARIANTS.map(async (v) => {
        const r = ref(storage, paths[v]);
        // Unika filnamn som aldrig skrivs över: webbläsare och CDN får cacha länge
        await uploadBytes(r, prepared[v], { contentType: prepared.type, cacheControl: 'public, max-age=31536000, immutable' });
        uploaded.push(paths[v]);
        urls[v] = canonicalUrl(paths[v], await getDownloadURL(r));
      }),
    );

    onStep('Sparar');
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 200) || 'Bild';
    const draft: ImageBankDraft = {
      name, byline: '', description: '',
      url: urls.original, webUrl: urls.web, thumbnailUrl: urls.thumbnail,
      storagePaths: paths, size: prepared.size, type: prepared.type,
    };
    await setDoc(docRef, { ...draft, uploadedBy: user.uid, createdAt: serverTimestamp() });
    return { ...draft, id, uploadedBy: user.uid, createdAt: new Date() };
  } catch (e) {
    // Posten finns inte, så reglerna tillåter att filerna tas bort igen
    await Promise.allSettled(uploaded.map((p) => deleteObject(ref(storage, p))));
    throw e;
  }
}

export function updateImageMeta(id: string, meta: ImageBankMeta): Promise<void> {
  return updateDoc(doc(images, id), {
    name: meta.name.trim(),
    byline: meta.byline.trim(),
    description: meta.description.trim(),
  });
}

/** Posten först, sedan filerna (storage.rules tillåter bara radering av filer utan post) */
export async function deleteImage(item: ImageBankItem): Promise<void> {
  await deleteDoc(doc(images, item.id));
  const results = await Promise.allSettled(
    VARIANTS.map(async (v) => {
      try {
        await deleteObject(ref(storage, item.storagePaths[v]));
      } catch (e) {
        if ((e as { code?: string }).code !== 'storage/object-not-found') throw e;
      }
    }),
  );
  if (results.some((r) => r.status === 'rejected')) {
    throw new Error('Bilden är borttagen men några filer kunde inte raderas. Be en administratör städa i konsolen.');
  }
}

/** Felmeddelande på svenska för uppladdningsfel */
export function uploadErrorMessage(e: unknown): string {
  if (e instanceof ImageRejected) return e.message;
  const code = (e as { code?: string }).code ?? '';
  if (code.includes('unauthorized') || code.includes('permission-denied')) return 'Du har inte behörighet att ladda upp bilder.';
  if (code.includes('retry-limit') || code.includes('network') || code.includes('unavailable')) return 'Uppkopplingen föll bort. Försök igen.';
  return 'Uppladdningen misslyckades. Försök igen.';
}
