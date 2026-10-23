import { useEffect, useState } from 'react';
import { currentYear, getFees, saveFees } from '../../lib/firebase/membership';
import { defaultFees } from '../../lib/membership';
import { FEE_LIMITS, type FeeCategory, type MembershipFees } from '../../types/membership';
import { canManageMembership, type Session } from '../../types/user';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import { ActionButton, Field, INPUT } from './AdminUi';

export default function FeesAdmin() {
  return (
    <AdminGate allowed={canManageMembership} requirement="styrelse eller superadmin">
      {(session) => <Fees session={session} />}
    </AdminGate>
  );
}

const newId = () => `k${Math.random().toString(36).slice(2, 8)}`;

function Fees({ session }: { session: Session }) {
  const now = currentYear();
  const [year, setYear] = useState(now);
  const [fees, setFees] = useState<MembershipFees | null>(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFees(null);
    setMessage('');
    getFees(year).then(
      async (f) => {
        setExists(f !== null);
        if (f) return setFees(f);
        // Nytt år: utgå från förra årets tabell
        const prev = await getFees(year - 1).catch(() => null);
        setFees(prev ? { ...prev, year } : defaultFees(year));
      },
      () => setError('Kunde inte läsa avgifterna.'),
    );
  }, [year]);

  if (!fees) return <AdminPanel>{error ? <p role="alert">{error}</p> : <p className="text-muted">Laddar…</p>}</AdminPanel>;

  const setCategory = (i: number, patch: Partial<FeeCategory>) =>
    setFees({ ...fees, categories: fees.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  const valid =
    /^\d{6,15}$/.test(fees.swishNumber.replace(/\D/g, '')) &&
    fees.categories.length > 0 &&
    (fees.family === null || (fees.family.maxAdults >= 1 && fees.family.minPeople >= 2)) &&
    fees.categories.every((c) => c.label.trim() && Number.isInteger(c.amount) && c.amount >= 0 && c.amount <= FEE_LIMITS.maxAmount);

  async function save() {
    if (!fees) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await saveFees(fees, session.uid);
      setExists(true);
      setMessage('Sparat. Avgifterna gäller direkt på /medlemsavgift.');
    } catch {
      setError('Kunde inte spara.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPanel>
      <div>
        <a href="/admin" className="text-sm font-semibold text-muted no-underline hover:text-accent">← Admin</a>
        <AdminTitle>Medlemsavgifter</AdminTitle>
        <p className="mt-2 mb-0 max-w-[60ch] text-muted">
          Avgifterna per år. Besökare väljer sina klasser på /medlemsavgift och beloppet räknas ut av den här tabellen.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton onClick={() => setYear(year - 1)}>← {year - 1}</ActionButton>
        <strong className="font-display text-xl">{year}</strong>
        <ActionButton onClick={() => setYear(year + 1)} disabled={year >= now + 1}>{year + 1} →</ActionButton>
        {!exists && <span className="rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#7A5A00]">Inte sparad än</span>}
      </div>

      <Field label="Klubbens Swish-nummer" htmlFor="swish" hint="Bara siffror, t.ex. 1231234567.">
        <input id="swish" inputMode="numeric" className={INPUT} value={fees.swishNumber} onChange={(e) => setFees({ ...fees, swishNumber: e.target.value })} />
      </Field>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-display text-xl font-bold">Avgiftsklasser</h2>
        {fees.categories.map((c, i) => (
          <div key={c.id} className="grid gap-2 rounded-2xl bg-period p-3 sm:grid-cols-[1fr_120px_1fr_auto_auto] sm:items-center">
            <input className={INPUT} aria-label="Namn" placeholder="Namn, t.ex. Vuxen" value={c.label} maxLength={60} onChange={(e) => setCategory(i, { label: e.target.value })} />
            <input
              className={INPUT}
              aria-label="Avgift i kronor"
              inputMode="numeric"
              placeholder="kr"
              value={c.amount || ''}
              onChange={(e) => setCategory(i, { amount: Number(e.target.value.replace(/\D/g, '')) })}
            />
            <input className={INPUT} aria-label="Förklaring" placeholder="Förklaring, t.ex. t.o.m. 20 år" value={c.hint} maxLength={80} onChange={(e) => setCategory(i, { hint: e.target.value })} />
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={c.adult === true} onChange={(e) => setCategory(i, { adult: e.target.checked })} />
              Vuxen
            </label>
            <button type="button" onClick={() => setFees({ ...fees, categories: fees.categories.filter((_, j) => j !== i) })} className="cursor-pointer rounded-full px-3 py-2 text-sm font-semibold text-[#A33A3A] hover:bg-white">
              Ta bort
            </button>
          </div>
        ))}
        {fees.categories.length < FEE_LIMITS.categories && (
          <div>
            <ActionButton onClick={() => setFees({ ...fees, categories: [...fees.categories, { id: newId(), label: '', amount: 0, hint: '' }] })}>+ Ny klass</ActionButton>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-display text-xl font-bold">Familjetak</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={fees.family !== null} onChange={(e) => setFees({ ...fees, family: e.target.checked ? { amount: 0, minPeople: 3, maxAdults: 2 } : null })} />
          Familjepris när många är med
        </label>
        {fees.family && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Högst antal vuxna" htmlFor="max-adults" hint="Markera vilka klasser som är vuxna ovan.">
              <input id="max-adults" className={INPUT} inputMode="numeric" value={fees.family.maxAdults} onChange={(e) => setFees({ ...fees, family: { ...fees.family!, maxAdults: Number(e.target.value.replace(/\D/g, '')) } })} />
            </Field>
            <Field label="Från antal personer" htmlFor="min-people">
              <input id="min-people" className={INPUT} inputMode="numeric" value={fees.family.minPeople} onChange={(e) => setFees({ ...fees, family: { ...fees.family!, minPeople: Number(e.target.value.replace(/\D/g, '')) } })} />
            </Field>
            <Field label="Högsta avgift (kr)" htmlFor="family-amount" hint="Blir summan högre än så här betalar familjen det här beloppet i stället.">
              <input id="family-amount" className={INPUT} inputMode="numeric" value={fees.family.amount || ''} onChange={(e) => setFees({ ...fees, family: { ...fees.family!, amount: Number(e.target.value.replace(/\D/g, '')) } })} />
            </Field>
          </div>
        )}
      </section>

      {error && <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      {message && <p role="status" className="m-0 rounded-2xl bg-[#E3F0DC] px-4 py-3 text-sm text-[#2F5A2B]">{message}</p>}
      <div>
        <ActionButton primary onClick={save} disabled={!valid || busy} busy={busy}>Spara avgifter</ActionButton>
      </div>
    </AdminPanel>
  );
}
