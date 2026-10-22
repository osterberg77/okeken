import { useEffect, useMemo, useRef, useState } from 'react';
import {
  approveProtocol,
  createProtocol,
  deleteProtocol,
  listUsers,
  revokeProtocolApproval,
  saveProtocol,
  watchProtocol,
  watchProtocols,
} from '../../lib/firebase/protocols';
import {
  canApprove,
  canDeleteProtocol,
  canEditProtocol,
  canRevokeApproval,
  carryOverTodos,
  copyProtocolContent,
  displayNameOf,
  newProtocolContent,
  newTodoId,
  protocolState,
  sameProtocolContent,
  validateProtocol,
} from '../../lib/protocol';
import { DEFAULT_PROTOCOL_TEMPLATE } from '../../lib/protocol-template';
import { formatTime, fromStockholmInput, toStockholmInput } from '../../lib/time';
import {
  APPROVAL_ROLE_LABELS,
  MAX_ATTENDEES,
  MAX_TODOS,
  type ProtocolContent,
  type ProtocolRecord,
} from '../../types/protocol';
import { canViewProtocols, type Session, type UserProfile } from '../../types/user';
import { ActionButton, Field, INPUT } from './AdminUi';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import MarkdownField from './MarkdownField';
import ProtocolView, { formatMeeting } from './ProtocolView';
import { ProtocolStatusBadge, ProtocolStatusLabel } from './StatusBadge';

export default function ProtocolEditor() {
  return (
    <AdminGate allowed={canViewProtocols} requirement="styrelse eller superadmin">
      {(session) => {
        const id = new URLSearchParams(location.search).get('id');
        return id ? <Editor session={session} id={id} /> : <NewProtocol session={session} />;
      }}
    </AdminGate>
  );
}

type Message = { kind: 'ok' | 'error'; text: string } | null;

const contentOf = (r: ProtocolRecord): ProtocolContent => ({
  meetingAt: r.meetingAt,
  location: r.location,
  body: r.body,
  attendees: r.attendees,
  todos: r.todos,
  secretaryUid: r.secretaryUid,
  secretaryName: r.secretaryName,
  adjusterUid: r.adjusterUid,
  adjusterName: r.adjusterName,
});

const nameOf = (u: UserProfile) => displayNameOf(u);

function useUsers() {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    listUsers().then(setUsers).catch(() => setFailed(true));
  }, []);
  return { users, failed };
}

function Banner({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role={message.kind === 'error' ? 'alert' : 'status'}
      className={`m-0 w-full rounded-2xl px-4 py-2.5 text-sm ${message.kind === 'ok' ? 'bg-[#E3F0DC] text-[#2F5A2B]' : 'bg-[#FBEAEA] text-[#8A2B2B]'}`}
    >
      {message.text}
    </p>
  );
}

// ---- Nytt protokoll ------------------------------------------------------------------------

const EMPTY = '__empty__';

function NewProtocol({ session }: { session: Session }) {
  const [all, setAll] = useState<ProtocolRecord[] | null>(null);
  const [source, setSource] = useState<string>('');
  const [date, setDate] = useState(() => {
    const d = toStockholmInput(new Date());
    return `${d.slice(0, 10)}T18:00`;
  });
  const [carry, setCarry] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    return watchProtocols(
      (list) => {
        setAll(list);
        setSource((s) => s || list[0]?.id || EMPTY);
      },
      () => setMessage({ kind: 'error', text: 'Kunde inte läsa tidigare protokoll.' }),
    );
  }, []);

  const prev = all?.find((p) => p.id === source) ?? null;
  const carried = prev ? carryOverTodos(prev.todos) : [];

  async function onCreate() {
    setBusy(true);
    setMessage(null);
    try {
      const content = newProtocolContent({
        meetingAt: fromStockholmInput(date),
        previous: prev,
        carryOver: carry,
      });
      if (!prev) content.body = DEFAULT_PROTOCOL_TEMPLATE;
      const problems = validateProtocol(content);
      if (problems.length) throw new Error(problems.join(' '));
      const id = await createProtocol(content, session.uid);
      location.href = `/admin/styrelsemote?id=${id}`;
    } catch (err) {
      console.error(err);
      setBusy(false);
      setMessage({ kind: 'error', text: err instanceof Error && err.message.includes(' ') && !err.message.includes('permission') ? err.message : 'Det gick inte att skapa protokollet.' });
    }
  }

  if (all === null) return <AdminPanel><p className="text-muted">Laddar…</p></AdminPanel>;

  return (
    <AdminPanel>
      <a href="/admin/protokoll" className="text-sm font-semibold text-muted no-underline hover:text-accent">← Alla protokoll</a>
      <AdminTitle>Nytt protokoll</AdminTitle>
      <Field label="Mötesdatum och tid" htmlFor="meeting" hint="Svensk tid.">
        <input id="meeting" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Hämta mall från" htmlFor="source" hint="Rubrikerna förs över utan innehåll. Närvarolistan förs inte över.">
        <select id="source" value={source} onChange={(e) => setSource(e.target.value)} className={INPUT}>
          {all.map((p) => (
            <option key={p.id} value={p.id}>{formatMeeting(p.meetingAt)}</option>
          ))}
          <option value={EMPTY}>{all.length ? 'Tomt protokoll (standardmall)' : 'Standardmall (dagordningen)'}</option>
        </select>
      </Field>
      {prev && carried.length > 0 && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-period px-4 py-3 text-[15px]">
          <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} className="mt-1 h-4 w-4 accent-[#8A4B9E]" />
          <span>
            Lyft över {carried.length} {carried.length === 1 ? 'ej avbockad punkt' : 'ej avbockade punkter'} som &quot;Punkter från föregående protokoll&quot; i Att göra.
          </span>
        </label>
      )}
      <Banner message={message} />
      <div>
        <ActionButton primary onClick={onCreate} disabled={busy || !date} busy={busy}>Skapa protokoll</ActionButton>
      </div>
    </AdminPanel>
  );
}

// ---- Redigera / läsa ------------------------------------------------------------------------

function Editor({ session, id }: { session: Session; id: string }) {
  const { users, failed } = useUsers();
  const [record, setRecord] = useState<ProtocolRecord | null | undefined>(undefined);
  const [draft, setDraft] = useState<ProtocolContent | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [tab, setTab] = useState<'edit' | 'read'>('edit');
  const loaded = useRef(false);

  useEffect(
    () =>
      watchProtocol(
        id,
        (r) => {
          setRecord(r);
          if (r && !loaded.current) {
            loaded.current = true;
            setDraft(contentOf(r));
          }
        },
        () => setMessage({ kind: 'error', text: 'Kunde inte läsa protokollet.' }),
      ),
    [id],
  );

  const saved = record ? contentOf(record) : null;
  const dirty = !!draft && !!saved && !sameProtocolContent(draft, saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Ett låst protokoll kan inte ändras: visa alltid sparade värden
  const locked = !!record && protocolState(record) === 'locked';
  useEffect(() => {
    if (record && locked) setDraft(contentOf(record));
  }, [record, locked]);

  const boardUsers = useMemo(() => (users ?? []).filter((u) => canViewProtocols(u.permissions)), [users]);
  const candidates = useMemo(() => (users ?? []).map((u) => ({ uid: u.uid, name: nameOf(u) })), [users]);

  if (record === undefined || !draft || !users) {
    return <AdminPanel><p className={failed ? 'text-[#8A2B2B]' : 'text-muted'}>{failed ? 'Kunde inte läsa konton.' : 'Laddar…'}</p></AdminPanel>;
  }
  if (record === null) {
    return <AdminPanel><p>Protokollet finns inte (kanske raderat). <a href="/admin/protokoll" className="font-semibold text-accent">Till alla protokoll</a></p></AdminPanel>;
  }

  const state = protocolState(record);
  const editable = canEditProtocol(record, session.permissions);
  const problems = validateProtocol(draft);
  const hasApproval = state !== 'draft';
  const update = (patch: Partial<ProtocolContent>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setMessage(null);
  };

  async function run(label: string, action: () => Promise<string | void>) {
    setBusy(label);
    setMessage(null);
    try {
      const text = await action();
      if (text) setMessage({ kind: 'ok', text });
    } catch (err) {
      console.error(err);
      setMessage({ kind: 'error', text: 'Det gick inte att utföra. Protokollet kan ha låsts eller ändrats av någon annan. Ladda om sidan och försök igen.' });
    } finally {
      setBusy(null);
    }
  }

  const onSave = () => run('save', async () => {
    if (!dirty) return;
    await saveProtocol(id, draft, session.uid);
    return hasApproval ? 'Sparat. Godkännandena är nollställda.' : 'Sparat.';
  });
  const onApprove = (role: 'secretary' | 'adjuster') => run('approve', async () => {
    await approveProtocol(id, role);
    return 'Godkänt.';
  });
  const onRevoke = (role: 'secretary' | 'adjuster') => run('revoke', async () => {
    await revokeProtocolApproval(id, role);
    return 'Godkännandet är återkallat.';
  });
  const onCopy = () => run('copy', async () => {
    const newId = await createProtocol(copyProtocolContent(contentOf(record)), session.uid);
    location.href = `/admin/styrelsemote?id=${newId}`;
  });
  const onDelete = () => run('delete', async () => {
    await deleteProtocol(id);
    location.href = '/admin/protokoll';
  });

  const approveRole = canApprove(record, session.uid, session.permissions);
  const revokeRole = canRevokeApproval(record, session.uid, session.permissions);
  const reading = tab === 'read' || !editable;
  // Utskriften visar det sparade protokollet (knappen är avstängd vid osparade ändringar)
  const shown = { ...(dirty ? draft : contentOf(record)), secretaryApprovedAt: record.secretaryApprovedAt, adjusterApprovedAt: record.adjusterApprovedAt };

  const toggleAttendee = (u: UserProfile, on: boolean) =>
    update({ attendees: on ? [...draft.attendees, { uid: u.uid, name: nameOf(u) }] : draft.attendees.filter((a) => a.uid !== u.uid) });
  const attendeesFull = draft.attendees.length >= MAX_ATTENDEES;
  const todosFull = draft.todos.length >= MAX_TODOS;
  const setTodo = (i: number, patch: Partial<ProtocolContent['todos'][number]>) =>
    update({ todos: draft.todos.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  // Tillgängliga att lägga till: alla konton som inte redan är närvarande, styrelsen först
  const isBoardUser = (u: UserProfile) => boardUsers.some((b) => b.uid === u.uid);
  const addable = (users ?? [])
    .filter((u) => !draft.attendees.some((a) => a.uid === u.uid))
    .sort((a, b) => Number(isBoardUser(b)) - Number(isBoardUser(a)) || nameOf(a).localeCompare(nameOf(b), 'sv'));
  const addableBoard = addable.filter(isBoardUser);

  const signOptions = (uid: string | null, name: string) => {
    const opts = boardUsers.map((u) => ({ uid: u.uid, name: nameOf(u) }));
    if (uid && !opts.some((o) => o.uid === uid)) opts.push({ uid, name });
    return opts;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="z-30 flex flex-wrap items-center sm:sticky sm:top-2 gap-3 rounded-[22px] bg-white/95 px-5 py-3.5 shadow-card backdrop-blur print:hidden">
        <a href="/admin/protokoll" className="text-sm font-semibold text-muted no-underline hover:text-accent">← Alla protokoll</a>
        <ProtocolStatusLabel state={state} />
        <span className="text-[13px] text-subtle">
          {dirty ? 'Osparade ändringar' : record.updatedAt ? `Sparad ${formatTime(record.updatedAt.toISOString())}` : ''}
        </span>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {editable && (
            <div className="flex gap-1" role="tablist">
              {(['edit', 'read'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-ink text-white' : 'bg-period text-ink'}`}
                >
                  {t === 'edit' ? 'Redigera' : 'Läsvy'}
                </button>
              ))}
            </div>
          )}
          <ActionButton onClick={() => window.print()} disabled={dirty}>Skriv ut</ActionButton>
          {locked && <ActionButton onClick={() => setConfirmCopy(true)} disabled={!!busy}>Kopiera till nytt protokoll</ActionButton>}
          {editable && (
            <ActionButton primary onClick={onSave} disabled={!!busy || !dirty || problems.length > 0} busy={busy === 'save'}>
              {hasApproval && dirty ? 'Spara och nollställ godkännanden' : 'Spara'}
            </ActionButton>
          )}
        </div>
        {dirty && hasApproval && (
          <p role="status" className="m-0 w-full rounded-2xl bg-[#FFF6D6] px-4 py-2.5 text-sm text-[#6A5A12]">
            Protokollet har redan godkännanden. Om du sparar ändringarna nollställs både sekreterarens och justerarens godkännande, och de måste godkänna igen.
          </p>
        )}
        {dirty && problems.length > 0 && (
          <p role="alert" className="m-0 w-full rounded-2xl bg-[#FBEAEA] px-4 py-2.5 text-sm text-[#8A2B2B]">{problems.join(' ')}</p>
        )}
        {confirmCopy && (
          <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl bg-period px-4 py-2.5 text-sm">
            <span>Skapa ett nytt utkast med samma innehåll? Det låsta protokollet ändras inte.</span>
            <ActionButton primary onClick={onCopy} disabled={!!busy} busy={busy === 'copy'}>Ja, kopiera</ActionButton>
            <button type="button" onClick={() => setConfirmCopy(false)} className="cursor-pointer font-semibold text-muted">Avbryt</button>
          </div>
        )}
        <Banner message={message} />
      </div>

      {locked && (
        <p role="status" className="m-0 rounded-2xl bg-[#E3F0DC] px-5 py-3 text-[15px] font-semibold text-[#2F5A2B] print:hidden">
          Låst och godkänt. Sekreteraren och justeraren har godkänt, så protokollet kan inte längre ändras eller raderas. Behöver något rättas: kopiera till ett nytt protokoll.
        </p>
      )}

      {editable && (
        <AdminPanel className={`print:hidden ${reading ? 'hidden' : ''}`}>
          <AdminTitle>Redigera protokoll</AdminTitle>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Mötesdatum och tid" htmlFor="meeting" hint="Svensk tid.">
              <input
                id="meeting"
                type="datetime-local"
                value={Number.isNaN(draft.meetingAt.getTime()) ? '' : toStockholmInput(draft.meetingAt)}
                onChange={(e) => e.target.value && update({ meetingAt: fromStockholmInput(e.target.value) })}
                className={INPUT}
              />
            </Field>
            <Field label="Plats" htmlFor="location">
              <input id="location" value={draft.location} onChange={(e) => update({ location: e.target.value })} placeholder="T.ex. Klubbstugan eller Digitalt" className={INPUT} />
            </Field>
          </div>

          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="mb-1 text-[15px] font-semibold">Närvarande</legend>
            {draft.attendees.length === 0 ? (
              <p className="m-0 text-sm text-muted">Ingen vald ännu.</p>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {draft.attendees.map((a) => (
                  <li key={a.uid} className="flex items-center gap-1.5 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-sm font-semibold text-white">
                    {a.name}
                    <button
                      type="button"
                      aria-label={`Ta bort ${a.name} ur närvarande`}
                      onClick={() => update({ attendees: draft.attendees.filter((x) => x.uid !== a.uid) })}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-white/20 text-base leading-none text-white hover:bg-white/35"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lägg till närvarande"
                value=""
                disabled={attendeesFull || addable.length === 0}
                onChange={(e) => {
                  const u = users.find((x) => x.uid === e.target.value);
                  if (u) toggleAttendee(u, true);
                }}
                className={`${INPUT} sm:max-w-xs`}
              >
                <option value="">{addable.length === 0 ? 'Alla är redan tillagda' : 'Lägg till närvarande…'}</option>
                {addable.map((u) => <option key={u.uid} value={u.uid}>{nameOf(u)}{isBoardUser(u) ? ' (styrelsen)' : ''}</option>)}
              </select>
              {addableBoard.length > 0 && (
                <button
                  type="button"
                  disabled={attendeesFull}
                  onClick={() =>
                    update({
                      attendees: [...draft.attendees, ...addableBoard.map((u) => ({ uid: u.uid, name: nameOf(u) }))].slice(0, MAX_ATTENDEES),
                    })
                  }
                  className="cursor-pointer rounded-full border-[1.5px] border-ink/18 bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-40"
                >
                  Lägg till hela styrelsen
                </button>
              )}
            </div>
            <span className="text-[13px] text-muted">
              {attendeesFull
                ? `Du har nått taket på ${MAX_ATTENDEES} närvarande. Det beror på en gräns i databasreglerna; ta bort någon för att lägga till en annan.`
                : 'Lägg bara till dem som var på plats. Frånvarande noteras inte.'}
            </span>
          </fieldset>

          <Field label="Text" htmlFor="body" hint="Skriv @ för att nämna en person. Rubrikerna kommer från mallen.">
            <MarkdownField id="body" value={draft.body} onChange={(body) => update({ body })} targets={null} allowImages={false} mentionCandidates={candidates} rows={18} />
          </Field>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 text-[15px] font-semibold">Att göra</legend>
            {draft.todos.length === 0 && <p className="m-0 text-sm text-muted">Inga punkter ännu.</p>}
            {draft.todos.map((t, i) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-period px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Klar"
                  checked={t.done}
                  onChange={(e) => setTodo(i, { done: e.target.checked })}
                  className="h-5 w-5 flex-none accent-[#8A4B9E]"
                />
                <input
                  aria-label="Text"
                  value={t.text}
                  onChange={(e) => setTodo(i, { text: e.target.value })}
                  placeholder="Vad ska göras?"
                  className={`${INPUT} min-w-[12rem] flex-1 !py-2`}
                />
                <select
                  aria-label="Ansvarig"
                  value={t.assigneeUid ?? ''}
                  onChange={(e) => {
                    const u = users.find((x) => x.uid === e.target.value);
                    setTodo(i, { assigneeUid: u ? u.uid : null, assigneeName: u ? nameOf(u) : '' });
                  }}
                  className={`${INPUT} !w-auto !py-2`}
                >
                  <option value="">Ingen ansvarig</option>
                  {t.assigneeUid && !users.some((u) => u.uid === t.assigneeUid) && <option value={t.assigneeUid}>{t.assigneeName}</option>}
                  {users.map((u) => <option key={u.uid} value={u.uid}>{nameOf(u)}</option>)}
                </select>
                <button type="button" onClick={() => update({ todos: draft.todos.filter((_, j) => j !== i) })} className="cursor-pointer px-2 text-sm font-semibold text-[#A33A3A] hover:underline">
                  Ta bort
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton onClick={() => update({ todos: [...draft.todos, { id: newTodoId(), text: '', assigneeUid: null, assigneeName: '', done: false }] })} disabled={todosFull}>
                Lägg till punkt
              </ActionButton>
              {todosFull && (
                <span className="text-[13px] text-muted">Taket är {MAX_TODOS} punkter per protokoll (en gräns i databasreglerna). Samla flera uppgifter i en punkt eller ta bort någon.</span>
              )}
            </div>
          </fieldset>

          <fieldset className="m-0 grid gap-5 border-0 p-0 sm:grid-cols-2">
            <legend className="mb-2 text-[15px] font-semibold">Signering</legend>
            {(['secretary', 'adjuster'] as const).map((role) => {
              const uid = role === 'secretary' ? draft.secretaryUid : draft.adjusterUid;
              const name = role === 'secretary' ? draft.secretaryName : draft.adjusterName;
              const otherUid = role === 'secretary' ? draft.adjusterUid : draft.secretaryUid;
              return (
                <Field key={role} label={APPROVAL_ROLE_LABELS[role]} htmlFor={role} hint={role === 'secretary' ? 'Sekreteraren för protokollet.' : 'Justeraren väljs för varje möte. Måste vara en annan person än sekreteraren.'}>
                  <select
                    id={role}
                    value={uid ?? ''}
                    onChange={(e) => {
                      const u = users.find((x) => x.uid === e.target.value);
                      update(
                        role === 'secretary'
                          ? { secretaryUid: u?.uid ?? null, secretaryName: u ? nameOf(u) : '' }
                          : { adjusterUid: u?.uid ?? null, adjusterName: u ? nameOf(u) : '' },
                      );
                    }}
                    className={INPUT}
                  >
                    <option value="">Ej utsedd</option>
                    {signOptions(uid, name).map((o) => (
                      <option key={o.uid} value={o.uid} disabled={o.uid === otherUid}>{o.name}</option>
                    ))}
                  </select>
                </Field>
              );
            })}
          </fieldset>

          {canDeleteProtocol(record, session.permissions) && (
            <div className="border-t border-line pt-4">
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm">Radera utkastet för gott?</span>
                  <ActionButton danger onClick={onDelete} disabled={!!busy} busy={busy === 'delete'}>Ja, radera</ActionButton>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="cursor-pointer text-sm font-semibold text-muted">Avbryt</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="cursor-pointer text-sm font-semibold text-[#A33A3A] hover:underline">
                  Radera utkast
                </button>
              )}
            </div>
          )}
        </AdminPanel>
      )}

      <div className={reading ? '' : 'hidden print:block'}>
        <ProtocolView protocol={shown} />
      </div>

      <AdminPanel className="print:hidden">
        <h2 className="m-0 font-display text-xl font-bold">Godkännande</h2>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
          {(['secretary', 'adjuster'] as const).map((role) => {
            const at = role === 'secretary' ? record.secretaryApprovedAt : record.adjusterApprovedAt;
            const name = role === 'secretary' ? record.secretaryName : record.adjusterName;
            return (
              <li key={role}>
                <strong>{APPROVAL_ROLE_LABELS[role]}:</strong> {name || 'ej utsedd'} &ndash;{' '}
                {at ? `godkänt ${formatMeeting(at)}` : 'inte godkänt än'}
              </li>
            );
          })}
        </ul>
        {dirty && <p className="m-0 text-sm text-muted">Spara ändringarna innan du godkänner.</p>}
        <div className="flex flex-wrap gap-3">
          {approveRole && (
            <ActionButton primary onClick={() => onApprove(approveRole)} disabled={!!busy || dirty} busy={busy === 'approve'}>
              Godkänn som {approveRole === 'secretary' ? 'sekreterare' : 'justerare'}
            </ActionButton>
          )}
          {revokeRole && (
            <ActionButton onClick={() => onRevoke(revokeRole)} disabled={!!busy} busy={busy === 'revoke'}>
              Dra tillbaka mitt godkännande
            </ActionButton>
          )}
        </div>
        {!approveRole && !revokeRole && !locked && (
          <p className="m-0 text-sm text-muted">Bara den som är utsedd till sekreterare eller justerare kan godkänna. Välj dem under Signering.</p>
        )}
      </AdminPanel>

      <ProtocolStatusBadge state={state} detail={state === 'draft' ? 'Syns bara för styrelsen' : 'Väntar på den andra signeringen'} />
    </div>
  );
}
