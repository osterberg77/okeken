import type { EventRoute } from '../lib/geo';
import type { ExtraPlace, PlaceIcon } from '../lib/place-icons';
import type { PublicResultEntry } from './result';

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
  /**
   * `coords`: koordinater som text ("58.2, 16.0" eller en kartlänk); sparas som lat/lng i Firestore.
   * `icon`: huvudplatsens ikon (den platsen får vägvisning). `places`: extra markörer på kartan, utan vägvisning.
   */
  location: { name: string; mapUrl: string; coords: string; icon: PlaceIcon; places: EditablePlace[] };
  body: string;
  courseSetter: string;
  livelox: string;
  courseFiles: CourseFile[];
  /** Valfri huvudbild; null = ingen (äldre events saknar fältet i Firestore) */
  image: EventImage | null;
  /** "Publicerat av": uid för en medlem (members/{uid}), eller null = ingen. Namn och bild slås upp vid bygget. */
  publisher: string | null;
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
  /** Schemalagd publicering: utkastet publiceras av en Function när tiden passerat (beslut 0016). null = ingen. */
  publishAt: Date | null;
  /** Resultat på träningen: visar startlista/resultat i admin (beslut 0017). Ingår inte i ögonblicksbilden. */
  resultsEnabled: boolean;
  updatedAt: Date | null;
}

/** Extra plats i editorn; koordinaterna som text, samma format som huvudplatsens */
export interface EditablePlace {
  icon: PlaceIcon;
  label: string;
  coords: string;
}

export interface EventLocation {
  /** Kan vara tom när bara koordinater finns */
  name: string;
  mapUrl?: string;
  lat?: number;
  lng?: number;
  /** Huvudplatsens ikon; saknas på äldre events (då start) */
  icon?: PlaceIcon;
  /** Extra markörer på kartan */
  places?: ExtraPlace[];
}

/** Den som står som publicerare på ett event, i publik form */
export interface PublicPublisher {
  name: string;
  photoUrl?: string;
  /** Profilfärg (id i src/lib/avatar.ts) */
  color?: string;
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
  /** "Publicerat av", bara när personen godkänt policyn och inte dolt sitt namn (members.publicName) */
  publisher?: PublicPublisher;
  /** Publicerad resultatlista (sorterad på bana och tid), bara när resultat publicerats */
  results?: PublicResultEntry[];
  bodyHtml: string;
  /** Kort klartext för listor och Open Graph */
  excerpt: string;
  /** Bilväg från Åtvidaberg, räknad vid bygget; saknas utan koordinater eller om ruttjänsten svarade fel */
  route?: EventRoute;
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
