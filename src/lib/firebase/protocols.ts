// Klientens datalager för styrelsens protokoll (beslut 0009). Bara styrelse och superadmin har åtkomst;
// reglerna (firestore.rules) avgör, inte UI:t. Bygget läser aldrig `protocols`.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import type { ApprovalRole, ProtocolContent, ProtocolRecord } from '../../types/protocol';
import { uniqueTodoIds } from '../protocol';
import { canViewProtocols, type Permission, type UserProfile } from '../../types/user';
import { db } from './client';

const protocols = collection(db, 'protocols');

const toDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : null);

/** Exakt de nio innehållsfälten (reglerna kräver alla 15 nycklar och inga andra) */
function contentToFirestore(c: ProtocolContent) {
  return {
    meetingAt: Timestamp.fromDate(c.meetingAt),
    location: c.location.trim(),
    body: c.body,
    attendees: c.attendees.map((a) => ({ uid: a.uid, name: a.name })),
    todos: c.todos.map((t) => ({
      id: t.id,
      text: t.text.trim(),
      assigneeUid: t.assigneeUid,
      assigneeName: t.assigneeUid ? t.assigneeName : '',
      done: t.done,
    })),
    secretaryUid: c.secretaryUid,
    secretaryName: c.secretaryUid ? c.secretaryName : '',
    adjusterUid: c.adjusterUid,
    adjusterName: c.adjusterUid ? c.adjusterName : '',
  };
}

function readTodos(raw: DocumentData[]): ProtocolContent['todos'] {
  const ids = uniqueTodoIds(raw.map((t) => String(t.id ?? '')));
  return raw.map((t, i) => ({
    id: ids[i],
    text: t.text ?? '',
    assigneeUid: t.assigneeUid ?? null,
    assigneeName: t.assigneeName ?? '',
    done: t.done === true,
  }));
}

function recordFromFirestore(id: string, d: DocumentData): ProtocolRecord {
  return {
    id,
    meetingAt: toDate(d.meetingAt) ?? new Date(NaN),
    location: d.location ?? '',
    body: d.body ?? '',
    attendees: ((d.attendees ?? []) as DocumentData[]).map((a) => ({ uid: a.uid, name: a.name ?? '' })),
    todos: readTodos((d.todos ?? []) as DocumentData[]),
    secretaryUid: d.secretaryUid ?? null,
    secretaryName: d.secretaryName ?? '',
    adjusterUid: d.adjusterUid ?? null,
    adjusterName: d.adjusterName ?? '',
    secretaryApprovedAt: toDate(d.secretaryApprovedAt),
    adjusterApprovedAt: toDate(d.adjusterApprovedAt),
    createdBy: d.createdBy ?? '',
    createdAt: toDate(d.createdAt),
    updatedBy: d.updatedBy ?? '',
    updatedAt: toDate(d.updatedAt),
  };
}

const byMeetingDesc = query(protocols, orderBy('meetingAt', 'desc'));

/** Alla protokoll, senaste mötet först */
export function watchProtocols(callback: (list: ProtocolRecord[]) => void, onError: () => void): () => void {
  return onSnapshot(
    byMeetingDesc,
    (snap) => callback(snap.docs.map((d) => recordFromFirestore(d.id, d.data()))),
    onError,
  );
}

export function watchProtocol(id: string, callback: (p: ProtocolRecord | null) => void, onError: () => void): () => void {
  return onSnapshot(
    doc(protocols, id),
    (snap) => callback(snap.exists() ? recordFromFirestore(snap.id, snap.data()) : null),
    onError,
  );
}

/** Senaste protokollet (förval för "Hämta mall från"), eller null */
export async function getLatestProtocol(): Promise<ProtocolRecord | null> {
  const snap = await getDocs(query(protocols, orderBy('meetingAt', 'desc'), limit(1)));
  const d = snap.docs[0];
  return d ? recordFromFirestore(d.id, d.data()) : null;
}

/** Nytt utkast (aldrig med godkännanden; reglerna nekar det). Kontrollera först med validateProtocol. */
export async function createProtocol(content: ProtocolContent, uid: string): Promise<string> {
  const ref = await addDoc(protocols, {
    ...contentToFirestore(content),
    secretaryApprovedAt: null,
    adjusterApprovedAt: null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Spara innehållet. Nollställer alltid båda godkännandena (reglerna kräver det: ett godkännande gäller exakt
 * den text som godkändes), så anropa bara när något ändrats (sameProtocolContent). Nekas på låst protokoll.
 */
export async function saveProtocol(id: string, content: ProtocolContent, uid: string): Promise<void> {
  await updateDoc(doc(protocols, id), {
    ...contentToFirestore(content),
    secretaryApprovedAt: null,
    adjusterApprovedAt: null,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}

const approvalField = (role: ApprovalRole) => (role === 'secretary' ? 'secretaryApprovedAt' : 'adjusterApprovedAt');

/**
 * Godkänn sin del. Skrivningen ändrar bara det egna fältet (servertid); reglerna kräver att den inloggade är
 * utsedd till rollen. När båda godkänt är protokollet låst.
 */
export async function approveProtocol(id: string, role: ApprovalRole): Promise<void> {
  await updateDoc(doc(protocols, id), { [approvalField(role)]: serverTimestamp() });
}

/** Dra tillbaka sitt eget godkännande (bara på olåst protokoll) */
export async function revokeProtocolApproval(id: string, role: ApprovalRole): Promise<void> {
  await updateDoc(doc(protocols, id), { [approvalField(role)]: null });
}

/** Bara utkast utan godkännanden (se firestore.rules) */
export async function deleteProtocol(id: string): Promise<void> {
  await deleteDoc(doc(protocols, id));
}

// ---- Konton för taggning --------------------------------------------------------------
// Styrelse och superadmin får läsa alla users-dokument (firestore.rules), alltså alla som får se protokollen.

function userFromFirestore(uid: string, d: DocumentData): UserProfile {
  return {
    uid,
    email: d.email ?? '',
    displayName: d.displayName ?? '',
    permissions: (d.permissions ?? []) as Permission[],
  };
}

/** Alla konton, sorterade på namn (för deltagare, ansvariga och omnämnanden) */
export async function listUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map((d) => userFromFirestore(d.id, d.data()))
    .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email, 'sv'));
}

/** Konton med styrelse- eller superadminbehörighet: förval för deltagare, och de enda som kan godkänna */
export async function listBoardCandidates(): Promise<UserProfile[]> {
  return (await listUsers()).filter((u) => canViewProtocols(u.permissions));
}
