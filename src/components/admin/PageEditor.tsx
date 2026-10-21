import { useEffect, useMemo, useRef, useState } from 'react';
import { watchMenu } from '../../lib/firebase/menu';
import {
  checkNewSlug,
  createPage,
  deletePage,
  pageState,
  publishPage,
  samePageContent,
  savePage,
  SlugError,
  slugProblem,
  unpublishPage,
  watchPage,
} from '../../lib/firebase/pages';
import { loadLinkTargets, type LinkTarget } from '../../lib/firebase/link-targets';
import { menuPageIds } from '../../lib/menu-edit';
import { toPagePreview } from '../../lib/preview';
import { slugify } from '../../lib/slug';
import { formatTime } from '../../lib/time';
import { MAX_PAGE_BODY, type PageContent, type PageRecord } from '../../types/page';
import { canPublish, type Session } from '../../types/user';
import PageDetail from '../PageDetail';
import { ActionButton, Field, INPUT } from './AdminUi';
import AdminGate, { AdminPanel } from './AdminGate';
import BuildStatus from './BuildStatus';
import MarkdownField from './MarkdownField';
import StatusBadge, { StatusLabel } from './StatusBadge';

export default function PageEditor() {
  return (
    <AdminGate allowed={canPublish} requirement="publicerare, styrelse eller superadmin">
      {(session) => <Editor session={session} />}
    </AdminGate>
  );
}

const emptyPage = (): PageContent => ({ title: '', body: '' });

const contentOf = (r: PageRecord): PageContent => ({
  title: r.title,
  body: r.body,
});

type Message = { kind: 'ok' | 'error'; text: string } | null;

function Editor({ session }: { session: Session }) {
  const initialId = new URLSearchParams(location.search).get('id');
  const [id, setId] = useState<string | null>(initialId);
  const [record, setRecord] = useState<PageRecord | null | undefined>(initialId ? undefined : null);
  const [draft, setDraft] = useState<PageContent | null>(initialId ? null : emptyPage());
  const [saved, setSaved] = useState<PageContent | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [targets, setTargets] = useState<LinkTarget[] | null>(null);
  const [inMenu, setInMenu] = useState<boolean | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!id) return;
    return watchMenu(
      (m) => setInMenu(menuPageIds(m?.items ?? []).has(id)),
      () => setInMenu(null),
    );
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return watchPage(
      id,
      (r) => {
        setRecord(r);
        if (!r) return;
        setSaved(contentOf(r));
        if (!loaded.current) {
          loaded.current = true;
          setDraft(contentOf(r));
        }
      },
      () => setMessage({ kind: 'error', text: 'Kunde inte läsa sidan.' }),
    );
  }, [id]);

  useEffect(() => {
    loadLinkTargets().then(setTargets).catch(() => setTargets([]));
  }, []);

  const dirty = !!draft && (!saved || !samePageContent(draft, saved));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const preview = useMemo(() => (draft ? toPagePreview(draft, record?.slug ?? null) : null), [draft, record?.slug]);

  if (record === undefined || !draft || !preview) {
    return <AdminPanel><p className="text-muted">Laddar…</p></AdminPanel>;
  }
  if (id && record === null) {
    return (
      <AdminPanel>
        <p>Sidan finns inte (kanske raderad). <a href="/admin/sidor" className="font-semibold text-accent">Till alla sidor</a></p>
      </AdminPanel>
    );
  }

  const state = record ? pageState(record, draft) : 'draft';
  const isPublished = record?.status === 'published';
  const neverPublished = !record?.publishedAt;
  const proposedSlug = record?.slug ?? slugify(draft.title);
  // Adressen sätts första gången sidan publiceras; reserverade adresser stoppar publiceringen men inte sparandet
  const addressProblem = record?.slug ? null : draft.title.trim() ? slugProblem(proposedSlug) : null;
  const problem = !draft.title.trim()
    ? 'Ge sidan en titel.'
    : draft.body.length > MAX_PAGE_BODY
      ? `Texten är för lång (högst ${MAX_PAGE_BODY} tecken).`
      : null;

  const update = (patch: Partial<PageContent>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setMessage(null);
  };

  async function run(label: string, action: () => Promise<string>) {
    setBusy(label);
    setMessage(null);
    try {
      setMessage({ kind: 'ok', text: await action() });
    } catch (err) {
      if (err instanceof SlugError) {
        setMessage({ kind: 'error', text: err.message });
      } else {
        console.error(err);
        setMessage({ kind: 'error', text: 'Det gick inte att spara. Kontrollera uppkopplingen och försök igen.' });
      }
    } finally {
      setBusy(null);
    }
  }

  async function persist(content: PageContent): Promise<string> {
    if (id) {
      await savePage(id, content, session.uid);
      return id;
    }
    const newId = await createPage(content, session.uid);
    setId(newId);
    history.replaceState(null, '', `?id=${newId}`);
    return newId;
  }

  const onSave = () => run('save', async () => {
    await persist(draft);
    return isPublished ? 'Sparat som utkast. Besökarna ser den publicerade versionen tills du publicerar ändringarna.' : 'Sparat.';
  });

  const onPublish = () => run('publish', async () => {
    // Kontrollera adressen innan något skrivs (även utkastet), så att inget halvfärdigt sparas vid krock
    if (!record?.slug) await checkNewSlug(id, draft.title);
    const pageId = id ?? (await persist(draft));
    await publishPage(pageId, record?.slug ?? null, draft, session.uid);
    return 'Publicerat! Ändringen syns på sajten efter nästa ombyggnad.';
  });

  const onUnpublish = () => run('unpublish', async () => {
    await unpublishPage(id!, session.uid);
    return 'Avpublicerat. Sidan försvinner från sajten och menyn vid nästa ombyggnad.';
  });

  async function onDelete() {
    setBusy('delete');
    try {
      await deletePage(id!);
      location.href = '/admin/sidor';
    } catch {
      setBusy(null);
      setMessage({ kind: 'error', text: 'Kunde inte radera utkastet.' });
    }
  }

  const publishLabel = state === 'live' && !dirty ? 'Publicerad' : isPublished ? 'Publicera ändringar' : 'Publicera';
  const shown = problem ?? addressProblem;

  return (
    <div className="flex flex-col gap-5">
      <div className="z-30 flex flex-wrap sm:sticky sm:top-2 items-center gap-3 rounded-[22px] bg-white/95 px-5 py-3.5 shadow-card backdrop-blur">
        <a href="/admin/sidor" className="text-sm font-semibold text-muted no-underline hover:text-accent">← Alla sidor</a>
        <StatusLabel state={state} />
        <span className="text-[13px] text-subtle">
          {dirty ? 'Osparade ändringar' : record?.updatedAt ? `Sparad ${formatTime(record.updatedAt.toISOString())}` : ''}
        </span>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {isPublished && record?.slug && (
            <a href={`/${record.slug}`} target="_blank" rel="noopener" className="px-2 text-sm font-semibold text-accent no-underline hover:underline">
              Visa på sajten ↗
            </a>
          )}
          <BuildStatus />
          {isPublished && (
            <ActionButton onClick={onUnpublish} disabled={!!busy} busy={busy === 'unpublish'}>Avpublicera</ActionButton>
          )}
          <ActionButton onClick={onSave} disabled={!!busy || !dirty || !!problem} busy={busy === 'save'}>
            Spara utkast
          </ActionButton>
          <ActionButton primary onClick={onPublish} disabled={!!busy || !!shown || (state === 'live' && !dirty)} busy={busy === 'publish'}>
            {publishLabel}
          </ActionButton>
        </div>
        {(message || shown) && (
          <p
            role={message?.kind === 'error' ? 'alert' : 'status'}
            className={`m-0 w-full rounded-2xl px-4 py-2.5 text-sm ${
              message?.kind === 'ok' ? 'bg-[#E3F0DC] text-[#2F5A2B]' : message ? 'bg-[#FBEAEA] text-[#8A2B2B]' : 'bg-period text-muted'
            }`}
          >
            {message?.text ?? shown}
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
          <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em]">{id ? 'Redigera sida' : 'Ny sida'}</h1>

          <Field
            label="Titel"
            htmlFor="title"
            hint={
              record?.slug
                ? `Adress: /${record.slug} (kan inte ändras efter publicering).`
                : proposedSlug
                  ? `Sidan får adressen /${proposedSlug} när den publiceras, och den kan sedan inte ändras.`
                  : undefined
            }
          >
            <input id="title" value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="T.ex. Om klubben" className={INPUT} />
          </Field>

          <Field
            label="Text"
            htmlFor="body"
            hint="Tom rad ger nytt stycke. Använd knapparna ovanför för fet text, rubriker, listor och länkar."
          >
            <MarkdownField id="body" value={draft.body} onChange={(body) => update({ body })} targets={targets} />
          </Field>

          {id && inMenu !== null && (
            <p className="m-0 text-sm text-muted">
              I menyn: <strong>{inMenu ? 'ja' : 'nej'}</strong> →{' '}
              <a href="/admin/meny" className="font-semibold text-accent">Hantera menyn</a>
            </p>
          )}

          {id && neverPublished && (
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
          <p className="m-0 text-xs font-semibold tracking-[.12em] text-subtle">FÖRHANDSVISNING – SÅ HÄR SER SIDAN UT</p>
          <PageDetail page={preview} />
        </div>
      </div>

      <StatusBadge
        state={state}
        detail={state === 'changed' ? 'Publicera ändringarna för att visa dem för besökare' : state === 'draft' ? 'Syns inte för besökare' : undefined}
      />
    </div>
  );
}
