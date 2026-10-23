import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { noticeRecipients, type NoticePlan } from '../notify';
import { cleanMessage, isUnread, isSafeLink, pairId, previewText, type ConversationSummary } from '../messages';
import { db } from './client';

// Meddelanden mellan användare (beslut 0019). Reglerna i firestore.rules är det verkliga skyddet.

export interface Message {
  id: string;
  senderUid: string;
  text: string;
  kind: 'text' | 'notice';
  link?: string;
  createdAt: Date | null;
}

export interface Person {
  uid: string;
  displayName: string;
  photoUrl?: string;
  avatarColor?: string;
  hidden?: boolean;
}

const toDate = (v: unknown): Date | null => (v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate() : null);

/** Mina konversationer, senaste först. Ropar callback vid varje ändring (även mina egna läsmarkeringar). */
export function watchConversations(me: string, callback: (list: ConversationSummary[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'conversations'), where('participants', 'array-contains', me)),
    (snap) => {
      const list = snap.docs.map((d): ConversationSummary => {
        const x = d.data({ serverTimestamps: 'estimate' });
        const participants: string[] = Array.isArray(x.participants) ? x.participants : [];
        const lastMessageAt = toDate(x.lastMessageAt);
        return {
          id: d.id,
          otherUid: participants.find((p) => p !== me) ?? '',
          lastMessageAt,
          lastSenderUid: String(x.lastSenderUid ?? ''),
          lastText: String(x.lastText ?? ''),
          unread: isUnread(me, { lastSenderUid: String(x.lastSenderUid ?? ''), lastMessageAt, readAt: toDate(x.readAt?.[me]) }),
        };
      });
      list.sort((a, b) => (b.lastMessageAt?.getTime() ?? Infinity) - (a.lastMessageAt?.getTime() ?? Infinity));
      callback(list);
    },
    () => callback([]),
  );
}

/** Antal konversationer med olästa meddelanden (för badgen) */
export function watchUnreadCount(me: string, callback: (count: number) => void): () => void {
  return watchConversations(me, (list) => callback(list.filter((c) => c.unread).length));
}

export function watchMessages(me: string, other: string, callback: (messages: Message[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'conversations', pairId(me, other), 'messages'), orderBy('createdAt', 'asc')),
    (snap) =>
      callback(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: 'estimate' });
          return {
            id: d.id,
            senderUid: String(x.senderUid ?? ''),
            text: String(x.text ?? ''),
            kind: x.kind === 'notice' ? 'notice' : 'text',
            link: isSafeLink(x.link) ? x.link : undefined,
            createdAt: toDate(x.createdAt),
          };
        }),
      ),
    () => callback([]),
  );
}

/** Jag har läst konversationen (bara min egen läsmarkering ändras) */
export async function markRead(me: string, other: string): Promise<void> {
  await updateDoc(doc(db, 'conversations', pairId(me, other)), { [`readAt.${me}`]: serverTimestamp() });
}

/**
 * Skickar ett meddelande. Konversation och meddelande skrivs i samma batch. Klienten kan inte läsa en konversation som
 * inte finns, så först försöks en uppdatering av en befintlig och sedan en ny konversation.
 */
export async function sendMessage(me: string, other: string, text: string, notice?: { link?: string }): Promise<void> {
  const clean = cleanMessage(text);
  if (!clean || me === other) throw new Error('invalid message');
  const link = notice?.link;
  if (link !== undefined && !isSafeLink(link)) throw new Error('invalid link');
  const conv = doc(db, 'conversations', pairId(me, other));
  const message = {
    senderUid: me,
    text: clean,
    kind: notice ? 'notice' : 'text',
    ...(link ? { link } : {}),
    createdAt: serverTimestamp(),
  };
  const summary = { lastMessageAt: serverTimestamp(), lastSenderUid: me, lastText: previewText(clean) };

  const existing = writeBatch(db);
  existing.update(conv, { ...summary, [`readAt.${me}`]: serverTimestamp() });
  existing.set(doc(collection(conv, 'messages')), message);
  try {
    await existing.commit();
    return;
  } catch {
    // Konversationen finns inte än (eller så nekas skrivningen även som ny nedan)
  }
  const fresh = writeBatch(db);
  fresh.set(conv, { participants: [me, other].sort(), ...summary, readAt: { [me]: serverTimestamp() } });
  fresh.set(doc(collection(conv, 'messages')), message);
  await fresh.commit();
}

/** Personer att skriva till: bara de som inte är dolda (reglerna kräver where hidden == false), utom jag. Banläggare och uppåt får alla. */
export async function loadDirectory(me: string, includeHidden: boolean): Promise<Person[]> {
  const col = collection(db, 'members');
  const snap = await getDocs(includeHidden ? col : query(col, where('hidden', '==', false)));
  return snap.docs.filter((d) => d.id !== me).map((d) => toPerson(d.id, d.data())).sort((a, b) => a.displayName.localeCompare(b.displayName, 'sv'));
}

function toPerson(uid: string, x: Record<string, unknown>): Person {
  return {
    uid,
    displayName: String(x.displayName ?? ''),
    photoUrl: typeof x.photoUrl === 'string' ? x.photoUrl : undefined,
    avatarColor: typeof x.avatarColor === 'string' ? x.avatarColor : undefined,
    hidden: x.hidden === true,
  };
}

/** Namn och bild för en person man har en konversation med; null om uppgifterna inte finns (t.ex. raderat konto) */
export async function loadPerson(uid: string): Promise<Person | null> {
  try {
    const snap = await getDoc(doc(db, 'members', uid));
    return snap.exists() ? toPerson(uid, snap.data()) : null;
  } catch {
    return null;
  }
}

/**
 * Skickar ett automatiskt meddelande till varje mottagare (kuvert-ikonen, beslut 0019). Kastar aldrig: en notis som inte
 * gick fram ska inte stoppa det den hör till. Returnerar antal skickade och misslyckade.
 */
export async function sendNotices(me: string, plan: NoticePlan): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const to of noticeRecipients(plan, me)) {
    try {
      await sendMessage(me, to, plan.text, { link: plan.link });
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}
