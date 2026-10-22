import { useEffect, useRef, useState } from 'react';
import { formatCoords, parseCoords, type LatLng } from '../../lib/geo';
import { INPUT } from './AdminUi';

interface Props {
  /** Koordinater som text, samma fält som i eventet */
  value: string;
  onChange: (coords: string) => void;
}

interface Hit {
  name: string;
  at: LatLng;
}

type Picker = Awaited<ReturnType<typeof mountPicker>>;
const mountPicker = async (el: HTMLElement, start: LatLng | null, onPick: (at: LatLng) => void) =>
  (await import('../../lib/leaflet-map')).mountPickerMap(el, start, onPick);

/** Karta där man klickar (eller drar markören) för att välja plats, plus ortssökning via OpenStreetMaps Nominatim. */
export default function LocationPicker({ value, onChange }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const picker = useRef<Picker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  const lastEmitted = useRef<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const emit = (at: LatLng) => {
    const text = formatCoords(at);
    lastEmitted.current = text;
    onChangeRef.current(text);
  };

  useEffect(() => {
    let cancelled = false;
    mountPicker(el.current!, parseCoords(value), emit).then((p) => {
      if (cancelled) p.destroy();
      else {
        picker.current = p;
        if (valueRef.current !== lastEmitted.current) p.setPosition(parseCoords(valueRef.current));
      }
    });
    return () => {
      cancelled = true;
      picker.current?.destroy();
      picker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skrivs koordinater in för hand flyttas markören dit (men inte när ändringen kom från kartan själv)
  useEffect(() => {
    if (value === lastEmitted.current) return;
    picker.current?.setPosition(parseCoords(value));
  }, [value]);

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
    picker.current?.setPosition(hit.at);
    emit(hit.at);
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
      <div ref={el} className="z-0 aspect-[3/2] w-full overflow-hidden rounded-[14px] sm:aspect-[2/1]" />
      <p className="m-0 text-xs text-muted">Klicka på kartan eller dra markören för att sätta platsen.</p>
    </div>
  );
}
