import { parseAmount, parseNotification, suggestCategory } from '../parseNotification';

describe('parseAmount', () => {
  it.each([
    ['33', 33],
    ['33,5', 33.5],
    ['12.50', 12.5],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1 234,56', 1234.56],
    ['1.234', 1234],
  ])('%s -> %d', (raw, expected) => expect(parseAmount(raw)).toBe(expected));
});

describe('parseNotification', () => {
  it.each([
    ['Revolut', 'You spent €33 at Lidl', 33, 'EUR', 'Lidl'],
    ['BBVA', 'Compra de 12,50 EUR en MERCADONA con tu tarjeta *1234', 12.5, 'EUR', 'MERCADONA'],
    ['N26', '33,00 € spent at Lidl.', 33, 'EUR', 'Lidl'],
    ['Monzo', '£4.20 at Pret A Manger', 4.2, 'GBP', 'Pret A Manger'],
    ['Wallet', 'Starbucks: $5.75 paid with Visa', 5.75, 'USD', 'Starbucks'],
    ['Bank', 'Payment of 1.250,00 EUR to Landlord SL', 1250, 'EUR', 'Landlord SL'],
  ])('%s: %s', (title, text, amount, currency, merchant) => {
    expect(parseNotification(title, text)).toEqual({ amount, currency, merchant });
  });

  it.each([
    ['Revolut', 'You received €50 from Ana'],
    ['Bank', 'Refund of 12,00 € from Amazon'],
    ['BBVA', 'Has recibido una transferencia de 100 EUR'],
    ['Chat', 'See you at 8'],
  ])('ignores %s: %s', (title, text) => expect(parseNotification(title, text)).toBeNull());
});

describe('suggestCategory', () => {
  const cats = ['Groceries', 'Transport', 'Other'];
  it('guesses from keywords', () => expect(suggestCategory('LIDL 0123 Madrid', cats, {})).toBe('Groceries'));
  it('prefers what the user chose before', () => expect(suggestCategory('Lidl', cats, { lidl: 'Other' })).toBe('Other'));
  it('ignores categories the user removed', () => expect(suggestCategory('Netflix', cats, {})).toBeNull());
});
