import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { deleteAccountData, LastSuperadminError } from '../../functions/src/delete-account';

// Körs mot Auth-, Firestore- och Storage-emulatorerna (npm run test:rules sätter miljövariablerna).
const app = getApps()[0] ?? initializeApp({ projectId: 'demo-okeken', storageBucket: 'demo-okeken.appspot.com' });
const db = getFirestore(app);
const auth = getAuth(app);
const bucket = getStorage(app).bucket();
const services = { db, auth, bucket };

async function clear() {
  for (const col of ['users', 'rsvps', 'protocols', 'events', 'eventResultsPublished']) await db.recursiveDelete(db.collection(col));
  for (const u of (await auth.listUsers()).users) await auth.deleteUser(u.uid);
}

async function createUser(uid: string, permissions: string[]) {
  await auth.createUser({ uid, email: `${uid}@example.com` });
  await db.doc(`users/${uid}`).set({ displayName: uid, email: `${uid}@example.com`, permissions, createdAt: FieldValue.serverTimestamp() });
}

beforeEach(clear);
afterAll(clear);

describe('deleteAccountData', () => {
  it('removes the user doc, auth account, avatar and every RSVP of the user, and nobody else\'s', async () => {
    await createUser('anna', ['member']);
    await createUser('bo', ['member']);
    for (const slug of ['training-1', 'meeting-2', 'old-event']) {
      for (const uid of ['anna', 'bo']) {
        await db.doc(`rsvps/${slug}/responses/${uid}`).set({ status: 'yes', name: uid, updatedAt: FieldValue.serverTimestamp() });
      }
    }
    await bucket.file('avatars/anna.jpg').save(Buffer.from([255, 216, 255]), { contentType: 'image/jpeg' });
    await bucket.file('avatars/bo.jpg').save(Buffer.from([255, 216, 255]), { contentType: 'image/jpeg' });

    await deleteAccountData('anna', services);

    expect((await db.doc('users/anna').get()).exists).toBe(false);
    await expect(auth.getUser('anna')).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect((await bucket.file('avatars/anna.jpg').exists())[0]).toBe(false);
    for (const slug of ['training-1', 'meeting-2', 'old-event']) {
      expect((await db.doc(`rsvps/${slug}/responses/anna`).get()).exists).toBe(false);
      expect((await db.doc(`rsvps/${slug}/responses/bo`).get()).exists).toBe(true);
    }
    expect((await db.doc('users/bo').get()).exists).toBe(true);
    expect((await auth.getUser('bo')).uid).toBe('bo');
    expect((await bucket.file('avatars/bo.jpg').exists())[0]).toBe(true);
  });

  it('works without avatar, RSVPs or an auth account, and can be run again', async () => {
    await db.doc('users/ghost').set({ displayName: 'Ghost', email: 'g@example.com', permissions: [] });
    await deleteAccountData('ghost', services);
    await deleteAccountData('ghost', services);
    expect((await db.doc('users/ghost').get()).exists).toBe(false);
  });

  it('renames result rows to "Borttagen", rebuilds published lists and keeps the row', async () => {
    await createUser('anna', ['member']);
    await createUser('bo', ['member']);
    const t = (iso: string) => new Date(iso);
    const base = { course: 'Röd', youth: false, show: 'time', startAt: t('2026-10-27T16:00:00Z'), finishAt: t('2026-10-27T16:40:00Z'), totalSeconds: null };
    await db.doc('events/e1/results/a').set({ ...base, name: 'Anna Andersson', memberUid: 'anna' });
    await db.doc('events/e1/results/b').set({ ...base, name: 'Bo Berg', memberUid: 'bo', finishAt: t('2026-10-27T16:50:00Z') });
    await db.doc('events/e2/results/a').set({ ...base, name: 'Anna Andersson', memberUid: 'anna' });
    await db.doc('eventResultsPublished/e1').set({
      entries: [{ name: 'Anna Andersson', memberUid: 'anna', course: 'Röd', seconds: 2400 }],
      publishedBy: 'bo',
    });

    await deleteAccountData('anna', services);

    expect((await db.doc('events/e1/results/a').get()).data()).toMatchObject({ name: 'Borttagen', memberUid: null });
    expect((await db.doc('events/e2/results/a').get()).data()).toMatchObject({ name: 'Borttagen', memberUid: null });
    const published = (await db.doc('eventResultsPublished/e1').get()).data();
    expect(published?.publishedBy).toBe('bo');
    expect(published?.entries.map((e: { name: string }) => e.name)).toEqual(['Borttagen', 'Bo Berg']);
    expect(JSON.stringify(published)).not.toMatch(/Anna|"anna"/);
    // e2 var inte publicerat och ska förbli opublicerat
    expect((await db.doc('eventResultsPublished/e2').get()).exists).toBe(false);
  });

  it('clears "published by" in draft and published event content', async () => {
    await createUser('anna', ['publisher']);
    await createUser('bo', ['publisher']);
    await db.doc('events/e1').set({ status: 'published', publisher: 'anna', published: { title: 'A', publisher: 'anna' } });
    await db.doc('events/e2').set({ status: 'draft', publisher: 'bo' });
    await deleteAccountData('anna', services);
    expect((await db.doc('events/e1').get()).data()).toMatchObject({ publisher: null, published: { title: 'A', publisher: null } });
    expect((await db.doc('events/e2').get()).data()?.publisher).toBe('bo');
  });

  it('leaves protocols (association records) untouched', async () => {
    await createUser('anna', ['board']);
    await createUser('chair', ['board']);
    await db.doc('protocols/p1').set({
      attendees: [{ uid: 'anna', name: 'Anna Andersson' }],
      secretaryUid: 'anna',
      secretaryName: 'Anna Andersson',
      createdBy: 'anna',
    });
    await deleteAccountData('anna', services);
    const p = (await db.doc('protocols/p1').get()).data();
    expect(p?.attendees).toEqual([{ uid: 'anna', name: 'Anna Andersson' }]);
    expect(p?.createdBy).toBe('anna');
  });

  it('refuses to delete the last superadmin, but allows it when another exists', async () => {
    await createUser('root', ['superadmin']);
    await expect(deleteAccountData('root', services)).rejects.toBeInstanceOf(LastSuperadminError);
    expect((await db.doc('users/root').get()).exists).toBe(true);
    expect((await auth.getUser('root')).uid).toBe('root');

    await createUser('root2', ['superadmin']);
    await deleteAccountData('root', services);
    expect((await db.doc('users/root').get()).exists).toBe(false);
  });
});
