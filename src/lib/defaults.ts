import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  currency: 'EUR',
  categories: [
    { name: 'Groceries', emoji: '🛒' },
    { name: 'Eating out', emoji: '🍽️' },
    { name: 'Transport', emoji: '🚌' },
    { name: 'Home', emoji: '🏠' },
    { name: 'Shopping', emoji: '🛍️' },
    { name: 'Health', emoji: '💊' },
    { name: 'Fun', emoji: '🎉' },
    { name: 'Subscriptions', emoji: '🔁' },
    { name: 'Travel', emoji: '✈️' },
    { name: 'Other', emoji: '🏷️' },
  ],
  types: ['Need', 'Want', 'One-off'],
  defaultType: 'Need',
  merchantMap: {},
};

export const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'RON', 'PLN', 'SEK', 'MDL', 'JPY', 'CAD', 'AUD'];

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF', RON: 'lei', PLN: 'zł' };

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code;
}

export function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currencySymbol(currency)}`;
}
