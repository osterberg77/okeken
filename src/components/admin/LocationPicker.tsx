import { useEffect, useRef, useState } from 'react';
import { formatCoords, parseCoords, type LatLng } from '../../lib/geo';
import { PLACE_ICON_GLYPHS, type PlaceIcon } from '../../lib/place-icons';
import type { PickerItem } from '../../lib/leaflet-map';
import { INPUT } from './AdminUi';

export interface PickerPlace {
  /** 'main' för huvudplatsen, 'p0', 'p1'… för extra platser */
  id: string;
  icon: PlaceIcon;
  /** Chip-text */
  label: string;
  /** Koordinater som text, samma fält som i eventet */
  coords: string;
}

interface Props {
  places: PickerPlace[];
  /** Platsen som klick på kartan flyttar */
  activeId: string;
  onActivate: (id: string) => void;
  onChange: (id: string, coords: string) => void;
}

interface Hit {
  name: string;
  at: LatLng;
}

type Picker = Awaited<ReturnType<typeof mountPicker>>;
const mountPicker = async (el: HTMLElement, items: PickerItem[], handlers: Parameters<typeof import('../../lib/leaflet-map').mountPickerMap>[2]) =>
  (await import('../../lib/leaflet-map')).mountPickerMap(el, items, handlers);

/**
 * En karta med alla platser (huvudplats och extra). Välj vilken plats som ska flyttas med knapparna ovanför kartan
 * (eller genom att trycka på dess markör), klicka sedan på kartan eller dra markören. Ortssökning via OpenStreetMaps Nominatim.
 */
export default function LocationPicker({ places, activeId, onActivate, onChange }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const picker = useRef<Picker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;
  const placesRef = useRef(places);
  placesRef.current = places;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  // Senaste koordinaterna som kartan själv skickade, så att de inte flyttar kartan igen
  const lastEmitted = useRef<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const items = (): PickerItem[] =>
    placesRef.current.map((p) => ({ id: p.id, icon: p.icon, at: parseCoords(p.coords), active: p.id === activeRef.current }));

  const emit = (id: string, at: LatLng) => {
    const text = formatCoords(at);
    lastEmitted.current[id] = text;
    onChangeRef.current(id, text);
  };

  useEffect(() => {
    let cancelled = false;
    mountPicker(el.current!, items(), { onPlace: emit, onSelect: (id) => onActivateRef.current(id) }).then((p) => {
      if (cancelled) p.destroy();
      else {
        picker.current = p;
        p.setItems(items());
      }
    });
    return () => {
      cancelled = true;
      picker.current?.destroy();
      picker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ritar om markörerna när platserna eller den aktiva ändras; skrivs koordinater in för hand flyttas kartan dit
  useEffect(() => {
    picker.current?.setItems(items());
    const active = places.find((p) => p.id === activeId);
    const at = active ? parseCoords(active.coords) : null;
    if (active && at && lastEmitted.current[active.id] !== active.coords) {
      picker.current?.panTo(at);
      lastEmitted.current[active.id] = active.coords;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, activeId]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError('');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=se&q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(String(res.status));
      const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setHits(rows.map((r) => ({ name: r.display_name, at: { lat: Number(r.lat), lng: Number(r.lon) } })));
    } catch {
      setError('Sökningen misslyckades. Klicka på kartan i stället.');
      setHits(null);
    } finally {
      setSearching(false);
    }
  }

  function choose(hit: Hit) {
    picker.current?.panTo(hit.at);
    emit(activeId, hit.at);
    setHits(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök plats, t.ex. Humpa"
          aria-label="Sök plats"
          className={INPUT}
        />
        <button type="submit" disabled={searching} className="shrink-0 rounded-full border-[1.5px] border-ink/18 bg-white px-5 text-sm font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60">
          {searching ? 'Söker…' : 'Sök'}
        </button>
      </form>
      {error && <p className="m-0 text-sm text-red-700">{error}</p>}
      {hits && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
          {hits.length === 0 && <li className="text-muted">Inga träffar. Prova ett annat namn eller klicka på kartan.</li>}
          {hits.map((h) => (
            <li key={`${h.at.lat},${h.at.lng}`}>
              <button type="button" onClick={() => choose(h)} className="w-full cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-ink hover:bg-accent/10">
                {h.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {places.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Plats att flytta">
          <span className="text-[13px] font-semibold text-muted">Flytta:</span>
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === activeId}
              onClick={() => onActivate(p.id)}
              className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold ${p.id === activeId ? 'border-accent bg-accent text-white' : 'border-ink/18 bg-white text-ink hover:border-accent'}`}
            >
              {PLACE_ICON_GLYPHS[p.icon]} {p.label}
            </button>
          ))}
        </div>
      )}
      <div ref={el} className="z-0 aspect-[3/2] w-full overflow-hidden rounded-[14px] sm:aspect-[2/1]" />
      <p className="m-0 text-xs text-muted">Klicka på kartan eller dra en markör för att sätta den valda platsen. Nyp eller scrolla för att zooma.</p>
    </div>
  );
}
