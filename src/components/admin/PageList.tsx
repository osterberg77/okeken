import { useEffect, useState } from 'react';
import { watchMenu } from '../../lib/firebase/menu';
import { pageState, watchPages } from '../../lib/firebase/pages';
import { menuPageIds } from '../../lib/menu-edit';
import type { MenuRecord } from '../../types/menu';
import type { PageRecord } from '../../types/page';
import { canPublish } from '../../types/user';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';
import BuildStatus from './BuildStatus';
import { StatusLabel } from './StatusBadge';

export default function PageList() {
  return (
    <AdminGate allowed={canPublish} requirement="publicerare, styrelse eller superadmin">
      {() => <Pages />}
    </AdminGate>
  );
}

function Pages() {
  const [pages, setPages] = useState<PageRecord[] | null>(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<MenuRecord | null | undefined>(undefined);
  useEffect(() => watchPages(setPages, () => setError('Kunde inte läsa sidor.')), []);
  useEffect(() => watchMenu(setMenu, () => setMenu(undefined)), []);
  const inMenu = menu === undefined ? null : menuPageIds(menu?.items ?? []);

  return (
    <AdminPanel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <AdminTitle>Sidor</AdminTitle>
          <p className="mt-2 text-muted">Infosidor som Om klubben och Bli medlem. Ändringar syns på sajten när de publicerats.</p>
        </div>
        <BuildStatus />
        <a
          href="/admin/meny"
          className="rounded-full border-[1.5px] border-ink/18 bg-white px-5 py-[11px] text-sm font-semibold text-ink no-underline hover:border-accent hover:text-accent"
        >
          Hantera menyn
        </a>
        <a
          href="/admin/sida"
          className="rounded-full bg-accent px-6 py-[13px] text-sm font-semibold text-white no-underline shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110"
        >
          Ny sida
        </a>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A2B2B]">{error}</p>}
      {pages === null && !error && <p className="text-muted">Laddar sidor…</p>}
      {pages && pages.length === 0 && <p className="text-muted">Inga sidor ännu. Skapa en ny!</p>}

      {pages && pages.length > 0 && (
        <section className="flex flex-col gap-2.5">
          {pages.map((p) => (
            <a
              key={p.id}
              href={`/admin/sida?id=${p.id}`}
              className="flex items-center gap-4 rounded-[22px] bg-period px-[18px] py-3.5 text-ink no-underline hover:bg-pastel"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <StatusLabel state={pageState(p)} />
                  {inMenu && !inMenu.has(p.id) && (
                    <span className="inline-flex items-center rounded-full border border-ink/15 bg-white px-2.5 py-[3px] text-xs font-semibold text-muted">Ej i menyn</span>
                  )}
                </span>
                <span className="truncate font-display text-[17px] font-semibold">{p.title || '(utan titel)'}</span>
                <span className="truncate text-[13px] text-subtle">{p.slug ? `/${p.slug}` : 'Får sin adress när den publiceras'}</span>
              </span>
            </a>
          ))}
        </section>
      )}
    </AdminPanel>
  );
}
