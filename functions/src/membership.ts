import { randomInt } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

// Medlemsavgift (beslut 0020). Beloppet räknas alltid här, aldrig av klienten. Spegel av src/lib/membership.ts;
// tests/server/membership.test.ts kontrollerar att de två räknar lika.

export interface FeeCategory {
  id: string;
  label: string;
  amount: number;
  hint: string;
  adult?: boolean;
}
export interface FamilyFee {
  amount: number;
  minPeople: number;
  maxAdults: number;
}

export function calculate(categories: readonly FeeCategory[], family: FamilyFee | null, categoryIds: readonly string[]) {
  let full = 0;
  let adults = 0;
  for (const id of categoryIds) {
    const c = categories.find((x) => x.id === id);
    full += c?.amount ?? 0;
    if (c?.adult) adults++;
  }
  const familyApplied = family !== null && categoryIds.length >= family.minPeople && adults <= family.maxAdults && full > family.amount;
  return { amount: familyApplied ? family.amount : full, full, familyApplied };
}

/** Utan tecken som lätt förväxlas (0/O, 1/I) */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newReference(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `OKE-${s}`;
}

export class InvalidMembershipRequest extends Error {}

export interface MembershipRequest {
  year: number;
  payerName: string;
  payerEmail: string;
  people: { name: string; categoryId: string }[];
}

const MAX_PEOPLE = 12;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Rensar och kontrollerar indata från en anonym klient */
export function parseRequest(data: unknown): MembershipRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const year = d.year;
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 2020 || year > 2100) throw new InvalidMembershipRequest('year');
  const payerName = str(d.payerName, 100);
  const payerEmail = str(d.payerEmail, 200);
  if (!payerName) throw new InvalidMembershipRequest('payerName');
  if (payerEmail && !EMAIL.test(payerEmail)) throw new InvalidMembershipRequest('payerEmail');
  if (!Array.isArray(d.people) || d.people.length < 1 || d.people.length > MAX_PEOPLE) throw new InvalidMembershipRequest('people');
  const people = d.people.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const name = str(o.name, 100);
    const categoryId = str(o.categoryId, 40);
    if (!name || !categoryId) throw new InvalidMembershipRequest('person');
    return { name, categoryId };
  });
  return { year, payerName, payerEmail, people };
}

export interface CreatedPayment {
  id: string;
  reference: string;
  amount: number;
  year: number;
  swishNumber: string;
}

/** Skapar en väntande betalning med beloppet från årets avgiftstabell */
export async function createPayment(db: Firestore, req: MembershipRequest, uid: string | null, now = new Date()): Promise<CreatedPayment> {
  const feeSnap = await db.doc(`membershipFees/${req.year}`).get();
  const fees = feeSnap.data();
  const categories: FeeCategory[] = Array.isArray(fees?.categories) ? fees.categories : [];
  if (!fees || categories.length === 0 || typeof fees.swishNumber !== 'string' || !fees.swishNumber) {
    throw new InvalidMembershipRequest('fees');
  }
  const people = req.people.map((p) => {
    const cat = categories.find((c) => c.id === p.categoryId);
    if (!cat) throw new InvalidMembershipRequest('category');
    return { name: p.name, categoryId: cat.id, categoryLabel: cat.label };
  });
  const { amount } = calculate(categories, fees.family ?? null, people.map((p) => p.categoryId));
  if (amount <= 0) throw new InvalidMembershipRequest('amount');

  // Koden ska vara unik inom året så att kassören kan matcha mot kontoutdraget
  let reference = newReference();
  for (let i = 0; i < 5; i++) {
    const clash = await db.collection('membershipPayments').where('year', '==', req.year).where('reference', '==', reference).limit(1).get();
    if (clash.empty) break;
    reference = newReference();
  }

  const ref = db.collection('membershipPayments').doc();
  await ref.set({
    year: req.year,
    reference,
    payerName: req.payerName,
    payerEmail: req.payerEmail,
    uid,
    people,
    amount,
    status: 'pending',
    source: 'web',
    note: '',
    createdAt: now,
    createdBy: uid,
    updatedAt: now,
    paidAt: null,
    paidBy: null,
  });
  return { id: ref.id, reference, amount, year: req.year, swishNumber: fees.swishNumber };
}
