import { useEffect, useState, type ReactNode } from 'react';
import { watchSession } from '../../lib/firebase/session';
import type { Permission, Session } from '../../types/user';

interface Props {
  /** Krav för att se sidan; reglerna är det verkliga skyddet */
  allowed: (permissions: Permission[]) => boolean;
  /** Vad som krävs, för meddelandet till den som saknar behörighet */
  requirement: string;
  children: (session: Session) => ReactNode;
}

export default function AdminGate({ allowed, requirement, children }: Props) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => watchSession(setSession), []);

  if (session === undefined) return <AdminPanel><p className="text-muted">Laddar…</p></AdminPanel>;
  if (session === null) {
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <AdminPanel>
        <p>
          Du behöver{' '}
          <a href={`/logga-in?next=${next}`} className="font-semibold text-accent">
            logga in
          </a>{' '}
          för att se den här sidan.
        </p>
      </AdminPanel>
    );
  }
  if (!allowed(session.permissions)) {
    return (
      <AdminPanel>
        <p>Du saknar behörighet för den här sidan. Det kräver {requirement}. Kontakta styrelsen om du behöver det.</p>
      </AdminPanel>
    );
  }
  return <>{children(session)}</>;
}

export function AdminPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-5 rounded-[28px] bg-white px-6 py-8 shadow-card sm:px-[38px] sm:py-[38px] ${className}`}>
      {children}
    </div>
  );
}

export function AdminTitle({ children }: { children: ReactNode }) {
  return <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">{children}</h1>;
}
