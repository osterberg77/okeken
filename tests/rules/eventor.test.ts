import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const USERS: Record<string, string[]> = {
  publisher: ['publisher'],
  board: ['board'],
  super: ['superadmin'],
  setter: ['course_setter'],
  member: ['member'],
  nobody: [],
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-okeken-eventor',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

const NOW = Timestamp.fromDate(new Date('2026-10-21T00:00:00Z'));

const eventorEvent = () => ({
  name: 'Novemberloppet',
  startsAt: NOW,
  endsAt: NOW,
  allDay: true,
  organiserId: 588,
  organiserName: 'Motala AIF OL',
  classificationId: 3,
  disciplineId: 1,
  statusId: 5,
  form: '',
  url: 'https://eventor.orientering.se/Events/Show/54134',
  webUrl: '',
  suggested: true,
  gone: false,
  selected: false,
  selectedBy: null,
  selectedAt: null,
  fetchedAt: NOW,
});

const settings = () => ({
  ownOrganisationId: 510,
  organisationIds: [24],
  classificationIds: [1, 2, 3],
  disciplineIds: [1],
  monthsAhead: 12,
  updatedBy: 'board',
  updatedAt: serverTimestamp(),
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, permissions] of Object.entries(USERS)) {
      await setDoc(doc(db, 'users', uid), { permissions, email: `${uid}@example.com` });
    }
    await setDoc(doc(db, 'eventorEvents', '54134'), eventorEvent());
    await setDoc(doc(db, 'settings', 'eventor'), { ...settings(), updatedAt: NOW });
  });
});

const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const select = (uid: string, selected = true) => ({
  selected,
  selectedBy: uid,
  selectedAt: serverTimestamp(),
});

describe('eventorEvents', () => {
  it.each(['publisher', 'board', 'super'])('%s kan läsa och kryssa i/ur', async (uid) => {
    await assertSucceeds(getDoc(doc(as(uid), 'eventorEvents', '54134')));
    await assertSucceeds(updateDoc(doc(as(uid), 'eventorEvents', '54134'), select(uid)));
    await assertSucceeds(updateDoc(doc(as(uid), 'eventorEvents', '54134'), select(uid, false)));
  });

  it.each(['setter', 'member', 'nobody'])('%s kan varken läsa eller ändra', async (uid) => {
    await assertFails(getDoc(doc(as(uid), 'eventorEvents', '54134')));
    await assertFails(updateDoc(doc(as(uid), 'eventorEvents', '54134'), select(uid)));
  });

  it('utloggad nekas', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'eventorEvents', '54134')));
  });

  it('Eventor-fälten kan inte ändras av klienten', async () => {
    const ref = doc(as('publisher'), 'eventorEvents', '54134');
    await assertFails(updateDoc(ref, { name: 'Hackad', ...select('publisher') }));
    await assertFails(updateDoc(ref, { suggested: false }));
    await assertFails(updateDoc(ref, { gone: true }));
    await assertFails(updateDoc(ref, { url: 'https://example.com' }));
  });

  it('valet måste vara bool och signerat med eget uid och servertid', async () => {
    const ref = doc(as('publisher'), 'eventorEvents', '54134');
    await assertFails(updateDoc(ref, { ...select('publisher'), selected: 'ja' }));
    await assertFails(updateDoc(ref, { ...select('board') }));
    await assertFails(updateDoc(ref, { ...select('publisher'), selectedAt: NOW }));
  });

  it('publicerare kan inte skapa eller radera', async () => {
    const db = as('publisher');
    await assertFails(setDoc(doc(db, 'eventorEvents', '1'), eventorEvent()));
    await assertFails(deleteDoc(doc(db, 'eventorEvents', '54134')));
  });
});

describe('settings/eventor', () => {
  it.each(['publisher', 'board', 'super'])('%s kan läsa', async (uid) => {
    await assertSucceeds(getDoc(doc(as(uid), 'settings', 'eventor')));
  });

  it.each(['setter', 'member', 'nobody'])('%s kan inte läsa', async (uid) => {
    await assertFails(getDoc(doc(as(uid), 'settings', 'eventor')));
  });

  it.each(['board', 'super'])('%s kan ändra', async (uid) => {
    await assertSucceeds(setDoc(doc(as(uid), 'settings', 'eventor'), { ...settings(), updatedBy: uid }));
  });

  it('publicerare kan inte ändra', async () => {
    await assertFails(setDoc(doc(as('publisher'), 'settings', 'eventor'), { ...settings(), updatedBy: 'publisher' }));
  });

  it('validerar innehållet', async () => {
    const ref = doc(as('board'), 'settings', 'eventor');
    const ok = { ...settings(), updatedBy: 'board' };
    await assertFails(setDoc(ref, { ...ok, classificationIds: [7] }));
    await assertFails(setDoc(ref, { ...ok, organisationIds: [] }));
    await assertFails(setDoc(ref, { ...ok, organisationIds: Array.from({ length: 11 }, (_, i) => i + 1) }));
    await assertFails(setDoc(ref, { ...ok, monthsAhead: 0 }));
    await assertFails(setDoc(ref, { ...ok, monthsAhead: 25 }));
    await assertFails(setDoc(ref, { ...ok, monthsAhead: '12' }));
    await assertFails(setDoc(ref, { ...ok, extra: 1 }));
    await assertFails(setDoc(ref, { ...ok, updatedBy: 'super' }));
  });
});
