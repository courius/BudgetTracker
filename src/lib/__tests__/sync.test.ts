import { pressKey } from '../../components/Keypad';
import { expenseToRow, formattingRequests, summaryValues } from '../sheetLayout';
import { planSync } from '../sync';
import type { Expense, Op } from '../types';

jest.mock('../auth', () => ({ getAccessToken: jest.fn(), signIn: jest.fn(), signOut: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const expense = (id: string): Expense => ({
  id,
  amount: 12.5,
  currency: 'EUR',
  category: 'Groceries',
  type: 'Need',
  note: '',
  source: 'manual',
  createdAt: new Date(2026, 10, 10, 9, 5).toISOString(),
});
const append = (id: string): Op => ({ kind: 'append', expense: expense(id) });

describe('planSync', () => {
  it('appends new expenses', () => {
    expect(planSync([append('a'), append('b')], []).toAppend.map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('does not duplicate rows already in the sheet after a retry', () => {
    expect(planSync([append('a'), append('b')], ['a']).toAppend.map((e) => e.id)).toEqual(['b']);
  });
  it('deletes the row of an undone expense', () => {
    expect(planSync([{ kind: 'delete', id: 'b' }], ['a', 'b', 'c'])).toEqual({ toAppend: [], rowsToDelete: [1] });
  });
  it('drops an expense that was added and undone before syncing', () => {
    expect(planSync([append('a'), { kind: 'delete', id: 'a' }], [])).toEqual({ toAppend: [], rowsToDelete: [] });
  });
});

describe('sheet layout', () => {
  it('writes one row per expense in local time', () => {
    expect(expenseToRow(expense('x'))).toEqual(['2026-11-10', '09:05', 12.5, 'EUR', 'Groceries', 'Need', '', 'manual', 'x']);
  });
  it('builds balanced formulas', () => {
    const formulas = summaryValues('EUR')
      .flatMap((d) => d.values.flat())
      .filter((v) => v.startsWith('='));
    expect(formulas.length).toBeGreaterThan(500);
    for (const f of formulas) {
      expect(f.split('(').length).toBe(f.split(')').length);
      expect(f.split('"').length % 2).toBe(1);
    }
  });
  it('produces serialisable formatting requests', () => {
    expect(() => JSON.stringify(formattingRequests())).not.toThrow();
  });
});

describe('pressKey', () => {
  const type = (keys: string) => keys.split('').reduce(pressKey, '');
  it('builds amounts', () => expect(type('12.5')).toBe('12.5'));
  it('caps at two decimals', () => expect(type('1.2345')).toBe('1.23'));
  it('allows one decimal point', () => expect(type('1..2')).toBe('1.2'));
  it('starts decimals with a zero', () => expect(type('.5')).toBe('0.5'));
  it('deletes', () => expect(type('12⌫')).toBe('1'));
});
