import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { CATEGORIES } from '../lib/categories';
import {
  addDays,
  dayKey,
  daysBetween,
  formatKeyShort,
  formatPeriod,
  isWeekend,
  keyDayOfMonth,
  keyMonthLabel,
  keyMonthShort,
  keyWeekdayShort,
} from '../lib/time';
import type { EventType, PublicEvent } from '../types/event';
import CategoryChip from './CategoryChip';
import EventDetail from './EventDetail';
import Icon from './Icon';

const CELL = 52; // px per dag i tidslinjen
const HEAD = 76; // höjd för månad + veckodag + datum
const LANE = 12; // höjd per eventrad (stapel + mellanrum)
const MAX_LANES = 3;
const DESKTOP = '(min-width: 1024px)';

type Filter = 'all' | EventType;
const FILTERS: Filter[] = ['all', 'training', 'competition', 'meeting'];

interface CalEvent extends PublicEvent {
  startDay: string;
  endDay: string;
}

interface Props {
  events: PublicEvent[];
  /** Dagens datum vid bygget; ersätts med verkligt datum i webbläsaren */
  initialToday: string;
  siteUrl: string;
}

export default function Calendar({ events, initialToday, siteUrl }: Props) {
  const [today, setToday] = useState(initialToday);
  const [selectedDay, setSelectedDay] = useState(initialToday);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [extraPages, setExtraPages] = useState(0);
  const [scrollRequest, setScrollRequest] = useState({ n: 0, smooth: false });
  // Dagen ca 1/4 in i tidslinjen; styr månadsrubriken
  const [viewDay, setViewDay] = useState(initialToday);
  const scroller = useRef<HTMLDivElement>(null);

  const all = useMemo<CalEvent[]>(
    () => events.map((e) => ({ ...e, startDay: dayKey(e.startsAt), endDay: dayKey(e.endsAt) })),
    [events],
  );
  const filtered = filter === 'all' ? all : all.filter((e) => e.type === filter);

  // Sidan kan vara byggd en annan dag än den visas.
  useEffect(() => {
    const now = dayKey(new Date());
    if (now !== initialToday) {
      setToday(now);
      setSelectedDay(now);
      setScrollRequest((r) => ({ n: r.n + 1, smooth: false }));
    }
  }, [initialToday]);

  // Tidslinjen: ett år bakåt och framåt från idag, utökad så att alla events får plats.
  const [rangeStart, rangeEnd] = useMemo(() => {
    const first = all[0]?.startDay ?? today;
    const last = all.reduce((max, e) => (e.endDay > max ? e.endDay : max), today);
    return [addDays(first < today ? first : today, -365), addDays(last, 365)];
  }, [all, today]);
  const days = useMemo(
    () => Array.from({ length: daysBetween(rangeStart, rangeEnd) + 1 }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, rangeEnd],
  );
  const indexOf = (key: string) => daysBetween(rangeStart, key);

  const bars = useMemo(() => {
    const laneEnds: string[] = [];
    return filtered
      .map((e) => {
        let lane = laneEnds.findIndex((end) => end < e.startDay);
        if (lane === -1) lane = laneEnds.push(e.endDay) - 1;
        else laneEnds[lane] = e.endDay;
        return { e, lane };
      })
      .filter(({ lane }) => lane < MAX_LANES);
  }, [filtered]);

  // Markerat datum hamnar ca 1/4 från vänster.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({
      left: indexOf(selectedDay) * CELL - el.clientWidth / 4 + CELL / 2,
      behavior: scrollRequest.smooth ? 'smooth' : 'auto',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRequest]);

  function onTimelineScroll() {
    const el = scroller.current;
    if (!el) return;
    const i = Math.floor((el.scrollLeft + el.clientWidth / 4) / CELL);
    setViewDay(days[Math.min(Math.max(i, 0), days.length - 1)]);
  }

  function selectDay(key: string, slug: string | null = null) {
    setSelectedDay(key);
    setSelectedSlug(slug);
    setExtraPages(0);
    setScrollRequest((r) => ({ n: r.n + 1, smooth: true }));
  }

  function scrollWeek(direction: 1 | -1) {
    scroller.current?.scrollBy({ left: direction * 7 * CELL, behavior: 'smooth' });
  }

  // Listan: valt datum först, sedan kommande (minst 6 st eller 2 månader), annars tidigare.
  const active = filtered.filter((e) => e.startDay <= selectedDay && selectedDay <= e.endDay);
  const upcomingAll = filtered.filter((e) => e.startDay > selectedDay);
  const horizon = addDays(selectedDay, 61);
  const baseCount = Math.max(6, upcomingAll.filter((e) => e.startDay <= horizon).length);
  const upcoming = upcomingAll.slice(0, baseCount + extraPages * 6);
  const past =
    active.length + upcomingAll.length === 0
      ? filtered.filter((e) => e.endDay < selectedDay).slice(-5).reverse()
      : [];
  const listed = [...active, ...upcoming, ...past];
  const selected = listed.find((e) => e.slug === selectedSlug) ?? listed[0];
  const isToday = selectedDay === today;

  function onItemClick(ev: MouseEvent, slug: string) {
    if (window.matchMedia(DESKTOP).matches) {
      ev.preventDefault();
      setSelectedSlug(slug);
    }
  }

  const renderItem = (e: CalEvent) => (
    <li key={e.slug}>
      <EventListItem event={e} selected={e.slug === selected?.slug} onClick={(ev) => onItemClick(ev, e.slug)} />
    </li>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-green-dark">Kalender</p>
          <h1 className="text-2xl font-extrabold capitalize tracking-tight text-brand-purple-dark sm:text-3xl">
            {keyMonthLabel(viewDay)}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton label="Föregående vecka" onClick={() => scrollWeek(-1)} icon="chevronLeft" />
          <button
            type="button"
            onClick={() => selectDay(today)}
            className="h-9 rounded-full border border-stone-300 bg-white px-4 text-sm font-bold text-stone-800 hover:border-brand-purple hover:text-brand-purple"
          >
            Idag
          </button>
          <IconButton label="Nästa vecka" onClick={() => scrollWeek(1)} icon="chevronRight" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div ref={scroller} onScroll={onTimelineScroll} className="no-scrollbar overflow-x-auto overscroll-x-contain">
          <div className="relative" style={{ width: days.length * CELL, height: HEAD + MAX_LANES * LANE + 10 }}>
            <div className="flex h-full">
              {days.map((key, i) => {
                const dom = keyDayOfMonth(key);
                const sel = key === selectedDay;
                const tod = key === today;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectDay(key)}
                    aria-label={formatKeyShort(key)}
                    aria-pressed={sel}
                    className={`relative flex h-full shrink-0 flex-col items-center pt-6 ${isWeekend(key) ? 'bg-stone-100/80' : ''} ${dom === 1 ? 'border-l border-stone-300' : ''}`}
                    style={{ width: CELL }}
                  >
                    {(dom === 1 || i === 0) && (
                      <span className="absolute left-1.5 top-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-brand-purple">
                        {keyMonthShort(key)}
                      </span>
                    )}
                    <span className={`text-[11px] font-semibold ${tod ? 'text-brand-green-dark' : 'text-stone-500'}`}>
                      {keyWeekdayShort(key)}
                    </span>
                    <span
                      className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        sel
                          ? 'bg-brand-purple text-white'
                          : tod
                            ? 'text-brand-green-dark ring-2 ring-brand-green'
                            : 'text-stone-800 hover:bg-stone-200'
                      }`}
                    >
                      {dom}
                    </span>
                  </button>
                );
              })}
            </div>
            {bars.map(({ e, lane }) => {
              const cat = CATEGORIES[e.type];
              const start = indexOf(e.startDay);
              const span = daysBetween(e.startDay, e.endDay) + 1;
              return (
                <button
                  key={e.slug}
                  type="button"
                  title={e.title}
                  aria-label={`${e.title}, ${formatKeyShort(e.startDay)}`}
                  onClick={() => selectDay(e.startDay, e.slug)}
                  className="absolute h-2 rounded-full transition-[filter] hover:brightness-110"
                  style={{
                    left: start * CELL + 6,
                    width: span * CELL - 12,
                    top: HEAD + lane * LANE,
                    backgroundColor: cat.color,
                    opacity: e.slug === selected?.slug ? 1 : 0.75,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrera på kategori">
        {FILTERS.map((f) => {
          const on = filter === f;
          const cat = f === 'all' ? null : CATEGORIES[f];
          const color = cat?.color ?? '#682652';
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setFilter(f);
                setSelectedSlug(null);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors"
              style={on ? { backgroundColor: color, borderColor: color, color: '#fff' } : { borderColor: '#d6d3d1', color: '#44403c', backgroundColor: '#fff' }}
            >
              {cat && <Icon name={cat.icon} className="h-3.5 w-3.5" />}
              {cat?.label ?? 'Alla'}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {active.length > 0 && (
            <Section title={isToday ? 'Pågår idag' : `Aktivt ${formatKeyShort(selectedDay)}`}>{active.map(renderItem)}</Section>
          )}
          {upcoming.length > 0 && <Section title="Kommande">{upcoming.map(renderItem)}</Section>}
          {upcomingAll.length > upcoming.length && (
            <button
              type="button"
              onClick={() => setExtraPages((p) => p + 1)}
              className="mt-1 w-full rounded-xl border border-dashed border-stone-300 py-2.5 text-sm font-semibold text-stone-600 hover:border-brand-purple hover:text-brand-purple"
            >
              Visa fler
            </button>
          )}
          {past.length > 0 && (
            <>
              <div className="mb-6 rounded-xl bg-brand-green-light px-4 py-3 text-sm text-brand-green-dark">
                Inga planerade aktiviteter efter {formatKeyShort(selectedDay)}. Håll utkik här och på{' '}
                <a href="https://www.facebook.com/OKEkenOrientering" className="font-semibold underline">
                  Facebook
                </a>
                !
              </div>
              <Section title="Senaste">{past.map(renderItem)}</Section>
            </>
          )}
          {listed.length === 0 && <p className="text-stone-600">Inga aktiviteter att visa.</p>}
        </div>

        <aside className="hidden lg:col-span-7 lg:block">
          {selected && (
            <div className="sticky top-4 rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
              <EventDetail event={selected} as="h2" shareUrl={`${siteUrl}/event/${selected.slug}`} />
              <a
                href={`/event/${selected.slug}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-purple hover:underline"
              >
                Öppna eventsidan <Icon name="chevronRight" />
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2.5 text-xs font-bold uppercase tracking-widest text-stone-500">{title}</h2>
      <ul className="grid gap-2.5">{children}</ul>
    </section>
  );
}

function EventListItem({ event, selected, onClick }: { event: CalEvent; selected: boolean; onClick: (ev: MouseEvent) => void }) {
  const cat = CATEGORIES[event.type];
  const period = formatPeriod(event.startsAt, event.endsAt);
  return (
    <a
      href={`/event/${event.slug}`}
      onClick={onClick}
      className={`flex gap-3 rounded-xl border bg-white p-3 transition-shadow hover:shadow-md ${
        selected ? 'border-stone-200 lg:border-transparent lg:ring-2 lg:ring-brand-purple' : 'border-stone-200'
      }`}
    >
      <div
        className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg py-1.5"
        style={{ backgroundColor: `${cat.color}14`, color: cat.color }}
      >
        <span className="text-[11px] font-bold uppercase">{keyWeekdayShort(event.startDay)}</span>
        <span className="text-xl font-extrabold leading-none">{keyDayOfMonth(event.startDay)}</span>
        <span className="text-[11px] font-semibold">{keyMonthShort(event.startDay)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <CategoryChip type={event.type} size="sm" />
        <div className="mt-1 truncate font-bold text-stone-900">{event.title}</div>
        <div className="truncate text-sm text-stone-600">
          {event.location?.name ?? (period.to ? `${period.from} → ${period.to}` : period.from)}
        </div>
        {period.to && event.location && (
          <div className="truncate text-xs text-stone-500">t.o.m. {period.to}</div>
        )}
      </div>
    </a>
  );
}

function IconButton({ label, icon, onClick }: { label: string; icon: 'chevronLeft' | 'chevronRight'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 hover:border-brand-purple hover:text-brand-purple"
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}
