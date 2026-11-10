import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { parseAmount } from '@/lib/parseNotification';
import { useStore } from '@/lib/store';

/**
 * Deep-link entry point.
 *   budgettracker://add                               -> open the keypad (Lock Screen widget)
 *   budgettracker://add?amount=33&merchant=Lidl       -> queue an expense for confirmation
 *                                                        (iOS Shortcuts automation, see README)
 */
export default function Add() {
  const { amount, merchant, currency } = useLocalSearchParams<{ amount?: string; merchant?: string; currency?: string }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const value = amount ? parseAmount(String(amount).replace(/[^\d.,]/g, '')) : NaN;
    if (Number.isFinite(value) && value > 0) {
      useStore.getState().addDetected({
        amount: value,
        currency: currency ? String(currency).toUpperCase() : null,
        merchant: merchant ? String(merchant) : '',
        source: 'shortcut',
      });
    }
    setDone(true);
  }, [amount, merchant, currency]);

  return done ? <Redirect href="/" /> : null;
}
