import { useEffect, useRef, useState } from 'react';
import { rememberedSignIn } from '../lib/firebase/flags';
import { canManageUsers, canPublish, type Session } from '../types/user';
import PermissionTag from './PermissionTag';

// Firebase laddas bara för den som varit inloggad på den här enheten,
// så vanliga besökare får ingen extra JavaScript.
type Session$ = Session | null | undefined; // undefined = laddar

export default function AccountMenu() {
  const [session, setSession] = useState<Session$>(undefined);
  const [open, setOpen] = useState(false);
  const [passwordMail, setPasswordMail] = useState<'idle' | 'sent' | 'error'>('idle');
  const root = useRef<HTMLDivElement>(null);

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
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => session && setOpen((o) => !o)}
        aria-label="Min profil"
        aria-haspopup="true"
        aria-expanded={open}
        className="h-11 w-11 cursor-pointer rounded-full bg-[linear-gradient(135deg,#C9A7DA,#8A4B9E)] font-display text-lg font-bold text-white shadow-[0_8px_18px_-8px_#8A4B9E,0_0_0_3px_#fff] sm:h-14 sm:w-14 sm:text-[22px]"
      >
        {name.charAt(0).toUpperCase()}
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
          {(canPublish(session.permissions) || canManageUsers(session.permissions)) && <div className="h-px bg-line" />}
          {canPublish(session.permissions) && (
            <a href="/admin/events" className="py-1.5 font-medium text-ink no-underline hover:text-accent">
              Events
            </a>
          )}
          {canManageUsers(session.permissions) && (
            <>
              <a href="/admin/anvandare" className="py-1.5 font-medium text-ink no-underline hover:text-accent">
                Användare och behörigheter
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
          <button type="button" onClick={onSignOut} className="cursor-pointer py-1.5 text-left font-semibold text-accent">
            Logga ut
          </button>
        </div>
      )}
    </div>
  );
}
