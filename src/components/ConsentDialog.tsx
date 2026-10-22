import { useState } from 'react';

interface Props {
  uid: string;
  onAccepted: () => void;
  onPostpone: () => void;
}

/** Kort godkännande av integritetspolicyn. Visas för inloggade som inte godkänt aktuell version (se src/lib/consent.ts). */
export default function ConsentDialog({ uid, onAccepted, onPostpone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function accept() {
    setBusy(true);
    setError(false);
    try {
      const { acceptConsent } = await import('../lib/firebase/session');
      await acceptConsent(uid);
      onAccepted();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="flex max-h-full w-full max-w-[460px] flex-col gap-4 overflow-auto rounded-[28px] bg-white p-6 shadow-card sm:p-8"
      >
        <h2 id="consent-title" className="m-0 font-display text-2xl font-bold tracking-[-.02em]">
          Vi sparar dina uppgifter
        </h2>
        <p className="m-0 leading-[1.6]">
          För att du ska kunna ha ett konto hos OK Eken sparar vi ditt namn, din e-postadress och vilken behörighet du har.
          Vi använder dem bara för sidans inloggning och administration, och lämnar inte ut dem.
        </p>
        <p className="m-0 leading-[1.6]">
          Läs hela <a href="/integritet" target="_blank" rel="noopener" className="font-semibold text-accent">integritetspolicyn</a>,
          där du också ser hur du får dina uppgifter rättade eller raderade.
        </p>
        {error && (
          <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-[15px] text-[#8A2B2B]">
            Det gick inte att spara. Kontrollera uppkopplingen och försök igen.
          </p>
        )}
        <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            type="button"
            disabled={busy}
            onClick={accept}
            className="cursor-pointer rounded-full bg-accent px-6 py-[13px] text-base font-semibold text-white shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'Sparar…' : 'Jag godkänner'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onPostpone}
            className="cursor-pointer rounded-full border-[1.5px] border-ink/18 bg-white px-6 py-[13px] text-base font-semibold text-ink hover:border-accent disabled:opacity-60"
          >
            Fråga mig senare
          </button>
        </div>
        <p className="m-0 text-[13px] text-subtle">Du får frågan igen nästa gång du loggar in, tills du godkänt.</p>
      </div>
    </div>
  );
}
