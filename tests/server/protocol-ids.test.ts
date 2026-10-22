import { describe, expect, it } from 'vitest';
import { uniqueTodoIds } from '../../src/lib/protocol';
import { TODO_ID_PATTERN } from '../../src/types/protocol';

describe('uniqueTodoIds', () => {
  it('keeps valid, unique ids unchanged', () => {
    expect(uniqueTodoIds(['ekonomi-inriktning', 'ledskotsel', 'a_b-1'])).toEqual(['ekonomi-inriktning', 'ledskotsel', 'a_b-1']);
  });

  it('transliterates Swedish letters (the id that broke saving: nybörjare-träff)', () => {
    expect(uniqueTodoIds(['nybörjare-träff'])).toEqual(['nyborjare-traff']);
    expect(uniqueTodoIds(['åäö ÅÄÖ'])).toEqual(['aaoaao']);
  });

  it('makes duplicates and empty ids unique and valid', () => {
    const out = uniqueTodoIds(['x', 'x', '', '', 'x']);
    expect(new Set(out).size).toBe(5);
    for (const id of out) expect(TODO_ID_PATTERN.test(id)).toBe(true);
    expect(out[0]).toBe('x');
  });

  it('truncates long ids and strips other characters', () => {
    const [long, odd] = uniqueTodoIds(['x'.repeat(80), 'a b!c']);
    expect(long).toHaveLength(64);
    expect(odd).toBe('abc');
  });

  it('every result matches the pattern the rules require', () => {
    for (const id of uniqueTodoIds(['!!!', '   ', 'ü', '😀', 'ok', 'ok'])) expect(TODO_ID_PATTERN.test(id)).toBe(true);
  });
});
