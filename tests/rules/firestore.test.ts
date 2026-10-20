import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const USERS: Record<string, string[]> = {
  super: ['superadmin'],
  super2: ['superadmin'],
  board: ['board'],
  board2: ['board'],
  publisher: ['publisher'],
  member: ['member'],
  target: ['member'],
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
        displayName: uid,
        email: `${uid}@example.com`,
        permissions,
        createdAt: Timestamp.now(),
      });
    }
    await setDoc(doc(db, 'other', 'x'), { title: 'x' });
  });
});

const as = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

/** Skriv permissions på users/{target}; seedar först om utgångsläget ska vara annat. */
async function setPerms(target: string, perms: string[]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', target), { permissions: perms }, { merge: true });
  });
}
const updatePerms = (actor: string, target: string, perms: unknown) =>
  updateDoc(doc(as(actor), 'users', target), { permissions: perms });

describe('users: create', () => {
  const valid = (email = 'new@example.com') => ({
    displayName: 'Ny',
    email,
    permissions: [],
    createdAt: serverTimestamp(),
  });
  const newUser = (emailVerified = true) =>
    env.authenticatedContext('new', { email: 'new@example.com', email_verified: emailVerified }).firestore();

  it('allows own doc with empty permissions', async () => {
    await assertSucceeds(setDoc(doc(newUser(), 'users', 'new'), valid()));
  });
  it('denies unverified email (password account before confirmation)', async () => {
    await assertFails(setDoc(doc(newUser(false), 'users', 'new'), valid()));
  });
  it('denies non-empty permissions', async () => {
    await assertFails(
      setDoc(doc(newUser(), 'users', 'new'), { ...valid(), permissions: ['member'] }),
    );
    await assertFails(
      setDoc(doc(newUser(), 'users', 'new'), { ...valid(), permissions: ['superadmin'] }),
    );
  });
  it('denies wrong email', async () => {
    await assertFails(setDoc(doc(newUser(), 'users', 'new'), valid('other@example.com')));
  });
  it('denies extra keys', async () => {
    await assertFails(setDoc(doc(newUser(), 'users', 'new'), { ...valid(), admin: true }));
  });
  it("denies someone else's uid", async () => {
    await assertFails(setDoc(doc(newUser(), 'users', 'someone-else'), valid()));
  });
  it('denies non-serverTimestamp createdAt', async () => {
    await assertFails(
      setDoc(doc(newUser(), 'users', 'new'), { ...valid(), createdAt: Timestamp.fromMillis(0) }),
    );
  });
  it('denies unauthenticated create', async () => {
    await assertFails(setDoc(doc(anon(), 'users', 'new'), valid()));
  });
});

describe('users: read', () => {
  it('own doc is readable', async () => {
    await assertSucceeds(getDoc(doc(as('member'), 'users', 'member')));
    await assertSucceeds(getDoc(doc(as('publisher'), 'users', 'publisher')));
  });
  it("member and publisher cannot read others' docs", async () => {
    await assertFails(getDoc(doc(as('member'), 'users', 'target')));
    await assertFails(getDoc(doc(as('publisher'), 'users', 'target')));
  });
  it('board and superadmin can read others', async () => {
    await assertSucceeds(getDoc(doc(as('board'), 'users', 'target')));
    await assertSucceeds(getDoc(doc(as('super'), 'users', 'target')));
  });
  it('list allowed for board/superadmin, denied for member/publisher', async () => {
    await assertSucceeds(getDocs(collection(as('board'), 'users')));
    await assertSucceeds(getDocs(collection(as('super'), 'users')));
    await assertFails(getDocs(collection(as('member'), 'users')));
    await assertFails(getDocs(collection(as('publisher'), 'users')));
  });
  it('unauthenticated denied', async () => {
    await assertFails(getDoc(doc(anon(), 'users', 'member')));
    await assertFails(getDocs(collection(anon(), 'users')));
  });
  it('signed-in user without a users doc cannot read others', async () => {
    const db = env.authenticatedContext('ghost', { email: 'g@example.com' }).firestore();
    await assertFails(getDoc(doc(db, 'users', 'target')));
  });
});

describe('users: self update', () => {
  it('may change displayName', async () => {
    await assertSucceeds(updateDoc(doc(as('member'), 'users', 'member'), { displayName: 'Nytt' }));
  });
  it('denies too long or non-string displayName', async () => {
    await assertFails(
      updateDoc(doc(as('member'), 'users', 'member'), { displayName: 'x'.repeat(101) }),
    );
    await assertFails(updateDoc(doc(as('member'), 'users', 'member'), { displayName: 5 }));
  });
  it('member cannot add own permissions', async () => {
    await assertFails(updatePerms('member', 'member', ['member', 'publisher']));
    await assertFails(updatePerms('member', 'member', ['superadmin']));
  });
  it('publisher cannot add board to self', async () => {
    await assertFails(updatePerms('publisher', 'publisher', ['publisher', 'board']));
  });
  it('cannot change displayName and permissions together', async () => {
    await assertFails(
      updateDoc(doc(as('member'), 'users', 'member'), {
        displayName: 'a',
        permissions: ['member', 'publisher'],
      }),
    );
  });
  it('cannot change email', async () => {
    await assertFails(
      updateDoc(doc(as('member'), 'users', 'member'), { email: 'x@example.com' }),
    );
  });
});

describe('users: superadmin', () => {
  it('can add and remove any permission on others', async () => {
    for (const p of ['member', 'course_setter', 'publisher', 'board', 'superadmin']) {
      await assertSucceeds(updatePerms('super', 'target', ['member', p].filter((v, i, a) => a.indexOf(v) === i)));
    }
    await assertSucceeds(updatePerms('super', 'target', []));
  });
  it('can remove board from another user', async () => {
    await setPerms('target', ['board']);
    await assertSucceeds(updatePerms('super', 'target', []));
  });
  it("can remove another superadmin's superadmin", async () => {
    await assertSucceeds(updatePerms('super', 'super2', ['member']));
  });
  it('can grant superadmin to others', async () => {
    await assertSucceeds(updatePerms('super', 'target', ['member', 'superadmin']));
  });
  it('cannot remove own superadmin', async () => {
    await assertFails(updatePerms('super', 'super', []));
    await assertFails(updatePerms('super', 'super', ['member']));
  });
  it('can modify own other permissions while keeping superadmin', async () => {
    await assertSucceeds(updatePerms('super', 'super', ['superadmin', 'publisher']));
  });
  it('denies unknown permission', async () => {
    await assertFails(updatePerms('super', 'target', ['member', 'god']));
  });
  it('denies duplicates', async () => {
    await assertFails(updatePerms('super', 'target', ['member', 'member']));
  });
  it('denies non-list permissions', async () => {
    await assertFails(updatePerms('super', 'target', 'superadmin'));
    await assertFails(updatePerms('super', 'target', { 0: 'member' }));
    await assertFails(updatePerms('super', 'target', null));
  });
  it('cannot change email or other fields', async () => {
    await assertFails(updateDoc(doc(as('super'), 'users', 'target'), { email: 'x@example.com' }));
    await assertFails(
      updateDoc(doc(as('super'), 'users', 'target'), { permissions: ['member', 'publisher'], email: 'x@example.com' }),
    );
    await assertFails(updateDoc(doc(as('super'), 'users', 'target'), { displayName: 'Hacked' }));
    await assertFails(updateDoc(doc(as('super'), 'users', 'target'), { extra: 1 }));
  });
});

describe('users: board', () => {
  it.each(['member', 'course_setter', 'publisher'])('can add and remove %s on others', async (p) => {
    await setPerms('target', []);
    await assertSucceeds(updatePerms('board', 'target', [p]));
    await assertSucceeds(updatePerms('board', 'target', []));
  });
  it('cannot add board', async () => {
    await assertFails(updatePerms('board', 'target', ['member', 'board']));
  });
  it('cannot add superadmin', async () => {
    await assertFails(updatePerms('board', 'target', ['member', 'superadmin']));
  });
  it('cannot remove superadmin from someone', async () => {
    await assertFails(updatePerms('board', 'super', []));
  });
  it('cannot remove board from someone', async () => {
    await assertFails(updatePerms('board', 'board2', []));
  });
  it('can modify a user who already has board when only assignable roles change', async () => {
    await assertSucceeds(updatePerms('board', 'board2', ['board', 'publisher']));
    await assertSucceeds(updatePerms('board', 'board2', ['board']));
  });
  it('can modify a superadmin user when only assignable roles change', async () => {
    await assertSucceeds(updatePerms('board', 'super', ['superadmin', 'publisher']));
  });
  it('cannot grant itself superadmin or other board powers', async () => {
    await assertFails(updatePerms('board', 'board', ['board', 'superadmin']));
  });
  it('denies unknown permission and duplicates', async () => {
    await assertFails(updatePerms('board', 'target', ['member', 'god']));
    await assertFails(updatePerms('board', 'target', ['member', 'member']));
  });
  it('cannot change email or displayName of others', async () => {
    await assertFails(updateDoc(doc(as('board'), 'users', 'target'), { email: 'x@example.com' }));
    await assertFails(updateDoc(doc(as('board'), 'users', 'target'), { displayName: 'Hacked' }));
  });
  it('publisher/member cannot change others', async () => {
    await assertFails(updatePerms('publisher', 'target', ['member', 'publisher']));
    await assertFails(updatePerms('member', 'target', []));
  });
  it('unauthenticated cannot update', async () => {
    await assertFails(updateDoc(doc(anon(), 'users', 'target'), { permissions: [] }));
  });
});

describe('users: delete', () => {
  it.each(['super', 'board', 'publisher', 'member'])('%s cannot delete any user', async (actor) => {
    await assertFails(deleteDoc(doc(as(actor), 'users', 'target')));
    await assertFails(deleteDoc(doc(as(actor), 'users', actor)));
  });
  it('unauthenticated cannot delete', async () => {
    await assertFails(deleteDoc(doc(anon(), 'users', 'target')));
  });
});

describe('other collections', () => {
  it.each(['super', 'board', 'publisher', 'member'])('%s cannot read or write other/x', async (actor) => {
    await assertFails(getDoc(doc(as(actor), 'other', 'x')));
    await assertFails(getDocs(collection(as(actor), 'other')));
    await assertFails(setDoc(doc(as(actor), 'other', 'y'), { title: 'y' }));
    await assertFails(updateDoc(doc(as(actor), 'other', 'x'), { title: 'z' }));
    await assertFails(deleteDoc(doc(as(actor), 'other', 'x')));
  });
  it('unauthenticated denied', async () => {
    await assertFails(getDoc(doc(anon(), 'other', 'x')));
    await assertFails(setDoc(doc(anon(), 'other', 'y'), { title: 'y' }));
  });
});
