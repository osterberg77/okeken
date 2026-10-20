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
      bodyHtml: renderMarkdown(data.body),
      excerpt: toExcerpt(data.body),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
