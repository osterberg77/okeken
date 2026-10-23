import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { publishResults } from './results.js';

/** Det raderingen behöver av Storage (strukturell typ så att den går att testa mot emulatorn). */
export interface FileBucket {
  file(name: string): { delete(options?: { ignoreNotFound?: boolean }): Promise<unknown> };
}

export interface Services {
  db: Firestore;
  auth: Auth;
  bucket: FileBucket;
}

/** Sista superadmin får inte radera sig själv: då kan ingen längre dela ut behörigheter. */
export class LastSuperadminError extends Error {}

/** Namnet som ersätter en raderad person i resultat (beslut 0018). Raden och placeringen finns kvar. */
export const DELETED_NAME = 'Borttagen';

/**
 * Raderar en användares uppgifter permanent (beslut 0013, 0018). Ordningen gör att ett avbrott kan köras om:
 * 1. svar på events (rsvps/*\/responses/<uid>), 2. resultatrader (namn blir "Borttagen", länken tas bort) och publicerade
 * resultatlistor byggs om, 3. "Publicerat av" på events rensas, 4. personens konversationer med alla meddelanden raderas (beslut 0019),
 * 5. profilbilden, 6. användardokumentet (namn, e-post, behörigheter, godkännande), 7. inloggningskontot sist. Det som medvetet blir kvar: uid i createdBy/updatedBy/uploadedBy och i
 * styrelseprotokoll (närvaro, att göra, sekreterare/justerare), med de namn som stod där när protokollet skrevs.
 * Utan användardokument och konto går ett uid inte att koppla till en person; protokoll är föreningens handlingar.
 */
export async function deleteAccountData(uid: string, { db, auth, bucket }: Services): Promise<void> {
  const user = await db.doc(`users/${uid}`).get();
  const permissions: unknown = user.data()?.permissions;
  if (Array.isArray(permissions) && permissions.includes('superadmin')) {
    const admins = await db.collection('users').where('permissions', 'array-contains', 'superadmin').get();
    if (admins.docs.every((d) => d.id === uid)) throw new LastSuperadminError();
  }

  // rsvps/{slug} är bara en sökväg (inga egna dokument), så slugarna listas med listDocuments
  const slugs = await db.collection('rsvps').listDocuments();
  for (let i = 0; i < slugs.length; i += 400) {
    const batch = db.batch();
    for (const slug of slugs.slice(i, i + 400)) batch.delete(slug.collection('responses').doc(uid));
    await batch.commit();
  }

  await anonymizeResults(uid, db);
  await clearPublisher(uid, db);
  await deleteConversations(uid, db);

  await bucket.file(`avatars/${uid}.jpg`).delete({ ignoreNotFound: true });
  await db.doc(`users/${uid}`).delete();
  try {
    await auth.deleteUser(uid);
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
  }
}

/**
 * Resultatrader (events/{id}/results) med personens memberUid får namnet "Borttagen" och förlorar länken. Publicerade
 * listor (eventResultsPublished) som innehåller personen byggs om av de interna raderna. Frågan görs per event, så
 * inget collection group-index behövs. Går att köra om: publicerade listor med memberUid hittas även om raderna redan
 * är omskrivna.
 */
async function anonymizeResults(uid: string, db: Firestore): Promise<void> {
  const events = await db.collection('events').listDocuments();
  for (const event of events) {
    const rows = await event.collection('results').where('memberUid', '==', uid).get();
    for (let i = 0; i < rows.docs.length; i += 400) {
      const batch = db.batch();
      for (const row of rows.docs.slice(i, i + 400)) batch.update(row.ref, { name: DELETED_NAME, memberUid: null });
      await batch.commit();
    }
    const published = await db.doc(`eventResultsPublished/${event.id}`).get();
    const entries: unknown = published.data()?.entries;
    const listed = Array.isArray(entries) && entries.some((e: { memberUid?: unknown }) => e?.memberUid === uid);
    if (published.exists && (rows.size > 0 || listed)) {
      await publishResults(db, event.id, String(published.data()?.publishedBy ?? ''));
    }
  }
}

/** "Publicerat av" pekar inte längre på en raderad person, varken i utkastet eller i det publicerade (startar ombyggnad) */
async function clearPublisher(uid: string, db: Firestore): Promise<void> {
  for (const field of ['publisher', 'published.publisher']) {
    const events = await db.collection('events').where(field, '==', uid).get();
    for (const e of events.docs) await e.ref.update({ [field]: null });
  }
}

/** Hela konversationer där personen deltar raderas, med alla meddelanden (motpartens också: de hör ihop). */
async function deleteConversations(uid: string, db: Firestore): Promise<void> {
  const convs = await db.collection('conversations').where('participants', 'array-contains', uid).get();
  for (const c of convs.docs) await db.recursiveDelete(c.ref);
}
