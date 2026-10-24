import { parseCoords } from '../../lib/geo';
import { MAX_EXTRA_PLACES, MAX_PLACE_LABEL, PLACE_ICONS, PLACE_ICON_LABELS, type PlaceIcon } from '../../lib/place-icons';
import type { EditablePlace } from '../../types/event';
import { INPUT } from './AdminUi';

export function IconSelect({ id, value, onChange }: { id?: string; value: PlaceIcon; onChange: (icon: PlaceIcon) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as PlaceIcon)} className={INPUT}>
      {PLACE_ICONS.map((i) => (
        <option key={i} value={i}>{PLACE_ICON_LABELS[i]}</option>
      ))}
    </select>
  );
}

/** Extra platser på eventkartan (toalett, andra parkeringen osv.). De får markör men ingen vägvisning. */
export default function PlacesEditor({
  places, onChange, onActivate, activeId,
}: { places: EditablePlace[]; onChange: (places: EditablePlace[]) => void; onActivate: (id: string) => void; activeId: string }) {
  const set = (i: number, patch: Partial<EditablePlace>) => onChange(places.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[15px] font-semibold">Fler platser på kartan</span>
      <span className="-mt-2 text-[13px] text-muted">Valfritt, t.ex. toalett eller en andra parkering. Max {MAX_EXTRA_PLACES}. Vägvisningen går alltid till huvudplatsen ovan.</span>
      {places.map((p, i) => {
        const bad = p.coords.trim() !== '' && !parseCoords(p.coords);
        return (
          <div key={i} className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-ink/12 bg-white p-3">
            <div className="grid gap-2 sm:grid-cols-[170px_1fr]">
              <IconSelect value={p.icon} onChange={(icon) => set(i, { icon })} />
              <input value={p.label} maxLength={MAX_PLACE_LABEL} onChange={(e) => set(i, { label: e.target.value })} placeholder={`Text på kartan, t.ex. ${PLACE_ICON_LABELS[p.icon]}`} aria-label="Text på kartan" className={INPUT} />
            </div>
            <input value={p.coords} onChange={(e) => set(i, { coords: e.target.value })} placeholder="58.2025, 16.0015, eller klicka på kartan ovan" aria-label="Koordinater" className={INPUT} />
            {bad && <span role="alert" className="text-[13px] text-[#8A2B2B]">Förstår inte koordinaterna. Skriv t.ex. 58.2025, 16.0015.</span>}
            {!bad && p.coords.trim() === '' && <span className="text-[13px] text-muted">Platser utan koordinater sparas inte.</span>}
            <div className="flex gap-4">
              <button type="button" onClick={() => onActivate(`p${i}`)} className="cursor-pointer text-sm font-semibold text-accent hover:underline">
                {activeId === `p${i}` ? 'Vald på kartan ovan' : 'Flytta på kartan ovan'}
              </button>
              <button type="button" onClick={() => { onChange(places.filter((_, j) => j !== i)); onActivate('main'); }} className="cursor-pointer text-sm font-semibold text-[#8A2B2B] hover:underline">
                Ta bort
              </button>
            </div>
          </div>
        );
      })}
      {places.length < MAX_EXTRA_PLACES && (
        <button
          type="button"
          onClick={() => { onChange([...places, { icon: 'toilet', label: '', coords: '' }]); onActivate(`p${places.length}`); }}
          className="cursor-pointer self-start rounded-full border-[1.5px] border-ink/18 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
        >
          + Lägg till plats
        </button>
      )}
    </div>
  );
}
