import type { ReactNode } from 'react';

export const INPUT = 'w-full rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-accent';

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[15px] font-semibold">{label}</label>
      {children}
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
    </div>
  );
}

export function ActionButton({
  children, onClick, disabled, busy, primary, danger,
}: { children: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; primary?: boolean; danger?: boolean }) {
  const style = primary
    ? 'bg-accent text-white shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110'
    : danger
      ? 'bg-[#A33A3A] text-white'
      : 'border-[1.5px] border-ink/18 bg-white text-ink hover:border-accent hover:text-accent';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-default disabled:opacity-45 ${style}`}>
      {busy ? 'Vänta…' : children}
    </button>
  );
}

export function QuickButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer rounded-full bg-period px-3 py-1.5 text-[13px] font-semibold text-accent hover:bg-pastel">
      {children}
    </button>
  );
}
