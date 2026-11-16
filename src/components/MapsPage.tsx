import { useEffect, useRef, useState } from 'react';
import { rememberedSignIn } from '../lib/firebase/flags';
import type { OMapViewer } from '../lib/omap-viewer';
import type { OMap } from '../types/map';
import type { Session } from '../types/user';

type Api = typeof import('../lib/firebase/maps');

const OPACITY_KEY = 'okeken:mapOpacity';

function savedOpacity(): number {
  try {
    const v = Number(localStorage.getItem(OPACITY_KEY));
    return v > 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

/** Kartsidan (beslut 0025): klubbens orienteringskartor över OpenStreetMap, för inloggade medlemmar. */
export default function MapsPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [api, setApi] = useState<Api | null>(null);
  const [maps, setMaps] = useState<OMap[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(() => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('karta')));
  const [opacity, setOpacity] = useState(savedOpacity);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const el = useRef<HTMLDivElement>(null);
  const viewer = useRef<OMapViewer | null>(null);
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!rememberedSignIn()) {
      location.replace('/logga-in?next=/kartor');
      return;
    }
    let stop = () => {};
    let cancelled = false;
    Promise.all([import('../lib/firebase/session'), import('../lib/firebase/maps')]).then(([{ watchSession }, m]) => {
      if (cancelled) return;
      setApi(m);
      stop = watchSession((s) => {
        if (s === null) location.replace('/logga-in?next=/kartor');
        setSession(s);
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const isMember = (session?.permissions.length ?? 0) > 0;
  useEffect(() => {
    if (!api || !isMember) return;
    return api.watchMaps(
      (all) => setMaps(all.filter((m) => m.current)),
      () => setError('Kunde inte läsa kartorna.'),
    );
  }, [api, isMember]);

  const map = maps?.find((m) => m.id === selected) ?? maps?.[0] ?? null;

  // Leaflet laddas först när det finns en karta att visa
  useEffect(() => {
    if (!api || !map?.current || !el.current) return;
    let cancelled = false;
    const current = map.current;
    const url = api.tileUrl(map)!;
    const key = `${map.id}/${current.version}`;
    const show = (v: OMapViewer) => {
      if (shown.current === key) return;
      // Ny karta: zooma till den. Ny version av samma karta: behåll utsnittet
      v.show({ url, bounds: current.bounds, minZoom: current.minZoom, maxZoom: current.maxZoom }, shown.current?.split('/')[0] !== map.id);
      shown.current = key;
    };
    if (viewer.current) show(viewer.current);
    else
      import('../lib/omap-viewer').then(({ mountOMapViewer }) => {
        if (cancelled || !el.current) return;
        viewer.current = mountOMapViewer(el.current, opacity);
        show(viewer.current);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, map?.id, map?.current?.version]);

  useEffect(() => () => viewer.current?.destroy(), []);

  function changeOpacity(v: number) {
    setOpacity(v);
    viewer.current?.setOpacity(v);
    try {
      localStorage.setItem(OPACITY_KEY, String(v));
    } catch {
      /* bara en bekvämlighet */
    }
  }

  function choose(id: string) {
    setSelected(id);
    history.replaceState(null, '', `/kartor?karta=${encodeURIComponent(id)}`);
  }

  function toggleLocate() {
    const next = !locating;
    setLocating(next);
    setLocateError('');
    viewer.current?.locate(next, (msg) => {
      setLocateError(msg);
      setLocating(false);
      viewer.current?.locate(false, () => {});
    });
  }

  if (session === undefined || !api) return <p className="text-muted">Laddar…</p>;
  if (!isMember) {
    return <p>Kartorna är bara för klubbens medlemmar. Kontakta styrelsen om du är medlem men inte ser dem.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">Kartor</h1>
        {maps && maps.length > 1 && (
          <div role="group" aria-label="Välj karta" className="flex flex-wrap gap-2">
            {maps.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => choose(m.id)}
                aria-pressed={m.id === map?.id}
                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold ${m.id === map?.id ? 'bg-accent text-white' : 'bg-period text-accent hover:bg-pastel'}`}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      {maps === null && !error && <p className="text-muted">Laddar kartor…</p>}
      {maps && maps.length === 0 && <p className="text-muted">Det finns inga kartor ännu.</p>}

      {map && (
        <>
          <div ref={el} className="z-0 h-[70vh] min-h-[360px] w-full overflow-hidden rounded-[20px] bg-map" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-3 text-sm font-semibold">
              Orienteringskarta
              <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => changeOpacity(Number(e.target.value))} className="w-36 accent-accent" />
            </label>
            <button
              type="button"
              onClick={toggleLocate}
              aria-pressed={locating}
              className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold ${locating ? 'bg-accent text-white' : 'bg-period text-accent hover:bg-pastel'}`}
            >
              {locating ? 'Sluta visa min position' : 'Visa min position'}
            </button>
            {locateError && <span role="alert" className="text-sm text-[#8A2B2B]">{locateError}</span>}
          </div>
          <p className="m-0 text-sm text-muted">
            {map.name}, skala 1:{map.current!.scale.toLocaleString('sv-SE')}. Kartan är klubbens och bara för medlemmar, så dela inte
            länkar till kartbilderna.
          </p>
        </>
      )}
    </div>
  );
}
