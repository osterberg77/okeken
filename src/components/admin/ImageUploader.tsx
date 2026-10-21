import { useRef, useState } from 'react';
import { uploadErrorMessage, uploadImage } from '../../lib/firebase/image-bank';
import type { ImageBankItem } from '../../types/image';

interface Item {
  key: number;
  name: string;
  status: string;
  state: 'working' | 'done' | 'error';
}

/** Välj en eller flera bilder; varje bild skalas och laddas upp för sig med eget förlopp och eget fel. */
export default function ImageUploader({ onUploaded }: { onUploaded?: (item: ImageBankItem) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);

  function patch(key: number, change: Partial<Item>) {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)));
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files);
    const entries = chosen.map((f) => ({ key: ++counter.current, file: f }));
    setItems(entries.map((e) => ({ key: e.key, name: e.file.name, status: 'Väntar', state: 'working' })));
    setBusy(true);
    // En i taget: skalning av stora bilder är tungt för mobilen
    for (const { key, file } of entries) {
      try {
        const item = await uploadImage(file, (step) => patch(key, { status: step }));
        patch(key, { status: 'Klar', state: 'done' });
        onUploaded?.(item);
      } catch (e) {
        patch(key, { status: uploadErrorMessage(e), state: 'error' });
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        className={`inline-flex w-fit cursor-pointer items-center rounded-full bg-accent px-6 py-[13px] text-sm font-semibold text-white shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110 ${busy ? 'pointer-events-none opacity-45' : ''}`}
      >
        {busy ? 'Laddar upp…' : 'Ladda upp bilder'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-live="polite">
          {items.map((i) => (
            <li
              key={i.key}
              className={`flex flex-wrap items-baseline gap-x-3 rounded-2xl px-4 py-2 text-sm ${
                i.state === 'error' ? 'bg-[#FBEAEA] text-[#8A2B2B]' : i.state === 'done' ? 'bg-[#E3F0DC] text-[#2F5A2B]' : 'bg-period text-muted'
              }`}
            >
              <span className="min-w-0 truncate font-semibold">{i.name}</span>
              <span>{i.status}{i.state === 'working' && i.status !== 'Väntar' ? '…' : ''}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-[13px] text-muted">
        JPEG, PNG eller WebP. Bilderna är publika för den som har länken, så fråga om lov innan du lägger upp bilder på personer, särskilt barn.
      </p>
    </div>
  );
}
