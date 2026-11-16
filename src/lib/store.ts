import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_SETTINGS } from './defaults';
import { suggestCategory } from './parseNotification';
import type { Category, Detected, Expense, ExpenseSource, Op, Settings, SheetRef } from './types';

/** How many recent expenses stay on the phone (for Undo). The spreadsheet keeps everything. */
const RECENT_LIMIT = 100;

export type SyncStatus = 'idle' | 'syncing' | 'error';

type State = {
  settings: Settings;
  recent: Expense[];
  outbox: Op[];
  detected: Detected[];
  sheet: SheetRef | null;
  account: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  hydrated: boolean;
};

type Actions = {
  addExpense: (input: { amount: number; category: string; type: string; note?: string; source?: ExpenseSource }) => Expense;
  /** Removes the most recent expense, on the phone and (once synced) in the sheet. */
  undoLast: () => Expense | null;
  addDetected: (input: { amount: number; currency?: string | null; merchant?: string; source: ExpenseSource; at?: string }) => void;
  confirmDetected: (id: string, amount: number, category: string, type: string) => Expense | null;
  dismissDetected: (id: string) => void;
  /** Drops the given ops once they are safely in the sheet. */
  completeOps: (done: Op[]) => void;
  setCurrency: (currency: string) => void;
  addCategory: (category: Category) => void;
  removeCategory: (name: string) => void;
  addType: (name: string) => void;
  removeType: (name: string) => void;
  setDefaultType: (name: string) => void;
  setConnection: (account: string | null, sheet: SheetRef | null) => void;
  setSync: (status: SyncStatus, error?: string | null) => void;
};

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      recent: [],
      outbox: [],
      detected: [],
      sheet: null,
      account: null,
      syncStatus: 'idle',
      syncError: null,
      hydrated: false,

      addExpense: ({ amount, category, type, note = '', source = 'manual' }) => {
        const expense: Expense = {
          id: newId(),
          amount: Math.round(amount * 100) / 100,
          currency: get().settings.currency,
          category,
          type,
          note,
          source,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          recent: [expense, ...s.recent].slice(0, RECENT_LIMIT),
          outbox: [...s.outbox, { kind: 'append', expense }],
        }));
        return expense;
      },

      undoLast: () => {
        const [last, ...rest] = get().recent;
        if (!last) return null;
        set((s) => {
          // While a sync is in flight the row may already be on its way, so always queue a deletion then.
          const pending =
            s.syncStatus !== 'syncing' && s.outbox.some((op) => op.kind === 'append' && op.expense.id === last.id);
          return {
            recent: rest,
            // Not sent yet: just forget it. Already in the sheet: queue a row deletion.
            outbox: pending
              ? s.outbox.filter((op) => !(op.kind === 'append' && op.expense.id === last.id))
              : [...s.outbox, { kind: 'delete', id: last.id }],
          };
        });
        return last;
      },

      addDetected: ({ amount, currency, merchant = '', source, at }) => {
        const { settings } = get();
        const item: Detected = {
          id: newId(),
          amount,
          currency: currency || settings.currency,
          merchant,
          suggestedCategory: suggestCategory(
            merchant,
            settings.categories.map((c) => c.name),
            settings.merchantMap,
          ),
          source,
          receivedAt: at ?? new Date().toISOString(),
        };
        set((s) => ({ detected: [...s.detected, item] }));
      },

      confirmDetected: (id, amount, category, type) => {
        const item = get().detected.find((d) => d.id === id);
        if (!item) return null;
        const expense: Expense = {
          id: newId(),
          amount: Math.round(amount * 100) / 100,
          currency: item.currency,
          category,
          type,
          note: item.merchant,
          source: item.source,
          createdAt: item.receivedAt,
        };
        set((s) => ({
          detected: s.detected.filter((d) => d.id !== id),
          recent: [expense, ...s.recent].slice(0, RECENT_LIMIT),
          outbox: [...s.outbox, { kind: 'append', expense }],
          settings: item.merchant
            ? { ...s.settings, merchantMap: { ...s.settings.merchantMap, [item.merchant.toLowerCase()]: category } }
            : s.settings,
        }));
        return expense;
      },

      dismissDetected: (id) => set((s) => ({ detected: s.detected.filter((d) => d.id !== id) })),
      completeOps: (done) => set((s) => ({ outbox: s.outbox.filter((op) => !done.includes(op)) })),

      setCurrency: (currency) => set((s) => ({ settings: { ...s.settings, currency } })),
      addCategory: (category) =>
        set((s) =>
          s.settings.categories.some((c) => c.name.toLowerCase() === category.name.toLowerCase())
            ? s
            : { settings: { ...s.settings, categories: [...s.settings.categories, category] } },
        ),
      removeCategory: (name) =>
        set((s) => ({ settings: { ...s.settings, categories: s.settings.categories.filter((c) => c.name !== name) } })),
      addType: (name) =>
        set((s) =>
          s.settings.types.some((t) => t.toLowerCase() === name.toLowerCase())
            ? s
            : { settings: { ...s.settings, types: [...s.settings.types, name] } },
        ),
      removeType: (name) =>
        set((s) => {
          const types = s.settings.types.filter((t) => t !== name);
          if (types.length === 0) return s;
          const defaultType = s.settings.defaultType === name ? types[0] : s.settings.defaultType;
          return { settings: { ...s.settings, types, defaultType } };
        }),
      setDefaultType: (name) => set((s) => ({ settings: { ...s.settings, defaultType: name } })),

      setConnection: (account, sheet) => set({ account, sheet }),
      setSync: (syncStatus, syncError = null) => set({ syncStatus, syncError }),
    }),
    {
      name: 'budgettracker',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ settings, recent, outbox, detected, sheet, account }) => ({ settings, recent, outbox, detected, sheet, account }),
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);
