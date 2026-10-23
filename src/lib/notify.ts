// Kuvert-notiser (beslut 0019): en funktion som sparar något kan samtidigt skicka ett automatiskt meddelande.
// Ren logik utan Firebase-import. Se NotifyToggle (komponenten) och sendNotices (src/lib/firebase/messages.ts).

import { PERMISSION_LABELS, type Permission } from '../types/user';

export interface NoticePlan {
  /** uid:n som ska få meddelandet. Avsändaren själv och tomma värden tas bort, dubbletter slås ihop. */
  recipients: readonly (string | null | undefined)[];
  /** Meddelandets text (högst 1000 tecken) */
  text: string;
  /** Adress på sajten som mottagaren kan öppna, t.ex. /admin/event?id=… */
  link?: string;
}

/** De som faktiskt ska få meddelandet: unika, utan avsändaren och utan tomma värden */
export function noticeRecipients(plan: Pick<NoticePlan, 'recipients'>, me: string): string[] {
  return [...new Set(plan.recipients.filter((r): r is string => typeof r === 'string' && r !== '' && r !== me))];
}

/** Tooltiptext för kuvertet: säger vad som skickas (eller att inget skickas) och att klick växlar */
export function notifyTooltip(enabled: boolean, summary: string): string {
  return enabled ? `Skickar meddelande: ${summary} Klicka för att inte skicka.` : `Skickar inget meddelande. Klicka för att skicka: ${summary}`;
}

/** Meddelandet när någons behörighet ändras (null = ingen behörighet) */
export function permissionNotice(previous: Permission | null, next: Permission | null): string {
  if (next === null) return 'Din behörighet i OK Eken har tagits bort.';
  if (previous === null && next === 'member') return 'Du är nu godkänd som medlem i OK Eken. Välkommen!';
  if (previous === null) return `Du har fått behörigheten ${PERMISSION_LABELS[next]} i OK Eken.`;
  return `Din behörighet i OK Eken har ändrats till ${PERMISSION_LABELS[next]}.`;
}
