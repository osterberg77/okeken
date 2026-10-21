import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { keyMonthLabel, keyMonthShort } from '../lib/time';

interface Props {
  /** Månaden som visas i tidslinjen, 'YYYY-MM-DD' */
  viewDay: string;
  /** Innevarande månad, 'YYYY-MM' */
  currentMonth: string;
  /** Första och sista valbara månad, 'YYYY-MM' */
  min: string;
  max: string;
  /** Månader ('YYYY-MM') som har aktiviteter */
  eventMonths: Set<string>;
  onSelect: (month: string) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

/** Månadsrubriken i tidslinjen; öppnar en kompakt månadsväljare (år med pilar + 12 månader). */
export default function MonthPicker({ viewDay, currentMonth, min, max, eventMonths, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(viewDay.slice(0, 4)));
  const [focusMonth, setFocusMonth] = useState(Number(viewDay.slice(5, 7)) - 1);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const focusGrid = useRef(false);
  const minYear = Number(min.slice(0, 4));
  const maxYear = Number(max.slice(0, 4));

  function show() {
    setYear(Number(viewDay.slice(0, 4)));
    setFocusMonth(Number(viewDay.slice(5, 7)) - 1);
    focusGrid.current = true;
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  // Stäng vid klick utanför.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Flytta fokus till månadsknappen när väljaren öppnas eller vid tangentbordsnavigering i rutnätet.
  useEffect(() => {
    if (!open || !focusGrid.current) return;
    focusGrid.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-m="${focusMonth}"]`)?.focus();
  }, [open, focusMonth, year]);

  const monthKey = (m: number) => `${year}-${MONTHS[m]}`;
  const disabled = (m: number) => monthKey(m) < min || monthKey(m) > max;
  // Den månad som nås med Tab (roving tabindex); hålls inom valbara månader när året byts med knapparna.
  const enabled = MONTHS.map((_, i) => i).filter((i) => !disabled(i));
  const tabMonth = enabled.includes(focusMonth) ? focusMonth : (focusMonth < enabled[0] ? enabled[0] : enabled.at(-1));

  /** Piltangenter flyttar en månad (vänster/höger) eller ett kvartal (upp/ned) och byter år vid kanten; PageUp/PageDown byter år. */
  function onGridKey(e: KeyboardEvent) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3, PageUp: -12, PageDown: 12 };
    let target: number | null = null; // månader räknat från år 0
    if (e.key in step) target = year * 12 + focusMonth + step[e.key];
    else if (e.key === 'Home') target = year * 12;
    else if (e.key === 'End') target = year * 12 + 11;
    if (target === null) return;
    e.preventDefault();
    const toIndex = (k: string) => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7)) - 1;
    target = Math.min(Math.max(target, toIndex(min)), toIndex(max));
    focusGrid.current = true;
    setYear(Math.floor(target / 12));
    setFocusMonth(target % 12);
  }

  return (
    <div
      ref={root}
      className="relative mr-1.5"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${keyMonthLabel(viewDay)}, välj månad`}
        onClick={() => (open ? close() : show())}
        className="-mx-1.5 flex cursor-pointer items-center gap-1.5 rounded-full px-1.5 font-display text-[22px] font-bold text-ink hover:text-accent"
      >
        <span className="first-letter:uppercase">{keyMonthLabel(viewDay)}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`h-4 w-4 flex-none text-accent transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Välj månad"
          className="absolute top-full left-0 z-30 mt-2 w-[272px] rounded-[22px] bg-white p-3.5 shadow-panel"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <YearButton label="Föregående år" disabled={year <= minYear} onClick={() => setYear(year - 1)}>
              ‹
            </YearButton>
            <span className="font-display text-base font-bold" aria-live="polite">
              {year}
            </span>
            <YearButton label="Nästa år" disabled={year >= maxYear} onClick={() => setYear(year + 1)}>
              ›
            </YearButton>
          </div>
          <div ref={grid} role="group" aria-label={`Månader ${year}`} className="grid grid-cols-3 gap-1.5" onKeyDown={onGridKey}>
            {MONTHS.map((mm, i) => {
              const key = monthKey(i);
              const isView = key === viewDay.slice(0, 7);
              const isCurrent = key === currentMonth;
              const has = eventMonths.has(key);
              const label = keyMonthShort(`${key}-01`);
              return (
                <button
                  key={mm}
                  type="button"
                  data-m={i}
                  tabIndex={i === tabMonth ? 0 : -1}
                  disabled={disabled(i)}
                  aria-current={isView ? 'date' : undefined}
                  aria-label={`${keyMonthLabel(`${key}-01`)}${has ? ', har aktiviteter' : ''}`}
                  onClick={() => {
                    onSelect(key);
                    close();
                  }}
                  onFocus={() => setFocusMonth(i)}
                  className={`relative flex h-11 cursor-pointer flex-col items-center justify-center rounded-full text-sm font-semibold capitalize disabled:cursor-default disabled:opacity-30 ${
                    isView
                      ? 'bg-ink text-white'
                      : `${isCurrent ? 'shadow-[inset_0_0_0_2px_rgba(138,75,158,.62)]' : ''} ${has ? 'text-ink' : 'text-subtle'} hover:bg-pastel`
                  }`}
                >
                  {label}
                  {has && (
                    <span
                      aria-hidden="true"
                      className={`absolute bottom-1.5 h-1 w-1 rounded-full ${isView ? 'bg-white' : 'bg-accent'}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function YearButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-[34px] w-[34px] cursor-pointer rounded-full bg-canvas text-lg leading-none text-ink hover:bg-pastel disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}
