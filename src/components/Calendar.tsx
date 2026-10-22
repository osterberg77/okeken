import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  addDays,
  dayKey,
  daysBetween,
  formatEventTime,
  formatKeyLong,
  isWeekend,
  keyDayOfMonth,
  keyMonthShort,
  keyWeekdayShort,
  lastDayOfMonth,
} from '../lib/time';
import type { EventType, PublicEvent } from '../types/event';
import CategoryChip from './CategoryChip';
import { CATEGORIES } from '../lib/categories';
import DaySymbol, { StartIcon, type DayKind } from './DaySymbol';
import { rememberedSignIn } from '../lib/firebase/flags';
import EventDetail from './EventDetail';
import MonthPicker from './MonthPicker';
import StatusBadge, { StatusLabel } from './admin/StatusBadge';
import type { DraftOverlay } from '../lib/firebase/calendar-drafts';

const CELL = 72; // px per dag (symbolytans bredd)
const DAYS_BEFORE = 5; // dagar till vänster om idag/valt datum (-5 … +10)
const PAGE = 6; // antal i huvudlistan innan "Visa fler"
const SIDE = 3; // antal i den andra listan (tidigare resp. kommande)
const DESKTOP = '(min-width: 1024px)';

// Möte och Händelse är sällsynta och syns under "Alla" (avsteg från specen, se kalender-och-kontrollsymboler.md).
type Filter = 'all' | Extract<EventType, 'training' | 'competition' | 'info'>;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Alla' },
  { key: 'training', label: CATEGORIES.training.label },
  { key: 'competition', label: CATEGORIES.competition.label },
  { key: 'info', label: CATEGORIES.info.label },
];

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
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);
  const [scrollRequest, setScrollRequest] = useState({ n: 0, smooth: false });
  const [viewDay, setViewDay] = useState(initialToday); // styr månadsrubriken
  const scroller = useRef<HTMLDivElement>(null);

  // Inloggade publicerare ser även utkast och ändringar (med statusetikett). Firebase hämtas bara om de är inloggade.
  const [overlay, setOverlay] = useState<DraftOverlay | null>(null);
  useEffect(() => {
    if (!rememberedSignIn()) return;
    let stop = () => {};
    let cancelled = false;
    import('../lib/firebase/calendar-drafts').then((m) => {
      if (!cancelled) stop = m.watchDraftOverlay(setOverlay);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const all = useMemo<CalEvent[]>(
    () =>
      [
        ...events.map((e) => {
          const adminId = overlay?.changed.get(e.slug);
          return adminId ? { ...e, state: 'changed' as const, adminId } : e;
        }),
        ...(overlay?.extra ?? []),
      ]
        .map((e) => ({ ...e, startDay: dayKey(e.startsAt), endDay: dayKey(e.endsAt) }))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [events, overlay],
  );
  const filtered = useMemo(() => (filter === 'all' ? all : all.filter((e) => e.type === filter)), [all, filter]);
  const startsOn = useMemo(() => new Set(filtered.map((e) => e.startDay)), [filtered]);
  const eventMonths = useMemo(() => new Set(filtered.map((e) => e.startDay.slice(0, 7))), [filtered]);

  // Sidan kan vara byggd en annan dag än den visas.
  useEffect(() => {
    const now = dayKey(new Date());
    if (now !== initialToday) {
      setToday(now);
      setSelectedDay(now);
      setScrollRequest((r) => ({ n: r.n + 1, smooth: false }));
    }
  }, [initialToday]);

  // "Oändlig" tidslinje: ett år bakåt och framåt, utökad så att alla events får plats.
  const [rangeStart, rangeEnd] = useMemo(() => {
    const first = all[0]?.startDay ?? today;
    const last = all.reduce((max, e) => (e.endDay > max ? e.endDay : max), today);
    return [addDays(first < today ? first : today, -365), addDays(last > today ? last : today, 365)];
  }, [all, today]);
  const days = useMemo(
    () => Array.from({ length: daysBetween(rangeStart, rangeEnd) + 1 }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, rangeEnd],
  );

  // Antal dagar som visas före markerat datum; färre på smal skärm så att datumet syns.
  const leadDays = (el: HTMLElement) => Math.min(DAYS_BEFORE, Math.floor(el.clientWidth / CELL / 3));

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({
      left: (daysBetween(rangeStart, selectedDay) - leadDays(el)) * CELL,
      behavior: scrollRequest.smooth ? 'smooth' : 'auto',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRequest]);

  function onTimelineScroll() {
    const el = scroller.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / CELL) + leadDays(el);
    setViewDay(days[Math.min(Math.max(i, 0), days.length - 1)]);
  }

  function selectDay(key: string, smooth = true) {
    setSelectedDay(key);
    setSelectedSlug(filtered.find((e) => e.startDay === key)?.slug ?? null);
    setShown(PAGE);
    setScrollRequest((r) => ({ n: r.n + 1, smooth }));
  }

  /** Månadsväljaren: innevarande månad → idag, framtida → den 1:a, passerad → sista dagen (så att listan börjar i den månaden). */
  function jumpToMonth(month: string) {
    const current = today.slice(0, 7);
    const key = month === current ? today : month > current ? `${month}-01` : lastDayOfMonth(month);
    selectDay(key < rangeStart ? rangeStart : key > rangeEnd ? rangeEnd : key, false);
  }

  function scrollWeek(direction: 1 | -1) {
    scroller.current?.scrollBy({ left: direction * 7 * CELL, behavior: 'smooth' });
  }

  // Listorna utgår alltid från verkliga idag: "Kommande" (närmast först) är det som inte har passerat,
  // "Tidigare" (senaste först) det som har passerat. Valt datum styr var listan börjar: väljer man en dag
  // bakåt i tiden blir "Tidigare" huvudlista och börjar vid den dagen, så att listan följer stegandet bakåt.
  const browsingPast = selectedDay < today;
  const upcomingAll = filtered.filter((e) => e.endDay >= (browsingPast ? today : selectedDay));
  const pastAll = filtered.filter((e) => e.endDay < today && (!browsingPast || e.startDay <= selectedDay)).reverse();
  const lists = browsingPast
    ? [
        { title: 'Tidigare', all: pastAll, empty: 'Inga tidigare aktiviteter.' },
        { title: 'Kommande', all: upcomingAll },
      ]
    : [
        { title: 'Kommande', all: upcomingAll, empty: 'Inga kommande aktiviteter just nu.' },
        { title: 'Tidigare', all: pastAll },
      ];
  const main = lists[0].all.slice(0, shown);
  const side = lists[1].all.slice(0, SIDE);
  const chosen = filtered.find((e) => e.slug === selectedSlug) ?? main[0] ?? side[0];

  function onRowClick(ev: MouseEvent, e: CalEvent) {
    // Mobil: länken öppnar eventsidan. Desktop: visa i detaljvyn bredvid.
    if (window.matchMedia(DESKTOP).matches) {
      ev.preventDefault();
      setSelectedSlug(e.slug);
    }
  }

  const row = (e: CalEvent) => (
    <EventRow key={e.slug} event={e} selected={e.slug === chosen?.slug} onClick={(ev) => onRowClick(ev, e)} />
  );

  return (
    <div className="flex flex-col gap-7">
      <section aria-label="Tidslinje" className="relative z-10 rounded-[28px] bg-map shadow-panel">
        {/* Kartan klipps i en egen ram så att månadsväljaren kan hänga ut under panelen. */}
        <div className="absolute inset-0 overflow-hidden rounded-[28px]">
          <MapBackground />
        </div>
        <div className="relative pt-[22px] pb-[14px]">
          <div className="flex flex-wrap items-center gap-2.5 px-5 pb-3 sm:px-7">
            <MonthPicker
              viewDay={viewDay}
              currentMonth={today.slice(0, 7)}
              min={rangeStart.slice(0, 7)}
              max={rangeEnd.slice(0, 7)}
              eventMonths={eventMonths}
              onSelect={jumpToMonth}
            />
            <RoundButton label="Tidigare" onClick={() => scrollWeek(-1)}>‹</RoundButton>
            <RoundButton label="Senare" onClick={() => scrollWeek(1)}>›</RoundButton>
            <div className="hidden flex-1 sm:block" />
            <div className="no-scrollbar -mx-5 flex w-[calc(100%+40px)] items-center gap-2 overflow-x-auto px-5 sm:mx-0 sm:w-auto sm:gap-2.5 sm:overflow-visible sm:px-0">
              {FILTERS.map((f) => {
                const on = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setFilter(f.key);
                      setSelectedSlug(null);
                      setShown(PAGE);
                    }}
                    className={`flex-none cursor-pointer rounded-full px-3.5 py-2 text-[13px] sm:px-4 font-semibold shadow-[0_1px_3px_rgba(43,40,56,.1)] ${
                      on ? 'bg-ink text-white' : 'bg-white/85 text-ink hover:bg-white'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => selectDay(today)}
                aria-label="Gå till idag"
                className="order-first inline-flex flex-none cursor-pointer items-center gap-[7px] rounded-full bg-white/90 py-2 pr-3.5 pl-3 sm:order-none text-[13px] font-semibold text-ink shadow-chip hover:bg-white"
              >
                <StartIcon />
                idag
              </button>
            </div>
          </div>

          <div ref={scroller} onScroll={onTimelineScroll} className="no-scrollbar flex overflow-x-auto px-5 pt-1 pb-2">
            {days.map((key) => {
              const has = startsOn.has(key);
              const isToday = key === today;
              const kind: DayKind = isToday ? (has ? 'todayEvent' : 'today') : has ? 'event' : 'plain';
              const bg = key === selectedDay ? 'bg-[rgba(138,75,158,.12)]' : isWeekend(key) ? 'bg-[rgba(43,40,56,.035)]' : '';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDay(key)}
                  aria-label={`${formatKeyLong(key)}${isToday ? ', idag' : ''}${has ? ', aktivitet' : ''}`}
                  aria-pressed={key === selectedDay}
                  className={`flex w-[72px] flex-none cursor-pointer flex-col items-center gap-0.5 rounded-[20px] pt-2 pb-1.5 text-ink ${bg}`}
                >
                  <span className="text-[11px] font-semibold tracking-[.08em] text-subtle uppercase">{keyWeekdayShort(key)}</span>
                  <span className="relative block h-16 w-[72px]">
                    <DaySymbol kind={kind} />
                    <span className="absolute inset-0 flex items-center justify-center pt-px font-display text-base leading-none font-bold text-ink">
                      {keyDayOfMonth(key)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-start gap-7">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3 lg:max-w-[440px]">
          <h2 className="m-0 mb-0.5 font-display text-xl font-bold">{lists[0].title}</h2>
          {main.length > 0 ? main.map(row) : <p className="text-muted">{lists[0].empty}</p>}
          {lists[0].all.length > main.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="cursor-pointer rounded-[22px] bg-white/60 py-3 text-sm font-semibold text-muted shadow-[0_1px_3px_rgba(43,40,56,.06)] hover:bg-white hover:text-accent"
            >
              Visa fler
            </button>
          )}
          {side.length > 0 && (
            <>
              <h2 className="mt-3.5 mb-0.5 font-display text-xl font-bold">{lists[1].title}</h2>
              {side.map(row)}
            </>
          )}
        </div>

        {chosen && (
          <div className="hidden min-w-0 flex-[999_1_480px] lg:block">
            <EventDetail event={chosen} today={today} as="h2" shareUrl={chosen.state ? undefined : `${siteUrl}/event/${chosen.slug}`} />
            {chosen.state && (
              <>
                <StatusBadge state={chosen.state} />
                <a href={`/admin/event?id=${chosen.adminId}`} className="mt-3 inline-block text-sm font-semibold text-accent">
                  Redigera i admin →
                </a>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function EventRow({ event, selected, onClick }: { event: CalEvent; selected: boolean; onClick: (ev: MouseEvent) => void }) {
  const time = event.allDay ? '' : formatEventTime(event.startsAt, event.endsAt);
  const meta = [keyWeekdayShort(event.startDay), time, event.location?.name ?? event.organiser].filter(Boolean).join(' · ');
  return (
    <a
      href={event.state ? `/admin/event?id=${event.adminId}` : `/event/${event.slug}`}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-[22px] px-[18px] py-4 text-ink no-underline ${
        event.state ? 'outline-2 -outline-offset-2 outline-[#F9D932] outline-dashed ' : ''
      }${
        selected
          ? 'bg-white shadow-[0_1px_3px_rgba(43,40,56,.06)] lg:shadow-[0_12px_28px_-14px_rgba(138,75,158,.45),0_0_0_2px_rgba(138,75,158,.62)]'
          : 'bg-white/60 shadow-[0_1px_3px_rgba(43,40,56,.06)] hover:bg-white'
      }`}
    >
      <span className="flex w-11 flex-none flex-col items-center">
        <span className="font-display text-2xl leading-none font-bold">{keyDayOfMonth(event.startDay)}</span>
        <span className="text-[11px] font-semibold tracking-[.08em] text-subtle uppercase">{keyMonthShort(event.startDay)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <span className="flex flex-wrap items-center gap-2">
          <CategoryChip type={event.type} />
          {event.state && <StatusLabel state={event.state} />}
          {event.externalUrl && <span className="text-[12px] font-semibold text-subtle">Eventor</span>}
        </span>
        <span className="font-display text-[17px] leading-[1.25] font-semibold">{event.title}</span>
        <span className="text-[13px] text-subtle">{meta}</span>
      </span>
    </a>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-[34px] w-[34px] cursor-pointer rounded-full bg-white/90 text-lg leading-none text-ink shadow-chip hover:bg-white"
    >
      {children}
    </button>
  );
}

/** Förenklad orienteringskarta som bakgrund i kalenderpanelen */
function MapBackground() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1240 260" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <rect width="1240" height="260" fill="#FFFEF8" />
      <path
        d="M0 190 C150 160 260 230 420 200 S700 150 860 190 S1120 220 1240 180 L1240 260 L0 260z"
        fill="#DDEBD0"
        opacity=".55"
      />
      <ellipse cx="1080" cy="60" rx="90" ry="26" fill="#D6EAF2" opacity=".7" />
      <g fill="none" stroke="#C9A77A" strokeWidth="1" opacity=".5">
        <path d="M0 50 C200 20 340 90 520 55 S860 20 1240 70" />
        <path d="M0 90 C180 60 330 130 520 95 S880 60 1240 110" />
        <path d="M0 130 C200 100 360 170 540 135 S900 100 1240 150" />
        <path d="M0 230 C200 205 360 250 560 225 S900 205 1240 240" />
      </g>
    </svg>
  );
}
