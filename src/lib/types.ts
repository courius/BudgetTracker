export type ExpenseSource = 'manual' | 'notification' | 'shortcut';

export type Expense = {
  id: string;
  amount: number;
  currency: string;
  category: string;
  type: string;
  note: string;
  source: ExpenseSource;
  /** ISO timestamp of when the expense happened. */
  createdAt: string;
};

/** An expense spotted in a bank notification or sent by a Shortcut, awaiting confirmation. */
export type Detected = {
  id: string;
  amount: number;
  currency: string;
  merchant: string;
  suggestedCategory: string | null;
  source: ExpenseSource;
  receivedAt: string;
};

/** A change waiting to be written to the spreadsheet. */
export type Op = { kind: 'append'; expense: Expense } | { kind: 'delete'; id: string };

export type Category = { name: string; emoji: string };

export type Settings = {
  currency: string;
  categories: Category[];
  types: string[];
  defaultType: string;
  /** Lower-cased merchant -> category, learned from confirmed detections. */
  merchantMap: Record<string, string>;
};

export type SheetRef = { spreadsheetId: string; url: string };
