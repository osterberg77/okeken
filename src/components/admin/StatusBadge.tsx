import type { EventState } from '../../lib/firebase/events';

// Statusfärgerna (mörk botten, gul markering) får inte förväxlas med eventkategorierna.
// Se docs/arkitektur.md "Statusbadge (obligatorisk)".

const LABELS: Record<EventState, { short: string; long: string }> = {
  draft: { short: 'Utkast', long: 'UTKAST – ej publicerad' },
  changed: { short: 'Opublicerade ändringar', long: 'OPUBLICERADE ÄNDRINGAR – live-versionen skiljer sig' },
  unpublished: { short: 'Avpublicerad', long: 'AVPUBLICERAD – syns inte för besökare' },
  live: { short: 'Publicerad', long: 'PUBLICERAD' },
};

/** Liten etikett för listor */
export function StatusLabel({ state }: { state: EventState }) {
  if (state === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-2.5 py-[3px] text-xs font-semibold text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-[#3F8A3A]" />
        {LABELS.live.short}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-[3px] text-xs font-semibold text-[#F9D932]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#F9D932]" />
      {LABELS[state].short}
    </span>
  );
}

/** Fast badge i hörnet på alla preview-/adminvyer för innehåll som inte är live */
export default function StatusBadge({ state, detail }: { state: EventState; detail?: string }) {
  if (state === 'live') return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-[13px] font-bold tracking-[.04em] text-white shadow-[0_12px_32px_-8px_rgba(43,40,56,.6)] ring-2 ring-[#F9D932]"
    >
      <span className="h-2.5 w-2.5 flex-none animate-pulse rounded-full bg-[#F9D932]" />
      <span>
        {LABELS[state].long}
        {detail && <span className="block text-xs font-medium tracking-normal text-white/70">{detail}</span>}
      </span>
    </div>
  );
}
