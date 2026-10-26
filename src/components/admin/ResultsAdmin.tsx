import { useEffect, useMemo, useState } from 'react';
import { watchEvent } from '../../lib/firebase/events';
import { loadMembers, type Member } from '../../lib/firebase/members';
import {
  addResult,
  deleteResult,
  setResultsPublished,
  updateResult,
  watchPublishedResults,
  watchResults,
  type PublishedInfo,
  type ResultPatch,
} from '../../lib/firebase/results';
import { formatDuration, parseDuration, publicEntries, rowSeconds } from '../../lib/results';
import { dayKey, fromStockholmInput } from '../../lib/time';
import type { EventRecord } from '../../types/event';
import { SHOW_LABELS, SHOW_MODES, type ResultRow, type ShowMode } from '../../types/result';
import { canViewEvents, type Session } from '../../types/user';
import ResultsList from '../ResultsList';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import { ActionButton, Field, INPUT } from './AdminUi';

// Startlista och resultat för en träning (beslut 0017). Används av banläggaren efter träningen, ofta på en dator som
// ligger framme så att löparna själva skriver upp sig. Därför stora knappar, snabb namnsökning och autospar.

export default function ResultsAdmin() {
  return (
    <AdminGate allowed={canViewEvents} requirement="publicerare, styrelse eller superadmin">
      {(session) => <Results session={session} />}
    </AdminGate>
  );
}

/** 'HH:mm:ss' i svensk tid (sekunder stöds: en del är petiga med tiderna) */
const clock = (d: Date) => d.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const nowTime = () => clock(new Date());

/** 'HH:mm' eller 'HH:mm:ss' i svensk tid → Date på dagen `day` (ÅÅÅÅ-MM-DD) */
const atTime = (day: string, time: string) => fromStockholmInput(`${day}T${time}`);

function Results({ session }: { session: Session }) {
  const eventId = new URLSearchParams(location.search).get('event');
  const [event, setEvent] = useState<EventRecord | null | undefined>(undefined);
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [published, setPublished] = useState<PublishedInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // Räknar upp varje minut så att "ute i skogen" och status hålls aktuella
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!eventId) return;
    const stops = [
      watchEvent(eventId, setEvent, () => setError('Kunde inte läsa eventet.')),
      watchResults(eventId, setRows, () => setError('Kunde inte läsa listan.')),
      watchPublishedResults(eventId, setPublished),
    ];
    return () => stops.forEach((s) => s());
  }, [eventId]);
  useEffect(() => {
    loadMembers().then(setMembers).catch(() => setMembers([]));
  }, []);

  const courseNames = useMemo(() => {
    const names = new Set<string>();
    for (const f of event?.courseFiles ?? []) if (f.label.trim()) names.add(f.label.trim());
    for (const r of rows ?? []) if (r.course.trim()) names.add(r.course.trim());
    return [...names];
  }, [event, rows]);

  const ratings = (rows ?? []).flatMap((r) => (r.rating === null ? [] : [r.rating]));

  if (!eventId) return <AdminPanel><p>Inget event valt. Öppna startlistan från eventets sida i admin.</p></AdminPanel>;
  if (event === undefined) return <AdminPanel><p className="text-muted">Laddar…</p></AdminPanel>;
  if (event === null) return <AdminPanel><p>Eventet finns inte.</p></AdminPanel>;

  const list = rows ?? [];
  const out = list.filter((r) => r.startAt && r.startAt.getTime() <= now && rowSeconds(r) === null && r.show !== 'participated');
  const changedSincePublish = !!published?.publishedAt && list.some((r) => r.updatedAt && r.updatedAt > published.publishedAt!);
  const preview = publicEntries(list);

  async function save(id: string, patch: ResultPatch) {
    setError('');
    try {
      await updateResult(eventId!, id, patch, session.uid);
    } catch {
      setError('Kunde inte spara ändringen.');
    }
  }

  async function publish(on: boolean) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const n = await setResultsPublished(eventId!, on);
      setMessage(on ? `Publicerat: ${n} rader. Listan syns på eventsidan efter nästa ombyggnad (1–2 min).` : 'Resultaten är indragna och försvinner från eventsidan vid nästa ombyggnad.');
    } catch {
      setError('Kunde inte publicera. Försök igen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminPanel>
        <a href={`/admin/event?id=${eventId}`} className="text-sm font-semibold text-muted no-underline hover:text-accent">← Till eventet</a>
        <AdminTitle>Startlista och resultat</AdminTitle>
        <p className="m-0 text-muted">{event.title || '(utan titel)'}</p>
        {error && <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
        {message && <p role="status" className="m-0 rounded-2xl bg-[#E3F0DC] px-4 py-3 text-sm text-[#2F5A2B]">{message}</p>}

        <NewRow
          members={members}
          courseNames={courseNames}
          onAdd={async (r) => {
            setError('');
            try {
              await addResult(eventId, r, session.uid);
              return true;
            } catch {
              setError('Kunde inte lägga till.');
              return false;
            }
          }}
        />
      </AdminPanel>

      <AdminPanel>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 font-display text-xl font-bold">På träningen ({list.length})</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${out.length > 0 ? 'bg-[#FFF3C4] text-[#7A5A00]' : 'bg-period text-muted'}`}>
            Ute i skogen: {out.length}
            {out.length > 0 && ` – ${out.map((r) => r.name).join(', ')}`}
          </span>
        </div>
        {ratings.length > 0 && (
          <p className="m-0 text-sm text-muted">
            Betyg på banan (syns bara här): snitt {(ratings.reduce((a, b) => a + b, 0) / ratings.length).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} av 5 från {ratings.length} {ratings.length === 1 ? 'person' : 'personer'}.
          </p>
        )}
        {rows === null && <p className="text-muted">Laddar…</p>}
        {rows && list.length === 0 && <p className="text-muted">Ingen har skrivit upp sig än.</p>}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {list.map((r) => (
            <RowItem key={r.id} row={r} now={now} eventDay={dayKey(event.startsAt)} courseNames={courseNames} onSave={(p) => save(r.id, p)} onDelete={() => deleteResult(eventId, r.id).catch(() => setError('Kunde inte radera.'))} />
          ))}
        </ul>
        <p className="m-0 text-[13px] text-muted">
          Ungdomsmarkeringen (för LOK-stöd) syns bara här och aldrig i den publika listan. Ändringar sparas direkt.
        </p>
      </AdminPanel>

      <AdminPanel>
        <h2 className="m-0 font-display text-xl font-bold">Publicera resultat</h2>
        <p className="m-0 text-muted">
          {published
            ? `Publicerad ${published.publishedAt ? published.publishedAt.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''} (${published.count} rader).${changedSincePublish ? ' Det finns ändringar sedan dess som inte är publicerade.' : ''}`
            : 'Inte publicerad. Besökare ser inga resultat förrän du publicerar.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <ActionButton primary onClick={() => publish(true)} disabled={busy || preview.length === 0} busy={busy}>
            {published ? 'Uppdatera publicerade resultat' : 'Publicera resultat'}
          </ActionButton>
          {published && <ActionButton onClick={() => publish(false)} disabled={busy}>Dra tillbaka</ActionButton>}
        </div>
        <div className="rounded-2xl bg-period px-5 py-4">
          <p className="mt-0 mb-3 text-[13px] font-semibold tracking-[.04em] text-subtle uppercase">Så här ser listan ut för besökare</p>
          {preview.length === 0 ? <p className="m-0 text-muted">Inget att visa än: lägg till deltagare och tider.</p> : <ResultsList entries={preview} />}
        </div>
      </AdminPanel>
    </div>
  );
}

function NewRow({
  members, courseNames, onAdd,
}: {
  members: Member[];
  courseNames: string[];
  onAdd: (r: { name: string; course: string; memberUid: string | null; startAt: Date; youth: boolean; show: ShowMode }) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [memberUid, setMemberUid] = useState<string | null>(null);
  const [course, setCourse] = useState('');
  const [start, setStart] = useState(nowTime);
  const [youth, setYouth] = useState(false);
  const [show, setShow] = useState<ShowMode>('time');
  const [adding, setAdding] = useState(false);

  const q = name.trim().toLowerCase();
  const suggestions = !memberUid && q.length >= 1 ? members.filter((m) => m.displayName.toLowerCase().includes(q)).slice(0, 6) : [];

  async function add() {
    if (!name.trim() || !start) return;
    setAdding(true);
    const ok = await onAdd({ name, course, memberUid, startAt: atTime(dayKey(new Date()), start), youth, show });
    setAdding(false);
    if (ok) {
      setName('');
      setMemberUid(null);
      setYouth(false);
      setStart(nowTime());
    }
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-[22px] bg-period p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <h2 className="m-0 font-display text-xl font-bold">Skriv upp dig</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Namn" htmlFor="r-name" hint={memberUid ? 'Kopplad till medlem.' : 'Börja skriva för att söka bland medlemmar, eller skriv ett eget namn.'}>
          <input
            id="r-name"
            value={name}
            autoComplete="off"
            onChange={(e) => {
              setName(e.target.value);
              setMemberUid(null);
            }}
            className={`${INPUT} !py-4 !text-lg`}
          />
          {suggestions.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {suggestions.map((m) => (
                <li key={m.uid}>
                  <button
                    type="button"
                    onClick={() => {
                      setName(m.displayName);
                      setMemberUid(m.uid);
                    }}
                    className="cursor-pointer rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-accent shadow-chip hover:bg-pastel"
                  >
                    {m.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Bana" htmlFor="r-course" hint="Välj en bana eller skriv egen text.">
          <input id="r-course" list="course-names" value={course} onChange={(e) => setCourse(e.target.value)} className={`${INPUT} !py-4 !text-lg`} />
          <datalist id="course-names">
            {courseNames.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Starttid" htmlFor="r-start">
          <input id="r-start" type="time" step="1" value={start} onChange={(e) => setStart(e.target.value)} className={`${INPUT} !py-4 !text-lg`} />
        </Field>
        <Field label="Visa i resultatlistan" htmlFor="r-show">
          <select id="r-show" value={show} onChange={(e) => setShow(e.target.value as ShowMode)} className={`${INPUT} !py-4 !text-lg`}>
            {SHOW_MODES.map((m) => <option key={m} value={m}>{SHOW_LABELS[m]}</option>)}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-3 text-[15px] font-semibold">
        <input type="checkbox" checked={youth} onChange={(e) => setYouth(e.target.checked)} className="h-5 w-5 accent-[#8A4B9E]" />
        Ungdom <span className="font-normal text-muted">(för LOK-stöd, syns inte publikt)</span>
      </label>
      <div>
        <ActionButton primary onClick={() => void add()} disabled={adding || !name.trim() || !start} busy={adding}>
          Lägg till
        </ActionButton>
      </div>
    </form>
  );
}

function RowItem({
  row, now, eventDay, courseNames, onSave, onDelete,
}: {
  row: ResultRow;
  now: number;
  eventDay: string;
  courseNames: string[];
  onSave: (patch: ResultPatch) => void;
  onDelete: () => void;
}) {
  const [finish, setFinish] = useState('');
  const [total, setTotal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const seconds = rowSeconds(row);
  const day = row.startAt ? dayKey(row.startAt) : eventDay;

  const status =
    seconds !== null
      ? `I mål ${formatDuration(seconds)}`
      : !row.startAt
        ? 'Registrerad'
        : row.startAt.getTime() > now
          ? 'Ej startad'
          : 'Ute i skogen';
  const statusStyle = seconds !== null ? 'bg-[#E3F0DC] text-[#2F5A2B]' : status === 'Ute i skogen' ? 'bg-[#FFF3C4] text-[#7A5A00]' : 'bg-period text-muted';

  return (
    <li className="flex flex-col gap-3 rounded-[22px] bg-period p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-[18px] font-semibold">{row.name}</span>
        {row.memberUid && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted">Medlem</span>}
        {row.source === 'guest' && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted">Gäst (QR)</span>}
        {row.source === 'member' && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted">Registrerade sig själv</span>}
        {row.rating !== null && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-accent" title="Betyg på banan (syns bara här)">{'★'.repeat(row.rating)}{'☆'.repeat(5 - row.rating)}</span>}
        {row.youth && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">Ungdom</span>}
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusStyle}`}>{status}</span>
        <span className="text-[13px] text-subtle">{row.startAt ? `start ${clock(row.startAt)}` : ''}</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {seconds === null ? (
          <>
            <ActionButton primary onClick={() => onSave({ finishAt: new Date() })}>I mål nu</ActionButton>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Måltid (klockslag, med sekunder)
              <span className="flex gap-2">
                <input type="time" step="1" value={finish} onChange={(e) => setFinish(e.target.value)} className={`${INPUT} !w-36 !py-2.5`} />
                <ActionButton onClick={() => { if (finish) { onSave({ finishAt: atTime(day, finish), totalSeconds: null }); setFinish(''); } }} disabled={!finish}>OK</ActionButton>
              </span>
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Sluttid (egen tid, m:ss)
              <span className="flex gap-2">
                <input value={total} placeholder="42:30" inputMode="numeric" onChange={(e) => setTotal(e.target.value)} className={`${INPUT} !w-28 !py-2.5`} />
                <ActionButton onClick={() => { const s = parseDuration(total); if (s !== null) { onSave({ totalSeconds: s }); setTotal(''); } }} disabled={parseDuration(total) === null}>OK</ActionButton>
              </span>
            </label>
          </>
        ) : (
          <ActionButton onClick={() => onSave({ finishAt: null, totalSeconds: null })}>Ångra mål</ActionButton>
        )}

        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Bana
          <input list="course-names" defaultValue={row.course} onBlur={(e) => e.target.value.trim() !== row.course && onSave({ course: e.target.value })} className={`${INPUT} !w-36 !py-2.5`} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Visa
          <select value={row.show} onChange={(e) => onSave({ show: e.target.value as ShowMode })} className={`${INPUT} !w-auto !py-2.5`}>
            {SHOW_MODES.map((m) => <option key={m} value={m}>{SHOW_LABELS[m]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm font-semibold">
          <input type="checkbox" checked={row.youth} onChange={(e) => onSave({ youth: e.target.checked })} className="h-5 w-5 accent-[#8A4B9E]" />
          Ungdom
        </label>

        <span className="flex-1" />
        {confirmDelete ? (
          <span className="flex gap-2">
            <ActionButton danger onClick={onDelete}>Radera</ActionButton>
            <ActionButton onClick={() => setConfirmDelete(false)}>Avbryt</ActionButton>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="cursor-pointer text-sm font-semibold text-muted hover:text-[#A33A3A]">Ta bort</button>
        )}
      </div>
    </li>
  );
}
