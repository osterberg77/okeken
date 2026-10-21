import type { CSSProperties } from 'react';
import {
  addDays,
  dayKey,
  daysBetween,
  formatEventTime,
  formatKeyLong,
  formatKeyMedium,
  keyWeekdayShort,
} from '../lib/time';
import type { PublicEvent } from '../types/event';
import CategoryChip from './CategoryChip';

interface Props {
  event: PublicEvent;
  /** Dagnyckel för idag; styr taggen "Avslutad" */
  today: string;
  /** h1 på eventsidan, h2 i kalenderns detaljvy */
  as?: 'h1' | 'h2';
  /** Absolut adress till eventsidan; visar delningsknapp när den finns */
  shareUrl?: string;
}

// Delas av eventsidan (statisk HTML), kalenderns detaljvy och – senare – adminpreview.
export default function EventDetail({ event, today, as: Heading = 'h1', shareUrl }: Props) {
  const startDay = dayKey(event.startsAt);
  const endDay = dayKey(event.endsAt);
  const isPast = endDay < today;
  const time = formatEventTime(event.startsAt, event.endsAt);

  const actions: { label: string; href: string }[] = [];
  if (event.livelox) actions.push({ label: 'Öppna i Livelox', href: event.livelox });
  if (event.location?.mapUrl) actions.push({ label: 'Visa karta', href: event.location.mapUrl });
  if (shareUrl) {
    actions.push({ label: 'Dela på Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` });
  }

  return (
    <article className="flex min-w-0 flex-wrap overflow-hidden rounded-[28px] bg-white shadow-card">
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-[18px] px-6 pt-7 pb-8 sm:px-[38px] sm:pt-[34px] sm:pb-[38px]">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip type={event.type} />
          {isPast && <CategoryChip type={null} past />}
        </div>

        <Heading className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">
          {event.title}
        </Heading>

        <div className="flex flex-wrap gap-x-6 gap-y-2 font-medium text-muted">
          <span>{formatKeyLong(startDay)}</span>
          {time && <span>{time}</span>}
          {event.location && <span>{event.location.name}</span>}
          {event.courseSetter && <span>Banläggare {event.courseSetter}</span>}
        </div>

        {startDay !== endDay && (
          <PeriodChain startDay={startDay} endDay={endDay} label={event.type === 'training' ? 'BANAN ÄR UTE' : 'PÅGÅR'} />
        )}

        <div className="prose-eken" dangerouslySetInnerHTML={{ __html: event.bodyHtml }} />

        {event.courseFiles && event.courseFiles.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-display text-lg font-bold">Banor</h3>
            <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
              {event.courseFiles.map((f) => (
                <li key={f.url}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener"
                    data-file={f.label}
                    className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink/18 bg-white px-5 py-[11px] text-sm font-semibold text-ink no-underline hover:border-accent hover:text-accent"
                  >
                    {f.label} <span className="text-xs font-medium text-subtle">PDF</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2.5 pt-1">
            {actions.map((a, i) => (
              <a
                key={a.label}
                href={a.href}
                target="_blank"
                rel="noopener"
                className={
                  i === 0
                    ? 'rounded-full bg-accent px-6 py-[13px] text-sm font-semibold text-white shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110'
                    : 'rounded-full border-[1.5px] border-ink/18 bg-white px-6 py-[13px] text-sm font-semibold text-ink hover:border-accent hover:text-accent'
                }
              >
                {a.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// Symbolkedja för aktiv period: start (triangel), dagar emellan (liten ring), mål (dubbelring).
const MARK_START: CSSProperties = {
  width: 0,
  height: 0,
  borderLeft: '11px solid transparent',
  borderRight: '11px solid transparent',
  borderBottom: '19px solid #8A4B9E',
  margin: '6px 0 4px',
};
const MARK_BETWEEN: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  boxSizing: 'border-box',
  border: '2.5px solid rgba(138,75,158,.5)',
  margin: '8px 0 6px',
};
const MARK_FINISH: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  boxSizing: 'border-box',
  border: '3px solid #8A4B9E',
  boxShadow: '0 0 0 5px #F7F3FA, 0 0 0 8px #8A4B9E',
  margin: '4px 0',
};

function PeriodChain({ startDay, endDay, label }: { startDay: string; endDay: string; label: string }) {
  const n = daysBetween(startDay, endDay);
  const days = Array.from({ length: n + 1 }, (_, i) => addDays(startDay, i));
  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-period px-[18px] py-4">
      <span className="text-xs font-semibold tracking-[.12em] text-subtle">{label}</span>
      <div className="no-scrollbar -my-1 flex items-end overflow-x-auto py-1" aria-hidden="true">
        {days.map((key, i) => (
          <span key={key} className="flex w-11 flex-none flex-col items-center gap-1 sm:w-14">
            <span style={i === 0 ? MARK_START : i === n ? MARK_FINISH : MARK_BETWEEN} />
            <span className="text-[11px] font-semibold tracking-[.06em] text-subtle uppercase">{keyWeekdayShort(key)}</span>
          </span>
        ))}
      </div>
      <span className="text-[13px] text-muted">
        Ute {formatKeyMedium(startDay)} till {formatKeyMedium(endDay)}.
      </span>
    </div>
  );
}
