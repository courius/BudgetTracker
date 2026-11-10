import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

/** Applies a key press to the amount being typed (max two decimals, eight digits). */
export function pressKey(current: string, key: string): string {
  if (key === '⌫') return current.slice(0, -1);
  if (key === '.') return current.includes('.') ? current : (current || '0') + '.';
  const [whole, decimals] = current.split('.');
  if (decimals !== undefined ? decimals.length >= 2 : whole.length >= 8) return current;
  return current === '0' ? key : current + key;
}

export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={key === '⌫' ? 'Delete' : key}
          onPress={() => onKey(key)}
          style={({ pressed }) => [styles.key, pressed && styles.pressed]}>
          <Text style={styles.label}>{key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  key: { width: '33.333%', height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  pressed: { backgroundColor: colors.surfaceHi },
  label: { color: colors.text, fontSize: 26, fontWeight: '500' },
});
