import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

// 'plain' har konto men inga behörigheter än (nyregistrerad)
const USERS: Record<string, string[]> = {
  member: ['member'],
  member2: ['member'],
  publisher: ['publisher'],
  board: ['board'],
  plain: [],
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-okeken',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, permissions] of Object.entries(USERS)) {
      await setDoc(doc(db, 'users', uid), {
        displayName: `Namn ${uid}`,
        email: `${uid}@example.com`,
        permissions,
        createdAt: Timestamp.now(),
      });
    }
    await setDoc(doc(db, 'rsvps', 'tisdagstraning', 'responses', 'member2'), {
      status: 'yes',
      name: 'Namn member2',
      updatedAt: Timestamp.now(),
    });
  });
});

const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ref = (db: ReturnType<typeof as>, uid: string, slug = 'tisdagstraning') => doc(db, 'rsvps', slug, 'responses', uid);
const answer = (extra = {}) => ({ status: 'yes', name: 'Namn member', updatedAt: serverTimestamp(), ...extra });

describe('rsvps: read', () => {
  it('members and above may read answers and list them', async () => {
    for (const uid of ['member', 'publisher', 'board']) {
      await assertSucceeds(getDoc(ref(as(uid), 'member2')));
      await assertSucceeds(getDocs(collection(as(uid), 'rsvps', 'tisdagstraning', 'responses')));
    }
  });
  it('denies visitors and accounts without any permission', async () => {
    await assertFails(getDoc(ref(anon(), 'member2')));
    await assertFails(getDocs(collection(anon(), 'rsvps', 'tisdagstraning', 'responses')));
    await assertFails(getDocs(collection(as('plain'), 'rsvps', 'tisdagstraning', 'responses')));
  });
});

describe('rsvps: write own answer', () => {
  it('may answer yes, maybe and no', async () => {
    for (const status of ['yes', 'maybe', 'no']) {
      await assertSucceeds(setDoc(ref(as('member'), 'member'), answer({ status })));
    }
  });
  it('may hide the name with an empty string', async () => {
    await assertSucceeds(setDoc(ref(as('member'), 'member'), answer({ name: '' })));
  });
  it('denies visitors and accounts without permission', async () => {
    await assertFails(setDoc(ref(anon(), 'member'), answer()));
    await assertFails(setDoc(ref(as('plain'), 'plain'), answer({ name: 'Namn plain' })));
  });
  it('denies answering for someone else', async () => {
    await assertFails(setDoc(ref(as('member'), 'member2'), answer()));
    await assertFails(setDoc(ref(as('board'), 'member2'), answer()));
  });
  it('denies a name that is not the user\'s own', async () => {
    await assertFails(setDoc(ref(as('member'), 'member'), answer({ name: 'Någon annan' })));
  });
  it('denies bad status, extra keys, missing keys and client timestamps', async () => {
    await assertFails(setDoc(ref(as('member'), 'member'), answer({ status: 'sure' })));
    await assertFails(setDoc(ref(as('member'), 'member'), answer({ extra: 1 })));
    await assertFails(setDoc(ref(as('member'), 'member'), { status: 'yes', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(ref(as('member'), 'member'), answer({ updatedAt: Timestamp.fromMillis(0) })));
  });
  it('denies slugs that are not valid event addresses', async () => {
    await assertFails(setDoc(ref(as('member'), 'member', 'Not A Slug'), answer()));
  });
  it('may change an existing answer', async () => {
    await assertSucceeds(setDoc(ref(as('member'), 'member'), answer()));
    await assertSucceeds(updateDoc(ref(as('member'), 'member'), { status: 'no', updatedAt: serverTimestamp() }));
  });
});

describe('rsvps: delete', () => {
  it('may remove own answer only', async () => {
    await assertSucceeds(deleteDoc(ref(as('member2'), 'member2')));
    await assertFails(deleteDoc(ref(as('member'), 'member2')));
  });
  it('board cannot remove someone else\'s answer', async () => {
    await assertFails(deleteDoc(ref(as('board'), 'member2')));
  });
});
