import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createEvent,
  deleteDraft,
  eventState,
  publishEvent,
  saveCourseFiles,
  sameContent,
  saveEvent,
  unpublishEvent,
  watchEvent,
  watchBuild,
} from '../../lib/firebase/events';
import { CATEGORIES } from '../../lib/categories';
import { uploadCourseFile, MAX_PDF_BYTES } from '../../lib/firebase/course-files';
import { toPreview } from '../../lib/preview';
import { addDays, dayKey, formatTime, fromStockholmInput, isWeekend, toStockholmInput } from '../../lib/time';
import { EVENT_TYPES, MAX_COURSE_FILES, type EventContent, type EventRecord } from '../../types/event';
import { canPublish, canViewEvents, type Session } from '../../types/user';
import EventDetail from '../EventDetail';
import AdminGate, { AdminPanel } from './AdminGate';
import { ActionButton, Field, INPUT, QuickButton } from './AdminUi';
import BuildStatus from './BuildStatus';
import StatusBadge, { StatusLabel } from './StatusBadge';

export default function EventEditor() {
  return (
    <AdminGate allowed={canViewEvents} requirement="publicerare, banläggare, styrelse eller superadmin">
      {(session) => <Editor session={session} />}
    </AdminGate>
  );
}

/** Nytt event: nästa tisdagsträning, banorna ute till söndag lunch */
function newEventContent(): EventContent {
  const today = dayKey(new Date());
  let tuesday = addDays(today, 1);
  while (new Date(`${tuesday}T12:00:00Z`).getUTCDay() !== 2) tuesday = addDays(tuesday, 1);
  return {
    type: 'training',
    title: '',
    startsAt: fromStockholmInput(`${tuesday}T17:00`),
    endsAt: fromStockholmInput(`${addDays(tuesday, 5)}T12:00`),
    location: { name: '', mapUrl: '' },
    body: '',
    courseSetter: '',
    livelox: '',
    courseFiles: [],
  };
}

const contentOf = (r: EventRecord): EventContent => ({
  type: r.type,
  title: r.title,
  startsAt: r.startsAt,
  endsAt: r.endsAt,
  location: r.location,
  body: r.body,
  courseSetter: r.courseSetter,
  livelox: r.livelox,
  courseFiles: r.courseFiles,
});

type Message = { kind: 'ok' | 'error'; text: string } | null;

function Editor({ session }: { session: Session }) {
  // Banläggare (utan publicerarbehörighet) får bara ändra banor; övriga fält är skrivskyddade (beslut 0006)
  const courseOnly = !canPublish(session.permissions);
  const initialId = new URLSearchParams(location.search).get('id');
  const [id, setId] = useState<string | null>(initialId);
  const [record, setRecord] = useState<EventRecord | null | undefined>(initialId ? undefined : null);
  const [draft, setDraft] = useState<EventContent | null>(initialId ? null : newEventContent());
  const [saved, setSaved] = useState<EventContent | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const loaded = useRef(false);

  useEffect(() => {
    if (!id) return;
    return watchEvent(
      id,
      (r) => {
        setRecord(r);
        if (!r) return;
        setSaved(contentOf(r));
        // Fyll formuläret första gången; senare uppdateringar (egna sparningar) får inte skriva över pågående ändringar
        if (!loaded.current) {
          loaded.current = true;
          setDraft(contentOf(r));
        }
      },
      () => setMessage({ kind: 'error', text: 'Kunde inte läsa eventet.' }),
    );
  }, [id]);

  const [lastBuild, setLastBuild] = useState<Date | null>(null);
  // Banläggare får inte läsa meta/build
  useEffect(() => (courseOnly ? undefined : watchBuild((b) => setLastBuild(b.lastBuildAt))), [courseOnly]);

  const dirty = !!draft && (!saved || !sameContent(draft, saved));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const preview = useMemo(() => (draft ? toPreview(draft, record?.slug ?? null) : null), [draft, record?.slug]);

  if (record === undefined || !draft || !preview) {
    return <AdminPanel><p className="text-muted">Laddar…</p></AdminPanel>;
  }
  if (courseOnly && !id) {
    return (
      <AdminPanel>
        <p>Banläggare kan inte skapa events. <a href="/admin/events" className="font-semibold text-accent">Till alla events</a></p>
      </AdminPanel>
    );
  }
  if (id && record === null) {
    return (
      <AdminPanel>
        <p>Eventet finns inte (kanske raderat). <a href="/admin/events" className="font-semibold text-accent">Till alla events</a></p>
      </AdminPanel>
    );
  }

  const state = record ? eventState(record, draft) : 'draft';
  const isPublished = record?.status === 'published';
  const neverPublished = !record?.publishedAt;
  // Delning först när bygget som innehåller publiceringen är live (annars cachar Facebook en tom förhandsvisning)
  const siteReady = !!record?.publishedAt && !!lastBuild && lastBuild > record.publishedAt;
  const problem = !draft.title.trim()
    ? 'Ge eventet en titel.'
    : draft.endsAt < draft.startsAt
      ? 'Slutet kan inte vara före starten.'
      : null;

  const update = (patch: Partial<EventContent>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setMessage(null);
  };

  async function run(label: string, action: () => Promise<string>) {
    setBusy(label);
    setMessage(null);
    try {
      setMessage({ kind: 'ok', text: await action() });
    } catch (err) {
      console.error(err);
      setMessage({ kind: 'error', text: 'Det gick inte att spara. Kontrollera uppkopplingen och försök igen.' });
    } finally {
      setBusy(null);
    }
  }

  /** Sparar utkastet; skapar eventet första gången. Returnerar id. */
  async function persist(content: EventContent): Promise<string> {
    if (id) {
      await saveEvent(id, content, session.uid);
      return id;
    }
    const newId = await createEvent(content, session.uid);
    setId(newId);
    history.replaceState(null, '', `?id=${newId}`);
    return newId;
  }

  const onUploadFiles = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const tooMany = draft.courseFiles.length + list.length > MAX_COURSE_FILES;
    const bad = list.find((f) => f.type !== 'application/pdf' || f.size > MAX_PDF_BYTES);
    if (tooMany || bad) {
      setMessage({
        kind: 'error',
        text: tooMany ? `Max ${MAX_COURSE_FILES} banor per event.` : `${bad!.name}: bara PDF-filer, högst ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
      });
      return;
    }
    return run('upload', async () => {
      const eventId = id ?? (await persist(draft));
      const uploaded = [];
      for (const f of list) uploaded.push(await uploadCourseFile(eventId, f));
      update({ courseFiles: [...draft.courseFiles, ...uploaded] });
      return courseOnly ? 'Uppladdat. Spara banorna för att behålla dem.' : 'Uppladdat. Spara utkastet för att behålla banorna.';
    });
  };

  const onSave = () => run('save', async () => {
    if (courseOnly) {
      await saveCourseFiles(id!, record!.status, draft.courseFiles, session.uid);
      return record!.status === 'published'
        ? 'Sparat. Banorna syns på sajten efter nästa ombyggnad.'
        : 'Sparat. Banorna syns på sajten när eventet publicerats.';
    }
    await persist(draft);
    return isPublished ? 'Sparat som utkast. Besökarna ser den publicerade versionen tills du publicerar ändringarna.' : 'Sparat.';
  });

  const onPublish = () => run('publish', async () => {
    const eventId = id ?? (await persist(draft));
    await publishEvent(eventId, record?.slug ?? null, draft, session.uid);
    return 'Publicerat! Ändringen syns på sajten efter nästa ombyggnad.';
  });

  const onUnpublish = () => run('unpublish', async () => {
    await unpublishEvent(id!, session.uid);
    return 'Avpublicerat. Eventet försvinner från sajten vid nästa ombyggnad.';
  });

  async function onDelete() {
    setBusy('delete');
    try {
      await deleteDraft(id!);
      location.href = '/admin/events';
    } catch {
      setBusy(null);
      setMessage({ kind: 'error', text: 'Kunde inte radera utkastet.' });
    }
  }

  const publishLabel = state === 'live' && !dirty ? 'Publicerad' : isPublished ? 'Publicera ändringar' : 'Publicera';

  return (
    <div className="flex flex-col gap-5">
      {/* Åtgärder */}
      <div className="sticky top-2 z-30 flex flex-wrap items-center gap-3 rounded-[22px] bg-white/95 px-5 py-3.5 shadow-card backdrop-blur">
        <a href="/admin/events" className="text-sm font-semibold text-muted no-underline hover:text-accent">← Alla events</a>
        <StatusLabel state={state} />
        <span className="text-[13px] text-subtle">
          {dirty ? 'Osparade ändringar' : record?.updatedAt ? `Sparad ${formatTime(record.updatedAt.toISOString())}` : ''}
        </span>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {isPublished && record?.slug && (
            <a href={`/event/${record.slug}`} target="_blank" rel="noopener" className="px-2 text-sm font-semibold text-accent no-underline hover:underline">
              Visa på sajten ↗
            </a>
          )}
          {!courseOnly && isPublished && record?.slug && (
            siteReady ? (
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${location.origin}/event/${record.slug}`)}`}
                target="_blank"
                rel="noopener"
                className="px-2 text-sm font-semibold text-accent no-underline hover:underline"
              >
                Dela på Facebook ↗
              </a>
            ) : (
              <span className="px-2 text-[13px] text-subtle">Delning aktiveras när sajten är uppdaterad</span>
            )
          )}
          {!courseOnly && <BuildStatus />}
          {!courseOnly && isPublished && (
            <ActionButton onClick={onUnpublish} disabled={!!busy} busy={busy === 'unpublish'}>Avpublicera</ActionButton>
          )}
          {courseOnly ? (
            <ActionButton primary onClick={onSave} disabled={!!busy || !dirty} busy={busy === 'save'}>
              Spara banor
            </ActionButton>
          ) : (
            <>
              <ActionButton onClick={onSave} disabled={!!busy || !dirty || !!problem} busy={busy === 'save'}>
                Spara utkast
              </ActionButton>
              <ActionButton primary onClick={onPublish} disabled={!!busy || !!problem || (state === 'live' && !dirty)} busy={busy === 'publish'}>
                {publishLabel}
              </ActionButton>
            </>
          )}
        </div>
        {(message || (problem && !courseOnly)) && (
          <p
            role={message?.kind === 'error' ? 'alert' : 'status'}
            className={`m-0 w-full rounded-2xl px-4 py-2.5 text-sm ${
              message?.kind === 'ok' ? 'bg-[#E3F0DC] text-[#2F5A2B]' : message ? 'bg-[#FBEAEA] text-[#8A2B2B]' : 'bg-period text-muted'
            }`}
          >
            {message?.text ?? problem}
          </p>
        )}
      </div>

      <div className="flex gap-2 lg:hidden" role="tablist">
        {(['edit', 'preview'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 cursor-pointer rounded-full py-2.5 text-sm font-semibold shadow-chip ${tab === t ? 'bg-ink text-white' : 'bg-white text-ink'}`}
          >
            {t === 'edit' ? 'Redigera' : 'Förhandsvisa'}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-2">
        <AdminPanel className={tab === 'preview' ? 'hidden lg:flex' : ''}>
          <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em]">
            {id ? 'Redigera event' : 'Nytt event'}
          </h1>

          {courseOnly && (
            <p className="m-0 rounded-2xl bg-period px-4 py-2.5 text-sm text-muted">
              Som banläggare kan du bara ändra banorna. Övrigt är skrivskyddat.
            </p>
          )}
          <fieldset disabled={courseOnly} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
          <Field label="Typ">
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((t) => {
                const on = draft.type === t;
                const cat = CATEGORIES[t];
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ type: t })}
                    className="cursor-pointer rounded-full border-[1.5px] px-3.5 py-1.5 text-sm font-semibold"
                    style={on ? { color: cat.fg, backgroundColor: cat.bg, borderColor: cat.fg } : { color: '#5F5A72', borderColor: 'rgba(43,40,56,.15)' }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Titel" htmlFor="title">
            <input id="title" value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="T.ex. Tisdagsträning vecka 17" className={INPUT} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start" htmlFor="start">
              <input
                id="start"
                type="datetime-local"
                value={toStockholmInput(draft.startsAt)}
                onChange={(e) => e.target.value && update({ startsAt: fromStockholmInput(e.target.value) })}
                className={INPUT}
              />
            </Field>
            <Field label="Slut" htmlFor="end" hint="För träningar: så länge banorna hänger ute.">
              <input
                id="end"
                type="datetime-local"
                value={toStockholmInput(draft.endsAt)}
                onChange={(e) => e.target.value && update({ endsAt: fromStockholmInput(e.target.value) })}
                className={INPUT}
              />
            </Field>
          </div>
          <div className="-mt-2 flex flex-wrap gap-2">
            <QuickButton onClick={() => {
              let sunday = dayKey(draft.startsAt);
              while (!(isWeekend(sunday) && new Date(`${sunday}T12:00:00Z`).getUTCDay() === 0)) sunday = addDays(sunday, 1);
              update({ endsAt: fromStockholmInput(`${sunday}T12:00`) });
            }}>
              Ute t.o.m. söndag 12:00
            </QuickButton>
            <QuickButton onClick={() => update({ endsAt: new Date(draft.startsAt.getTime() + 60 * 60 * 1000) })}>Slut efter 1 timme</QuickButton>
            <QuickButton onClick={() => update({ endsAt: draft.startsAt })}>Bara en tidpunkt</QuickButton>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plats" htmlFor="place">
              <input id="place" value={draft.location.name} onChange={(e) => update({ location: { ...draft.location, name: e.target.value } })} placeholder="T.ex. Skidstugan, Humpa" className={INPUT} />
            </Field>
            <Field label="Kartlänk" htmlFor="map" hint="Valfri. Klistra in en länk från Google Maps.">
              <input id="map" type="url" value={draft.location.mapUrl} onChange={(e) => update({ location: { ...draft.location, mapUrl: e.target.value } })} placeholder="https://maps.app.goo.gl/…" className={INPUT} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Banläggare" htmlFor="setter">
              <input id="setter" value={draft.courseSetter} onChange={(e) => update({ courseSetter: e.target.value })} className={INPUT} />
            </Field>
            <Field label="Livelox-länk" htmlFor="livelox">
              <input id="livelox" type="url" value={draft.livelox} onChange={(e) => update({ livelox: e.target.value })} placeholder="https://www.livelox.com/…" className={INPUT} />
            </Field>
          </div>

          </fieldset>

          <Field label="Banor (PDF)" htmlFor="courses" hint={`Högst ${MAX_COURSE_FILES} filer, 10 MB var. Filer kan inte ersättas eller tas bort från lagringen, men du kan ta bort dem från eventet.`}>
            {draft.courseFiles.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {draft.courseFiles.map((f, i) => (
                  <li key={f.storagePath} className="flex items-center gap-2">
                    <input
                      aria-label={`Namn på ${f.name}`}
                      value={f.label}
                      onChange={(e) => update({ courseFiles: draft.courseFiles.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                      className={INPUT}
                    />
                    <button
                      type="button"
                      onClick={() => update({ courseFiles: draft.courseFiles.filter((_, j) => j !== i) })}
                      className="flex-none cursor-pointer rounded-full px-3 py-2 text-sm font-semibold text-[#A33A3A] hover:underline"
                    >
                      Ta bort
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              id="courses"
              type="file"
              accept="application/pdf"
              multiple
              disabled={!!busy}
              onChange={(e) => {
                onUploadFiles(e.target.files);
                e.target.value = '';
              }}
              className="text-sm"
            />
          </Field>

          <fieldset disabled={courseOnly} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
          <Field
            label="Text"
            htmlFor="body"
            hint="Tom rad ger nytt stycke. **fet text**, *kursiv*, [länktext](https://…) och - punktlistor fungerar."
          >
            <textarea id="body" rows={12} value={draft.body} onChange={(e) => update({ body: e.target.value })} className={`${INPUT} min-h-[240px] leading-relaxed`} />
          </Field>

          </fieldset>

          {id && neverPublished && !courseOnly && (
            <div className="border-t border-line pt-4">
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm">Radera utkastet för gott?</span>
                  <ActionButton danger onClick={onDelete} disabled={!!busy} busy={busy === 'delete'}>Ja, radera</ActionButton>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="cursor-pointer text-sm font-semibold text-muted">Avbryt</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="cursor-pointer text-sm font-semibold text-[#A33A3A] hover:underline">
                  Radera utkast
                </button>
              )}
            </div>
          )}
        </AdminPanel>

        <div className={`flex flex-col gap-5 lg:sticky lg:top-28 ${tab === 'edit' ? 'hidden lg:flex' : ''}`}>
          <p className="m-0 text-xs font-semibold tracking-[.12em] text-subtle">FÖRHANDSVISNING – SÅ HÄR SER EVENTSIDAN UT</p>
          <EventDetail event={preview} today={dayKey(new Date())} />
          <p className="m-0 text-xs font-semibold tracking-[.12em] text-subtle">DELNING PÅ FACEBOOK</p>
          <SharePreview title={preview.title} excerpt={preview.excerpt} />
        </div>
      </div>

      <StatusBadge
        state={state}
        detail={state === 'changed' ? 'Publicera ändringarna för att visa dem för besökare' : state === 'draft' ? 'Syns inte för besökare' : undefined}
      />
    </div>
  );
}

/** Ungefär som Facebooks länkkort (utan bild tills og:image finns, v1.2) */
function SharePreview({ title, excerpt }: { title: string; excerpt: string }) {
  return (
    <div className="flex max-w-[500px] items-center gap-3 overflow-hidden rounded-lg border border-[#dadde1] bg-[#f0f2f5] p-3 font-[system-ui]">
      <img src="/logo.svg" alt="" className="h-16 w-14 flex-none object-contain" />
      <div className="min-w-0">
        <div className="text-xs text-[#65676b] uppercase">okeken.web.app</div>
        <div className="truncate text-base font-semibold text-[#050505]">{title}</div>
        <div className="line-clamp-2 text-sm text-[#65676b]">{excerpt || 'Första stycket i texten visas här.'}</div>
      </div>
    </div>
  );
}
