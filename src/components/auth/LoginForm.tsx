import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { safeNext } from '../../lib/firebase/flags';
import {
  completeEmailLink,
  createAccount,
  isEmailLink,
  pendingEmail,
  sendEmailLink,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
} from '../../lib/firebase/session';

type Mode = 'password' | 'create' | 'reset' | 'link' | 'confirmLink';

interface Notice {
  title: string;
  text: ReactNode;
}

const MIN_PASSWORD = 8;

function errorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Fel e-postadress eller lösenord. Har du tidigare loggat in med Google eller länk? Välj "Glömt lösenord?" så får du sätta ett lösenord.';
    case 'auth/email-already-in-use':
      return 'Det finns redan ett konto med den adressen. Logga in, eller välj "Glömt lösenord?".';
    case 'auth/weak-password':
      return `Lösenordet behöver vara minst ${MIN_PASSWORD} tecken.`;
    case 'auth/too-many-requests':
      return 'För många försök. Vänta en stund, eller välj "Glömt lösenord?".';
    case 'auth/invalid-email':
      return 'E-postadressen ser inte ut att stämma.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'Länken har redan använts eller gått ut. Begär en ny.';
    case 'auth/operation-not-allowed':
      return 'Inloggningssättet är inte aktiverat. Kontakta klubben.';
    case 'auth/network-request-failed':
      return 'Ingen kontakt med servern. Kontrollera uppkopplingen.';
    default:
      return 'Något gick fel vid inloggningen. Försök igen.';
  }
}

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>('password');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const next = safeNext(new URLSearchParams(location.search).get('next'));

  const done = () => location.replace(next);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function go(m: Mode) {
    setMode(m);
    setError('');
  }

  // Användaren kommer tillbaka via inloggningslänken i mejlet
  useEffect(() => {
    if (!isEmailLink()) return;
    const saved = pendingEmail();
    if (saved) run(async () => { await completeEmailLink(saved); done(); });
    else setMode('confirmLink');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    run(async () => {
      if (mode === 'password') {
        if ((await signInWithPassword(address, password)) === 'ok') done();
        else
          setNotice({
            title: 'Bekräfta din e-postadress',
            text: <>Kontot är inte bekräftat än. Vi har skickat ett nytt mejl till <strong>{address}</strong>. Klicka på länken i det och logga sedan in här igen.</>,
          });
      } else if (mode === 'create') {
        await createAccount(name.trim(), address, password);
        setNotice({
          title: 'Bekräfta din e-postadress',
          text: <>Vi har skickat ett mejl till <strong>{address}</strong>. Klicka på länken i det och logga sedan in här med ditt lösenord. Styrelsen ger dig därefter behörighet.</>,
        });
      } else if (mode === 'reset') {
        await sendPasswordReset(address);
        setNotice({
          title: 'Kolla din inkorg',
          text: <>Om det finns ett konto för <strong>{address}</strong> har vi skickat en länk där du väljer ett nytt lösenord.</>,
        });
      } else if (mode === 'link') {
        await sendEmailLink(address, next);
        setNotice({
          title: 'Kolla din inkorg',
          text: <>Vi har skickat en inloggningslänk till <strong>{address}</strong>. Öppna den i den här webbläsaren så loggas du in direkt.</>,
        });
      } else {
        await completeEmailLink(address);
        done();
      }
    });
  }

  if (notice) {
    return (
      <Card>
        <Title>{notice.title}</Title>
        <p className="text-[17px] leading-[1.65]">{notice.text}</p>
        <p className="text-sm text-muted">Hittar du inget mejl? Titta i skräpposten.</p>
        <TextButton onClick={() => { setNotice(null); go('password'); }}>Tillbaka till inloggningen</TextButton>
      </Card>
    );
  }

  const titles: Record<Mode, string> = {
    password: 'Logga in',
    create: 'Skapa konto',
    reset: 'Glömt lösenord',
    link: 'Logga in med länk',
    confirmLink: 'Slutför inloggningen',
  };
  const intros: Record<Mode, string> = {
    password: 'För dig som publicerar, lägger banor eller sitter i styrelsen. Besökare behöver inte logga in.',
    create: 'Efter att du bekräftat e-postadressen ger styrelsen dig rätt behörighet.',
    reset: 'Skriv din e-postadress så mejlar vi en länk där du väljer ett nytt lösenord. Fungerar också om du aldrig haft något lösenord.',
    link: 'Inget lösenord behövs: vi mejlar en länk som loggar in dig.',
    confirmLink: 'Skriv in e-postadressen som länken skickades till.',
  };
  const submitLabels: Record<Mode, string> = {
    password: 'Logga in',
    create: 'Skapa konto',
    reset: 'Skicka länk för nytt lösenord',
    link: 'Skicka inloggningslänk',
    confirmLink: 'Logga in',
  };
  const withPassword = mode === 'password' || mode === 'create';

  return (
    <Card>
      <Title>{titles[mode]}</Title>
      <p className="text-muted">{intros[mode]}</p>

      {mode === 'password' && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(async () => { await signInWithGoogle(); done(); })}
            className="flex cursor-pointer items-center justify-center gap-3 rounded-full border-[1.5px] border-ink/18 bg-white px-6 py-[13px] text-base font-semibold text-ink hover:border-accent disabled:opacity-60"
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

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === 'create' && (
          <Field label="Namn" id="name">
            <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </Field>
        )}
        <Field label="E-postadress" id="email">
          <input
            id="email"
            type="email"
            required
            autoComplete={mode === 'create' ? 'email' : 'username'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </Field>
        {withPassword && (
          <Field
            label="Lösenord"
            id="password"
            hint={mode === 'create' ? `Minst ${MIN_PASSWORD} tecken` : undefined}
            aside={
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="cursor-pointer text-sm font-semibold text-accent">
                {showPassword ? 'Dölj' : 'Visa'}
              </button>
            }
          >
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={mode === 'create' ? MIN_PASSWORD : undefined}
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
            />
          </Field>
        )}

        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-full bg-accent px-6 py-[14px] text-base font-semibold text-white shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Vänta…' : submitLabels[mode]}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-[15px] text-[#8A2B2B]">
          {error}
        </p>
      )}

      <div className="flex flex-col items-start gap-2.5 border-t border-line pt-4">
        {mode === 'password' ? (
          <>
            <TextButton onClick={() => go('reset')}>Glömt lösenord?</TextButton>
            <TextButton onClick={() => go('create')}>Första gången? Skapa konto</TextButton>
            <TextButton onClick={() => go('link')}>Logga in utan lösenord, med en länk i mejlet</TextButton>
          </>
        ) : (
          <TextButton onClick={() => go('password')}>
            {mode === 'create' ? 'Har du redan ett konto? Logga in' : 'Tillbaka till inloggningen'}
          </TextButton>
        )}
      </div>
    </Card>
  );
}

const INPUT =
  'w-full rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-3 text-[17px] outline-none focus:border-accent';

function Field({ label, id, hint, aside, children }: { label: string; id: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[15px] font-semibold">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <h1 className="m-0 font-display text-[32px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">{children}</h1>;
}

function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer text-left text-[15px] font-semibold text-accent hover:underline">
      {children}
    </button>
  );
}

function Card({ children }: { children: ReactNode }) {
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
