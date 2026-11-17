import { useEffect, useRef, useState } from 'react';
import { rememberedSignIn } from '../lib/firebase/flags';
import { courseLength, formatLength, formatScale } from '../lib/course';
import type { Orientation } from '../lib/map-print';
import type { OMapViewer } from '../lib/omap-viewer';
import { DEFAULT_PRINT_SCALE, MAX_COURSE_NAME, MAX_COURSE_POINTS, PRINT_SCALES, type Course, type CoursePoint, type OMap } from '../types/map';
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
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Banläggning och utskrift (beslut 0026)
  const [panel, setPanel] = useState<'course' | 'print' | null>(null);
  const [points, setPoints] = useState<CoursePoint[]>([]);
  // Tidigare versioner av banan, för Ångra (tillägg, flytt och borttagning)
  const [undoStack, setUndoStack] = useState<CoursePoint[][]>([]);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [courseMsg, setCourseMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [printProgress, setPrintProgress] = useState<number | null>(null);
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
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, map?.id, map?.current?.version]);

  useEffect(() => () => viewer.current?.destroy(), []);

  const mapScale = map?.current?.scale ?? 10000;
  const printScale = scale ?? DEFAULT_PRINT_SCALE;
  const scales = [...new Set<number>([...PRINT_SCALES, mapScale])].sort((a, b) => a - b);

  useEffect(() => {
    viewer.current?.setCourse(points, printScale);
  }, [ready, points, printScale]);

  useEffect(() => {
    viewer.current?.setEditing(panel === 'course', (next) => {
      setUndoStack((h) => [...h.slice(-49), pointsRef.current]);
      setPoints(next);
      setCourseMsg('');
    });
  }, [ready, panel]);

  useEffect(() => {
    viewer.current?.setPrintFrame(panel === 'print' ? { scale: printScale, orientation } : null);
  }, [ready, panel, printScale, orientation]);

  // Egna banor hämtas först när man öppnat banläggningen en gång
  const wantCourses = useRef(false);
  if (panel === 'course') wantCourses.current = true;
  const watchingCourses = wantCourses.current;
  useEffect(() => {
    if (!api || !watchingCourses) return;
    return api.watchCourses(setCourses, () => setCourseMsg('Kunde inte läsa dina banor.'));
  }, [api, watchingCourses]);

  // Byter man karta hör banan inte längre dit (openCourse sätter courseMapId först, då behålls banan)
  const courseMapId = useRef<string | null>(null);
  useEffect(() => {
    if (!map) return;
    if (courseMapId.current && courseMapId.current !== map.id) {
      setPoints([]);
      setUndoStack([]);
      setCourseId(null);
      setCourseName('');
      setScale(null);
    }
    courseMapId.current = map.id;
  }, [map?.id]);

  const length = courseLength(points);

  async function download() {
    if (!api || !map) return;
    setDownloading(true);
    try {
      const url = await api.sourceDownloadUrl(map);
      if (url) location.href = url;
    } catch {
      setError('Kunde inte hämta originalfilen.');
    } finally {
      setDownloading(false);
    }
  }

  function undo() {
    setPoints(undoStack[undoStack.length - 1] ?? []);
    setUndoStack((h) => h.slice(0, -1));
    setCourseMsg('');
  }

  function newCourse() {
    setPoints([]);
    setUndoStack([]);
    setCourseId(null);
    setCourseName('');
    setCourseMsg('');
  }

  function openCourse(c: Course) {
    if (c.mapId !== map?.id) choose(c.mapId);
    courseMapId.current = c.mapId;
    setPoints(c.points);
    setUndoStack([]);
    setCourseId(c.id);
    setCourseName(c.name);
    setScale(c.scale);
    setCourseMsg('');
    setTimeout(() => viewer.current?.fitCourse(), 0);
  }

  async function save() {
    if (!api || !map) return;
    const name = courseName.trim() || `Bana ${new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })}`;
    setCourseName(name);
    setCourseMsg('Sparar…');
    try {
      setCourseId(await api.saveCourse(courseId, { name, mapId: map.id, points, scale: printScale }));
      setCourseMsg('Sparad.');
    } catch {
      setCourseMsg('Kunde inte spara banan.');
    }
  }

  async function remove(id: string) {
    if (!api) return;
    setConfirmDelete(null);
    try {
      await api.deleteCourse(id);
      if (id === courseId) setCourseId(null);
    } catch {
      setCourseMsg('Kunde inte ta bort banan.');
    }
  }

  async function print() {
    if (!api || !map?.current || !viewer.current) return;
    setPrintProgress(0);
    try {
      const { printMap } = await import('../lib/map-print');
      const caption = points.length >= 2 ? [`Banlängd ${formatLength(length)}`, `Skala ${formatScale(printScale)}`] : [`Skala ${formatScale(printScale)}`];
      await printMap(
        {
          url: api.tileUrl(map)!,
          bounds: map.current.bounds,
          minZoom: map.current.minZoom,
          maxZoom: map.current.maxZoom,
          center: viewer.current.center(),
          scale: printScale,
          orientation,
          points,
          caption,
          logo: '/kartbidrag-swish.png',
        },
        setPrintProgress,
      );
    } finally {
      setPrintProgress(null);
    }
  }

  const pill = (active: boolean) =>
    `cursor-pointer rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-default disabled:opacity-50 ${active ? 'bg-accent text-white' : 'bg-period text-accent hover:bg-pastel'}`;

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
            <button type="button" onClick={() => setPanel(panel === 'course' ? null : 'course')} aria-pressed={panel === 'course'} className={pill(panel === 'course')}>
              Lägg bana
            </button>
            <button type="button" onClick={() => setPanel(panel === 'print' ? null : 'print')} aria-pressed={panel === 'print'} className={pill(panel === 'print')}>
              Skriv ut
            </button>
            {map.current?.sourcePath && (
              <button type="button" onClick={download} disabled={downloading} className={pill(false)}>
                {downloading ? 'Hämtar…' : `Ladda ner originalfilen (.${map.current.sourcePath.split('.').pop()})`}
              </button>
            )}
          </div>

          {panel === 'course' && (
            <section aria-label="Banläggning" className="flex flex-col gap-3 rounded-[20px] bg-period p-4">
              <p className="m-0 text-sm">
                Klicka på kartan för att lägga ut punkter: första punkten är start och sista är mål. Klicka på ett streck för att lägga in en kontroll där. Dra en punkt för att flytta den, klicka på den för att ta bort den.
                Symbolerna visas i den storlek de får på utskriften ({formatScale(printScale)}).
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <strong className="text-lg">{points.length >= 2 ? formatLength(length) : '–'}</strong>
                <span className="text-sm text-muted">
                  {points.length >= 2 ? `${points.length - 2} kontroller, fågelvägen` : 'Lägg ut start och mål'}
                </span>
                <button type="button" onClick={undo} disabled={undoStack.length === 0} className={pill(false)}>
                  Ångra
                </button>
                <button type="button" onClick={newCourse} disabled={points.length === 0 && !courseId} className={pill(false)}>
                  Ny bana
                </button>
                {points.length >= MAX_COURSE_POINTS && <span className="text-sm text-muted">Högst {MAX_COURSE_POINTS} punkter.</span>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  Namn
                  <input
                    type="text"
                    value={courseName}
                    maxLength={MAX_COURSE_NAME}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="t.ex. Tisdagsträning"
                    className="w-56 max-w-full rounded-xl border border-line bg-white px-3 py-2 font-normal"
                  />
                </label>
                <button type="button" onClick={save} disabled={points.length === 0} className={pill(true)}>
                  {courseId ? 'Spara ändringar' : 'Spara bana'}
                </button>
                {courseMsg && <span role="status" className="text-sm">{courseMsg}</span>}
              </div>
              {courses && courses.length > 0 && (
                <div>
                  <h2 className="m-0 mb-2 text-base font-bold">Mina banor</h2>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {courses.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <button type="button" onClick={() => openCourse(c)} className={`cursor-pointer text-left font-semibold underline ${c.id === courseId ? 'text-accent' : ''}`}>
                          {c.name}
                        </button>
                        <span className="text-muted">
                          {maps?.find((m) => m.id === c.mapId)?.name ?? c.mapId}
                          {c.points.length >= 2 && `, ${formatLength(courseLength(c.points))}`}
                        </span>
                        {confirmDelete === c.id ? (
                          <>
                            <button type="button" onClick={() => remove(c.id)} className="cursor-pointer font-semibold text-[#8A2B2B] underline">
                              Ja, ta bort
                            </button>
                            <button type="button" onClick={() => setConfirmDelete(null)} className="cursor-pointer underline">
                              Avbryt
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setConfirmDelete(c.id)} className="cursor-pointer text-muted underline">
                            Ta bort
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {panel === 'print' && (
            <section aria-label="Utskrift" className="flex flex-col gap-3 rounded-[20px] bg-period p-4">
              <p className="m-0 text-sm">
                Flytta kartan så att det som ska med hamnar inom den streckade ramen. Välj 100 % (inte "Anpassa till sida") i
                utskriftsdialogen, annars stämmer inte skalan.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  Skala
                  <select value={printScale} onChange={(e) => setScale(Number(e.target.value))} className="rounded-xl border border-line bg-white px-3 py-2 font-normal">
                    {scales.map((s) => (
                      <option key={s} value={s}>
                        {formatScale(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <div role="group" aria-label="Pappersriktning" className="flex gap-2">
                  <button type="button" onClick={() => setOrientation('portrait')} aria-pressed={orientation === 'portrait'} className={pill(orientation === 'portrait')}>
                    Stående A4
                  </button>
                  <button type="button" onClick={() => setOrientation('landscape')} aria-pressed={orientation === 'landscape'} className={pill(orientation === 'landscape')}>
                    Liggande A4
                  </button>
                </div>
                <button type="button" onClick={print} disabled={printProgress !== null} className={pill(true)}>
                  {printProgress === null ? 'Skriv ut…' : `Hämtar kartan ${Math.round(printProgress * 100)} %`}
                </button>
              </div>
            </section>
          )}

          <p className="m-0 text-sm text-muted">
            {map.name}, skala 1:{map.current!.scale.toLocaleString('sv-SE')}. Kartan är klubbens och bara för medlemmar, så dela inte
            länkar till kartbilderna.
          </p>
        </>
      )}
    </div>
  );
}
