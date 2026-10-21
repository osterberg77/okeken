import { useMemo, useRef, useState } from 'react';
import type { LinkTarget } from '../../lib/firebase/link-targets';
import { unpublishedLinks } from '../../lib/firebase/link-targets';
import { INPUT } from './AdminUi';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Publicerade sidor och events att länka till; null medan de laddas */
  targets: LinkTarget[] | null;
  rows?: number;
}

const CUSTOM_LINK = /^(https:\/\/|http:\/\/|mailto:|tel:)\S+$/i;

/** Textfält för Markdown med formateringsknappar och länkväljare. Själva texten är ren Markdown. */
export default function MarkdownField({ id, value, onChange, targets, rows = 14 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [picker, setPicker] = useState(false);
  const warnings = useMemo(() => (targets ? unpublishedLinks(value, targets) : []), [value, targets]);

  /** Ersätter markeringen (eller infogar vid markören) och återställer markeringen efteråt */
  function replaceSelection(make: (selected: string) => { text: string; selectFrom?: number; selectTo?: number }) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const out = make(value.slice(start, end));
    onChange(value.slice(0, start) + out.text + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + (out.selectFrom ?? out.text.length), start + (out.selectTo ?? out.text.length));
    });
  }

  const wrap = (mark: string, placeholder: string) =>
    replaceSelection((sel) => {
      const inner = sel || placeholder;
      return { text: `${mark}${inner}${mark}`, selectFrom: mark.length, selectTo: mark.length + inner.length };
    });

  /** Radprefix: "## " för rubrik, "- " för punktlista; gäller alla markerade rader */
  function prefixLines(prefix: string, placeholder: string) {
    const ta = ref.current;
    if (!ta) return;
    // Utöka markeringen till hela rader
    const lineStart = value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let lineEnd = value.indexOf('\n', ta.selectionEnd);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd) || placeholder;
    const next = block.split('\n').map((l) => prefix + l).join('\n');
    onChange(value.slice(0, lineStart) + next + value.slice(lineEnd));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart + prefix.length, lineStart + next.length);
    });
  }

  function insertLink(title: string, href: string) {
    replaceSelection((sel) => {
      const text = sel || title;
      return { text: `[${text}](${href})` };
    });
    setPicker(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Formatering">
        <ToolButton label="Fet" onClick={() => wrap('**', 'fet text')}><b>B</b></ToolButton>
        <ToolButton label="Kursiv" onClick={() => wrap('*', 'kursiv text')}><i>I</i></ToolButton>
        <ToolButton label="Rubrik" onClick={() => prefixLines('## ', 'Rubrik')}>Rubrik</ToolButton>
        <ToolButton label="Punktlista" onClick={() => prefixLines('- ', 'Punkt')}>Lista</ToolButton>
        <ToolButton label="Infoga länk" active={picker} onClick={() => setPicker((p) => !p)}>Länk</ToolButton>
      </div>

      {picker && <LinkPicker targets={targets} selected={() => {
        const ta = ref.current;
        return ta ? value.slice(ta.selectionStart, ta.selectionEnd) : '';
      }} onPick={insertLink} onClose={() => setPicker(false)} />}

      <textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} min-h-[280px] leading-relaxed`}
      />

      {warnings.length > 0 && (
        <p role="status" className="m-0 rounded-2xl bg-[#FFF6D6] px-4 py-2.5 text-[13px] text-[#6A5A12]">
          Texten länkar till {warnings.length === 1 ? 'en sida' : 'sidor'} som inte {warnings.length === 1 ? 'är publicerad' : 'är publicerade'} just nu:{' '}
          {warnings.map((w, i) => (
            <span key={w}>{i > 0 && ', '}<code>{w}</code></span>
          ))}
          . Besökare får felsidan om de klickar. Publicera målet först, eller ta bort länken.
        </p>
      )}
    </div>
  );
}

function ToolButton({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Behåll markeringen i textfältet när man klickar på knappen
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold ${active ? 'bg-ink text-white' : 'bg-period text-accent hover:bg-pastel'}`}
    >
      {children}
    </button>
  );
}

function LinkPicker({
  targets, selected, onPick, onClose,
}: { targets: LinkTarget[] | null; selected: () => string; onPick: (title: string, href: string) => void; onClose: () => void }) {
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
        <button type="button" onClick={onClose} className="cursor-pointer text-sm font-semibold text-muted hover:text-accent">Stäng</button>
      </div>

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
