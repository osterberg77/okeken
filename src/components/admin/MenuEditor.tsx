import { useEffect, useMemo, useRef, useState } from 'react';
import { menuState, publishMenu, saveMenu, sameMenuItems, watchMenu } from '../../lib/firebase/menu';
import { pageState, watchPages } from '../../lib/firebase/pages';
import {
  addChild,
  addHeading,
  addTopPage,
  canAddChild,
  canAddTop,
  canNest,
  menuPageIds,
  moveChild,
  moveChildTo,
  moveTop,
  nestTop,
  removeChild,
  removeTop,
  renameTop,
  unnestChild,
} from '../../lib/menu-edit';
import { describeMenuWarning, resolveMenu } from '../../lib/menu-resolve';
import { formatTime } from '../../lib/time';
import { MAX_MENU_CHILDREN, MAX_MENU_ITEMS, MAX_MENU_LABEL, type MenuItem, type MenuRecord } from '../../types/menu';
import type { PageRecord } from '../../types/page';
import { canPublish, type Session } from '../../types/user';
import { ActionButton, INPUT } from './AdminUi';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import BuildStatus from './BuildStatus';
import StatusBadge, { StatusLabel } from './StatusBadge';

export default function MenuEditor() {
  return (
    <AdminGate allowed={canPublish} requirement="publicerare, styrelse eller superadmin">
      {(session) => <Editor session={session} />}
    </AdminGate>
  );
}

type Message = { kind: 'ok' | 'error'; text: string } | null;

const SMALL = 'cursor-pointer rounded-full border-[1.5px] border-ink/18 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-40 disabled:hover:border-ink/18 disabled:hover:text-ink';
const SELECT = 'rounded-full border-[1.5px] border-ink/18 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink outline-none focus:border-accent disabled:opacity-40';

function Editor({ session }: { session: Session }) {
  const [record, setRecord] = useState<MenuRecord | null | undefined>(undefined);
  const [pages, setPages] = useState<PageRecord[] | null>(null);
  const [draft, setDraft] = useState<MenuItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const loaded = useRef(false);

  useEffect(
    () =>
      watchMenu(
        (r) => {
          setRecord(r);
          if (!loaded.current) {
            loaded.current = true;
            setDraft(r?.items ?? []);
          }
        },
        () => setMessage({ kind: 'error', text: 'Kunde inte läsa menyn.' }),
      ),
    [],
  );
  useEffect(() => watchPages(setPages, () => setMessage({ kind: 'error', text: 'Kunde inte läsa sidor.' })), []);

  const saved = record?.items ?? [];
  const dirty = !!draft && !sameMenuItems(draft, saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const byId = useMemo(() => new Map((pages ?? []).map((p) => [p.id, p])), [pages]);
  const resolved = useMemo(() => {
    // Samma uppslag som bygget: bara publicerade sidor, med titeln ur den publicerade versionen
    const refs = (pages ?? []).flatMap((p) =>
      p.status === 'published' && p.published && p.slug ? [{ pageId: p.id, slug: p.slug, title: p.published.title }] : [],
    );
    return resolveMenu(draft ?? [], refs);
  }, [draft, pages]);
  // Förhandsvisningen visar hela utkastet, även sidor som inte är publicerade än (märkta, de syns inte för besökare förrän
  // sidan publicerats). Resultatet ovan är det som faktiskt blir synligt och styr varningarna.
  const previewMenu = useMemo(() => {
    const refs = (pages ?? []).map((p) => {
      const live = p.status === 'published' && p.published && p.slug;
      return { pageId: p.id, slug: live ? p.slug! : `${NOT_LIVE.slice(1)}${p.id}`, title: live ? p.published!.title : p.title || '(utan titel)' };
    });
    return resolveMenu(draft ?? [], refs).items;
  }, [draft, pages]);

  if (record === undefined || !draft || !pages) {
    return <AdminPanel><p className="text-muted">Laddar…</p></AdminPanel>;
  }

  const exists = record !== null;
  const state = menuState(record?.published ?? null, draft);
  const emptyLabel = draft.some((it) => !it.label.trim());
  const problem = emptyLabel ? 'Alla menyposter behöver en text.' : null;
  const inMenu = menuPageIds(draft);
  const hidden = new Set(
    resolved.warnings.flatMap((w) => (w.problem === 'unpublished' || w.problem === 'duplicate' ? [w.pageId] : [])),
  );
  const titleOf = (id: string) => byId.get(id)?.title || byId.get(id)?.published?.title || '(utan titel)';

  const change = (items: MenuItem[]) => {
    setDraft(items);
    setMessage(null);
    setConfirmRemove(null);
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

  const onSave = () => run('save', async () => {
    await saveMenu(exists, draft, session.uid);
    return record?.published ? 'Sparat som utkast. Besökarna ser den publicerade menyn tills du publicerar ändringarna.' : 'Sparat.';
  });
  const onPublish = () => run('publish', async () => {
    await publishMenu(exists, draft, session.uid);
    return 'Publicerat! Menyn ändras på sajten efter nästa ombyggnad.';
  });

  const publishLabel = state === 'live' && !dirty ? 'Publicerad' : record?.published ? 'Publicera ändringar' : 'Publicera';

  return (
    <div className="flex flex-col gap-5">
      <div className="z-30 flex flex-wrap sm:sticky sm:top-2 items-center gap-3 rounded-[22px] bg-white/95 px-5 py-3.5 shadow-card backdrop-blur">
        <a href="/admin/sidor" className="text-sm font-semibold text-muted no-underline hover:text-accent">← Alla sidor</a>
        <StatusLabel state={state} />
        <span className="text-[13px] text-subtle">
          {dirty ? 'Osparade ändringar' : record?.updatedAt ? `Sparad ${formatTime(record.updatedAt.toISOString())}` : ''}
        </span>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <BuildStatus />
          <ActionButton onClick={onSave} disabled={!!busy || !dirty || !!problem} busy={busy === 'save'}>Spara utkast</ActionButton>
          <ActionButton primary onClick={onPublish} disabled={!!busy || !!problem || (state === 'live' && !dirty)} busy={busy === 'publish'}>
            {publishLabel}
          </ActionButton>
        </div>
        {(message || problem) && (
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

      {!record?.published && (
        <p role="status" className="m-0 rounded-2xl bg-[#FFF3CC] px-4 py-3 text-sm text-[#6B5200]">
          Menyn är inte publicerad ännu. Besökarna ser tills vidare de gamla länkarna (Om oss och Bli medlem på okeken.se). Publicera sidorna du vill ha med
          under <a href="/admin/sidor" className="font-semibold">Sidor</a> och tryck sedan Publicera här.
        </p>
      )}

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <AdminPanel>
          <div>
            <AdminTitle>Menyn</AdminTitle>
            <p className="mt-2 mb-0 text-muted">
              Det här visas i sajtens meny, i den här ordningen. Kalendern ligger alltid först. Använd pilarna för att ordna om.
              Att ta bort en post ur menyn tar inte bort sidan.
            </p>
            <div className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-period px-4 py-3 text-[14px] leading-[1.5]">
              <strong>Rubrik eller sida med undersidor?</strong>
              <span>
                <strong>Rubrik:</strong> bara en text som öppnar en undermeny. Den leder inte till någon sida själv, och visas bara om minst en
                undersida under den är publicerad.
              </span>
              <span>
                <strong>Sida med undersidor:</strong> texten är en länk till sidan, och en liten pil bredvid öppnar undermenyn. Besökaren får
                alltså både en egen sida och en undermeny.
              </span>
            </div>
            <p className="mt-2 mb-0 text-[13px] text-subtle">
              Högst {MAX_MENU_ITEMS} poster i menyn ({draft.length}/{MAX_MENU_ITEMS}) och högst {MAX_MENU_CHILDREN} undersidor under varje post. Det finns bara en nivå av undermeny.
            </p>
          </div>

          {draft.length === 0 && <p className="m-0 rounded-2xl bg-period px-4 py-3 text-muted">Menyn är tom. Lägg till en sida eller en rubrik nedan.</p>}

          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {draft.map((item, i) => (
              <TopRow
                key={`${i}-${item.pageId ?? 'h'}`}
                item={item}
                index={i}
                items={draft}
                page={item.pageId ? byId.get(item.pageId) : undefined}
                hidden={!!item.pageId && hidden.has(item.pageId)}
                titleOf={titleOf}
                hiddenIds={hidden}
                byId={byId}
                confirming={confirmRemove === i}
                onChange={change}
                onAskRemove={() => setConfirmRemove(i)}
                onCancelRemove={() => setConfirmRemove(null)}
              />
            ))}
          </ol>

          <AddPanel items={draft} pages={pages} inMenu={inMenu} onChange={change} />
        </AdminPanel>

        <div className="flex flex-col gap-5 lg:sticky lg:top-28">
          <AdminPanel>
            <p className="m-0 text-xs font-semibold tracking-[.12em] text-subtle">FÖRHANDSVISNING – SÅ HÄR BLIR MENYN FÖR BESÖKARE</p>
            <Preview menu={previewMenu} />
            <p className="m-0 text-[13px] text-subtle">
              Visar hela utkastet. Poster märkta "ej publicerad" syns inte för besökare förrän sidan är publicerad. Sidornas och menyns utseende på sajten kan skilja sig.
            </p>
            {resolved.warnings.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Varningar">
                {resolved.warnings.map((w, k) => (
                  <li key={k} className="rounded-2xl bg-[#FFF4D6] px-4 py-2.5 text-sm text-[#6A5A12]">
                    {describeWarning(w, titleOf)}
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
        </div>
      </div>

      <StatusBadge
        state={state}
        detail={state === 'changed' ? 'Publicera ändringarna för att visa dem för besökare' : state === 'draft' ? 'Syns inte för besökare' : undefined}
      />
    </div>
  );
}

function describeWarning(w: Parameters<typeof describeMenuWarning>[0], titleOf: (id: string) => string): string {
  const text = describeMenuWarning(w);
  return w.pageId ? text.replace(w.pageId, `"${titleOf(w.pageId)}"`) : text;
}

/** Platshållare i adressen för sidor som inte är publicerade än (bara i förhandsvisningen; resolveMenu lägger själv till det första snedstrecket) */
const NOT_LIVE = '/__not-live__/';

function NotLive() {
  return <span className="ml-1.5 text-xs font-normal text-[#8A6A00]">(ej publicerad)</span>;
}

function Preview({ menu }: { menu: ReturnType<typeof resolveMenu>['items'] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 rounded-2xl bg-period p-4 font-display text-[16px] font-semibold">
      <li>Kalender <span className="text-xs font-normal text-subtle">(fast)</span></li>
      {menu.map((m, i) => (
        <li key={i}>
          <span className={m.href ? '' : 'text-muted'}>{m.label}</span>
          {!m.href && <span className="ml-1.5 text-xs font-normal text-subtle">(rubrik)</span>}
          {m.href?.startsWith(NOT_LIVE) && <NotLive />}
          {m.children.length > 0 && (
            <ul className="m-0 mt-1 mb-1 list-none border-l-2 border-ink/15 pl-4 text-[15px] font-medium">
              {m.children.map((c, k) => (
                <li key={k}>
                  {c.label}
                  {c.href.startsWith(NOT_LIVE) && <NotLive />}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

interface TopRowProps {
  item: MenuItem;
  index: number;
  items: MenuItem[];
  page: PageRecord | undefined;
  hidden: boolean;
  hiddenIds: Set<string>;
  byId: Map<string, PageRecord>;
  titleOf: (id: string) => string;
  confirming: boolean;
  onChange: (items: MenuItem[]) => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
}

function TopRow({ item, index, items, page, hidden, hiddenIds, byId, titleOf, confirming, onChange, onAskRemove, onCancelRemove }: TopRowProps) {
  const name = item.label || 'posten';
  const nestable = canNest(item);
  const targets = items.map((it, j) => ({ it, j })).filter(({ j }) => j !== index);
  const hasChildren = item.children.length > 0;
  return (
    <li className="rounded-[22px] bg-period px-4 py-3.5">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`Menytext för ${name}`}
            value={item.label}
            maxLength={MAX_MENU_LABEL}
            onChange={(e) => onChange(renameTop(items, index, e.target.value))}
            placeholder="Menytext"
            className={`${INPUT} min-w-0 flex-1 basis-48 !py-2 font-display font-semibold`}
          />
          {item.pageId ? (
            <span className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-muted">
              <span className="truncate">Sida: {page ? page.title || '(utan titel)' : 'finns inte längre'}</span>
              {page && <StatusLabel state={pageState(page)} />}
            </span>
          ) : (
            <span className="rounded-full bg-white px-2.5 py-[3px] text-xs font-semibold text-muted">Rubrik</span>
          )}
        </div>
        {hidden && item.pageId && (
          <p className="m-0 text-[13px] text-[#6A5A12]">
            {page?.status === 'published'
              ? 'Den här sidan finns redan tidigare i menyn och visas bara där.'
              : 'Sidan är inte publicerad och länkas inte i menyn för besökare.'}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={SMALL} disabled={index === 0} onClick={() => onChange(moveTop(items, index, -1))} aria-label={`Flytta upp ${name}`}>↑ Upp</button>
          <button type="button" className={SMALL} disabled={index === items.length - 1} onClick={() => onChange(moveTop(items, index, 1))} aria-label={`Flytta ner ${name}`}>↓ Ner</button>
          {item.pageId && (
            <select
              aria-label={`Flytta ${name} in under en annan post`}
              className={SELECT}
              value=""
              disabled={!nestable || targets.length === 0}
              onChange={(e) => e.target.value !== '' && onChange(nestTop(items, index, Number(e.target.value)))}
            >
              <option value="">Flytta in under…</option>
              {targets.map(({ it, j }) => (
                <option key={j} value={j} disabled={!canAddChild(items, j)}>
                  {it.label || '(utan text)'}{canAddChild(items, j) ? '' : ` (full, ${MAX_MENU_CHILDREN}/${MAX_MENU_CHILDREN})`}
                </option>
              ))}
            </select>
          )}
          <span className="flex-1" />
          {confirming ? (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              Ta bort även {item.children.length} undersida{item.children.length === 1 ? '' : 'r'} ur menyn?
              <ActionButton danger onClick={() => onChange(removeTop(items, index))}>Ja, ta bort</ActionButton>
              <button type="button" onClick={onCancelRemove} className="cursor-pointer text-sm font-semibold text-muted">Avbryt</button>
            </span>
          ) : (
            <button
              type="button"
              className="cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#A33A3A] hover:underline"
              onClick={() => (hasChildren ? onAskRemove() : onChange(removeTop(items, index)))}
              aria-label={`Ta bort ${name} ur menyn`}
            >
              Ta bort ur menyn
            </button>
          )}
        </div>
        {item.pageId && hasChildren && (
          <p className="m-0 text-xs text-subtle">Posten har undersidor och kan därför inte flyttas in under en annan post (det skulle bli en tredje nivå).</p>
        )}
        {item.pageId && !hasChildren && targets.length > 0 && targets.every(({ j }) => !canAddChild(items, j)) && (
          <p className="m-0 text-xs text-subtle">Alla andra poster har redan {MAX_MENU_CHILDREN} undersidor.</p>
        )}
      </div>

      {hasChildren && (
        <ol className="m-0 mt-3 ml-3 flex list-none flex-col gap-2 border-l-2 border-ink/15 p-0 pl-3 sm:ml-6 sm:pl-4">
          {item.children.map((childId, c) => {
            const child = byId.get(childId);
            const ctitle = titleOf(childId);
            return (
              <li key={childId} className="flex flex-col gap-2 rounded-2xl bg-white px-3.5 py-2.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 truncate font-display text-[15px] font-semibold">{child ? ctitle : 'Sidan finns inte längre'}</span>
                  {child && <StatusLabel state={pageState(child)} />}
                </span>
                {hiddenIds.has(childId) && (
                  <span className="text-[13px] text-[#6A5A12]">
                    {child?.status === 'published' ? 'Finns redan tidigare i menyn och visas bara där.' : 'Inte publicerad, syns inte i menyn för besökare.'}
                  </span>
                )}
                <span className="flex flex-wrap items-center gap-2">
                  <button type="button" className={SMALL} disabled={c === 0} onClick={() => onChange(moveChild(items, index, c, -1))} aria-label={`Flytta upp ${ctitle}`}>↑ Upp</button>
                  <button type="button" className={SMALL} disabled={c === item.children.length - 1} onClick={() => onChange(moveChild(items, index, c, 1))} aria-label={`Flytta ner ${ctitle}`}>↓ Ner</button>
                  <button
                    type="button"
                    className={SMALL}
                    disabled={!canAddTop(items)}
                    title={canAddTop(items) ? undefined : `Menyn har redan ${MAX_MENU_ITEMS} poster`}
                    onClick={() => onChange(unnestChild(items, index, c, ctitle))}
                    aria-label={`Flytta ${ctitle} ut till toppnivå`}
                  >
                    Flytta ut
                  </button>
                  {targets.length > 0 && (
                    <select
                      aria-label={`Flytta ${ctitle} till en annan post`}
                      className={SELECT}
                      value=""
                      onChange={(e) => e.target.value !== '' && onChange(moveChildTo(items, index, c, Number(e.target.value)))}
                    >
                      <option value="">Flytta till…</option>
                      {targets.map(({ it, j }) => (
                        <option key={j} value={j} disabled={!canAddChild(items, j)}>
                          {it.label || '(utan text)'}{canAddChild(items, j) ? '' : ' (full)'}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="flex-1" />
                  <button
                    type="button"
                    className="cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#A33A3A] hover:underline"
                    onClick={() => onChange(removeChild(items, index, c))}
                    aria-label={`Ta bort ${ctitle} ur menyn`}
                  >
                    Ta bort ur menyn
                  </button>
                </span>
                {!canAddTop(items) && <span className="text-xs text-subtle">Menyn har redan {MAX_MENU_ITEMS} poster, så den kan inte flyttas ut.</span>}
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

function AddPanel({ items, pages, inMenu, onChange }: { items: MenuItem[]; pages: PageRecord[]; inMenu: Set<string>; onChange: (items: MenuItem[]) => void }) {
  const [pageId, setPageId] = useState('');
  const [where, setWhere] = useState('top');
  const [heading, setHeading] = useState('');

  const available = pages.filter((p) => !inMenu.has(p.id));
  const topFull = !canAddTop(items);
  const slots = [
    { value: 'top', label: topFull ? `Egen post i menyn (full, ${MAX_MENU_ITEMS}/${MAX_MENU_ITEMS})` : 'Egen post i menyn', ok: !topFull },
    ...items.map((it, j) => ({
      value: String(j),
      label: `Undersida under ${it.label || '(utan text)'}${canAddChild(items, j) ? '' : ` (full, ${MAX_MENU_CHILDREN}/${MAX_MENU_CHILDREN})`}`,
      ok: canAddChild(items, j),
    })),
  ];
  const slot = slots.find((s) => s.value === where) ?? slots[0];
  const page = available.find((p) => p.id === pageId);
  const canAddPage = !!page && slot.ok;

  const addPage = () => {
    if (!page || !slot.ok) return;
    onChange(slot.value === 'top' ? addTopPage(items, page.id, page.title) : addChild(items, Number(slot.value), page.id));
    setPageId('');
  };
  const addHead = () => {
    if (!heading.trim() || topFull) return;
    onChange(addHeading(items, heading));
    setHeading('');
  };

  return (
    <div className="flex flex-col gap-5 border-t border-line pt-5">
      <div className="flex flex-col gap-2.5">
        <h2 className="m-0 font-display text-[20px] font-bold">Lägg till sida</h2>
        {available.length === 0 ? (
          <p className="m-0 text-muted">Alla sidor finns redan i menyn. <a href="/admin/sida" className="font-semibold text-accent">Skapa en ny sida</a></p>
        ) : (
          <>
            <select aria-label="Sida att lägga till" className={INPUT} value={pageId} onChange={(e) => setPageId(e.target.value)}>
              <option value="">Välj sida…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || '(utan titel)'} – {STATE_TEXT[pageState(p)]}
                </option>
              ))}
            </select>
            <select aria-label="Var i menyn" className={INPUT} value={slot.value} onChange={(e) => setWhere(e.target.value)}>
              {slots.map((s) => <option key={s.value} value={s.value} disabled={!s.ok}>{s.label}</option>)}
            </select>
            <p className="m-0 text-[13px] text-muted">
              "Egen post" blir en vanlig länk i menyn. "Undersida under …" hamnar i en undermeny: under en rubrik blir posten bara en meny, under en
              sida får posten både en egen länk och en undermeny.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton onClick={addPage} disabled={!canAddPage}>Lägg till sidan</ActionButton>
              {!slot.ok && (
                <span className="text-[13px] text-muted">
                  {slot.value === 'top' ? `Menyn har redan ${MAX_MENU_ITEMS} poster. Välj en undermeny eller ta bort en post först.` : `Posten har redan ${MAX_MENU_CHILDREN} undersidor.`}
                </span>
              )}
              {page && page.status !== 'published' && (
                <span className="text-[13px] text-muted">Sidan är inte publicerad och syns i menyn först när den publicerats.</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className="m-0 font-display text-[20px] font-bold">Lägg till rubrik</h2>
        <p className="m-0 text-[13px] text-muted">En rubrik är bara en knapp som öppnar en undermeny, utan egen sida. Lägg sidor under den efteråt. Ska posten gå att klicka till en sida, lägg i stället till sidan som egen post och lägg undersidorna under den.</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Namn på rubrik"
            value={heading}
            maxLength={MAX_MENU_LABEL}
            onChange={(e) => setHeading(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHead()}
            placeholder="T.ex. Träning"
            className={`${INPUT} min-w-0 flex-1 basis-48`}
          />
          <ActionButton onClick={addHead} disabled={!heading.trim() || topFull}>Lägg till rubrik</ActionButton>
        </div>
        {topFull && <span className="text-[13px] text-muted">Menyn har redan {MAX_MENU_ITEMS} poster. Ta bort en post först.</span>}
      </div>
    </div>
  );
}

const STATE_TEXT = { draft: 'utkast', changed: 'publicerad, ändrad', unpublished: 'avpublicerad', live: 'publicerad' } as const;
