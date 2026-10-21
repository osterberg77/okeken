import { describe, expect, it } from 'vitest';
import {
  canApprove,
  canDeleteProtocol,
  canEditProtocol,
  canRevokeApproval,
  carryOverTodos,
  formatMention,
  mentionedUids,
  mentionsToText,
  newProtocolContent,
  parseMentions,
  protocolState,
  templateFromBody,
  validateProtocol,
} from '../../src/lib/protocol';
import { renderMarkdown } from '../../src/lib/markdown';
import type { ProtocolTodo } from '../../src/types/protocol';

const T = new Date('2026-10-20T17:00:00Z');
const base = { secretaryUid: 'sec', adjusterUid: 'adj', secretaryApprovedAt: null, adjusterApprovedAt: null };

describe('status och behörighet', () => {
  it('härleder status', () => {
    expect(protocolState(base)).toBe('draft');
    expect(protocolState({ ...base, secretaryApprovedAt: T })).toBe('partly_approved');
    expect(protocolState({ ...base, secretaryApprovedAt: T, adjusterApprovedAt: T })).toBe('locked');
  });
  it('redigera/radera', () => {
    expect(canEditProtocol(base, ['board'])).toBe(true);
    expect(canEditProtocol(base, ['publisher'])).toBe(false);
    expect(canEditProtocol({ ...base, secretaryApprovedAt: T, adjusterApprovedAt: T }, ['superadmin'])).toBe(false);
    expect(canDeleteProtocol(base, ['board'])).toBe(true);
    expect(canDeleteProtocol({ ...base, adjusterApprovedAt: T }, ['board'])).toBe(false);
  });
  it('godkänna och dra tillbaka bara sin egen del', () => {
    expect(canApprove(base, 'sec', ['board'])).toBe('secretary');
    expect(canApprove(base, 'adj', ['board'])).toBe('adjuster');
    expect(canApprove(base, 'other', ['superadmin'])).toBeNull();
    expect(canApprove(base, 'sec', ['member'])).toBeNull();
    expect(canApprove({ ...base, secretaryApprovedAt: T }, 'sec', ['board'])).toBeNull();
    expect(canRevokeApproval({ ...base, secretaryApprovedAt: T }, 'sec', ['board'])).toBe('secretary');
    expect(canRevokeApproval({ ...base, secretaryApprovedAt: T, adjusterApprovedAt: T }, 'sec', ['board'])).toBeNull();
    expect(canApprove({ ...base, adjusterUid: 'sec' }, 'sec', ['board'])).toBeNull();
  });
});

describe('mall och överföring', () => {
  it('behåller bara rubrikerna, inte rubriker i kodblock', () => {
    const body = '# 1 Mötets öppnande\nText\n\n## 11a Tävlingar\n- punkt\n#hashtag\n```\n# kod\n```\n   ### Indragen';
    expect(templateFromBody(body)).toBe('# 1 Mötets öppnande\n\n## 11a Tävlingar\n\n### Indragen\n');
    expect(templateFromBody('ingen rubrik')).toBe('');
  });
  it('för över ej avbockade punkter med samma id', () => {
    const todos: ProtocolTodo[] = [
      { id: 'a', text: 'Kvar', assigneeUid: 'u', assigneeName: 'U', done: false },
      { id: 'b', text: 'Klar', assigneeUid: null, assigneeName: '', done: true },
    ];
    expect(carryOverTodos(todos)).toEqual([todos[0]]);
    const c = newProtocolContent({ meetingAt: T, previous: { body: '# A\nx', todos, location: 'Stugan' }, carryOver: true });
    expect(c.body).toBe('# A\n');
    expect(c.todos.map((t) => t.id)).toEqual(['a']);
    expect(c.secretaryUid).toBeNull();
  });
});

describe('omnämnanden', () => {
  it('skriver, tolkar och listar', () => {
    const m = formatMention('Anna [A] Svensson\n', 'uid1');
    expect(m).toBe('@[Anna A Svensson](mention:uid1)');
    const body = `Hej ${m} och @[Bo](mention:uid2), igen ${m}. @[X](mention:a/b) är inte giltigt.`;
    expect(parseMentions(body).map((x) => x.uid)).toEqual(['uid1', 'uid2', 'uid1']);
    expect(mentionedUids(body)).toEqual(['uid1', 'uid2']);
    expect(mentionsToText('@[Bo](mention:uid2)!')).toBe('@Bo!');
    expect(() => formatMention('X', 'a/b')).toThrow();
  });
  it('renderas som ren text av markdown.ts (ingen länk)', () => {
    expect(renderMarkdown('@[Bo](mention:uid2)')).toBe('<p>@Bo</p>\n');
  });
});

describe('validering', () => {
  const ok = newProtocolContent({ meetingAt: T });
  it('tomt utkast är giltigt', () => {
    expect(validateProtocol(ok)).toEqual([]);
  });
  it('fångar dubbletter och samma sekreterare/justerare', () => {
    const problems = validateProtocol({
      ...ok,
      attendees: [{ uid: 'a', name: 'A' }, { uid: 'a', name: 'A' }],
      secretaryUid: 'a',
      adjusterUid: 'a',
    });
    expect(problems.length).toBe(2);
  });
});
