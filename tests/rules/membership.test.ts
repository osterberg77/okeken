import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const USERS: Record<string, string[]> = {
  board: ['board'],
  super: ['superadmin'],
  publisher: ['publisher'],
  member: ['member'],
  payer: ['member'],
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-okeken-membership',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => {
  await env.cleanup();
});

const payment = (over: Record<string, unknown> = {}) => ({
  year: 2026,
  reference: 'OKE-A7K2',
  payerName: 'Anna Andersson',
  payerEmail: 'anna@example.com',
  uid: 'payer',
  people: [{ name: 'Anna Andersson', categoryId: 'adult', categoryLabel: 'Vuxen' }],
  amount: 300,
  status: 'pending',
  source: 'web',
  note: '',
  createdAt: new Date('2026-01-10T10:00:00Z'),
  createdBy: 'payer',
  updatedAt: new Date('2026-01-10T10:00:00Z'),
  paidAt: null,
  paidBy: null,
  ...over,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, permissions] of Object.entries(USERS)) await setDoc(doc(db, 'users', uid), { permissions });
    await setDoc(doc(db, 'membershipPayments', 'p1'), payment());
    await setDoc(doc(db, 'membershipPayments', 'paid1'), payment({ status: 'paid', paidAt: new Date(), paidBy: 'board' }));
    await setDoc(doc(db, 'membershipFees', '2026'), { year: 2026, swishNumber: '1234567890', categories: [], family: null });
  });
});

const as = (uid: string | null) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());

const fees = (over: Record<string, unknown> = {}) => ({
  year: 2026,
  swishNumber: '1234567890',
  categories: [{ id: 'adult', label: 'Vuxen', amount: 300, hint: '' }],
  family: { amount: 450, minPeople: 3, maxAdults: 2 },
  updatedBy: 'board',
  updatedAt: serverTimestamp(),
  ...over,
});

describe('membershipFees', () => {
  it('alla får läsa', async () => {
    await assertSucceeds(getDoc(doc(as(null), 'membershipFees', '2026')));
  });
  it('styrelse och superadmin skriver, andra nekas', async () => {
    await assertSucceeds(setDoc(doc(as('board'), 'membershipFees', '2026'), fees()));
    await assertSucceeds(setDoc(doc(as('super'), 'membershipFees', '2026'), fees({ updatedBy: 'super' })));
    await assertFails(setDoc(doc(as('publisher'), 'membershipFees', '2026'), fees({ updatedBy: 'publisher' })));
    await assertFails(setDoc(doc(as('member'), 'membershipFees', '2026'), fees({ updatedBy: 'member' })));
    await assertFails(setDoc(doc(as(null), 'membershipFees', '2026'), fees()));
  });
  it('året måste stämma med dokument-id och Swish-numret bara vara siffror', async () => {
    await assertFails(setDoc(doc(as('board'), 'membershipFees', '2026'), fees({ year: 2027 })));
    await assertFails(setDoc(doc(as('board'), 'membershipFees', '2026'), fees({ swishNumber: '123 456' })));
    await assertFails(setDoc(doc(as('board'), 'membershipFees', 'abc'), fees()));
  });
  it('startavgiften är valfri men måste vara ett rimligt heltal', async () => {
    await assertSucceeds(setDoc(doc(as('board'), 'membershipFees', '2026'), fees({ startFee: 50 })));
    for (const startFee of [-1, 10001, 12.5, '50']) await assertFails(setDoc(doc(as('board'), 'membershipFees', '2026'), fees({ startFee })));
  });
  it('familjetaket måste vara rimligt', async () => {
    await assertFails(setDoc(doc(as('board'), 'membershipFees', '2026'), fees({ family: { amount: -1, minPeople: 3, maxAdults: 2 } })));
    await assertFails(setDoc(doc(as('board'), 'membershipFees', '2026'), fees({ family: { amount: 450, minPeople: 1, maxAdults: 2 } })));
    await assertFails(setDoc(doc(as('board'), 'membershipFees', '2026'), fees({ family: { amount: 450, minPeople: 3, maxAdults: 0 } })));
    await assertFails(setDoc(doc(as('board'), 'membershipFees', '2026'), fees({ family: { amount: 450, minPeople: 3 } })));
  });
});

describe('membershipPayments', () => {
  it('styrelse och superadmin läser alla', async () => {
    await assertSucceeds(getDoc(doc(as('board'), 'membershipPayments', 'p1')));
    await assertSucceeds(getDoc(doc(as('super'), 'membershipPayments', 'p1')));
  });
  it('betalaren läser sin egen, andra inte', async () => {
    await assertSucceeds(getDoc(doc(as('payer'), 'membershipPayments', 'p1')));
    await assertFails(getDoc(doc(as('member'), 'membershipPayments', 'p1')));
    await assertFails(getDoc(doc(as('publisher'), 'membershipPayments', 'p1')));
    await assertFails(getDoc(doc(as(null), 'membershipPayments', 'p1')));
  });
  it('klienter skapar inga webbetalningar (bara Functionen)', async () => {
    await assertFails(setDoc(doc(as('payer'), 'membershipPayments', 'new'), payment()));
    await assertFails(setDoc(doc(as(null), 'membershipPayments', 'new'), payment({ uid: null })));
    await assertFails(setDoc(doc(as('board'), 'membershipPayments', 'new'), payment({ source: 'web' })));
  });
  it('styrelsen registrerar betalning för hand', async () => {
    const manual = payment({ source: 'manual', status: 'paid', createdBy: 'board', paidBy: 'board', paidAt: new Date() });
    await assertSucceeds(setDoc(doc(as('board'), 'membershipPayments', 'm1'), manual));
    await assertFails(setDoc(doc(as('board'), 'membershipPayments', 'm2'), { ...manual, amount: -5 }));
    await assertFails(setDoc(doc(as('board'), 'membershipPayments', 'm3'), { ...manual, status: 'refunded' }));
    await assertFails(setDoc(doc(as('publisher'), 'membershipPayments', 'm4'), { ...manual, createdBy: 'publisher' }));
  });
  it('styrelsen markerar betald, men belopp och personer ligger fast', async () => {
    const ref = doc(as('board'), 'membershipPayments', 'p1');
    await assertSucceeds(updateDoc(ref, { status: 'paid', paidAt: new Date(), paidBy: 'board', updatedAt: new Date() }));
    await assertFails(updateDoc(doc(as('board'), 'membershipPayments', 'p1'), { amount: 1 }));
    await assertFails(updateDoc(doc(as('board'), 'membershipPayments', 'p1'), { uid: 'board' }));
  });
  it('betalaren och andra kan inte ändra eller radera', async () => {
    await assertFails(updateDoc(doc(as('payer'), 'membershipPayments', 'p1'), { status: 'paid' }));
    await assertFails(deleteDoc(doc(as('payer'), 'membershipPayments', 'p1')));
    await assertFails(deleteDoc(doc(as('publisher'), 'membershipPayments', 'p1')));
  });
  it('betalda kan inte raderas, väntande kan', async () => {
    await assertFails(deleteDoc(doc(as('board'), 'membershipPayments', 'paid1')));
    await assertSucceeds(deleteDoc(doc(as('board'), 'membershipPayments', 'p1')));
  });
});
