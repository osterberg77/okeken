import { parseCoords } from './geo';
import type { EventContent, PublicEvent, PublicPublisher } from '../types/event';
import type { PageContent, PublicPage } from '../types/page';
import { toPublicCourseFiles } from './courses';
import { toPublicImage } from './event-image';
import { renderMarkdown, toExcerpt } from './markdown';

function previewLocation(l: EventContent['location']): PublicEvent['location'] {
  const at = parseCoords(l.coords);
  if (!l.name.trim() && !at) return undefined;
  const places = l.places.flatMap((p) => {
    const pt = parseCoords(p.coords);
    return pt ? [{ icon: p.icon, label: p.label.trim(), ...pt }] : [];
  });
  return { name: l.name.trim(), mapUrl: l.mapUrl.trim() || undefined, ...at, icon: l.icon, places: places.length ? places : undefined };
}

/** Utkast/innehåll i publik form, för adminpreview och för utkast i kalendern. */
export function toPreview(c: EventContent, slug: string | null, publisher?: PublicPublisher): PublicEvent {
  return {
    slug: slug ?? 'forhandsvisning',
    type: c.type,
    title: c.title.trim() || 'Titel saknas',
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    location: previewLocation(c.location),
    courseSetter: c.courseSetter.trim() || undefined,
    livelox: c.livelox.trim() || undefined,
    courseFiles: c.courseFiles.length ? toPublicCourseFiles(c.courseFiles) : undefined,
    image: toPublicImage(c.image),
    publisher,
    bodyHtml: renderMarkdown(c.body),
    excerpt: toExcerpt(c.body),
  };
}

/** Sidutkast i publik form, för adminpreview. */
export function toPagePreview(c: PageContent, slug: string | null): PublicPage {
  return {
    slug: slug ?? 'forhandsvisning',
    title: c.title.trim() || 'Titel saknas',
    bodyHtml: renderMarkdown(c.body),
    excerpt: toExcerpt(c.body),
  };
}
