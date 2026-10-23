import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { permissionNotice } from '../../lib/notify';
import NotifyToggle from '../NotifyToggle';
import { db } from '../../lib/firebase/client';
import { watchSession } from '../../lib/firebase/session';
import {
  assignableBy,
  canManageUsers,
  highestPermission,
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
  // Kuvertet per användare: skicka ett meddelande om den nya behörigheten (på som standard)
  const [notify, setNotify] = useState<Record<string, boolean>>({});
  const assignable = assignableBy(session.permissions);
  const visible = visiblePermissions(session);

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

  // Reglerna nekar att ändra någon vars nuvarande nivå man inte själv får tilldela, och att ta bort sin egen superadmin
  function canEdit(user: UserProfile) {
    const current = highestPermission(user.permissions);
    if (current === 'superadmin' && user.uid === session.uid) return false;
    return current === null || assignable.includes(current);
  }

  async function setLevel(user: UserProfile, level: Permission | '') {
    setPending(user.uid);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), { permissions: level ? [level] : [] });
      if (notify[user.uid] !== false && user.uid !== session.uid) {
        const { sendNotices } = await import('../../lib/firebase/messages');
        await sendNotices(session.uid, {
          recipients: [user.uid],
          text: permissionNotice(highestPermission(user.permissions), level || null),
          link: '/profil',
        });
      }
    } catch {
      setError(`Ändringen för ${user.displayName || user.email} sparades inte. Du kanske saknar behörighet för den nivån.`);
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
            {!session.permissions.includes('superadmin') && ' Som styrelse kan du ge alla behörigheter utom superadmin.'}
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

      <PermissionHelp permissions={visible} />

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
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Behörighet för ${user.displayName || user.email}`}
                  value={highestPermission(user.permissions) ?? ''}
                  disabled={!canEdit(user) || pending !== null}
                  onChange={(e) => setLevel(user, e.target.value as Permission | '')}
                  className="rounded-full border-[1.5px] border-ink/15 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <option value="">Ingen behörighet</option>
                  {PERMISSIONS.filter((p) => visible.includes(p) || p === highestPermission(user.permissions)).map((p) => (
                    <option key={p} value={p} disabled={!assignable.includes(p)}>
                      {PERMISSION_LABELS[p]}
                    </option>
                  ))}
                </select>
                {user.uid !== session.uid && (
                  <NotifyToggle
                    enabled={notify[user.uid] !== false}
                    onChange={(on) => setNotify((n) => ({ ...n, [user.uid]: on }))}
                    summary={`${user.displayName || user.email} får ett meddelande när du ändrar behörigheten.`}
                    disabled={pending !== null}
                  />
                )}
                {pending === user.uid && <span className="text-subtle">…</span>}
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
  board: 'Allt en publicerare kan, plus läsa och skriva styrelsens protokoll. Kan ge och ta bort alla behörigheter utom superadmin, även styrelse (också sin egen).',
  superadmin: 'Allt, och är den enda som kan ge och ta bort superadmin. Du kan inte ta bort din egen superadmin.',
};

/** Superadmin syns bara för superadmin. */
function visiblePermissions(session: Session): Permission[] {
  return PERMISSIONS.filter((p) => p !== 'superadmin' || session.permissions.includes('superadmin'));
}

function PermissionHelp({ permissions }: { permissions: Permission[] }) {
  return (
    <details className="rounded-2xl bg-period px-5 py-4 text-sm">
      <summary className="cursor-pointer font-semibold">Vad betyder behörigheterna?</summary>
      <dl className="m-0 mt-3 flex flex-col gap-2">
        {permissions.map((p) => (
          <div key={p}>
            <dt className="inline font-semibold">{PERMISSION_LABELS[p]}: </dt>
            <dd className="m-0 inline text-muted">{PERMISSION_DETAILS[p]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 mb-0 text-muted">
        Varje person har en nivå, och varje nivå kan allt som nivåerna före den i listan kan. Välj den lägsta nivå personen behöver.
      </p>
    </details>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 rounded-[28px] bg-white px-6 py-8 shadow-card sm:px-[38px] sm:py-[38px]">{children}</div>
  );
}
