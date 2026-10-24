// Klientens datalager för medlemsavgift och medlemsbetalningar (beslut 0020).
// Priserna är publika; betalningarna läses bara av styrelsen (och betalaren). Nya webbetalningar skapas av Function
// createMembershipPayment, som räknar beloppet.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { dayKey } from '../time';
import { PAYMENT_STATUSES, type MembershipFees, type MembershipPayment, type PaymentPerson, type PaymentStatus } from '../../types/membership';
import { app, db } from './client';

/** Året som avgiften gäller just nu (svensk tid) */
export const currentYear = () => Number(dayKey(new Date()).slice(0, 4));

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

function feesFromFirestore(year: number, d: DocumentData): MembershipFees {
  return {
    year,
    swishNumber: typeof d.swishNumber === 'string' ? d.swishNumber : '',
    startFee: typeof d.startFee === 'number' ? d.startFee : 0,
    categories: Array.isArray(d.categories) ? d.categories : [],
    family: d.family && typeof d.family.amount === 'number' ? { amount: d.family.amount, minPeople: d.family.minPeople, maxAdults: d.family.maxAdults ?? 2 } : null,
  };
}

/** Årets avgiftstabell, eller null om den inte är fastställd */
export async function getFees(year: number): Promise<MembershipFees | null> {
  const snap = await getDoc(doc(db, 'membershipFees', String(year)));
  return snap.exists() ? feesFromFirestore(year, snap.data()) : null;
}

export async function saveFees(fees: MembershipFees, uid: string): Promise<void> {
  await setDoc(doc(db, 'membershipFees', String(fees.year)), {
    year: fees.year,
    swishNumber: fees.swishNumber.replace(/\D/g, ''),
    startFee: fees.startFee,
    categories: fees.categories.map((c) => ({ id: c.id, label: c.label.trim(), amount: c.amount, hint: c.hint.trim(), adult: c.adult === true })),
    family: fees.family,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}

export interface CreatedPayment {
  id: string;
  reference: string;
  amount: number;
  year: number;
  swishNumber: string;
}

export interface NewPaymentRequest {
  year: number;
  payerName: string;
  payerEmail: string;
  people: { name: string; categoryId: string }[];
}

export async function createMembershipPayment(req: NewPaymentRequest): Promise<CreatedPayment> {
  const call = httpsCallable<NewPaymentRequest, CreatedPayment>(getFunctions(app, 'europe-north1'), 'createMembershipPayment');
  return (await call(req)).data;
}

function paymentFromFirestore(id: string, d: DocumentData): MembershipPayment {
  return {
    id,
    year: d.year,
    reference: d.reference ?? '',
    payerName: d.payerName ?? '',
    payerEmail: d.payerEmail ?? '',
    uid: typeof d.uid === 'string' ? d.uid : null,
    people: Array.isArray(d.people) ? d.people : [],
    amount: d.amount ?? 0,
    status: PAYMENT_STATUSES.includes(d.status) ? (d.status as PaymentStatus) : 'pending',
    source: d.source === 'manual' ? 'manual' : 'web',
    note: d.note ?? '',
    createdAt: toDate(d.createdAt),
    paidAt: toDate(d.paidAt),
    paidBy: typeof d.paidBy === 'string' ? d.paidBy : null,
  };
}

export function watchPayments(year: number, callback: (list: MembershipPayment[]) => void, onError: () => void): () => void {
  return onSnapshot(
    query(collection(db, 'membershipPayments'), where('year', '==', year)),
    (snap) => callback(snap.docs.map((d) => paymentFromFirestore(d.id, d.data())).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))),
    onError,
  );
}

export async function setPaymentStatus(id: string, status: PaymentStatus, uid: string): Promise<void> {
  await updateDoc(doc(db, 'membershipPayments', id), {
    status,
    paidAt: status === 'paid' ? serverTimestamp() : null,
    paidBy: status === 'paid' ? uid : null,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'membershipPayments', id));
}

export interface ManualPayment {
  year: number;
  payerName: string;
  payerEmail: string;
  people: PaymentPerson[];
  amount: number;
  note: string;
}

/** Betalning som tagits emot på annat sätt (kontant, bankgiro, tidigare system) och förs in i efterhand */
export async function addManualPayment(p: ManualPayment, uid: string): Promise<void> {
  await addDoc(collection(db, 'membershipPayments'), {
    year: p.year,
    reference: '',
    payerName: p.payerName.trim(),
    payerEmail: p.payerEmail.trim(),
    uid: null,
    people: p.people.map((x) => ({ name: x.name.trim(), categoryId: x.categoryId, categoryLabel: x.categoryLabel })),
    amount: p.amount,
    status: 'paid',
    source: 'manual',
    note: p.note.trim(),
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    paidAt: serverTimestamp(),
    paidBy: uid,
  });
}
