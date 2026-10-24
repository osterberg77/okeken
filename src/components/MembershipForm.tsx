import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { calculate, swishDeepLink, swishMessage, swishQrValue } from '../lib/membership';
import { createMembershipPayment, currentYear, getFees, type CreatedPayment } from '../lib/firebase/membership';
import { watchSession } from '../lib/firebase/session';
import type { MembershipFees } from '../types/membership';
import type { Session } from '../types/user';
import { Field, INPUT } from './admin/AdminUi';
import MembershipPeople, { type PersonRow } from './MembershipPeople';

const card = 'flex flex-col gap-5 rounded-[28px] bg-white px-6 py-8 shadow-card sm:px-[38px] sm:py-[38px]';

/** Räknar ut medlemsavgiften, sparar betalningen och skickar vidare till Swish (länk på mobil, QR-kod för dator). */
// title och introHtml kommer från den fasta infosidan /medlemsavgift (beslut 0023); utan dem används standardtexten.
export default function MembershipForm({ title, introHtml }: { title?: string; introHtml?: string }) {
  const year = currentYear();
  const [fees, setFees] = useState<MembershipFees | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [people, setPeople] = useState<PersonRow[]>([{ name: '', categoryId: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedPayment | null>(null);

  useEffect(() => watchSession(setSession), []);
  useEffect(() => {
    getFees(year).then(setFees, () => setFees(null));
  }, [year]);

  // Förifyll med inloggad medlem, men bara medan fälten är orörda
  useEffect(() => {
    if (!session) return;
    setPayerName((v) => v || session.displayName);
    setPayerEmail((v) => v || session.email);
    setPeople((l) => (l.length === 1 && !l[0].name ? [{ ...l[0], name: session.displayName }] : l));
  }, [session]);

  useEffect(() => {
    if (!fees) return;
    setPeople((l) => l.map((p) => (fees.categories.some((c) => c.id === p.categoryId) ? p : { ...p, categoryId: fees.categories[0]?.id ?? '' })));
  }, [fees]);

  const calc = useMemo(() => (fees ? calculate(fees.categories, fees.family, people.map((p) => p.categoryId)) : null), [fees, people]);

  if (fees === undefined || session === undefined) return <div className={card}><p className="m-0 text-muted">Laddar…</p></div>;
  if (!fees || fees.categories.length === 0 || !fees.swishNumber) {
    return (
      <div className={card}>
        <p className="m-0">Medlemsavgiften för {year} är inte fastställd ännu. Hör av dig till styrelsen så hjälper vi dig.</p>
      </div>
    );
  }

  if (created) return <PaymentResult payment={created} />;

  const ready = payerName.trim() && people.every((p) => p.name.trim() && p.categoryId) && (calc?.amount ?? 0) > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await createMembershipPayment({
        year,
        payerName: payerName.trim(),
        payerEmail: payerEmail.trim(),
        people: people.map((p) => ({ name: p.name.trim(), categoryId: p.categoryId })),
      });
      setCreated(result);
      // På mobil öppnas Swish direkt; på dator visas QR-koden
      if (window.matchMedia('(pointer: coarse)').matches) {
        location.href = swishDeepLink(result.swishNumber, result.amount, swishMessage(result.year, result.reference));
      }
    } catch {
      setError('Det gick inte att skapa betalningen. Kontrollera uppgifterna och försök igen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card}>
      <div>
        <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">{title || `Medlemsavgift ${year}`}</h1>
        {introHtml ? (
          <div className="prose-eken mt-2 max-w-[60ch]" dangerouslySetInnerHTML={{ __html: introHtml }} />
        ) : (
          <p className="mt-2 mb-0 max-w-[60ch] text-muted">
            Lägg till alla som ska vara medlemmar, så räknar vi ut avgiften. Sedan betalar du med Swish.
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-display text-xl font-bold">Vem ska bli medlem?</h2>
        <MembershipPeople people={people} categories={fees.categories} onChange={setPeople} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Ditt namn (den som betalar)" htmlFor="payer-name">
          <input id="payer-name" className={INPUT} value={payerName} maxLength={100} onChange={(e) => setPayerName(e.target.value)} />
        </Field>
        <Field label="E-post (valfritt)" htmlFor="payer-email" hint="Om du vill kunna bli kontaktad om betalningen.">
          <input id="payer-email" type="email" className={INPUT} value={payerEmail} maxLength={200} onChange={(e) => setPayerEmail(e.target.value)} />
        </Field>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-period px-5 py-4">
        <div>
          <div className="text-[13px] font-semibold tracking-[.04em] text-subtle uppercase">Att betala</div>
          <div className="font-display text-[32px] font-bold">{calc?.amount ?? 0} kr</div>
          {calc?.familyApplied && <div className="text-sm text-muted">Familjepris (i stället för {calc.full} kr)</div>}
        </div>
        <button
          type="submit"
          disabled={!ready || busy}
          className="cursor-pointer rounded-full bg-accent px-7 py-[14px] text-base font-semibold text-white shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110 disabled:cursor-default disabled:opacity-45"
        >
          {busy ? 'Vänta…' : 'Betala med Swish'}
        </button>
      </div>

      {error && <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      {session === null && (
        <p className="m-0 text-sm text-muted">
          Har du ett konto? <a href="/logga-in?next=/medlemsavgift" className="font-semibold text-accent">Logga in</a> så fyller vi i dina uppgifter och kopplar betalningen till dig.
        </p>
      )}
    </form>
  );
}

function PaymentResult({ payment }: { payment: CreatedPayment }) {
  const message = swishMessage(payment.year, payment.reference);
  const link = swishDeepLink(payment.swishNumber, payment.amount, message);
  return (
    <div className={card}>
      <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">Betala {payment.amount} kr med Swish</h1>
      <p className="m-0 max-w-[60ch] text-muted">
        Din betalning är registrerad med koden <strong className="text-ink">{payment.reference}</strong>. Betala i Swish så bockar kassören av den.
        Du får ingen automatisk bekräftelse; det kan dröja några dagar innan betalningen syns hos oss.
      </p>
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="rounded-2xl border-[1.5px] border-ink/10 bg-white p-4">
          <QRCodeSVG value={swishQrValue(payment.swishNumber, payment.amount, message)} size={200} level="M" />
        </div>
        <div className="flex flex-col gap-3">
          <a href={link} className="inline-block rounded-full bg-accent px-7 py-[14px] text-center text-base font-semibold text-white no-underline shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110">
            Öppna Swish
          </a>
          <p className="m-0 max-w-[40ch] text-sm text-muted">
            På datorn: skanna QR-koden med Swish-appen. Kan du inte skanna: Swisha {payment.amount} kr till {payment.swishNumber} och skriv "{message}" som meddelande.
          </p>
        </div>
      </div>
    </div>
  );
}
