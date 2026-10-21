import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './client';

export interface LinkTarget {
  kind: 'page' | 'event';
  title: string;
  /** Intern adress, t.ex. /om-klubben eller /event/2026-09-01-tavling */
  href: string;
  /** Extra rad i väljaren (datum för events) */
  detail?: string;
}

/** Sajtens fasta sidor som alltid finns */
export const STATIC_TARGETS = ['/', '/sok'];

/** Publicerade sidor och events som Markdown-länkar kan peka på. Hämtas en gång när editorn öppnas. */
export async function loadLinkTargets(): Promise<LinkTarget[]> {
  const [pageSnap, eventSnap] = await Promise.all([
    getDocs(query(collection(db, 'pages'), where('status', '==', 'published'))),
    getDocs(query(collection(db, 'events'), where('status', '==', 'published'))),
  ]);
  const pagesOut: LinkTarget[] = pageSnap.docs
    .map((d) => ({ kind: 'page' as const, title: (d.get('published.title') as string) || (d.get('title') as string), href: `/${d.get('slug')}` }))
    .sort((a, b) => a.title.localeCompare(b.title, 'sv'));
  const eventsOut = eventSnap.docs
    .map((d) => ({
      start: d.get('published.startsAt')?.toDate?.() as Date | undefined,
      target: { kind: 'event' as const, title: (d.get('published.title') as string) || (d.get('title') as string), href: `/event/${d.get('slug')}` },
    }))
    .sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0))
    .map(({ start, target }) => ({
      ...target,
      detail: start ? start.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
    }));
  return [...pagesOut, ...eventsOut];
}

/** Interna länkar i Markdown (`](/adress)`) som inte pekar på en publicerad sida eller ett publicerat event */
export function unpublishedLinks(markdown: string, targets: LinkTarget[]): string[] {
  const known = new Set([...STATIC_TARGETS, ...targets.map((t) => t.href)]);
  const found = new Set<string>();
  for (const m of markdown.matchAll(/\]\((\/(?!\/)[^)\s#?]*)/g)) {
    const href = m[1].length > 1 ? m[1].replace(/\/+$/, '') : m[1];
    if (!known.has(href)) found.add(href);
  }
  return [...found];
}
