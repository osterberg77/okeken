export const EVENT_TYPES = ['training', 'competition', 'meeting', 'info', 'happening'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Redigerbart innehåll i ett event. Tomma strängar betyder "saknas" (alla fält finns alltid, se firestore.rules). */
export interface EventContent {
  type: EventType;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: { name: string; mapUrl: string };
  body: string;
  courseSetter: string;
  livelox: string;
}

/**
 * - draft: aldrig publicerad
 * - published: live (utkastet kan ha opublicerade ändringar)
 * - unpublished: avpublicerad, syns inte för besökare
 */
export type EventStatus = 'draft' | 'published' | 'unpublished';

export interface EventRecord extends EventContent {
  id: string;
  status: EventStatus;
  slug: string | null;
  published: EventContent | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
}

export interface EventLocation {
  name: string;
  mapUrl?: string;
  lat?: number;
  lng?: number;
}

/** Publicerat event i serialiserbar form – det som bygget skickar till sidor och kalender. */
export interface PublicEvent {
  slug: string;
  type: EventType;
  title: string;
  /** ISO 8601 (UTC) */
  startsAt: string;
  /** ISO 8601 (UTC) */
  endsAt: string;
  location?: EventLocation;
  courseSetter?: string;
  livelox?: string;
  bodyHtml: string;
  /** Kort klartext för listor och Open Graph */
  excerpt: string;
}
