/**
 * Pushes the outbox to the spreadsheet. Safe to call as often as you like:
 * calls are coalesced, and re-sending after a dropped connection never duplicates rows
 * because we check which IDs the sheet already holds first.
 */
import { getAccessToken, signIn, signOut } from './auth';
import { SheetsError, appendExpenses, createSpreadsheet, deleteRows, findSpreadsheet, readIds } from './sheets';
import { useStore } from './store';
import type { Expense, Op } from './types';

/** Works out what to write given the queued ops and the IDs already in the sheet. */
export function planSync(ops: Op[], sheetIds: string[]): { toAppend: Expense[]; rowsToDelete: number[] } {
  const present = new Set(sheetIds);
  const deleted = new Set(ops.flatMap((op) => (op.kind === 'delete' ? [op.id] : [])));
  const toAppend = ops.flatMap((op) =>
    op.kind === 'append' && !present.has(op.expense.id) && !deleted.has(op.expense.id) ? [op.expense] : [],
  );
  const rowsToDelete = sheetIds.flatMap((id, i) => (deleted.has(id) ? [i] : []));
  return { toAppend, rowsToDelete };
}

let running: Promise<void> | null = null;
let again = false;

export function sync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = run().finally(() => {
    running = null;
    if (again) {
      again = false;
      void sync();
    }
  });
  return running;
}

async function run(): Promise<void> {
  const store = useStore.getState();
  if (!store.account || store.outbox.length === 0) return;
  store.setSync('syncing');
  try {
    const token = await getAccessToken();
    let sheet = useStore.getState().sheet;
    if (!sheet) {
      sheet = (await findSpreadsheet(token)) ?? (await createSpreadsheet(token, store.settings.currency));
      store.setConnection(store.account, sheet);
    }

    const ops = useStore.getState().outbox;
    let ids: string[];
    try {
      ids = await readIds(token, sheet.spreadsheetId);
    } catch (e) {
      // The user deleted the spreadsheet: forget it so the next sync makes a new one.
      if (e instanceof SheetsError && e.status === 404) store.setConnection(store.account, null);
      throw e;
    }
    const { toAppend, rowsToDelete } = planSync(ops, ids);
    await deleteRows(token, sheet.spreadsheetId, rowsToDelete);
    await appendExpenses(token, sheet.spreadsheetId, toAppend);
    store.completeOps(ops);
    store.setSync('idle');
  } catch (e) {
    store.setSync('error', e instanceof Error ? e.message : String(e));
  }
}

/** Signs in, finds or creates the spreadsheet, then syncs anything queued. */
export async function connect(): Promise<void> {
  const store = useStore.getState();
  const email = await signIn();
  if (!email) return;
  store.setSync('syncing');
  try {
    const token = await getAccessToken();
    const sheet = (await findSpreadsheet(token)) ?? (await createSpreadsheet(token, store.settings.currency));
    store.setConnection(email, sheet);
    store.setSync('idle');
  } catch (e) {
    store.setConnection(email, null);
    store.setSync('error', e instanceof Error ? e.message : String(e));
    return;
  }
  await sync();
}

export async function disconnect(): Promise<void> {
  await signOut().catch(() => {});
  const store = useStore.getState();
  store.setConnection(null, null);
  store.setSync('idle');
}
