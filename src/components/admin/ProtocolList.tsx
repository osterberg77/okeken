import { useEffect, useState } from 'react';
import { watchProtocols } from '../../lib/firebase/protocols';
import { protocolState } from '../../lib/protocol';
import type { ProtocolRecord } from '../../types/protocol';
import { canViewProtocols } from '../../types/user';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import { ProtocolStatusLabel } from './StatusBadge';
import { formatMeeting } from './ProtocolView';

export default function ProtocolList() {
  return (
    <AdminGate allowed={canViewProtocols} requirement="styrelse eller superadmin">
      {() => <Protocols />}
    </AdminGate>
  );
}

function Protocols() {
  const [list, setList] = useState<ProtocolRecord[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => watchProtocols(setList, () => setError('Kunde inte läsa protokollen.')), []);

  return (
    <AdminPanel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <AdminTitle>Styrelsens protokoll</AdminTitle>
          <p className="mt-2 max-w-[60ch] text-muted">
            Bara styrelsen ser protokollen. När sekreteraren och justeraren båda godkänt är protokollet låst och kan inte ändras.
          </p>
        </div>
        <a
          href="/admin/styrelsemote"
          className="rounded-full bg-accent px-6 py-[13px] text-sm font-semibold text-white no-underline shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110"
        >
          Nytt protokoll
        </a>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      {list === null && !error && <p className="text-muted">Laddar protokoll…</p>}
      {list && list.length === 0 && <p className="text-muted">Inga protokoll ännu. Skapa det första!</p>}

      {list && list.length > 0 && (
        <section className="flex flex-col gap-2.5">
          {list.map((p) => (
            <a
              key={p.id}
              href={`/admin/styrelsemote?id=${p.id}`}
              className="flex items-center gap-4 rounded-[22px] bg-period px-[18px] py-3.5 text-ink no-underline hover:bg-pastel"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <ProtocolStatusLabel state={protocolState(p)} />
                </span>
                <span className="truncate font-display text-[17px] font-semibold">{formatMeeting(p.meetingAt)}</span>
                <span className="truncate text-[13px] text-subtle">
                  {p.location || 'Ingen plats angiven'} &middot; {p.attendees.length} närvarande
                </span>
              </span>
            </a>
          ))}
        </section>
      )}
    </AdminPanel>
  );
}
