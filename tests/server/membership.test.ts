import { describe, expect, it } from 'vitest';
import { calculate as serverCalc, newReference, parseRequest, InvalidMembershipRequest } from '../../functions/src/membership';
import { calculate, swishDeepLink, swishMessage, swishQrValue } from '../../src/lib/membership';

const categories = [
  { id: 'adult', label: 'Vuxen', amount: 300, hint: '' },
  { id: 'youth', label: 'Ungdom', amount: 150, hint: '' },
];
const family = { amount: 600, minPeople: 3 };

describe('calculate', () => {
  it('summerar per person', () => expect(calculate(categories, null, ['adult', 'youth']).amount).toBe(450));
  it('familjetak slår till från minPeople när det blir billigare', () => {
    const r = calculate(categories, family, ['adult', 'adult', 'youth']);
    expect(r).toEqual({ amount: 600, full: 750, familyApplied: true });
  });
  it('familjetak gäller inte under minPeople eller när det inte är billigare', () => {
    expect(calculate(categories, family, ['adult', 'adult']).amount).toBe(600);
    expect(calculate(categories, family, ['adult', 'adult']).familyApplied).toBe(false);
    expect(calculate(categories, family, ['youth', 'youth', 'youth']).amount).toBe(450);
  });
  it('klient och server räknar lika', () => {
    for (const ids of [['adult'], ['adult', 'youth'], ['adult', 'adult', 'youth'], ['youth', 'youth', 'youth', 'youth']]) {
      expect(serverCalc(categories, family, ids)).toEqual(calculate(categories, family, ids));
    }
  });
});

describe('Swish', () => {
  it('QR-strängen följer specen', () => expect(swishQrValue('123 785 69 01', 450, 'OK Eken OKE-A7K2')).toBe('C1237856901;450;OK Eken OKE-A7K2;0'));
  it('länken bär belopp, mottagare och meddelande', () => {
    const link = swishDeepLink('1237856901', 450, 'hej');
    const data = JSON.parse(decodeURIComponent(link.replace('swish://payment?data=', '')));
    expect(data).toEqual({ version: 1, payee: { value: '1237856901' }, amount: { value: 450 }, message: { value: 'hej' } });
  });
  it('meddelandet ryms i Swishs 50 tecken och innehåller referensen', () => {
    const m = swishMessage(2026, 'OKE-A7K2');
    expect(m.length).toBeLessThanOrEqual(50);
    expect(m).toContain('OKE-A7K2');
  });
});

describe('parseRequest', () => {
  const ok = { year: 2026, payerName: ' Anna ', payerEmail: 'a@b.se', people: [{ name: 'Anna', categoryId: 'adult' }] };
  it('rensar och godtar giltig indata', () => expect(parseRequest(ok).payerName).toBe('Anna'));
  it('nekar saknat namn, dålig e-post, tom eller för stor lista', () => {
    expect(() => parseRequest({ ...ok, payerName: '' })).toThrow(InvalidMembershipRequest);
    expect(() => parseRequest({ ...ok, payerEmail: 'inte-en-adress' })).toThrow(InvalidMembershipRequest);
    expect(() => parseRequest({ ...ok, people: [] })).toThrow(InvalidMembershipRequest);
    expect(() => parseRequest({ ...ok, people: Array(13).fill(ok.people[0]) })).toThrow(InvalidMembershipRequest);
    expect(() => parseRequest({ ...ok, year: '2026' })).toThrow(InvalidMembershipRequest);
  });
  it('referensen har rätt form', () => expect(newReference()).toMatch(/^OKE-[A-Z2-9]{4}$/));
});
