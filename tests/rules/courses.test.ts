import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

// Egna träningsbanor (beslut 0026): users/{uid}/courses/{courseId}.
let env: RulesTestEnvironment;

const USERS: Record<string, string[]> = { member: ['member'], other: ['member'], board: ['board'], nobody: [] };
const OLD = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-okeken', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, permissions] of Object.entries(USERS)) {
      await setDoc(doc(ctx.firestore(), 'users', uid), { displayName: uid, email: `${uid}@example.com`, permissions, createdAt: OLD });
    }
    await setDoc(doc(ctx.firestore(), 'users', 'member', 'courses', 'c1'), {
      name: 'Gammal bana', mapId: 'botorp', points: [], scale: 10000, createdAt: OLD, updatedAt: OLD,
    });
  });
});

const fs = (uid: string | null) => (uid ? env.authenticatedContext(uid, { email_verified: true }) : env.unauthenticatedContext()).firestore();
const course = (extra: Record<string, unknown> = {}) => ({
  name: 'Kvällsträning',
  mapId: 'botorp',
  points: [{ lat: 58.0, lng: 16.0 }, { lat: 58.01, lng: 16.01 }],
  scale: 10000,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

describe('courses', () => {
  it('medlem får skapa egen bana', () => assertSucceeds(setDoc(doc(fs('member'), 'users/member/courses/ny'), course())));
  it('inloggad utan behörighet får inte skapa', () => assertFails(setDoc(doc(fs('nobody'), 'users/nobody/courses/ny'), course())));
  it('får inte skapa hos någon annan', () => assertFails(setDoc(doc(fs('member'), 'users/other/courses/ny'), course())));
  it('styrelsen får inte skriva hos någon annan', () => assertFails(setDoc(doc(fs('board'), 'users/member/courses/ny'), course())));
  it('för många punkter nekas', () =>
    assertFails(setDoc(doc(fs('member'), 'users/member/courses/ny'), course({ points: Array.from({ length: 51 }, () => ({ lat: 58, lng: 16 })) }))));
  it('okänt fält nekas', () => assertFails(setDoc(doc(fs('member'), 'users/member/courses/ny'), course({ extra: 1 }))));
  it('ogiltigt kart-id nekas', () => assertFails(setDoc(doc(fs('member'), 'users/member/courses/ny'), course({ mapId: 'Åtvid karta' }))));
  it('tomt namn nekas', () => assertFails(setDoc(doc(fs('member'), 'users/member/courses/ny'), course({ name: '' }))));

  it('ägaren får läsa, lista, ändra och radera', async () => {
    await assertSucceeds(getDoc(doc(fs('member'), 'users/member/courses/c1')));
    await assertSucceeds(getDocs(collection(fs('member'), 'users/member/courses')));
    await assertSucceeds(updateDoc(doc(fs('member'), 'users/member/courses/c1'), { name: 'Ny', updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(fs('member'), 'users/member/courses/c1')));
  });
  it('createdAt går inte att ändra', () =>
    assertFails(updateDoc(doc(fs('member'), 'users/member/courses/c1'), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() })));
  it('andra får inte läsa', async () => {
    await assertFails(getDoc(doc(fs('other'), 'users/member/courses/c1')));
    await assertFails(getDoc(doc(fs('board'), 'users/member/courses/c1')));
    await assertFails(getDocs(collection(fs(null), 'users/member/courses')));
  });
  it('andra får inte radera', () => assertFails(deleteDoc(doc(fs('other'), 'users/member/courses/c1'))));
});
