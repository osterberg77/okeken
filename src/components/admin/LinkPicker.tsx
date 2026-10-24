import { useState } from 'react';
import { describeLink, type LinkTarget } from '../../lib/firebase/link-targets';
import { INPUT } from './AdminUi';

const CUSTOM_LINK = /^(https:\/\/|http:\/\/|mailto:|tel:)\S+$/i;

export default function LinkPicker({
  targets, selected, currentHref, onPick, onClose, onRemove,
}: { targets: LinkTarget[] | null; selected: () => string; currentHref?: string; onPick: (title: string, href: string) => void; onClose: () => void; onRemove?: () => void }) {
  const [filter, setFilter] = useState('');
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState('');
  const sel = selected();

  const needle = filter.trim().toLocaleLowerCase('sv');
  const list = (targets ?? []).filter((t) => !needle || t.title.toLocaleLowerCase('sv').includes(needle));

  function onCustom() {
    const href = custom.trim();
    if (!CUSTOM_LINK.test(href)) {
      setCustomError('Adressen ska börja med https://, mailto: eller tel:');
      return;
    }
    onPick(href.replace(/^(https?:\/\/|mailto:|tel:)/i, ''), href);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-ink/15 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-semibold">{sel ? `Länka texten "${sel.length > 30 ? sel.slice(0, 30) + '…' : sel}" till` : 'Infoga länk till'}</span>
        <span className="flex gap-4">
          {onRemove && <button type="button" onClick={onRemove} className="cursor-pointer text-sm font-semibold text-[#8A2B2B] hover:underline">Ta bort länk</button>}
          <button type="button" onClick={onClose} className="cursor-pointer text-sm font-semibold text-muted hover:text-accent">Stäng</button>
        </span>
      </div>

      {currentHref && <CurrentLink href={currentHref} targets={targets} />}

      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Sök sida eller event"
        aria-label="Sök sida eller event"
        className={INPUT}
      />
      <ul className="m-0 flex max-h-56 list-none flex-col gap-1 overflow-y-auto p-0">
        {targets === null && <li className="text-sm text-muted">Laddar…</li>}
        {targets && list.length === 0 && <li className="text-sm text-muted">Inga publicerade träffar.</li>}
        {list.map((t) => (
          <li key={t.href}>
            <button
              type="button"
              onClick={() => onPick(t.title, t.href)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-period"
            >
              <span className="flex-none rounded-full bg-period px-2 py-0.5 text-[11px] font-semibold text-accent">{t.kind === 'page' ? 'Sida' : 'Event'}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
              {t.detail && <span className="flex-none text-xs text-subtle">{t.detail}</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1.5 border-t border-line pt-3">
        <label htmlFor="custom-link" className="text-sm font-semibold">Egen adress</label>
        <div className="flex gap-2">
          <input
            id="custom-link"
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setCustomError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCustom(); } }}
            placeholder="https://…, mailto:namn@exempel.se eller tel:+46…"
            className={INPUT}
          />
          <button type="button" onClick={onCustom} className="flex-none cursor-pointer rounded-full bg-accent px-5 text-sm font-semibold text-white hover:brightness-110">
            Infoga
          </button>
        </div>
        {customError && <span role="alert" className="text-[13px] text-[#8A2B2B]">{customError}</span>}
      </div>
    </div>
  );
}

/** Visar vart länken under markören går nu: intern (publicerad eller inte) eller extern */
function CurrentLink({ href, targets }: { href: string; targets: LinkTarget[] | null }) {
  const info = targets ? describeLink(href, targets) : null;
  const badge =
    !info ? null
    : info.kind === 'external' ? { text: 'Extern adress', warn: false }
    : info.published ? { text: 'Intern, publicerad', warn: false }
    : { text: 'Intern, ej publicerad', warn: true };
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-period px-3 py-2 text-sm">
      <span className="font-semibold">Länken går nu till</span>
      <span className="flex flex-wrap items-center gap-2">
        {badge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.warn ? 'bg-[#F6DADA] text-[#8A2B2B]' : 'bg-white text-accent'}`}>{badge.text}</span>}
        {info?.title && <span className="font-medium">{info.title}</span>}
        <span className="break-all text-xs text-muted">{href}</span>
      </span>
      <span className="text-xs text-muted">Välj en annan sida nedan, eller skriv en egen adress, för att byta mål.</span>
    </div>
  );
}
