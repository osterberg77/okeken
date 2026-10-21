/** Tävling i Eventor-spegeln (eventorEvents/{eventId}). Eventor-fälten skrivs bara av scripts/sync-eventor.mjs. */
export interface EventorEvent {
  /** Dokument-id = Eventors EventId */
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  /** Eventor anger bara datum (klockan 00:00:00): visa då ingen tid */
  allDay: boolean;
  organiserId: number | null;
  organiserName: string;
  classificationId: number;
  disciplineId: number;
  statusId: number;
  /** T.ex. "RelaySingleDay", tomt för vanlig individuell tävling */
  form: string;
  /** Tävlingssidan i Eventor (anmälan, PM, startlistor) */
  url: string;
  /** Arrangörens egen webbadress, tom om den saknas */
  webUrl: string;
  /** Matchar urvalsreglerna i settings/eventor vid senaste hämtningen */
  suggested: boolean;
  /** Finns inte längre hos Eventor men var vald: visas inte i kalendern, publicerare får ta ställning */
  gone: boolean;
  /** Publicerarens val (utkast): visa i kalendern. Syns för besökare först när det publicerats (`live`). */
  selected: boolean;
  selectedBy: string | null;
  selectedAt: Date | null;
  /** Det som är publicerat; knappen Publicera sätter live = selected. Äldre poster saknar fältet (= false). */
  live: boolean;
  liveBy: string | null;
  liveAt: Date | null;
  fetchedAt: Date;
}

/** settings/eventor – urvalsregler för synken (board/superadmin ändrar). */
export interface EventorSettings {
  /** OK Ekens organisations-ID: egna tävlingar föreslås alltid */
  ownOrganisationId: number;
  /** Region och ev. grannar; ett distrikts-ID inkluderar alla klubbar i distriktet */
  organisationIds: number[];
  /** 0–5: 1 mästerskap, 2 nationell, 3 distrikt, 4 lokal, 5 klubb */
  classificationIds: number[];
  disciplineIds: number[];
  monthsAhead: number;
}

export const DEFAULT_EVENTOR_SETTINGS: EventorSettings = {
  ownOrganisationId: 510,
  organisationIds: [24],
  classificationIds: [1, 2, 3],
  disciplineIds: [1],
  monthsAhead: 12,
};
