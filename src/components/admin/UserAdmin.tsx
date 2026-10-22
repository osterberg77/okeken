import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/firebase/client';
import { watchSession } from '../../lib/firebase/session';
import {
  assignableBy,
  canManageUsers,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
  PERMISSIONS,
  type Permission,
  type Session,
  type UserProfile,
} from '../../types/user';

export default function UserAdmin() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => watchSession(setSession), []);

  if (session === undefined) return <Panel><p className="text-muted">Laddar…</p></Panel>;
  if (session === null) {
    return (
      <Panel>
        <p>
          Du behöver{' '}
          <a href="/logga-in?next=/admin/anvandare" className="font-semibold text-accent">
            logga in
          </a>{' '}
          för att hantera användare.
        </p>
      </Panel>
    );
  }
  if (!canManageUsers(session.permissions)) {
    return (
      <Panel>
        <p>Du saknar behörighet att hantera användare. Det kräver styrelse eller superadmin.</p>
      </Panel>
    );
  }
  return <UserList session={session} />;
}

function UserList({ session }: { session: Session }) {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string | null>(null); // `${uid}:${permission}`
  const [error, setError] = useState('');
  const assignable = assignableBy(session.permissions);

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'users'),
        (snap) =>
          setUsers(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                uid: d.id,
                email: data.email ?? '',
                displayName: data.displayName ?? '',
                permissions: (data.permissions ?? []) as Permission[],
              };
            }),
          ),
        () => setError('Kunde inte läsa användarlistan.'),
      ),
    [],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => !q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email, 'sv'));
  }, [users, query]);

  async function toggle(user: UserProfile, permission: Permission) {
    const on = user.permissions.includes(permission);
    const permissions = on ? user.permissions.filter((p) => p !== permission) : [...user.permissions, permission];
    setPending(`${user.uid}:${permission}`);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), { permissions });
    } catch {
      setError(`Ändringen för ${user.displayName || user.email} sparades inte. Du kanske saknar behörighet för den rollen.`);
    } finally {
      setPending(null);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">
            Användare och behörigheter
          </h1>
          <p className="mt-2 text-muted">
            Nya konton dyker upp här när personen loggat in första gången.
            {!session.permissions.includes('superadmin') && ' Som styrelse kan du ge medlem, banläggare och publicerare.'}
          </p>
        </div>
        <input
          type="search"
          placeholder="Sök namn eller e-post"
          aria-label="Sök användare"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-full border-[1.5px] border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent sm:w-64"
        />
      </div>

      <PermissionHelp />

      {error && (
        <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">
          {error}
        </p>
      )}

      {users === null ? (
        <p className="text-muted">Laddar användare…</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {shown.map((user) => (
            <li key={user.uid} className="flex flex-col gap-3 rounded-[22px] bg-period px-5 py-4 lg:flex-row lg:items-center">
              <div className="min-w-0 lg:w-72 lg:flex-none">
                <div className="truncate font-display text-[17px] font-semibold">
                  {user.displayName || user.email}
                  {user.uid === session.uid && <span className="ml-2 text-xs font-semibold text-subtle">(du)</span>}
                </div>
                {user.displayName && <div className="truncate text-[13px] text-subtle">{user.email}</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                {PERMISSIONS.map((p) => {
                  const on = user.permissions.includes(p);
                  const lockedSelf = p === 'superadmin' && user.uid === session.uid; // reglerna nekar
                  const enabled = assignable.includes(p) && !lockedSelf && pending === null;
                  return (
                    <label
                      key={p}
                      title={PERMISSION_DESCRIPTIONS[p]}
                      className={`inline-flex items-center gap-2 rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold select-none ${
                        on ? 'border-accent bg-white text-ink' : 'border-ink/12 bg-white/60 text-muted'
                      } ${enabled ? 'cursor-pointer hover:border-accent' : 'cursor-not-allowed opacity-55'}`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#8A4B9E]"
                        checked={on}
                        disabled={!enabled}
                        onChange={() => toggle(user, p)}
                      />
                      {PERMISSION_LABELS[p]}
                      {pending === `${user.uid}:${p}` && <span className="text-subtle">…</span>}
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="text-muted">Inga användare matchar sökningen.</li>}
        </ul>
      )}
    </Panel>
  );
}

const PERMISSION_DETAILS: Record<Permission, string> = {
  member: 'Är inloggad medlem. Ger ingen åtkomst till adminsidorna än, men markerar att personen hör till klubben.',
  course_setter: 'Kan se alla events (även utkast) och ladda upp banor som PDF till ett event. Kan inte ändra något annat på eventet.',
  publisher: 'Kan skapa, redigera och publicera events och infosidor, ändra huvudmenyn och använda bildbanken.',
  board: 'Allt en publicerare kan, plus läsa och skriva styrelsens protokoll. Kan ge och ta bort medlem, banläggare och publicerare.',
  superadmin: 'Allt, inklusive att ge och ta bort styrelse och superadmin. Du kan inte ta bort din egen superadmin.',
};

function PermissionHelp() {
  return (
    <details className="rounded-2xl bg-period px-5 py-4 text-sm">
      <summary className="cursor-pointer font-semibold">Vad betyder behörigheterna?</summary>
      <dl className="m-0 mt-3 flex flex-col gap-2">
        {PERMISSIONS.map((p) => (
          <div key={p}>
            <dt className="inline font-semibold">{PERMISSION_LABELS[p]}: </dt>
            <dd className="m-0 inline text-muted">{PERMISSION_DETAILS[p]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 mb-0 text-muted">
        En person kan ha flera behörigheter. Alla som ska kunna publicera behöver minst <em>Publicerare</em>; styrelsen
        får det automatiskt.
      </p>
    </details>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 rounded-[28px] bg-white px-6 py-8 shadow-card sm:px-[38px] sm:py-[38px]">{children}</div>
  );
}
