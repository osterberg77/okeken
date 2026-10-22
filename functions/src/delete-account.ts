import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

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

/**
 * Raderar en användares uppgifter permanent (beslut 0013). Ordningen gör att ett avbrott kan köras om:
 * 1. svar på events (rsvps/*\/responses/<uid>), 2. profilbilden, 3. användardokumentet (namn, e-post, behörigheter,
 * godkännande), 4. inloggningskontot sist. Det som medvetet blir kvar: uid i createdBy/updatedBy/uploadedBy och i
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

  await bucket.file(`avatars/${uid}.jpg`).delete({ ignoreNotFound: true });
  await db.doc(`users/${uid}`).delete();
  try {
    await auth.deleteUser(uid);
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
  }
}
