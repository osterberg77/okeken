/**
 * Resultat på träningar (beslut 0017). En rad i events/{eventId}/results är intern (startlista och resultat).
 * `youth` (ungdom, för LOK-stöd) och `memberUid` blir aldrig publika.
 */
export const SHOW_MODES = ['time', 'participated', 'hidden'] as const;
export type ShowMode = (typeof SHOW_MODES)[number];

export const SHOW_LABELS: Record<ShowMode, string> = {
  time: 'Visa tid',
  participated: 'Visa bara deltagit',
  hidden: 'Dölj',
};

export interface ResultRow {
  id: string;
  name: string;
  /** Bana som fritext (förslagen kommer från eventets PDF-banor men är ingen koppling) */
  course: string;
  /** Länk till medlemmen (members/{uid}) när namnet valts ur listan */
  memberUid: string | null;
  startAt: Date | null;
  /** Klockslag i mål (måltid) */
  finishAt: Date | null;
  /** Egen angiven total tid i sekunder, går före måltid minus starttid */
  totalSeconds: number | null;
  youth: boolean;
  show: ShowMode;
  updatedAt: Date | null;
}

/** En rad i den publika listan. `seconds` är null för "deltagit". */
export interface PublicResultEntry {
  name: string;
  course: string;
  seconds: number | null;
}
