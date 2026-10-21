import type { EventContent, PublicEvent } from '../types/event';
import type { PageContent, PublicPage } from '../types/page';
import { toPublicCourseFiles } from './courses';
import { toPublicImage } from './event-image';
import { renderMarkdown, toExcerpt } from './markdown';

/** Utkast/innehåll i publik form, för adminpreview och för utkast i kalendern. */
export function toPreview(c: EventContent, slug: string | null): PublicEvent {
  return {
    slug: slug ?? 'forhandsvisning',
    type: c.type,
    title: c.title.trim() || 'Titel saknas',
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    location: c.location.name.trim() ? { name: c.location.name.trim(), mapUrl: c.location.mapUrl.trim() || undefined } : undefined,
    courseSetter: c.courseSetter.trim() || undefined,
    livelox: c.livelox.trim() || undefined,
    courseFiles: c.courseFiles.length ? toPublicCourseFiles(c.courseFiles) : undefined,
    image: toPublicImage(c.image),
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
