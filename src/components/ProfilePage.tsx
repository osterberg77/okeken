import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AVATAR_COLORS, DEFAULT_AVATAR_COLOR, isAvatarColor, type AvatarColor } from '../lib/avatar';
import { rememberedSignIn } from '../lib/firebase/flags';
import { CONSENT_VERSION, hasCurrentConsent } from '../lib/consent';
import { ImageRejected } from '../lib/image-resize';
import type { Session } from '../types/user';
import Avatar from './Avatar';

type Profile = typeof import('../lib/firebase/profile');

const MIN_PASSWORD = 8;
const CONFIRM_WORD = 'RADERA';

function errorMessage(err: unknown): string {
  if (err instanceof ImageRejected) return err.message;
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Fel lösenord.';
    case 'auth/weak-password':
      return `Lösenordet behöver vara minst ${MIN_PASSWORD} tecken.`;
    case 'auth/email-already-in-use':
      return 'Den adressen används redan av ett annat konto.';
    case 'auth/invalid-email':
      return 'E-postadressen ser inte ut att stämma.';
    case 'auth/requires-recent-login':
    case 'functions/failed-precondition':
      return (err as Error).message?.startsWith('Du är den sista') ? (err as Error).message : 'Av säkerhetsskäl behöver du logga in på nytt. Logga ut, logga in igen och försök direkt.';
    case 'auth/too-many-requests':
      return 'För många försök. Vänta en stund.';
    case 'auth/network-request-failed':
      return 'Ingen kontakt med servern. Kontrollera uppkopplingen.';
    default:
      return 'Något gick fel. Försök igen.';
  }
}

export default function ProfilePage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!rememberedSignIn()) {
      location.replace('/logga-in?next=/profil');
      return;
    }
    let stop = () => {};
    let cancelled = false;
    Promise.all([import('../lib/firebase/session'), import('../lib/firebase/profile')]).then(([{ watchSession }, p]) => {
      if (cancelled) return;
      setProfile(p);
      stop = watchSession((s) => {
        if (s === null) location.replace('/logga-in?next=/profil');
        setSession(s);
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  if (!session || !profile) return <p className="text-muted">Laddar…</p>;
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6">
      <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">Profil och inställningar</h1>
      <ProfileSection session={session} profile={profile} />
      <LoginSection session={session} profile={profile} />
      <PrivacySection session={session} profile={profile} />
      <DeleteSection session={session} profile={profile} />
    </div>
  );
}

// ---- Profil: namn, färg, bild -------------------------------------------------------------------------

function ProfileSection({ session, profile }: { session: Session; profile: Profile }) {
  const [name, setName] = useState(session.displayName);
  const [color, setColor] = useState<AvatarColor>(isAvatarColor(session.avatarColor) ? session.avatarColor : DEFAULT_AVATAR_COLOR);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: done });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const save = (e: FormEvent) => {
    e.preventDefault();
    run(
      () => profile.saveProfile(session.uid, { displayName: name.trim(), avatarColor: color, hidden: session.hidden === true }),
      'Sparat.',
    );
  };

  return (
    <Card title="Profil">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={name || session.email} color={color} photoUrl={session.photoUrl} size={88} />
        <div className="flex flex-col items-start gap-2">
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) run(() => profile.uploadAvatar(session.uid, f), 'Profilbilden är sparad.');
            }}
          />
          <Button secondary disabled={busy} onClick={() => file.current?.click()}>
            {session.photoUrl ? 'Byt bild' : 'Ladda upp bild'}
          </Button>
          {session.photoUrl && (
            <TextButton disabled={busy} onClick={() => run(() => profile.removeAvatar(session.uid), 'Bilden är borttagen.')}>
              Ta bort bilden
            </TextButton>
          )}
        </div>
      </div>
      <p className="m-0 text-sm text-muted">Bilden beskärs till en kvadrat. Utan bild visas din initial på den färg du väljer.</p>

      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Namn" id="profile-name">
          <input id="profile-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={INPUT} autoComplete="name" />
        </Field>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-sm font-semibold">Färg</legend>
          <div className="flex flex-wrap gap-2.5">
            {(Object.keys(AVATAR_COLORS) as AvatarColor[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-label={AVATAR_COLORS[id].label}
                aria-pressed={color === id}
                onClick={() => setColor(id)}
                style={{ background: `linear-gradient(135deg,${AVATAR_COLORS[id].from},${AVATAR_COLORS[id].to})` }}
                className={`h-9 w-9 cursor-pointer rounded-full border-0 ${color === id ? 'ring-[3px] ring-ink ring-offset-2' : ''}`}
              />
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Sparar…' : 'Spara'}
        </Button>
      </form>
      <Message message={message} />
    </Card>
  );
}

// ---- Inloggning: e-post och lösenord -----------------------------------------------------------------

function LoginSection({ session, profile }: { session: Session; profile: Profile }) {
  const withPassword = profile.hasPasswordLogin();
  const google = profile.usesGoogle();
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(setMsg: typeof setEmailMsg, action: () => Promise<void>, done: string, after?: () => void) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      setMsg({ ok: true, text: done });
      after?.();
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Inloggning">
      <p className="m-0">
        Din e-postadress: <strong>{session.email}</strong>
      </p>

      {google && !withPassword ? (
        <p className="m-0 text-sm text-muted">Du loggar in med Google, så e-postadressen styrs av ditt Google-konto.</p>
      ) : withPassword ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              setEmailMsg,
              () => profile.requestEmailChange(newEmail.trim(), emailPassword),
              `Vi har mejlat en länk till ${newEmail.trim()}. Adressen byts när du klickat på den.`,
              () => {
                setNewEmail('');
                setEmailPassword('');
              },
            );
          }}
        >
          <h3 className="m-0 font-display text-lg font-bold">Byt e-postadress</h3>
          <Field label="Ny e-postadress" id="new-email">
            <input id="new-email" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={INPUT} autoComplete="email" />
          </Field>
          <Field label="Ditt nuvarande lösenord" id="email-password">
            <input id="email-password" type="password" required value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className={INPUT} autoComplete="current-password" />
          </Field>
          <Button type="submit" disabled={busy}>Skicka bekräftelselänk</Button>
          <Message message={emailMsg} />
        </form>
      ) : null}

      <div className="h-px bg-line" />

      {withPassword ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(setPasswordMsg, () => profile.changePassword(current, next), 'Lösenordet är bytt.', () => {
              setCurrent('');
              setNext('');
            });
          }}
        >
          <h3 className="m-0 font-display text-lg font-bold">Byt lösenord</h3>
          <Field label="Nuvarande lösenord" id="current-password">
            <input id="current-password" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={INPUT} autoComplete="current-password" />
          </Field>
          <Field label="Nytt lösenord" id="next-password" hint={`Minst ${MIN_PASSWORD} tecken`}>
            <input id="next-password" type="password" required minLength={MIN_PASSWORD} value={next} onChange={(e) => setNext(e.target.value)} className={INPUT} autoComplete="new-password" />
          </Field>
          <Button type="submit" disabled={busy}>Byt lösenord</Button>
          <Message message={passwordMsg} />
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="m-0 font-display text-lg font-bold">Lösenord</h3>
          <p className="m-0 text-sm text-muted">Du har inget lösenord än. Vi mejlar en länk där du väljer ett, så kan du även logga in med e-post och lösenord.</p>
          <Button
            secondary
            disabled={busy}
            onClick={async () => {
              const { sendPasswordReset } = await import('../lib/firebase/session');
              run(setPasswordMsg, () => sendPasswordReset(session.email), `Vi har mejlat en länk till ${session.email}.`);
            }}
          >
            Skicka länk för att välja lösenord
          </Button>
          <Message message={passwordMsg} />
        </div>
      )}
    </Card>
  );
}

// ---- Integritet ---------------------------------------------------------------------------------------

function PrivacySection({ session, profile }: { session: Session; profile: Profile }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const consented = hasCurrentConsent(session.consent);

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: done });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Integritet">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-1.5"
          checked={session.hidden === true}
          disabled={busy}
          onChange={(e) =>
            run(
              () =>
                profile.saveProfile(session.uid, {
                  displayName: session.displayName,
                  avatarColor: isAvatarColor(session.avatarColor) ? session.avatarColor : DEFAULT_AVATAR_COLOR,
                  hidden: e.target.checked,
                }),
              'Sparat.',
            )
          }
        />
        <span>
          Dölj mig
          <span className="block text-sm text-muted">Ditt namn tas bort helt från sidor som visas för besökare och andra medlemmar, till exempel resultat, svar på events och "publicerat av". Styrelsen och de som ansvarar för ett event där du deltar ser dig fortfarande. Dina svar räknas ändå. Ändringen syns på publika sidor efter ett par minuter (när sajten byggts om). Eventor och andra tjänster utanför okeken.se påverkas inte.</span>
        </span>
      </label>

      <div className="h-px bg-line" />

      <p className="m-0">
        Integritetspolicy: {consented ? <strong>godkänd</strong> : <strong>inte godkänd</strong>}{' '}
        <span className="text-sm text-muted">(version {CONSENT_VERSION})</span>
      </p>
      <div className="flex flex-wrap gap-3">
        <a href="/integritet" className="font-semibold text-accent">Läs integritetspolicyn</a>
        {consented ? (
          <TextButton disabled={busy} onClick={() => run(() => profile.withdrawConsent(session.uid), 'Godkännandet är återkallat. Du får frågan igen nästa gång du loggar in.')}>
            Ta tillbaka mitt godkännande
          </TextButton>
        ) : (
          <TextButton
            disabled={busy}
            onClick={() => run(async () => (await import('../lib/firebase/session')).acceptConsent(session.uid), 'Tack, godkänt.')}
          >
            Godkänn
          </TextButton>
        )}
      </div>
      <Message message={message} />
    </Card>
  );
}

// ---- Ta bort kontot -----------------------------------------------------------------------------------

function DeleteSection({ session, profile }: { session: Session; profile: Profile }) {
  const withPassword = profile.hasPasswordLogin();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await profile.deleteAccount(withPassword ? password : null);
      location.replace('/');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card title="Ta bort kontot" danger>
      {!open ? (
        <>
          <p className="m-0">Du kan ta bort ditt konto permanent. Det går inte att ångra.</p>
          <Button danger onClick={() => setOpen(true)}>Ta bort mitt konto…</Button>
        </>
      ) : (
        <form onSubmit={remove} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="m-0 font-semibold">Det här tas bort direkt:</p>
            <ul className="m-0 pl-5">
              <li>ditt konto, ditt namn, din e-postadress och dina behörigheter,</li>
              <li>din profilbild och dina inställningar,</li>
              <li>alla dina svar på events (Kommer / Kommer inte).</li>
            </ul>
            <p className="m-0 font-semibold">Det här blir kvar:</p>
            <ul className="m-0 pl-5">
              <li>
                Innehåll du skapat (events, sidor, bilder) finns kvar, men utan koppling till dig.
              </li>
              <li>Styrelsens protokoll är föreningens handlingar och behåller namnen som stod där när de skrevs.</li>
            </ul>
            {session.permissions.includes('superadmin') && (
              <p className="m-0 text-sm text-muted">Du är superadmin: den sista superadmin kan inte ta bort sitt konto.</p>
            )}
          </div>
          {withPassword && (
            <Field label="Ditt lösenord" id="delete-password">
              <input id="delete-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} autoComplete="current-password" />
            </Field>
          )}
          <Field label={`Skriv ${CONFIRM_WORD} för att bekräfta`} id="delete-confirm">
            <input id="delete-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} autoComplete="off" />
          </Field>
          {error && (
            <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-[15px] text-[#8A2B2B]">{error}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button danger type="submit" disabled={busy || confirm.trim().toUpperCase() !== CONFIRM_WORD || (withPassword && !password)}>
              {busy ? 'Tar bort…' : 'Ta bort kontot permanent'}
            </Button>
            <Button secondary disabled={busy} onClick={() => { setOpen(false); setConfirm(''); setPassword(''); setError(''); }}>
              Avbryt
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

// ---- Små byggstenar ------------------------------------------------------------------------------------

const INPUT = 'w-full rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-3 text-[17px] outline-none focus:border-accent';

function Card({ title, danger, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-4 rounded-[28px] bg-white p-6 shadow-card sm:p-8 ${danger ? 'border-[1.5px] border-[#E7BEBE]' : ''}`}>
      <h2 className="m-0 font-display text-2xl font-bold tracking-[-.02em]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && <span className="text-[13px] text-subtle">{hint}</span>}
    </div>
  );
}

function Button({
  children,
  onClick,
  type = 'button',
  disabled,
  secondary,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  const style = danger
    ? 'bg-[#B04545] text-white shadow-[0_8px_18px_-8px_#B04545]'
    : secondary
      ? 'border-[1.5px] border-ink/18 bg-white text-ink hover:border-accent'
      : 'bg-accent text-white shadow-[0_8px_18px_-8px_#8A4B9E]';
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`cursor-pointer self-start rounded-full px-6 py-[12px] text-base font-semibold hover:brightness-110 disabled:cursor-default disabled:opacity-50 ${style}`}
    >
      {children}
    </button>
  );
}

function TextButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="cursor-pointer text-left text-sm font-semibold text-accent disabled:opacity-50">
      {children}
    </button>
  );
}

function Message({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p
      role={message.ok ? 'status' : 'alert'}
      className={`m-0 rounded-2xl px-4 py-3 text-[15px] ${message.ok ? 'bg-[#E3F0DC] text-[#2F5A2B]' : 'bg-[#FBEAEA] text-[#8A2B2B]'}`}
    >
      {message.text}
    </p>
  );
}
