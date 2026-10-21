import { useEffect, useMemo, useState } from 'react';
import { deleteImage, displayUrl, updateImageMeta, watchImages } from '../../lib/firebase/image-bank';
import { MAX_IMAGE_BYLINE, MAX_IMAGE_DESCRIPTION, MAX_IMAGE_NAME, type ImageBankItem } from '../../types/image';
import { canPublish } from '../../types/user';
import { ActionButton, Field, INPUT } from './AdminUi';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import ImageUploader from './ImageUploader';

export default function ImageList() {
  return (
    <AdminGate allowed={canPublish} requirement="publicerare, styrelse eller superadmin">
      {() => <Images />}
    </AdminGate>
  );
}

function Images() {
  const [images, setImages] = useState<ImageBankItem[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  useEffect(() => watchImages(setImages, () => setError('Kunde inte läsa bilderna.')), []);

  const shown = useMemo(() => filterImages(images ?? [], filter), [images, filter]);
  const open = images?.find((i) => i.id === openId) ?? null;

  return (
    <AdminPanel>
      <div>
        <AdminTitle>Bilder</AdminTitle>
        <p className="mt-2 text-muted">
          Bildbanken för events och sidor. Ladda upp här eller direkt när du skriver en text, och infoga med knappen Bild.
        </p>
      </div>

      <ImageUploader />

      {error && <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      {images === null && !error && <p className="text-muted">Laddar bilder…</p>}
      {images && images.length === 0 && <p className="text-muted">Inga bilder ännu.</p>}

      {images && images.length > 0 && (
        <>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Sök på namn, fotograf eller beskrivning"
            aria-label="Sök bild"
            className={`${INPUT} sm:max-w-sm`}
          />
          {shown.length === 0 && <p className="text-muted">Inga bilder matchar sökningen.</p>}
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((img) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(img.id)}
                  className={`flex w-full cursor-pointer flex-col gap-2 rounded-[22px] p-2.5 text-left hover:bg-pastel ${openId === img.id ? 'bg-pastel' : 'bg-period'}`}
                >
                  <img src={displayUrl(img.thumbnailUrl)} alt={img.description} loading="lazy" className="aspect-[4/3] w-full rounded-2xl bg-white object-cover" />
                  <span className="flex flex-col gap-0.5 px-1">
                    <span className="truncate font-display text-[15px] font-semibold">{img.name}</span>
                    {!img.description && <span className="text-xs font-semibold text-[#8A6A12]">Alt-text saknas</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {open && <ImageEditor key={open.id} image={open} onClose={() => setOpenId(null)} />}
    </AdminPanel>
  );
}

export function filterImages(images: ImageBankItem[], filter: string): ImageBankItem[] {
  const needle = filter.trim().toLocaleLowerCase('sv');
  if (!needle) return images;
  return images.filter((i) => `${i.name} ${i.byline} ${i.description}`.toLocaleLowerCase('sv').includes(needle));
}

function ImageEditor({ image, onClose }: { image: ImageBankItem; onClose: () => void }) {
  const [name, setName] = useState(image.name);
  const [byline, setByline] = useState(image.byline);
  const [description, setDescription] = useState(image.description);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const dirty = name !== image.name || byline !== image.byline || description !== image.description;

  async function save() {
    if (!name.trim()) {
      setMessage({ kind: 'error', text: 'Bilden behöver ett namn.' });
      return;
    }
    setBusy(true);
    try {
      await updateImageMeta(image.id, { name, byline, description });
      setMessage({ kind: 'ok', text: 'Sparat. Redan infogade bilder i texter behåller sin gamla alt-text tills du infogar dem igen.' });
    } catch {
      setMessage({ kind: 'error', text: 'Det gick inte att spara. Försök igen.' });
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteImage(image);
      onClose();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Det gick inte att radera.' });
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-[22px] bg-period p-4 sm:p-6" aria-label="Redigera bild">
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 font-display text-xl font-bold">Redigera bild</h2>
        <button type="button" onClick={onClose} className="cursor-pointer text-sm font-semibold text-muted hover:text-accent">Stäng</button>
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,280px)_1fr]">
        <a href={displayUrl(image.webUrl)} target="_blank" rel="noopener">
          <img src={displayUrl(image.webUrl)} alt={description} className="w-full rounded-2xl bg-white object-contain" />
        </a>
        <div className="flex flex-col gap-4">
          <Field label="Namn" htmlFor="img-name">
            <input id="img-name" value={name} maxLength={MAX_IMAGE_NAME} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </Field>
          <Field
            label="Beskrivning (alt-text)"
            htmlFor="img-desc"
            hint="Beskriv vad bilden visar, för den som inte ser den. Används som alt-text när bilden infogas."
          >
            <textarea id="img-desc" rows={3} value={description} maxLength={MAX_IMAGE_DESCRIPTION} onChange={(e) => setDescription(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Fotograf" htmlFor="img-byline">
            <input id="img-byline" value={byline} maxLength={MAX_IMAGE_BYLINE} onChange={(e) => setByline(e.target.value)} className={INPUT} />
          </Field>
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`m-0 rounded-2xl px-4 py-2.5 text-sm ${message.kind === 'ok' ? 'bg-[#E3F0DC] text-[#2F5A2B]' : 'bg-[#FBEAEA] text-[#8A2B2B]'}`}>
              {message.text}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <ActionButton primary onClick={save} disabled={!dirty || busy} busy={busy && !confirmDelete}>Spara</ActionButton>
            {!confirmDelete && (
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="cursor-pointer text-sm font-semibold text-[#A33A3A] hover:underline">
                Radera bilden
              </button>
            )}
          </div>
          {confirmDelete && (
            <div role="alertdialog" aria-label="Bekräfta radering" className="flex flex-col gap-3 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">
              <span>
                Radera bilden för gott? Om den används i en publicerad sida eller ett publicerat event blir den en trasig bild
                på sajten direkt. Byt ut den i texten först om du är osäker.
              </span>
              <span className="flex items-center gap-4">
                <ActionButton danger onClick={remove} busy={busy}>Ja, radera</ActionButton>
                <button type="button" onClick={() => setConfirmDelete(false)} className="cursor-pointer text-sm font-semibold text-muted">Avbryt</button>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
