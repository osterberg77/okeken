import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;
const USERS: Record<string, string[]> = { member: ['member'], setter: ['member'], publisher: ['publisher'], board: ['board'], superadmin: ['superadmin'], plain: [] };

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-okeken', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, permissions] of Object.entries(USERS)) await setDoc(doc(db, 'users', uid), { displayName: uid, email: `${uid}@example.com`, permissions });
    await setDoc(doc(db, 'members', 'member'), { displayName: 'member', publicName: true });
  });
});

describe('medlemslistan', () => {
  it('publicerare, styrelse och superadmin läser', async () => {
    for (const uid of ['publisher', 'board', 'superadmin']) {
      const db = env.authenticatedContext(uid).firestore();
      await assertSucceeds(getDocs(collection(db, 'members')));
      await assertSucceeds(getDoc(doc(db, 'members', 'member')));
    }
  });
  it('vanlig medlem, nyregistrerad och besökare läser inte', async () => {
    for (const uid of ['member', 'plain']) await assertFails(getDocs(collection(env.authenticatedContext(uid).firestore(), 'members')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'members')));
  });
  it('ingen skriver från klienten, inte ens superadmin', async () => {
    for (const uid of ['member', 'publisher', 'board', 'superadmin']) {
      const db = env.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(db, 'members', uid), { displayName: 'x', publicName: true }));
      await assertFails(setDoc(doc(db, 'members', 'member'), { displayName: 'x', publicName: true }));
      await assertFails(deleteDoc(doc(db, 'members', 'member')));
    }
  });
});
