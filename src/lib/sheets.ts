/** Thin Google Sheets / Drive REST client. Takes an access token; knows nothing about the app state. */
import {
  ID_COLUMN,
  SHEET_TITLE,
  TX,
  TX_SHEET_ID,
  createSpreadsheetBody,
  expenseToRow,
  formattingRequests,
  summaryValues,
} from './sheetLayout';
import type { Expense, SheetRef } from './types';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';

export class SheetsError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(token: string, url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    let message = `Google API error ${res.status}`;
    try {
      const json = await res.json();
      if (json?.error?.message) message = json.error.message;
    } catch {}
    throw new SheetsError(res.status, message);
  }
  return res.json() as Promise<T>;
}

const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

/** Finds the spreadsheet this app created earlier (e.g. before a reinstall), if it still exists. */
export async function findSpreadsheet(token: string): Promise<SheetRef | null> {
  const q = `name = '${SHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const res = await call<{ files?: { id: string }[] }>(
    token,
    `${DRIVE}?q=${encodeURIComponent(q)}&orderBy=createdTime&fields=files(id)`,
  );
  const id = res.files?.[0]?.id;
  return id ? { spreadsheetId: id, url: sheetUrl(id) } : null;
}

export async function createSpreadsheet(token: string, currency: string): Promise<SheetRef> {
  const created = await call<{ spreadsheetId: string }>(token, SHEETS, { method: 'POST', body: createSpreadsheetBody() });
  const id = created.spreadsheetId;
  await call(token, `${SHEETS}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: { valueInputOption: 'USER_ENTERED', data: summaryValues(currency) },
  });
  await call(token, `${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: { requests: formattingRequests() } });
  return { spreadsheetId: id, url: sheetUrl(id) };
}

/** IDs currently in the sheet, in row order (index 0 = sheet row 2). */
export async function readIds(token: string, spreadsheetId: string): Promise<string[]> {
  const range = encodeURIComponent(`${TX}!${ID_COLUMN}2:${ID_COLUMN}`);
  const res = await call<{ values?: string[][] }>(token, `${SHEETS}/${spreadsheetId}/values/${range}`);
  return (res.values ?? []).map((r) => r[0] ?? '');
}

export async function appendExpenses(token: string, spreadsheetId: string, expenses: Expense[]): Promise<void> {
  if (expenses.length === 0) return;
  const range = encodeURIComponent(`${TX}!A:${ID_COLUMN}`);
  await call(
    token,
    `${SHEETS}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: { values: expenses.map(expenseToRow) } },
  );
}

/** Deletes sheet rows by zero-based index into the data rows (as returned by readIds). */
export async function deleteRows(token: string, spreadsheetId: string, dataRowIndexes: number[]): Promise<void> {
  if (dataRowIndexes.length === 0) return;
  // Bottom-up so earlier deletions do not shift later ones.
  const requests = [...dataRowIndexes]
    .sort((a, b) => b - a)
    .map((i) => ({
      deleteDimension: { range: { sheetId: TX_SHEET_ID, dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 } },
    }));
  await call(token, `${SHEETS}/${spreadsheetId}:batchUpdate`, { method: 'POST', body: { requests } });
}
