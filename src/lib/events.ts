import { getCollection } from 'astro:content';
import { marked } from 'marked';
import type { PublicEvent } from '../types/event';

function toExcerpt(markdown: string, max = 160): string {
  const firstParagraph = markdown.trim().split(/\n\s*\n/)[0] ?? '';
  const text = firstParagraph
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Alla publicerade events, sorterade på starttid. */
export async function getPublicEvents(): Promise<PublicEvent[]> {
  const entries = await getCollection('events');
  return entries
    .map(({ id, data, body = '' }) => ({
      slug: id,
      type: data.type,
      title: data.title,
      startsAt: data.startsAt.toISOString(),
      endsAt: data.endsAt.toISOString(),
      location: data.location,
      courseSetter: data.courseSetter,
      livelox: data.livelox,
      bodyHtml: marked.parse(body, { async: false }),
      excerpt: toExcerpt(body),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
