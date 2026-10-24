import { useEffect, useState, type CSSProperties } from 'react';
import {
  addDays,
  dayKey,
  daysBetween,
  formatEventTime,
  formatKeyLong,
  formatKeyMedium,
  keyWeekdayShort,
} from '../lib/time';
import { bankImageSrc } from '../lib/markdown';
import type { PublicEvent } from '../types/event';
import Avatar from './Avatar';
import CategoryChip from './CategoryChip';
import ResultsList from './ResultsList';
import RouteMap from './RouteMap';
import RsvpBox from './RsvpBox';

interface Props {
  event: PublicEvent;
  /** Dagnyckel för idag; styr taggen "Avslutad" */
  today: string;
  /** h1 på eventsidan, h2 i kalenderns detaljvy */
  as?: 'h1' | 'h2';
  /** Absolut adress till eventsidan; visar delningsknapp när den finns */
  shareUrl?: string;
  /** 'eager' när kortet är det första på sidan (eventsidan); annars laddas huvudbilden när den syns */
  imageLoading?: 'eager' | 'lazy';
  /** Visa "Kommer du?" för inloggade medlemmar. Av i adminpreview och för utkast (där finns inget publikt event att svara på). */
  rsvp?: boolean;
}

/** Relativ markering bredvid datumet. Räknas i webbläsaren (sidan är förbyggd, så "idag" från bygget vore fel dagen efter). */
function whenLabel(startDay: string, endDay: string, now: string): string | null {
  if (endDay < now) return 'Passerat';
  if (startDay > now) {
    const n = daysBetween(now, startDay);
    return n === 1 ? 'Imorgon' : `Om ${n} dagar`;
  }
  return startDay === now ? 'Idag' : 'Pågående';
}

// Delas av eventsidan (statisk HTML), kalenderns detaljvy och adminpreview.
export default function EventDetail({ event, today, as: Heading = 'h1', shareUrl, imageLoading = 'lazy', rsvp = false }: Props) {
  const startDay = dayKey(event.startsAt);
  const endDay = dayKey(event.endsAt);
  const isPast = endDay < today;
  const time = event.allDay ? '' : formatEventTime(event.startsAt, event.endsAt);
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => setNow(dayKey(new Date())), []);
  const when = now ? whenLabel(startDay, endDay, now) : null;

  const actions: { label: string; href: string }[] = [];
  if (event.externalUrl) actions.push({ label: 'Öppna i Eventor', href: event.externalUrl });
  if (event.livelox) actions.push({ label: 'Öppna i Livelox', href: event.livelox });
  // Kartlänken ligger under kartan när platsen har koordinater; mapUrl är reserv för äldre event utan
  if (event.location?.mapUrl && event.location.lat === undefined) actions.push({ label: 'Visa karta', href: event.location.mapUrl });
  if (shareUrl) {
    actions.push({ label: 'Dela på Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` });
  }

  return (
    <article className="@container flex min-w-0 flex-wrap overflow-hidden rounded-[28px] bg-white shadow-card">
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-[18px] px-6 pt-7 pb-8 sm:px-[38px] sm:pt-[34px] sm:pb-[38px]">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip type={event.type} />
          {isPast && <CategoryChip type={null} past />}
        </div>

        <Heading className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">
          {event.title}
        </Heading>

        <div className="flex flex-wrap gap-x-6 gap-y-2 font-medium text-muted">
          <span>
            {formatKeyLong(startDay)}
            {when && (
              <span className="ml-2 inline-block rounded-full bg-accent px-2.5 py-0.5 align-[1px] text-xs font-semibold tracking-[.04em] text-white uppercase">
                {when}
              </span>
            )}
          </span>
          {time && <span>{time}</span>}
          {event.location?.name && <span>{event.location.name}</span>}
          {event.organiser && <span>Arrangör {event.organiser}</span>}
          {event.courseSetter && <span>{event.type === 'meeting' || event.type === 'info' ? 'Ansvarig' : 'Banläggare'} {event.courseSetter}</span>}
        </div>

        {startDay !== endDay && (
          <PeriodChain startDay={startDay} endDay={endDay} label={event.type === 'training' ? 'BANAN ÄR UTE' : 'PÅGÅR'} />
        )}

        {event.bodyHtml && <div className="prose-eken" dangerouslySetInnerHTML={{ __html: event.bodyHtml }} />}

        {event.location?.lat !== undefined && event.location.lng !== undefined && (
          <RouteMap to={{ lat: event.location.lat, lng: event.location.lng }} label={event.location.name || undefined} route={event.route} icon={event.location.icon} places={event.location.places} />
        )}

        {rsvp && !event.externalUrl && !isPast && <RsvpBox key={event.slug} slug={event.slug} />}

        {event.results && event.results.length > 0 && <ResultsList entries={event.results} />}

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

        {event.publisher && (
          <p className="m-0 flex items-center gap-2.5 text-sm text-muted">
            <Avatar name={event.publisher.name} color={event.publisher.color} photoUrl={event.publisher.photoUrl} size={26} />
            <span>
              Publicerat av <span className="font-semibold text-ink">{event.publisher.name}</span>
            </span>
          </p>
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

      {event.image && (
        // Spec (docs/skisser): bild till höger, 300 px, radie 20 px, marginal 14 px, object-fit cover. Kortets bredd
        // (containerfråga) avgör: smalt kort ger bilden i full bredd ÖVERST i kortet (16:9). Ramen har alltid en
        // bestämd storlek, så sidan hoppar inte när bilden laddas.
        <div className="relative order-first m-3.5 mb-0 aspect-[16/9] flex-[1_1_100%] overflow-hidden rounded-[20px] bg-period @min-[680px]:order-none @min-[680px]:m-3.5 @min-[680px]:ml-0 @min-[680px]:aspect-auto @min-[680px]:min-h-[280px] @min-[680px]:min-w-[240px] @min-[680px]:flex-[0_1_300px]">
          <img
            src={bankImageSrc(event.image.url)}
            alt={event.image.alt}
            loading={imageLoading}
            decoding="async"
            className="absolute inset-0 block h-full w-full object-cover"
          />
        </div>
      )}
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
      <div className="no-scrollbar -mx-2 -my-1 flex items-end overflow-x-auto px-2 py-1" aria-hidden="true">
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
