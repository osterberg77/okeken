import { useEffect, useMemo, useState } from 'react';
import { displayUrl, watchImages } from '../../lib/firebase/image-bank';
import type { ImageBankItem } from '../../types/image';
import { INPUT } from './AdminUi';
import { filterImages } from './ImageList';
import ImageUploader from './ImageUploader';

/**
 * Modal för att välja (eller ladda upp) en bild ur bildbanken. Returnerar den valda bilden via onPick; anroparen
 * bestämmer vad som händer (MarkdownField infogar Markdown, EventEditor sätter huvudbild).
 */
export default function ImagePicker({
  onPick, onClose, title = 'Välj bild', selectedId,
}: {
  onPick: (image: ImageBankItem) => void;
  onClose: () => void;
  /** Rubrik och tillgängligt namn på dialogen */
  title?: string;
  /** Markerar den bild som redan är vald */
  selectedId?: string;
}) {
  const [images, setImages] = useState<ImageBankItem[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  useEffect(() => watchImages(setImages, () => setError('Kunde inte läsa bilderna.')), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shown = useMemo(() => filterImages(images ?? [], filter), [images, filter]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-card sm:rounded-[28px] sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 font-display text-2xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="cursor-pointer text-sm font-semibold text-muted hover:text-accent">Stäng</button>
        </div>

        <ImageUploader />

        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Sök bland bilderna"
          aria-label="Sök bild"
          className={INPUT}
        />
        {error && <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
        {images === null && !error && <p className="m-0 text-muted">Laddar bilder…</p>}
        {images && shown.length === 0 && <p className="m-0 text-muted">{images.length === 0 ? 'Inga bilder ännu. Ladda upp den första ovan.' : 'Inga bilder matchar sökningen.'}</p>}
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
          {shown.map((img) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => onPick(img)}
                aria-current={img.id === selectedId || undefined}
                className={`flex w-full cursor-pointer flex-col gap-2 rounded-[22px] p-2.5 text-left hover:bg-pastel ${
                  img.id === selectedId ? 'bg-pastel ring-2 ring-accent' : 'bg-period'
                }`}
              >
                <img src={displayUrl(img.thumbnailUrl)} alt={img.description} loading="lazy" className="aspect-[4/3] w-full rounded-2xl bg-white object-cover" />
                <span className="truncate px-1 text-sm font-semibold">{img.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
