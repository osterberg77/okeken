import type { FeeCategory, FamilyFee, MembershipFees } from '../types/membership';

// Avgiftsberäkningen finns också i functions/src/membership.ts (Functions kan inte importera från src);
// tests/server/membership.test.ts kontrollerar att de ger samma svar.

export interface Calculation {
  amount: number;
  /** Summan utan familjetak */
  full: number;
  familyApplied: boolean;
}

export function calculate(categories: readonly FeeCategory[], family: FamilyFee | null, categoryIds: readonly string[]): Calculation {
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

export const SWISH_MESSAGE_MAX = 50;

/** Meddelandet i Swish: kort, innehåller referenskoden som kassören matchar mot kontoutdraget */
export function swishMessage(year: number, reference: string): string {
  return `OK Eken medlemsavgift ${year} ${reference}`.slice(0, SWISH_MESSAGE_MAX);
}

const cleanPayee = (payee: string) => payee.replace(/\s/g, '');

/** QR-innehåll enligt Swish QR-specen: C<mottagare>;<belopp>;<meddelande>;<mask>. Mask 2 = beloppet får ändras av betalaren. */
export function swishQrValue(payee: string, kronor: number, message: string): string {
  return `C${cleanPayee(payee)};${kronor};${message};2`;
}

/** Länk som öppnar Swish-appen med allt ifyllt; beloppet är förifyllt men får ändras av betalaren */
export function swishDeepLink(payee: string, kronor: number, message: string): string {
  const payload = {
    version: 1,
    payee: { value: cleanPayee(payee) },
    amount: { value: kronor, editable: true },
    message: { value: message },
  };
  return `swish://payment?data=${encodeURIComponent(JSON.stringify(payload))}`;
}

/** Swish-länk utan belopp: betalaren fyller i summan själv (frivilligt bidrag) */
export function swishOpenLink(payee: string, message: string): string {
  const payload = { version: 1, payee: { value: cleanPayee(payee) }, message: { value: message, editable: true } };
  return `swish://payment?data=${encodeURIComponent(JSON.stringify(payload))}`;
}

/** Klubbens avgifter som förval när inget år är sparat; justeras i /admin/installningar */
export const defaultFees = (year: number): MembershipFees => ({
  year,
  swishNumber: '',
  startFee: 0,
  categories: [
    { id: 'adult', label: 'Vuxen', amount: 200, hint: '', adult: true },
    { id: 'youth', label: 'Ungdom', amount: 100, hint: 't.o.m. 16 år' },
  ],
  family: { amount: 450, minPeople: 3, maxAdults: 2 },
});
