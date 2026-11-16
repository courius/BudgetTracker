import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { authAvailable } from '@/lib/auth';
import { detectionSupported, enableDetection, isDetectionEnabled } from '@/lib/bankNotifications';
import { COMMON_CURRENCIES } from '@/lib/defaults';
import { useStore } from '@/lib/store';
import { connect, disconnect, sync } from '@/lib/sync';
import { colors } from '@/lib/theme';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

function Button({ label, onPress, quiet }: { label: string; onPress: () => void; quiet?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, quiet && styles.buttonQuiet]}>
      <Text style={[styles.buttonText, quiet && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, selected, onPress, onRemove }: { label: string; selected?: boolean; onPress?: () => void; onRemove?: () => void }) {
  return (
    <View style={[styles.chip, selected && styles.chipOn]}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} disabled={!onPress}>
        <Text style={[styles.chipText, selected && { color: colors.accentInk }]}>{label}</Text>
      </Pressable>
      {onRemove && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} onPress={onRemove} hitSlop={8}>
          <Text style={[styles.chipRemove, selected && { color: colors.accentInk }]}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const s = useStore();
  const [category, setCategory] = useState('');
  const [emoji, setEmoji] = useState('');
  const [type, setType] = useState('');
  const [currency, setCurrency] = useState('');
  const [detecting, setDetecting] = useState(isDetectionEnabled());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-check after the user returns from the system notification-access screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', () => setDetecting(isDetectionEnabled()));
    return () => sub.remove();
  }, []);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addCategory = () => {
    const name = category.trim();
    if (!name) return;
    s.addCategory({ name, emoji: emoji.trim() || '🏷️' });
    setCategory('');
    setEmoji('');
  };
  const addType = () => {
    if (!type.trim()) return;
    s.addType(type.trim());
    setType('');
  };
  const addCurrency = () => {
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return;
    s.setCurrency(code);
    setCurrency('');
  };

  const currencies = COMMON_CURRENCIES.includes(s.settings.currency) ? COMMON_CURRENCIES : [s.settings.currency, ...COMMON_CURRENCIES];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
      <Section
        title="Spreadsheet"
        hint={
          s.account
            ? `Connected as ${s.account}. Every expense is written to "BudgetTracker Expenses" in your Google Drive.`
            : 'Connect Google to keep a spreadsheet of your expenses in your own Drive. The app can only see the one file it creates.'
        }>
        {s.account ? (
          <View style={styles.row}>
            {s.sheet && <Button label="Open spreadsheet" onPress={() => void Linking.openURL(s.sheet!.url)} />}
            <Button label={s.outbox.length ? `Sync now (${s.outbox.length})` : 'Sync now'} quiet onPress={() => void sync()} />
            <Button label="Disconnect" quiet onPress={() => void disconnect()} />
          </View>
        ) : authAvailable ? (
          <Button label={busy ? 'Connecting…' : 'Connect Google account'} onPress={onConnect} />
        ) : (
          <Text style={styles.hint}>Sign-in works in the iOS and Android apps, not in this web preview.</Text>
        )}
        {(error ?? s.syncError) && <Text style={styles.error}>{error ?? s.syncError}</Text>}
      </Section>

      <Section title="Default currency">
        <View style={styles.wrap}>
          {currencies.map((c) => (
            <Chip key={c} label={c} selected={c === s.settings.currency} onPress={() => s.setCurrency(c)} />
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, minWidth: 0 }]}
            placeholder="Other (3-letter code)"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            maxLength={3}
            value={currency}
            onChangeText={setCurrency}
            onSubmitEditing={addCurrency}
          />
          <Button label="Use" quiet onPress={addCurrency} />
        </View>
      </Section>

      <Section title="Categories">
        <View style={styles.wrap}>
          {s.settings.categories.map((c) => (
            <Chip
              key={c.name}
              label={`${c.emoji} ${c.name}`}
              onRemove={s.settings.categories.length > 1 ? () => s.removeCategory(c.name) : undefined}
            />
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { width: 56, textAlign: 'center' }]}
            placeholder="🏷️"
            placeholderTextColor={colors.muted}
            maxLength={4}
            value={emoji}
            onChangeText={setEmoji}
            accessibilityLabel="Category emoji"
          />
          <TextInput
            style={[styles.input, { flex: 1, minWidth: 0 }]}
            placeholder="New category"
            placeholderTextColor={colors.muted}
            value={category}
            onChangeText={setCategory}
            onSubmitEditing={addCategory}
          />
          <Button label="Add" quiet onPress={addCategory} />
        </View>
      </Section>

      <Section title="Types of expense" hint="Tap one to make it the default.">
        <View style={styles.wrap}>
          {s.settings.types.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={t === s.settings.defaultType}
              onPress={() => s.setDefaultType(t)}
              onRemove={s.settings.types.length > 1 ? () => s.removeType(t) : undefined}
            />
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, minWidth: 0 }]}
            placeholder="New type"
            placeholderTextColor={colors.muted}
            value={type}
            onChangeText={setType}
            onSubmitEditing={addType}
          />
          <Button label="Add" quiet onPress={addType} />
        </View>
      </Section>

      {detectionSupported && (
        <Section
          title="Detect card payments"
          hint={
            detecting
              ? 'On. When your bank notifies you of a payment, it appears here for you to confirm.'
              : 'Let BudgetTracker read payment notifications from your bank so expenses are suggested automatically. Notifications are processed on your phone only.'
          }>
          <Button label={detecting ? 'Manage notification access' : 'Turn on'} quiet={detecting} onPress={() => void enableDetection()} />
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: 16, gap: 16, paddingBottom: 48, width: '100%', maxWidth: 520, alignSelf: 'center' },
  section: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: colors.accent, paddingHorizontal: 16, height: 44, borderRadius: 12, justifyContent: 'center' },
  buttonQuiet: { backgroundColor: colors.surfaceHi },
  buttonText: { color: colors.accentInk, fontSize: 15, fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceHi,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipRemove: { color: colors.muted, fontSize: 12 },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
  },
});
