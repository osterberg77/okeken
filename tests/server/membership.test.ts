import { describe, expect, it } from 'vitest';
import { calculate as serverCalc, newReference, parseRequest, InvalidMembershipRequest } from '../../functions/src/membership';
import { calculate, defaultFees, swishDeepLink, swishMessage, swishQrValue } from '../../src/lib/membership';

const categories = [
  { id: 'adult', label: 'Vuxen', amount: 200, hint: '', adult: true },
  { id: 'youth', label: 'Ungdom', amount: 100, hint: '' },
];
const family = { amount: 450, minPeople: 3, maxAdults: 2 };

describe('calculate (klubbens regler: vuxen 200, ungdom 100, familj 450)', () => {
  it('summerar per person', () => expect(calculate(categories, null, ['adult', 'youth']).amount).toBe(300));
  it('familjetak: 2 vuxna + barn blir 450 i stället för mer', () => {
    expect(calculate(categories, family, ['adult', 'adult', 'youth'])).toEqual({ amount: 450, full: 500, familyApplied: true });
    expect(calculate(categories, family, ['adult', 'adult', 'youth', 'youth', 'youth']).amount).toBe(450);
  });
  it('1 vuxen + ungdomar och 2 vuxna utan barn blir aldrig dyrare än taket men slås inte upp i onödan', () => {
    expect(calculate(categories, family, ['adult', 'youth', 'youth']).amount).toBe(400);
    expect(calculate(categories, family, ['adult', 'adult']).amount).toBe(400);
    expect(calculate(categories, family, ['youth', 'youth', 'youth']).amount).toBe(300);
  });
  it('tre vuxna är inte en familj', () => {
    expect(calculate(categories, family, ['adult', 'adult', 'adult']).amount).toBe(600);
    expect(calculate(categories, family, ['adult', 'adult', 'adult', 'youth']).familyApplied).toBe(false);
  });
  it('klient och server räknar lika', () => {
    for (const ids of [['adult'], ['adult', 'youth'], ['adult', 'adult', 'youth'], ['adult', 'adult', 'adult', 'youth'], ['youth', 'youth', 'youth', 'youth']]) {
      expect(serverCalc(categories, family, ids)).toEqual(calculate(categories, family, ids));
    }
  });
  it('förvalda avgifter följer reglerna', () => {
    const d = defaultFees(2027);
    expect(calculate(d.categories, d.family, ['adult', 'adult', 'youth', 'youth']).amount).toBe(450);
  });
});

describe('Swish', () => {
  it('QR-strängen följer specen', () => expect(swishQrValue('123 785 69 01', 450, 'OK Eken OKE-A7K2')).toBe('C1237856901;450;OK Eken OKE-A7K2;2'));
  it('länken bär belopp, mottagare och meddelande', () => {
    const link = swishDeepLink('1237856901', 450, 'hej');
    const data = JSON.parse(decodeURIComponent(link.replace('swish://payment?data=', '')));
    expect(data).toEqual({ version: 1, payee: { value: '1237856901' }, amount: { value: 450, editable: true }, message: { value: 'hej' } });
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
