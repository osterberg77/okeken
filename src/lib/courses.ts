// Ingen Firebase-import här: används av bygget, kalendern och adminpreview.
import type { CourseFile } from '../types/event';

const BUCKET = 'okeken.firebasestorage.app';

/** Publik nedladdningsadress (Storage-reglerna tillåter läsning av courses/ för alla). */
export function courseFileUrl(storagePath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

export const toPublicCourseFiles = (files: CourseFile[]) =>
  files.map((f) => ({ label: f.label.trim() || f.name, url: courseFileUrl(f.storagePath) }));
