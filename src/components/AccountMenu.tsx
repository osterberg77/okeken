import { useEffect, useRef, useState } from 'react';
import { rememberedSignIn } from '../lib/firebase/flags';
import type { Session } from '../types/user';
import { hasAdminAccess } from '../lib/admin-nav';
import PermissionTag from './PermissionTag';
import ConsentDialog from './ConsentDialog';
import Avatar from './Avatar';
import { hasCurrentConsent, postponed, setPostponed } from '../lib/consent';

// Firebase laddas bara för den som varit inloggad på den här enheten,
// så vanliga besökare får ingen extra JavaScript.
type Session$ = Session | null | undefined; // undefined = laddar

export default function AccountMenu() {
  const [session, setSession] = useState<Session$>(undefined);
  const [open, setOpen] = useState(false);
  const [passwordMail, setPasswordMail] = useState<'idle' | 'sent' | 'error'>('idle');
  const root = useRef<HTMLDivElement>(null);
  // Frågan visas direkt efter inloggning och igen via menyn tills användaren godkänt
  const [consentAsked, setConsentAsked] = useState(() => postponed());

  useEffect(() => {
    if (!rememberedSignIn()) {
      setSession(null);
      return;
    }
    let stop = () => {};
    let cancelled = false;
    import('../lib/firebase/session').then(({ watchSession }) => {
      if (!cancelled) stop = watchSession(setSession);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function onChoosePassword() {
    if (!session) return;
    try {
      const { sendPasswordReset } = await import('../lib/firebase/session');
      await sendPasswordReset(session.email);
      setPasswordMail('sent');
    } catch {
      setPasswordMail('error');
    }
  }

  async function onSignOut() {
    const { signOut } = await import('../lib/firebase/session');
    await signOut();
    location.href = '/';
  }

  if (session === null) {
    const path = typeof location === 'undefined' ? '/' : location.pathname;
    const next = path === '/' || path.startsWith('/logga-in') ? '' : `?next=${encodeURIComponent(path)}`;
    return (
      <a
        href={`/logga-in${next}`}
        className="inline-block rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-ink no-underline shadow-chip hover:bg-white hover:text-accent"
      >
        Logga in
      </a>
    );
  }

  const name = session?.displayName || session?.email || '';
  // 44 px på mobil, 56 px från sm och uppåt (som tidigare)
  const [avatarSize, setAvatarSize] = useState(44);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setAvatarSize(mq.matches ? 56 : 44);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const needsConsent = !!session && !hasCurrentConsent(session.consent);
  return (
    <div ref={root} className="relative">
      {needsConsent && session && !consentAsked && (
        <ConsentDialog
          uid={session.uid}
          onAccepted={() => setPostponed(false)}
          onPostpone={() => {
            setPostponed(true);
            setConsentAsked(true);
          }}
        />
      )}
      <button
        type="button"
        onClick={() => session && setOpen((o) => !o)}
        aria-label="Min profil"
        aria-haspopup="true"
        aria-expanded={open}
        className="cursor-pointer rounded-full"
      >
        <Avatar name={name} color={session?.avatarColor} photoUrl={session?.photoUrl} size={avatarSize} />
      </button>
      {open && session && (
        <div className="absolute top-[56px] right-0 z-20 flex w-[272px] flex-col gap-3 rounded-[22px] bg-white p-[18px] shadow-[0_24px_48px_-20px_rgba(43,40,56,.45),0_2px_8px_rgba(43,40,56,.08)] sm:top-[68px]">
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-lg font-bold">{name}</span>
            {session.displayName && <span className="text-[13px] text-subtle">{session.email}</span>}
            {session.permissions.length > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {session.permissions.map((p) => (
                  <PermissionTag key={p} permission={p} />
                ))}
              </span>
            )}
          </div>
          <div className="h-px bg-line" />
          <a href="/profil" className="py-1.5 font-medium text-ink no-underline hover:text-accent">
            Profil och inställningar
          </a>
          {hasAdminAccess(session.permissions) && (
            <>
              <div className="h-px bg-line" />
              <a href="/admin" className="py-1.5 font-medium text-ink no-underline hover:text-accent">
                Administration
              </a>
            </>
          )}
          <div className="h-px bg-line" />
          {passwordMail === 'idle' ? (
            <button type="button" onClick={onChoosePassword} className="cursor-pointer py-1.5 text-left font-medium text-ink hover:text-accent">
              Välj eller byt lösenord
            </button>
          ) : (
            <p className="m-0 text-[13px] text-muted">
              {passwordMail === 'sent'
                ? `Vi har mejlat en länk till ${session.email} där du väljer lösenord.`
                : 'Kunde inte skicka mejlet. Försök igen senare.'}
            </p>
          )}
          {needsConsent ? (
            <button type="button" onClick={() => { setOpen(false); setConsentAsked(false); }} className="cursor-pointer py-1.5 text-left font-medium text-ink hover:text-accent">
              Godkänn integritetspolicyn
            </button>
          ) : (
            <a href="/integritet" className="py-1.5 font-medium text-ink no-underline hover:text-accent">
              Integritetspolicy
            </a>
          )}
          <button type="button" onClick={onSignOut} className="cursor-pointer py-1.5 text-left font-semibold text-accent">
            Logga ut
          </button>
        </div>
      )}
    </div>
  );
}
