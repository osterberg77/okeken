import { useEffect, useState, type FormEvent } from 'react';
import { safeNext } from '../../lib/firebase/flags';
import {
  completeEmailLink,
  isEmailLink,
  pendingEmail,
  sendEmailLink,
  signInWithGoogle,
} from '../../lib/firebase/session';

type State =
  | { step: 'start' }
  | { step: 'busy' }
  | { step: 'sent'; email: string }
  | { step: 'confirmEmail' } // länken öppnad i en annan webbläsare än den som begärde den
  | { step: 'error'; message: string };

function errorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
  if (code === 'auth/invalid-email') return 'E-postadressen ser inte ut att stämma.';
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code')
    return 'Länken har redan använts eller gått ut. Begär en ny.';
  if (code === 'auth/operation-not-allowed') return 'Inloggningssättet är inte aktiverat. Kontakta klubben.';
  if (code === 'auth/network-request-failed') return 'Ingen kontakt med servern. Kontrollera uppkopplingen.';
  return 'Något gick fel vid inloggningen. Försök igen.';
}

export default function LoginForm() {
  const [state, setState] = useState<State>({ step: 'start' });
  const [email, setEmail] = useState('');
  const next = safeNext(new URLSearchParams(location.search).get('next'));

  const done = () => location.replace(next);

  async function run(action: () => Promise<void>, onSuccess: () => void) {
    setState({ step: 'busy' });
    try {
      await action();
      onSuccess();
    } catch (err) {
      const message = errorMessage(err);
      setState(message ? { step: 'error', message } : { step: 'start' });
    }
  }

  // Användaren kommer tillbaka via länken i mejlet
  useEffect(() => {
    if (!isEmailLink()) return;
    const saved = pendingEmail();
    if (saved) run(() => completeEmailLink(saved), done);
    else setState({ step: 'confirmEmail' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (state.step === 'confirmEmail') run(() => completeEmailLink(address), done);
    else run(() => sendEmailLink(address, next), () => setState({ step: 'sent', email: address }));
  }

  if (state.step === 'sent') {
    return (
      <Card>
        <h1 className="m-0 font-display text-[32px] leading-[1.1] font-bold tracking-[-.02em]">Kolla din inkorg</h1>
        <p className="text-[17px] leading-[1.65]">
          Vi har skickat en inloggningslänk till <strong>{state.email}</strong>. Öppna länken i den här webbläsaren så
          loggas du in direkt.
        </p>
        <p className="text-sm text-muted">Hittar du inget? Titta i skräpposten eller försök igen om en stund.</p>
        <button type="button" onClick={() => setState({ step: 'start' })} className="self-start text-sm font-semibold text-accent">
          Använd en annan adress
        </button>
      </Card>
    );
  }

  const busy = state.step === 'busy';
  const confirming = state.step === 'confirmEmail';

  return (
    <Card>
      <h1 className="m-0 font-display text-[32px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">Logga in</h1>
      <p className="text-muted">
        {confirming
          ? 'Skriv in e-postadressen som länken skickades till, så slutför vi inloggningen.'
          : 'För dig som publicerar, lägger banor eller sitter i styrelsen. Besökare behöver inte logga in.'}
      </p>

      {!confirming && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(signInWithGoogle, done)}
            className="flex cursor-pointer items-center justify-center gap-3 rounded-full border-[1.5px] border-ink/18 bg-white px-6 py-[13px] text-sm font-semibold text-ink hover:border-accent disabled:opacity-60"
          >
            <GoogleLogo />
            Fortsätt med Google
          </button>
          <div className="flex items-center gap-3 text-xs font-semibold tracking-[.12em] text-subtle">
            <span className="h-px flex-1 bg-line" />
            ELLER
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-semibold">
          E-postadress
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-full bg-accent px-6 py-[13px] text-sm font-semibold text-white shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Vänta…' : confirming ? 'Logga in' : 'Skicka inloggningslänk'}
        </button>
      </form>

      {state.step === 'error' && (
        <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">
          {state.message}
        </p>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[460px] flex-col gap-[18px] rounded-[28px] bg-white px-6 py-8 shadow-card sm:px-[38px] sm:py-[38px]">
      {children}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
