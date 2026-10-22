import type { Firestore } from 'firebase-admin/firestore';

/** Namnet som sparas på ett svar: användarens visningsnamn, eller '' när användaren dolt det (beslut 0012). */
export function rsvpName(displayName: unknown, hideNameInRsvp: unknown): string {
  return hideNameInRsvp === true || typeof displayName !== 'string' ? '' : displayName;
}

/**
 * Sätter `name` på användarens alla svar på events, så att profilens val (visa/dölj namn) och namnbyten slår igenom
 * direkt och inte bara på nästa svar. Svar saknas på de flesta events; bara befintliga dokument uppdateras.
 */
export async function syncRsvpNames(uid: string, name: string, db: Firestore): Promise<number> {
  const slugs = await db.collection('rsvps').listDocuments();
  let updated = 0;
  for (let i = 0; i < slugs.length; i += 400) {
    const refs = slugs.slice(i, i + 400).map((slug) => slug.collection('responses').doc(uid));
    const snaps = await db.getAll(...refs);
    const batch = db.batch();
    for (const snap of snaps) {
      if (!snap.exists || snap.data()?.name === name) continue;
      batch.update(snap.ref, { name });
      updated++;
    }
    await batch.commit();
  }
  return updated;
}
