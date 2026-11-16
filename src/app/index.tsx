import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Keypad, pressKey } from '@/components/Keypad';
import { currencySymbol, formatMoney } from '@/lib/defaults';
import { useStore } from '@/lib/store';
import { sync } from '@/lib/sync';
import { colors } from '@/lib/theme';

const buzz = (kind: 'tap' | 'done' | 'warn') => {
  if (Platform.OS === 'web') return;
  if (kind === 'tap') void Haptics.selectionAsync();
  else void Haptics.notificationAsync(kind === 'done' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
};

export default function Home() {
  const settings = useStore((s) => s.settings);
  const last = useStore((s) => s.recent[0]);
  const detected = useStore((s) => s.detected[0]);
  const detectedCount = useStore((s) => s.detected.length);
  const pending = useStore((s) => s.outbox.length);
  const account = useStore((s) => s.account);
  const syncStatus = useStore((s) => s.syncStatus);

  const [amount, setAmount] = useState('');
  const [type, setType] = useState(settings.defaultType);
  const [flash, setFlash] = useState<string | null>(null);

  // A detected expense pre-fills the amount; the user only has to pick the category.
  useEffect(() => {
    if (detected) setAmount(String(detected.amount));
  }, [detected?.id]);

  useEffect(() => {
    if (!settings.types.includes(type)) setType(settings.defaultType);
  }, [settings.types, settings.defaultType, type]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const value = Number(amount);
  const ready = value > 0;
  const currency = detected?.currency ?? settings.currency;

  const save = (category: string) => {
    if (!ready) {
      buzz('warn');
      setFlash('Enter an amount first');
      return;
    }
    const store = useStore.getState();
    const expense = detected
      ? store.confirmDetected(detected.id, value, category, type)
      : store.addExpense({ amount: value, category, type });
    if (!expense) return;
    buzz('done');
    setAmount('');
    setType(settings.defaultType);
    setFlash(`✓ ${formatMoney(expense.amount, expense.currency)} · ${category}`);
    void sync();
  };

  const undo = () => {
    const removed = useStore.getState().undoLast();
    if (!removed) return;
    buzz('warn');
    setFlash(`Removed ${formatMoney(removed.amount, removed.currency)} · ${removed.category}`);
    void sync();
  };

  const dismiss = () => {
    if (!detected) return;
    useStore.getState().dismissDetected(detected.id);
    setAmount('');
  };

  const status = !account
    ? { color: colors.muted, label: pending ? `${pending} saved on phone` : 'Not connected' }
    : syncStatus === 'error'
      ? { color: colors.danger, label: `${pending} waiting · sync failed` }
      : pending
        ? { color: colors.warn, label: `Syncing ${pending}…` }
        : { color: colors.accent, label: 'Synced' };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: status.color }]} />
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12}>
            <Text style={styles.gear}>⚙︎</Text>
          </Pressable>
        </Link>
      </View>

      {detected && (
        <View style={styles.detected}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detectedTitle}>
              Detected{detected.merchant ? ` · ${detected.merchant}` : ''}
              {detectedCount > 1 ? `  (+${detectedCount - 1} more)` : ''}
            </Text>
            <Text style={styles.detectedHint}>Pick a category to add it</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Ignore detected expense" onPress={dismiss} hitSlop={12}>
            <Text style={styles.detectedDismiss}>Ignore</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.amountBox}>
        <Text style={[styles.amount, !amount && styles.amountEmpty]} numberOfLines={1} adjustsFontSizeToFit>
          {amount || '0'}
          <Text style={styles.currency}> {currencySymbol(currency)}</Text>
        </Text>
        <Text style={[styles.flash, !flash && { opacity: 0 }]}>{flash ?? ' '}</Text>
      </View>

      <View style={styles.types}>
        {settings.types.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{ selected: t === type }}
            onPress={() => {
              buzz('tap');
              setType(t);
            }}
            style={[styles.type, t === type && styles.typeOn]}>
            <Text style={[styles.typeText, t === type && styles.typeTextOn]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.categories} contentContainerStyle={styles.categoriesInner}>
        {settings.categories.map((c) => {
          const suggested = detected?.suggestedCategory === c.name;
          return (
            <View key={c.name} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Save as ${c.name}`}
                onPress={() => save(c.name)}
                style={({ pressed }) => [
                  styles.category,
                  !ready && styles.categoryIdle,
                  suggested && styles.categorySuggested,
                  pressed && styles.categoryPressed,
                ]}>
                <Text style={styles.emoji}>{c.emoji}</Text>
                <Text style={styles.categoryText} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Keypad
        onKey={(key) => {
          buzz('tap');
          setAmount((a) => pressKey(a, key));
        }}
      />

      <Pressable
        accessibilityRole="button"
        disabled={!last}
        onPress={undo}
        style={({ pressed }) => [styles.undo, !last && { opacity: 0.35 }, pressed && { backgroundColor: colors.surfaceHi }]}>
        <Text style={styles.undoText} numberOfLines={1}>
          {last ? `↩︎  Undo  ${formatMoney(last.amount, last.currency)} · ${last.category}` : '↩︎  Undo'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, width: '100%', maxWidth: 520, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: colors.muted, fontSize: 13 },
  gear: { color: colors.muted, fontSize: 24 },

  detected: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  detectedTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  detectedHint: { color: colors.muted, fontSize: 13, marginTop: 2 },
  detectedDismiss: { color: colors.muted, fontSize: 14, fontWeight: '600', paddingLeft: 12 },

  amountBox: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 4 },
  amount: { color: colors.text, fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'] },
  amountEmpty: { color: colors.border },
  currency: { color: colors.muted, fontSize: 28, fontWeight: '500' },
  flash: { color: colors.accent, fontSize: 14, fontWeight: '600', height: 20 },

  types: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  type: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface },
  typeOn: { backgroundColor: colors.accent },
  typeText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  typeTextOn: { color: colors.accentInk },

  categories: { flex: 1, marginTop: 10 },
  categoriesInner: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  cell: { width: '25%', padding: 4 },
  category: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryIdle: { opacity: 0.55 },
  categorySuggested: { borderColor: colors.accent, backgroundColor: colors.surfaceHi },
  categoryPressed: { backgroundColor: colors.accent },
  emoji: { fontSize: 24 },
  categoryText: { color: colors.text, fontSize: 11, marginTop: 4, paddingHorizontal: 4 },

  undo: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  undoText: { color: colors.text, fontSize: 15, fontWeight: '600', paddingHorizontal: 12 },
});
