export const RSVP_STATUSES = ['yes', 'maybe', 'no'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  yes: 'Kommer',
  maybe: 'Kommer kanske',
  no: 'Kommer inte',
};

/** Ett svar i `rsvps/{slug}/responses/{uid}` (beslut 0012). `name` är tomt när användaren dolt sitt namn. */
export interface RsvpResponse {
  uid: string;
  status: RsvpStatus;
  name: string;
}
