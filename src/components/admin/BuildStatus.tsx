import { useEffect, useState } from 'react';
import { watchBuild, type BuildInfo } from '../../lib/firebase/events';

/** Bygget tar normalt 1–2 minuter; längre än så här utan resultat räknas som fel. */
const OVERDUE_MS = 10 * 60 * 1000;

export type BuildState = 'ok' | 'building' | 'failed';

export function buildState({ lastBuildAt, requestedAt }: BuildInfo, now: Date): BuildState {
  if (!requestedAt || (lastBuildAt && lastBuildAt >= requestedAt)) return 'ok';
  return now.getTime() - requestedAt.getTime() > OVERDUE_MS ? 'failed' : 'building';
}

const LOOK: Record<BuildState, { dot: string; text: string }> = {
  ok: { dot: 'bg-[#3F8A3A]', text: 'Sajten är uppdaterad' },
  building: { dot: 'bg-[#E8B100] animate-pulse', text: 'Sajten uppdateras… (1–2 min)' },
  failed: { dot: 'bg-[#C0392B]', text: 'Uppdateringen verkar ha fastnat – be en administratör kolla GitHub Actions' },
};

/** Grön = klart, gul = bygger, röd = något gick fel. Delad för lista och editor. */
export default function BuildStatus() {
  const [info, setInfo] = useState<BuildInfo | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => watchBuild(setInfo), []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!info) return null;
  const state = buildState(info, now);
  const { dot, text } = LOOK[state];
  return (
    <span role="status" className="inline-flex items-center gap-2 px-2 text-[13px] font-semibold text-muted">
      <span className={`h-2.5 w-2.5 flex-none rounded-full ${dot}`} />
      {text}
      {state === 'ok' && info.lastBuildAt && (
        <span className="font-normal text-subtle">
          {info.lastBuildAt.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </span>
  );
}
