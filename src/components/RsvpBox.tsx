import { useEffect, useMemo, useState } from 'react';
import { rememberedSignIn } from '../lib/firebase/flags';
import { RSVP_LABELS, RSVP_STATUSES, type RsvpResponse, type RsvpStatus } from '../types/rsvp';
import type { Session } from '../types/user';

interface Props {
  /** Eventets stabila adress, nyckel för svaren */
  slug: string;
}

/**
 * "Kommer / Kommer kanske / Kommer inte" för inloggade medlemmar (beslut 0012). Visas inte för besökare:
 * Firebase laddas bara hos den som varit inloggad på den här enheten, så den statiska sidan är oförändrad.
 */
export default function RsvpBox({ slug }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [responses, setResponses] = useState<RsvpResponse[] | null>(null);
  const [hideName, setHideName] = useState(false);
  const [showWho, setShowWho] = useState(false);
  const [boardNames, setBoardNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const isMember = !!session && session.permissions.length > 0;
  const isBoard = !!session && (session.permissions.includes('board') || session.permissions.includes('superadmin'));

  useEffect(() => {
    if (!rememberedSignIn()) return;
    let stop = () => {};
    let cancelled = false;
    import('../lib/firebase/session').then(({ watchSession }) => {
      if (!cancelled) stop = watchSession(setSession);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  useEffect(() => {
    if (!isMember) return;
    let stop = () => {};
    let cancelled = false;
    import('../lib/firebase/rsvp').then(({ watchRsvps }) => {
      if (!cancelled) stop = watchRsvps(slug, setResponses, () => setResponses([]));
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [isMember, slug]);

  const mine = responses?.find((r) => r.uid === session?.uid);
  // Följer det sparade svaret så att rutan visar vad som gäller; utan svar gäller standardvalet i profilen
  useEffect(() => {
    if (mine) setHideName(mine.name === '');
    else setHideName(session?.hideNameInRsvp === true);
  }, [mine?.status, mine?.name, session?.hideNameInRsvp]);

  const hiddenUids = useMemo(
    () => (responses ?? []).filter((r) => r.name === '').map((r) => r.uid).sort().join(','),
    [responses],
  );
  useEffect(() => {
    if (!isBoard || !hiddenUids) return;
    import('../lib/firebase/rsvp').then(({ lookupNames }) => lookupNames(hiddenUids.split(',')).then(setBoardNames));
  }, [isBoard, hiddenUids]);

  if (!isMember || responses === null) return null;

  /** Namn att visa; dolda namn syns bara för styrelsen (märkta), övriga räknas som anonyma. */
  const namesFor = (status: RsvpStatus) => {
    const list = responses.filter((r) => r.status === status);
    const shown = list.filter((r) => r.name !== '').map((r) => r.name);
    const hidden = list.filter((r) => r.name === '');
    const named = isBoard ? [...shown, ...hidden.map((r) => `${boardNames[r.uid] ?? '(okänd)'} (dolt)`)] : shown;
    return { named: named.sort((a, b) => a.localeCompare(b, 'sv')), anonymous: isBoard ? 0 : hidden.length, count: list.length };
  };

  async function choose(status: RsvpStatus) {
    if (!session || busy) return;
    setBusy(true);
    setError(false);
    try {
      const { setRsvp, clearRsvp } = await import('../lib/firebase/rsvp');
      if (mine?.status === status) await clearRsvp(slug, session.uid);
      else await setRsvp(slug, session.uid, status, hideName);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function toggleHide(next: boolean) {
    setHideName(next);
    if (!session || !mine) return;
    setBusy(true);
    setError(false);
    try {
      const { setRsvp } = await import('../lib/firebase/rsvp');
      await setRsvp(slug, session.uid, mine.status, next);
    } catch {
      setError(true);
      setHideName(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Kommer du?" className="flex flex-col gap-3 rounded-[22px] bg-period/60 p-4">
      <h3 className="m-0 font-display text-lg font-bold">Kommer du?</h3>
      <div className="flex flex-wrap gap-2">
        {RSVP_STATUSES.map((status) => {
          const { named, anonymous, count } = namesFor(status);
          const chosen = mine?.status === status;
          const title = [...named, ...(anonymous ? [`+ ${anonymous} som inte visar sitt namn`] : [])].join(', ');
          return (
            <button
              key={status}
              type="button"
              disabled={busy}
              aria-pressed={chosen}
              title={title || undefined}
              onClick={() => choose(status)}
              className={`cursor-pointer rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                chosen ? 'border-accent bg-accent text-white' : 'border-ink/18 bg-white text-ink hover:border-accent hover:text-accent'
              }`}
            >
              {RSVP_LABELS[status]} <span className={chosen ? 'text-white/85' : 'text-subtle'}>{count}</span>
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={hideName} disabled={busy} onChange={(e) => toggleHide(e.target.checked)} />
        Visa inte mitt namn för andra{isBoard ? '' : ' (styrelsen kan se det)'}
      </label>

      {responses.length > 0 && (
        <div className="flex flex-col gap-2 text-sm">
          <button type="button" onClick={() => setShowWho((s) => !s)} aria-expanded={showWho} className="cursor-pointer self-start font-semibold text-accent">
            {showWho ? 'Dölj vilka' : 'Visa vilka'}
          </button>
          {showWho &&
            RSVP_STATUSES.map((status) => {
              const { named, anonymous, count } = namesFor(status);
              if (count === 0) return null;
              return (
                <p key={status} className="m-0">
                  <strong>{RSVP_LABELS[status]}:</strong> {[...named, ...(anonymous ? [`${anonymous} som inte visar sitt namn`] : [])].join(', ')}
                </p>
              );
            })}
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 text-sm text-[#8A2B2B]">
          Det gick inte att spara. Kontrollera uppkopplingen och försök igen.
        </p>
      )}
    </section>
  );
}
