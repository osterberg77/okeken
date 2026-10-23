import { useEffect, useMemo, useState } from 'react';
import { addManualPayment, currentYear, deletePayment, getFees, setPaymentStatus, watchPayments } from '../../lib/firebase/membership';
import { calculate } from '../../lib/membership';
import { PAYMENT_STATUS_LABELS, type MembershipFees, type MembershipPayment } from '../../types/membership';
import { canManageMembership, type Session } from '../../types/user';
import { TZ } from '../../lib/time';
import MembershipPeople, { type PersonRow } from '../MembershipPeople';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import { ActionButton, Field, INPUT } from './AdminUi';

export default function PaymentsAdmin() {
  return (
    <AdminGate allowed={canManageMembership} requirement="styrelse eller superadmin">
      {(session) => <Payments session={session} />}
    </AdminGate>
  );
}

const dateFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'medium' });
const STATUS_STYLE: Record<MembershipPayment['status'], string> = {
  pending: 'bg-[#FFF3C4] text-[#7A5A00]',
  paid: 'bg-[#E3F0DC] text-[#2F5A2B]',
  cancelled: 'bg-period text-muted',
};

type Tab = 'payments' | 'people';

function Payments({ session }: { session: Session }) {
  const now = currentYear();
  const [year, setYear] = useState(now);
  const [list, setList] = useState<MembershipPayment[] | null>(null);
  const [fees, setFees] = useState<MembershipFees | null>(null);
  const [tab, setTab] = useState<Tab>('payments');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setList(null);
    return watchPayments(year, setList, () => setError('Kunde inte läsa betalningarna.'));
  }, [year]);
  useEffect(() => {
    getFees(year).then(setFees, () => setFees(null));
  }, [year]);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
    } catch {
      setError('Det gick inte att spara ändringen.');
    }
  };

  const paidTotal = (list ?? []).filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pending = (list ?? []).filter((p) => p.status === 'pending');

  return (
    <AdminPanel>
      <div>
        <a href="/admin" className="text-sm font-semibold text-muted no-underline hover:text-accent">← Admin</a>
        <AdminTitle>Medlemsbetalningar</AdminTitle>
        <p className="mt-2 mb-0 max-w-[60ch] text-muted">
          Betalningar som skapats på /medlemsavgift väntar tills du bockat av dem mot kontoutdraget. Matcha på koden (OKE-XXXX) i Swish-meddelandet.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton onClick={() => setYear(year - 1)}>← {year - 1}</ActionButton>
        <strong className="font-display text-xl">{year}</strong>
        <ActionButton onClick={() => setYear(year + 1)} disabled={year >= now}>{year + 1} →</ActionButton>
        <span className="text-sm text-muted">
          Betalt: <strong className="text-ink">{paidTotal} kr</strong> · Väntar: <strong className="text-ink">{pending.length}</strong>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['payments', 'people'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold ${tab === t ? 'bg-accent text-white' : 'bg-period text-ink hover:bg-pastel'}`}
          >
            {t === 'payments' ? 'Betalningar' : 'Vem har betalat?'}
          </button>
        ))}
        <span className="flex-1" />
        <ActionButton onClick={() => setAdding(!adding)}>{adding ? 'Stäng' : 'Registrera betalning'}</ActionButton>
      </div>

      {error && <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}

      {adding && (
        <ManualForm
          year={year}
          fees={fees}
          onSave={(p) => run(async () => { await addManualPayment(p, session.uid); setAdding(false); })}
        />
      )}

      {list === null && !error && <p className="text-muted">Laddar…</p>}
      {list && list.length === 0 && <p className="text-muted">Inga betalningar för {year} ännu.</p>}
      {list && tab === 'payments' && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {list.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-[22px] bg-period px-[18px] py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${STATUS_STYLE[p.status]}`}>{PAYMENT_STATUS_LABELS[p.status]}</span>
                {p.reference && <span className="font-mono text-sm font-semibold">{p.reference}</span>}
                <span className="font-display text-[17px] font-semibold">{p.amount} kr</span>
                <span className="text-[13px] text-subtle">
                  {p.createdAt ? dateFmt.format(p.createdAt) : ''}{p.source === 'manual' ? ' · inlagd för hand' : p.uid ? ' · inloggad' : ''}
                </span>
              </div>
              <div className="text-[15px]">
                <strong>{p.payerName}</strong>{p.payerEmail ? ` · ${p.payerEmail}` : ''}
              </div>
              <div className="text-sm text-muted">{p.people.map((x) => `${x.name} (${x.categoryLabel})`).join(', ')}</div>
              {p.note && <div className="text-sm text-muted">Anteckning: {p.note}</div>}
              <div className="flex flex-wrap gap-2">
                {p.status !== 'paid' && <ActionButton primary onClick={() => run(() => setPaymentStatus(p.id, 'paid', session.uid))}>Markera betald</ActionButton>}
                {p.status === 'paid' && <ActionButton onClick={() => run(() => setPaymentStatus(p.id, 'pending', session.uid))}>Ångra betald</ActionButton>}
                {p.status === 'pending' && <ActionButton onClick={() => run(() => setPaymentStatus(p.id, 'cancelled', session.uid))}>Avbryt</ActionButton>}
                {p.status !== 'paid' && (
                  <ActionButton danger onClick={() => { if (confirm('Radera betalningen?')) run(() => deletePayment(p.id)); }}>Radera</ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {list && tab === 'people' && <PeopleStatus list={list} />}
    </AdminPanel>
  );
}

/** Personer som ingår i en betald betalning för året, en rad per namn. Väntande visas som "väntar". */
function PeopleStatus({ list }: { list: MembershipPayment[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; category: string; paid: boolean }>();
    for (const p of list) {
      if (p.status === 'cancelled') continue;
      for (const person of p.people) {
        const key = person.name.trim().toLocaleLowerCase('sv');
        const prev = map.get(key);
        const paid = p.status === 'paid' || prev?.paid === true;
        map.set(key, { name: person.name, category: person.categoryLabel, paid });
      }
    }
    return [...map.values()].sort((a, b) => Number(b.paid) - Number(a.paid) || a.name.localeCompare(b.name, 'sv'));
  }, [list]);
  if (rows.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((r) => (
        <li key={r.name} className="flex items-center gap-3 rounded-2xl bg-period px-4 py-3">
          <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${r.paid ? STATUS_STYLE.paid : STATUS_STYLE.pending}`}>{r.paid ? 'Betald' : 'Väntar'}</span>
          <span className="flex-1 font-semibold">{r.name}</span>
          <span className="text-sm text-muted">{r.category}</span>
        </li>
      ))}
    </ul>
  );
}

function ManualForm({ year, fees, onSave }: { year: number; fees: MembershipFees | null; onSave: (p: Parameters<typeof addManualPayment>[0]) => void }) {
  const [payerName, setPayerName] = useState('');
  const [people, setPeople] = useState<PersonRow[]>([{ name: '', categoryId: fees?.categories[0]?.id ?? '' }]);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (!fees || fees.categories.length === 0) {
    return <p className="m-0 rounded-2xl bg-[#FFF3C4] px-4 py-3 text-sm text-[#7A5A00]">Spara årets avgifter först (Medlemsavgifter), så kan du registrera betalningar.</p>;
  }
  const calc = calculate(fees.categories, fees.family, people.map((p) => p.categoryId));
  const amount = amountText === null ? calc.amount : Number(amountText.replace(/\D/g, ''));
  const ready = payerName.trim() && people.every((p) => p.name.trim() && p.categoryId);

  return (
    <div className="flex flex-col gap-4 rounded-[22px] bg-period p-5">
      <h2 className="m-0 font-display text-xl font-bold">Registrera betald avgift {year}</h2>
      <Field label="Betalare" htmlFor="m-payer"><input id="m-payer" className={INPUT} value={payerName} maxLength={100} onChange={(e) => setPayerName(e.target.value)} /></Field>
      <MembershipPeople people={people} categories={fees.categories} onChange={setPeople} />
      <Field label="Belopp (kr)" htmlFor="m-amount" hint="Räknas ut från tabellen men kan ändras.">
        <input id="m-amount" inputMode="numeric" className={INPUT} value={amount} onChange={(e) => setAmountText(e.target.value)} />
      </Field>
      <Field label="Anteckning (valfritt)" htmlFor="m-note" hint="T.ex. kontant, bankgiro eller betalt tidigare.">
        <input id="m-note" className={INPUT} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div>
        <ActionButton
          primary
          disabled={!ready}
          onClick={() =>
            onSave({
              year,
              payerName,
              payerEmail: '',
              people: people.map((p) => ({ name: p.name, categoryId: p.categoryId, categoryLabel: fees.categories.find((c) => c.id === p.categoryId)?.label ?? '' })),
              amount,
              note,
            })
          }
        >
          Spara som betald
        </ActionButton>
      </div>
    </div>
  );
}
