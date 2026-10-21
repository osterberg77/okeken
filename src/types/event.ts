export const EVENT_TYPES = ['training', 'competition', 'meeting', 'info', 'happening'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** PDF-bana i Storage. `storagePath` är unik (slumpad) och skrivs aldrig över. */
export interface CourseFile {
  /** Ursprungligt filnamn */
  name: string;
  storagePath: string;
  /** Text på nedladdningslänken, t.ex. "Bana A" */
  label: string;
}

export const MAX_COURSE_FILES = 8;

/**
 * Huvudbild ur bildbanken (visas i eventkortet och som og:image vid delning). Adresserna kopieras från
 * bildbanksposten när bilden väljs, så eventet påverkas inte om posten senare ändras. Raderas bilden ur
 * bildbanken blir den trasig på sajten (som bilder i Markdown, beslut 0007).
 */
export interface EventImage {
  /** Bildbankspostens id (för editorn; reglerna binder inte adresserna till det) */
  imageId: string;
  /** Bildbankens webUrl (längsta sida 1920 px) */
  url: string;
  /** Bildbankens thumbnailUrl (800 px), för editorn */
  thumbnailUrl: string;
  /** Alt-text, högst 300 tecken. Förifylls med bildens beskrivning (eller namn) och kan ändras per event */
  alt: string;
}

export const MAX_IMAGE_ALT = 300;

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
  courseFiles: CourseFile[];
  /** Valfri huvudbild; null = ingen (äldre events saknar fältet i Firestore) */
  image: EventImage | null;
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
  courseFiles?: { label: string; url: string }[];
  /** Huvudbild: kanonisk Storage-adress (webbversionen) och alt-text */
  image?: { url: string; alt: string };
  bodyHtml: string;
  /** Kort klartext för listor och Open Graph */
  excerpt: string;
  /** Tävling från Eventor: kalenderposten länkar hit (Eventor) i stället för till en egen eventsida */
  externalUrl?: string;
  /** Eventor anger bara datum (ingen tid): visa då ingen tid i listan */
  allDay?: boolean;
  /** Arrangörens namn (Eventor-tävlingar) */
  organiser?: string;
  /** Bara för inloggade publicerare i kalendern: eventet är inte (helt) live. Saknas för vanliga publika events. */
  state?: 'draft' | 'changed' | 'unpublished';
  /** Eventets id i admin, när `state` är satt */
  adminId?: string;
}
