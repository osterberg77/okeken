// Rena funktioner för styrelsens protokoll (beslut 0009), utan Firebase-beroende så att de kan återanvändas i
// admin-UI:t och enhetstestas. Behörighetskontrollerna speglar firestore.rules; det är reglerna som skyddar.
import {
  MAX_ATTENDEES,
  MAX_PROTOCOL_BODY,
  MAX_PROTOCOL_LOCATION,
  MAX_PROTOCOL_NAME,
  MAX_TODO_TEXT,
  MAX_TODOS,
  PROTOCOL_UID_PATTERN,
  TODO_ID_PATTERN,
  type ApprovalRole,
  type ProtocolAttendee,
  type ProtocolContent,
  type ProtocolRecord,
  type ProtocolState,
  type ProtocolTodo,
} from '../types/protocol';
import { canViewProtocols, type Permission } from '../types/user';

type Approvals = Pick<ProtocolRecord, 'secretaryApprovedAt' | 'adjusterApprovedAt'>;
type Designated = Pick<ProtocolRecord, 'secretaryUid' | 'adjusterUid'> & Approvals;

// ---- Status och behörighet -------------------------------------------------------

export function isProtocolLocked(p: Approvals): boolean {
  return p.secretaryApprovedAt !== null && p.adjusterApprovedAt !== null;
}

/** Härledd status för StatusBadge/listor (lagras inte) */
export function protocolState(p: Approvals): ProtocolState {
  if (isProtocolLocked(p)) return 'locked';
  if (p.secretaryApprovedAt !== null || p.adjusterApprovedAt !== null) return 'partly_approved';
  return 'draft';
}

/** Redigera innehållet: styrelse/superadmin och inte låst. En sparning nollställer båda godkännandena. */
export function canEditProtocol(p: Approvals, own: readonly Permission[]): boolean {
  return canViewProtocols(own) && !isProtocolLocked(p);
}

/** Radera: bara utkast utan något godkännande */
export function canDeleteProtocol(p: Approvals, own: readonly Permission[]): boolean {
  return canViewProtocols(own) && protocolState(p) === 'draft';
}

/** Vilken del användaren är utsedd att godkänna, om någon */
export function approvalRoleOf(p: Designated, uid: string): ApprovalRole | null {
  if (p.secretaryUid !== null && p.secretaryUid === uid) return 'secretary';
  if (p.adjusterUid !== null && p.adjusterUid === uid) return 'adjuster';
  return null;
}

export function approvedAtOf(p: Approvals, role: ApprovalRole): Date | null {
  return role === 'secretary' ? p.secretaryApprovedAt : p.adjusterApprovedAt;
}

/** Den del användaren får godkänna nu (utsedd, inte redan godkänt, inte låst), annars null */
export function canApprove(p: Designated, uid: string, own: readonly Permission[]): ApprovalRole | null {
  const role = approvalRoleOf(p, uid);
  if (!role || !canViewProtocols(own) || isProtocolLocked(p) || p.secretaryUid === p.adjusterUid) return null;
  return approvedAtOf(p, role) === null ? role : null;
}

/** Den del användaren får dra tillbaka (eget godkännande på olåst protokoll), annars null */
export function canRevokeApproval(p: Designated, uid: string, own: readonly Permission[]): ApprovalRole | null {
  const role = approvalRoleOf(p, uid);
  if (!role || !canViewProtocols(own) || isProtocolLocked(p) || p.secretaryUid === p.adjusterUid) return null;
  return approvedAtOf(p, role) !== null ? role : null;
}

// ---- Innehåll ----------------------------------------------------------------------

/** Jämför innehåll (t.ex. för att bara spara när något ändrats; varje sparning nollställer godkännandena) */
export function sameProtocolContent(a: ProtocolContent, b: ProtocolContent): boolean {
  const norm = (c: ProtocolContent) =>
    JSON.stringify({ ...c, meetingAt: c.meetingAt.getTime() });
  return norm(a) === norm(b);
}

/** Nytt stabilt id för en att göra-punkt (uppfyller TODO_ID_PATTERN) */
export function newTodoId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

/**
 * Gör att göra-punkternas id giltiga och unika (A–Z a–z 0-9 _ -, se TODO_ID_PATTERN): svenska tecken byts mot
 * motsvarande ASCII, övrigt tas bort, och dubbletter eller tomma id får ett nytt. Äldre eller importerade
 * protokoll kan ha id som reglerna skulle neka; här rättas de när protokollet läses, så att nästa sparning går igenom.
 */
export function uniqueTodoIds(ids: readonly string[]): string[] {
  const taken = new Set<string>();
  return ids.map((raw) => {
    let id = raw
      .replace(/[åäÅÄ]/g, 'a')
      .replace(/[öÖ]/g, 'o')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 64);
    if (!TODO_ID_PATTERN.test(id) || taken.has(id)) {
      const base = id.slice(0, 50) || 'punkt';
      id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
      if (!TODO_ID_PATTERN.test(id)) id = newTodoId();
    }
    taken.add(id);
    return id;
  });
}

const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const FENCE = /^ {0,3}(```|~~~)/;

/**
 * Mall ur ett tidigare protokoll: bara rubrikraderna (rader som börjar med #), utan innehåll, med en tom rad
 * emellan. Rader i kodblock räknas inte som rubriker.
 */
export function templateFromBody(body: string): string {
  const headings: string[] = [];
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && HEADING.test(line)) headings.push(line.trim());
  }
  return headings.length ? `${headings.join('\n\n')}\n` : '';
}

export const CARRY_OVER_HEADING = 'Punkter från föregående protokoll';

/**
 * Ej avbockade punkter från föregående protokoll, att lägga överst i det nya. Punkterna behåller sitt id
 * (samma uppgift, så att den senare kan följas mellan protokoll och lyftas ut till personliga listor).
 */
export function carryOverTodos(previous: readonly ProtocolTodo[]): ProtocolTodo[] {
  return previous.filter((t) => !t.done).map((t) => ({ ...t, done: false }));
}

/**
 * Valfri Markdown-sektion med de överförda punkterna, om UI:t vill visa dem i brödtexten också
 * (t.ex. under dagordningens "Föregående protokoll"). Ansvarig skrivs som omnämnande.
 */
export function carryOverSection(todos: readonly ProtocolTodo[]): string {
  if (!todos.length) return '';
  const lines = todos.map((t) => {
    const who = t.assigneeUid ? ` – ${formatMention(t.assigneeName, t.assigneeUid)}` : '';
    return `- ${t.text.replace(/\s*\n\s*/g, ' ')}${who}`;
  });
  return `## ${CARRY_OVER_HEADING}\n\n${lines.join('\n')}\n`;
}

/**
 * Innehåll för ett nytt protokoll. Med `previous` blir brödtexten mallen ur det (rubrikerna) och, om
 * `carryOver`, läggs dess ej avbockade punkter överst i att göra-listan. Sekreterare/justerare väljs per
 * protokoll och följer inte med.
 */
export function newProtocolContent(options: {
  meetingAt: Date;
  previous?: Pick<ProtocolContent, 'body' | 'todos' | 'location'> | null;
  carryOver?: boolean;
  attendees?: ProtocolAttendee[];
}): ProtocolContent {
  const { previous, meetingAt } = options;
  const carried = previous && options.carryOver ? carryOverTodos(previous.todos) : [];
  return {
    meetingAt,
    location: previous?.location ?? '',
    body: previous ? templateFromBody(previous.body) : '',
    attendees: (options.attendees ?? []).slice(0, MAX_ATTENDEES),
    todos: carried.slice(0, MAX_TODOS),
    secretaryUid: null,
    secretaryName: '',
    adjusterUid: null,
    adjusterName: '',
  };
}

/** Kopia av ett (låst) protokoll som nytt utkast, för rättelser. Godkännandena följer inte med. */
export function copyProtocolContent(p: ProtocolContent): ProtocolContent {
  return {
    ...p,
    attendees: p.attendees.map((a) => ({ ...a })),
    todos: p.todos.map((t) => ({ ...t })),
  };
}

/** Namn att spara som ögonblicksnamn för ett konto */
export function displayNameOf(u: { displayName?: string; email?: string }): string {
  return (u.displayName?.trim() || u.email?.trim() || 'Okänd').slice(0, MAX_PROTOCOL_NAME);
}

/**
 * Problem som reglerna skulle neka (eller som reglerna inte kan kontrollera, som dubbletter), på svenska.
 * Tom lista = kan sparas.
 */
export function validateProtocol(c: ProtocolContent): string[] {
  const problems: string[] = [];
  if (Number.isNaN(c.meetingAt.getTime())) problems.push('Mötesdatum saknas.');
  if (c.location.length > MAX_PROTOCOL_LOCATION) problems.push(`Platsen får vara högst ${MAX_PROTOCOL_LOCATION} tecken.`);
  if (c.body.length > MAX_PROTOCOL_BODY) problems.push(`Texten får vara högst ${MAX_PROTOCOL_BODY} tecken.`);

  if (c.attendees.length > MAX_ATTENDEES) problems.push(`Högst ${MAX_ATTENDEES} deltagare.`);
  const seen = new Set<string>();
  for (const a of c.attendees) {
    if (!PROTOCOL_UID_PATTERN.test(a.uid)) problems.push(`Deltagaren ${a.name || '(utan namn)'} saknar giltigt konto.`);
    if (seen.has(a.uid)) problems.push(`${a.name} står med två gånger bland deltagarna.`);
    seen.add(a.uid);
    if (a.name.length < 1 || a.name.length > MAX_PROTOCOL_NAME) problems.push(`Deltagarnamn ska vara 1–${MAX_PROTOCOL_NAME} tecken.`);
  }

  if (c.todos.length > MAX_TODOS) problems.push(`Högst ${MAX_TODOS} att göra-punkter.`);
  const ids = new Set<string>();
  for (const t of c.todos) {
    if (!TODO_ID_PATTERN.test(t.id) || ids.has(t.id)) problems.push('En att göra-punkt saknar unikt id.');
    ids.add(t.id);
    if (t.text.trim().length < 1) problems.push('En att göra-punkt saknar text.');
    if (t.text.length > MAX_TODO_TEXT) problems.push(`En att göra-punkt får vara högst ${MAX_TODO_TEXT} tecken.`);
    if (t.assigneeUid !== null && !PROTOCOL_UID_PATTERN.test(t.assigneeUid)) problems.push(`Ansvarig för "${t.text}" saknar giltigt konto.`);
    if (t.assigneeName.length > MAX_PROTOCOL_NAME) problems.push('Ansvarigs namn är för långt.');
  }

  for (const [label, uid, name] of [
    ['Sekreteraren', c.secretaryUid, c.secretaryName],
    ['Justeraren', c.adjusterUid, c.adjusterName],
  ] as const) {
    if (uid !== null && !PROTOCOL_UID_PATTERN.test(uid)) problems.push(`${label} saknar giltigt konto.`);
    if (name.length > MAX_PROTOCOL_NAME) problems.push(`${label}s namn är för långt.`);
  }
  if (c.secretaryUid !== null && c.secretaryUid === c.adjusterUid) {
    problems.push('Sekreterare och justerare måste vara olika personer.');
  }
  return problems;
}

// ---- Omnämnanden i brödtexten ------------------------------------------------------
// Syntax: @[Namn](mention:uid). Namnet är ögonblicksnamnet (utan [ ] och radbrytningar), uid som i reglerna.
// src/lib/markdown.ts renderar det redan säkert som texten "@Namn": mention: är inget tillåtet länkprotokoll,
// så länken blir vanlig text. Reglerna behandlar det som vanlig text (bara längden begränsas).

export interface Mention {
  uid: string;
  name: string;
  /** Position i texten och längd på hela `@[Namn](mention:uid)`, för editorn */
  index: number;
  length: number;
}

const MENTION_SOURCE = '@\\[([^\\[\\]\\r\\n]{1,200})\\]\\(mention:([A-Za-z0-9_-]{1,128})\\)';

/** Nytt RegExp varje gång (globala RegExp har tillstånd i lastIndex) */
export const mentionPattern = () => new RegExp(MENTION_SOURCE, 'g');

/** Skriv ett omnämnande. Namnet rensas från tecken som skulle bryta syntaxen. */
export function formatMention(name: string, uid: string): string {
  if (!PROTOCOL_UID_PATTERN.test(uid)) throw new Error(`Ogiltigt uid i omnämnande: ${uid}`);
  const clean = name.replace(/[[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_PROTOCOL_NAME) || 'Okänd';
  return `@[${clean}](mention:${uid})`;
}

/** Alla omnämnanden i textordning */
export function parseMentions(body: string): Mention[] {
  return Array.from(body.matchAll(mentionPattern()), (m) => ({
    name: m[1],
    uid: m[2],
    index: m.index ?? 0,
    length: m[0].length,
  }));
}

/** Omnämnda uid:n, unika, i ordningen de först förekommer */
export function mentionedUids(body: string): string[] {
  return [...new Set(parseMentions(body).map((m) => m.uid))];
}

/** Ersätt omnämnandena med "@Namn" (t.ex. för utdrag eller klartext) */
export function mentionsToText(body: string): string {
  return body.replace(mentionPattern(), (_, name: string) => `@${name}`);
}
