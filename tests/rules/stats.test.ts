import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;
const USERS: Record<string, string[]> = { member: ['member'], setter: ['member'], publisher: ['publisher'], board: ['board'], superadmin: ['superadmin'] };

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-okeken', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, permissions] of Object.entries(USERS)) await setDoc(doc(db, 'users', uid), { displayName: uid, email: `${uid}@example.com`, permissions });
    await setDoc(doc(db, 'statsPages', '2026-10-22__%2Fom-klubben'), { date: '2026-10-22', path: '/om-klubben', views: 3, unique: 2 });
    await setDoc(doc(db, 'statsDownloads', '2026-10-22__x'), { date: '2026-10-22', path: '/event/a', file: 'bana.pdf', count: 1 });
    await setDoc(doc(db, 'statsSeen', '2026-10-22__abc'), { expireAt: new Date() });
  });
});

describe('besöksstatistik', () => {
  for (const col of ['statsPages', 'statsDownloads']) {
    it(`${col}: publicerare, styrelse och superadmin läser`, async () => {
      for (const uid of ['publisher', 'board', 'superadmin']) {
        await assertSucceeds(getDocs(query(collection(env.authenticatedContext(uid).firestore(), col), where('date', '>=', '2026-10-01'))));
      }
    });
    it(`${col}: medlem, banläggare och besökare läser inte`, async () => {
      for (const uid of ['member', 'setter']) {
        await assertFails(getDocs(query(collection(env.authenticatedContext(uid).firestore(), col), where('date', '>=', '2026-10-01'))));
      }
      await assertFails(getDocs(query(collection(env.unauthenticatedContext().firestore(), col), where('date', '>=', '2026-10-01'))));
    });
    it(`${col}: ingen skriver från klienten, inte ens superadmin`, async () => {
      for (const uid of ['publisher', 'board', 'superadmin']) {
        await assertFails(setDoc(doc(env.authenticatedContext(uid).firestore(), col, 'ny'), { date: '2026-10-22' }));
      }
      await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), col, 'ny'), { date: '2026-10-22' }));
    });
  }
  it('statsSeen: varken läsning eller skrivning från klienten', async () => {
    const db = env.authenticatedContext('superadmin').firestore();
    await assertFails(getDoc(doc(db, 'statsSeen', '2026-10-22__abc')));
    await assertFails(setDoc(doc(db, 'statsSeen', 'ny'), { expireAt: new Date() }));
  });
});
