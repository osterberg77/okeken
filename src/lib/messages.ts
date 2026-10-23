// Meddelanden (beslut 0019): ren logik utan Firebase-import, delad av klienten och testerna.

/** Konversationens id: de två uid:na i ordning, åtskilda med understreck (samma regel som pairId i firestore.rules) */
export function pairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export const MAX_MESSAGE_LENGTH = 1000;

export interface ConversationSummary {
  id: string;
  /** Den andra personens uid */
  otherUid: string;
  lastMessageAt: Date | null;
  lastSenderUid: string;
  lastText: string;
  unread: boolean;
}

/** Oläst: senaste meddelandet är från den andra och kom efter att jag senast läste. En väntande servertid (null) räknas som nu. */
export function isUnread(me: string, c: { lastSenderUid: string; lastMessageAt: Date | null; readAt: Date | null }): boolean {
  if (c.lastSenderUid === me) return false;
  if (!c.readAt) return true;
  return c.lastMessageAt === null ? false : c.lastMessageAt.getTime() > c.readAt.getTime();
}

/** Kort text för listan: en rad, högst 200 UTF-16-enheter (säkert under reglernas gräns) utan att dela en emoji */
export function previewText(text: string): string {
  let out = '';
  for (const ch of text.replace(/\s+/g, ' ').trim()) {
    if (out.length + ch.length > 200) break;
    out += ch;
  }
  return out;
}

/** Texten som skickas: trimmad, eller null om den är tom eller för lång */
export function cleanMessage(text: string): string | null {
  const t = text.trim();
  return t.length > 0 && t.length <= MAX_MESSAGE_LENGTH ? t : null;
}

/** Länken i ett automatiskt meddelande ska vara en adress på sajten (samma krav som reglerna) */
export function isSafeLink(link: unknown): link is string {
  return typeof link === 'string' && link.length <= 200 && /^\/[^/]/.test(link);
}
