/**
 * Extracts a spend from the text of a bank / wallet notification,
 * e.g. "You spent 33,00 € at Lidl" -> { amount: 33, currency: 'EUR', merchant: 'Lidl' }.
 * Returns null when the text does not look like money leaving the account.
 */
export type ParsedSpend = { amount: number; currency: string | null; merchant: string };

const SYMBOL_TO_CODE: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', '¥': 'JPY' };
const CODES = 'EUR|USD|GBP|CHF|RON|PLN|SEK|NOK|DKK|CZK|HUF|MDL|JPY|CAD|AUD|BGN|TRY|UAH';
const NUM = String.raw`\d{1,3}(?:[ ., ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

const AMOUNT_RE = new RegExp(
  String.raw`(?:(?<pre>[€$£¥]|\b(?:${CODES})\b)\s?(?<n1>${NUM}))|(?:(?<n2>${NUM})\s?(?<post>[€$£¥]|(?:${CODES})\b))`,
  'i',
);

// Money coming in, or not a purchase at all.
const INCOMING_RE =
  /\b(received|refund(ed)?|cashback|deposit(ed)?|salary|credited|incoming|recibido|recibiste|reembolso|devoluci[oó]n|ingreso|abono|n[oó]mina|re[cç]u|remboursement|erhalten|gutschrift|primit|[iî]ncasat)\b/i;

const MERCHANT_RES = [
  /\b(?:at|en|in|chez|bei|la|to|a)\s+(?<m>[^.,;:!?\n]{2,40})/i,
  /^(?<m>[^.,;:!?\n€$£¥\d]{2,40}?)\s*[:\-–]\s/,
];

export function parseAmount(raw: string): number {
  let s = raw.replace(/[  ]/g, '');
  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (lastSep >= 0) {
    const decimals = s.length - lastSep - 1;
    const sepCount = (s.match(/[.,]/g) ?? []).length;
    // "1.234" / "1,234" with a single separator and 3 trailing digits is a thousands separator.
    const isDecimal = decimals <= 2 && !(decimals === 3 && sepCount === 1);
    if (isDecimal) {
      s = s.slice(0, lastSep).replace(/[.,]/g, '') + '.' + s.slice(lastSep + 1);
    } else {
      s = s.replace(/[.,]/g, '');
    }
  }
  return Number(s);
}

export function parseNotification(title: string, text: string): ParsedSpend | null {
  const full = `${title}. ${text}`.trim();
  if (INCOMING_RE.test(full)) return null;

  const m = AMOUNT_RE.exec(full);
  if (!m?.groups) return null;
  const amount = parseAmount(m.groups.n1 ?? m.groups.n2);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const cur = (m.groups.pre ?? m.groups.post).toUpperCase();
  const currency = SYMBOL_TO_CODE[cur] ?? cur;

  // Look for the merchant in the text that follows the amount first, then anywhere.
  const after = full.slice(m.index + m[0].length);
  let merchant = '';
  for (const source of [after, text, title]) {
    for (const re of MERCHANT_RES) {
      const mm = re.exec(source);
      const candidate = mm?.groups?.m?.trim();
      if (candidate && !AMOUNT_RE.test(candidate)) {
        merchant = candidate;
        break;
      }
    }
    if (merchant) break;
  }
  merchant = merchant.replace(/\s+(with|con|using|on|el|le|am)\s+.*$/i, '').trim();

  return { amount, currency, merchant };
}

const KEYWORDS: [RegExp, string][] = [
  [/lidl|aldi|mercadona|carrefour|tesco|kaufland|auchan|rewe|edeka|dia\b|consum|eroski|supermar|grocery|market/i, 'Groceries'],
  [/uber(?! ?eats)|bolt|cabify|taxi|renfe|metro|shell|repsol|\bbp\b|cepsa|parking|ryanair|vueling|easyjet|trainline/i, 'Transport'],
  [/restaurant|caf[eé]|coffee|starbucks|mcdonald|burger|pizza|kfc|glovo|deliveroo|just ?eat|uber ?eats|bar\b|bakery/i, 'Eating out'],
  [/netflix|spotify|disney|hbo|youtube|icloud|apple\.com|google one|prime video/i, 'Subscriptions'],
  [/pharma|farmacia|apotheke|clinic|dental|doctor|hospital/i, 'Health'],
  [/amazon|zara|h&m|ikea|decathlon|primark|aliexpress|mediamarkt|fnac/i, 'Shopping'],
  [/cinema|cine\b|steam|playstation|ticketmaster|museum|theat/i, 'Fun'],
  [/booking\.com|airbnb|hotel|hostel/i, 'Travel'],
];

/** Picks a category for a merchant: what the user chose before wins, then keyword guesses. */
export function suggestCategory(
  merchant: string,
  available: string[],
  learned: Record<string, string>,
): string | null {
  const key = merchant.trim().toLowerCase();
  if (!key) return null;
  const remembered = learned[key];
  if (remembered && available.includes(remembered)) return remembered;
  for (const [re, category] of KEYWORDS) {
    if (re.test(key) && available.includes(category)) return category;
  }
  return null;
}
