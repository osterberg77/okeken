import { getCollection } from 'astro:content';
import { renderMarkdown, toExcerpt } from './markdown';
import type { PublicEvent } from '../types/event';
import { getRoute } from './server/route';

/** Alla publicerade events, sorterade på starttid. */
export async function getPublicEvents(): Promise<PublicEvent[]> {
  const entries = await getCollection('events');
  const events = entries
    .map(({ id, data }): PublicEvent => ({
      slug: id,
      type: data.type,
      title: data.title,
      startsAt: data.startsAt.toISOString(),
      endsAt: data.endsAt.toISOString(),
      location: data.location,
      courseSetter: data.courseSetter,
      livelox: data.livelox,
      courseFiles: data.courseFiles,
      image: data.image,
      publisher: data.publisher,
      rsvpEnabled: data.rsvpEnabled,
      results: data.results,
      bodyHtml: renderMarkdown(data.body),
      excerpt: toExcerpt(data.body),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return withRoutes(events);
}

/** Lägger bilvägen från Åtvidaberg på kommande events med koordinater (passerade behöver ingen rutt). */
async function withRoutes(events: PublicEvent[]): Promise<PublicEvent[]> {
  const now = new Date().toISOString();
  for (const e of events) {
    const at = e.location;
    if (at?.lat === undefined || at.lng === undefined || e.endsAt < now) continue;
    const route = await getRoute({ lat: at.lat, lng: at.lng });
    if (route) e.route = route;
  }
  return events;
}

/** Egna publicerade events plus valda Eventor-tävlingar, sorterade på starttid. Bara för kalendern. */
export async function getCalendarEvents(): Promise<PublicEvent[]> {
  const own = await getPublicEvents();
  const eventor: PublicEvent[] = (await getCollection('eventorEvents')).map(({ id, data }) => ({
    slug: `eventor-${id}`,
    type: 'competition',
    title: data.name,
    startsAt: data.startsAt.toISOString(),
    endsAt: data.endsAt.toISOString(),
    allDay: data.allDay,
    bodyHtml: '',
    excerpt: '',
    externalUrl: data.url,
    organiser: data.organiserName,
    location: data.lat !== undefined && data.lng !== undefined ? { name: '', lat: data.lat, lng: data.lng } : undefined,
  }));
  return [...own, ...(await withRoutes(eventor))].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
