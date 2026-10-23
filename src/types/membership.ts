// Medlemsavgift och medlemsbetalningar (beslut 0020). Delas av bygget, publika formuläret och admin.

export interface FeeCategory {
  id: string;
  label: string;
  /** Hela kronor per person */
  amount: number;
  /** Kort förklaring, t.ex. "t.o.m. 20 år" */
  hint: string;
}

/** Familjetak: från och med `minPeople` personer kostar det aldrig mer än `amount` */
export interface FamilyFee {
  amount: number;
  minPeople: number;
}

/** membershipFees/{år} */
export interface MembershipFees {
  year: number;
  /** Klubbens Swish-nummer, bara siffror */
  swishNumber: string;
  categories: FeeCategory[];
  family: FamilyFee | null;
}

export interface PaymentPerson {
  name: string;
  categoryId: string;
  categoryLabel: string;
}

export const PAYMENT_STATUSES = ['pending', 'paid', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Väntar på betalning',
  paid: 'Betald',
  cancelled: 'Avbruten',
};

/** membershipPayments/{id} */
export interface MembershipPayment {
  id: string;
  year: number;
  /** Kort kod som skrivs i Swish-meddelandet, t.ex. OKE-A7K2 */
  reference: string;
  payerName: string;
  payerEmail: string;
  uid: string | null;
  people: PaymentPerson[];
  amount: number;
  status: PaymentStatus;
  source: 'web' | 'manual';
  note: string;
  createdAt: Date | null;
  paidAt: Date | null;
  paidBy: string | null;
}

export const FEE_LIMITS = { categories: 8, people: 12, maxAmount: 100000 } as const;
