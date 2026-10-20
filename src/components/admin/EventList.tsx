import { useEffect, useState } from 'react';
import { eventState, watchEvents } from '../../lib/firebase/events';
import { dayKey, formatEventTime, keyDayOfMonth, keyMonthShort, keyWeekdayShort } from '../../lib/time';
import type { EventRecord } from '../../types/event';
import { canPublish } from '../../types/user';
import CategoryChip from '../CategoryChip';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import { StatusLabel } from './StatusBadge';

export default function EventList() {
  return (
    <AdminGate allowed={canPublish} requirement="publicerare, styrelse eller superadmin">
      {() => <Events />}
    </AdminGate>
  );
}

function Events() {
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => watchEvents(setEvents, () => setError('Kunde inte läsa events.')), []);

  const today = dayKey(new Date());
  const current = (events ?? []).filter((e) => dayKey(e.endsAt) >= today).reverse(); // närmast först
  const past = (events ?? []).filter((e) => dayKey(e.endsAt) < today);

  return (
    <AdminPanel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <AdminTitle>Events</AdminTitle>
          <p className="mt-2 text-muted">Träningar, tävlingar och annat i kalendern. Ändringar syns på sajten när de publicerats.</p>
        </div>
        <a
          href="/admin/event"
          className="rounded-full bg-accent px-6 py-[13px] text-sm font-semibold text-white no-underline shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110"
        >
          Nytt event
        </a>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      {events === null && !error && <p className="text-muted">Laddar events…</p>}

      {events && (
        <>
          <Section title="Kommande och pågående" events={current} empty="Inga kommande events. Skapa ett nytt!" />
          <Section title="Tidigare" events={past} empty="Inga tidigare events." />
        </>
      )}
    </AdminPanel>
  );
}

function Section({ title, events, empty }: { title: string; events: EventRecord[]; empty: string }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="m-0 font-display text-xl font-bold">{title}</h2>
      {events.length === 0 && <p className="text-muted">{empty}</p>}
      {events.map((e) => {
        const start = dayKey(e.startsAt);
        const meta = [keyWeekdayShort(start), formatEventTime(e.startsAt.toISOString(), e.endsAt.toISOString()), e.location.name]
          .filter(Boolean)
          .join(' · ');
        return (
          <a
            key={e.id}
            href={`/admin/event?id=${e.id}`}
            className="flex items-center gap-4 rounded-[22px] bg-period px-[18px] py-3.5 text-ink no-underline hover:bg-pastel"
          >
            <span className="flex w-11 flex-none flex-col items-center">
              <span className="font-display text-2xl leading-none font-bold">{keyDayOfMonth(start)}</span>
              <span className="text-[11px] font-semibold tracking-[.08em] text-subtle uppercase">{keyMonthShort(start)}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <CategoryChip type={e.type} />
                <StatusLabel state={eventState(e)} />
              </span>
              <span className="truncate font-display text-[17px] font-semibold">{e.title || '(utan titel)'}</span>
              <span className="truncate text-[13px] text-subtle">{meta}</span>
            </span>
          </a>
        );
      })}
    </section>
  );
}
