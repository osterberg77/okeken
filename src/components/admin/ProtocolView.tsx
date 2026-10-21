import { useMemo } from 'react';
import { renderMarkdown } from '../../lib/markdown';
import { TZ } from '../../lib/time';
import { PROTOCOL_STATE_LABELS, type ProtocolContent, type ProtocolRecord } from '../../types/protocol';
import { protocolState } from '../../lib/protocol';

const dateFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'full' });
const timeFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const shortFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'long' });

/** 'tisdag 20 oktober 2026, 18:00' (svensk tid) */
export function formatMeeting(d: Date): string {
  if (Number.isNaN(d.getTime())) return '(datum saknas)';
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

type Shown = ProtocolContent & Pick<ProtocolRecord, 'secretaryApprovedAt' | 'adjusterApprovedAt'>;

/**
 * Det renderade protokollet. Delas av skärmvyn (läsläge/låst) och utskriften (CLAUDE.md: en komponent, en
 * gång). `.protocol-print` är det enda som skrivs ut (se global.css).
 */
export default function ProtocolView({ protocol }: { protocol: Shown }) {
  const html = useMemo(() => renderMarkdown(protocol.body), [protocol.body]);
  const state = protocolState(protocol);

  return (
    <article className="protocol-print flex min-w-0 flex-col gap-6 rounded-[28px] bg-white px-6 pt-7 pb-8 shadow-card sm:px-[38px] sm:pt-[34px] sm:pb-[38px] print:gap-5 print:rounded-none print:p-0 print:shadow-none">
      <div className="flex flex-col gap-3">
        <img src="/logo.svg" alt="OK Eken" className="hidden h-14 w-auto self-start print:block" />
        <div>
          <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">Styrelsemöte</h1>
          <p className="m-0 mt-2 text-[17px] text-muted print:text-black">
            {formatMeeting(protocol.meetingAt)}
            {protocol.location && <> &middot; {protocol.location}</>}
          </p>
        </div>
        {state !== 'locked' && (
          <p className="m-0 w-fit rounded-xl border-2 border-dashed border-[#B8860B] bg-[#FFF6D6] px-3 py-1.5 text-sm font-bold tracking-[.04em] text-[#6A5A12] print:text-black">
            {PROTOCOL_STATE_LABELS[state].long}
          </p>
        )}
      </div>

      <section aria-labelledby="pv-attendees">
        <h2 id="pv-attendees" className="m-0 font-display text-lg font-bold">Närvarande</h2>
        {protocol.attendees.length ? (
          <p className="m-0 mt-1 text-[17px]">{protocol.attendees.map((a) => a.name).join(', ')}</p>
        ) : (
          <p className="m-0 mt-1 text-muted">Inga närvarande noterade.</p>
        )}
      </section>

      <div className="prose-eken protocol-body max-w-none" dangerouslySetInnerHTML={{ __html: html }} />

      {protocol.todos.length > 0 && (
        <section aria-labelledby="pv-todos">
          <h2 id="pv-todos" className="m-0 font-display text-xl font-bold">Att göra</h2>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {protocol.todos.map((t) => (
              <li key={t.id} className="protocol-todo flex gap-2.5 text-[17px]">
                <span aria-hidden="true" className="flex-none">{t.done ? '☑' : '☐'}</span>
                <span className={t.done ? 'text-muted line-through print:text-black' : ''}>
                  <span className="sr-only">{t.done ? 'Klar: ' : 'Ej klar: '}</span>
                  {t.text}
                  {t.assigneeUid && <span className="font-semibold"> – {t.assigneeName}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Signering" className="protocol-sign mt-4 grid gap-8 sm:grid-cols-2">
        <Signature label="Vid protokollet" name={protocol.secretaryName} approvedAt={protocol.secretaryApprovedAt} />
        <Signature label="Justeras" name={protocol.adjusterName} approvedAt={protocol.adjusterApprovedAt} />
      </section>
    </article>
  );
}

function Signature({ label, name, approvedAt }: { label: string; name: string; approvedAt: Date | null }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-10 border-b border-ink/60 print:h-14 print:border-black" />
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[17px]">{name || <span className="text-muted print:text-black">(ej utsedd)</span>}</span>
      <span className="text-[13px] text-muted print:text-black">
        {approvedAt ? `Godkänt ${shortFmt.format(approvedAt)} ${timeFmt.format(approvedAt)}` : 'Ej godkänt'}
      </span>
    </div>
  );
}
