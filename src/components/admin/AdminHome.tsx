import { adminGroups, hasAdminAccess } from '../../lib/admin-nav';
import AdminGate, { AdminPanel, AdminTitle } from './AdminGate';

export default function AdminHome() {
  return (
    <AdminGate allowed={hasAdminAccess} requirement="en behörighet utöver medlem">
      {(session) => (
        <AdminPanel>
          <AdminTitle>Administration</AdminTitle>
          {adminGroups(session.permissions).map((group) => (
            <section key={group.title} className="flex flex-col gap-3">
              <h2 className="m-0 text-xs font-semibold tracking-[.12em] text-subtle uppercase">{group.title}</h2>
              <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <a
                      href={link.href}
                      className="flex h-full flex-col gap-1 rounded-[22px] border-[1.5px] border-ink/10 bg-white px-5 py-4 text-ink no-underline hover:border-accent hover:text-accent"
                    >
                      <span className="font-display text-lg font-bold">{link.label}</span>
                      <span className="text-[14px] font-normal text-muted">{link.description}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </AdminPanel>
      )}
    </AdminGate>
  );
}
