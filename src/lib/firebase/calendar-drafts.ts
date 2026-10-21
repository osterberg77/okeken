// Laddas bara dynamiskt när en inloggad användare besöker kalendern (se Calendar.tsx),
// så att besökare utan inloggning aldrig hämtar Firebase.
import { toPreview } from '../preview';
import type { PublicEvent } from '../../types/event';
import { canPublish } from '../../types/user';
import { eventState, watchEvents } from './events';
import { watchSession } from './session';

export interface DraftOverlay {
  /** Publicerade events (slug) vars utkast skiljer sig från det som är live */
  changed: Map<string, string>;
  /** Utkast och avpublicerade events som inte finns i den publika kalendern */
  extra: PublicEvent[];
}

/** Följer sessionen; för publicerare skickas utkast och ändringar, annars tom överlagring. */
export function watchDraftOverlay(callback: (overlay: DraftOverlay | null) => void): () => void {
  let stopEvents = () => {};
  const stopSession = watchSession((session) => {
    stopEvents();
    stopEvents = () => {};
    if (!session || !canPublish(session.permissions)) return callback(null);

    stopEvents = watchEvents(
      (records) => {
        const changed = new Map<string, string>();
        const extra: PublicEvent[] = [];
        for (const r of records) {
          const state = eventState(r);
          if (state === 'live') continue;
          if (state === 'changed' && r.slug) changed.set(r.slug, r.id);
          else if (state === 'draft' || state === 'unpublished') {
            extra.push({ ...toPreview(r, `utkast-${r.id}`), state, adminId: r.id });
          }
        }
        callback({ changed, extra });
      },
      () => callback(null),
    );
  });
  return () => {
    stopSession();
    stopEvents();
  };
}
