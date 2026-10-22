import type { Firestore } from 'firebase-admin/firestore';

// Publicering av resultat (beslut 0017). Rader i events/{id}/results är interna (inkl. `youth`, `memberUid`,
// pågående starter). Det som blir publikt är ett separat dokument, eventResultsPublished/{id}, som bara den här
// koden skriver. Fälten plockas ut ett och ett: `youth` och `memberUid` kan därför aldrig följa med.

export type ShowMode = 'time' | 'participated' | 'hidden';

export interface PublishedResultEntry {
  name: string;
  course: string;
  /** Total tid i sekunder, bara för rader som visas med tid */
  seconds: number | null;
}

type Millis = { toMillis(): number };
const isMillis = (v: unknown): v is Millis => typeof v === 'object' && v !== null && typeof (v as Millis).toMillis === 'function';

/** Sluttiden i sekunder: egen angiven total tid, annars måltid minus starttid. null om löparen inte är i mål. */
export function entrySeconds(row: { totalSeconds?: unknown; startAt?: unknown; finishAt?: unknown }): number | null {
  if (typeof row.totalSeconds === 'number' && Number.isInteger(row.totalSeconds) && row.totalSeconds >= 0) return row.totalSeconds;
  if (isMillis(row.startAt) && isMillis(row.finishAt)) {
    const s = Math.round((row.finishAt.toMillis() - row.startAt.toMillis()) / 1000);
    return s >= 0 ? s : null;
  }
  return null;
}

/**
 * De rader som visas publikt. "Visa tid" kräver en tid (annars är löparen inte i mål och utelämnas), "Visa bara
 * deltagit" visar namn och bana utan tid, "Dölj" tas inte med. Sorterat på bana, tid (snabbast först), namn.
 */
export function publicEntries(rows: FirebaseFirestore.DocumentData[]): PublishedResultEntry[] {
  const out: PublishedResultEntry[] = [];
  for (const r of rows) {
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name || r.show === 'hidden') continue;
    const course = typeof r.course === 'string' ? r.course.trim() : '';
    if (r.show === 'participated') out.push({ name, course, seconds: null });
    else if (r.show === 'time') {
      const seconds = entrySeconds(r);
      if (seconds !== null) out.push({ name, course, seconds });
    }
  }
  return out.sort(
    (a, b) =>
      a.course.localeCompare(b.course, 'sv') ||
      (a.seconds === null ? 1 : 0) - (b.seconds === null ? 1 : 0) ||
      (a.seconds ?? 0) - (b.seconds ?? 0) ||
      a.name.localeCompare(b.name, 'sv'),
  );
}

export async function publishResults(db: Firestore, eventId: string, uid: string, now = new Date()): Promise<number> {
  const rows = await db.collection(`events/${eventId}/results`).get();
  const entries = publicEntries(rows.docs.map((d) => d.data()));
  await db.doc(`eventResultsPublished/${eventId}`).set({ entries, publishedAt: now, publishedBy: uid });
  return entries.length;
}

export async function unpublishResults(db: Firestore, eventId: string): Promise<void> {
  await db.doc(`eventResultsPublished/${eventId}`).delete();
}
