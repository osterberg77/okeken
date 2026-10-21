import { lazy, Suspense, useMemo } from 'react';
import type { LinkTarget } from '../../lib/firebase/link-targets';
import { unpublishedLinks } from '../../lib/firebase/link-targets';
import { INPUT } from './AdminUi';

// Tiptap laddas som egen chunk först när ett textfält visas (bara i admin).
const MarkdownEditor = lazy(() => import('./MarkdownEditor'));

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Publicerade sidor och events att länka till; null medan de laddas */
  targets: LinkTarget[] | null;
  rows?: number;
  /** Visa knappen Bild (bildbanken kräver publicerarbehörighet) */
  allowImages?: boolean;
}

/** Visuell editor för Markdown (Tiptap). Lagrad text är ren Markdown. */
export default function MarkdownField({ id, value, onChange, targets, rows = 14, allowImages = true }: Props) {
  const warnings = useMemo(() => (targets ? unpublishedLinks(value, targets) : []), [value, targets]);

  return (
    <div className="flex flex-col gap-2">
      <Suspense fallback={<div className={`${INPUT} text-muted`} style={{ minHeight: rows * 20 }}>Laddar editorn…</div>}>
        <MarkdownEditor id={id} value={value} onChange={onChange} targets={targets} rows={rows} allowImages={allowImages} />
      </Suspense>

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
