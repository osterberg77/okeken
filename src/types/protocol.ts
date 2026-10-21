// Styrelsens protokoll (beslut 0009). Internt: bara `board` och `superadmin` (canViewProtocols i ./user).
// Collectionen `protocols` läses aldrig av bygget. Gränserna nedan måste spegla firestore.rules.

/** Brödtextens maxlängd (Markdown) */
export const MAX_PROTOCOL_BODY = 50000;
/** Högst så många närvarande. Taket sätts av reglernas uttrycksgräns, se firestore.rules och ADR 0009 */
export const MAX_ATTENDEES = 10;
/** Högst så många att göra-punkter per protokoll (se MAX_ATTENDEES) */
export const MAX_TODOS = 8;
export const MAX_TODO_TEXT = 300;
/** Gäller ögonblicksnamn: deltagare (1–200), ansvarig, sekreterare och justerare (0–200) */
export const MAX_PROTOCOL_NAME = 200;
export const MAX_PROTOCOL_LOCATION = 200;

/** uid:n (deltagare, ansvarig, sekreterare, justerare): samma format som reglerna kräver */
export const PROTOCOL_UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
/** Att göra-punktens eget id */
export const TODO_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Närvarande deltagare, taggad mot ett konto (users/{uid}). Frånvarande noteras inte.
 * `name` är ögonblicksnamnet när protokollet skrevs, så att protokollet förblir läsbart om kontot ändras.
 */
export interface ProtocolAttendee {
  uid: string;
  /** 1–200 tecken */
  name: string;
}

/**
 * Att göra-punkt. `id` är stabilt och eget (inte listindex), så att punkten senare kan lyftas ut till
 * personliga att göra-listor utan omarbetning. Följer med (samma id) när den förs över till nästa protokoll.
 */
export interface ProtocolTodo {
  id: string;
  /** 1–300 tecken */
  text: string;
  /** Ansvarig (users/{uid}) eller null */
  assigneeUid: string | null;
  /** Ögonblicksnamn för ansvarig; tom sträng om ingen */
  assigneeName: string;
  done: boolean;
}

/** Det redigerbara innehållet. Varje ändring av något av detta nollställer båda godkännandena. */
export interface ProtocolContent {
  /** Mötets tid. Lagras som timestamp (UTC), visas i Europe/Stockholm */
  meetingAt: Date;
  /** 0–200 tecken, t.ex. "Klubbstugan" eller "Digitalt" */
  location: string;
  /** Markdown, högst 50 000 tecken. Omnämnanden skrivs `@[Namn](mention:uid)` (src/lib/protocol.ts) */
  body: string;
  /** Högst MAX_ATTENDEES */
  attendees: ProtocolAttendee[];
  /** Högst MAX_TODOS */
  todos: ProtocolTodo[];
  /** Sekreterare ("Vid protokollet"), null = inte utsedd än. Aldrig samma som justeraren */
  secretaryUid: string | null;
  /** Ögonblicksnamn, visas för signering längst ned; tom sträng om ingen */
  secretaryName: string;
  /** Justerare ("Justeras"), väljs per protokoll. null = inte utsedd än */
  adjusterUid: string | null;
  adjusterName: string;
}

export interface ProtocolRecord extends ProtocolContent {
  id: string;
  /** Servertid när sekreteraren godkände, annars null */
  secretaryApprovedAt: Date | null;
  /** Servertid när justeraren godkände, annars null. Båda satta = låst */
  adjusterApprovedAt: Date | null;
  createdBy: string;
  createdAt: Date | null;
  updatedBy: string;
  updatedAt: Date | null;
}

/**
 * Härledd status (lagras inte; reglerna läser godkännandefälten direkt):
 * - draft: inget godkännande, kan redigeras och raderas
 * - partly_approved: en av två har godkänt; kan redigeras (nollställer godkännandet) men inte raderas
 * - locked: båda har godkänt; ingen ändring eller radering
 */
export type ProtocolState = 'draft' | 'partly_approved' | 'locked';

export const PROTOCOL_STATE_LABELS: Record<ProtocolState, { short: string; long: string }> = {
  draft: { short: 'Utkast', long: 'UTKAST – ej godkänt' },
  partly_approved: { short: 'Godkänt av en', long: 'GODKÄNT AV EN AV TVÅ – väntar på den andra' },
  locked: { short: 'Låst', long: 'LÅST – godkänt av sekreterare och justerare' },
};

/** Vem som godkänner vilken del */
export type ApprovalRole = 'secretary' | 'adjuster';

export const APPROVAL_ROLE_LABELS: Record<ApprovalRole, string> = {
  secretary: 'Vid protokollet',
  adjuster: 'Justeras',
};
