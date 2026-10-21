import { getCollection } from 'astro:content';
import { renderMarkdown, toExcerpt } from './markdown';
import type { PublicEvent } from '../types/event';

/** Alla publicerade events, sorterade på starttid. */
export async function getPublicEvents(): Promise<PublicEvent[]> {
  const entries = await getCollection('events');
  return entries
    .map(({ id, data }) => ({
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
      bodyHtml: renderMarkdown(data.body),
      excerpt: toExcerpt(data.body),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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
  }));
  return [...own, ...eventor].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
