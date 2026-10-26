import { canManageMembership, canManageUsers, canPublish, canViewProtocols, type Permission } from '../types/user';

// En enda lista som styr både adminöversikten (/admin) och profilmenyn. Reglerna är det verkliga skyddet;
// den här listan döljer bara det man ändå inte får använda.
export interface AdminLink {
  href: string;
  label: string;
  description: string;
}

export interface AdminGroup {
  title: string;
  links: AdminLink[];
}

interface GroupDef {
  title: string;
  allowed: (own: readonly Permission[]) => boolean;
  links: (AdminLink & { allowed?: (own: readonly Permission[]) => boolean })[];
}

const GROUPS: GroupDef[] = [
  {
    title: 'Publicering',
    allowed: canPublish,
    links: [
      { href: '/admin/events', label: 'Events', description: 'Träningar, tävlingar och annat i kalendern' },
      { href: '/admin/eventor', label: 'Eventor', description: 'Välj vilka tävlingar från Eventor som visas i kalendern' },
      { href: '/admin/sidor', label: 'Sidor', description: 'Infosidor som Om klubben och Bli medlem' },
      { href: '/admin/meny', label: 'Meny', description: 'Ordning och undermenyer i huvudmenyn' },
      { href: '/admin/bilder', label: 'Bilder', description: 'Bildbanken som används i sidor och events' },
      { href: '/admin/statistik', label: 'Besöksstatistik', description: 'Mest besökta sidor, varifrån besökarna kommer och nedladdningar' },
    ],
  },
  {
    title: 'Styrelsen',
    allowed: (own) => canViewProtocols(own) || canManageUsers(own) || canManageMembership(own),
    links: [
      { href: '/admin/protokoll', label: 'Protokoll', description: 'Styrelsens protokoll, skrivna och godkända här', allowed: canViewProtocols },
      { href: '/admin/medlemsbetalningar', label: 'Medlemsbetalningar', description: 'Vem som betalat medlemsavgiften, pricka av och registrera i efterhand', allowed: canManageMembership },
      { href: '/admin/installningar', label: 'Inställningar', description: 'Klubbens Swish-nummer, startavgift och årets medlemsavgifter', allowed: canManageMembership },
      { href: '/admin/anvandare', label: 'Användare och behörigheter', description: 'Vem som är medlem, publicerare och styrelse', allowed: canManageUsers },
    ],
  },
];

/** Grupperna och länkarna som den här användaren får se */
export function adminGroups(own: readonly Permission[]): AdminGroup[] {
  return GROUPS.filter((g) => g.allowed(own))
    .map((g) => ({ title: g.title, links: g.links.filter((l) => !l.allowed || l.allowed(own)).map(({ href, label, description }) => ({ href, label, description })) }))
    .filter((g) => g.links.length > 0);
}

export const hasAdminAccess = (own: readonly Permission[]) => adminGroups(own).length > 0;
