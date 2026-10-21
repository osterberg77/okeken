import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import type { CourseFile } from '../../types/event';
import { storage } from './storage';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Filnamn som passar storage.rules: ASCII, inga mellanslag */
function safeName(name: string): string {
  const base = name
    .replace(/\.pdf$/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'bana';
}

/** Laddar upp en PDF till courses/<eventId>/. Slumpat prefix: filer skrivs aldrig över och adressen går inte att gissa. */
export async function uploadCourseFile(eventId: string, file: File): Promise<CourseFile> {
  const storagePath = `courses/${eventId}/${crypto.randomUUID()}-${safeName(file.name)}.pdf`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: 'application/pdf' });
  return { name: file.name, storagePath, label: file.name.replace(/\.pdf$/i, '') };
}

/** Raderar filer ur Storage. Misslyckas en radering (t.ex. redan borta) ignoreras den: eventet är redan sparat utan filen. */
export async function deleteCourseFiles(storagePaths: string[]): Promise<void> {
  const results = await Promise.allSettled(storagePaths.map((p) => deleteObject(ref(storage, p))));
  results.forEach((r, i) => r.status === 'rejected' && console.warn('Kunde inte radera', storagePaths[i], r.reason));
}
