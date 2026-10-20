import { formatPeriod } from '../lib/time';
import type { PublicEvent } from '../types/event';
import CategoryChip from './CategoryChip';
import ControlFlag from './ControlFlag';
import Icon from './Icon';

interface Props {
  event: PublicEvent;
  /** h1 på eventsidan, h2 i kalenderns detaljvy */
  as?: 'h1' | 'h2';
  /** Absolut adress till eventsidan; visar delningslänk när den finns */
  shareUrl?: string;
}

// Delas av eventsidan (statisk HTML), kalenderns detaljvy och – senare – adminpreview.
export default function EventDetail({ event, as: Heading = 'h1', shareUrl }: Props) {
  const period = formatPeriod(event.startsAt, event.endsAt);

  return (
    <article>
      <CategoryChip type={event.type} />
      <Heading className="mt-3 text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">{event.title}</Heading>

      <div className="mt-5 flex items-center gap-4 rounded-xl border border-stone-200 bg-brand-sand px-4 py-3">
        <ControlFlag className="h-11 w-11 shrink-0" />
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
            {period.to ? 'Aktiv' : 'Datum'}
          </div>
          <div className="font-semibold text-stone-900">
            <span className="whitespace-nowrap">{period.from}</span>
            {period.to && (
              <>
                {' '}
                <span className="whitespace-nowrap">
                  <span className="mr-1 text-stone-400">→</span>
                  {period.to}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {(event.location || event.courseSetter || event.livelox) && (
        <dl className="mt-5 grid gap-3 text-sm">
          {event.location && (
            <MetaRow icon="pin" label="Plats">
              <span className="mr-2">{event.location.name}</span>
              {event.location.mapUrl && (
                <a href={event.location.mapUrl} className="inline-flex whitespace-nowrap items-center gap-1 font-semibold text-brand-purple hover:underline" target="_blank" rel="noopener">
                  Visa karta <Icon name="external" className="h-3.5 w-3.5" />
                </a>
              )}
            </MetaRow>
          )}
          {event.courseSetter && (
            <MetaRow icon="person" label="Banläggare">
              {event.courseSetter}
            </MetaRow>
          )}
          {event.livelox && (
            <MetaRow icon="route" label="Livelox">
              <a href={event.livelox} className="inline-flex items-center gap-1 font-semibold text-brand-purple hover:underline" target="_blank" rel="noopener">
                Se banorna i Livelox <Icon name="external" className="h-3.5 w-3.5" />
              </a>
            </MetaRow>
          )}
        </dl>
      )}

      <div className="prose-eken mt-6" dangerouslySetInnerHTML={{ __html: event.bodyHtml }} />

      {shareUrl && (
        <div className="mt-8 border-t border-stone-200 pt-5">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:border-brand-purple hover:text-brand-purple"
            target="_blank"
            rel="noopener"
          >
            <Icon name="share" /> Dela på Facebook
          </a>
        </div>
      )}
    </article>
  );
}

function MetaRow({ icon, label, children }: { icon: 'pin' | 'person' | 'route'; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="flex w-28 shrink-0 items-start gap-2 font-semibold text-stone-500 [&>svg]:mt-0.5">
        <Icon name={icon} /> {label}
      </dt>
      <dd className="min-w-0 text-stone-800">{children}</dd>
    </div>
  );
}
