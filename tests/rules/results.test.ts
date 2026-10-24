import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;
const USERS: Record<string, string[]> = { member: ['member'], setter: ['course_setter'], publisher: ['publisher'], board: ['board'], superadmin: ['superadmin'], plain: [] };

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-okeken', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env.cleanup());

const existing = () => ({
  name: 'Anna',
  course: 'Röd',
  memberUid: null,
  startAt: Timestamp.fromDate(new Date('2026-10-27T16:00:00Z')),
  finishAt: null,
  totalSeconds: null,
  youth: false,
  show: 'time',
  createdBy: 'setter',
  createdAt: Timestamp.now(),
  updatedBy: 'setter',
  updatedAt: Timestamp.now(),
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, permissions] of Object.entries(USERS)) await setDoc(doc(db, 'users', uid), { displayName: uid, email: `${uid}@example.com`, permissions });
    await setDoc(doc(db, 'events', 'ev1'), { title: 'Träning' });
    await setDoc(doc(db, 'events', 'ev1', 'results', 'r1'), existing());
    await setDoc(doc(db, 'eventResultsPublished', 'ev1'), { entries: [], publishedAt: Timestamp.now(), publishedBy: 'setter' });
  });
});

const entry = (uid: string, over: Record<string, unknown> = {}) => {
  const { createdBy: _c, createdAt: _a, updatedBy: _u, updatedAt: _t, ...rest } = existing();
  return { ...rest, createdBy: uid, createdAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp(), ...over };
};
const res = (uid: string, id = 'r1') => doc(env.authenticatedContext(uid).firestore(), 'events', 'ev1', 'results', id);
const ROLES = ['setter', 'publisher', 'board', 'superadmin'];

describe('resultatrader', () => {
  it('banläggare, publicerare, styrelse och superadmin läser, skapar, ändrar och raderar', async () => {
    for (const uid of ROLES) {
      await assertSucceeds(getDoc(res(uid)));
      await assertSucceeds(getDocs(collection(env.authenticatedContext(uid).firestore(), 'events', 'ev1', 'results')));
      await assertSucceeds(setDoc(res(uid, `n-${uid}`), entry(uid)));
      await assertSucceeds(updateDoc(res(uid, `n-${uid}`), { finishAt: Timestamp.fromDate(new Date('2026-10-27T16:40:00Z')), updatedBy: uid, updatedAt: serverTimestamp() }));
      await assertSucceeds(deleteDoc(res(uid, `n-${uid}`)));
    }
  });
  it('medlem, nyregistrerad och besökare når inget', async () => {
    for (const uid of ['member', 'plain']) {
      await assertFails(getDoc(res(uid)));
      await assertFails(setDoc(res(uid, 'x'), entry(uid)));
      await assertFails(deleteDoc(res(uid)));
    }
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'events', 'ev1', 'results', 'r1')));
  });
  it('alla tre visningslägen och total tid går', async () => {
    for (const show of ['time', 'participated', 'hidden']) await assertSucceeds(setDoc(res('setter', show), entry('setter', { show })));
    await assertSucceeds(setDoc(res('setter', 't'), entry('setter', { totalSeconds: 1500, youth: true, memberUid: 'abc123' })));
  });
  it('ogiltiga värden nekas', async () => {
    const bad: Record<string, unknown>[] = [
      { name: '' }, { name: 'x'.repeat(101) }, { course: 'x'.repeat(101) }, { show: 'visa' }, { youth: 'ja' }, { youth: null },
      { totalSeconds: -1 }, { totalSeconds: 86401 }, { totalSeconds: 12.5 }, { memberUid: 'a/b' }, { startAt: '10:00' },
    ];
    for (const [i, over] of bad.entries()) await assertFails(setDoc(res('setter', `bad${i}`), entry('setter', over)));
  });
  it('rader från självregistrering (rating, source) kan skapas och rättas av personalen; ogiltiga värden nekas', async () => {
    await assertSucceeds(setDoc(res('setter', 'self1'), entry('setter', { rating: 4, source: 'guest' })));
    await assertSucceeds(updateDoc(res('setter', 'self1'), { course: 'Blå', updatedBy: 'setter', updatedAt: serverTimestamp() }));
    for (const [i, over] of [{ rating: 0 }, { rating: 6 }, { rating: 3.5 }, { rating: 'bra' }, { source: 'bot' }].entries()) {
      await assertFails(setDoc(res('setter', `badself${i}`), entry('setter', over)));
    }
  });
  it('saknad eller extra nyckel nekas', async () => {
    const { youth: _y, ...noYouth } = entry('setter');
    await assertFails(setDoc(res('setter', 'a'), noYouth));
    await assertFails(setDoc(res('setter', 'b'), entry('setter', { extra: 1 })));
  });
  it('createdBy/updatedBy måste vara den inloggade och tider från servern', async () => {
    await assertFails(setDoc(res('setter', 'a'), entry('setter', { createdBy: 'publisher' })));
    await assertFails(setDoc(res('setter', 'b'), entry('setter', { updatedBy: 'publisher' })));
    await assertFails(setDoc(res('setter', 'c'), entry('setter', { createdAt: Timestamp.now() })));
  });
  it('skapandeuppgifter kan inte ändras', async () => {
    await assertFails(updateDoc(res('publisher'), { createdBy: 'publisher', updatedBy: 'publisher', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(res('publisher'), { createdAt: Timestamp.now(), updatedBy: 'publisher', updatedAt: serverTimestamp() }));
  });
});

describe('publicerad resultatlista', () => {
  it('läses av de som sköter resultat men skrivs aldrig från klienten', async () => {
    for (const uid of ROLES) {
      const d = doc(env.authenticatedContext(uid).firestore(), 'eventResultsPublished', 'ev1');
      await assertSucceeds(getDoc(d));
      await assertFails(setDoc(d, { entries: [] }));
      await assertFails(deleteDoc(d));
    }
    await assertFails(getDoc(doc(env.authenticatedContext('member').firestore(), 'eventResultsPublished', 'ev1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'eventResultsPublished', 'ev1')));
  });
});
