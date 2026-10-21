export const PERMISSIONS = ['member', 'course_setter', 'publisher', 'board', 'superadmin'] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  member: 'Medlem',
  course_setter: 'Banläggare',
  publisher: 'Publicerare',
  board: 'Styrelse',
  superadmin: 'Superadmin',
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  member: 'Inloggad medlem',
  course_setter: 'Laddar upp banor',
  publisher: 'Skapar och publicerar events och sidor',
  board: 'Som publicerare, och tilldelar medlem, banläggare och publicerare',
  superadmin: 'Allt, inklusive styrelse och superadmin',
};

// Taggfärger enligt designspec (lila/grön/gul)
export const PERMISSION_COLORS: Record<Permission, { fg: string; bg: string }> = {
  member: { fg: '#6E3A82', bg: '#EFE3F5' },
  course_setter: { fg: '#3F6B3A', bg: '#E3F0DC' },
  publisher: { fg: '#3F6B3A', bg: '#E3F0DC' },
  board: { fg: '#6E3A82', bg: '#EFE3F5' },
  superadmin: { fg: '#6A5A12', bg: '#F6F0D2' },
};

const BOARD_ASSIGNABLE: Permission[] = ['member', 'course_setter', 'publisher'];

/** Vilka behörigheter en användare får ge/ta bort. Måste spegla firestore.rules. */
export function assignableBy(own: readonly Permission[]): Permission[] {
  if (own.includes('superadmin')) return [...PERMISSIONS];
  if (own.includes('board')) return BOARD_ASSIGNABLE;
  return [];
}

/** Får skapa, redigera och publicera events och sidor. Måste spegla firestore.rules. */
export function canPublish(own: readonly Permission[]): boolean {
  return own.includes('publisher') || own.includes('board') || own.includes('superadmin');
}

/** Får öppna events (lista och editor). Banläggare får bara ändra banor; reglerna avgör (beslut 0006). */
export function canViewEvents(own: readonly Permission[]): boolean {
  return canPublish(own) || own.includes('course_setter');
}

export function canManageUsers(own: readonly Permission[]): boolean {
  return own.includes('superadmin') || own.includes('board');
}

export interface Session {
  uid: string;
  email: string;
  displayName: string;
  permissions: Permission[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  permissions: Permission[];
}
