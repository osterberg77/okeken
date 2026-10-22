/** Profilfärger: id:n lagras i users/{uid}.avatarColor och måste spegla avatarColors() i firestore.rules. */
export const AVATAR_COLORS = {
  purple: { label: 'Lila', from: '#C9A7DA', to: '#8A4B9E' },
  green: { label: 'Grön', from: '#B7D8A8', to: '#4F8A45' },
  gold: { label: 'Gul', from: '#EBD98A', to: '#B08A12' },
  blue: { label: 'Blå', from: '#A9C6EA', to: '#3F6FB0' },
  red: { label: 'Röd', from: '#EBAAAA', to: '#B04545' },
  teal: { label: 'Turkos', from: '#A5D9D4', to: '#2F8A82' },
  orange: { label: 'Orange', from: '#F1C49A', to: '#C8742A' },
  grey: { label: 'Grå', from: '#C9C6D3', to: '#6B6780' },
} as const;

export type AvatarColor = keyof typeof AVATAR_COLORS;

export const DEFAULT_AVATAR_COLOR: AvatarColor = 'purple';

export function isAvatarColor(value: unknown): value is AvatarColor {
  return typeof value === 'string' && value in AVATAR_COLORS;
}

export function avatarGradient(color: string | undefined): string {
  const c = AVATAR_COLORS[isAvatarColor(color) ? color : DEFAULT_AVATAR_COLOR];
  return `linear-gradient(135deg,${c.from},${c.to})`;
}

export function avatarShadow(color: string | undefined): string {
  const c = AVATAR_COLORS[isAvatarColor(color) ? color : DEFAULT_AVATAR_COLOR];
  return `0 8px 18px -8px ${c.to},0 0 0 3px #fff`;
}
