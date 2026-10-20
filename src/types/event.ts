export type EventType = 'training' | 'competition' | 'meeting' | 'info' | 'happening';

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
