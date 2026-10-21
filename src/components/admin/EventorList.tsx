import { useEffect, useMemo, useState } from 'react';
import { publishEventorSelection, saveEventorSettings, setEventorSelected, syncEventorNow, watchEventorEvents, watchEventorSettings, type SyncResult } from '../../lib/firebase/eventor';
import { dayKey, keyDayOfMonth, keyMonthShort, keyWeekdayShort } from '../../lib/time';
import type { EventorEvent, EventorSettings } from '../../types/eventor';
import { canPublish, type Session } from '../../types/user';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import { ActionButton, Field, INPUT } from './AdminUi';
import BuildStatus from './BuildStatus';
import StatusBadge, { StatusLabel } from './StatusBadge';

const CLASSIFICATIONS: Record<number, string> = { 0: 'Övrigt', 1: 'Mästerskap', 2: 'Nationell', 3: 'Distrikt', 4: 'Lokal', 5: 'Klubb' };
const disciplineLabel = (id: number) => (id === 1 ? 'Orientering' : `Disciplin ${id}`);

type View = 'suggested' | 'selected' | 'all';

export default function EventorList() {
  return (
    <AdminGate allowed={canPublish} requirement="publicerare, styrelse eller superadmin">
      {(session) => <Eventor session={session} />}
    </AdminGate>
  );
}

function Eventor({ session }: { session: Session }) {
  const [events, setEvents] = useState<EventorEvent[] | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('suggested');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [publishing, setPublishing] = useState(false);
  useEffect(() => watchEventorEvents(setEvents, () => setError('Kunde inte läsa tävlingarna.')), []);

  async function toggle(e: EventorEvent) {
    setError('');
    try {
      await setEventorSelected(e.id, !e.selected, session.uid);
    } catch {
      setError('Kunde inte spara valet.');
    }
  }

  const pending = useMemo(() => (events ?? []).filter((e) => e.live !== e.selected).length, [events]);

  async function publish() {
    setPublishing(true);
    setError('');
    setSyncMessage('');
    try {
      const n = await publishEventorSelection(events ?? [], session.uid);
      setSyncMessage(`Publicerat! ${n} ändring${n === 1 ? '' : 'ar'} syns i kalendern efter nästa ombyggnad (1–2 min).`);
    } catch {
      setError('Kunde inte publicera.');
    } finally {
      setPublishing(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError('');
    setSyncMessage('');
    try {
      const r: SyncResult = await syncEventorNow();
      setSyncMessage(`Hämtade ${r.fetched} tävlingar: ${r.added} nya, ${r.removed} borttagna${r.gone ? `, ${r.gone} valda finns inte längre hos Eventor` : ''}.`);
    } catch {
      setError('Kunde inte hämta från Eventor. Försök igen om en stund.');
    } finally {
      setSyncing(false);
    }
  }

  const counts = useMemo(() => {
    const all = events ?? [];
    return { suggested: all.filter((e) => e.suggested).length, selected: all.filter((e) => e.selected).length, all: all.length };
  }, [events]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (events ?? [])
      .filter((e) => (view === 'suggested' ? e.suggested || e.selected : view === 'selected' ? e.selected : true))
      .filter((e) => !q || `${e.name} ${e.organiserName}`.toLowerCase().includes(q));
  }, [events, view, search]);

  const lastFetched = (events ?? []).reduce<Date | null>((max, e) => (!max || e.fetchedAt > max ? e.fetchedAt : max), null);
  const canEditRules = session.permissions.includes('board') || session.permissions.includes('superadmin');

  return (
    <AdminPanel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <AdminTitle>Tävlingar från Eventor</AdminTitle>
          <p className="mt-2 max-w-[60ch] text-muted">
            Kryssa i de tävlingar som ska visas i kalendern och tryck sedan Publicera. De länkar till Eventor och sparas inte som egna events.
          </p>
        </div>
        <BuildStatus />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton primary busy={publishing} disabled={publishing || pending === 0} onClick={publish}>
          {pending > 0 ? `Publicera ändringar (${pending})` : 'Publicerad'}
        </ActionButton>
        <ActionButton busy={syncing} disabled={syncing} onClick={sync}>Hämta från Eventor</ActionButton>
        <span className="text-[13px] text-muted">
          {lastFetched ? `Senast hämtat ${lastFetched.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' })}.` : 'Inget hämtat ännu.'}
        </span>
      </div>
      {syncMessage && <p role="status" className="rounded-2xl bg-[#E3F0DC] px-4 py-3 text-sm text-[#2F5A2B]">{syncMessage}</p>}
      {error && <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {([['suggested', 'Föreslagna', counts.suggested], ['selected', 'Valda', counts.selected], ['all', 'Alla', counts.all]] as const).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold ${view === key ? 'bg-accent text-white' : 'bg-period text-ink hover:bg-pastel'}`}
          >
            {label} ({n})
          </button>
        ))}
        <input
          type="search"
          aria-label="Sök tävling eller arrangör"
          placeholder="Sök tävling eller arrangör"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT} max-w-[300px] !py-2 text-sm`}
        />
      </div>

      {events === null && !error && <p className="text-muted">Laddar tävlingar…</p>}
      {events && events.length === 0 && <p className="text-muted">Inga tävlingar hämtade ännu. Tryck på "Hämta från Eventor".</p>}
      {events && events.length > 0 && shown.length === 0 && <p className="text-muted">Inga tävlingar i den här vyn.</p>}

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {shown.map((e) => (
          <Row key={e.id} event={e} onToggle={() => toggle(e)} />
        ))}
      </ul>

      {canEditRules && <Rules uid={session.uid} />}
      {pending > 0 && <StatusBadge state="changed" detail={`${pending} ändring${pending === 1 ? '' : 'ar'} väntar på att publiceras`} />}
    </AdminPanel>
  );
}

function Row({ event: e, onToggle }: { event: EventorEvent; onToggle: () => void }) {
  const start = dayKey(e.startsAt);
  const meta = [keyWeekdayShort(start), e.organiserName, CLASSIFICATIONS[e.classificationId] ?? `Klass ${e.classificationId}`, e.disciplineId !== 1 ? disciplineLabel(e.disciplineId) : '', e.form ? 'Stafett/flerdag' : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <li className={`flex items-center gap-4 rounded-[22px] px-[18px] py-3.5 ${e.selected ? 'bg-pastel' : 'bg-period'}`}>
      <span className="flex w-11 flex-none flex-col items-center">
        <span className="font-display text-2xl leading-none font-bold">{keyDayOfMonth(start)}</span>
        <span className="text-[11px] font-semibold tracking-[.08em] text-subtle uppercase">{keyMonthShort(start)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          {e.live !== e.selected && <StatusLabel state="changed" />}
          {e.suggested && <Tag>Föreslagen</Tag>}
          {e.gone && <Tag warn>Finns inte längre hos Eventor</Tag>}
        </span>
        <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-display text-[17px] font-semibold text-ink no-underline hover:underline">
          {e.name} ↗
        </a>
        <span className="text-[13px] text-subtle">{meta}</span>
      </span>
      <label className="flex flex-none cursor-pointer items-center gap-2 text-sm font-semibold">
        <input type="checkbox" role="switch" checked={e.selected} onChange={onToggle} className="h-5 w-5 cursor-pointer accent-[#8A4B9E]" />
        <span className="hidden sm:inline">Visa i kalendern</span>
        <span className="sr-only sm:hidden">Visa {e.name} i kalendern</span>
      </label>
    </li>
  );
}

function Tag({ children, warn }: { children: string; warn?: boolean }) {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={warn ? { background: '#FBEAEA', color: '#8A2B2B' } : { background: '#EFE3F5', color: '#6E3A82' }}>
      {children}
    </span>
  );
}

const numbers = (text: string) => text.split(/[\s,]+/).filter(Boolean).map(Number);

/** Urvalsreglerna: styr vad som föreslås vid nästa hämtning. Valda tävlingar rörs aldrig. */
function Rules({ uid }: { uid: string }) {
  const [saved, setSaved] = useState<EventorSettings | null>(null);
  const [orgs, setOrgs] = useState('');
  const [disciplines, setDisciplines] = useState('');
  const [classes, setClasses] = useState<number[]>([]);
  const [months, setMonths] = useState('12');
  const [own, setOwn] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(
    () =>
      watchEventorSettings(
        (s) => {
          setSaved(s);
          setOrgs(s.organisationIds.join(', '));
          setDisciplines(s.disciplineIds.join(', '));
          setClasses(s.classificationIds);
          setMonths(String(s.monthsAhead));
          setOwn(String(s.ownOrganisationId));
        },
        () => setError('Kunde inte läsa urvalsreglerna.'),
      ),
    [],
  );

  async function save() {
    const next: EventorSettings = {
      ownOrganisationId: Number(own),
      organisationIds: numbers(orgs),
      classificationIds: classes,
      disciplineIds: numbers(disciplines),
      monthsAhead: Number(months),
    };
    const ids = [next.ownOrganisationId, ...next.organisationIds, ...next.disciplineIds, next.monthsAhead];
    if (ids.some((n) => !Number.isInteger(n) || n < 0) || next.organisationIds.length === 0 || next.monthsAhead < 1 || next.monthsAhead > 24) {
      setError('Kontrollera värdena: heltal, minst en organisation och 1–24 månader.');
      return;
    }
    setError('');
    try {
      await saveEventorSettings(next, uid);
      setMessage('Sparat. Reglerna gäller vid nästa hämtning.');
    } catch {
      setError('Kunde inte spara reglerna.');
    }
  }

  if (!saved) return null;
  return (
    <details className="rounded-[22px] bg-period px-[18px] py-4">
      <summary className="cursor-pointer font-display text-lg font-bold">Urvalsregler</summary>
      <div className="mt-4 flex flex-col gap-4">
        <p className="m-0 text-sm text-muted">Reglerna styr vad som hämtas och vad som föreslås. Det du redan valt rörs aldrig av en ny hämtning.</p>
        <Field label="Regioner (Eventors organisations-ID)" htmlFor="eventor-orgs" hint="Ett distrikts-ID inkluderar alla klubbar i distriktet. Östergötland är 24. Flera ID skrivs med komma.">
          <input id="eventor-orgs" className={INPUT} value={orgs} onChange={(e) => setOrgs(e.target.value)} />
        </Field>
        <Field label="OK Ekens organisations-ID" htmlFor="eventor-own" hint="Tävlingar som klubben själv arrangerar föreslås alltid.">
          <input id="eventor-own" className={INPUT} value={own} onChange={(e) => setOwn(e.target.value)} />
        </Field>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-[15px] font-semibold">Klassificeringar som föreslås</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {Object.entries(CLASSIFICATIONS).map(([id, label]) => (
              <label key={id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={classes.includes(Number(id))}
                  onChange={(e) => setClasses(e.target.checked ? [...classes, Number(id)] : classes.filter((c) => c !== Number(id)))}
                  className="h-4 w-4 accent-[#8A4B9E]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Discipliner som föreslås (Eventors disciplin-ID)" htmlFor="eventor-disc" hint="1 = orientering. Flera ID skrivs med komma.">
          <input id="eventor-disc" className={INPUT} value={disciplines} onChange={(e) => setDisciplines(e.target.value)} />
        </Field>
        <Field label="Månader framåt" htmlFor="eventor-months" hint="1–24.">
          <input id="eventor-months" className={`${INPUT} max-w-[120px]`} inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <ActionButton primary onClick={save}>Spara regler</ActionButton>
          {message && <span role="status" className="text-sm text-[#2F5A2B]">{message}</span>}
        </div>
        {error && <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      </div>
    </details>
  );
}
