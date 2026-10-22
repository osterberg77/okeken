import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { rsvpName, syncRsvpNames } from '../../functions/src/rsvp-names';

const app = getApps()[0] ?? initializeApp({ projectId: 'demo-okeken' });
const db = getFirestore(app);

const clear = () => db.recursiveDelete(db.collection('rsvps'));
beforeEach(clear);
afterAll(clear);

const answer = (name: string) => ({ status: 'yes', name, updatedAt: FieldValue.serverTimestamp() });

describe('rsvpName', () => {
  it('is the display name, or empty when hidden or missing', () => {
    expect(rsvpName('Anna', false)).toBe('Anna');
    expect(rsvpName('Anna', undefined)).toBe('Anna');
    expect(rsvpName('Anna', true)).toBe('');
    expect(rsvpName(undefined, false)).toBe('');
  });
});

describe('syncRsvpNames', () => {
  it('updates the user\'s answers on every event and leaves others and missing answers alone', async () => {
    await db.doc('rsvps/e1/responses/anna').set(answer('Anna'));
    await db.doc('rsvps/e2/responses/anna').set(answer('Anna'));
    await db.doc('rsvps/e1/responses/bo').set(answer('Bo'));
    await db.doc('rsvps/e3/responses/bo').set(answer('Bo'));

    expect(await syncRsvpNames('anna', '', db)).toBe(2);
    expect((await db.doc('rsvps/e1/responses/anna').get()).data()?.name).toBe('');
    expect((await db.doc('rsvps/e2/responses/anna').get()).data()?.name).toBe('');
    expect((await db.doc('rsvps/e1/responses/bo').get()).data()?.name).toBe('Bo');
    // Inget svar skapas där användaren inte svarat
    expect((await db.doc('rsvps/e3/responses/anna').get()).exists).toBe(false);

    expect(await syncRsvpNames('anna', 'Anna Andersson', db)).toBe(2);
    expect((await db.doc('rsvps/e2/responses/anna').get()).data()?.name).toBe('Anna Andersson');
    // Redan rätt namn: ingen skrivning
    expect(await syncRsvpNames('anna', 'Anna Andersson', db)).toBe(0);
  });

  it('keeps status and does nothing without answers', async () => {
    await db.doc('rsvps/e1/responses/anna').set({ ...answer('Anna'), status: 'maybe' });
    await syncRsvpNames('anna', '', db);
    expect((await db.doc('rsvps/e1/responses/anna').get()).data()?.status).toBe('maybe');
    expect(await syncRsvpNames('nobody', '', db)).toBe(0);
  });
});
