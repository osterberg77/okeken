import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, type DocumentData, type Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { MAP_FILE_EXTENSIONS, MAX_MAP_FILE_BYTES, mapTileUrl, type Course, type CoursePoint, type OMap } from '../../types/map';
import { auth, db } from './client';
import { storage } from './storage';

const BUCKET = 'okeken.firebasestorage.app';
const EMULATORS = import.meta.env.PUBLIC_FIREBASE_EMULATORS === 'true';

const date = (t: Timestamp | Date | null | undefined) => (t ? ('toDate' in t ? t.toDate() : t) : null);

function fromFirestore(id: string, d: DocumentData): OMap {
  const c = d.current;
  const j = d.job;
  return {
    id,
    name: d.name ?? id,
    current: c?.version
      ? {
          version: c.version,
          bounds: c.bounds,
          minZoom: c.minZoom,
          maxZoom: c.maxZoom,
          scale: c.scale,
          sourceName: c.sourceName ?? '',
          // Versioner byggda före sourcePath fanns: jobbets sökväg gäller om jobbet byggde just den filen
          sourcePath: c.sourcePath ?? (j?.status === 'done' && j.sourceName === c.sourceName ? (j.sourcePath ?? null) : null),
          builtAt: date(c.builtAt),
        }
      : null,
    job: j?.status
      ? { status: j.status, sourceName: j.sourceName ?? '', queuedAt: date(j.queuedAt), finishedAt: date(j.finishedAt), error: j.error }
      : null,
  };
}

export function watchMaps(onChange: (maps: OMap[]) => void, onError: () => void): () => void {
  return onSnapshot(
    query(collection(db, 'maps'), orderBy('name')),
    (snap) => onChange(snap.docs.map((d) => fromFirestore(d.id, d.data()))),
    onError,
  );
}

export async function createMap(id: string, name: string): Promise<void> {
  const uid = auth.currentUser!.uid;
  await setDoc(doc(db, 'maps', id), { name, createdBy: uid, createdAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp() });
}

export async function renameMap(id: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'maps', id), { name, updatedBy: auth.currentUser!.uid, updatedAt: serverTimestamp() });
}

export class MapFileRejected extends Error {}

/** Laddar upp en ny originalfil. Uppladdningen startar konverteringen (Function onMapSourceUploaded). */
export function uploadMapSource(mapId: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(MAP_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
    return Promise.reject(new MapFileRejected('Välj en .omap- eller .ocd-fil från OpenOrienteering Mapper eller OCAD.'));
  }
  if (file.size === 0 || file.size > MAX_MAP_FILE_BYTES) {
    return Promise.reject(new MapFileRejected('Filen får vara högst 100 MB.'));
  }
  const base = file.name.slice(0, -(ext.length + 1)).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[^A-Za-z0-9]+/, '').slice(0, 90) || 'karta';
  const path = `map_sources/${mapId}/${Date.now()}-${base}.${ext}`;
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: 'application/octet-stream',
      // Nedladdningen får det ursprungliga filnamnet i stället för hela sökvägen
      contentDisposition: `attachment; filename="${base}.${ext}"`,
    });
    task.on('state_changed', (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve());
  });
}

export function tileUrl(map: OMap): string | null {
  if (!map.current) return null;
  return mapTileUrl(BUCKET, map.id, map.current.version, EMULATORS ? 'http://127.0.0.1:9199' : undefined);
}

/** Adress till originalfilen (.omap/.ocd) för nedladdning, eller null om versionen saknar sökväg. */
export async function sourceDownloadUrl(map: OMap): Promise<string | null> {
  const path = map.current?.sourcePath;
  return path ? getDownloadURL(ref(storage, path)) : null;
}

// ---- Egna träningsbanor (beslut 0026) ----

const coursesOf = () => collection(db, 'users', auth.currentUser!.uid, 'courses');

export function watchCourses(onChange: (courses: Course[]) => void, onError: () => void): () => void {
  return onSnapshot(
    query(coursesOf(), orderBy('updatedAt', 'desc')),
    (snap) =>
      onChange(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            name: x.name ?? '',
            mapId: x.mapId ?? '',
            points: Array.isArray(x.points) ? x.points.map((p: CoursePoint) => ({ lat: p.lat, lng: p.lng })) : [],
            scale: x.scale ?? 10000,
            updatedAt: date(x.updatedAt),
          };
        }),
      ),
    onError,
  );
}

type CourseInput = Pick<Course, 'name' | 'mapId' | 'points' | 'scale'>;

/** Sparar banan: ny om `id` saknas, annars skrivs den befintliga över. Returnerar id. */
export async function saveCourse(id: string | null, course: CourseInput): Promise<string> {
  const data = {
    name: course.name,
    mapId: course.mapId,
    points: course.points.map((p) => ({ lat: Math.round(p.lat * 1e7) / 1e7, lng: Math.round(p.lng * 1e7) / 1e7 })),
    scale: Math.round(course.scale),
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(coursesOf(), id), data);
    return id;
  }
  return (await addDoc(coursesOf(), { ...data, createdAt: serverTimestamp() })).id;
}

export async function deleteCourse(id: string): Promise<void> {
  await deleteDoc(doc(coursesOf(), id));
}
