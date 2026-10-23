import { describe, expect, it } from 'vitest';
import { noticeRecipients, notifyTooltip, permissionNotice } from '../../src/lib/notify';

describe('notify', () => {
  it('mottagare: unika, utan avsändaren och utan tomma värden', () => {
    expect(noticeRecipients({ recipients: ['a', 'b', 'a', 'me', null, undefined, ''] }, 'me')).toEqual(['a', 'b']);
    expect(noticeRecipients({ recipients: [] }, 'me')).toEqual([]);
  });
  it('tooltipen säger vad som händer', () => {
    expect(notifyTooltip(true, 'Anna får veta.')).toMatch(/^Skickar meddelande: Anna får veta\./);
    expect(notifyTooltip(false, 'Anna får veta.')).toMatch(/^Skickar inget meddelande/);
  });
  it('behörighetsmeddelanden', () => {
    expect(permissionNotice(null, 'member')).toBe('Du är nu godkänd som medlem i OK Eken. Välkommen!');
    expect(permissionNotice(null, 'board')).toBe('Du har fått behörigheten Styrelse i OK Eken.');
    expect(permissionNotice('member', 'publisher')).toBe('Din behörighet i OK Eken har ändrats till Publicerare.');
    expect(permissionNotice('board', null)).toBe('Din behörighet i OK Eken har tagits bort.');
  });
});
